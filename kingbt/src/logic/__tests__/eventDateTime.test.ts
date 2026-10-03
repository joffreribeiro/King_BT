import { maskDate, parseBrDate, maskTime, parseTime, todayLocal } from '@/logic/eventDateTime';

describe('data', () => {
  it('máscara aplica as barras enquanto digita', () => {
    expect(maskDate('3')).toBe('3');
    expect(maskDate('3009')).toBe('30/09');
    expect(maskDate('30092026')).toBe('30/09/2026');
    expect(maskDate('30/09/2026999')).toBe('30/09/2026');
  });
  it('só aceita data real do calendário', () => {
    expect(parseBrDate('30/09/2026')).toBe('2026-09-30');
    expect(parseBrDate('31/09/2026')).toBeNull();
    expect(parseBrDate('29/02/2027')).toBeNull();
    expect(parseBrDate('29/02/2028')).toBe('2028-02-29');
    expect(parseBrDate('30/09/26')).toBeNull();
    expect(parseBrDate('')).toBeNull();
  });
  it('hoje usa o fuso local, não UTC', () => {
    expect(todayLocal(new Date(2026, 8, 29, 23, 30))).toEqual({ iso: '2026-09-29', br: '29/09/2026' });
  });
});

describe('horário', () => {
  it('máscara e validação', () => {
    expect(maskTime('2000')).toBe('20:00');
    expect(maskTime('20')).toBe('20');
    expect(parseTime('20:00')).toBe('20:00');
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('20:60')).toBeNull();
    expect(parseTime('2:00')).toBeNull();
  });
});
