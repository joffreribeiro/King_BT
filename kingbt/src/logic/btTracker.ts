// ─── Tipos ───────────────────────────────────────────────────────────────────

export type BtFinalizacao =
  | 'Winner'
  | 'Ace'
  | 'ForçouErro'
  | 'ErroDevolucao'
  | 'ErroSaque'
  | 'ErroNaoForcado';

export type BtTipoFinalizacao =
  | 'Smash'
  | '1-2 Combination'
  | 'Avanço'
  | 'Curta'
  | 'Lob Alto'
  | 'Lob Chutado'
  | 'Anômalo'
  | 'Rainbow'
  | 'Voleio Estático'
  | 'Voleio Dinâmico'
  | 'Devolução'
  | 'Gancho'
  | 'Defesa Baixa'
  | 'Defesa Alta'
  | 'Neutra'
  | 'Veronica'
  | 'Saque'
  | string;

export type BtLado = 'Forehand' | 'Backhand';

export type BtDuracaoPonto = 'Curto' | 'Médio' | 'Longo';

export type BtSituacao =
  | 'bolaNaFita'
  | 'bolaNaLinha'
  | 'torcida'
  | 'provocacao'
  | 'irritacao'
  | 'lesao'
  | 'furouBola'
  | 'footFault'
  | 'avancoLinha';

export type BtPosicaoSaque =
  | 'Direita-1' | 'Direita-2' | 'Direita-3' | 'Direita-4' | 'Direita-5'
  | 'Esquerda-1' | 'Esquerda-2' | 'Esquerda-3' | 'Esquerda-4' | 'Esquerda-5'
  | 'Esquerda-Lob' | 'Direita-Lob';

export type BtDirecao = '1' | '2' | '3' | '4' | '5' | 'lob';

export type BtQualidadeSaque = 'ace' | 'bom' | 'regular' | 'ruim' | 'erroSaque';

export type BtQualidadeDevolucao = 'winner' | 'boa' | 'regular' | 'ruim' | 'erroDevolucao';

export type BtDirecaoDevolucao = 'noSacador' | 'noParceiro' | 'noMeio' | 'lob';

export type BtTipoPrimeiraBola =
  | 'Lob' | 'Curta' | 'Neutra' | 'Avanço' | 'Smash' | 'Gancho' | '1-2 Combination';

export type BtDirecaoPrimeiraBola = 'Paralela' | 'Meio' | 'Cruzada';

export type BtQualidadePrimeiraBola = 'Boa' | 'Regular' | 'Ruim';

export interface BtPonto {
  id: string;
  timestamp: number;
  // Placar no momento do ponto
  gameScore: string;
  setScore: string;
  // ── SAQUE ── (beach tennis: apenas 1 saque — falta = ponto do adversário)
  sacador: string;
  posicaoSaque: BtPosicaoSaque;
  direcaoSaque?: BtDirecao;
  qualidadeSaque?: BtQualidadeSaque;
  // ── DEVOLUÇÃO (quando saque entrou) ──
  devolvedor?: string;
  qualidadeDevolucao?: BtQualidadeDevolucao;
  direcaoDevolucao?: BtDirecaoDevolucao;
  // ── PRIMEIRA BOLA (após devolução) ──
  primeiraBola?: string;                          // id do jogador que fez
  tipoPrimeiraBola?: BtTipoPrimeiraBola;
  direcaoPrimeiraBola?: BtDirecaoPrimeiraBola;
  qualidadePrimeiraBola?: BtQualidadePrimeiraBola;
  // ── RESULTADO ──
  vencedorDupla: 'A' | 'B';
  vencedorJogador?: string;
  finalizacao: BtFinalizacao;
  tipoFinalizacao?: BtTipoFinalizacao;
  ladoFinalizacao?: BtLado;           // Forehand ou Backhand
  direcaoFinalizacao?: BtDirecao;
  // ── EXTRAS ──
  duracaoPonto?: BtDuracaoPonto;      // Curto / Médio / Longo
  situacoes?: BtSituacao[];           // eventos especiais
  comentario?: string;                // texto livre
  // legado
  bolaNaFita?: boolean;
  bolaNaLinha?: boolean;
}

export interface BtAnalise {
  id: string;           // == matchId
  competitionId: string;
  matchId: string;
  criadaEm: number;
  rule: BtWinRule;
  jogadores: {
    a1: string; a2: string;   // player ids dupla A
    b1: string; b2: string;   // player ids dupla B
  };
  nomes: Record<string, string>; // id → nome
  pontos: BtPonto[];
  placarFinal?: { setsA: number; setsB: number; gamesA: number[]; gamesB: number[] };
}

// ─── Lógica de placar beach tennis ───────────────────────────────────────────

const GAME_SEQ = [0, 15, 30, 40] as const;
// "AD" é representado internamente como 50

export type BtScoutMode = 'aovivo' | 'padrao' | 'avancado';

export interface BtWinRule {
  sets: number;
  games: number;
  tiebreak: number;
  superTiebreak?: boolean;     // substitui set decisivo por super tie-break
  superTiebreakPts?: number;   // pontos do super tie-break (padrão 10)
  scoutMode?: BtScoutMode;     // modo de scout: aovivo / padrao / avancado
}

export const BT_WIN_RULE_DEFAULT: BtWinRule = { sets: 3, games: 6, tiebreak: 7, superTiebreak: false, superTiebreakPts: 10 };

export function winRuleFromComp(wr?: {
  sets?: number; games?: number; tiebreak?: number;
  superTiebreak?: boolean; superTiebreakPts?: number;
}): BtWinRule {
  return {
    sets:             wr?.sets             ?? 3,
    games:            wr?.games            ?? 6,
    tiebreak:         wr?.tiebreak         ?? 7,
    superTiebreak:    wr?.superTiebreak    ?? false,
    superTiebreakPts: wr?.superTiebreakPts ?? 10,
  };
}

export interface BtPlacardState {
  rule: BtWinRule;
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
  pontosA: number;
  pontosB: number;
  tiebreak: boolean;
  superTiebreakAtivo: boolean;         // tie-break decisivo (conta como set)
  pontosJogadosNoTiebreak: number;     // para rotação de saque
  sacadorInicioTiebreak: string | null; // 1° sacador do tie-break atual
  encerrada: boolean;
  winnerDupla: 'A' | 'B' | null;
  historicGamesA: number[];
  historicGamesB: number[];
}

export function placardInicial(rule: BtWinRule = BT_WIN_RULE_DEFAULT): BtPlacardState {
  return {
    rule,
    setsA: 0, setsB: 0,
    gamesA: 0, gamesB: 0,
    pontosA: 0, pontosB: 0,
    tiebreak: false,
    superTiebreakAtivo: false,
    pontosJogadosNoTiebreak: 0,
    sacadorInicioTiebreak: null,
    encerrada: false,
    winnerDupla: null,
    historicGamesA: [],
    historicGamesB: [],
  };
}

export function formatGameScore(state: BtPlacardState): string {
  if (state.tiebreak) return `${state.pontosA}x${state.pontosB}`;
  const labelA = GAME_SEQ[Math.min(state.pontosA, 3)] ?? 40;
  const labelB = GAME_SEQ[Math.min(state.pontosB, 3)] ?? 40;
  return `${labelA}x${labelB}`;
}

export function formatSetScore(state: BtPlacardState): string {
  return `${state.setsA}x${state.setsB}`;
}

function avancaGame(state: BtPlacardState, dupla: 'A' | 'B'): BtPlacardState {
  const s = { ...state, historicGamesA: [...state.historicGamesA], historicGamesB: [...state.historicGamesB] };
  const { games: G, sets: S } = s.rule;

  // ── Super tie-break encerrado ──────────────────────────────────────────────
  if (s.superTiebreakAtivo) {
    s.historicGamesA.push(s.gamesA);
    s.historicGamesB.push(s.gamesB);
    if (dupla === 'A') s.setsA += 1; else s.setsB += 1;
    s.gamesA = 0; s.gamesB = 0;
    s.pontosA = 0; s.pontosB = 0;
    s.tiebreak = false; s.superTiebreakAtivo = false;
    s.pontosJogadosNoTiebreak = 0; s.sacadorInicioTiebreak = null;
    // Super tie-break sempre decide a partida
    s.encerrada = true;
    s.winnerDupla = s.setsA > s.setsB ? 'A' : 'B';
    return s;
  }

  // ── Game normal ────────────────────────────────────────────────────────────
  if (dupla === 'A') s.gamesA += 1;
  else s.gamesB += 1;
  s.pontosA = 0;
  s.pontosB = 0;
  s.tiebreak = false;
  s.pontosJogadosNoTiebreak = 0;
  s.sacadorInicioTiebreak = null;

  const { gamesA, gamesB } = s;
  const fechouA =
    (gamesA >= G && gamesA - gamesB >= 2) ||
    (gamesA === G + 1 && gamesB === G - 1) ||
    (gamesA === G + 1 && gamesB === G);
  const fechouB =
    (gamesB >= G && gamesB - gamesA >= 2) ||
    (gamesB === G + 1 && gamesA === G - 1) ||
    (gamesB === G + 1 && gamesA === G);

  if (fechouA || fechouB) {
    s.historicGamesA.push(s.gamesA);
    s.historicGamesB.push(s.gamesB);
    if (fechouA) s.setsA += 1; else s.setsB += 1;
    s.gamesA = 0; s.gamesB = 0;

    const setsParaVencer = Math.ceil(S / 2);
    if (s.setsA >= setsParaVencer || s.setsB >= setsParaVencer) {
      s.encerrada = true;
      s.winnerDupla = s.setsA >= setsParaVencer ? 'A' : 'B';
    } else if (s.rule.superTiebreak && s.setsA === setsParaVencer - 1 && s.setsB === setsParaVencer - 1) {
      // Ativa super tie-break decisivo
      s.tiebreak = true;
      s.superTiebreakAtivo = true;
      s.pontosA = 0; s.pontosB = 0;
      s.pontosJogadosNoTiebreak = 0; s.sacadorInicioTiebreak = null;
    }
  } else {
    // Ativa tiebreak normal se empatou em G x G
    if (s.gamesA === G && s.gamesB === G) {
      s.tiebreak = true;
      s.pontosA = 0; s.pontosB = 0;
      s.pontosJogadosNoTiebreak = 0; s.sacadorInicioTiebreak = null;
    }
  }

  return s;
}

export function avancaPonto(state: BtPlacardState, dupla: 'A' | 'B', sacador?: string): BtPlacardState {
  if (state.encerrada) return state;
  const s = { ...state };
  const { tiebreak: TB } = s.rule;

  // --- Tiebreak normal ou super tie-break ---
  if (s.tiebreak) {
    if (dupla === 'A') s.pontosA += 1;
    else s.pontosB += 1;

    // Rotação de saque: registra quem serviu o primeiro ponto
    if (!s.sacadorInicioTiebreak && sacador) s.sacadorInicioTiebreak = sacador;
    s.pontosJogadosNoTiebreak += 1;

    const limite = s.superTiebreakAtivo ? (s.rule.superTiebreakPts ?? 10) : TB;
    const venceu = (s.pontosA >= limite || s.pontosB >= limite) && Math.abs(s.pontosA - s.pontosB) >= 2;
    if (venceu) return avancaGame(s, dupla);
    return s;
  }

  // --- Game normal (beach tennis: sem deuce, 40x40 próximo ponto vence) ---
  if (dupla === 'A') s.pontosA += 1;
  else s.pontosB += 1;

  if (s.pontosA >= 4) return avancaGame(s, 'A');
  if (s.pontosB >= 4) return avancaGame(s, 'B');

  return s;
}

// ─── Cálculo de estatísticas ──────────────────────────────────────────────────

export interface BtEstatJogador {
  id: string;
  winners: number;
  aces: number;
  errosDevolucao: number;
  errosNaoForcados: number;
  forcouErro: number;
  errosSaque: number;
  pontosGanhos: number;
  saquesTotal: number;
  // saques por posição: { posicao → { acertos, erros } }
  saquesPorPosicao: Record<string, { acertos: number; erros: number; pontosV: number; pontosP: number }>;
}

export interface BtEstatDupla {
  pontosGanhos: number;
  pontosTotal: number;
  winners: number;
  aces: number;
  errosNaoForcados: number;
  forcouErro: number;
  errosSaque: number;
  errosDevolucao: number;
  quarentaQuarenta: number;
  quarentaQuarentaVitorias: number;
}

export interface BtEstatisticas {
  dupla: { A: BtEstatDupla; B: BtEstatDupla };
  jogadores: Record<string, BtEstatJogador>;
  finalizacoesPorJogador: Record<string, Record<string, number>>;
  tiposFinalizacaoPorJogador: Record<string, Record<string, number>>;
  dinamica: { placar: string; diff: number }[];
}

function jogadorVazio(id: string): BtEstatJogador {
  return {
    id,
    winners: 0, aces: 0, errosDevolucao: 0,
    errosNaoForcados: 0, forcouErro: 0,
    errosSaque: 0, pontosGanhos: 0, saquesTotal: 0,
    saquesPorPosicao: {},
  };
}

function duplaVazia(): BtEstatDupla {
  return {
    pontosGanhos: 0, pontosTotal: 0,
    winners: 0, aces: 0, errosNaoForcados: 0,
    forcouErro: 0, errosSaque: 0, errosDevolucao: 0,
    quarentaQuarenta: 0, quarentaQuarentaVitorias: 0,
  };
}

export function calcularEstatisticas(analise: BtAnalise): BtEstatisticas {
  const { pontos, jogadores: jogs } = analise;
  const duplaA = [jogs.a1, jogs.a2];
  const duplaB = [jogs.b1, jogs.b2];
  const todosIds = [...duplaA, ...duplaB];

  const dupla: BtEstatisticas['dupla'] = { A: duplaVazia(), B: duplaVazia() };
  const jogadoresEstat: Record<string, BtEstatJogador> = {};
  todosIds.forEach(id => { jogadoresEstat[id] = jogadorVazio(id); });

  const finalizacoesPorJogador: Record<string, Record<string, number>> = {};
  const tiposFinalizacaoPorJogador: Record<string, Record<string, number>> = {};
  todosIds.forEach(id => {
    finalizacoesPorJogador[id] = {};
    tiposFinalizacaoPorJogador[id] = {};
  });

  const dinamica: BtEstatisticas['dinamica'] = [];
  let diffAcum = 0;

  for (const ponto of pontos) {
    const sacadorEhDuplaA = duplaA.includes(ponto.sacador);
    const venceuA = ponto.vencedorDupla === 'A';

    // Dupla
    const dV = venceuA ? dupla.A : dupla.B;
    const dP = venceuA ? dupla.B : dupla.A;
    dV.pontosGanhos += 1;
    dupla.A.pontosTotal += 1;
    dupla.B.pontosTotal += 1;

    // 40x40
    if (ponto.gameScore === '40x40') {
      dV.quarentaQuarenta += 1;
      dP.quarentaQuarenta += 1;
      dV.quarentaQuarentaVitorias += 1;
    }

    // Sacador
    const sacEstat = jogadoresEstat[ponto.sacador];
    if (sacEstat) {
      sacEstat.saquesTotal += 1;
      if (!sacEstat.saquesPorPosicao[ponto.posicaoSaque]) {
        sacEstat.saquesPorPosicao[ponto.posicaoSaque] = { acertos: 0, erros: 0, pontosV: 0, pontosP: 0 };
      }
      const sp = sacEstat.saquesPorPosicao[ponto.posicaoSaque];
      if (ponto.finalizacao === 'ErroSaque') {
        sp.erros += 1;
      } else {
        sp.acertos += 1;
      }
      const sacVenceu = (sacadorEhDuplaA && venceuA) || (!sacadorEhDuplaA && !venceuA);
      if (sacVenceu) sp.pontosV += 1;
      else sp.pontosP += 1;
    }

    // Finalização
    const finalizacao = ponto.finalizacao;
    const tipo = ponto.tipoFinalizacao ?? '';

    // Identifica o "autor" da finalização para distribuir nas estatísticas
    // Para Winner, Ace, ForçouErro → crédito vai para a dupla vencedora (sacador se foi saque, senão a dupla)
    // Para erros → crédito de erro vai para quem errou (adversário)
    const duplaVencedoraIds = venceuA ? duplaA : duplaB;
    const duplaAdversariaIds = venceuA ? duplaB : duplaA;

    if (finalizacao === 'Winner') {
      dV.winners += 1;
      // Atribuir o winner ao sacador se foi saque-winner, senão ao jogador genérico da dupla
      const autorId = duplaVencedoraIds[0]; // simplificado: primeiro da dupla
      jogadoresEstat[autorId] && (jogadoresEstat[autorId].winners += 1);
      jogadoresEstat[autorId] && (jogadoresEstat[autorId].pontosGanhos += 1);
      finalizacoesPorJogador[autorId] = finalizacoesPorJogador[autorId] ?? {};
      finalizacoesPorJogador[autorId]['Winner'] = (finalizacoesPorJogador[autorId]['Winner'] ?? 0) + 1;
      if (tipo) {
        tiposFinalizacaoPorJogador[autorId] = tiposFinalizacaoPorJogador[autorId] ?? {};
        tiposFinalizacaoPorJogador[autorId][tipo] = (tiposFinalizacaoPorJogador[autorId][tipo] ?? 0) + 1;
      }
    } else if (finalizacao === 'Ace') {
      dV.aces += 1;
      const sacId = ponto.sacador;
      jogadoresEstat[sacId] && (jogadoresEstat[sacId].aces += 1);
      jogadoresEstat[sacId] && (jogadoresEstat[sacId].pontosGanhos += 1);
      finalizacoesPorJogador[sacId] = finalizacoesPorJogador[sacId] ?? {};
      finalizacoesPorJogador[sacId]['Ace'] = (finalizacoesPorJogador[sacId]['Ace'] ?? 0) + 1;
    } else if (finalizacao === 'ForçouErro') {
      dV.forcouErro += 1;
      const autorId = duplaVencedoraIds[0];
      jogadoresEstat[autorId] && (jogadoresEstat[autorId].forcouErro += 1);
      jogadoresEstat[autorId] && (jogadoresEstat[autorId].pontosGanhos += 1);
      finalizacoesPorJogador[autorId] = finalizacoesPorJogador[autorId] ?? {};
      finalizacoesPorJogador[autorId]['ForçouErro'] = (finalizacoesPorJogador[autorId]['ForçouErro'] ?? 0) + 1;
    } else if (finalizacao === 'ErroSaque') {
      dP.errosSaque += 1;
      const sacId = ponto.sacador;
      jogadoresEstat[sacId] && (jogadoresEstat[sacId].errosSaque += 1);
      finalizacoesPorJogador[sacId] = finalizacoesPorJogador[sacId] ?? {};
      finalizacoesPorJogador[sacId]['ErroSaque'] = (finalizacoesPorJogador[sacId]['ErroSaque'] ?? 0) + 1;
    } else if (finalizacao === 'ErroDevolucao') {
      dP.errosDevolucao += 1;
      // Erro de devolução: o devolvedor errou (adversário do sacador)
      const devolvedorId = duplaAdversariaIds[0];
      jogadoresEstat[devolvedorId] && (jogadoresEstat[devolvedorId].errosDevolucao += 1);
      finalizacoesPorJogador[devolvedorId] = finalizacoesPorJogador[devolvedorId] ?? {};
      finalizacoesPorJogador[devolvedorId]['ErroDevolucao'] = (finalizacoesPorJogador[devolvedorId]['ErroDevolucao'] ?? 0) + 1;
    } else if (finalizacao === 'ErroNaoForcado') {
      dP.errosNaoForcados += 1;
      const erranteId = duplaAdversariaIds[0];
      jogadoresEstat[erranteId] && (jogadoresEstat[erranteId].errosNaoForcados += 1);
      finalizacoesPorJogador[erranteId] = finalizacoesPorJogador[erranteId] ?? {};
      finalizacoesPorJogador[erranteId]['ErroNaoForcado'] = (finalizacoesPorJogador[erranteId]['ErroNaoForcado'] ?? 0) + 1;
      if (tipo) {
        tiposFinalizacaoPorJogador[erranteId] = tiposFinalizacaoPorJogador[erranteId] ?? {};
        tiposFinalizacaoPorJogador[erranteId][tipo] = (tiposFinalizacaoPorJogador[erranteId][tipo] ?? 0) + 1;
      }
    }

    // Dinâmica do jogo
    if (venceuA) diffAcum += 1;
    else diffAcum -= 1;
    dinamica.push({ placar: ponto.setScore, diff: diffAcum });
  }

  return { dupla, jogadores: jogadoresEstat, finalizacoesPorJogador, tiposFinalizacaoPorJogador, dinamica };
}

// ─── Persistência (AsyncStorage) ─────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'btAnalise:';

function storageKey(competitionId: string, matchId: string): string {
  return PREFIX + competitionId + ':' + matchId;
}

export async function salvarAnalise(analise: BtAnalise): Promise<void> {
  await AsyncStorage.setItem(storageKey(analise.competitionId, analise.matchId), JSON.stringify(analise));
}

export async function carregarAnalise(matchId: string, competitionId: string): Promise<BtAnalise | null> {
  const raw = await AsyncStorage.getItem(storageKey(competitionId, matchId));
  return raw ? (JSON.parse(raw) as BtAnalise) : null;
}

export async function listarAnalises(): Promise<BtAnalise[]> {
  const keys = await AsyncStorage.getAllKeys();
  const btKeys = keys.filter(k => k.startsWith(PREFIX));
  if (btKeys.length === 0) return [];
  const pairs = await AsyncStorage.multiGet(btKeys);
  return pairs
    .map(([, v]) => v ? (JSON.parse(v) as BtAnalise) : null)
    .filter(Boolean) as BtAnalise[];
}

export async function deletarAnalise(matchId: string, competitionId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(competitionId, matchId));
}
