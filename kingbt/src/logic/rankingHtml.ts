import type { RankedPlayer } from '@/logic/scoring';
import type { MockPlayer } from '@/mocks/data';

export function generateRankingHtml(
  ranking: RankedPlayer[],
  players: MockPlayer[],
  groupName: string,
  season: string,
  roundsDone: number,
  location: string,
  date: string,
  logoBase64?: string,
): string {
  const getPlayer = (id: string) => players.find(p => p.id === id);

  const top3 = ranking.slice(0, 3);
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  const totalPlayers = ranking.filter(r => r.played > 0).length;

  const tableRows = ranking.map((r, i) => {
    const pl = getPlayer(r.id);
    const sgColor = r.sg > 0 ? '#2DD4BF' : r.sg < 0 ? '#E5483D' : '#888';
    const medalColor = i === 0 ? '#F3C544' : i === 1 ? '#C7D4E0' : i === 2 ? '#D89A6A' : '#aaa';
    const rowBg = i === 0 ? 'rgba(243,197,68,0.08)' : i === 1 ? 'rgba(199,212,224,0.05)' : i === 2 ? 'rgba(216,154,106,0.05)' : 'transparent';
    return `
      <tr style="background:${rowBg}; border-bottom: 1px solid rgba(255,255,255,0.06);">
        <td style="color:${medalColor}; font-weight:800; font-size:15px; padding:10px 8px; text-align:center;">${i + 1}°</td>
        <td style="padding:10px 8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:28px;height:28px;border-radius:50%;background:${pl?.color ?? '#555'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;color:#000;">${pl?.name?.slice(0, 2).toUpperCase()}</div>
            <span style="font-weight:700;font-size:14px;color:${i < 3 ? medalColor : '#fff'};">${pl?.name ?? r.id}</span>
          </div>
        </td>
        <td style="text-align:center;font-size:14px;font-weight:600;padding:10px 4px;">${r.wins}</td>
        <td style="text-align:center;font-size:14px;padding:10px 4px;">${r.losses}</td>
        <td style="text-align:center;font-size:14px;padding:10px 4px;">${r.played}</td>
        <td style="text-align:center;font-size:14px;padding:10px 4px;">${r.gamesPro}</td>
        <td style="text-align:center;font-size:14px;padding:10px 4px;">${r.gamesCon}</td>
        <td style="text-align:center;font-size:14px;font-weight:700;color:${sgColor};padding:10px 4px;">${r.sg > 0 ? '+' : ''}${r.sg}</td>
        <td style="text-align:center;font-size:14px;padding:10px 4px;">${r.ga.toFixed(2)}</td>
        <td style="text-align:right;font-size:16px;font-weight:900;color:#F3C544;padding:10px 8px;">${r.points.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const destaques = [
    { titulo: 'REI DAS AREIAS', nome: getPlayer(ranking[0]?.id)?.name ?? '' },
    { titulo: 'MAIOR PARTICIPAÇÃO', nome: ranking.slice().sort((a, b) => b.played - a.played)[0] ? getPlayer(ranking.slice().sort((a, b) => b.played - a.played)[0].id)?.name ?? '' : '' },
    { titulo: 'MAIOR EFICIÊNCIA (GA)', nome: ranking.filter(r => r.played > 0).slice().sort((a, b) => b.ga - a.ga)[0] ? getPlayer(ranking.filter(r => r.played > 0).slice().sort((a, b) => b.ga - a.ga)[0].id)?.name ?? '' : '' },
    { titulo: 'REVELAÇÃO DA TEMPORADA', nome: getPlayer(ranking[ranking.length > 4 ? 4 : ranking.length - 1]?.id)?.name ?? '' },
  ];

  const destaquesHtml = destaques.map(d => `
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;color:#F3C544;font-weight:800;letter-spacing:1px;">${d.titulo}</div>
      <div style="font-size:14px;font-weight:700;color:#fff;">${d.nome}</div>
    </div>
  `).join('');

  const elencoHtml = players.map(p => `
    <div style="font-size:12px;color:#ddd;margin-bottom:4px;">
      <span style="color:${p.color};font-weight:700;">●</span> ${p.name} — <span style="color:#aaa;">${p.title}</span>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Roboto:wght@400;500;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background: #0a0a0d;
    color: #fff;
    font-family: 'Roboto', sans-serif;
    width: 800px;
    margin: 0 auto;
  }
</style>
</head>
<body>

<!-- HEADER -->
<div style="background: linear-gradient(135deg, #0d0d10 0%, #1a1400 50%, #0d0d10 100%); padding:24px; border-bottom: 2px solid #F3C544; display:flex; align-items:center; gap:24px;">
  <div style="flex:1;">
    <div style="font-size:11px;color:#F3C544;letter-spacing:4px;font-family:'Oswald',sans-serif;">— KING BT —</div>
    <div style="font-size:48px;font-weight:900;color:#fff;font-family:'Oswald',sans-serif;line-height:1;letter-spacing:2px;">RANKING<br>GERAL</div>
    <div style="background:linear-gradient(90deg,#F3C544,#a07800);padding:3px 12px;display:inline-block;margin:6px 0;">
      <span style="font-size:12px;color:#000;font-weight:800;letter-spacing:3px;">★ OFICIAL ★</span>
    </div>
    <div style="font-size:14px;color:#ccc;margin-top:4px;">APÓS <strong style="color:#F3C544;">${roundsDone}</strong> RODADAS</div>
  </div>
  <div style="flex:1;text-align:center;">
    ${logoBase64 ? `<img src="${logoBase64}" style="width:160px;height:160px;object-fit:contain;"/>` : `<div style="width:160px;height:160px;background:#1a1400;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto;">🏆</div>`}
  </div>
  <div style="flex:1;">
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(243,197,68,0.3);border-radius:8px;padding:12px;display:grid;gap:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;color:#888;letter-spacing:1px;">📅 ATUALIZADO EM</span>
        <span style="font-size:12px;font-weight:700;color:#F3C544;">${date}</span>
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.08);"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;color:#888;letter-spacing:1px;">🏅 RODADAS</span>
        <span style="font-size:12px;font-weight:700;color:#fff;">${roundsDone}</span>
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.08);"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;color:#888;letter-spacing:1px;">👥 ATLETAS</span>
        <span style="font-size:12px;font-weight:700;color:#fff;">${totalPlayers}</span>
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.08);"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;color:#888;letter-spacing:1px;">📍 LOCAL</span>
        <span style="font-size:11px;font-weight:600;color:#fff;text-align:right;max-width:150px;">${location}</span>
      </div>
    </div>
  </div>
</div>

<!-- PÓDIO -->
<div style="background:linear-gradient(180deg,#1a1200 0%,#0a0a0d 100%);padding:32px 24px 0;display:flex;align-items:flex-end;justify-content:center;gap:0;">

  <!-- 2° lugar -->
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding-top:40px;">
    <div style="font-size:16px;font-weight:800;color:#C7D4E0;margin-bottom:6px;">2°</div>
    <div style="width:60px;height:60px;border-radius:50%;background:${getPlayer(second?.id)?.color ?? '#555'};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#000;border:3px solid #C7D4E0;">${getPlayer(second?.id)?.name?.slice(0,2).toUpperCase()}</div>
    <div style="font-size:16px;font-weight:800;color:#C7D4E0;margin-top:8px;text-transform:uppercase;">${getPlayer(second?.id)?.name?.toUpperCase()}</div>
    <div style="font-size:24px;font-weight:900;color:#C7D4E0;margin-bottom:8px;">${second?.points.toFixed(2)}</div>
    <div style="width:100%;height:90px;background:rgba(199,212,224,0.1);border-top:3px solid #C7D4E0;display:flex;align-items:center;justify-content:center;">
      <span style="font-size:36px;font-weight:900;color:#C7D4E0;">2</span>
    </div>
  </div>

  <!-- 1° lugar -->
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding-top:0;">
    <div style="font-size:20px;font-weight:900;color:#F3C544;margin-bottom:6px;">👑 1°</div>
    <div style="width:80px;height:80px;border-radius:50%;background:${getPlayer(first?.id)?.color ?? '#F3C544'};display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#000;border:4px solid #F3C544;box-shadow:0 0 20px rgba(243,197,68,0.5);">${getPlayer(first?.id)?.name?.slice(0,2).toUpperCase()}</div>
    <div style="font-size:22px;font-weight:900;color:#F3C544;margin-top:8px;text-transform:uppercase;letter-spacing:1px;">${getPlayer(first?.id)?.name?.toUpperCase()}</div>
    <div style="font-size:36px;font-weight:900;color:#F3C544;margin-bottom:8px;text-shadow:0 0 20px rgba(243,197,68,0.5);">${first?.points.toFixed(2)}</div>
    <div style="width:100%;height:130px;background:rgba(243,197,68,0.1);border-top:4px solid #F3C544;display:flex;align-items:center;justify-content:center;box-shadow:0 -10px 30px rgba(243,197,68,0.2);">
      <span style="font-size:52px;font-weight:900;color:#F3C544;">1</span>
    </div>
  </div>

  <!-- 3° lugar -->
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding-top:60px;">
    <div style="font-size:16px;font-weight:800;color:#D89A6A;margin-bottom:6px;">3°</div>
    <div style="width:52px;height:52px;border-radius:50%;background:${getPlayer(third?.id)?.color ?? '#555'};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#000;border:3px solid #D89A6A;">${getPlayer(third?.id)?.name?.slice(0,2).toUpperCase()}</div>
    <div style="font-size:14px;font-weight:800;color:#D89A6A;margin-top:8px;text-transform:uppercase;">${getPlayer(third?.id)?.name?.toUpperCase()}</div>
    <div style="font-size:22px;font-weight:900;color:#D89A6A;margin-bottom:8px;">${third?.points.toFixed(2)}</div>
    <div style="width:100%;height:70px;background:rgba(216,154,106,0.1);border-top:3px solid #D89A6A;display:flex;align-items:center;justify-content:center;">
      <span style="font-size:30px;font-weight:900;color:#D89A6A;">3</span>
    </div>
  </div>
</div>

<!-- TABELA -->
<div style="padding:0 24px 24px;">
  <table style="width:100%;border-collapse:collapse;margin-top:16px;">
    <thead>
      <tr style="background:rgba(243,197,68,0.15);border-bottom:2px solid rgba(243,197,68,0.4);">
        <th style="padding:10px 8px;font-size:10px;color:#F3C544;letter-spacing:1px;text-align:center;">POS.</th>
        <th style="padding:10px 8px;font-size:10px;color:#F3C544;letter-spacing:1px;text-align:left;">JOGADOR</th>
        <th style="padding:10px 4px;font-size:10px;color:#F3C544;letter-spacing:1px;text-align:center;">V</th>
        <th style="padding:10px 4px;font-size:10px;color:#F3C544;letter-spacing:1px;text-align:center;">D</th>
        <th style="padding:10px 4px;font-size:10px;color:#F3C544;letter-spacing:1px;text-align:center;">J</th>
        <th style="padding:10px 4px;font-size:10px;color:#F3C544;letter-spacing:1px;text-align:center;">GP</th>
        <th style="padding:10px 4px;font-size:10px;color:#F3C544;letter-spacing:1px;text-align:center;">GC</th>
        <th style="padding:10px 4px;font-size:10px;color:#F3C544;letter-spacing:1px;text-align:center;">SG</th>
        <th style="padding:10px 4px;font-size:10px;color:#F3C544;letter-spacing:1px;text-align:center;">GA</th>
        <th style="padding:10px 8px;font-size:10px;color:#F3C544;letter-spacing:1px;text-align:right;">PTS KBT</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <div style="margin-top:8px;font-size:10px;color:#666;text-align:center;letter-spacing:0.5px;">
    GP: Games Pró &nbsp;|&nbsp; GC: Games Contra &nbsp;|&nbsp; SG: Saldo de Games &nbsp;|&nbsp; GA: Game Average (GP ÷ GC)
  </div>
</div>

<!-- SEÇÃO INFERIOR: 3 colunas -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-top:1px solid rgba(243,197,68,0.2);">

  <!-- Destaques -->
  <div style="padding:20px;background:rgba(243,197,68,0.03);border-right:1px solid rgba(243,197,68,0.15);">
    <div style="font-size:12px;color:#F3C544;font-weight:800;letter-spacing:2px;margin-bottom:14px;">★ DESTAQUES DA TEMPORADA</div>
    ${destaquesHtml}
  </div>

  <!-- Como é calculado -->
  <div style="padding:20px;border-right:1px solid rgba(243,197,68,0.15);">
    <div style="font-size:12px;color:#F3C544;font-weight:800;letter-spacing:2px;text-align:center;margin-bottom:10px;">COMO É CALCULADO?</div>
    <div style="text-align:center;font-size:11px;color:#F3C544;font-weight:700;margin-bottom:8px;">PONTUAÇÃO KING BT</div>
    <div style="text-align:center;font-size:11px;color:#ccc;margin-bottom:12px;">(VITÓRIAS×3) + (PARTIDAS×0,5) + (GAME AVERAGE×2)</div>
    <div style="display:flex;justify-content:space-around;margin-bottom:12px;">
      <div style="text-align:center;"><div style="font-size:20px;">🏆</div><div style="font-size:10px;color:#F3C544;font-weight:700;">VITÓRIAS<br>×3</div></div>
      <div style="text-align:center;"><div style="font-size:20px;">🎾</div><div style="font-size:10px;color:#fff;font-weight:700;">PARTIDAS<br>×0,5</div></div>
      <div style="text-align:center;"><div style="font-size:20px;">📈</div><div style="font-size:10px;color:#F3C544;font-weight:700;">GAME AVG<br>×2</div></div>
    </div>
    <div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:10px;font-size:11px;color:#ccc;text-align:center;">
      <div style="color:#F3C544;font-weight:700;margin-bottom:4px;">GAME AVERAGE (GA)</div>
      <div>= GAMES PRÓ ÷ GAMES CONTRA</div>
    </div>
    <div style="margin-top:10px;font-size:10px;color:#888;text-align:center;">
      <div style="color:#F3C544;font-weight:700;">EXEMPLO: ${getPlayer(first?.id)?.name?.toUpperCase()}</div>
      <div>(${first?.wins}×3) + (${first?.played}×0,5) + (${first?.ga.toFixed(2)}×2)</div>
      <div style="color:#F3C544;font-weight:800;font-size:13px;margin-top:4px;">= ${first?.points.toFixed(2)} PONTOS KING BT</div>
    </div>
  </div>

  <!-- Elenco -->
  <div style="padding:20px;background:rgba(243,197,68,0.03);">
    <div style="font-size:12px;color:#F3C544;font-weight:800;letter-spacing:2px;margin-bottom:14px;">★ ELENCO OFICIAL KBT ★</div>
    ${elencoHtml}
  </div>
</div>

<!-- RODAPÉ -->
<div style="background:linear-gradient(135deg,#0d0d10,#1a1400,#0d0d10);padding:16px 24px;border-top:2px solid #F3C544;display:flex;align-items:center;justify-content:space-between;">
  <div style="font-size:10px;color:#666;">
    <div style="color:#F3C544;font-weight:700;font-size:12px;">CRITÉRIOS DE DESEMPATE</div>
    <div>1° Pontuação King BT &nbsp; 2° Game Average &nbsp; 3° Saldo de Games</div>
  </div>
  <div style="text-align:center;">
    <div style="font-size:20px;font-weight:900;color:#F3C544;letter-spacing:3px;font-family:'Oswald',sans-serif;">BEE MODE</div>
    <div style="font-size:9px;color:#888;letter-spacing:1px;">TREINE COM PROPÓSITO · JOGUE COM PAIXÃO</div>
  </div>
  <div style="text-align:right;font-size:10px;color:#F3C544;font-weight:700;">
    ${groupName} · ${season}
  </div>
</div>

</body>
</html>
  `;
}
