import type { Competition, Match, MatchResult } from './types';

/**
 * O placar oficial de cada jogo mora no mapa `results` da competição
 * (results.{matchId} = { scoreA, scoreB, sets }), e não no array `matches`.
 *
 * Motivo: a regra do Firestore não consegue comparar o array jogo a jogo, então
 * não tinha como impedir um membro de reescrever um placar já registrado. Num
 * mapa ela consegue: quem não é admin só ACRESCENTA entradas (onlyAddsResults
 * em firestore.rules). O array continua guardando a estrutura (quem joga, fase,
 * rodada) e uma cópia do placar, mas na leitura essa cópia é ignorada — vale o
 * que está no mapa.
 *
 * Competição gravada antes disso não tem o mapa: aí vale o array, e a primeira
 * gravação pelo app cria o mapa a partir dele.
 */

/** O resultado de um jogo, no formato gravado no mapa. Sempre as três chaves, para a comparação da regra ser estável. */
export function resultOf(m: Pick<Match, 'scoreA' | 'scoreB' | 'sets'>): MatchResult | null {
  if (m.scoreA == null || m.scoreB == null) return null;
  return { scoreA: m.scoreA, scoreB: m.scoreB, sets: m.sets ?? null };
}

/** Leitura: com o mapa, o placar de cada jogo vem só dele. Sem o mapa (competição antiga), vale o array. */
export function withTrustedScores<T extends Pick<Competition, 'matches' | 'results'>>(comp: T): T {
  const results = comp.results;
  if (!results) return comp;
  return {
    ...comp,
    matches: (comp.matches ?? []).map(m => {
      const r = results[m.id];
      if (r) return { ...m, scoreA: r.scoreA, scoreB: r.scoreB, sets: r.sets ?? null };
      const { sets: _sets, ...rest } = m;
      return { ...rest, scoreA: null, scoreB: null };
    }),
  };
}

/**
 * Escrita: o mapa a gravar, partindo do que está no servidor (`base`). Jogo com
 * placar entra/atualiza; jogo sem placar sai (só um admin consegue gravar isso
 * quando havia resultado — a regra recusa para os outros). Entradas de jogos que
 * não estão mais no array ficam como estão: apagá-las faria a gravação de um
 * membro ser recusada à toa.
 */
export function buildResults(
  matches: Pick<Match, 'id' | 'scoreA' | 'scoreB' | 'sets'>[],
  base: Record<string, MatchResult> | undefined,
): Record<string, MatchResult> {
  const out: Record<string, MatchResult> = { ...(base ?? {}) };
  for (const m of matches) {
    const r = resultOf(m);
    if (r) out[m.id] = r;
    else delete out[m.id];
  }
  return out;
}
