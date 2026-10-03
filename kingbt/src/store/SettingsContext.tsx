import React, { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { DEFAULT_SCORING, validateScoringConfig, resolveScoring, type ScoringConfig } from '@/logic/scoringConfig';
import { parseSeasons, currentSeasonNumber, type Season } from '@/logic/seasons';
import { DEFAULT_XP_CONFIG, validateXpConfig, type XpConfig } from '@/logic/xpConfig';
import { parseHonors, type Honor } from '@/logic/honors';
import { parseAnnouncements, type Announcement } from '@/logic/announcements';
import { DEFAULT_CATEGORY_CUTS, validateCategoryCuts, type CategoryCuts } from '@/logic/categorySuggestion';
import { useAuth } from './AuthContext';

type CtxType = {
  // Mantém sacador/posição selecionados após salvar um ponto no King Scout,
  // em vez de resetar o formulário inteiro (equivalente ao "manter formulário
  // aberto ao salvar ponto" do BT Tracker, adaptado à tela contínua do King BT).
  keepSacadorAfterSave: boolean;
  setKeepSacadorAfterSave: (v: boolean) => void;
  // Fórmula de pontuação do grupo ativo (editável pelo admin do grupo).
  // Carregada em tempo real de /groups/{groupId}/config/scoring; cai no
  // DEFAULT_SCORING se ausente/erro/sem grupo.
  scoringConfig: ScoringConfig;
  // Temporadas já encerradas do grupo (campo `seasons` do doc do grupo, mais antiga primeiro).
  seasons: Season[];
  // Quanto XP cada ação rende neste grupo (campo `xpConfig` do doc do grupo).
  xpConfig: XpConfig;
  /** Honrarias concedidas pelo admin (campo `honors` do doc do grupo), da mais recente para a mais antiga. */
  honors: Honor[];
  /** Comunicados do admin (campo `announcements` do doc do grupo): fixados primeiro, depois os mais recentes. */
  announcements: Announcement[];
  /** Fórmula como gravada pelo admin (com o plano de suavização do GA), para a tela de edição. */
  scoringConfigRaw: ScoringConfig;
  // Nota mínima de cada categoria na sugestão pela avaliação (campo `categoryCuts` do doc do grupo).
  categoryCuts: CategoryCuts;
};

const Ctx = createContext<CtxType>({
  keepSacadorAfterSave: false,
  setKeepSacadorAfterSave: () => {},
  scoringConfig: DEFAULT_SCORING,
  seasons: [],
  xpConfig: DEFAULT_XP_CONFIG,
  honors: [],
  announcements: [],
  scoringConfigRaw: DEFAULT_SCORING,
  categoryCuts: DEFAULT_CATEGORY_CUTS,
});

const KEEP_SACADOR_KEY = 'settings:keepSacadorAfterSave';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { group } = useAuth();
  const [keepSacadorAfterSave, setKeepSacadorAfterSaveState] = useState(false);
  const [scoringConfigRaw, setScoringConfig] = useState<ScoringConfig>(DEFAULT_SCORING);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [xpConfig, setXpConfig] = useState<XpConfig>(DEFAULT_XP_CONFIG);
  const [honors, setHonors] = useState<Honor[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  // Fórmula EFETIVA da temporada atual: a suavização do GA só entra a partir da temporada agendada.
  const scoringConfig = useMemo(() => resolveScoring(scoringConfigRaw, currentSeasonNumber(seasons)), [scoringConfigRaw, seasons]);
  const [categoryCuts, setCategoryCuts] = useState<CategoryCuts>(DEFAULT_CATEGORY_CUTS);

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
      setSeasons([]);
      setXpConfig(DEFAULT_XP_CONFIG);
      setCategoryCuts(DEFAULT_CATEGORY_CUTS);
      setHonors([]);
      setAnnouncements([]);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'groups', group.id),
      snap => {
        setScoringConfig(snap.exists() ? validateScoringConfig(snap.data()?.scoringConfig) : DEFAULT_SCORING);
        setSeasons(snap.exists() ? parseSeasons(snap.data()?.seasons) : []);
        setXpConfig(snap.exists() ? validateXpConfig(snap.data()?.xpConfig) : DEFAULT_XP_CONFIG);
        setHonors(snap.exists() ? parseHonors(snap.data()?.honors) : []);
        setAnnouncements(snap.exists() ? parseAnnouncements(snap.data()?.announcements) : []);
        setCategoryCuts(snap.exists() ? validateCategoryCuts(snap.data()?.categoryCuts) : DEFAULT_CATEGORY_CUTS);
      },
      () => { setScoringConfig(DEFAULT_SCORING); setSeasons([]); setXpConfig(DEFAULT_XP_CONFIG); setCategoryCuts(DEFAULT_CATEGORY_CUTS); setHonors([]); setAnnouncements([]); },
    );
    return unsub;
  }, [group?.id]);

  function setKeepSacadorAfterSave(v: boolean) {
    setKeepSacadorAfterSaveState(v);
    AsyncStorage.setItem(KEEP_SACADOR_KEY, String(v)).catch(() => {});
  }

  return (
    <Ctx.Provider value={{
      keepSacadorAfterSave, setKeepSacadorAfterSave, scoringConfig, scoringConfigRaw, seasons, xpConfig, categoryCuts, honors, announcements,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() { return useContext(Ctx); }
