import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { DEFAULT_SCORING, validateScoringConfig, type ScoringConfig } from '@/logic/scoringConfig';
import type { Format } from '@/logic/types';
import { useAuth } from './AuthContext';

type CtxType = {
  defaultMaxScore: number;
  setDefaultMaxScore: (v: number) => void;
  defaultFormat: Format | '';
  setDefaultFormat: (v: Format | '') => void;
  // Mantém sacador/posição selecionados após salvar um ponto no King Scout,
  // em vez de resetar o formulário inteiro (equivalente ao "manter formulário
  // aberto ao salvar ponto" do BT Tracker, adaptado à tela contínua do King BT).
  keepSacadorAfterSave: boolean;
  setKeepSacadorAfterSave: (v: boolean) => void;
  // Fórmula de pontuação do grupo ativo (editável pelo admin do grupo).
  // Carregada em tempo real de /groups/{groupId}/config/scoring; cai no
  // DEFAULT_SCORING se ausente/erro/sem grupo.
  scoringConfig: ScoringConfig;
};

const Ctx = createContext<CtxType>({
  defaultMaxScore: 6,
  setDefaultMaxScore: () => {},
  defaultFormat: '',
  setDefaultFormat: () => {},
  keepSacadorAfterSave: false,
  setKeepSacadorAfterSave: () => {},
  scoringConfig: DEFAULT_SCORING,
});

const KEEP_SACADOR_KEY = 'settings:keepSacadorAfterSave';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { group } = useAuth();
  const [defaultMaxScore, setDefaultMaxScore] = useState(6);
  const [defaultFormat, setDefaultFormat] = useState<Format | ''>('');
  const [keepSacadorAfterSave, setKeepSacadorAfterSaveState] = useState(false);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(DEFAULT_SCORING);

  useEffect(() => {
    AsyncStorage.getItem(KEEP_SACADOR_KEY).then(v => {
      if (v != null) setKeepSacadorAfterSaveState(v === 'true');
    });
  }, []);

  // Fórmula de pontuação em tempo real: qualquer edição do admin do grupo
  // se propaga a todos os dispositivos sem precisar reabrir o app. Re-assina
  // sempre que o grupo ativo mudar (troca de grupo, login/logout).
  // Fica num campo do próprio doc do grupo (não numa subcoleção) pra
  // reaproveitar a regra de escrita já existente, restrita ao admin.
  useEffect(() => {
    if (!group) {
      setScoringConfig(DEFAULT_SCORING);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'groups', group.id),
      snap => setScoringConfig(snap.exists() ? validateScoringConfig(snap.data()?.scoringConfig) : DEFAULT_SCORING),
      () => setScoringConfig(DEFAULT_SCORING),
    );
    return unsub;
  }, [group?.id]);

  function setKeepSacadorAfterSave(v: boolean) {
    setKeepSacadorAfterSaveState(v);
    AsyncStorage.setItem(KEEP_SACADOR_KEY, String(v)).catch(() => {});
  }

  return (
    <Ctx.Provider value={{
      defaultMaxScore, setDefaultMaxScore, defaultFormat, setDefaultFormat,
      keepSacadorAfterSave, setKeepSacadorAfterSave, scoringConfig,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() { return useContext(Ctx); }
