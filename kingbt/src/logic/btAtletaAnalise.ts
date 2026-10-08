/**
 * Camada de leitura sobre o resumo do atleta (btAtleta.ts): sugestões de treino, evolução, adversários
 * ("como jogar contra") e campanha por competição. Funções puras; cada regra só dispara com amostra
 * mínima, para não dar conselho com base em sorte. Inspirado em atleta.ts/adversarios.ts/competicoes.ts
 * do scout do KING BT Playbook.
 */
import type { BtAnalise } from './btTracker';
import { ladoDoAtleta, type EstatPartida, type PartidaDoAtleta, type ResumoAtleta } from './btAtleta';

/* ── Distribuição de golpes ───────────────────────────────────────────── */

export interface Distribuicao { label: string; n: number; pct: number }

/** Mapa tipo → quantidade em lista ordenada do mais para o menos frequente, com a fatia de cada um. */
export function distribuicao(mapa: Record<string, number>): Distribuicao[] {
  const total = Object.values(mapa).reduce((s, n) => s + n, 0);
  return Object.entries(mapa)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([label, n]) => ({ label, n, pct: total > 0 ? Math.round((n / total) * 100) : 0 }));
}

const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR');
const pctErroSaque = (r: ResumoAtleta) => (r.saquesTotal > 0 ? Math.round((r.errosSaque / r.saquesTotal) * 100) : 0);

/* ── Sugestões de treino ──────────────────────────────────────────────── */

export interface Sugestao { id: string; tipo: 'forte' | 'atencao'; titulo: string; texto: string }

export function sugestoesDoAtleta(r: ResumoAtleta): Sugestao[] {
  const lista: Sugestao[] = [];
  const errosSaquePct = pctErroSaque(r);

  if (r.saquesTotal >= 5 && errosSaquePct >= 12) {
    const pior = [...r.saques].sort((a, b) => b.erros - a.erros)[0];
    const onde = pior && pior.erros >= 2 ? `, a maioria na posição ${pior.posicao}` : '';
    lista.push({ id: 'saque', tipo: 'atencao', titulo: 'Saque', texto: `Erra ${errosSaquePct}% dos saques (${r.errosSaque} de ${r.saquesTotal})${onde}. Treine a consistência do saque.` });
  }

  const enf = distribuicao(r.tiposErro)[0];
  if (enf && enf.n >= 3 && enf.pct >= 35) {
    const fatia = enf.pct >= 50 ? 'Metade ou mais' : `${enf.pct}%`;
    lista.push({ id: 'enf-golpe', tipo: 'atencao', titulo: 'Erro não forçado', texto: `${fatia} dos seus erros não forçados é ${enf.label.toLowerCase()} (${enf.n} vezes). Treine esse golpe.` });
  }

  if (r.errosNaoForcados >= 4) {
    const razao = r.winners / r.errosNaoForcados;
    if (razao < 0.5) {
      lista.push({ id: 'pressao', tipo: 'atencao', titulo: 'Pressão', texto: `Faz poucos winners para cada erro (${r.winners} winners e ${r.errosNaoForcados} erros não forçados). Busque bolas mais seguras antes de finalizar.` });
    } else if (razao >= 1.5 && r.winners >= 4) {
      lista.push({ id: 'pressao-forte', tipo: 'forte', titulo: 'Agressividade', texto: `Faz mais winners que erros (${r.winners} winners para ${r.errosNaoForcados} erros não forçados). Continue tomando a iniciativa.` });
    }
  }

  const arma = distribuicao(r.tiposWinner)[0];
  if (arma && arma.n >= 3 && arma.pct >= 35) {
    lista.push({ id: 'arma', tipo: 'forte', titulo: 'Ponto forte', texto: `${arma.label} é a sua arma, com ${arma.pct}% dos winners (${arma.n}). Monte jogadas que terminem nele.` });
  }

  const devolPorJogo = r.errosDevolucao / Math.max(1, r.partidas);
  if (r.errosDevolucao >= 2 && devolPorJogo >= 2) {
    lista.push({ id: 'devolucao', tipo: 'atencao', titulo: 'Devolução', texto: `Erra ${num(devolPorJogo)} devoluções por partida. Treine a devolução para colocar a bola em jogo.` });
  }

  const conf = r.confirmacaoSaque;
  if (conf.total >= 4 && conf.pct < 50) {
    lista.push({ id: 'confirmacao', tipo: 'atencao', titulo: 'Confirmação de saque', texto: `Confirma ${conf.pct}% dos games de saque (${conf.n} de ${conf.total}). Treine a primeira bola depois do saque.` });
  }
  return lista;
}

/* ── Evolução: partidas recentes × anteriores ─────────────────────────── */

export type Tendencia = 'melhorou' | 'piorou' | 'estavel';
export interface LinhaEvolucao { id: string; rotulo: string; antes: string; depois: string; tendencia: Tendencia; frase: string }
export interface EvolucaoAtleta { recentes: number; anteriores: number; linhas: LinhaEvolucao[] }

/** Mínimo de partidas para comparar: com menos, a diferença é sorte, não evolução. */
export const MINIMO_PARTIDAS_EVOLUCAO = 4;

interface Bloco { partidas: number; nota: number; s: EstatPartida }

function bloco(lista: PartidaDoAtleta[]): Bloco {
  const b: Bloco = {
    partidas: lista.length, nota: 0,
    s: { winners: 0, forcouErro: 0, errosNaoForcados: 0, errosDevolucao: 0, errosSaque: 0, saquesTotal: 0, confN: 0, confTotal: 0 },
  };
  for (const p of lista) {
    b.nota += p.nota;
    (Object.keys(b.s) as (keyof EstatPartida)[]).forEach(k => { b.s[k] += p.stats[k]; });
  }
  return b;
}

/** Compara as `recentes` últimas partidas com as anteriores. `null` com menos de MINIMO_PARTIDAS_EVOLUCAO. */
export function evolucaoDoAtleta(r: ResumoAtleta, recentes = 3): EvolucaoAtleta | null {
  if (r.lista.length < MINIMO_PARTIDAS_EVOLUCAO) return null;
  const n = Math.min(recentes, Math.floor(r.lista.length / 2));
  const antes = bloco(r.lista.slice(0, r.lista.length - n));
  const depois = bloco(r.lista.slice(r.lista.length - n));
  const linhas: LinhaEvolucao[] = [];

  function comparar(id: string, rotulo: string, a: number | null, d: number | null, maiorMelhor: boolean, limiar: number, sujeito: string, unidade = '') {
    if (a === null || d === null) return;
    const diff = d - a;
    const tendencia: Tendencia = Math.abs(diff) < limiar ? 'estavel' : (diff > 0) === maiorMelhor ? 'melhorou' : 'piorou';
    const de = `de ${num(a)}${unidade} para ${num(d)}${unidade}`;
    const frase = tendencia === 'estavel' ? `Estável: ${sujeito} ${de}.`
      : `${tendencia === 'melhorou' ? 'Melhorou' : 'Atenção'}: ${sujeito} ${diff > 0 ? 'subiram' : 'caíram'} ${de}.`;
    linhas.push({ id, rotulo, antes: `${num(a)}${unidade}`, depois: `${num(d)}${unidade}`, tendencia, frase });
  }
  const porJogo = (v: number, b: Bloco) => v / b.partidas;
  const pct = (x: number, total: number, min: number) => (total >= min ? (x / total) * 100 : null);

  comparar('nota', 'Nota média', antes.nota / antes.partidas, depois.nota / depois.partidas, true, 0.5, 'nota média');
  comparar('winners', 'Winners por partida', porJogo(antes.s.winners, antes), porJogo(depois.s.winners, depois), true, 1, 'winners', ' por jogo');
  comparar('enf', 'Erros não forçados por partida', porJogo(antes.s.errosNaoForcados, antes), porJogo(depois.s.errosNaoForcados, depois), false, 1, 'erros não forçados', ' por jogo');
  comparar('forcou', 'Forçou erro por partida', porJogo(antes.s.forcouErro, antes), porJogo(depois.s.forcouErro, depois), true, 1, 'erros forçados no adversário', ' por jogo');
  comparar('devol', 'Erros de devolução por partida', porJogo(antes.s.errosDevolucao, antes), porJogo(depois.s.errosDevolucao, depois), false, 1, 'erros de devolução', ' por jogo');
  comparar('saque', 'Erro de saque', pct(antes.s.errosSaque, antes.s.saquesTotal, 3), pct(depois.s.errosSaque, depois.s.saquesTotal, 3), false, 4, 'erros de saque', '%');
  comparar('conf', 'Confirmação de saque', pct(antes.s.confN, antes.s.confTotal, 2), pct(depois.s.confN, depois.s.confTotal, 2), true, 10, 'confirmações de saque', '%');
  return { recentes: depois.partidas, anteriores: antes.partidas, linhas };
}

/* ── Adversários ──────────────────────────────────────────────────────── */

export interface Adversario { id: string; nome: string; partidas: number; vitorias: number; derrotas: number; ultimaData: number }

/** Quem esteve do outro lado da quadra quando `foco` jogou. `vitorias` são as do foco contra ele. */
export function adversariosDe(analises: BtAnalise[], foco: string): Adversario[] {
  const mapa = new Map<string, Adversario>();
  for (const a of analises) {
    const pf = a.placarFinal;
    const meu = ladoDoAtleta(a, foco);
    if (!pf || !meu) continue;
    const venceu = meu === 'A' ? pf.setsA > pf.setsB : pf.setsB > pf.setsA;
    const derrota = meu === 'A' ? pf.setsB > pf.setsA : pf.setsA > pf.setsB;
    const deles = meu === 'A' ? [a.jogadores.b1, a.jogadores.b2] : [a.jogadores.a1, a.jogadores.a2];
    for (const id of deles.filter(Boolean)) {
      const x = mapa.get(id) ?? { id, nome: a.nomes[id] ?? id, partidas: 0, vitorias: 0, derrotas: 0, ultimaData: 0 };
      x.partidas += 1;
      if (venceu) x.vitorias += 1; else if (derrota) x.derrotas += 1;
      x.ultimaData = Math.max(x.ultimaData, a.criadaEm);
      mapa.set(id, x);
    }
  }
  return [...mapa.values()].sort((x, y) => y.partidas - x.partidas || y.ultimaData - x.ultimaData);
}

/** Análises encerradas em que `adversario` jogou do lado oposto ao de `foco` (sem `foco`, todas em que ele aparece). */
export function analisesContra(analises: BtAnalise[], adversario: string, foco?: string): BtAnalise[] {
  return analises.filter(a => {
    const lado = ladoDoAtleta(a, adversario);
    if (!a.placarFinal || !lado) return false;
    if (!foco) return true;
    const ladoFoco = ladoDoAtleta(a, foco);
    return !!ladoFoco && ladoFoco !== lado;
  });
}

/** Frases práticas de "como jogar contra" o atleta, só com o que os dados sustentam. */
export function dicasContra(r: ResumoAtleta): string[] {
  const dicas: string[] = [];
  const topErro = distribuicao(r.tiposErro)[0];
  if (topErro && r.errosNaoForcados >= 3) dicas.push(`Erra mais em ${topErro.label} (${topErro.pct}% dos erros não forçados): leve a troca para esse golpe.`);
  const topWinner = distribuicao(r.tiposWinner)[0];
  if (topWinner && r.winners >= 3) dicas.push(`Seu golpe mais perigoso é ${topWinner.label} (${topWinner.n} winners): não deixe a bola ficar para ele.`);
  const errosSaquePct = pctErroSaque(r);
  if (r.saquesTotal >= 8 && errosSaquePct >= 12) dicas.push(`Erra ${errosSaquePct}% dos saques (${r.errosSaque} de ${r.saquesTotal}): pressione na devolução.`);
  if (r.confirmacaoSaque.total >= 3 && r.confirmacaoSaque.pct <= 50) dicas.push(`Confirma só ${r.confirmacaoSaque.pct}% dos games de saque: há chance de quebrar.`);
  const fraco = r.saques
    .filter(s => s.vencidos + s.perdidos >= 3)
    .sort((a, b) => a.vencidos / (a.vencidos + a.perdidos) - b.vencidos / (b.vencidos + b.perdidos))[0];
  if (fraco && fraco.vencidos / (fraco.vencidos + fraco.perdidos) < 0.5) {
    dicas.push(`Ganha pouco quando saca em ${fraco.posicao} (${fraco.vencidos} de ${fraco.vencidos + fraco.perdidos} pontos): vale esperar esse saque.`);
  }
  if (dicas.length === 0) dicas.push('Ainda há poucos dados para uma dica segura. Registre mais partidas contra esse adversário.');
  return dicas;
}

/* ── Campanha por competição ──────────────────────────────────────────── */

export interface CampanhaCompeticao { competitionId: string; partidas: PartidaDoAtleta[]; vitorias: number; derrotas: number; ultimaData: number }

/** Partidas do atleta agrupadas por competição (a mais recente primeiro), com o saldo de cada uma. */
export function campanhasDoAtleta(r: ResumoAtleta): CampanhaCompeticao[] {
  const mapa = new Map<string, CampanhaCompeticao>();
  for (const p of r.lista) {
    const c = mapa.get(p.competitionId) ?? { competitionId: p.competitionId, partidas: [], vitorias: 0, derrotas: 0, ultimaData: 0 };
    c.partidas.push(p);
    if (p.venceu) c.vitorias += 1; else c.derrotas += 1;
    c.ultimaData = Math.max(c.ultimaData, p.data);
    mapa.set(p.competitionId, c);
  }
  return [...mapa.values()].sort((a, b) => b.ultimaData - a.ultimaData);
}
