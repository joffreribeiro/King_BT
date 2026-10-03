import { filterAthletes, categoryCounts, type AthleteRow } from '@/logic/athletes';

const row = (id: string, name: string, position: number, category?: any): AthleteRow =>
  ({ id, name, color: '#000', guest: false, category, position, points: 0, played: position ? 3 : 0 });

const rows = [
  row('1', 'Zé Carlos', 2, 'C'),
  row('2', 'Ana Souza', 0, 'B'),
  row('3', 'Álvaro Dias', 1, 'C'),
  row('4', 'Beto', 0),
];

describe('filterAthletes', () => {
  it('A–Z ignora acento e maiúscula', () => {
    expect(filterAthletes(rows, { category: 'todas', query: '', sort: 'az' }).map(r => r.name))
      .toEqual(['Álvaro Dias', 'Ana Souza', 'Beto', 'Zé Carlos']);
  });
  it('ranking: quem tem posição primeiro; sem jogos no fim, em ordem alfabética', () => {
    expect(filterAthletes(rows, { category: 'todas', query: '', sort: 'ranking' }).map(r => r.id))
      .toEqual(['3', '1', '2', '4']);
  });
  it('filtra por categoria e por nome', () => {
    expect(filterAthletes(rows, { category: 'C', query: '', sort: 'az' }).map(r => r.id)).toEqual(['3', '1']);
    expect(filterAthletes(rows, { category: 'todas', query: 'alvaro', sort: 'az' }).map(r => r.id)).toEqual(['3']);
    expect(filterAthletes(rows, { category: 'B', query: 'zé', sort: 'az' })).toEqual([]);
  });
  it('não altera a lista original', () => {
    const copy = [...rows];
    filterAthletes(rows, { category: 'todas', query: '', sort: 'az' });
    expect(rows).toEqual(copy);
  });
  it('contagem por categoria', () => {
    expect(categoryCounts(rows)).toEqual({ todas: 4, C: 2, B: 1 });
  });
});
