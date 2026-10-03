import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';

/**
 * Prévia pública de um grupo, guardada no doc do código de convite
 * (/groupCodes/{CÓDIGO}). É o que a pessoa vê ANTES de pedir para entrar — um
 * grupo privado não pode ser lido por quem ainda não é membro, então nome e
 * descrição ficam aqui, num doc que só se lê por código exato (nunca listado).
 */
export interface GroupPreview {
  code: string;
  groupId: string;
  name: string;
  description: string;
  visibility: 'privado' | 'publico';
}

/** Lê a prévia pelo código. null = código não existe. Grupos antigos (sem prévia gravada) vêm sem nome. */
export async function getGroupPreview(code: string): Promise<GroupPreview | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const snap = await getDoc(doc(db, 'groupCodes', clean));
  const d = snap.data();
  if (!d?.groupId) return null;
  return {
    code: clean,
    groupId: String(d.groupId),
    name: typeof d.name === 'string' && d.name ? d.name : '',
    description: typeof d.description === 'string' ? d.description : '',
    visibility: d.visibility === 'publico' ? 'publico' : 'privado',
  };
}

/**
 * Admin: grava/atualiza nome, descrição e visibilidade na prévia do código. Inclui o `groupId`,
 * então também CRIA o registro de grupos antigos que nunca tiveram um (sem ele o código
 * não resolve e ninguém entra). Se o código já aponta para outro grupo, a regra recusa.
 */
export async function syncGroupPreview(
  code: string,
  groupId: string,
  preview: { name?: string; description?: string; visibility?: 'privado' | 'publico' },
): Promise<void> {
  const data: Record<string, string> = { groupId };
  if (preview.name !== undefined) data.name = preview.name;
  if (preview.description !== undefined) data.description = preview.description;
  if (preview.visibility !== undefined) data.visibility = preview.visibility;
  await setDoc(doc(db, 'groupCodes', code), data, { merge: true });
}
