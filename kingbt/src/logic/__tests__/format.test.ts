import { formatRating, formatRelativeDate } from '@/logic/format';

describe('formatRating', () => {
  it('sempre mostra 2 casas com vírgula, mesmo com 1 casa ou inteiro', () => {
    expect(formatRating(8.5)).toBe('8,50');
    expect(formatRating(8.469)).toBe('8,47');
    expect(formatRating(9)).toBe('9,00');
  });
});

describe('formatRelativeDate', () => {
  const NOW = new Date('2026-09-21T12:00:00');
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('hoje/ontem/dias/semanas', () => {
    expect(formatRelativeDate(new Date('2026-09-21T09:00:00'))).toBe('Hoje');
    expect(formatRelativeDate(new Date('2026-09-20T09:00:00'))).toBe('Ontem');
    expect(formatRelativeDate(new Date('2026-09-18T09:00:00'))).toBe('Há 3 dias');
    expect(formatRelativeDate(new Date('2026-09-07T09:00:00'))).toBe('Há 2 sem.');
  });

  it('cai para data curta sem ponto final além de 30 dias', () => {
    const result = formatRelativeDate(new Date('2026-01-05T09:00:00'));
    expect(result).not.toMatch(/\.$/);
  });
});
