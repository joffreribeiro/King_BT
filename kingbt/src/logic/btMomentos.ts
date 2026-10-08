/**
 * Partes do relatório além das estatísticas básicas: ★ do melhor em cada coluna da tabela por atleta e os
 * "momentos da partida" (sequências de pontos e viradas). Portado de relatorioAvancado.ts do scout do
 * KING BT Playbook, sobre os tipos do KING BT.
 */
import type { BtEstatJogador, BtPlacarSeed, BtPonto, BtWinRule } from './btTracker';
import { placaresAposPontos } from './btPlacarPonto';

/* ── Melhor de cada coluna (★ da tabela "Por atleta") ─────────────────── */

export interface ColunaAtleta {
  label: string;
  /** Texto da célula. */
  texto: (e: BtEstatJogador) => string;
  /** Valor comparável; `null` = sem dado para comparar (ex.: ninguém sacou). */
  valor: (e: BtEstatJogador) => number | null;
  melhor: 'maior' | 'menor';
}

const pctErroSaque = (e: BtEstatJogador) => (e.saquesTotal > 0 ? Math.round((e.errosSaque / e.saquesTotal) * 100) : null);

export const COLUNAS_ATLETA: ColunaAtleta[] = [
  { label: 'Pts', texto: e => String(e.pontosGanhos), valor: e => e.pontosGanhos, melhor: 'maior' },
  { label: 'Winner', texto: e => String(e.winners), valor: e => e.winners, melhor: 'maior' },
  { label: 'Ace', texto: e => String(e.aces), valor: e => e.aces, melhor: 'maior' },
  { label: 'Forçou erro', texto: e => String(e.forcouErro), valor: e => e.forcouErro, melhor: 'maior' },
  { label: 'Erro N.F.', texto: e => String(e.errosNaoForcados), valor: e => e.errosNaoForcados, melhor: 'menor' },
  { label: 'Erro devol.', texto: e => String(e.errosDevolucao), valor: e => e.errosDevolucao, melhor: 'menor' },
  {
    label: 'Erro saque',
    texto: e => (e.saquesTotal > 0 ? `${e.errosSaque}/${e.saquesTotal} (${pctErroSaque(e)}%)` : '—'),
    valor: pctErroSaque, melhor: 'menor',
  },
  { label: 'Nota', texto: e => e.nota.toFixed(1), valor: e => e.nota, melhor: 'maior' },
];

/**
 * Quem tem o melhor valor em cada coluna (empates levam ★ todos). Sem ★ quando não há com o que comparar:
 * menos de dois com dado, todos iguais, ou "melhor" seria zero ações.
 */
export function melhoresPorColuna(jogadores: BtEstatJogador[]): Record<string, string[]> {
  const res: Record<string, string[]> = {};
  for (const col of COLUNAS_ATLETA) {
    const itens = jogadores
      .map(e => ({ id: e.id, v: col.valor(e) }))
      .filter((x): x is { id: string; v: number } => x.v !== null);
    if (itens.length < 2) { res[col.label] = []; continue; }
    const valores = itens.map(i => i.v);
    const alvo = col.melhor === 'maior' ? Math.max(...valores) : Math.min(...valores);
    const todosIguais = valores.every(v => v === valores[0]);
    if (todosIguais || (col.melhor === 'maior' && alvo === 0)) { res[col.label] = []; continue; }
    res[col.label] = itens.filter(i => i.v === alvo).map(i => i.id);
  }
  return res;
}

/* ── Momentos da partida: sequências e viradas ────────────────────────── */

export interface SequenciaPontos { dupla: 'A' | 'B'; inicio: number; fim: number; tamanho: number }

/** Trechos em que a mesma dupla ganhou `minimo` ou mais pontos seguidos (números de ponto de 1 em diante). */
export function sequenciasDePontos(pontos: Pick<BtPonto, 'vencedorDupla'>[], minimo = 3): SequenciaPontos[] {
  const res: SequenciaPontos[] = [];
  let inicio = 0;
  const fecha = (fim: number) => {
    const tamanho = fim - inicio + 1;
    if (tamanho >= minimo) res.push({ dupla: pontos[inicio].vencedorDupla, inicio: inicio + 1, fim: fim + 1, tamanho });
  };
  pontos.forEach((p, i) => {
    if (i > 0 && p.vencedorDupla !== pontos[i - 1].vencedorDupla) { fecha(i - 1); inicio = i; }
  });
  if (pontos.length > 0) fecha(pontos.length - 1);
  return res;
}

export interface Virada { numero: number; dupla: 'A' | 'B'; placar: string }

/** Pontos em que a liderança no saldo trocou de lado (quem passou à frente), com o placar logo depois. */
export function viradasDoJogo(jogo: { pontos: Pick<BtPonto, 'vencedorDupla' | 'sacador'>[]; rule: BtWinRule; inicial?: BtPlacarSeed }): Virada[] {
  const placares = placaresAposPontos(jogo);
  const res: Virada[] = [];
  let saldo = 0;
  let ultimoLider: 'A' | 'B' | null = null;
  jogo.pontos.forEach((p, i) => {
    saldo += p.vencedorDupla === 'A' ? 1 : -1;
    if (saldo === 0) return;
    const lider: 'A' | 'B' = saldo > 0 ? 'A' : 'B';
    if (ultimoLider !== null && lider !== ultimoLider) res.push({ numero: i + 1, dupla: lider, placar: placares[i] });
    ultimoLider = lider;
  });
  return res;
}
