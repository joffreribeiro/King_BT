import { statPoints, gameAverage, compareRank, buildRanking } from '../scoring';
import { validateScoringConfig, DEFAULT_SCORING } from '../scoringConfig';
import { standings, competitionChampion, extractPlayerGames } from '../formats';
import type { Player, Match, Competition } from '../types';

// ─── Fórmula de pontos ──────────────────────────────────────────────────────

describe('statPoints — fórmula V×3 + J×0,5 + GA×2', () => {
  it('calcula pontos com GA', () => {
    // 2 vitórias, 3 jogos, 12 games pró x 6 contra → GA = 2
    // Pts = 2*3 + 3*0.5 + 2*2 = 6 + 1.5 + 4 = 11.5
    expect(statPoints({ played: 3, wins: 2, gamesPro: 12, gamesCon: 6 })).toBe(11.5);
  });

  it('GA satura em 9.99 quando não há games contra', () => {
    expect(gameAverage({ gamesPro: 5, gamesCon: 0 })).toBe(9.99);
    expect(gameAverage({ gamesPro: 0, gamesCon: 0 })).toBe(0);
  });

  it('usa coeficientes custom quando cfg é fornecido', () => {
    // cfg custom: V×5 + J×1 + GA×0 → só vitórias e jogos contam.
    // 2 vitórias, 3 jogos, GA irrelevante (coef 0) → 2*5 + 3*1 + 0 = 13
    const cfg = { winCoef: 5, playedCoef: 1, gaCoef: 0 };
    expect(statPoints({ played: 3, wins: 2, gamesPro: 12, gamesCon: 6 }, cfg)).toBe(13);
  });

  it('sem cfg mantém a fórmula padrão (retrocompatibilidade)', () => {
    const s = { played: 3, wins: 2, gamesPro: 12, gamesCon: 6 };
    expect(statPoints(s)).toBe(statPoints(s, { winCoef: 3, playedCoef: 0.5, gaCoef: 2 }));
  });
});

// ─── validateScoringConfig ──────────────────────────────────────────────────

describe('validateScoringConfig — saneamento de entrada', () => {
  it('aceita config válido', () => {
    expect(validateScoringConfig({ winCoef: 4, playedCoef: 1, gaCoef: 2 }))
      .toEqual({ winCoef: 4, playedCoef: 1, gaCoef: 2 });
  });

  it('rejeita negativo, NaN, string e fora do intervalo → fallback', () => {
    expect(validateScoringConfig({ winCoef: -1, playedCoef: 0.5, gaCoef: 2 })).toEqual(DEFAULT_SCORING);
    expect(validateScoringConfig({ winCoef: NaN, playedCoef: 0.5, gaCoef: 2 })).toEqual(DEFAULT_SCORING);
    expect(validateScoringConfig({ winCoef: '3', playedCoef: 0.5, gaCoef: 2 })).toEqual(DEFAULT_SCORING);
    expect(validateScoringConfig({ winCoef: 999, playedCoef: 0.5, gaCoef: 2 })).toEqual(DEFAULT_SCORING);
    expect(validateScoringConfig(null)).toEqual(DEFAULT_SCORING);
    expect(validateScoringConfig(undefined)).toEqual(DEFAULT_SCORING);
  });
});

// ─── buildRanking com cfg custom ────────────────────────────────────────────

describe('buildRanking — respeita cfg custom', () => {
  it('recalcula pontos com coeficientes alterados', () => {
    const players: Player[] = ['a', 'b'].map(id => ({ id, name: id, short: id, color: '#000' }));
    const games = [{ teamA: ['a'], teamB: ['b'], scoreA: 6, scoreB: 3 }];
    const cfg = { winCoef: 10, playedCoef: 0, gaCoef: 0 };
    const rk = buildRanking(players, games, cfg);
    const a = rk.find(r => r.id === 'a')!;
    // Só vitórias contam (×10): 1 vitória → 10 pontos.
    expect(a.points).toBe(10);
  });
});

// ─── Comparador de desempate ────────────────────────────────────────────────

describe('compareRank — ordem de desempate', () => {
  const noH2H = () => 0;
  const nameOf = (id: string) => id;
  const row = (id: string, p: Partial<{ points: number; sg: number; ga: number; wins: number }>) =>
    ({ id, points: 0, sg: 0, ga: 0, wins: 0, ...p });

  it('ordena por pontos primeiro', () => {
    expect(compareRank(row('a', { points: 10 }), row('b', { points: 8 }), noH2H, nameOf)).toBeLessThan(0);
  });

  it('empate em pontos → confronto direto', () => {
    const h2h = (x: string) => (x === 'a' ? -1 : 1); // a venceu b
    expect(compareRank(row('a', { points: 5 }), row('b', { points: 5 }), h2h, nameOf)).toBeLessThan(0);
  });

  it('empate em pontos e h2h → saldo de games', () => {
    expect(compareRank(row('a', { points: 5, sg: 3 }), row('b', { points: 5, sg: 1 }), noH2H, nameOf)).toBeLessThan(0);
  });

  it('desempate final alfabético (pt-BR)', () => {
    expect(compareRank(row('ana', {}), row('bruno', {}), noH2H, nameOf)).toBeLessThan(0);
  });
});

// ─── buildRanking: handicap NÃO afeta mais os pontos ────────────────────────

describe('buildRanking — handicap removido do cálculo', () => {
  const mkPlayer = (id: string, handicap: number): Player =>
    ({ id, name: id, short: id, color: '#000', handicap });

  it('pontos são crus (statPoints), independentes do handicap', () => {
    const players = [mkPlayer('forte', 3), mkPlayer('fraco', -3)];
    // Mesmos jogos/resultados para ambos, contra um sparring neutro sem handicap.
    const games = [
      { teamA: ['forte'], teamB: ['spar'], scoreA: 6, scoreB: 3 },
      { teamA: ['fraco'], teamB: ['spar'], scoreA: 6, scoreB: 3 },
    ];
    const allPlayers = [...players, mkPlayer('spar', 0)];
    const rk = buildRanking(allPlayers, games);
    const forte = rk.find(r => r.id === 'forte')!;
    const fraco = rk.find(r => r.id === 'fraco')!;
    // Sem handicap: mesmos resultados ⇒ mesmos pontos crus.
    const esperado = statPoints({ played: 1, wins: 1, gamesPro: 6, gamesCon: 3 });
    expect(forte.points).toBeCloseTo(esperado, 5);
    expect(fraco.points).toBeCloseTo(esperado, 5);
    expect(forte.points).toBeCloseTo(fraco.points, 5);
  });
});

// ─── standings: exercita cada critério de desempate ─────────────────────────

describe('standings — classificação de competição', () => {
  const mkMatch = (id: string, a: string, b: string, sA: number, sB: number): Match =>
    ({ id, stage: 'league', aId: a, bId: b, aSrc: null, bSrc: null, scoreA: sA, scoreB: sB });

  it('ordena por pontos e aplica desempate por confronto direto', () => {
    // a e b vencem 1 cada contra c; a vence b no confronto direto.
    const ids = ['a', 'b', 'c'];
    const matches = [
      mkMatch('m1', 'a', 'c', 6, 2),
      mkMatch('m2', 'b', 'c', 6, 2),
      mkMatch('m3', 'a', 'b', 6, 4),
    ];
    const st = standings(ids, matches);
    expect(st.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });
});

// ─── competitionChampion: super8/avulso ─────────────────────────────────────

describe('competitionChampion — avulso/super8', () => {
  const mkComp = (matches: Match[]): Competition => ({
    id: 'c1',
    name: 'Teste',
    format: 'super8',
    unit: 'individual',
    gender: 'misto',
    status: 'active',
    date: '2026-01-01',
    config: { rounds: 'single', groups: 1, qualifiers: 1, thirdPlace: false, winRule: {} },
    competitors: [
      { id: 'a', name: 'a', short: 'a', color: '#000', members: ['a'] },
      { id: 'b', name: 'b', short: 'b', color: '#000', members: ['b'] },
      { id: 'c', name: 'c', short: 'c', color: '#000', members: ['c'] },
    ],
    matches,
  });

  it('elege quem tem mais pontos', () => {
    const matches: Match[] = [
      { id: 'm1', stage: 'rotating', teamA: ['a'], teamB: ['b'], aId: null, bId: null, aSrc: null, bSrc: null, scoreA: 6, scoreB: 1 },
      { id: 'm2', stage: 'rotating', teamA: ['a'], teamB: ['c'], aId: null, bId: null, aSrc: null, bSrc: null, scoreA: 6, scoreB: 2 },
      { id: 'm3', stage: 'rotating', teamA: ['b'], teamB: ['c'], aId: null, bId: null, aSrc: null, bSrc: null, scoreA: 6, scoreB: 4 },
    ];
    const champ = competitionChampion(mkComp(matches));
    expect(champ?.id).toBe('a');
  });
});

// ─── Equivalência: caminho unificado (buildRanking + extractPlayerGames) ─────
// vs. o cálculo manual que existia antes na UI (FormatViews/AvulsoView).

describe('buildRanking + extractPlayerGames ≡ cálculo antigo da UI', () => {
  const mkComp = (matches: Match[], competitorIds: string[]): Competition => ({
    id: 'c1', name: 'T', format: 'super8', unit: 'individual', gender: 'misto',
    status: 'active', date: '2026-01-01',
    config: { rounds: 'single', groups: 1, qualifiers: 1, thirdPlace: false, winRule: {} },
    competitors: competitorIds.map(id => ({ id, name: id, short: id, color: '#000', members: [id] })),
    matches,
  });

  // Oráculo: cópia fiel do bloco que existia em FormatViews/AvulsoView.
  const legacyRanking = (comp: Competition) => {
    const playerIds = [...new Set(comp.matches.flatMap(m => [...(m.teamA ?? []), ...(m.teamB ?? [])]))];
    return playerIds.map(pid => {
      let wins = 0, losses = 0, gf = 0, gc = 0;
      comp.matches.forEach(m => {
        if (m.scoreA == null || m.scoreA === m.scoreB) return;
        const inA = m.teamA?.includes(pid), inB = m.teamB?.includes(pid);
        const gA = m.sets?.length ? m.sets.reduce((s, x) => s + x.a, 0) : m.scoreA!;
        const gB = m.sets?.length ? m.sets.reduce((s, x) => s + x.b, 0) : m.scoreB!;
        if (inA) { gf += gA; gc += gB; if (m.scoreA! > m.scoreB!) wins++; else losses++; }
        if (inB) { gf += gB; gc += gA; if (m.scoreB! > m.scoreA!) wins++; else losses++; }
      });
      const played = wins + losses;
      const ga = gc > 0 ? Math.min(9.99, gf / gc) : gf > 0 ? 9.99 : 0;
      const pts = wins * 3 + played * 0.5 + ga * 2;
      return { pid, wins, losses, played, gf, gc, pts };
    }).sort((a, b) => b.pts - a.pts);
  };

  const mkMatch = (id: string, a: string[], b: string[], sA: number, sB: number): Match =>
    ({ id, stage: 'rotating', teamA: a, teamB: b, aId: null, bId: null, aSrc: null, bSrc: null, scoreA: sA, scoreB: sB });

  it('produz a mesma ordem e os mesmos pontos (individual)', () => {
    const matches = [
      mkMatch('m1', ['a'], ['b'], 6, 1),
      mkMatch('m2', ['a'], ['c'], 6, 2),
      mkMatch('m3', ['b'], ['c'], 6, 4),
      mkMatch('m4', ['b'], ['a'], 6, 3),
    ];
    const comp = mkComp(matches, ['a', 'b', 'c']);
    const legacy = legacyRanking(comp);
    const players: Player[] = ['a', 'b', 'c'].map(id => ({ id, name: id, short: id, color: '#000' }));
    const novo = buildRanking(players, extractPlayerGames(comp));

    expect(novo.map(r => r.id)).toEqual(legacy.map(r => r.pid));
    novo.forEach((r, i) => {
      // buildRanking arredonda points a 2 casas; o cálculo antigo mantinha o
      // valor bruto e só formatava na exibição (.toFixed(2)). O que o usuário vê
      // é idêntico — comparamos, portanto, o valor exibido.
      expect(r.points.toFixed(2)).toBe(legacy[i].pts.toFixed(2));
      expect(r.wins).toBe(legacy[i].wins);
      expect(r.losses).toBe(legacy[i].losses);
      expect(r.gamesPro).toBe(legacy[i].gf);
      expect(r.gamesCon).toBe(legacy[i].gc);
    });
  });
});
