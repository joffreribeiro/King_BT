import { doc, updateDoc } from 'firebase/firestore';
import { db } from './config';
import { validateCategoryCuts, type CategoryCuts } from '@/logic/categorySuggestion';

/** Salva a nota mínima de cada categoria no doc do grupo (campo `categoryCuts`); a escrita já é restrita ao admin. */
export async function setCategoryCuts(groupId: string, cuts: CategoryCuts): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), { categoryCuts: validateCategoryCuts(cuts) });
}
