import { parseHeight, formatHeight, parseBirthday, ageFromBirthday, isoToBr, parseSince, practiceTime, cleanAbout, CATEGORIES } from '@/logic/playerAbout';

describe('playerAbout', () => {
  it('categorias na ordem da lista do Atlas', () => {
    expect([...CATEGORIES]).toEqual(['Open', 'A', 'B', 'C', 'D', 'Iniciante']);
  });
  it('altura aceita vírgula ou ponto e limita 1,00–2,50', () => {
    expect(parseHeight('1,78')).toBe(1.78);
    expect(parseHeight('1.8')).toBe(1.8);
    expect(parseHeight('178')).toBeNull();
    expect(parseHeight('0,9')).toBeNull();
    expect(parseHeight('')).toBeNull();
    expect(formatHeight(1.8)).toBe('1,80');
    expect(formatHeight(undefined)).toBe('');
  });
  it('aniversário: data real, não futura, de 1920 em diante', () => {
    const now = new Date(2026, 8, 29);
    expect(parseBirthday('15/03/1990', now)).toBe('1990-03-15');
    expect(parseBirthday('15/03/1900', now)).toBeNull();
    expect(parseBirthday('30/09/2026', now)).toBeNull();
    expect(parseBirthday('31/04/1990', now)).toBeNull();
  });
  it('idade pelo aniversário: só conta o ano depois do dia', () => {
    const now = new Date(2026, 8, 29);
    expect(ageFromBirthday('1990-09-29', now)).toBe(36);
    expect(ageFromBirthday('1990-09-30', now)).toBe(35);
    expect(ageFromBirthday('1990-10-01', now)).toBe(35);
    expect(ageFromBirthday(undefined, now)).toBeNull();
  });
  it('data de início: real e não futura', () => {
    const now = new Date(2026, 8, 29);
    expect(parseSince('15/03/2022', now)).toBe('2022-03-15');
    expect(parseSince('30/09/2026', now)).toBeNull();
    expect(parseSince('31/02/2022', now)).toBeNull();
    expect(isoToBr('2022-03-15')).toBe('15/03/2022');
    expect(isoToBr(undefined)).toBe('');
  });
  it('tempo de prática', () => {
    const now = new Date(2026, 8, 29);
    expect(practiceTime('2023-07-10', now)).toBe('3 anos e 2 meses');
    expect(practiceTime('2026-01-29', now)).toBe('8 meses');
    expect(practiceTime('2025-09-29', now)).toBe('1 ano');
    expect(practiceTime('2026-09-20', now)).toBe('menos de 1 mês');
    expect(practiceTime(undefined, now)).toBeNull();
  });
  it('cleanAbout descarta vazios', () => {
    expect(cleanAbout({ birthday: '1990-03-15', hand: 'destro', category: undefined })).toEqual({ birthday: '1990-03-15', hand: 'destro' });
  });
});
