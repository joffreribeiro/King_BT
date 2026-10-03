import { parseHonors, newHonor, validateHonor, honorsOf, HONOR_TITLE_MAX, HONOR_NOTE_MAX, DEFAULT_HONOR_ICON } from '@/logic/honors';

describe('honors', () => {
  it('newHonor limpa os campos e preenche id, data e autor', () => {
    const h = newHonor({ playerId: 'p1', title: '  Fair Play ', icon: '🤝', note: '  Ajudou o time adversário  ' }, 'uid1', new Date('2026-10-02T12:00:00Z'))!;
    expect(h).toMatchObject({ playerId: 'p1', title: 'Fair Play', icon: '🤝', note: 'Ajudou o time adversário', date: '2026-10-02T12:00:00.000Z', by: 'uid1' });
    expect(h.id).toMatch(/^h/);
  });
  it('sem emoji usa o padrão; sem observação não grava o campo (Firestore recusa undefined)', () => {
    const h = newHonor({ playerId: 'p1', title: 'Garra' })!;
    expect(h.icon).toBe(DEFAULT_HONOR_ICON);
    expect('note' in h).toBe(false);
    expect('by' in h).toBe(false);
  });
  it('recusa título vazio/grande, observação grande e jogador ausente', () => {
    expect(newHonor({ playerId: 'p1', title: '   ' })).toBeNull();
    expect(newHonor({ playerId: '', title: 'Garra' })).toBeNull();
    expect(validateHonor('x'.repeat(HONOR_TITLE_MAX + 1), '')).toMatch(/até 40/);
    expect(validateHonor('Garra', 'x'.repeat(HONOR_NOTE_MAX + 1))).toMatch(/até 140/);
    expect(validateHonor('Garra', '')).toBeNull();
  });
  it('parseHonors ignora lixo e ordena da mais recente para a mais antiga', () => {
    const raw = [
      { id: 'a', playerId: 'p1', title: 'Antiga', icon: '🏅', date: '2026-09-01T00:00:00Z' },
      null, 'x', { id: 'b' }, { id: 'c', playerId: 'p2', title: '   ', date: '2026-10-01' },
      { id: 'd', playerId: 'p2', title: 'Nova', icon: '', note: ' ok ', date: '2026-10-01T00:00:00Z' },
    ];
    const list = parseHonors(raw);
    expect(list.map(h => h.id)).toEqual(['d', 'a']);
    expect(list[0]).toMatchObject({ icon: DEFAULT_HONOR_ICON, note: 'ok' });
    expect(parseHonors(undefined)).toEqual([]);
    expect(parseHonors('lixo')).toEqual([]);
  });
  it('honorsOf filtra por jogador', () => {
    const list = parseHonors([
      { id: 'a', playerId: 'p1', title: 'A', date: '2026-10-01' }, { id: 'b', playerId: 'p2', title: 'B', date: '2026-10-02' },
    ]);
    expect(honorsOf(list, 'p1').map(h => h.id)).toEqual(['a']);
  });
});

import { honorFeedItems, HONOR_FEED_MAX } from '@/logic/honors';
import { playerXp } from '@/logic/playerLevel';
import { DEFAULT_XP_CONFIG } from '@/logic/xpConfig';

describe('honraria no feed e no XP', () => {
  const hs = [
    { id: 'h2', playerId: 'a', title: 'Fair Play', icon: '🤝', note: 'Sempre leal.', date: '2026-10-10T10:00:00.000Z' },
    { id: 'h1', playerId: 'ghost', title: 'Garra', icon: '💪', date: '2026-10-09T10:00:00.000Z' },
    { id: 'h0', playerId: 'a', title: 'Sem data', icon: '🏅', date: '' },
  ];
  it('vira card com nome e observação; ignora jogador desconhecido e honraria sem data', () => {
    const items = honorFeedItems(hs, id => (id === 'a' ? 'Ana' : ''));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'honor_h2', playerName: 'Ana', title: 'Fair Play', desc: 'Ana recebeu a honraria Fair Play. Sempre leal.' });
  });
  it('limita aos mais recentes', () => {
    const many = Array.from({ length: HONOR_FEED_MAX + 5 }, (_, i) => ({ id: 'x' + i, playerId: 'a', title: 'T', icon: '🏅', date: '2026-10-10T10:00:00.000Z' }));
    expect(honorFeedItems(many, () => 'Ana')).toHaveLength(HONOR_FEED_MAX);
  });
  it('cada honraria soma XP, pelo valor configurado', () => {
    const none = playerXp(0, undefined, null, {}, DEFAULT_XP_CONFIG);
    const two = playerXp(0, undefined, null, { honors: 2 }, DEFAULT_XP_CONFIG);
    expect(two.honorsXp).toBe(2 * DEFAULT_XP_CONFIG.honor);
    expect(two.xp - none.xp).toBe(2 * DEFAULT_XP_CONFIG.honor);
    expect(playerXp(0, undefined, null, { honors: 2 }, { ...DEFAULT_XP_CONFIG, honor: 0 }).xp).toBe(none.xp);
  });
});
