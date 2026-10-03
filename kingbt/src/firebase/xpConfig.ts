import { doc, updateDoc } from 'firebase/firestore';
import { db } from './config';
import { validateXpConfig, type XpConfig } from '@/logic/xpConfig';

/**
 * Salva quanto XP cada ação rende, no campo `xpConfig` do doc do grupo (como
 * `scoringConfig`): reaproveita a regra de escrita que já restringe ao admin.
 */
export async function setXpConfig(groupId: string, cfg: XpConfig): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), { xpConfig: validateXpConfig(cfg) });
}
