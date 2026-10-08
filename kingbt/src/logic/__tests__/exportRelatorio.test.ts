jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { calcularEstatisticas, type BtAnalise, type BtPonto, type BtWinRule } from '../btTracker';
import { resumoDoAtleta } from '../btAtleta';
import { evolucaoDoAtleta, sugestoesDoAtleta } from '../btAtletaAnalise';
import { esc, gerarRelatorioAtletaHtml, gerarRelatorioPartidaHtml } from '../exportRelatorio';

const rule: BtWinRule = { sets: 1, games: 2, tiebreak: 3, tiebreakAt: 'full' };
let n = 0;
function ponto(o: Partial<BtPonto> & Pick<BtPonto, 'sacador' | 'vencedorDupla'>): BtPonto {
  return { id: String(++n), timestamp: n, gameScore: '', setScore: '', posicaoSaque: 'Direita-3', finalizacao: 'Winner', ...o };
}
const game = (s: string, v: 'A' | 'B', w?: string) => Array.from({ length: 4 }, () => ponto({ sacador: s, vencedorDupla: v, vencedorJogador: w }));

function analiseComTiebreak(nomes: Record<string, string>): BtAnalise {
  // 2x2 em games => tie-break (3 pontos); A vence por 3 a 1
  const pontos = [
    ...game('A1', 'A', 'A1'), ...game('B1', 'B'), ...game('A2', 'A', 'A2'), ...game('B2', 'B'),
    ponto({ sacador: 'A1', vencedorDupla: 'A', vencedorJogador: 'A1' }), ponto({ sacador: 'B1', vencedorDupla: 'B' }),
    ponto({ sacador: 'B1', vencedorDupla: 'A', vencedorJogador: 'A1' }), ponto({ sacador: 'A2', vencedorDupla: 'A', vencedorJogador: 'A1' }),
  ];
  return {
    id: 'm1', competitionId: 'c1', matchId: 'm1', criadaEm: 1000, rule,
    jogadores: { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2' }, nomes, pontos,
    placarFinal: { setsA: 1, setsB: 0, gamesA: [3], gamesB: [2], stb: [false] },
  };
}

describe('esc', () => {
  it('escapa os caracteres que quebram HTML', () => {
    expect(esc('<b>Ana & "Bia"</b>')).toBe('&lt;b&gt;Ana &amp; &quot;Bia&quot;&lt;/b&gt;');
    expect(esc(7)).toBe('7');
  });
});

describe('PDF da partida', () => {
  const nomes = { A1: 'Ana <script>', A2: 'Ari', B1: 'Bia', B2: 'Beto' };
  const a = analiseComTiebreak(nomes);
  const html = gerarRelatorioPartidaHtml(a, calcularEstatisticas(a));

  it('não deixa o nome do jogador injetar HTML', () => {
    expect(html).not.toContain('<script>');
    expect(html).toContain('Ana &lt;script&gt;');
  });

  it('mostra o placar por set com o tie-break em expoente', () => {
    expect(html).toContain('3<sup>3</sup>'); // 3 games no set, 3 pontos no tie-break de A
    expect(html).toContain('2<sup>1</sup>'); // B: 2 games, 1 ponto no tie-break
    expect(html).toContain('Set 1');
  });

  it('marca o melhor da coluna com ★ e lista momentos quando houver', () => {
    expect(html).toContain('★');
    expect(html).toContain('Por atleta');
  });

  it('sem a2 (individual) não aparece "undefined" nem barra solta', () => {
    const solo: BtAnalise = { ...a, jogadores: { a1: 'A1', a2: '', b1: 'B1', b2: '' } };
    const h = gerarRelatorioPartidaHtml(solo, calcularEstatisticas(solo));
    expect(h).not.toContain('undefined');
    expect(h).not.toMatch(/ \/ <\/th>/);
  });
});

describe('PDF do atleta', () => {
  it('traz números, partidas e escapa os nomes', () => {
    const a = analiseComTiebreak({ A1: 'Ana', A2: 'Ari', B1: 'B<b>ia', B2: 'Beto' });
    const r = resumoDoAtleta([a], 'A1')!;
    const html = gerarRelatorioAtletaHtml(r, sugestoesDoAtleta(r), evolucaoDoAtleta(r), 'Tudo');
    expect(html).toContain('Análise do atleta — Ana');
    expect(html).toContain('1V · 0D');
    expect(html).toContain('B&lt;b&gt;ia');
    expect(html).not.toContain('B<b>ia');
  });
});
