import { doc, runTransaction } from 'firebase/firestore';
import { db } from './config';
import { parseAnnouncements, withAnnouncement, type Announcement } from '@/logic/announcements';

/**
 * Publica um comunicado: acrescenta ao campo `announcements` do doc do grupo, em transação (dois admins
 * publicando juntos não perdem o aviso um do outro). Só o admin escreve no doc do grupo (regra existente).
 */
export async function publishAnnouncement(groupId: string, a: Announcement): Promise<void> {
  const ref = doc(db, 'groups', groupId);
  await runTransaction(db, async tx => {
    const current = parseAnnouncements((await tx.get(ref)).data()?.announcements);
    tx.update(ref, { announcements: withAnnouncement(current, a) });
  });
}

export async function removeAnnouncement(groupId: string, id: string): Promise<void> {
  const ref = doc(db, 'groups', groupId);
  await runTransaction(db, async tx => {
    const current = parseAnnouncements((await tx.get(ref)).data()?.announcements);
    tx.update(ref, { announcements: current.filter(a => a.id !== id) });
  });
}
