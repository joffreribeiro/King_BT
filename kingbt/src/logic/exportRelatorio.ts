// ─── Exportação de relatórios em PDF ──────────────────────────────────────────
// Gera HTML simples (sem os gráficos interativos da tela) para ser impresso via
// expo-print, no mesmo padrão usado em src/logic/rankingHtml.ts + app/(app)/ranking.tsx.

import type { BtAnalise, BtEstatisticas } from './btTracker';
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
  .foot { margin-top: 24px; color:#5C6B63; font-size: 10px; }
`;

function html(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head>
  <body><h1>${title}</h1>${body}<div class="foot">Gerado pelo King BT</div></body></html>`;
}

export function gerarRelatorioPartidaHtml(analise: BtAnalise, stats: BtEstatisticas): string {
  const nA = `${analise.nomes[analise.jogadores.a1] ?? 'A1'} / ${analise.nomes[analise.jogadores.a2] ?? 'A2'}`;
  const nB = `${analise.nomes[analise.jogadores.b1] ?? 'B1'} / ${analise.nomes[analise.jogadores.b2] ?? 'B2'}`;
  const { dupla, jogadores } = stats;
  const holdA = dupla.A.gamesSacando > 0 ? Math.round((dupla.A.gamesSacandoVencidos / dupla.A.gamesSacando) * 100) : 0;
  const holdB = dupla.B.gamesSacando > 0 ? Math.round((dupla.B.gamesSacandoVencidos / dupla.B.gamesSacando) * 100) : 0;

  const ids = [analise.jogadores.a1, analise.jogadores.a2, analise.jogadores.b1, analise.jogadores.b2].filter(Boolean);
  const atletasRows = ids.map(id => {
    const e = jogadores[id];
    if (!e) return '';
    return `<tr>
      <td>${analise.nomes[id] ?? id}</td>
      <td class="num">${e.pontosGanhos}</td>
      <td class="num">${e.winners}</td>
      <td class="num">${e.aces}</td>
      <td class="num">${e.errosNaoForcados}</td>
      <td class="num">${e.nota.toFixed(1)}</td>
    </tr>`;
  }).join('');

  const body = `
    <div class="sub">${nA} × ${nB} — ${new Date(analise.criadaEm).toLocaleDateString('pt-BR')}</div>

    <h2>Resumo</h2>
    <table>
      <tr><th></th><th class="num">${nA}</th><th class="num">${nB}</th></tr>
      <tr><td>Pontos ganhos</td><td class="num">${dupla.A.pontosGanhos}</td><td class="num">${dupla.B.pontosGanhos}</td></tr>
      <tr><td>Winners</td><td class="num">${dupla.A.winners}</td><td class="num">${dupla.B.winners}</td></tr>
      <tr><td>Aces</td><td class="num">${dupla.A.aces}</td><td class="num">${dupla.B.aces}</td></tr>
      <tr><td>Erros não forçados</td><td class="num">${dupla.A.errosNaoForcados}</td><td class="num">${dupla.B.errosNaoForcados}</td></tr>
      <tr><td>Confirmação de saque</td><td class="num">${dupla.A.gamesSacandoVencidos}/${dupla.A.gamesSacando} (${holdA}%)</td><td class="num">${dupla.B.gamesSacandoVencidos}/${dupla.B.gamesSacando} (${holdB}%)</td></tr>
      <tr><td>Break points</td><td class="num">${dupla.A.breakPointsConvertidos}/${dupla.A.breakPointsChances}</td><td class="num">${dupla.B.breakPointsConvertidos}/${dupla.B.breakPointsChances}</td></tr>
    </table>

    <h2>Por atleta</h2>
    <table>
      <tr><th>Atleta</th><th class="num">Pts</th><th class="num">W</th><th class="num">Ace</th><th class="num">ENF</th><th class="num">Nota</th></tr>
      ${atletasRows}
    </table>
  `;
  return html('Relatório de Partida — King BT', body);
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
