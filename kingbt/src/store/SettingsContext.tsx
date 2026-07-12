import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
};

const Ctx = createContext<CtxType>({
  defaultMaxScore: 6,
  setDefaultMaxScore: () => {},
  defaultFormat: '',
  setDefaultFormat: () => {},
  keepSacadorAfterSave: false,
  setKeepSacadorAfterSave: () => {},
});

const KEEP_SACADOR_KEY = 'settings:keepSacadorAfterSave';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [defaultMaxScore, setDefaultMaxScore] = useState(6);
  const [defaultFormat, setDefaultFormat] = useState<Format | ''>('');
  const [keepSacadorAfterSave, setKeepSacadorAfterSaveState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEEP_SACADOR_KEY).then(v => {
      if (v != null) setKeepSacadorAfterSaveState(v === 'true');
    });
  }, []);

  function setKeepSacadorAfterSave(v: boolean) {
    setKeepSacadorAfterSaveState(v);
    AsyncStorage.setItem(KEEP_SACADOR_KEY, String(v)).catch(() => {});
  }

  return (
    <Ctx.Provider value={{
      defaultMaxScore, setDefaultMaxScore, defaultFormat, setDefaultFormat,
      keepSacadorAfterSave, setKeepSacadorAfterSave,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() { return useContext(Ctx); }
