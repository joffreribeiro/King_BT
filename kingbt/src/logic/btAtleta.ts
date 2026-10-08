/**
 * Análise de um atleta ao longo de várias partidas: o que o relatório de uma partida mostra, somado.
 * Inspirado no "Análise Individual" do scout do KING BT Playbook (src/logic/individual.ts), mas aqui o
 * atleta é identificado pelo id do jogador do grupo (não pelo nome digitado), então não há risco de
 * "Ana" e "ana" virarem dois atletas. Só entram análises encerradas (com placarFinal).
 */
import { avancaPonto, calcularEstatisticas, placardInicial, type BtAnalise } from './btTracker';

const DIA_MS = 24 * 60 * 60 * 1000;

export type Periodo = '7d' | '30d' | '90d' | 'tudo';
export const PERIODOS: { key: Periodo; label: string }[] = [
  { key: '7d', label: '7 dias' }, { key: '30d', label: '30 dias' }, { key: '90d', label: '90 dias' }, { key: 'tudo', label: 'Tudo' },
];

export interface ContagemPct { n: number; total: number; pct: number }
const contagem = (n: number, total: number): ContagemPct => ({ n, total, pct: total > 0 ? Math.round((n / total) * 100) : 0 });

/** Só análises encerradas dentro do período, da mais antiga para a mais recente. */
export function analisesDoPeriodo(analises: BtAnalise[], periodo: Periodo, agora = Date.now()): BtAnalise[] {
  const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : periodo === '90d' ? 90 : null;
  return analises
    .filter(a => !!a.placarFinal && (dias === null || a.criadaEm >= agora - dias * DIA_MS))
    .sort((a, b) => a.criadaEm - b.criadaEm);
}

function idsDaAnalise(a: BtAnalise): string[] {
  const { a1, a2, b1, b2 } = a.jogadores;
  return [a1, a2, b1, b2].filter(Boolean);
}

/** Lado ('A'/'B') em que o atleta jogou, ou null se não jogou a análise. */
export function ladoDoAtleta(a: BtAnalise, id: string): 'A' | 'B' | null {
  if (id && (a.jogadores.a1 === id || a.jogadores.a2 === id)) return 'A';
  if (id && (a.jogadores.b1 === id || a.jogadores.b2 === id)) return 'B';
  return null;
}

/** Atletas que aparecem nas análises, do que mais jogou para o que menos jogou. */
export function atletasConhecidos(analises: BtAnalise[]): { id: string; nome: string; partidas: number }[] {
  const mapa = new Map<string, { id: string; nome: string; partidas: number }>();
  for (const a of analises) {
    for (const id of new Set(idsDaAnalise(a))) {
      const atual = mapa.get(id);
      if (atual) atual.partidas += 1;
      else mapa.set(id, { id, nome: a.nomes[id] ?? id, partidas: 1 });
    }
  }
  return [...mapa.values()].sort((x, y) => y.partidas - x.partidas || x.nome.localeCompare(y.nome, 'pt-BR'));
}

/** Games de saque do atleta: quantos sacou (1º ponto do game) e quantos venceu. */
export function confirmacaoDeSaque(a: BtAnalise, id: string): ContagemPct {
  let pl = placardInicial(a.rule, a.inicial);
  let sacadorDoGame: string | null = null;
  let sacadorDupla: 'A' | 'B' | null = null;
  let sacou = 0; let venceu = 0;
  for (const p of a.pontos) {
    if (sacadorDoGame === null) {
      sacadorDoGame = p.sacador;
      sacadorDupla = ladoDoAtleta(a, p.sacador);
    }
    pl = avancaPonto(pl, p.vencedorDupla, p.sacador);
    // game (ou tie-break) fechado: o placar de pontos volta a 0x0
    if (pl.pontosA === 0 && pl.pontosB === 0) {
      if (sacadorDoGame === id) {
        sacou += 1;
        if (p.vencedorDupla === sacadorDupla) venceu += 1;
      }
      sacadorDoGame = null; sacadorDupla = null;
    }
  }
  return contagem(venceu, sacou);
}

export interface PartidaDoAtleta {
  matchId: string;
  competitionId: string;
  data: number;
  parceiro: string | null;
  adversarios: string;
  /** Sets do ponto de vista do atleta, ex.: "6-4 · 3-6 · 10-8". */
  placar: string;
  venceu: boolean;
  nota: number;
  /** Números do atleta nesta partida — base da comparação recentes × anteriores. */
  stats: EstatPartida;
}

export interface EstatPartida {
  winners: number; forcouErro: number; errosNaoForcados: number; errosDevolucao: number;
  errosSaque: number; saquesTotal: number; confN: number; confTotal: number;
}

export interface ResumoAtleta {
  id: string;
  nome: string;
  partidas: number;
  vitorias: number;
  derrotas: number;
  winners: number;
  aces: number;
  forcouErro: number;
  errosNaoForcados: number;
  errosSaque: number;
  errosDevolucao: number;
  saquesTotal: number;
  confirmacaoSaque: ContagemPct;
  notaMedia: number;
  /** Golpes dos winners / dos erros não forçados (tipo → quantidade), somados. */
  tiposWinner: Record<string, number>;
  tiposErro: Record<string, number>;
  /** Saques por posição, somados nas partidas. */
  saques: SaquePosicao[];
  /** Da mais antiga para a mais recente — alimenta o gráfico de evolução. */
  lista: PartidaDoAtleta[];
}

export interface SaquePosicao { posicao: string; acertos: number; erros: number; vencidos: number; perdidos: number }

const primeiroNome = (a: BtAnalise, id: string) => (a.nomes[id] ?? id).split(' ')[0];

/** Soma do atleta em todas as análises encerradas em que jogou. `null` se não jogou nenhuma. */
export function resumoDoAtleta(analises: BtAnalise[], id: string): ResumoAtleta | null {
  const r: ResumoAtleta = {
    id, nome: id, partidas: 0, vitorias: 0, derrotas: 0, winners: 0, aces: 0, forcouErro: 0, errosNaoForcados: 0,
    errosSaque: 0, errosDevolucao: 0, saquesTotal: 0, confirmacaoSaque: contagem(0, 0), notaMedia: 0,
    tiposWinner: {}, tiposErro: {}, saques: [], lista: [],
  };
  const saques = new Map<string, SaquePosicao>();
  let somaNotas = 0; let confN = 0; let confTotal = 0;

  for (const a of analises) {
    const pf = a.placarFinal;
    const lado = ladoDoAtleta(a, id);
    if (!pf || !lado) continue;
    const est = calcularEstatisticas(a).jogadores[id];
    if (!est) continue;

    r.partidas += 1;
    r.nome = a.nomes[id] ?? r.nome;
    const venceu = lado === 'A' ? pf.setsA > pf.setsB : pf.setsB > pf.setsA;
    if (venceu) r.vitorias += 1; else if (pf.setsA !== pf.setsB) r.derrotas += 1;
    r.winners += est.winners; r.aces += est.aces; r.forcouErro += est.forcouErro;
    r.errosNaoForcados += est.errosNaoForcados; r.errosSaque += est.errosSaque; r.errosDevolucao += est.errosDevolucao;
    r.saquesTotal += est.saquesTotal;
    const conf = confirmacaoDeSaque(a, id);
    confN += conf.n; confTotal += conf.total;
    const todas = calcularEstatisticas(a);
    for (const [t, q] of Object.entries(todas.tiposWinnerPorJogador[id] ?? {})) r.tiposWinner[t] = (r.tiposWinner[t] ?? 0) + q;
    for (const [t, q] of Object.entries(todas.tiposErroPorJogador[id] ?? {})) r.tiposErro[t] = (r.tiposErro[t] ?? 0) + q;
    for (const [pos, v] of Object.entries(est.saquesPorPosicao)) {
      const x = saques.get(pos) ?? { posicao: pos, acertos: 0, erros: 0, vencidos: 0, perdidos: 0 };
      x.acertos += v.acertos; x.erros += v.erros; x.vencidos += v.pontosV; x.perdidos += v.pontosP;
      saques.set(pos, x);
    }
    somaNotas += est.nota;

    const meus = lado === 'A' ? [a.jogadores.a1, a.jogadores.a2] : [a.jogadores.b1, a.jogadores.b2];
    const deles = lado === 'A' ? [a.jogadores.b1, a.jogadores.b2] : [a.jogadores.a1, a.jogadores.a2];
    const parceiro = meus.find(x => x && x !== id);
    r.lista.push({
      matchId: a.matchId, competitionId: a.competitionId, data: a.criadaEm,
      parceiro: parceiro ? primeiroNome(a, parceiro) : null,
      adversarios: deles.filter(Boolean).map(x => primeiroNome(a, x)).join(' / '),
      placar: pf.gamesA.length
        ? pf.gamesA.map((ga, i) => (lado === 'A' ? `${ga}-${pf.gamesB[i] ?? 0}` : `${pf.gamesB[i] ?? 0}-${ga}`)).join(' · ')
        : (lado === 'A' ? `${pf.setsA} × ${pf.setsB}` : `${pf.setsB} × ${pf.setsA}`),
      venceu, nota: est.nota,
      stats: {
        winners: est.winners, forcouErro: est.forcouErro, errosNaoForcados: est.errosNaoForcados, errosDevolucao: est.errosDevolucao,
        errosSaque: est.errosSaque, saquesTotal: est.saquesTotal, confN: conf.n, confTotal: conf.total,
      },
    });
  }
  if (r.partidas === 0) return null;
  r.confirmacaoSaque = contagem(confN, confTotal);
  r.saques = [...saques.values()].sort((x, y) => (y.acertos + y.erros) - (x.acertos + x.erros));
  r.notaMedia = Math.round((somaNotas / r.partidas) * 10) / 10;
  r.lista.sort((x, y) => x.data - y.data);
  return r;
}
