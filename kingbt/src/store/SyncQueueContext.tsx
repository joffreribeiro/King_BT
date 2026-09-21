import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getQueue, removeFromQueue, getQueueSize, incrementRetries, getStuckCount, MAX_RETRIES } from './syncQueue';
import { updateCompetition, mutateCompetition } from '@/firebase/competitions';
import { applyScore, withMatches } from '@/logic/competitionOps';
import { DEFAULT_SCORING, validateScoringConfig } from '@/logic/scoringConfig';
import type { SetScore } from '@/logic/types';
import { saveAnaliseFs } from '@/firebase/analises';
import type { BtAnalise } from '@/logic/btTracker';
import type { Competition } from '@/logic/types';
import { useAuth } from './AuthContext';

type SyncQueueContextType = {
  pendingCount: number;
  stuckCount: number;
  isOnline: boolean;
};

const Ctx = createContext<SyncQueueContextType>({ pendingCount: 0, stuckCount: 0, isOnline: true });

export function SyncQueueProvider({ children }: { children: React.ReactNode }) {
  const { group } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [stuckCount, setStuckCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  // Evita duas passadas concorrentes pela fila — o NetInfo pode disparar
  // várias mudanças de estado em sequência rápida (ex.: "conectando" →
  // "conectado" → confirmação de internet alcançável).
  const flushing = useRef(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      if (online) flushQueue();
    });
    return unsub;
  }, [group]);

  // Retentativa periódica, independente de eventos de rede do SO. Uma
  // escrita pode falhar por timeout/instabilidade do Firestore sem que o
  // dispositivo jamais reporte mudança de conectividade — o Wi-Fi da quadra
  // fica "conectado" o tempo todo mesmo perdendo pacotes. Sem este timer, um
  // item nessas condições ficava preso na fila para sempre: o NetInfo nunca
  // dispara de novo porque, do ponto de vista do SO, nada mudou.
  useEffect(() => {
    const interval = setInterval(async () => {
      setPendingCount(await getQueueSize());
      setStuckCount(await getStuckCount());
      if (isOnline) flushQueue();
    }, 15000);
    return () => clearInterval(interval);
  }, [isOnline, group]);

  async function flushQueue() {
    if (!group) return;
    if (flushing.current) return;
    flushing.current = true;
    try {
      await flushQueueOnce();
    } finally {
      flushing.current = false;
    }
  }

  async function flushQueueOnce() {
    const queue = await getQueue();
    for (const item of queue) {
      // Esgotou as tentativas automáticas — provavelmente um erro
      // permanente (permission-denied, documento que não existe mais), não
      // transitório. Continuar tentando a cada 15s/evento de rede só gasta
      // bateria e rede sem nunca resolver; o item fica visível como "com
      // erro" no banner (stuckCount) em vez de sumir ou ficar invisível.
      if (item.retries >= MAX_RETRIES) continue;
      try {
        if (item.type === 'APPLY_SCORE') {
          // Reaplica a INTENÇÃO sobre a competição do servidor, em vez de
          // gravar o documento que estava em memória quando a rede caiu —
          // que a essa altura já pode estar desatualizado por conta de
          // jogos que outras pessoas registraram no meio tempo.
          const p = item.payload as {
            groupId: string; compId: string; matchId: string;
            scoreA: number; scoreB: number; sets: SetScore[] | null; cfg: unknown;
          };
          const cfg = validateScoringConfig(p.cfg, DEFAULT_SCORING);
          await mutateCompetition(p.groupId, p.compId, (servidor) =>
            applyScore(servidor, p.matchId, p.scoreA, p.scoreB, p.sets ?? undefined, cfg),
          );
          await removeFromQueue(item.id);
        } else if (item.type === 'DELETE_MATCH' || item.type === 'EDIT_MATCH_PLAYERS') {
          const p = item.payload as {
            groupId: string; compId: string; matchId: string;
            teamA: string[] | null; teamB: string[] | null; cfg: unknown;
          };
          const cfg = validateScoringConfig(p.cfg, DEFAULT_SCORING);
          await mutateCompetition(p.groupId, p.compId, (servidor) =>
            item.type === 'DELETE_MATCH'
              ? withMatches(servidor, servidor.matches.filter(m => m.id !== p.matchId), cfg)
              : withMatches(servidor, servidor.matches.map(m =>
                  m.id !== p.matchId ? m : { ...m, teamA: p.teamA ?? m.teamA, teamB: p.teamB ?? m.teamB }
                ), cfg),
          );
          await removeFromQueue(item.id);
        } else if (item.type === 'UPDATE_COMP') {
          // Formato antigo: grava o documento inteiro. Continua aqui só para
          // esvaziar filas gravadas por versões anteriores do app.
          await updateCompetition(
            item.payload.groupId as string,
            item.payload.data as Competition
          );
          await removeFromQueue(item.id);
        } else if (item.type === 'SAVE_ANALISE') {
          await saveAnaliseFs(
            item.payload.groupId as string,
            item.payload.analise as BtAnalise
          );
          await removeFromQueue(item.id);
        } else {
          // Tipo desconhecido (versão antiga do app): descarta, senão fica
          // preso para sempre inflando o contador de pendências.
          await removeFromQueue(item.id);
        }
      } catch {
        // Deixar na fila para tentar novamente, mas contar a tentativa —
        // sem isso, MAX_RETRIES nunca é atingido e o item tenta pra sempre.
        await incrementRetries(item.id).catch(() => {});
      }
    }
    setPendingCount(await getQueueSize());
    setStuckCount(await getStuckCount());
  }

  return (
    <Ctx.Provider value={{ pendingCount, stuckCount, isOnline }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSyncQueue() {
  return useContext(Ctx);
}
