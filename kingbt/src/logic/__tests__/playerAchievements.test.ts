import { computeBadges } from '../badges';
import { computeAchievementStats } from '../achievementStats';
import {
  computeChampCount, computeHatTrick, computeUnbeatableMonth, computePerfectPartner,
} from '../playerAchievements';
import type { Competition, Match } from '../types';

// badges.ts e achievementStats.ts calculavam campCount/hatTrick/unbeatable/
// perfectPartner com código quase idêntico, copiado e colado — o risco real
// era corrigir uma regra num dos dois e esquecer do outro, fazendo badges e
// conquistas divergirem silenciosamente. Agora os dois chamam a mesma lógica
// em playerAchievements.ts; este teste prova que continuam de acordo.

function mkComp(id: string, matches: Match[], status: Competition['status'] = 'done'): Competition {
  return {
    id, name: id, format: 'avulso', unit: 'duplas', gender: 'misto',
    status, date: '2026-01-01',
    config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: {} },
    competitors: [
      { id: 'ana', name: 'Ana', short: 'ANA', color: '#000', members: ['ana'] },
      { id: 'bruno', name: 'Bruno', short: 'BRU', color: '#000', members: ['bruno'] },
    ],
    matches,
  } as unknown as Competition;
}

describe('badges e achievementStats concordam (mesma lógica compartilhada)', () => {
  it('hat-trick: 3 vitórias numa competição — os dois batem', () => {
    const comps = [mkComp('c1', [
      { id: 'm1', stage: 'rotating', teamA: ['ana'], teamB: ['bruno'], scoreA: 6, scoreB: 2 },
      { id: 'm2', stage: 'rotating', teamA: ['ana'], teamB: ['bruno'], scoreA: 6, scoreB: 3 },
      { id: 'm3', stage: 'rotating', teamA: ['ana'], teamB: ['bruno'], scoreA: 6, scoreB: 1 },
    ] as unknown as Match[])];

    expect(computeHatTrick(comps, 'ana')).toBe(true);
    expect(computeBadges('ana', comps).find(b => b.id === 'hat_trick')?.unlocked).toBe(true);
    expect(computeAchievementStats(comps, 'ana').hatTrick).toBe(true);
  });

  it('campeão: champCount bate entre computeChampCount, badges e achievementStats', () => {
    const comps = [mkComp('c1', [
      { id: 'm1', stage: 'rotating', teamA: ['ana'], teamB: ['bruno'], scoreA: 6, scoreB: 2 },
    ] as unknown as Match[])];

    const direto = computeChampCount(comps, 'ana');
    const viaBadges = computeBadges('ana', comps).find(b => b.id === 'champion')?.unlocked;
    const viaStats = computeAchievementStats(comps, 'ana').champCount;

    expect(direto).toBeGreaterThan(0);
    expect(viaBadges).toBe(true);
    expect(viaStats).toBe(direto);
  });

  it('imbatível do mês: 3+ jogos, todos vencidos — os dois concordam', () => {
    const comps = [mkComp('c1', [
      { id: 'm1', stage: 'rotating', teamA: ['ana'], teamB: ['bruno'], scoreA: 6, scoreB: 1 },
      { id: 'm2', stage: 'rotating', teamA: ['ana'], teamB: ['bruno'], scoreA: 6, scoreB: 2 },
      { id: 'm3', stage: 'rotating', teamA: ['ana'], teamB: ['bruno'], scoreA: 6, scoreB: 3 },
    ] as unknown as Match[])];

    expect(computeUnbeatableMonth(comps, 'ana')).toBe(true);
    expect(computeBadges('ana', comps).find(b => b.id === 'unbeatable')?.unlocked).toBe(true);
    expect(computeAchievementStats(comps, 'ana').unbeatable).toBe(true);
  });

  it('um empate no mês quebra o "imbatível" nos dois (empate não é vitória)', () => {
    const comps = [mkComp('c1', [
      { id: 'm1', stage: 'rotating', teamA: ['ana'], teamB: ['bruno'], scoreA: 6, scoreB: 1 },
      { id: 'm2', stage: 'rotating', teamA: ['ana'], teamB: ['bruno'], scoreA: 6, scoreB: 2 },
      { id: 'm3', stage: 'rotating', teamA: ['ana'], teamB: ['bruno'], scoreA: 4, scoreB: 4 }, // empate
    ] as unknown as Match[])];

    expect(computeUnbeatableMonth(comps, 'ana')).toBe(false);
    expect(computeBadges('ana', comps).find(b => b.id === 'unbeatable')?.unlocked).toBe(false);
    expect(computeAchievementStats(comps, 'ana').unbeatable).toBe(false);
  });

  it('parceiro perfeito: 5+ jogos, 80%+ de aproveitamento — os dois concordam', () => {
    const jogosComParceiro = Array.from({ length: 5 }, (_, i) => ({
      id: `m${i}`, stage: 'rotating', teamA: ['ana', 'carla'], teamB: ['bruno', 'duda'],
      scoreA: i === 0 ? 4 : 6, scoreB: i === 0 ? 6 : 3, // 4 vitórias em 5 (80%)
    })) as unknown as Match[];
    const comps = [mkComp('c1', jogosComParceiro)];

    expect(computePerfectPartner(comps, 'ana')).toBe(true);
    expect(computeBadges('ana', comps).find(b => b.id === 'perfect_partner')?.unlocked).toBe(true);
    expect(computeAchievementStats(comps, 'ana').perfectPartner).toBe(true);
  });
});
