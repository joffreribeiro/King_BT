import {
  suggestGroups, groupSizes, groupPhaseGames, estimateGames, minutesPerGame, durationMinutes, fmtMin,
  planWarnings, emptyForm, missingFields, competitionFromForm, createLabel, levelAllows, registrationGate,
  canCancelRegistration, applySetup, closeRegistration, usedLocations, serializeDraft, parseDraft,
  suggestedName, unitText, setupBlockers, setupWarnings, winRuleOf, competitorsFromPlayers, shuffled,
  type NewCompForm,
} from '../competitionPlan';
import { applyRegister } from '../eventRegistration';
import type { Competition } from '../types';

const filled = (over: Partial<NewCompForm> = {}): NewCompForm => ({
  ...emptyForm(),
  name: 'Torneio', format: 'liga', unit: 'individual', gender: 'misto', level: 'Aberta',
  dateText: '10/10/2026', presetIndex: 0, ...over,
});

const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `Jogador ${i}`, color: '#fff' }));

describe('suggestGroups', () => {
  it('11 inscritos: 3 grupos, 2 classificados e os 2 melhores 3ºs (8 no mata-mata)', () => {
    expect(suggestGroups(11)).toEqual({ groups: 3, qualifiers: 2, bestThirds: 2 });
  });
  it('poucos inscritos: grupos de 2 classificam só 1', () => {
    expect(suggestGroups(4)).toEqual({ groups: 2, qualifiers: 1, bestThirds: 0 });
  });
  it('já potência de 2: sem melhores 3ºs', () => {
    expect(suggestGroups(8)).toEqual({ groups: 2, qualifiers: 2, bestThirds: 0 });
    expect(suggestGroups(16)).toEqual({ groups: 4, qualifiers: 2, bestThirds: 0 });
  });
  it('limita a 8 grupos', () => {
    expect(suggestGroups(60).groups).toBe(8);
  });
  it('nunca sugere mais 3ºs do que grupos', () => {
    for (let n = 4; n <= 48; n++) {
      const s = suggestGroups(n);
      expect(s.bestThirds).toBeLessThanOrEqual(s.groups);
      expect(Math.floor(n / s.groups)).toBeGreaterThanOrEqual(s.qualifiers);
    }
  });
});

describe('estimativas', () => {
  it('tamanho dos grupos e jogos da fase de grupos', () => {
    expect(groupSizes(11, 3)).toEqual([4, 4, 3]);
    expect(groupPhaseGames(11, 3, false)).toBe(15);
    expect(groupPhaseGames(11, 3, true)).toBe(30);
  });
  it('jogos por formato', () => {
    expect(estimateGames('liga', 'individual', 6)).toBe(15);
    expect(estimateGames('liga', 'individual', 6, true)).toBe(30);
    expect(estimateGames('mata', 'individual', 8)).toBe(7);
    expect(estimateGames('grupos', 'individual', 11)).toBe(22);
    expect(estimateGames('super8', 'individual', 8)).toBe(28);
    expect(estimateGames('super8', 'duplas', 8)).toBe(14);
    expect(estimateGames('avulso', null, 8)).toBeNull();
    expect(estimateGames(null, null, 8)).toBeNull();
    expect(estimateGames('liga', 'individual', 0)).toBeNull();
  });
  it('minutos por preset e por sets no modo manual', () => {
    expect(minutesPerGame({ presetIndex: 0, manual: false, sets: null })).toBe(15);
    expect(minutesPerGame({ presetIndex: 8, manual: false, sets: null })).toBe(50);
    expect(minutesPerGame({ presetIndex: null, manual: true, sets: 1 })).toBe(20);
    expect(minutesPerGame({ presetIndex: null, manual: true, sets: 3 })).toBe(45);
    expect(minutesPerGame({ presetIndex: null, manual: true, sets: 5 })).toBe(70);
    expect(minutesPerGame({ presetIndex: null, manual: false, sets: null })).toBeNull();
  });
  it('duração com quadras em paralelo e formatação', () => {
    expect(durationMinutes(15, 15, 2)).toBe(120);
    expect(durationMinutes(15, 15, 0)).toBe(225);
    expect(fmtMin(120)).toBe('2 h');
    expect(fmtMin(135)).toBe('2 h 15');
    expect(fmtMin(45)).toBe('45 min');
  });
  it('avisos de poucos competidores e de grupos com menos de 6', () => {
    expect(planWarnings('liga', 3)).toHaveLength(1);
    expect(planWarnings('grupos', 3)).toHaveLength(2);
    expect(planWarnings('grupos', 5)).toHaveLength(1);
    expect(planWarnings('grupos', 12)).toHaveLength(0);
    expect(planWarnings('avulso', 2)).toHaveLength(0);
  });
});

describe('validação dos obrigatórios', () => {
  it('formulário vazio: nada vem marcado e falta tudo', () => {
    const f = emptyForm();
    expect(f.format).toBeNull();
    expect(f.unit).toBeNull();
    expect(f.gender).toBeNull();
    expect(f.level).toBeNull();
    expect(f.presetIndex).toBeNull();
    expect(f.registrationOn).toBe(false);
    expect(f.countsForRanking).toBe(true);
    expect(missingFields(f)).toEqual(['nome', 'tipo de competição', 'competem em', 'gênero', 'categoria de nível', 'data', 'formato de disputa']);
  });
  it('completo não falta nada', () => {
    expect(missingFields(filled())).toEqual([]);
  });
  it('disputa manual precisa de sets', () => {
    expect(missingFields(filled({ presetIndex: null, manual: true, sets: null }))).toEqual(['formato de disputa']);
    expect(missingFields(filled({ presetIndex: null, manual: true, sets: 3 }))).toEqual([]);
  });
  it('com inscrições, horário e vagas (ou sem limite) viram obrigatórios', () => {
    expect(missingFields(filled({ registrationOn: true }))).toEqual(['horário', 'vagas ou "sem limite"']);
    expect(missingFields(filled({ registrationOn: true, timeText: '20:00', vagasText: '8' }))).toEqual([]);
    expect(missingFields(filled({ registrationOn: true, timeText: '20:00', noLimit: true }))).toEqual([]);
  });
  it('data inválida conta como faltando', () => {
    expect(missingFields(filled({ dateText: '31/02/2026' }))).toEqual(['data']);
  });
  it('rótulo do botão muda conforme o caso', () => {
    expect(createLabel(filled())).toBe('Criar competição');
    expect(createLabel(filled({ registrationOn: true }))).toBe('Criar e abrir inscrições');
    expect(createLabel(filled({ format: 'avulso' }))).toBe('Criar sessão avulsa');
  });
});

describe('competitionFromForm', () => {
  it('sem inscrições: vai para "setup" (ou ativa, no avulso) e traz o preset', () => {
    const c = competitionFromForm(filled({ format: 'grupos', presetIndex: 6 }), 'u1');
    expect(c.status).toBe('setup');
    expect(c.matches).toEqual([]);
    expect(c.competitors).toEqual([]);
    expect(c.config.winRule).toMatchObject({ sets: 3, games: 4, tiebreak: 7, superTiebreak: true, superTiebreakPts: 10 });
    expect(c.levelCategory).toBe('Aberta');
    expect(c.date).toBe('2026-10-10');
    expect(c.confirmedIds).toBeUndefined();
    expect(competitionFromForm(filled({ format: 'avulso' })).status).toBe('active');
  });
  it('com inscrições: agenda, guarda vagas e regras de inscrição', () => {
    const c = competitionFromForm(filled({
      registrationOn: true, timeText: '19:30', vagasText: '12', waitlist: false, cancelHoursText: '6',
      scheduleOpen: true, opensDateText: '01/10/2026', opensTimeText: '08:00', level: 'B',
    }), 'u1');
    expect(c.status).toBe('upcoming');
    expect(c.vagas).toBe(12);
    expect(c.time).toBe('19:30');
    expect(c.levelCategory).toBe('B');
    expect(c.registration).toEqual({ mode: 'open', waitlist: false, cancelHoursBefore: 6, opensAt: '2026-10-01T08:00' });
    expect(c.confirmedIds).toEqual(['u1']);
  });
  it('sem limite de vagas não grava vagas', () => {
    const c = competitionFromForm(filled({ registrationOn: true, timeText: '19:30', noLimit: true }), null);
    expect(c.vagas).toBeUndefined();
    expect(c.confirmedIds).toEqual([]);
  });
  it('amistosa só grava o campo quando desligado', () => {
    expect('countsForRanking' in competitionFromForm(filled())).toBe(false);
    expect(competitionFromForm(filled({ countsForRanking: false })).countsForRanking).toBe(false);
  });
  it('configuração por formato', () => {
    expect(competitionFromForm(filled({ format: 'super8', winPts: '4', gdPts: '2' })).config.scoring).toMatchObject({ winPts: 4, gdPts: 2 });
    expect(competitionFromForm(filled({ format: 'liga', drawPts: '2' })).config.scoring).toMatchObject({ winPts: 3, drawPts: 2 });
    expect(competitionFromForm(filled({ format: 'mata', thirdPlace: true })).config.thirdPlace).toBe(true);
    expect(competitionFromForm(filled({ format: 'liga', thirdPlace: true })).config.thirdPlace).toBe(false);
    expect(competitionFromForm(filled({ format: 'avulso' })).config.scoring).toBeUndefined();
  });
  it('disputa manual: super tie-break só vale com mais de 1 set', () => {
    expect(winRuleOf(filled({ presetIndex: null, manual: true, sets: 1, superTiebreak: true })).superTiebreak).toBe(false);
    expect(winRuleOf(filled({ presetIndex: null, manual: true, sets: 3, superTiebreak: true, games: 6 }))).toMatchObject({ sets: 3, games: 6, superTiebreak: true });
  });
});

describe('nome sugerido e textos', () => {
  it('formato + dia/mês', () => {
    expect(suggestedName('super8', '2026-10-10')).toBe('Super 8 · 10/10');
    expect(suggestedName('grupos', null)).toBe('Grupos + Eliminatórias');
    expect(suggestedName(null, '2026-10-10')).toBeNull();
  });
  it('a frase de "competem em" muda por formato', () => {
    expect(unitText('super8', 'duplas')).toMatch(/rotativas/);
    expect(unitText('super8', 'individual')).toMatch(/1 contra 1/);
    expect(unitText('liga', 'duplas')).toMatch(/fixas/);
    expect(unitText('liga', 'individual')).toMatch(/por conta própria/);
    expect(unitText('liga', null)).toBe('');
  });
});

describe('categoria de nível e inscrições', () => {
  it('Aberta libera todos; categoria específica só a do perfil', () => {
    expect(levelAllows('Aberta', undefined)).toBe(true);
    expect(levelAllows(undefined, 'A')).toBe(true);
    expect(levelAllows('B', 'B')).toBe(true);
    expect(levelAllows('B', 'C')).toBe(false);
    expect(levelAllows('B', undefined)).toBe(false);
  });
  const base = { status: 'upcoming' as const, vagas: undefined, confirmedIds: [] as string[] };
  it('bloqueia inscrição de categoria diferente com mensagem útil', () => {
    const g = registrationGate({ ...base, levelCategory: 'B' }, 'C');
    expect(g.ok).toBe(false);
    expect(!g.ok && g.reason).toMatch(/categoria B/);
    expect(registrationGate({ ...base, levelCategory: 'B' }, 'B').ok).toBe(true);
    expect(registrationGate({ ...base, levelCategory: 'Aberta' }, undefined).ok).toBe(true);
  });
  it('competições antigas (sem campos novos) continuam abertas', () => {
    expect(registrationGate(base, undefined).ok).toBe(true);
  });
  it('modo fechado, só admin e abertura agendada', () => {
    expect(registrationGate({ ...base, registration: { mode: 'closed' } }, 'A').ok).toBe(false);
    expect(registrationGate({ ...base, registration: { mode: 'adminOnly' } }, 'A').ok).toBe(false);
    const sched = { ...base, registration: { opensAt: '2026-10-10T08:00' } };
    expect(registrationGate(sched, 'A', new Date('2026-10-09T10:00:00')).ok).toBe(false);
    expect(registrationGate(sched, 'A', new Date('2026-10-10T08:01:00')).ok).toBe(true);
  });
  it('fora de "upcoming" não dá para se inscrever', () => {
    expect(registrationGate({ ...base, status: 'setup' }, 'A').ok).toBe(false);
  });
  it('prazo de cancelamento', () => {
    const c = { date: '2026-10-10', time: '20:00', registration: { cancelHoursBefore: 10 } };
    expect(canCancelRegistration(c, new Date('2026-10-10T09:00:00'))).toBe(true);
    expect(canCancelRegistration(c, new Date('2026-10-10T11:00:00'))).toBe(false);
    expect(canCancelRegistration({ date: '2026-10-10' }, new Date('2030-01-01'))).toBe(true);
  });
  it('sem lista de espera, lotado não entra na fila', () => {
    const s = { confirmedIds: ['a', 'b'], waitlistIds: [], vagas: 2 };
    expect(applyRegister(s, 'c', { waitlist: false }).outcome).toBe('full');
    expect(applyRegister(s, 'c').outcome).toBe('espera');
  });
});

describe('locais usados', () => {
  it('ordena por frequência e depois por recência, sem repetir', () => {
    const comps = [
      { location: 'Arena', date: '2026-01-01' }, { location: 'Clube', date: '2026-03-01' },
      { location: 'Arena', date: '2026-02-01' }, { location: ' ', date: '2026-04-01' }, { date: '2026-05-01' },
      { location: 'Praia', date: '2026-09-01' },
    ];
    expect(usedLocations(comps)).toEqual(['Arena', 'Praia', 'Clube']);
    expect(usedLocations(comps, 1)).toEqual(['Arena']);
  });
});

describe('rascunho', () => {
  it('ida e volta preserva o formulário', () => {
    const f = filled({ location: 'Arena', registrationOn: true, vagasText: '8' });
    const r = parseDraft(serializeDraft(f, new Date('2026-10-02T12:34:00Z')));
    expect(r?.form).toEqual(f);
    expect(r?.savedAt.toISOString()).toBe('2026-10-02T12:34:00.000Z');
  });
  it('lixo ou versão desconhecida vira null; campos inválidos voltam ao padrão', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('{')).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 2, form: {} }))).toBeNull();
    const r = parseDraft(JSON.stringify({ v: 1, savedAt: 'x', form: { format: 'xyz', name: 5, unit: 'duplas' } }));
    expect(r?.form.format).toBeNull();
    expect(r?.form.name).toBe('');
    expect(r?.form.unit).toBe('duplas');
  });
});

describe('montar: grupos, chave e jogos', () => {
  const comp = (format: Competition['format'], n: number, over: Partial<Competition> = {}): Competition => {
    const pl = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Jogador ${i}`, color: '#fff' }));
    return {
      ...competitionFromForm(filled({ format, thirdPlace: false }), null),
      competitors: competitorsFromPlayers(pl.map(p => p.id), pl),
      ...over,
    };
  };
  const o = { rounds: 'single' as const, groups: 2, qualifiers: 2, bestThirds: 0, distribution: 'auto' as const };

  it('liga: turno único e ida e volta', () => {
    expect(applySetup(comp('liga', 6), o).matches).toHaveLength(15);
    expect(applySetup(comp('liga', 6), { ...o, rounds: 'double' }).matches).toHaveLength(30);
    expect(applySetup(comp('liga', 6), o).status).toBe('active');
  });
  it('grupos: jogos da fase + mata-mata, e guarda a configuração escolhida', () => {
    const r = applySetup(comp('grupos', 8), o);
    expect(r.groupDefs).toHaveLength(2);
    expect(r.matches.filter(m => m.stage === 'group')).toHaveLength(12);
    expect(r.matches.filter(m => m.stage === 'ko')).toHaveLength(3);
    expect(r.config).toMatchObject({ groups: 2, qualifiers: 2, bestThirds: 0 });
  });
  it('grupos com melhores 3ºs completam o chaveamento', () => {
    const r = applySetup(comp('grupos', 11), { ...o, groups: 3, bestThirds: 2 });
    expect(r.matches.filter(m => m.stage === 'group')).toHaveLength(15);
    expect(r.matches.filter(m => m.stage === 'ko')).toHaveLength(7);
  });
  it('mata-mata sorteia a chave e usa todos os competidores', () => {
    const r = applySetup(comp('mata', 8), { ...o, rng: () => 0.3 });
    const firstRound = r.matches.filter(m => m.koRound === 0);
    const ids = firstRound.flatMap(m => [m.aId, m.bId]);
    expect(new Set(ids).size).toBe(8);
    expect(r.matches).toHaveLength(7);
  });
  it('por ranking: o melhor e o pior se enfrentam na 1ª rodada', () => {
    const r = applySetup(comp('mata', 8), { ...o, distribution: 'ranking', rankingOrder: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] });
    const first = r.matches.find(m => m.koRound === 0 && (m.aId === 'p0' || m.bId === 'p0'))!;
    expect([first.aId, first.bId]).toContain('p7');
  });
  it('distribuição manual respeita os grupos escolhidos', () => {
    const r = applySetup(comp('grupos', 6), { ...o, distribution: 'manual', manualGroups: [['p0', 'p1', 'p2'], ['p3', 'p4', 'p5']] });
    expect(r.groupDefs?.map(g => g.ids)).toEqual([['p0', 'p1', 'p2'], ['p3', 'p4', 'p5']]);
  });
  it('bloqueios e avisos', () => {
    expect(setupBlockers('liga', 1, o)).toHaveLength(1);
    expect(setupBlockers('grupos', 3, o)).toHaveLength(1);
    expect(setupBlockers('grupos', 8, o)).toEqual([]);
    expect(setupBlockers('grupos', 8, { ...o, distribution: 'manual', manualGroups: [['a'], ['b', 'c']] })).toHaveLength(1);
    expect(setupWarnings('grupos', 5, o).join(' ')).toMatch(/menos de 6/);
    expect(setupWarnings('grupos', 8, { ...o, groups: 3, qualifiers: 2, bestThirds: 0 }).join(' ')).toMatch(/potência de 2/);
    expect(setupWarnings('grupos', 8, { ...o, bestThirds: 3 }).join(' ')).toMatch(/3ºs/);
  });
  it('shuffled mantém os elementos', () => {
    expect([...shuffled([1, 2, 3, 4], () => 0.5)].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('fechar inscrições', () => {
  const base = (format: Competition['format'], unit: Competition['unit'] = 'individual'): Competition => ({
    ...competitionFromForm(filled({ format, unit, registrationOn: true, timeText: '20:00', noLimit: true }), null),
    confirmedIds: players.map(p => p.id),
  });
  it('liga/grupos/mata individuais vão para "setup" já com os competidores', () => {
    const c = closeRegistration(base('grupos'), players);
    expect(c.status).toBe('setup');
    expect(c.competitors).toHaveLength(8);
    expect(c.matches).toEqual([]);
  });
  it('duplas fixas ficam em "setup" sem competidores (as duplas são formadas depois)', () => {
    const c = closeRegistration(base('liga', 'duplas'), players);
    expect(c.status).toBe('setup');
    expect(c.competitors).toEqual([]);
  });
  it('super 8 já gera os jogos', () => {
    const duplas = closeRegistration(base('super8', 'duplas'), players);
    expect(duplas.status).toBe('active');
    expect(duplas.matches.length).toBeGreaterThan(0);
    expect(duplas.matches[0].teamA).toHaveLength(2);
    const indiv = closeRegistration(base('super8', 'individual'), players);
    expect(indiv.matches).toHaveLength(28);
  });
  it('avulso só ativa', () => {
    const c = closeRegistration(base('avulso'), players);
    expect(c.status).toBe('active');
    expect(c.matches).toEqual([]);
  });
});
