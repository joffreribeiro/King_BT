import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { DEFAULT_SCORING, validateScoringConfig, type ScoringConfig } from '@/logic/scoringConfig';
import type { Format } from '@/logic/types';

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
  // Fórmula de pontuação global (editável só pelo Super Admin). Carregada em
  // tempo real de /config/scoring; cai no DEFAULT_SCORING se ausente/erro.
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
  const [defaultMaxScore, setDefaultMaxScore] = useState(6);
  const [defaultFormat, setDefaultFormat] = useState<Format | ''>('');
  const [keepSacadorAfterSave, setKeepSacadorAfterSaveState] = useState(false);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(DEFAULT_SCORING);

  useEffect(() => {
    AsyncStorage.getItem(KEEP_SACADOR_KEY).then(v => {
      if (v != null) setKeepSacadorAfterSaveState(v === 'true');
    });
  }, []);

  // Fórmula de pontuação em tempo real: qualquer edição do Super Admin
  // se propaga a todos os dispositivos sem precisar reabrir o app.
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'scoring'),
      snap => setScoringConfig(snap.exists() ? validateScoringConfig(snap.data()) : DEFAULT_SCORING),
      () => setScoringConfig(DEFAULT_SCORING),
    );
    return unsub;
  }, []);

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
