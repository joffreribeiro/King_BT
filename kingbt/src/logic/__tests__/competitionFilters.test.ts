import { matchesStatus, filterBeforeStatus, countByStatus } from '../competitionFilters';
import type { Format } from '../types';

type C = { name: string; format: Format; status: 'upcoming' | 'setup' | 'active' | 'done'; isFriendly?: boolean };
const c = (name: string, format: Format, status: C['status'], isFriendly?: boolean): C => ({ name, format, status, isFriendly });

const lista: C[] = [
  c('Copa de Sábado', 'liga', 'upcoming'),
  c('Super 8 Outubro', 'super8', 'active'),
  c('Liga da Quadra 3', 'liga', 'setup'),
  c('Mata-mata de Verão', 'mata', 'done'),
  c('Liga 2025', 'liga', 'done'),
  c('Jogo rápido de hoje', 'avulso', 'active', true),
];

describe('matchesStatus', () => {
  it('"todas" aceita qualquer status', () => {
    for (const s of ['upcoming', 'setup', 'active', 'done'] as const) expect(matchesStatus({ status: s }, 'all')).toBe(true);
  });
  it('"em andamento" inclui as que ainda estão sendo montadas (setup)', () => {
    expect(matchesStatus({ status: 'active' }, 'active')).toBe(true);
    expect(matchesStatus({ status: 'setup' }, 'active')).toBe(true);
    expect(matchesStatus({ status: 'upcoming' }, 'active')).toBe(false);
    expect(matchesStatus({ status: 'done' }, 'active')).toBe(false);
  });
  it('agendadas e encerradas só aceitam o próprio status', () => {
    expect(matchesStatus({ status: 'upcoming' }, 'upcoming')).toBe(true);
    expect(matchesStatus({ status: 'setup' }, 'upcoming')).toBe(false);
    expect(matchesStatus({ status: 'done' }, 'done')).toBe(true);
    expect(matchesStatus({ status: 'active' }, 'done')).toBe(false);
  });
});

describe('filterBeforeStatus', () => {
  it('tira a sessão avulsa do Jogo Rápido', () => {
    const r = filterBeforeStatus(lista, { format: 'all', search: '' });
    expect(r.map(x => x.name)).not.toContain('Jogo rápido de hoje');
    expect(r).toHaveLength(5);
  });
  it('filtra por formato', () => {
    expect(filterBeforeStatus(lista, { format: 'liga', search: '' }).map(x => x.name))
      .toEqual(['Copa de Sábado', 'Liga da Quadra 3', 'Liga 2025']);
  });
  it('busca por nome sem diferenciar maiúsculas e ignorando espaços nas pontas', () => {
    expect(filterBeforeStatus(lista, { format: 'all', search: '  LIGA ' }).map(x => x.name))
      .toEqual(['Liga da Quadra 3', 'Liga 2025']);
  });
  it('formato e busca valem juntos', () => {
    expect(filterBeforeStatus(lista, { format: 'liga', search: '2025' }).map(x => x.name)).toEqual(['Liga 2025']);
    expect(filterBeforeStatus(lista, { format: 'mata', search: 'liga' })).toEqual([]);
  });
});

describe('countByStatus', () => {
  it('conta cada status, com setup somando em andamento', () => {
    const base = filterBeforeStatus(lista, { format: 'all', search: '' });
    expect(countByStatus(base)).toEqual({ all: 5, upcoming: 1, active: 2, done: 2 });
  });
  it('a contagem respeita o formato e a busca (é o que a pessoa verá ao escolher o status)', () => {
    const base = filterBeforeStatus(lista, { format: 'liga', search: '' });
    expect(countByStatus(base)).toEqual({ all: 3, upcoming: 1, active: 1, done: 1 });
  });
  it('em cada status, a contagem bate com o tamanho da lista filtrada', () => {
    const base = filterBeforeStatus(lista, { format: 'all', search: 'liga' });
    const n = countByStatus(base);
    for (const k of ['all', 'upcoming', 'active', 'done'] as const) {
      expect(base.filter(x => matchesStatus(x, k))).toHaveLength(n[k]);
    }
  });
  it('lista vazia dá tudo zero', () => {
    expect(countByStatus([])).toEqual({ all: 0, upcoming: 0, active: 0, done: 0 });
  });
});
