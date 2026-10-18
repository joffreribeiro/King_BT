/**
 * Camada do Firestore das competições (src/firebase/competitions.ts), com um Firestore falso em memória.
 *
 * O que importa aqui é o que vai para o banco: o mapa `results` (placar oficial, M7) tem de ser
 * montado a partir do que está no SERVIDOR, e uma gravação de membro nunca pode mudar ou apagar
 * uma entrada que já existia — senão a regra (onlyAddsResults em firestore.rules) recusa a
 * gravação e o placar não sobe. `regraAceitaMembro` abaixo espelha essa regra.
 */
import { applyScore, clearScore } from '@/logic/competitionOps';
import type { Competition, Match, MatchResult } from '@/logic/types';
// jest.mock (abaixo) é içado para antes dos imports: o módulo já carrega com o Firestore falso.
import { createCompetition, mutateCompetition, updateCompetition, fetchCompetitionsOnce, subscribeCompetitions } from '../competitions';

// ── Firestore falso ─────────────────────────────────────────────────────────
type MockStore = Map<string, Record<string, unknown>>;
const mockStore: MockStore = new Map();
const mockGravacoes: { path: string; data: Record<string, unknown> }[] = [];
const mockSeq = { n: 1 };

jest.mock('../config', () => ({ db: {} }));
jest.mock('@/services/Logger', () => ({ Logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('firebase/firestore', () => {
  const snapDe = (path: string) => {
    const data = mockStore.get(path);
    return { id: path.split('/').pop()!, exists: () => data !== undefined, data: () => (data ? structuredClone(data) : undefined) };
  };
  const docsDe = (colPath: string) =>
    [...mockStore.keys()].filter(k => k.startsWith(colPath + '/') && k.split('/').length === colPath.split('/').length + 1).map(snapDe);
  return {
    collection: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
    doc: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
    query: (col: { path: string }) => col,
    orderBy: () => null,
    getDocs: async (q: { path: string }) => ({ docs: docsDe(q.path) }),
    onSnapshot: (q: { path: string }, next: (s: unknown) => void) => { next({ docs: docsDe(q.path) }); return () => {}; },
    addDoc: async (col: { path: string }, data: Record<string, unknown>) => {
      const path = `${col.path}/novo${mockSeq.n++}`;
      mockStore.set(path, structuredClone(data));
      mockGravacoes.push({ path, data: structuredClone(data) });
      return { id: path.split('/').pop() };
    },
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async (ref: { path: string }) => snapDe(ref.path),
      update: (ref: { path: string }, data: Record<string, unknown>) => {
        mockStore.set(ref.path, { ...mockStore.get(ref.path), ...structuredClone(data) });
        mockGravacoes.push({ path: ref.path, data: structuredClone(data) });
      },
    }),
    updateDoc: jest.fn(), setDoc: jest.fn(), deleteDoc: jest.fn(), writeBatch: jest.fn(),
    arrayUnion: jest.fn(), arrayRemove: jest.fn(),
  };
});


// ── Espelho da regra onlyAddsResults (firestore.rules) ─────────────────────
function regraAceitaMembro(antes: Record<string, unknown>, depois: Record<string, unknown>): boolean {
  const a = (antes.results ?? {}) as Record<string, MatchResult>;
  const d = (depois.results ?? {}) as Record<string, MatchResult>;
  if (typeof d !== 'object' || d === null) return false;
  if ('results' in antes && !('results' in depois)) return false;
  return Object.keys(a).every(k => k in d && JSON.stringify(d[k]) === JSON.stringify(a[k]));
}

// ── Dados ───────────────────────────────────────────────────────────────────
const G = 'g1';
const PATH = `groups/${G}/competitions/c1`;
const jogo = (id: string, scoreA: number | null, scoreB: number | null, extra: Partial<Match> = {}): Match =>
  ({ id, stage: 'rotating', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], scoreA, scoreB, ...extra });
const base = (matches: Match[], extra: Record<string, unknown> = {}) => ({
  name: 'Rodada', format: 'avulso', unit: 'duplas', gender: 'misto', status: 'active', date: '2026-10-18',
  config: {}, competitors: [], matches, ...extra,
});
const m1: MatchResult = { scoreA: 6, scoreB: 3, sets: [{ a: 6, b: 3 }] };

beforeEach(() => { mockStore.clear(); mockGravacoes.length = 0; mockSeq.n = 1; });

describe('leitura', () => {
  it('com o mapa, o placar do array é ignorado (alguém o reescreveu direto no banco)', async () => {
    mockStore.set(PATH, base([jogo('m1', 0, 6), jogo('m2', 6, 0)], { results: { m1 } }));
    const [c] = await fetchCompetitionsOnce(G);
    expect(c.matches.map(m => [m.id, m.scoreA, m.scoreB])).toEqual([['m1', 6, 3], ['m2', null, null]]);
  });
  it('o listener em tempo real lê do mesmo jeito', () => {
    mockStore.set(PATH, base([jogo('m1', 0, 6)], { results: { m1 } }));
    let lidas: Competition[] = [];
    subscribeCompetitions(G, cs => { lidas = cs; });
    expect(lidas[0].matches[0]).toMatchObject({ scoreA: 6, scoreB: 3 });
  });
  it('competição antiga (sem o mapa) vale pelo array', async () => {
    mockStore.set(PATH, base([jogo('m1', 6, 2)]));
    const [c] = await fetchCompetitionsOnce(G);
    expect(c.matches[0]).toMatchObject({ scoreA: 6, scoreB: 2 });
  });
});

describe('criar', () => {
  it('grava o mapa junto, a partir dos jogos que já têm placar', async () => {
    await createCompetition(G, base([jogo('m1', 6, 1), jogo('m2', null, null)]) as unknown as Omit<Competition, 'id'>);
    expect(mockGravacoes[0].data.results).toEqual({ m1: { scoreA: 6, scoreB: 1, sets: null } });
  });
});

describe('mutateCompetition', () => {
  it('membro registra um jogo novo: entrada nova, as antigas voltam idênticas (a regra aceita)', async () => {
    mockStore.set(PATH, base([jogo('m1', 6, 3), jogo('m2', null, null)], { results: { m1 } }));
    const antes = structuredClone(mockStore.get(PATH)!);
    await mutateCompetition(G, 'c1', s => applyScore(s, 'm2', 6, 4));
    const depois = mockStore.get(PATH)!;
    expect(depois.results).toEqual({ m1, m2: { scoreA: 6, scoreB: 4, sets: null } });
    expect(regraAceitaMembro(antes, depois)).toBe(true);
  });

  it('parte do placar do mapa, não do array adulterado', async () => {
    mockStore.set(PATH, base([jogo('m1', 0, 6), jogo('m2', null, null)], { results: { m1 } }));
    let visto: Competition | null = null;
    await mutateCompetition(G, 'c1', s => { visto = s; return s; });
    expect(visto!.matches[0]).toMatchObject({ scoreA: 6, scoreB: 3 });
    expect(mockStore.get(PATH)!.results).toEqual({ m1 });
  });

  it('competição antiga: a primeira gravação cria o mapa a partir do array (a regra aceita)', async () => {
    mockStore.set(PATH, base([jogo('m1', 6, 3), jogo('m2', null, null)]));
    const antes = structuredClone(mockStore.get(PATH)!);
    await mutateCompetition(G, 'c1', s => applyScore(s, 'm2', 2, 6));
    const depois = mockStore.get(PATH)!;
    expect(depois.results).toEqual({ m1: { scoreA: 6, scoreB: 3, sets: null }, m2: { scoreA: 2, scoreB: 6, sets: null } });
    expect(regraAceitaMembro(antes, depois)).toBe(true);
  });

  it('admin apaga o placar: a entrada sai (gravação que só admin passa na regra)', async () => {
    mockStore.set(PATH, base([jogo('m1', 6, 3)], { results: { m1 } }));
    const antes = structuredClone(mockStore.get(PATH)!);
    await mutateCompetition(G, 'c1', s => clearScore(s, 'm1'));
    const depois = mockStore.get(PATH)!;
    expect(depois.results).toEqual({});
    expect(regraAceitaMembro(antes, depois)).toBe(false);
  });

  it('admin corrige o placar: a entrada muda (de novo, só admin passa)', async () => {
    mockStore.set(PATH, base([jogo('m1', 6, 3)], { results: { m1 } }));
    const antes = structuredClone(mockStore.get(PATH)!);
    await mutateCompetition(G, 'c1', s => applyScore(s, 'm1', 3, 6));
    expect((mockStore.get(PATH)!.results as Record<string, MatchResult>).m1).toMatchObject({ scoreA: 3, scoreB: 6 });
    expect(regraAceitaMembro(antes, mockStore.get(PATH)!)).toBe(false);
  });

  it('entrada de jogo que saiu do array é mantida (não derruba a gravação de um membro)', async () => {
    mockStore.set(PATH, base([jogo('m2', null, null)], { results: { m9: { scoreA: 6, scoreB: 0, sets: null } } }));
    const antes = structuredClone(mockStore.get(PATH)!);
    await mutateCompetition(G, 'c1', s => applyScore(s, 'm2', 6, 2));
    expect(regraAceitaMembro(antes, mockStore.get(PATH)!)).toBe(true);
  });

  it('mutate devolvendo null não grava nada', async () => {
    mockStore.set(PATH, base([jogo('m1', null, null)]));
    await mutateCompetition(G, 'c1', () => null);
    expect(mockGravacoes).toHaveLength(0);
  });

  it('competição que não existe: não grava', async () => {
    await mutateCompetition(G, 'nao-existe', s => s);
    expect(mockGravacoes).toHaveLength(0);
  });

  it('tira os campos undefined (o Firestore recusaria a gravação inteira)', async () => {
    mockStore.set(PATH, base([jogo('m1', null, null)], { results: {} }));
    await mutateCompetition(G, 'c1', s => ({ ...s, matches: s.matches.map(m => ({ ...m, aId: undefined })) }));
    expect(JSON.stringify(mockGravacoes[0].data)).not.toContain('undefined');
    expect('aId' in (mockGravacoes[0].data.matches as Match[])[0]).toBe(false);
  });
});

describe('updateCompetition (fila offline antiga)', () => {
  it('grava em transação: o mapa parte do servidor e não perde a entrada que outro celular salvou', async () => {
    // O servidor já tem m2, registrado por outra pessoa depois que este celular ficou offline.
    mockStore.set(PATH, base([jogo('m1', 6, 3), jogo('m2', 6, 1)], { results: { m1, m9: { scoreA: 6, scoreB: 0, sets: null } } }));
    const antes = structuredClone(mockStore.get(PATH)!);
    const local = { id: 'c1', ...base([jogo('m1', 6, 3, { sets: [{ a: 6, b: 3 }] })], { results: { m1 } }) } as unknown as Competition;
    await updateCompetition(G, local);
    expect((mockStore.get(PATH)!.results as Record<string, MatchResult>).m9).toBeDefined();
    expect(regraAceitaMembro(antes, mockStore.get(PATH)!)).toBe(true);
  });
});
