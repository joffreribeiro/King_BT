// Rotação de saque do scout (análise de partida). Lógica pura, testada em
// __tests__/btRotacao.test.ts — portada do scout do KING BT Playbook, que
// corrigiu três erros da versão que vivia dentro de app/analise/[matchId]/ponto.tsx:
//  1. ao cruzar para um set novo, o sacador do game que FECHOU o set anterior
//     entrava na sequência do set novo (sugestão errada nos 2 primeiros games);
//  2. depois de um ponto que fecha um game, a sequência ficava um game atrás
//     ao reabrir a partida (o 4º sacador nunca voltava para o 1º);
//  3. no tie-break, a sugestão era sempre o 1º jogador de cada dupla.
import { placardInicial, avancaPonto, type BtPlacarSeed, type BtPonto, type BtWinRule } from './btTracker';

/**
 * Próximo sacador pela rotação de games, a partir da sequência de sacadores
 * dos games já fechados no set atual. `null` quando a escolha é manual.
 * - Duplas: games 1 e 2 manuais; a partir do 3º, o parceiro de quem sacou 2 games atrás.
 * - Individual: game 1 manual; depois alterna.
 */
export function proximoSacadorAutomatico(
  seq: string[], jogadoresA: string[], jogadoresB: string[], isDuplas: boolean,
): string | null {
  if (isDuplas) {
    if (seq.length < 2) return null;
    const ref = seq[seq.length - 2];
    const equipe = jogadoresA.includes(ref) ? jogadoresA : jogadoresB;
    return equipe.find(id => id !== ref) ?? null;
  }
  if (seq.length === 0) return null;
  const ultimo = seq[seq.length - 1];
  return [...jogadoresA, ...jogadoresB].find(id => id !== ultimo) ?? null;
}

/**
 * Sacadores (1º ponto de cada game) dos games JÁ FECHADOS no set atual,
 * recalculados do zero a partir dos pontos — vale ao abrir a partida, depois
 * de registrar, desfazer ou editar um ponto. Não inclui o game em andamento.
 */
export function deriveSeqSacadores(pontos: BtPonto[], rule: BtWinRule, seed?: BtPlacarSeed): string[] {
  let pl = placardInicial(rule, seed);
  let seq: string[] = [];
  let currentGameSacador: string | null = null;
  let lastSets = 0;
  let lastGames = 0;

  for (const p of pontos) {
    const curSets = pl.setsA + pl.setsB;
    const curGames = pl.gamesA + pl.gamesB;
    if (curGames !== lastGames || curSets !== lastSets) {
      if (currentGameSacador !== null) {
        // Set novo: só zera — o game que fechou o set anterior não pertence a este.
        if (curSets > lastSets) seq = [];
        else seq.push(currentGameSacador);
      }
      currentGameSacador = p.sacador;
      lastGames = curGames;
      lastSets = curSets;
    }
    if (currentGameSacador === null) currentGameSacador = p.sacador;
    pl = avancaPonto(pl, p.vencedorDupla, p.sacador);
  }
  // O último ponto pode ter fechado um game: o seguinte ainda não tem pontos,
  // mas o game fechado já precisa contar para a sugestão do próximo sacador.
  if (currentGameSacador !== null) {
    const curSets = pl.setsA + pl.setsB;
    const curGames = pl.gamesA + pl.gamesB;
    if (curGames !== lastGames || curSets !== lastSets) {
      if (curSets > lastSets) seq = [];
      else seq.push(currentGameSacador);
    }
  }
  return seq;
}

/**
 * Sacador sugerido DENTRO de um tie-break (ou super tie-break). O 1º saca 1
 * ponto; depois cada um saca 2 seguidos, na ordem 1º sacador → adversário
 * seguinte da rotação → parceiro do 1º → outro adversário (individual: alterna).
 * `null` fora do tie-break (aí vale a rotação por games).
 */
export function sacadorNoTiebreak(
  pontos: BtPonto[], rule: BtWinRule, seq: string[],
  jogadoresA: string[], jogadoresB: string[], isDuplas: boolean, seed?: BtPlacarSeed,
): string | null {
  let pl = placardInicial(rule, seed);
  let inicio = -1;
  pontos.forEach((p, i) => {
    if (pl.tiebreak && inicio < 0) inicio = i;
    if (!pl.tiebreak) inicio = -1;
    pl = avancaPonto(pl, p.vencedorDupla, p.sacador);
  });
  if (!pl.tiebreak) return null;
  if (inicio < 0) inicio = pontos.length;
  const n = pontos.length - inicio;

  const primeiro = n > 0 ? pontos[inicio].sacador : proximoSacadorAutomatico(seq, jogadoresA, jogadoresB, isDuplas);
  if (!primeiro) return null;
  const meus = jogadoresA.includes(primeiro) ? jogadoresA : jogadoresB;
  const outros = meus === jogadoresA ? jogadoresB : jogadoresA;

  let ordem: string[];
  if (isDuplas && meus.length > 1 && outros.length > 1) {
    const ultimoAdv = [...seq].reverse().find(id => outros.includes(id));
    const adv1 = ultimoAdv ? outros.find(id => id !== ultimoAdv) ?? outros[0] : outros[0];
    const adv2 = outros.find(id => id !== adv1) ?? adv1;
    ordem = [primeiro, adv1, meus.find(id => id !== primeiro) ?? primeiro, adv2];
  } else {
    ordem = [primeiro, outros[0] ?? primeiro];
  }
  return ordem[Math.floor((n + 1) / 2) % ordem.length];
}

/** Sacador sugerido para o próximo ponto: tie-break primeiro, senão rotação por games. */
export function sacadorSugerido(
  pontos: BtPonto[], rule: BtWinRule, jogadoresA: string[], jogadoresB: string[], isDuplas: boolean, seed?: BtPlacarSeed,
): string | null {
  const seq = deriveSeqSacadores(pontos, rule, seed);
  return sacadorNoTiebreak(pontos, rule, seq, jogadoresA, jogadoresB, isDuplas, seed)
    ?? proximoSacadorAutomatico(seq, jogadoresA, jogadoresB, isDuplas);
}
