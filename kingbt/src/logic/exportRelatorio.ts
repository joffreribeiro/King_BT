// ─── Exportação de relatórios em PDF ──────────────────────────────────────────
// Gera HTML simples (sem os gráficos interativos da tela) para ser impresso via
// expo-print, no mesmo padrão usado em src/logic/rankingHtml.ts + app/(app)/ranking.tsx.

import type { BtAnalise, BtEstatisticas } from './btTracker';
import { tiebreaksDosSets } from './btPlacarPonto';
import { melhoresPorColuna, sequenciasDePontos, viradasDoJogo } from './btMomentos';
import type { ResumoAtleta } from './btAtleta';
import type { EvolucaoAtleta, Sugestao } from './btAtletaAnalise';
import type { BtTreino, BtAnaliseTreino } from './btTreino';
import { TREINO_GOLPES } from './btTreino';

const BASE_STYLE = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; background:#0F1512; color:#EDEFEA; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; color:#F3C544; margin: 24px 0 8px; }
  .sub { color:#9BA69E; font-size: 12px; margin-bottom: 20px; }
  table { width:100%; border-collapse: collapse; font-size: 13px; }
  th { text-align:left; color:#9BA69E; font-size:11px; text-transform:uppercase; padding: 6px 8px; border-bottom: 1px solid #2C3A35; }
  td { padding: 6px 8px; border-bottom: 1px solid #1E2825; }
  .num { text-align:center; }
  sup { font-size: 9px; color:#9BA69E; }
  ul { padding-left: 18px; font-size: 13px; }
  li { margin-bottom: 4px; }
  .foot { margin-top: 24px; color:#5C6B63; font-size: 10px; }
`;

function html(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head>
  <body><h1>${title}</h1>${body}<div class="foot">Gerado pelo King BT</div></body></html>`;
}

/** Nomes de jogador entram direto no HTML do PDF: escapa para um nome com < ou & não quebrar (nem injetar) o documento. */
export function esc(t: string | number): string {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const nomeDaDupla = (a: BtAnalise, ids: string[]) => ids.filter(Boolean).map(id => a.nomes[id] ?? id).join(' / ');

export function gerarRelatorioPartidaHtml(analise: BtAnalise, stats: BtEstatisticas): string {
  const j = analise.jogadores;
  const nA = esc(nomeDaDupla(analise, [j.a1, j.a2]));
  const nB = esc(nomeDaDupla(analise, [j.b1, j.b2]));
  const { dupla, jogadores } = stats;
  const holdA = dupla.A.gamesSacando > 0 ? Math.round((dupla.A.gamesSacandoVencidos / dupla.A.gamesSacando) * 100) : 0;
  const holdB = dupla.B.gamesSacando > 0 ? Math.round((dupla.B.gamesSacandoVencidos / dupla.B.gamesSacando) * 100) : 0;

  // Placar por set, com os pontos do tie-break como expoente (6-7⁵)
  const pf = analise.placarFinal;
  const tbs = tiebreaksDosSets({ pontos: analise.pontos, rule: analise.rule, inicial: analise.inicial });
  const celulaSet = (g: number, tb: { a: number; b: number } | undefined, lado: 'a' | 'b') =>
    tb ? `${g}<sup>${tb[lado]}</sup>` : String(g);
  const placarHtml = pf && pf.gamesA.length > 0 ? `
    <h2>Placar</h2>
    <table>
      <tr><th></th>${pf.gamesA.map((_, i) => `<th class="num">Set ${i + 1}</th>`).join('')}<th class="num">Sets</th></tr>
      <tr><td>${nA}</td>${pf.gamesA.map((g, i) => `<td class="num">${celulaSet(g, pf.stb?.[i] ? undefined : tbs[i], 'a')}</td>`).join('')}<td class="num"><b>${pf.setsA}</b></td></tr>
      <tr><td>${nB}</td>${pf.gamesB.map((g, i) => `<td class="num">${celulaSet(g, pf.stb?.[i] ? undefined : tbs[i], 'b')}</td>`).join('')}<td class="num"><b>${pf.setsB}</b></td></tr>
    </table>` : '';

  const ids = [j.a1, j.a2, j.b1, j.b2].filter(Boolean);
  const melhores = melhoresPorColuna(ids.map(id => jogadores[id]).filter(Boolean));
  const estrela = (col: string, id: string) => (melhores[col]?.includes(id) ? ' ★' : '');
  const atletasRows = ids.map(id => {
    const e = jogadores[id];
    if (!e) return '';
    return `<tr>
      <td>${esc(analise.nomes[id] ?? id)}</td>
      <td class="num">${e.pontosGanhos}${estrela('Pts', id)}</td>
      <td class="num">${e.winners}${estrela('Winner', id)}</td>
      <td class="num">${e.aces}${estrela('Ace', id)}</td>
      <td class="num">${e.forcouErro}${estrela('Forçou erro', id)}</td>
      <td class="num">${e.errosNaoForcados}${estrela('Erro N.F.', id)}</td>
      <td class="num">${e.errosDevolucao}${estrela('Erro devol.', id)}</td>
      <td class="num">${e.saquesTotal > 0 ? `${e.errosSaque}/${e.saquesTotal}` : '—'}${estrela('Erro saque', id)}</td>
      <td class="num">${e.nota.toFixed(1)}${estrela('Nota', id)}</td>
    </tr>`;
  }).join('');

  const nomeCurto = (d: 'A' | 'B') => esc(nomeDaDupla(analise, d === 'A' ? [j.a1, j.a2] : [j.b1, j.b2]));
  const sequencias = sequenciasDePontos(analise.pontos);
  const viradas = viradasDoJogo({ pontos: analise.pontos, rule: analise.rule, inicial: analise.inicial });
  const momentos = sequencias.length + viradas.length === 0 ? '' : `
    <h2>Momentos da partida</h2>
    <ul>
      ${sequencias.map(q => `<li>${q.tamanho} pontos seguidos de ${nomeCurto(q.dupla)} (pontos ${q.inicio} a ${q.fim})</li>`).join('')}
      ${viradas.map(v => `<li>Virada no ponto ${v.numero}: ${nomeCurto(v.dupla)} passou à frente (${esc(v.placar)})</li>`).join('')}
    </ul>`;

  const body = `
    <div class="sub">${nA} × ${nB} — ${new Date(analise.criadaEm).toLocaleDateString('pt-BR')}</div>
    ${placarHtml}

    <h2>Resumo</h2>
    <table>
      <tr><th></th><th class="num">${nA}</th><th class="num">${nB}</th></tr>
      <tr><td>Pontos ganhos</td><td class="num">${dupla.A.pontosGanhos}</td><td class="num">${dupla.B.pontosGanhos}</td></tr>
      <tr><td>Winners</td><td class="num">${dupla.A.winners}</td><td class="num">${dupla.B.winners}</td></tr>
      <tr><td>Aces</td><td class="num">${dupla.A.aces}</td><td class="num">${dupla.B.aces}</td></tr>
      <tr><td>Forçou erro</td><td class="num">${dupla.A.forcouErro}</td><td class="num">${dupla.B.forcouErro}</td></tr>
      <tr><td>Erros não forçados</td><td class="num">${dupla.A.errosNaoForcados}</td><td class="num">${dupla.B.errosNaoForcados}</td></tr>
      <tr><td>Confirmação de saque</td><td class="num">${dupla.A.gamesSacandoVencidos}/${dupla.A.gamesSacando} (${holdA}%)</td><td class="num">${dupla.B.gamesSacandoVencidos}/${dupla.B.gamesSacando} (${holdB}%)</td></tr>
      <tr><td>Break points</td><td class="num">${dupla.A.breakPointsConvertidos}/${dupla.A.breakPointsChances}</td><td class="num">${dupla.B.breakPointsConvertidos}/${dupla.B.breakPointsChances}</td></tr>
    </table>

    <h2>Por atleta</h2>
    <table>
      <tr><th>Atleta</th><th class="num">Pts</th><th class="num">W</th><th class="num">Ace</th><th class="num">FE</th><th class="num">ENF</th><th class="num">ED</th><th class="num">ES</th><th class="num">Nota</th></tr>
      ${atletasRows}
    </table>
    <div class="sub" style="margin-top:6px">★ = melhor da coluna (menor, nos erros) · W = winners · FE = forçou erro · ENF = erro não forçado · ED = erro de devolução · ES = erros de saque / saques</div>
    ${momentos}
  `;
  return html('Relatório de Partida — King BT', body);
}

/** PDF do atleta: números somados, o que treinar e a evolução recente. */
export function gerarRelatorioAtletaHtml(r: ResumoAtleta, sugestoes: Sugestao[], evolucao: EvolucaoAtleta | null, periodo: string): string {
  const linhasPartidas = [...r.lista].reverse().map(p => `<tr>
      <td>${new Date(p.data).toLocaleDateString('pt-BR')}</td>
      <td>${p.parceiro ? `com ${esc(p.parceiro)} · ` : ''}contra ${esc(p.adversarios)}</td>
      <td class="num">${esc(p.placar)}</td>
      <td class="num">${p.venceu ? 'V' : 'D'}</td>
      <td class="num">${p.nota.toFixed(1)}</td>
    </tr>`).join('');
  const conf = r.confirmacaoSaque;
  const sugestoesHtml = sugestoes.length === 0 ? '' :
    `<h2>O que treinar</h2><ul>${sugestoes.map(sg => `<li><b>${esc(sg.titulo)}</b>: ${esc(sg.texto)}</li>`).join('')}</ul>`;
  const evolucaoHtml = !evolucao ? '' :
    `<h2>Evolução recente</h2><div class="sub">Últimas ${evolucao.recentes} partidas × ${evolucao.anteriores} anteriores</div><ul>${evolucao.linhas.map(l => `<li>${esc(l.frase)}</li>`).join('')}</ul>`;
  const body = `
    <div class="sub">${esc(periodo)} — ${r.partidas} ${r.partidas === 1 ? 'partida' : 'partidas'} (${r.vitorias}V · ${r.derrotas}D)</div>

    <h2>Números</h2>
    <table>
      <tr><td>Nota média</td><td class="num">${r.notaMedia.toFixed(1)}</td></tr>
      <tr><td>Winners</td><td class="num">${r.winners}</td></tr>
      <tr><td>Aces</td><td class="num">${r.aces}</td></tr>
      <tr><td>Forçou erro</td><td class="num">${r.forcouErro}</td></tr>
      <tr><td>Erros não forçados</td><td class="num">${r.errosNaoForcados}</td></tr>
      <tr><td>Erros de saque</td><td class="num">${r.errosSaque}${r.saquesTotal > 0 ? ` de ${r.saquesTotal}` : ''}</td></tr>
      <tr><td>Erros de devolução</td><td class="num">${r.errosDevolucao}</td></tr>
      <tr><td>Confirmação de saque</td><td class="num">${conf.total > 0 ? `${conf.n}/${conf.total} (${conf.pct}%)` : '—'}</td></tr>
    </table>

    ${sugestoesHtml}
    ${evolucaoHtml}

    <h2>Partidas</h2>
    <table>
      <tr><th>Data</th><th>Jogo</th><th class="num">Placar</th><th class="num">Res.</th><th class="num">Nota</th></tr>
      ${linhasPartidas}
    </table>
  `;
  return html(`Análise do atleta — ${esc(r.nome)}`, body);
}

export function gerarRelatorioTreinoHtml(treino: BtTreino, analise: BtAnaliseTreino, nomeJogador: string): string {
  const rows = TREINO_GOLPES
    .map(g => ({ g, c: treino.contagens[g.key] }))
    .filter(({ c }) => c && (c.bom + c.ruim) > 0)
    .map(({ g, c }) => {
      const total = c!.bom + c!.ruim;
      const pct = Math.round((c!.bom / total) * 100);
      return `<tr><td>${g.label}</td><td class="num">${c!.bom}</td><td class="num">${c!.ruim}</td><td class="num">${pct}%</td></tr>`;
    }).join('');

  const body = `
    <div class="sub">${nomeJogador} — ${treino.titulo} — ${new Date(treino.criadoEm).toLocaleDateString('pt-BR')}</div>

    <h2>Resumo</h2>
    <table>
      <tr><td>Aproveitamento geral</td><td class="num">${analise.aproveitamentoGeral}%</td></tr>
      <tr><td>Melhor golpe</td><td class="num">${analise.melhorGolpe ? `${analise.melhorGolpe.label} (${analise.melhorGolpe.pct}%)` : '—'}</td></tr>
      <tr><td>Pior golpe</td><td class="num">${analise.piorGolpe ? `${analise.piorGolpe.label} (${analise.piorGolpe.pct}%)` : '—'}</td></tr>
      <tr><td>Mais utilizado</td><td class="num">${analise.maisUtilizado?.label ?? '—'}</td></tr>
      <tr><td>Golpes acima de 50%</td><td class="num">${analise.golpesAcima50.count} / ${analise.golpesAcima50.total}</td></tr>
    </table>

    <h2>Golpes</h2>
    <table>
      <tr><th>Golpe</th><th class="num">Bom</th><th class="num">Ruim</th><th class="num">%</th></tr>
      ${rows}
    </table>
  `;
  return html('Análise Individual — King BT', body);
}

/** PDF com todos os jogos gravados pelo King Scout: data, duplas, placar por set (tie-break em expoente) e pontos registrados. */
export function gerarRelatorioJogosHtml(analises: BtAnalise[], subtitulo: string): string {
  const ordenadas = [...analises].sort((a, b) => b.criadaEm - a.criadaEm);
  const linhas = ordenadas.map(a => {
    const j = a.jogadores;
    const pf = a.placarFinal;
    const tbs = tiebreaksDosSets({ pontos: a.pontos, rule: a.rule, inicial: a.inicial });
    const sup = (g: number, tb: number | undefined) => (tb === undefined ? String(g) : `${g}<sup>${tb}</sup>`);
    const placar = pf && pf.gamesA.length > 0
      ? pf.gamesA.map((g, i) => {
          const tb = pf.stb?.[i] ? undefined : tbs[i];
          return `${sup(g, tb?.a)}–${sup(pf.gamesB[i] ?? 0, tb?.b)}`;
        }).join(' &nbsp; ')
      : '—';
    return `<tr>
      <td>${new Date(a.criadaEm).toLocaleDateString('pt-BR')}</td>
      <td>${esc(nomeDaDupla(a, [j.a1, j.a2]))} × ${esc(nomeDaDupla(a, [j.b1, j.b2]))}</td>
      <td class="num">${placar}</td>
      <td class="num">${a.pontos.length}</td>
      <td class="num">${pf ? 'Finalizada' : 'Em andamento'}</td>
    </tr>`;
  }).join('');
  const finalizadas = ordenadas.filter(a => !!a.placarFinal).length;
  const body = `
    <div class="sub">${esc(subtitulo)} — ${ordenadas.length} ${ordenadas.length === 1 ? 'jogo' : 'jogos'} (${finalizadas} ${finalizadas === 1 ? 'finalizado' : 'finalizados'})</div>
    <table>
      <tr><th>Data</th><th>Jogo</th><th class="num">Placar (games por set)</th><th class="num">Pontos</th><th class="num">Situação</th></tr>
      ${linhas}
    </table>
  `;
  return html('Jogos gravados pelo King Scout', body);
}
