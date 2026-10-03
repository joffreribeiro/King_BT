import { doc, runTransaction } from 'firebase/firestore';
import { db } from './config';
import { buildSeason, parseSeasons, type Season, type SeasonRow } from '@/logic/seasons';

/**
 * Encerra a temporada em andamento: grava o ranking final no campo `seasons`
 * do doc do grupo. Fica no próprio doc do grupo (como `scoringConfig`) para
 * reaproveitar a regra de escrita já existente, restrita ao admin.
 *
 * Em transação: se dois admins tocarem em "Encerrar" ao mesmo tempo (ou o
 * mesmo admin tocar duas vezes), a segunda vê a temporada já gravada e não
 * cria outra vazia por cima.
 *
 * `expectedNumber` é o número da temporada que a tela mostrava; se já mudou,
 * não grava nada e devolve null.
 */
export async function endSeason(groupId: string, ranking: SeasonRow[], expectedNumber: number): Promise<Season | null> {
  const ref = doc(db, 'groups', groupId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const seasons = parseSeasons(snap.data()?.seasons);
    if (seasons.length + 1 !== expectedNumber) return null;
    const season = buildSeason(seasons, ranking);
    tx.update(ref, { seasons: [...seasons, season] });
    return season;
  });
}

/**
 * Desfaz o último encerramento: remove a temporada mais recente e o ranking
 * volta a contar desde o fim da anterior (os jogos nunca foram apagados).
 * `expectedNumber` é o número da temporada que a tela mostra como a última;
 * se já mudou (outro admin desfez ou encerrou), não faz nada e devolve false.
 */
export async function undoLastSeason(groupId: string, expectedNumber: number): Promise<boolean> {
  const ref = doc(db, 'groups', groupId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const seasons = parseSeasons(snap.data()?.seasons);
    const last = seasons[seasons.length - 1];
    if (!last || last.number !== expectedNumber) return false;
    tx.update(ref, { seasons: seasons.slice(0, -1) });
    return true;
  });
}
