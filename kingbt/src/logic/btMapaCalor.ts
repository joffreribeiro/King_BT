/**
 * Mapa de calor do scout: onde estava quem fez o lance e para onde a bola foi, em Winner, Forçou Erro e
 * Erro Não Forçado. Marcação opcional por ponto; aqui só a conta (somar marcações, rótulos). O desenho
 * fica em components/analise/MapaCalorGrid.tsx. Portado do scout do KING BT Playbook (logic/mapaCalor.ts).
 */
import type { BtAnalise, BtCelulaBola, BtFinalizacao, BtPonto } from './btTracker';

export type FinalizacaoComCalor = Extract<BtFinalizacao, 'Winner' | 'ForçouErro' | 'ErroNaoForcado'>;
export const FINALIZACOES_COM_CALOR: FinalizacaoComCalor[] = ['Winner', 'ForçouErro', 'ErroNaoForcado'];

export function temMapaCalor(f: BtFinalizacao | null | undefined): f is FinalizacaoComCalor {
  return f === 'Winner' || f === 'ForçouErro' || f === 'ErroNaoForcado';
}

/** Só o Erro Não Forçado aceita a bola fora da quadra — o winner cai dentro e, no Forçou Erro, o segundo
 *  grid é a posição do adversário (sempre em quadra). */
export function destinoAceitaFora(f: FinalizacaoComCalor): boolean {
  return f === 'ErroNaoForcado';
}

/** Uma casa da faixa externa (fora da quadra)? Os cantos não existem no grid. */
export function ehCelulaFora(c: BtCelulaBola): boolean {
  const linhaFora = c.linha === -1 || c.linha === 3;
  const colunaFora = c.coluna === -1 || c.coluna === 3;
  return linhaFora !== colunaFora;
}

/** Chave estável de uma casa, usada para somar as marcações. */
export function chaveCelula(c: BtCelulaBola): string {
  return `${c.linha},${c.coluna}`;
}

/** Dupla de quem é o lance. No Erro Não Forçado o ponto vai para a dupla adversária, então o autor é de quem PERDEU o ponto. */
export function duplaDoAutor(p: Pick<BtPonto, 'finalizacao' | 'vencedorDupla'>): 'A' | 'B' {
  if (p.finalizacao === 'ErroNaoForcado') return p.vencedorDupla === 'A' ? 'B' : 'A';
  return p.vencedorDupla;
}

export interface MapaCalorAgregado {
  /** Posição de quem fez o lance → nº de vezes. */
  jogador: Record<string, number>;
  /** Destino da bola (ou posição do adversário no Forçou Erro) → nº de vezes. */
  bola: Record<string, number>;
  /** Pontos considerados (com pelo menos uma marcação no mapa). */
  total: number;
}

export interface FiltroMapaCalor {
  /** Só os lances desse jogador (quem fez o winner / forçou / errou). */
  jogador?: string;
  /** Só os lances desse golpe (`tipoFinalizacao`). */
  golpe?: string;
}

/** Soma as marcações de uma dupla (ou de um jogador dela) para um tipo de finalização. */
export function agregarMapaCalor(pontos: BtPonto[], dupla: 'A' | 'B', finalizacao: FinalizacaoComCalor, filtro: FiltroMapaCalor = {}): MapaCalorAgregado {
  const res: MapaCalorAgregado = { jogador: {}, bola: {}, total: 0 };
  for (const p of pontos) {
    if (p.finalizacao !== finalizacao || duplaDoAutor(p) !== dupla) continue;
    if (filtro.jogador && p.vencedorJogador !== filtro.jogador) continue;
    if (filtro.golpe && p.tipoFinalizacao !== filtro.golpe) continue;
    if (!p.calorJogador && !p.calorBola) continue;
    res.total += 1;
    if (p.calorJogador) {
      const k = chaveCelula(p.calorJogador);
      res.jogador[k] = (res.jogador[k] ?? 0) + 1;
    }
    if (p.calorBola) {
      const k = chaveCelula(p.calorBola);
      res.bola[k] = (res.bola[k] ?? 0) + 1;
    }
  }
  return res;
}

/** Algum ponto tem mapa de calor marcado? (esconde a aba/seção quando não.) */
export function jogoTemMapaCalor(pontos: BtPonto[]): boolean {
  return pontos.some(p => temMapaCalor(p.finalizacao) && (p.calorJogador || p.calorBola));
}

/** Idem, para várias análises (tela do atleta). */
export function analisesTemMapaCalor(analises: BtAnalise[]): boolean {
  return analises.some(a => jogoTemMapaCalor(a.pontos));
}

/** Textos dos dois grids para cada finalização. */
export function rotulosMapaCalor(f: FinalizacaoComCalor): { jogador: string; bola: string } {
  switch (f) {
    case 'Winner':
      return { jogador: 'Posição de quem fez o Winner', bola: 'Posição na quadra onde foi o Winner' };
    case 'ForçouErro':
      return { jogador: 'Posição de quem forçou o erro', bola: 'Posição do adversário que cometeu o erro forçado' };
    case 'ErroNaoForcado':
      return { jogador: 'Posição de quem cometeu o Erro Não Forçado', bola: 'Para onde a bola foi após o erro' };
  }
}
