import {
  parseAnnouncements, newAnnouncement, validateAnnouncement, isActive, visibleAnnouncements, withAnnouncement,
  ANNOUNCEMENT_TEXT_MAX, ANNOUNCEMENT_TITLE_MAX, ANNOUNCEMENTS_MAX, type Announcement,
} from '@/logic/announcements';

const NOW = new Date('2026-10-10T12:00:00Z');
const A = (over: Partial<Announcement> = {}): Announcement => ({ id: 'a1', text: 'Jogo cancelado', date: '2026-10-10T10:00:00.000Z', ...over });

describe('newAnnouncement', () => {
  it('limpa os campos e calcula a validade', () => {
    const a = newAnnouncement({ title: '  Chuva ', text: '  Jogo de sábado cancelado ', validityDays: 3, pinned: true }, 'uid1', NOW)!;
    expect(a).toMatchObject({ title: 'Chuva', text: 'Jogo de sábado cancelado', pinned: true, by: 'uid1', date: NOW.toISOString(), expiresAt: '2026-10-13T12:00:00.000Z' });
    expect(a.id).toMatch(/^a/);
  });
  it('sem prazo, sem título e sem fixar: não grava os campos (Firestore recusa undefined)', () => {
    const a = newAnnouncement({ text: 'Oi', validityDays: null }, null, NOW)!;
    expect('title' in a).toBe(false);
    expect('expiresAt' in a).toBe(false);
    expect('pinned' in a).toBe(false);
    expect('by' in a).toBe(false);
  });
  it('recusa mensagem vazia ou grande e título grande', () => {
    expect(newAnnouncement({ text: '   ', validityDays: 7 })).toBeNull();
    expect(validateAnnouncement('', 'x'.repeat(ANNOUNCEMENT_TEXT_MAX + 1))).toMatch(/até 280/);
    expect(validateAnnouncement('x'.repeat(ANNOUNCEMENT_TITLE_MAX + 1), 'ok')).toMatch(/até 60/);
    expect(validateAnnouncement('', 'ok')).toBeNull();
  });
});

describe('parse e ordem', () => {
  it('ignora lixo; fixados primeiro, depois os mais recentes', () => {
    const list = parseAnnouncements([
      A({ id: 'velho', date: '2026-10-01T00:00:00Z' }), null, 'x', { id: 'sem texto' },
      A({ id: 'novo', date: '2026-10-09T00:00:00Z' }), A({ id: 'fix', pinned: true, date: '2026-09-01T00:00:00Z' }),
    ]);
    expect(list.map(a => a.id)).toEqual(['fix', 'novo', 'velho']);
    expect(parseAnnouncements(undefined)).toEqual([]);
  });
});

describe('vigência e Home', () => {
  it('expira no prazo; sem prazo vale sempre', () => {
    expect(isActive(A({ expiresAt: '2026-10-11T00:00:00Z' }), NOW)).toBe(true);
    expect(isActive(A({ expiresAt: '2026-10-09T00:00:00Z' }), NOW)).toBe(false);
    expect(isActive(A(), NOW)).toBe(true);
  });
  it('visibleAnnouncements: esconde expirados e dispensados, mas nunca os fixados', () => {
    const list = [
      A({ id: 'ok' }), A({ id: 'exp', expiresAt: '2026-10-01T00:00:00Z' }), A({ id: 'dis' }),
      A({ id: 'pin', pinned: true }), A({ id: 'pin2', pinned: true, expiresAt: '2026-10-01T00:00:00Z' }),
    ];
    expect(visibleAnnouncements(list, ['dis', 'pin'], NOW).map(a => a.id).sort()).toEqual(['ok', 'pin']);
  });
  it('limita quantos aparecem de uma vez', () => {
    const list = Array.from({ length: 6 }, (_, i) => A({ id: `x${i}`, date: `2026-10-0${i + 1}T00:00:00Z` }));
    expect(visibleAnnouncements(list, [], NOW)).toHaveLength(3);
    expect(visibleAnnouncements(list, [], NOW, 10)).toHaveLength(6);
  });
});

describe('withAnnouncement', () => {
  it('acrescenta no topo e respeita o limite, tirando os mais antigos não fixados', () => {
    const many = Array.from({ length: ANNOUNCEMENTS_MAX }, (_, i) => A({ id: `o${i}`, date: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z` }));
    const fix = A({ id: 'fix', pinned: true, date: '2025-01-01T00:00:00Z' });
    const out = withAnnouncement([fix, ...many.slice(1)], A({ id: 'novo', date: '2026-10-10T00:00:00Z' }));
    expect(out).toHaveLength(ANNOUNCEMENTS_MAX);
    expect(out[0].id).toBe('fix');
    expect(out.some(a => a.id === 'novo')).toBe(true);
    expect(out.some(a => a.id === 'o1')).toBe(false); // o mais antigo não fixado saiu
  });
});
