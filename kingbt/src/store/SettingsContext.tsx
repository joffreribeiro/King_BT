import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { Format } from '@/logic/types';

type CtxType = {
  defaultMaxScore: number;
  setDefaultMaxScore: (v: number) => void;
  defaultFormat: Format | '';
  setDefaultFormat: (v: Format | '') => void;
};

const Ctx = createContext<CtxType>({
  defaultMaxScore: 6,
  setDefaultMaxScore: () => {},
  defaultFormat: '',
  setDefaultFormat: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [defaultMaxScore, setDefaultMaxScore] = useState(6);
  const [defaultFormat, setDefaultFormat] = useState<Format | ''>('');
  return (
    <Ctx.Provider value={{ defaultMaxScore, setDefaultMaxScore, defaultFormat, setDefaultFormat }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() { return useContext(Ctx); }
