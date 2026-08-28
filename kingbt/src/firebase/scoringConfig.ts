import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './config';
import {
  DEFAULT_SCORING, validateScoringConfig, isScoringConfigValid, type ScoringConfig,
} from '@/logic/scoringConfig';

const groupDoc = (groupId: string) => doc(db, 'groups', groupId);

/**
 * Lê a fórmula de pontuação do grupo — campo `scoringConfig` dentro do próprio
 * doc /groups/{groupId} (não uma subcoleção: assim reaproveita a regra de
 * escrita do grupo, que já restringe ao admin, e evita um listener extra).
 * Retorna DEFAULT_SCORING se o campo não existir ou se der erro de leitura —
 * inclusive para grupos criados antes dessa feature existir.
 */
export async function getScoringConfig(groupId: string): Promise<ScoringConfig> {
  try {
    const snap = await getDoc(groupDoc(groupId));
    if (!snap.exists()) return DEFAULT_SCORING;
    return validateScoringConfig(snap.data()?.scoringConfig);
  } catch {
    return DEFAULT_SCORING;
  }
}

/**
 * Valida e salva a fórmula no campo `scoringConfig` do doc do grupo. Lança se
 * o config for inválido — a UI deve validar antes de chamar. A escrita só é
 * permitida ao admin do grupo pelas regras do Firestore (regra já existente
 * `allow update: if isGroupAdmin(gid)`).
 */
export async function setScoringConfig(groupId: string, cfg: ScoringConfig): Promise<void> {
  if (!isScoringConfigValid(cfg)) throw new Error('Fórmula de pontuação inválida.');
  const safe = validateScoringConfig(cfg);
  await updateDoc(groupDoc(groupId), { scoringConfig: safe });
}
