import { statPoints, gameAverage, compareRank, buildRanking, type PlayerGame } from '../scoring';
import { validateScoringConfig, DEFAULT_SCORING } from '../scoringConfig';
import { standings, competitionChampion, extractPlayerGames, resolveCompetition } from '../formats';
import { computeBadges } from '../badges';
import { computeAchievementStats } from '../achievementStats';
import { matchGames } from '../setOutcome';
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
      .toEqual({ winCoef: 4, playedCoef: 1, gaCoef: 2, eventCoef: 0 });
  });

  it('aceita eventCoef explícito', () => {
    expect(validateScoringConfig({ winCoef: 4, playedCoef: 1, gaCoef: 2, eventCoef: 5 }))
      .toEqual({ winCoef: 4, playedCoef: 1, gaCoef: 2, eventCoef: 5 });
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
    const games: PlayerGame[] = [{ teamA: ['a'], teamB: ['b'], gamesA: 6, gamesB: 3, winner: 'A' }];
    const cfg = { winCoef: 10, playedCoef: 0, gaCoef: 0 };
    const rk = buildRanking(players, games, cfg);
    const a = rk.find(r => r.id === 'a')!;
    // Só vitórias contam (×10): 1 vitória → 10 pontos.
    expect(a.points).toBe(10);
  });

  it('bônus de eventos conta competições distintas, não jogos', () => {
    const players: Player[] = ['a', 'b', 'c'].map(id => ({ id, name: id, short: id, color: '#000' }));
    // 'a' joga 2 partidas na MESMA competição (c1) + 1 em outra (c2) → 2 eventos.
    // 'b' joga só em c1 (2 partidas) → 1 evento (prova que conta competição, não jogo).
    const games: PlayerGame[] = [
      { teamA: ['a'], teamB: ['b'], gamesA: 6, gamesB: 1, winner: 'A', compId: 'c1' },
      { teamA: ['a'], teamB: ['b'], gamesA: 6, gamesB: 1, winner: 'A', compId: 'c1' },
      { teamA: ['a'], teamB: ['c'], gamesA: 6, gamesB: 1, winner: 'A', compId: 'c2' },
    ];
    const cfg = { winCoef: 0, playedCoef: 0, gaCoef: 0, eventCoef: 10 };
    const rk = buildRanking(players, games, cfg);
    expect(rk.find(r => r.id === 'a')!.points).toBe(20); // 2 eventos × 10
    expect(rk.find(r => r.id === 'b')!.points).toBe(10); // 1 evento × 10 (jogou 2x no mesmo)
    expect(rk.find(r => r.id === 'c')!.points).toBe(10); // 1 evento × 10
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
    const games: PlayerGame[] = [
      { teamA: ['forte'], teamB: ['spar'], gamesA: 6, gamesB: 3, winner: 'A' },
      { teamA: ['fraco'], teamB: ['spar'], gamesA: 6, gamesB: 3, winner: 'A' },
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

// ─── Regressão: vencedor vem dos sets, nunca da soma de games ───────────────
// Antes desta correção o ranking decidia o vencedor pela soma dos games, o que
// invertia o resultado quando o vencedor em sets somava menos games, e apagava
// o jogo inteiro quando os games empatavam.

describe('extractPlayerGames — vencedor pelo placar da partida', () => {
  const mkComp = (sets: { a: number; b: number }[], scoreA: number, scoreB: number): Competition => ({
    id: 'c1', name: 'x', format: 'avulso', unit: 'duplas', gender: 'misto',
    status: 'done', date: '2026-01-01',
    // superTiebreak: false — este bloco testa a vitória em SETS. Sem isso o 3º
    // set de um 1-1 seria lido como super tie-break (o default é true) e
    // contaria 1-0 em vez dos games realmente disputados.
    config: {
      rounds: 'single', groups: 1, qualifiers: 1, thirdPlace: false,
      winRule: { sets: 3, games: 6, tiebreak: 7, superTiebreak: false },
    },
    competitors: [],
    matches: [{ id: 'm1', stage: 'rotating', scoreA, scoreB, sets, teamA: ['p1'], teamB: ['p2'] }],
  });
  const players: Player[] = [
    { id: 'p1', name: 'A', short: 'A', color: '#fff' },
    { id: 'p2', name: 'B', short: 'B', color: '#000' },
  ];

  it('vitória em sets com MENOS games totais ainda é vitória', () => {
    // 7-6, 0-6, 7-6 → p1 vence por 2x1 em sets, mas soma 14 games contra 18.
    const games = extractPlayerGames(mkComp([{ a: 7, b: 6 }, { a: 0, b: 6 }, { a: 7, b: 6 }], 2, 1));
    expect(games).toHaveLength(1);
    expect(games[0].winner).toBe('A');
    expect(games[0].gamesA).toBe(14);
    expect(games[0].gamesB).toBe(18);

    const rk = buildRanking(players, games);
    expect(rk.find(r => r.id === 'p1')!.wins).toBe(1);
    expect(rk.find(r => r.id === 'p2')!.wins).toBe(0);
    expect(rk.find(r => r.id === 'p2')!.losses).toBe(1);
  });

  it('games empatados não apagam o jogo do ranking', () => {
    // 6-4, 3-6, 7-6 → p1 vence por 2x1, games 16 a 16.
    const games = extractPlayerGames(mkComp([{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 7, b: 6 }], 2, 1));
    expect(games[0].gamesA).toBe(games[0].gamesB);
    expect(games[0].winner).toBe('A');

    const rk = buildRanking(players, games);
    expect(rk.find(r => r.id === 'p1')!.played).toBe(1);
    expect(rk.find(r => r.id === 'p2')!.played).toBe(1);
    expect(rk.find(r => r.id === 'p1')!.wins).toBe(1);
  });

  it('super tie-break gravado 0-0 não descarta a partida', () => {
    // Set decisivo em super tie-break entra como 0-0 no detalhe set a set
    // (ver btTracker); a partida continua valendo pelo placar em sets.
    const games = extractPlayerGames(mkComp([{ a: 4, b: 0 }, { a: 0, b: 4 }, { a: 0, b: 0 }], 2, 1));
    expect(games[0].winner).toBe('A');
    const rk = buildRanking(players, games);
    expect(rk.find(r => r.id === 'p1')!.wins).toBe(1);
    expect(rk.find(r => r.id === 'p1')!.played).toBe(1);
  });

  it('partida sem vencedor definido (sets empatados) fica de fora', () => {
    const games = extractPlayerGames(mkComp([{ a: 6, b: 4 }, { a: 4, b: 6 }], 1, 1));
    expect(games).toHaveLength(0);
  });
});

describe('buildRanking — confronto direto usa o vencedor da partida', () => {
  it('h2h conta a vitória em sets, não quem somou mais games', () => {
    const players: Player[] = ['a', 'b'].map(id => ({ id, name: id, short: id, color: '#000' }));
    // Mesmos pontos para os dois; 'a' venceu o confronto direto somando menos games.
    const games: PlayerGame[] = [
      { teamA: ['a'], teamB: ['b'], gamesA: 14, gamesB: 18, winner: 'A' },
      { teamA: ['b'], teamB: ['a'], gamesA: 18, gamesB: 14, winner: 'B' },
    ];
    const cfg = { winCoef: 0, playedCoef: 0, gaCoef: 0 };
    const rk = buildRanking(players, games, cfg);
    expect(rk[0].id).toBe('a');
  });

  // compareRank usava confronto direto DENTRO do comparator geral do sort —
  // mas H2H não é transitivo: com A>B, B>C e C>A (um ciclo), não existe "o
  // melhor" por H2H, e um comparator que finge que existe quebra a
  // invariante que Array.sort espera, podendo devolver ordens diferentes
  // pra mesma entrada dependendo só da ordem em que os itens chegaram.
  it('empate em pontos com H2H em ciclo (A>B, B>C, C>A): ordem é determinística e não depende da entrada', () => {
    const players: Player[] = ['a', 'b', 'c'].map(id => ({ id, name: id, short: id, color: '#000' }));
    const cfg = { winCoef: 1, playedCoef: 0, gaCoef: 0 }; // só vitórias pontuam
    // Cada um ganha 1 e perde 1 → mesmos pontos, mesmo SG (0), mesmo GA — só
    // o H2H (que forma um ciclo) poderia desempatar, e não consegue.
    const gamesFwd: PlayerGame[] = [
      { teamA: ['a'], teamB: ['b'], gamesA: 6, gamesB: 4, winner: 'A' }, // a > b
      { teamA: ['b'], teamB: ['c'], gamesA: 6, gamesB: 4, winner: 'A' }, // b > c
      { teamA: ['c'], teamB: ['a'], gamesA: 6, gamesB: 4, winner: 'A' }, // c > a
    ];
    const rkFwd = buildRanking(players, gamesFwd, cfg);
    // Mesmos jogos, ordem de entrada embaralhada — deve dar a MESMA ordem.
    const gamesShuffled = [gamesFwd[2], gamesFwd[0], gamesFwd[1]];
    const rkShuffled = buildRanking([...players].reverse(), gamesShuffled, cfg);

    expect(rkFwd.map(r => r.id)).toEqual(rkShuffled.map(r => r.id));
    // Sem H2H pra desempatar o ciclo, cai no critério seguinte — como todos
    // empatam em tudo, o desempate final é alfabético: a, b, c.
    expect(rkFwd.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });
});

// ─── matchGames: super tie-break não vira games ─────────────────────────────

describe('matchGames — super tie-break conta 1-0, não os pontos', () => {
  const STB_RULE = { sets: 3, games: 4, tiebreak: 7, superTiebreak: true, superTiebreakPts: 10 };

  it('set marcado com stb conta 1-0 para o vencedor', () => {
    // 4+0+1 = 5 pró, 0+4+0 = 4 contra — os 18 pontos do STB ficam de fora.
    expect(matchGames({ scoreA: 2, scoreB: 1, sets: [{ a: 4, b: 0 }, { a: 0, b: 4 }, { a: 10, b: 8, stb: true }] }))
      .toEqual({ a: 5, b: 4 });
  });

  it('set normal continua somando os games', () => {
    expect(matchGames({ scoreA: 2, scoreB: 0, sets: [{ a: 4, b: 2 }, { a: 4, b: 1 }] }))
      .toEqual({ a: 8, b: 3 });
  });

  it('jogo antigo sem a marca: reconhece o set decisivo pela regra da competição', () => {
    const sets = [{ a: 4, b: 0 }, { a: 0, b: 4 }, { a: 10, b: 8 }];
    // Sem a regra não há como saber — soma tudo como games (comportamento herdado).
    expect(matchGames({ scoreA: 2, scoreB: 1, sets })).toEqual({ a: 14, b: 12 });
    // Com a regra, o 3º set após 1-1 é o super tie-break.
    expect(matchGames({ scoreA: 2, scoreB: 1, sets }, STB_RULE)).toEqual({ a: 5, b: 4 });
  });

  it('sem detalhe set a set cai no placar da partida', () => {
    expect(matchGames({ scoreA: 2, scoreB: 1, sets: null })).toEqual({ a: 2, b: 1 });
  });
});

// ─── A fórmula do grupo vale em toda a cadeia ──────────────────────────────
// Antes só o Ranking a respeitava: a tabela da competição, quem classificava
// para o mata-mata e o campeão caíam no DEFAULT_SCORING, então o campeão e o
// topo do ranking podiam ser pessoas diferentes.

describe('scoringConfig atravessa standings, campeão e conquistas', () => {
  // Ana ganha na fórmula padrão (GA alto); Bruno ganha quando só vitórias contam.
  const PADRAO = { winCoef: 3, playedCoef: 0.5, gaCoef: 2 };
  const SO_VITORIAS = { winCoef: 5, playedCoef: 0, gaCoef: 0 };

  // ana:   2V em 2J, saldo largo   → GA 6,0  → PADRAO 19,0 | SO_VITORIAS 10
  // bruno: 3V em 3J, tudo apertado → GA 1,2  → PADRAO 12,9 | SO_VITORIAS 15
  // Uma fórmula premia o aproveitamento, a outra o número de vitórias.
  const mk = (id: string, a: string, b: string, sA: number, sB: number): Match =>
    ({ id, stage: 'league', aId: a, bId: b, aSrc: null, bSrc: null, scoreA: sA, scoreB: sB });

  const matches: Match[] = [
    mk('m1', 'ana', 'caio', 6, 1),
    mk('m2', 'ana', 'caio', 6, 1),
    mk('m3', 'bruno', 'caio', 6, 5),
    mk('m4', 'bruno', 'caio', 6, 5),
    mk('m5', 'bruno', 'caio', 6, 5),
  ];
  const ids = ['ana', 'bruno', 'caio'];

  it('standings ordena conforme a fórmula recebida', () => {
    const porPadrao = standings(ids, matches, undefined, PADRAO);
    const porVitorias = standings(ids, matches, undefined, SO_VITORIAS);
    // As duas ordens existem e diferem — é o que provava estar faltando.
    expect(porPadrao[0].id).toBe('ana');
    expect(porVitorias[0].id).toBe('bruno');
  });

  it('competitionChampion segue a fórmula recebida', () => {
    const comp = {
      id: 'c1', name: 'Liga', format: 'liga', unit: 'individual', gender: 'misto',
      status: 'done', date: '2026-01-01',
      config: { rounds: 'single', groups: 1, qualifiers: 1, thirdPlace: false, winRule: {} },
      competitors: ids.map(id => ({ id, name: id, short: id, color: '#000', members: [id] })),
      matches,
    } as unknown as Competition;

    expect(competitionChampion(comp, id => id, PADRAO)?.id).toBe('ana');
    expect(competitionChampion(comp, id => id, SO_VITORIAS)?.id).toBe('bruno');
  });

  it('contagem de títulos (badges e conquistas) acompanha a fórmula', () => {
    const comp = {
      id: 'c1', name: 'Liga', format: 'liga', unit: 'individual', gender: 'misto',
      status: 'done', date: '2026-01-01',
      config: { rounds: 'single', groups: 1, qualifiers: 1, thirdPlace: false, winRule: {} },
      competitors: ids.map(id => ({ id, name: id, short: id, color: '#000', members: [id] })),
      matches,
    } as unknown as Competition;

    const tituloDe = (playerId: string, cfg: typeof PADRAO) =>
      computeAchievementStats([comp], playerId, 0, cfg).champCount;

    expect(tituloDe('ana', PADRAO)).toBe(1);
    expect(tituloDe('ana', SO_VITORIAS)).toBe(0);
    expect(tituloDe('bruno', SO_VITORIAS)).toBe(1);

    // Os badges de Ana mudam junto com a fórmula (ela perde o de campeã).
    const desbloqueados = (cfg: typeof PADRAO) =>
      computeBadges('ana', [comp], id => id, cfg).filter(b => b.unlocked).map(b => b.id).sort();
    expect(desbloqueados(PADRAO)).not.toEqual(desbloqueados(SO_VITORIAS));
  });

  it('resolveCompetition classifica dos grupos pela fórmula recebida', () => {
    const base = () => ({
      id: 'c2', name: 'Grupos', format: 'grupos', unit: 'individual', gender: 'misto',
      status: 'active', date: '2026-01-01',
      config: { rounds: 'single', groups: 1, qualifiers: 1, thirdPlace: false, winRule: {} },
      competitors: ids.map(id => ({ id, name: id, short: id, color: '#000', members: [id] })),
      groupDefs: [{ name: 'Grupo A', ids }],
      matches: [
        ...matches.map(m => ({ ...m, stage: 'group' as const, groupIdx: 0 })),
        { id: 'k0', stage: 'ko' as const, koRound: 0, cnt: 1, slot: 0,
          aId: null, bId: null,
          aSrc: { type: 'group' as const, g: 0, pos: 1 },
          bSrc: { type: 'group' as const, g: 0, pos: 2 },
          scoreA: null, scoreB: null },
      ],
    }) as unknown as Competition;

    const porPadrao = base(); resolveCompetition(porPadrao, PADRAO);
    const porVitorias = base(); resolveCompetition(porVitorias, SO_VITORIAS);

    const ko = (c: Competition) => c.matches.find(m => m.id === 'k0')!;
    expect(ko(porPadrao).aId).toBe('ana');
    expect(ko(porVitorias).aId).toBe('bruno');
  });
});

// ─── Empate no placar da partida ────────────────────────────────────────────
// extractPlayerGames descartava por completo qualquer jogo com
// scoreA === scoreB: um empate genuíno no formato avulso (placar direto,
// "paramos em 4x4") desaparecia do ranking — não contava jogo disputado,
// não entrava no GA de ninguém, como se o jogo nunca tivesse existido.

describe('empate no placar — conta como jogo disputado, sem V nem D', () => {
  const compAvulso = (scoreA: number, scoreB: number): Competition => ({
    id: 'c1', name: 'Avulso', format: 'avulso', unit: 'duplas', gender: 'misto',
    status: 'active', date: '2026-01-01',
    config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: {} },
    competitors: [],
    matches: [
      // Sem `sets`: placar registrado direto — é o resultado final, não uma
      // partida pela metade.
      { id: 'm1', stage: 'rotating', teamA: ['ana'], teamB: ['bruno'], scoreA, scoreB },
    ],
  } as unknown as Competition);

  it('placar direto empatado (sem sets): vira PlayerGame com winner "draw"', () => {
    const games = extractPlayerGames(compAvulso(4, 4));
    expect(games).toHaveLength(1);
    expect(games[0].winner).toBe('draw');
    expect(games[0].gamesA).toBe(4);
    expect(games[0].gamesB).toBe(4);
  });

  it('empate conta como jogo disputado no ranking, mas não dá V nem D a ninguém', () => {
    const games = extractPlayerGames(compAvulso(4, 4));
    const ranking = buildRanking(
      [{ id: 'ana', name: 'Ana', short: 'ANA', color: '#000' }, { id: 'bruno', name: 'Bruno', short: 'BRU', color: '#000' }],
      games,
    );
    const ana = ranking.find(r => r.id === 'ana')!;
    const bruno = ranking.find(r => r.id === 'bruno')!;
    expect(ana.played).toBe(1);
    expect(bruno.played).toBe(1);
    expect(ana.wins).toBe(0);
    expect(bruno.wins).toBe(0);
    // GA sobe pros dois — o jogo aconteceu, os games foram jogados.
    expect(ana.gamesPro).toBe(4);
    expect(bruno.gamesPro).toBe(4);
  });

  it('empate em placar de SETS (partida incompleta, ex.: 1-1 no MD3) continua fora — não é resultado', () => {
    const comp = {
      id: 'c1', name: 'Liga', format: 'liga', unit: 'duplas', gender: 'misto',
      status: 'active', date: '2026-01-01',
      config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: { sets: 3 } },
      competitors: [],
      matches: [
        {
          id: 'm1', stage: 'league', teamA: ['ana'], teamB: ['bruno'],
          scoreA: 1, scoreB: 1, // 1 set pra cada — falta o terceiro, decisivo
          sets: [{ a: 6, b: 4 }, { a: 4, b: 6 }],
        },
      ],
    } as unknown as Competition;
    expect(extractPlayerGames(comp)).toHaveLength(0);
  });

  it('empate não decide confronto direto (h2h) entre os dois jogadores', () => {
    const games: PlayerGame[] = [
      { teamA: ['ana'], teamB: ['bruno'], gamesA: 4, gamesB: 4, winner: 'draw' },
    ];
    const ranking = buildRanking(
      [{ id: 'ana', name: 'Ana', short: 'ANA', color: '#000' }, { id: 'bruno', name: 'Bruno', short: 'BRU', color: '#000' }],
      games,
    );
    // Com só um empate entre os dois e pontos idênticos, o desempate final é
    // alfabético (h2h não decide nada) — Ana vem antes de Bruno.
    expect(ranking[0].id).toBe('ana');
  });
});
