jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { esc, safeColor } from '../html';
import { generateRankingHtml } from '../rankingHtml';
import { gerarRelatorioTreinoHtml } from '../exportRelatorio';
import { novoTreino, calcularAnaliseTreino } from '../btTreino';
import type { RankedPlayer } from '../scoring';
import type { PlayerInfo } from '../types';

const MAL = '<img src=x onerror=alert(1)>';

describe('esc', () => {
  it('escapa tags, aspas e &', () => {
    expect(esc(`<b>Ana & "Bia" 'C'</b>`)).toBe('&lt;b&gt;Ana &amp; &quot;Bia&quot; &#39;C&#39;&lt;/b&gt;');
  });
  it('aceita número, null e undefined', () => {
    expect(esc(7)).toBe('7');
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});

describe('safeColor', () => {
  it('aceita hex válido', () => {
    expect(safeColor('#fff')).toBe('#fff');
    expect(safeColor('#F3C544')).toBe('#F3C544');
    expect(safeColor('#F3C54480')).toBe('#F3C54480');
  });
  it('troca por padrão qualquer coisa que possa sair do atributo style', () => {
    expect(safeColor('red;background:url(http://x)')).toBe('#555555');
    expect(safeColor('"><script>')).toBe('#555555');
    expect(safeColor(undefined)).toBe('#555555');
    expect(safeColor(42)).toBe('#555555');
    expect(safeColor('javascript:1', '#000000')).toBe('#000000');
  });
});

describe('HTML do ranking com dados hostis', () => {
  const player = (id: string, name: string, color: string): PlayerInfo => ({ id, name, short: name.slice(0, 3), color } as PlayerInfo);
  const rank = (id: string, i: number): RankedPlayer => ({
    id, wins: 1, losses: 0, played: 1, gamesPro: 6, gamesCon: 0, sg: 6, ga: 9.99, points: 10 - i, name: id,
  } as unknown as RankedPlayer);

  it('não deixa nome, local, grupo, data nem cor virarem HTML', () => {
    const players = [player('a', MAL, 'red;x:url(y)'), player('b', 'Bia', '#2DD4BF'), player('c', 'Cris', '#F3C544')];
    const html = generateRankingHtml(
      players.map((p, i) => rank(p.id, i)), players, MAL, MAL, 3, MAL, MAL,
    );
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('onerror=alert(1)>');
    expect(html).not.toContain('red;x:url(y)');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('HTML do relatório de treino com dados hostis', () => {
  it('escapa nome do jogador e título', () => {
    const treino = novoTreino('g', 'p', MAL);
    const html = gerarRelatorioTreinoHtml(treino, calcularAnaliseTreino(treino), MAL);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
