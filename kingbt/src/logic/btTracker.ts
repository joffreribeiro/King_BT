import type { SetScore } from './types';
import { tieAtGames } from './setOutcome';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type BtFinalizacao =
  | 'Winner'
  | 'Ace'
  | 'ForçouErro'
  | 'ErroDevolucao'
  | 'ErroSaque'
  | 'ErroNaoForcado'
  // Ponto rápido: placar atualizado sem detalhar a jogada (equivalente ao
  // "Sem informações detalhadas" do BT Tracker)
  | 'SemDetalhe';

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

/** Índice de casa do mapa de calor: 0–2 dentro da quadra; -1 e 3 são a faixa de fora. */
export type BtIndiceComFora = -1 | 0 | 1 | 2 | 3;
/** Posição de quem fez o lance, na quadra (3×3). Linha 0 = fundo, 2 = rede. */
export interface BtCelulaCalor { linha: 0 | 1 | 2; coluna: 0 | 1 | 2 }
/** Destino da bola (ou posição do adversário no Forçou Erro); pode ser fora da quadra. */
export interface BtCelulaBola { linha: BtIndiceComFora; coluna: BtIndiceComFora }

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
  // ── MAPA DE CALOR (opcional; Winner, Forçou Erro e Erro Não Forçado) ──
  calorJogador?: BtCelulaCalor;       // onde estava quem fez o winner / forçou / errou
  calorBola?: BtCelulaBola;           // onde a bola caiu (ou onde estava o adversário, no Forçou Erro)
  // ── EXTRAS ──
  duracaoPonto?: BtDuracaoPonto;      // Curto / Médio / Longo
  situacoes?: BtSituacao[];           // eventos especiais
  comentario?: string;                // texto livre
  // legado
  bolaNaFita?: boolean;
  bolaNaLinha?: boolean;
}

/**
 * Placar com que a análise começa quando o scout é aberto no meio da partida ("a partida já começou?").
 * Os sets já fechados entram no histórico do placar e do relatório; os games são os do set em andamento.
 */
export interface BtPlacarSeed {
  /** Placar em games de cada set já fechado antes do scout, na ordem jogada. */
  setsFechados?: SetScore[];
  /** Games do set em andamento quando o scout começa. */
  gamesA: number;
  gamesB: number;
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
  /** Placar de partida: ausente = partida registrada desde o 0x0. */
  inicial?: BtPlacarSeed;
  pontos: BtPonto[];
  placarFinal?: { setsA: number; setsB: number; gamesA: number[]; gamesB: number[]; stb?: boolean[] };
}

// ─── Lógica de placar beach tennis ───────────────────────────────────────────

const GAME_SEQ = [0, 15, 30, 40] as const;

export type BtScoutMode = 'aovivo' | 'padrao' | 'avancado';

export interface BtWinRule {
  sets: number;
  games: number;
  tiebreak: number;
  /** Onde o tie-break do set acontece: 'deuce' = (G-1)-(G-1), 'full' = G-G. */
  tiebreakAt?: 'deuce' | 'full';
  superTiebreak?: boolean;     // substitui set decisivo por super tie-break
  superTiebreakPts?: number;   // pontos do super tie-break (padrão 10)
  scoutMode?: BtScoutMode;     // modo de scout: aovivo / padrao / avancado
}

export const BT_WIN_RULE_DEFAULT: BtWinRule = { sets: 3, games: 6, tiebreak: 7, superTiebreak: false, superTiebreakPts: 10 };

export function winRuleFromComp(wr?: {
  sets?: number; games?: number; tiebreak?: number; tiebreakAt?: 'deuce' | 'full';
  superTiebreak?: boolean; superTiebreakPts?: number;
}): BtWinRule {
  return {
    sets:             wr?.sets             ?? 3,
    games:            wr?.games            ?? 6,
    tiebreak:         wr?.tiebreak         ?? 7,
    // Sem isto a configuração da competição parava aqui: o motor ao vivo
    // sempre jogava a regra 'full', mesmo nos presets 'deuce' — que são a
    // maioria, incluindo o padrão ("4 games, tie 7 em 3-3").
    tiebreakAt:       wr?.tiebreakAt       ?? 'deuce',
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
  /** Para cada set já encerrado: true se foi decidido em super tie-break. */
  historicStb: boolean[];
}

/** Um set com `mine` games contra `theirs` já está fechado nesta regra? (mesma conta do fechamento ao vivo) */
export function setFoiFechado(mine: number, theirs: number, rule: BtWinRule): boolean {
  const T = tieAtGames(rule.games, rule.tiebreakAt);
  return (mine >= T + 1 && mine > theirs) || (mine >= rule.games && mine - theirs >= 2);
}

export function placardInicial(rule: BtWinRule = BT_WIN_RULE_DEFAULT, seed?: BtPlacarSeed): BtPlacardState {
  const fechados = seed?.setsFechados ?? [];
  const setsA = fechados.filter(x => x.a > x.b).length;
  const setsB = fechados.filter(x => x.b > x.a).length;
  const gamesA = seed?.gamesA ?? 0;
  const gamesB = seed?.gamesB ?? 0;
  const T = tieAtGames(rule.games, rule.tiebreakAt);
  const setsParaVencer = Math.ceil(rule.sets / 2);
  // Semeado direto no set decisivo (sets empatados a um do título, set atual 0x0) com super tie-break:
  // o próximo ponto já é do super tie-break — no jogo normal isso só liga ao fechar um set.
  const superTiebreakAtivo = fechados.length > 0 && !!rule.superTiebreak && setsA === setsParaVencer - 1 && setsB === setsParaVencer - 1 && gamesA === 0 && gamesB === 0;
  return {
    rule,
    setsA, setsB,
    gamesA, gamesB,
    pontosA: 0, pontosB: 0,
    // Placar semeado já no ponto de tie-break do set: o próximo ponto entra direto em tie-break
    tiebreak: superTiebreakAtivo || (gamesA === T && gamesB === T && gamesA > 0),
    superTiebreakAtivo,
    pontosJogadosNoTiebreak: 0,
    sacadorInicioTiebreak: null,
    encerrada: false,
    winnerDupla: null,
    historicGamesA: fechados.map(x => x.a),
    historicGamesB: fechados.map(x => x.b),
    historicStb: fechados.map(x => !!x.stb),
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

/**
 * Placar set a set de um placard, no formato que vai para `Match.sets`.
 * Marca o set decidido em super tie-break — nele `a`/`b` são pontos, não
 * games, e quem soma games precisa saber disso (ver `matchGames`).
 */
export function setsDoPlacard(st: BtPlacardState): SetScore[] {
  return st.historicGamesA.map((a, i) => ({
    a,
    b: st.historicGamesB[i] ?? 0,
    ...(st.historicStb[i] ? { stb: true as const } : {}),
  }));
}

function avancaGame(state: BtPlacardState, dupla: 'A' | 'B'): BtPlacardState {
  const s = {
    ...state,
    historicGamesA: [...state.historicGamesA],
    historicGamesB: [...state.historicGamesB],
    historicStb:    [...state.historicStb],
  };
  const { games: G, sets: S } = s.rule;

  // ── Super tie-break encerrado ──────────────────────────────────────────────
  if (s.superTiebreakAtivo) {
    // O super tie-break é disputado em PONTOS — gamesA/gamesB ficam em 0 o
    // tempo todo, então gravá-los registrava o set decisivo como 0-0 e o
    // placar da partida perdia o resultado que a decidiu.
    s.historicGamesA.push(s.pontosA);
    s.historicGamesB.push(s.pontosB);
    s.historicStb.push(true);
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
  // T = placar em que o tie-break acontece; o set termina no máximo em T+1
  // games. Em 'deuce' (T = G-1) não existe vantagem de 2: o empate em T-T é
  // resolvido pelo tie-break, e o vencedor fecha em G. Em 'full' (T = G) a
  // vantagem de 2 vale até G-G, e o vencedor do tie-break fecha em G+1.
  const T = tieAtGames(G, s.rule.tiebreakAt);
  const fechou = (mine: number, theirs: number) =>
    (mine >= T + 1 && mine > theirs) || (mine >= G && mine - theirs >= 2);
  const fechouA = fechou(gamesA, gamesB);
  const fechouB = fechou(gamesB, gamesA);

  if (fechouA || fechouB) {
    s.historicGamesA.push(s.gamesA);
    s.historicGamesB.push(s.gamesB);
    s.historicStb.push(false);
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
    // Ativa o tie-break normal no ponto configurado (T x T)
    if (s.gamesA === T && s.gamesB === T) {
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
  // Qualidade agregada — campos existiam em BtPonto mas não eram somados antes
  qualidadeSaque: Record<BtQualidadeSaque, number>;
  qualidadeDevolucao: Record<BtQualidadeDevolucao, number>;
  qualidadePrimeiraBola: Record<BtQualidadePrimeiraBola, number>;
  // Nota de performance (0-10, v1 heurística — ver calcularEstatisticas)
  nota: number;
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
  // Confirmação de saque (hold): games em que a dupla sacou / games sacados e vencidos
  gamesSacando: number;
  gamesSacandoVencidos: number;
  // Break points: chances de quebrar o saque adversário (como recebedora) e conversões
  breakPointsChances: number;
  breakPointsConvertidos: number;
  // Pontos ganhos com bola na fita ou na linha (não há atribuição de jogador em
  // BtPonto.situacoes hoje, então o detalhamento fica só no nível da dupla)
  pontosComBolaFitaLinha: number;
  // Foot fault / avanço de linha cometidos — atribuído à dupla que estava sacando
  // no ponto (aproximação: situacoes não indica o autor exato)
  footFaultAvancoLinha: number;
}

export interface BtEstatisticas {
  dupla: { A: BtEstatDupla; B: BtEstatDupla };
  jogadores: Record<string, BtEstatJogador>;
  finalizacoesPorJogador: Record<string, Record<string, number>>;
  tiposFinalizacaoPorJogador: Record<string, Record<string, number>>;
  /** Tipos de golpe só dos winners / só dos erros não forçados de cada jogador (o mapa acima mistura os dois). */
  tiposWinnerPorJogador: Record<string, Record<string, number>>;
  tiposErroPorJogador: Record<string, Record<string, number>>;
  dinamica: { placar: string; diff: number }[];
}

function jogadorVazio(id: string): BtEstatJogador {
  return {
    id,
    winners: 0, aces: 0, errosDevolucao: 0,
    errosNaoForcados: 0, forcouErro: 0,
    errosSaque: 0, pontosGanhos: 0, saquesTotal: 0,
    saquesPorPosicao: {},
    qualidadeSaque: { ace: 0, bom: 0, regular: 0, ruim: 0, erroSaque: 0 },
    qualidadeDevolucao: { winner: 0, boa: 0, regular: 0, ruim: 0, erroDevolucao: 0 },
    qualidadePrimeiraBola: { Boa: 0, Regular: 0, Ruim: 0 },
    nota: 0,
  };
}

function duplaVazia(): BtEstatDupla {
  return {
    pontosGanhos: 0, pontosTotal: 0,
    winners: 0, aces: 0, errosNaoForcados: 0,
    forcouErro: 0, errosSaque: 0, errosDevolucao: 0,
    quarentaQuarenta: 0, quarentaQuarentaVitorias: 0,
    gamesSacando: 0, gamesSacandoVencidos: 0,
    breakPointsChances: 0, breakPointsConvertidos: 0,
    pontosComBolaFitaLinha: 0, footFaultAvancoLinha: 0,
  };
}

/**
 * Nota de performance por jogador (0-10, uma casa decimal) — v1 heurística.
 * Pondera pontos de ataque ganhos (winners/aces/forçou erro) contra erros
 * cometidos (não forçado, saque, devolução). Não é uma métrica oficial de
 * beach tennis — serve como resumo rápido do jogo, sujeita a recalibração.
 */
function calcularNota(j: BtEstatJogador): number {
  const nota = 5
    + (j.winners + j.aces) * 0.4
    + j.forcouErro * 0.2
    - (j.errosNaoForcados + j.errosSaque + j.errosDevolucao) * 0.3;
  return Math.round(Math.max(0, Math.min(10, nota)) * 10) / 10;
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
  const tiposWinnerPorJogador: Record<string, Record<string, number>> = {};
  const tiposErroPorJogador: Record<string, Record<string, number>> = {};
  todosIds.forEach(id => {
    finalizacoesPorJogador[id] = {};
    tiposFinalizacaoPorJogador[id] = {};
    tiposWinnerPorJogador[id] = {};
    tiposErroPorJogador[id] = {};
  });

  const dinamica: BtEstatisticas['dinamica'] = [];
  let diffAcum = 0;

  // Replay do placar em paralelo ao loop de pontos — usado só para detectar
  // "chance de quebra" (break point) e fechamento de game (hold), reaproveitando
  // as mesmas funções de placar usadas ao vivo em ponto.tsx.
  let placardReplay = placardInicial(analise.rule, analise.inicial);
  let sacadorDuplaGameAtual: 'A' | 'B' | null = null;

  for (const ponto of pontos) {
    const sacadorEhDuplaA = duplaA.includes(ponto.sacador);
    const venceuA = ponto.vencedorDupla === 'A';
    const sacadorDupla: 'A' | 'B' = sacadorEhDuplaA ? 'A' : 'B';
    const receptorDupla: 'A' | 'B' = sacadorEhDuplaA ? 'B' : 'A';

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

    // Break point: placar ANTES deste ponto (ponto.gameScore é capturado nesse
    // momento em ponto.tsx) mostra a dupla recebedora com 40 e à frente do sacador.
    const antes = placardReplay;
    if (!antes.tiebreak) {
      const ptsSacador = sacadorDupla === 'A' ? antes.pontosA : antes.pontosB;
      const ptsReceptor = receptorDupla === 'A' ? antes.pontosA : antes.pontosB;
      if (ptsReceptor >= 3 && ptsReceptor > ptsSacador) {
        const estatReceptor = receptorDupla === 'A' ? dupla.A : dupla.B;
        estatReceptor.breakPointsChances += 1;
        if (ponto.vencedorDupla === receptorDupla) estatReceptor.breakPointsConvertidos += 1;
      }
    }

    // Hold: identifica a dupla sacadora do game atual pelo primeiro ponto dele;
    // ao fechar o game (avancaGame reseta pontosA/pontosB para 0x0 — tanto para
    // fechar um game normal quanto um tiebreak), credita gamesSacando/Vencidos.
    // Obs.: não usar historicGamesA/B para detectar isso — esses arrays só
    // crescem quando um SET fecha, não um game.
    if (sacadorDuplaGameAtual === null) sacadorDuplaGameAtual = sacadorDupla;
    placardReplay = avancaPonto(placardReplay, ponto.vencedorDupla, ponto.sacador);
    const fechouGame = placardReplay.pontosA === 0 && placardReplay.pontosB === 0;
    if (fechouGame) {
      const estatSacadora = sacadorDuplaGameAtual === 'A' ? dupla.A : dupla.B;
      estatSacadora.gamesSacando += 1;
      if (ponto.vencedorDupla === sacadorDuplaGameAtual) estatSacadora.gamesSacandoVencidos += 1;
      sacadorDuplaGameAtual = null;
    }

    // Bola na fita/linha (crédito para a dupla vencedora do ponto) e foot
    // fault/avanço de linha (aproximação: atribuído à dupla que estava sacando)
    if (ponto.situacoes?.some(s => s === 'bolaNaFita' || s === 'bolaNaLinha')) {
      dV.pontosComBolaFitaLinha += 1;
    }
    if (ponto.situacoes?.some(s => s === 'footFault' || s === 'avancoLinha')) {
      (sacadorEhDuplaA ? dupla.A : dupla.B).footFaultAvancoLinha += 1;
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
      if (ponto.qualidadeSaque) sacEstat.qualidadeSaque[ponto.qualidadeSaque] += 1;
    }
    if (ponto.devolvedor && ponto.qualidadeDevolucao) {
      const devEstat = jogadoresEstat[ponto.devolvedor];
      if (devEstat) devEstat.qualidadeDevolucao[ponto.qualidadeDevolucao] += 1;
    }
    if (ponto.primeiraBola && ponto.qualidadePrimeiraBola) {
      const pbEstat = jogadoresEstat[ponto.primeiraBola];
      if (pbEstat) pbEstat.qualidadePrimeiraBola[ponto.qualidadePrimeiraBola] += 1;
    }

    // Finalização
    const finalizacao = ponto.finalizacao;
    const tipo = ponto.tipoFinalizacao ?? '';

    // Identifica o "autor" da finalização para distribuir nas estatísticas
    // Para Winner, Ace, ForçouErro → crédito vai para a dupla vencedora (sacador se foi saque, senão a dupla)
    // Para erros → crédito de erro vai para quem errou (adversário)
    const duplaVencedoraIds = venceuA ? duplaA : duplaB;
    const duplaAdversariaIds = venceuA ? duplaB : duplaA;
    // Autor do lance: o jogador marcado no ponto (vencedorJogador; nos erros, quem errou).
    // Sem marcação (ponto rápido, dados antigos), cai no 1º da dupla correspondente.
    const autorVencedor = ponto.vencedorJogador && duplaVencedoraIds.includes(ponto.vencedorJogador) ? ponto.vencedorJogador : duplaVencedoraIds[0];
    const autorErro = [ponto.vencedorJogador, ponto.devolvedor].find((id): id is string => !!id && duplaAdversariaIds.includes(id)) ?? duplaAdversariaIds[0];

    if (finalizacao === 'Winner') {
      dV.winners += 1;
      const autorId = autorVencedor;
      jogadoresEstat[autorId] && (jogadoresEstat[autorId].winners += 1);
      jogadoresEstat[autorId] && (jogadoresEstat[autorId].pontosGanhos += 1);
      finalizacoesPorJogador[autorId] = finalizacoesPorJogador[autorId] ?? {};
      finalizacoesPorJogador[autorId]['Winner'] = (finalizacoesPorJogador[autorId]['Winner'] ?? 0) + 1;
      if (tipo) {
        tiposFinalizacaoPorJogador[autorId] = tiposFinalizacaoPorJogador[autorId] ?? {};
        tiposFinalizacaoPorJogador[autorId][tipo] = (tiposFinalizacaoPorJogador[autorId][tipo] ?? 0) + 1;
        tiposWinnerPorJogador[autorId] = tiposWinnerPorJogador[autorId] ?? {};
        tiposWinnerPorJogador[autorId][tipo] = (tiposWinnerPorJogador[autorId][tipo] ?? 0) + 1;
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
      const autorId = autorVencedor;
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
      const devolvedorId = autorErro;
      jogadoresEstat[devolvedorId] && (jogadoresEstat[devolvedorId].errosDevolucao += 1);
      finalizacoesPorJogador[devolvedorId] = finalizacoesPorJogador[devolvedorId] ?? {};
      finalizacoesPorJogador[devolvedorId]['ErroDevolucao'] = (finalizacoesPorJogador[devolvedorId]['ErroDevolucao'] ?? 0) + 1;
    } else if (finalizacao === 'ErroNaoForcado') {
      dP.errosNaoForcados += 1;
      const erranteId = autorErro;
      jogadoresEstat[erranteId] && (jogadoresEstat[erranteId].errosNaoForcados += 1);
      finalizacoesPorJogador[erranteId] = finalizacoesPorJogador[erranteId] ?? {};
      finalizacoesPorJogador[erranteId]['ErroNaoForcado'] = (finalizacoesPorJogador[erranteId]['ErroNaoForcado'] ?? 0) + 1;
      if (tipo) {
        tiposFinalizacaoPorJogador[erranteId] = tiposFinalizacaoPorJogador[erranteId] ?? {};
        tiposFinalizacaoPorJogador[erranteId][tipo] = (tiposFinalizacaoPorJogador[erranteId][tipo] ?? 0) + 1;
        tiposErroPorJogador[erranteId] = tiposErroPorJogador[erranteId] ?? {};
        tiposErroPorJogador[erranteId][tipo] = (tiposErroPorJogador[erranteId][tipo] ?? 0) + 1;
      }
    }

    // Dinâmica do jogo
    if (venceuA) diffAcum += 1;
    else diffAcum -= 1;
    dinamica.push({ placar: ponto.setScore, diff: diffAcum });
  }

  todosIds.forEach(id => { jogadoresEstat[id].nota = calcularNota(jogadoresEstat[id]); });

  return { dupla, jogadores: jogadoresEstat, finalizacoesPorJogador, tiposFinalizacaoPorJogador, tiposWinnerPorJogador, tiposErroPorJogador, dinamica };
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
