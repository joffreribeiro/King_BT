import {
  addDaysIso, nextName, seriesDates, seriesNames, formFromCompetition, competitionsFromForm, competitionFromForm,
  emptyForm, createLabel, missingFields, type NewCompForm,
} from '@/logic/competitionPlan';
import type { Competition } from '@/logic/types';

const base = (): Competition => ({
  id: 'c1', name: '12ª Rodada — BT na Quadra — 15/09', format: 'super8', unit: 'duplas', gender: 'misto',
  status: 'done', date: '2026-09-15', time: '20:00', location: 'BT na Quadra', notes: 'Trazer bola',
  config: { rounds: 'single', groups: 2, qualifiers: 2, thirdPlace: false, useOfficialRules: true,
    winRule: { sets: 1, games: 6, tiebreak: 7, tiebreakAt: 'deuce', superTiebreak: false, superTiebreakPts: 10 },
    scoring: { winPts: 4, gdPts: 2, tiebreak: 'vitorias' } },
  competitors: [], matches: [], levelCategory: 'B', vagas: 8,
  registration: { mode: 'open', waitlist: false, cancelHoursBefore: 6, opensAt: '2026-09-10T09:00' },
});

describe('datas e nomes', () => {
  it('addDaysIso passa de mês e de ano', () => {
    expect(addDaysIso('2026-09-30', 7)).toBe('2026-10-07');
    expect(addDaysIso('2026-12-29', 7)).toBe('2027-01-05');
    expect(addDaysIso('2028-02-26', 7)).toBe('2028-03-04');
  });
  it('nextName troca a data e soma o ordinal', () => {
    expect(nextName('12ª Rodada — BT na Quadra — 15/09', '2026-09-15', '2026-09-22')).toBe('13ª Rodada — BT na Quadra — 22/09');
    expect(nextName('Super 8 · 15/09', '2026-09-15', '2026-09-22')).toBe('Super 8 · 22/09');
    expect(nextName('Torneio 15/09/2026', '2026-09-15', '2026-09-22')).toBe('Torneio 22/09/2026');
  });
  it('sem data nem ordinal, acrescenta a data', () => {
    expect(nextName('Super 8 de sábado', '2026-09-15', '2026-09-22')).toBe('Super 8 de sábado · 22/09');
  });
  it('seriesNames: nome sem marca ganha a data em todas; com ordinal, conta junto', () => {
    const d = seriesDates('2026-10-10', 3);
    expect(d).toEqual(['2026-10-10', '2026-10-17', '2026-10-24']);
    expect(seriesNames('Super 8 de sábado', d)).toEqual(['Super 8 de sábado · 10/10', 'Super 8 de sábado · 17/10', 'Super 8 de sábado · 24/10']);
    expect(seriesNames('5ª Rodada', d)).toEqual(['5ª Rodada', '6ª Rodada', '7ª Rodada']);
  });
  it('seriesDates limita a 12 semanas', () => { expect(seriesDates('2026-10-10', 99)).toHaveLength(12); });
});

describe('formFromCompetition', () => {
  it('copia as configurações e leva a data para a semana seguinte', () => {
    const f = formFromCompetition(base());
    expect(f).toMatchObject({
      name: '13ª Rodada — BT na Quadra — 22/09', format: 'super8', unit: 'duplas', gender: 'misto', level: 'B',
      dateText: '22/09/2026', timeText: '20:00', location: 'BT na Quadra', notes: 'Trazer bola',
      registrationOn: true, vagasText: '8', noLimit: false, waitlist: false, cancelHoursText: '6',
      scheduleOpen: true, opensDateText: '17/09/2026', opensTimeText: '09:00',
      winPts: '4', gdPts: '2', tiebreak: 'vitorias', officialRules: true, countsForRanking: true,
    });
    expect(f.presetIndex).not.toBeNull();
    expect(missingFields(f)).toEqual([]);
  });
  it('o formulário gera uma competição equivalente', () => {
    const c = competitionFromForm(formFromCompetition(base()), 'p1');
    expect(c).toMatchObject({ format: 'super8', unit: 'duplas', date: '2026-09-22', levelCategory: 'B', vagas: 8, createdBy: 'p1' });
    expect(c.config.winRule).toMatchObject({ sets: 1, games: 6, tiebreak: 7 });
    expect(c.registration).toMatchObject({ waitlist: false, cancelHoursBefore: 6, opensAt: '2026-09-17T09:00' });
  });
  it('regra de placar fora dos presets vira "manual"', () => {
    const c = base(); c.config.winRule = { sets: 3, games: 5, tiebreak: 9, superTiebreak: true, superTiebreakPts: 12 };
    const f = formFromCompetition(c);
    expect(f).toMatchObject({ presetIndex: null, manual: true, sets: 3, games: 5, tiebreakPts: 9, superTiebreak: true, superTiebreakPts: 12 });
  });
  it('competição amistosa e sem inscrições continuam assim', () => {
    const c = base(); c.countsForRanking = false; delete c.registration; delete c.vagas; c.status = 'active';
    const f = formFromCompetition(c);
    expect(f.countsForRanking).toBe(false);
    expect(f.registrationOn).toBe(false);
  });
});

describe('série semanal', () => {
  const filled = (over: Partial<NewCompForm> = {}): NewCompForm => ({ ...formFromCompetition(base()), ...over });
  it('repeatWeeks 1: uma competição só', () => { expect(competitionsFromForm(filled())).toHaveLength(1); });
  it('cria N competições com datas, nomes e abertura deslocados', () => {
    const list = competitionsFromForm(filled({ repeatWeeks: 3 }));
    expect(list.map(c => c.date)).toEqual(['2026-09-22', '2026-09-29', '2026-10-06']);
    expect(list.map(c => c.name)).toEqual(['13ª Rodada — BT na Quadra — 22/09', '14ª Rodada — BT na Quadra — 29/09', '15ª Rodada — BT na Quadra — 06/10']);
    expect(list.map(c => c.registration?.opensAt)).toEqual(['2026-09-17T09:00', '2026-09-24T09:00', '2026-10-01T09:00']);
    expect(new Set(list.map(c => c.id)).size).toBe(3);
  });
  it('o botão mostra a série', () => {
    expect(createLabel(filled({ repeatWeeks: 4 }))).toBe('Criar série de 4 competições e abrir inscrições');
    expect(createLabel(emptyForm())).toBe('Criar competição');
  });
});
