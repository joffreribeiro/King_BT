/**
 * Placar mostrado em cada ponto: o placar DEPOIS do ponto ("3x1 15x0"), como nos relatórios de referência.
 * O que fica salvo em `gameScore`/`setScore` continua sendo o de ANTES do ponto (as contas de 40×40 e
 * break point dependem disso), então este texto é sempre recalculado a partir dos pontos e vale também
 * para análises antigas. Portado do scout do KING BT Playbook (src/logic/placarPonto.ts).
 */
import type { SetScore } from './types';
import { avancaPonto, formatGameScore, placardInicial, setsDoPlacard, type BtPlacardState, type BtPlacarSeed, type BtPonto, type BtWinRule } from './btTracker';

type Jogo = { pontos: Pick<BtPonto, 'vencedorDupla' | 'sacador'>[]; rule: BtWinRule; inicial?: BtPlacarSeed };

/** Texto do placar logo depois de um ponto, a partir do estado antes e depois dele. */
export function rotuloPlacarApos(antes: BtPlacardState, depois: BtPlacardState): string {
  const setsAntes = antes.setsA + antes.setsB;
  const setsDepois = depois.setsA + depois.setsB;
  if (depois.encerrada) {
    const k = depois.historicGamesA.length - 1;
    const ultimo = k >= 0 ? ` (último set ${depois.historicGamesA[k]}x${depois.historicGamesB[k] ?? 0})` : '';
    return `Fim · ${depois.setsA}x${depois.setsB} em sets${ultimo}`;
  }
  if (setsDepois > setsAntes) {
    const k = depois.historicGamesA.length - 1;
    return `Set ${setsDepois} encerrado · ${depois.historicGamesA[k]}x${depois.historicGamesB[k] ?? 0}`;
  }
  const prefixo = setsDepois > 0 ? `Set ${setsDepois + 1} · ` : '';
  const games = `${depois.gamesA}x${depois.gamesB}`;
  const game = depois.pontosA === 0 && depois.pontosB === 0 ? '' : ` ${formatGameScore(depois)}`;
  return `${prefixo}${games}${game}`;
}

/**
 * Placar set a set para salvar na partida da competição (`Match.sets`), com os pontos do tie-break de cada
 * set que o teve. O placar da competição só guarda games por set — sem isto o tie-break se perde.
 */
export function setsDoPlacardComTiebreak(jogo: Jogo, placard: BtPlacardState): SetScore[] {
  const tbs = tiebreaksDosSets(jogo);
  return setsDoPlacard(placard).map((set, i) => (tbs[i] && !set.stb ? { ...set, tb: tbs[i] } : set));
}

/** O placar depois de cada ponto, na ordem em que aconteceram. */
export function placaresAposPontos(jogo: Jogo): string[] {
  let atual = placardInicial(jogo.rule, jogo.inicial);
  return jogo.pontos.map(p => {
    const antes = atual;
    atual = avancaPonto(atual, p.vencedorDupla, p.sacador);
    return rotuloPlacarApos(antes, atual);
  });
}

/**
 * Pontos do tie-break de cada set já fechado (índice = posição do set), para mostrar como expoente
 * ao lado dos games ("6-7⁵"). `undefined` quando o set não teve tie-break comum — o super tie-break
 * já guarda os próprios pontos como placar do set.
 */
export function tiebreaksDosSets(jogo: Jogo): ({ a: number; b: number } | undefined)[] {
  let atual = placardInicial(jogo.rule, jogo.inicial);
  const saida: ({ a: number; b: number } | undefined)[] = [];
  for (const p of jogo.pontos) {
    const antes = atual;
    atual = avancaPonto(atual, p.vencedorDupla, p.sacador);
    if (antes.tiebreak && !antes.superTiebreakAtivo && atual.historicGamesA.length > antes.historicGamesA.length) {
      saida[antes.historicGamesA.length] = {
        a: antes.pontosA + (p.vencedorDupla === 'A' ? 1 : 0),
        b: antes.pontosB + (p.vencedorDupla === 'B' ? 1 : 0),
      };
    }
  }
  return saida;
}
