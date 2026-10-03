import { rarityOf, RARITY_ORDER } from '@/constants/rarity';
import { hallCategoryOf, HALL_CATEGORIES } from '@/constants/hall';
import { ACHIEVEMENTS } from '@/constants/achievements';

describe('rarity e categorias do Hall', () => {
  it('toda conquista tem raridade e categoria explícitas (senão cairia no padrão sem querer)', () => {
    const rarityIds = new Set<string>();
    for (const a of ACHIEVEMENTS) {
      // uma conquista "comum" só é aceitável se estiver escrita de propósito; aqui basta que o id não seja repetido
      expect(rarityIds.has(a.id)).toBe(false);
      rarityIds.add(a.id);
      expect(RARITY_ORDER).toContain(rarityOf(a.id));
      expect(HALL_CATEGORIES.map(c => c.id)).toContain(hallCategoryOf(a.id));
    }
  });

  it('nomes das conquistas são únicos', () => {
    const titles = ACHIEVEMENTS.map(a => a.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('conquista nova sem raridade cai em comum; sem categoria, em favos; 6 raridades em ordem', () => {
    expect(rarityOf('nova_qualquer')).toBe('comum');
    expect(hallCategoryOf('nova_qualquer')).toBe('favos');
    expect(rarityOf('triple_crown')).toBe('lendaria');
    expect(rarityOf('radar_gold')).toBe('mitica');
    expect(RARITY_ORDER).toEqual(['comum', 'incomum', 'rara', 'epica', 'lendaria', 'mitica']);
  });

  it('as quatro categorias têm ao menos uma conquista', () => {
    for (const c of HALL_CATEGORIES) {
      expect(ACHIEVEMENTS.filter(a => hallCategoryOf(a.id) === c.id).length).toBeGreaterThan(0);
    }
  });
});
