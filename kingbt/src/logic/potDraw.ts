import { CATEGORIES } from './playerAbout';

/**
 * Sorteio de duplas por potes: os jogadores são ordenados por nível e divididos em dois potes
 * (Pote 1 = os mais fortes, Pote 2 = os demais); cada dupla leva um jogador de cada pote.
 * Assim nenhuma dupla junta dois fortes nem dois fracos.
 */
export interface PotPlayer {
  id: string;
  /** Categoria do perfil (Open, A, B, C, D, Iniciante). Ausente = sem categoria. */
  category?: string | null;
  /** Posição no ranking (0 = líder). Ausente = fora do ranking. */
  rank?: number | null;
}

export interface PotDraw {
  pot1: string[];
  pot2: string[];
  pairs: [string, string][];
  /** Com número ímpar, sobra o jogador do meio da ordem de nível. */
  leftover: string | null;
}

const NO_CATEGORY = CATEGORIES.length; // quem não informou categoria vem depois de quem informou
const NO_RANK = 99999;

const catIndex = (c?: string | null) => {
  const i = c ? (CATEGORIES as readonly string[]).indexOf(c) : -1;
  return i < 0 ? NO_CATEGORY : i;
};

/** Do mais forte para o mais fraco: categoria primeiro, depois posição no ranking. */
export function sortByLevel(players: PotPlayer[]): PotPlayer[] {
  return [...players].sort((a, b) =>
    catIndex(a.category) - catIndex(b.category)
    || (a.rank ?? NO_RANK) - (b.rank ?? NO_RANK)
    || a.id.localeCompare(b.id));
}

/** Os dois potes (e o que sobra, se o número for ímpar), sem sortear ainda. */
export function splitPots(players: PotPlayer[]): { pot1: string[]; pot2: string[]; leftover: string | null } {
  const sorted = sortByLevel(players).map(p => p.id);
  const half = Math.floor(sorted.length / 2);
  const odd = sorted.length % 2 === 1;
  return {
    pot1: sorted.slice(0, half),
    pot2: sorted.slice(odd ? half + 1 : half),
    leftover: odd ? sorted[half] : null,
  };
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sorteia as duplas: cada jogador do Pote 1 forma dupla com um do Pote 2, escolhido ao acaso. */
export function drawPotPairs(players: PotPlayer[], rng: () => number = Math.random): PotDraw {
  const { pot1, pot2, leftover } = splitPots(players);
  const drawn = shuffle(pot2, rng);
  return { pot1, pot2, leftover, pairs: pot1.map((id, i) => [id, drawn[i]] as [string, string]) };
}
