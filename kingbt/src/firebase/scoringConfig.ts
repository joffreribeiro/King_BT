import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './config';
import {
  DEFAULT_SCORING, validateScoringConfig, isScoringConfigValid, type ScoringConfig,
} from '@/logic/scoringConfig';

const SCORING_DOC = doc(db, 'config', 'scoring');

/**
 * Lê a fórmula de pontuação global de /config/scoring. Retorna DEFAULT_SCORING
 * se o documento não existir ou se der erro de leitura (fallback seguro).
 */
export async function getScoringConfig(): Promise<ScoringConfig> {
  try {
    const snap = await getDoc(SCORING_DOC);
    if (!snap.exists()) return DEFAULT_SCORING;
    return validateScoringConfig(snap.data());
  } catch {
    return DEFAULT_SCORING;
  }
}

/**
 * Valida e salva a fórmula em /config/scoring, com auditoria (updatedAt/updatedBy).
 * Lança se o config for inválido — a UI deve validar antes de chamar.
 * A escrita só é permitida ao Super Admin pelas regras do Firestore.
 */
export async function setScoringConfig(cfg: ScoringConfig): Promise<void> {
  if (!isScoringConfigValid(cfg)) throw new Error('Fórmula de pontuação inválida.');
  const safe = validateScoringConfig(cfg);
  await setDoc(SCORING_DOC, {
    ...safe,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.email ?? null,
  });
}
