import { doc, runTransaction } from 'firebase/firestore';
import { db } from './config';
import { HONORS_MAX, parseHonors, type Honor } from '@/logic/honors';

/**
 * Concede uma honraria: acrescenta ao campo `honors` do doc do grupo. Em transação, para dois admins
 * concedendo ao mesmo tempo não perderem a honraria um do outro. Só admin escreve no doc do grupo (regra existente).
 */
export async function grantHonor(groupId: string, honor: Honor): Promise<void> {
  const ref = doc(db, 'groups', groupId);
  await runTransaction(db, async tx => {
    const current = parseHonors((await tx.get(ref)).data()?.honors);
    if (current.length >= HONORS_MAX) throw new Error('Limite de honrarias do grupo atingido.');
    tx.update(ref, { honors: [honor, ...current] });
  });
}

export async function removeHonor(groupId: string, honorId: string): Promise<void> {
  const ref = doc(db, 'groups', groupId);
  await runTransaction(db, async tx => {
    const current = parseHonors((await tx.get(ref)).data()?.honors);
    tx.update(ref, { honors: current.filter(h => h.id !== honorId) });
  });
}
