import { playerLevel, LEVELS } from '@/logic/playerLevel';

describe('playerLevel', () => {
  it('começa em Zangão I com 0 jogos', () => {
    expect(playerLevel(0)).toMatchObject({ name: 'Zangão I', index: 0, remaining: 5, progress: 0 });
  });
  it('progresso e jogos que faltam dentro do nível', () => {
    const l = playerLevel(32); // Operária II (25) → Operária III (35)
    expect(l.name).toBe('Operária II');
    expect(l.next).toEqual({ name: 'Operária III', min: 35 });
    expect(l.remaining).toBe(3);
    expect(l.progress).toBeCloseTo(0.7);
  });
  it('sobe exatamente no limite, inclusive entre as faixas (Zangão III → Operária I)', () => {
    expect(playerLevel(4).name).toBe('Zangão I');
    expect(playerLevel(5)).toMatchObject({ name: 'Zangão II', progress: 0 });
    expect(playerLevel(14).name).toBe('Zangão III');
    expect(playerLevel(15).name).toBe('Operária I');
  });
  it('nível máximo não tem próximo', () => {
    expect(playerLevel(9999)).toMatchObject({ name: 'Rainha III', next: null, progress: 1, remaining: 0 });
  });
  it('as faixas são crescentes e sem repetição', () => {
    LEVELS.forEach((l, i) => { if (i > 0) expect(l.min).toBeGreaterThan(LEVELS[i - 1].min); });
    expect(new Set(LEVELS.map(l => l.name)).size).toBe(LEVELS.length);
  });
  it('valores inválidos viram 0', () => {
    expect(playerLevel(NaN).name).toBe('Zangão I');
    expect(playerLevel(-5).name).toBe('Zangão I');
  });
});

describe('playerXp', () => {
  const { playerXp } = require('@/logic/playerLevel');
  it('sem nota do Radar, XP = jogos', () => {
    expect(playerXp(20)).toMatchObject({ xp: 20, games: 20, bonus: 0, radarAvg: null });
    expect(playerXp(20, {}, null).bonus).toBe(0);
  });
  it('bônus: 5 XP por ponto de média acima de 1', () => {
    expect(playerXp(10, { smash: 5 }).bonus).toBe(20);
    expect(playerXp(10, { smash: 10 }).bonus).toBe(45);
    expect(playerXp(10, { smash: 1 }).bonus).toBe(0);
    expect(playerXp(10, { smash: 5 }).xp).toBe(30);
  });
  it('junta autoavaliação e comunidade meio a meio; usa só a que existir', () => {
    expect(playerXp(0, { smash: 9 }, 5).radarAvg).toBe(7);
    expect(playerXp(0, undefined, 7).radarAvg).toBe(7);
    expect(playerXp(0, { smash: 9 }, null).radarAvg).toBe(9);
  });
  it('o XP muda de nível: jogos + bônus', () => {
    // 10 jogos + média 5 (20 XP) = 30 XP → Operária II (25)
    expect(playerLevel(playerXp(10, { smash: 5 }).xp).name).toBe('Operária II');
  });
});

import { DEFAULT_XP_CONFIG, validateXpConfig, achievementXp } from '@/logic/xpConfig';
import { playerXp as px } from '@/logic/playerLevel';
import { ACHIEVEMENTS } from '@/constants/achievements';

import { levelRows } from '@/logic/playerLevel';
describe('levelRows', () => {
  it('lista os 15 níveis marcando alcançados, atual e bloqueados', () => {
    const rows = levelRows(172); // Caçadora II (160)
    expect(rows).toHaveLength(15);
    expect(rows.filter(r => r.status === 'reached')).toHaveLength(10);
    expect(rows.find(r => r.status === 'current')).toMatchObject({ name: 'Caçadora II', min: 160, remaining: 0, tier: 'Caçadora' });
    expect(rows.filter(r => r.status === 'locked').map(r => r.name)).toEqual(['Caçadora III', 'Rainha I', 'Rainha II', 'Rainha III']);
  });
  it('remaining é quanto falta para cada nível ainda não alcançado', () => {
    const rows = levelRows(172);
    expect(rows.find(r => r.name === 'Caçadora III')!.remaining).toBe(38);
    expect(rows.find(r => r.name === 'Rainha III')!.remaining).toBe(528);
    expect(rows.find(r => r.name === 'Zangão I')!.remaining).toBe(0);
  });
  it('quem está começando está no primeiro nível', () => {
    const rows = levelRows(0);
    expect(rows[0].status).toBe('current');
    expect(rows.slice(1).every(r => r.status === 'locked')).toBe(true);
  });
});

describe('XP com vitórias, eventos, avaliações e conquistas', () => {
  it('soma cada fonte pelo valor do config', () => {
    const r = px(10, undefined, null, { wins: 6, events: 2, rated: 3, achievementXp: 12 });
    // 10 jogos×1 + 6 vitórias×1 + 2 eventos×3 + 3 avaliações×2 + 12
    expect(r).toMatchObject({ games: 10, winsXp: 6, eventsXp: 6, ratingXp: 6, achievementsXp: 12, xp: 40 });
  });
  it('o admin muda o valor de cada ação', () => {
    const cfg = { ...DEFAULT_XP_CONFIG, win: 5, game: 0 };
    expect(px(10, undefined, null, { wins: 4 }, cfg).xp).toBe(20);
  });
  it('validateXpConfig: ausente/inválido volta ao padrão, campo a campo', () => {
    expect(validateXpConfig(undefined)).toEqual(DEFAULT_XP_CONFIG);
    const v = validateXpConfig({ win: 7, game: -3, event: 'x', rarity: { mitica: 80, rara: 9999 } });
    expect(v.win).toBe(7);
    expect(v.game).toBe(DEFAULT_XP_CONFIG.game);
    expect(v.event).toBe(DEFAULT_XP_CONFIG.event);
    expect(v.rarity.mitica).toBe(80);
    expect(v.rarity.rara).toBe(DEFAULT_XP_CONFIG.rarity.rara);
  });
  it('conquistas desbloqueadas rendem XP pela raridade', () => {
    const base = { totalWins: 1, totalMatches: 1, currentStreak: 0, maxStreak: 0, currentRating: 0, champCount: 0, super8Wins: 0, ligaWins: 0, avulsoWins: 0, hatTrick: false, unbeatable: false, perfectPartner: false, sharesCount: 0 };
    const r = achievementXp(base);
    const first = ACHIEVEMENTS.find(a => a.id === 'first_win')!;
    expect(first.progress(base)).toBe(1);
    expect(r.unlocked).toBeGreaterThanOrEqual(1);
    expect(r.xp).toBeGreaterThanOrEqual(DEFAULT_XP_CONFIG.rarity.comum);
  });
});
