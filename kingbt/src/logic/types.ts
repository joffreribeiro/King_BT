export type Format = 'liga' | 'grupos' | 'mata' | 'avulso' | 'super8';
export type Unit   = 'individual' | 'duplas';
export type Stage  = 'league' | 'group' | 'ko' | 'rotating';

export interface Player {
  id: string;
  name: string;
  short: string;
  color: string;
}

export interface Competitor {
  id: string;
  name: string;
  short: string;
  color: string;
  members: string[];
}

export interface MatchSource {
  type: 'winner' | 'loser' | 'group';
  match?: string;
  g?: number;
  pos?: number;
}

export interface SetScore {
  a: number;
  b: number;
}

export interface Match {
  id: string;
  stage: Stage;
  aId?: string | null;
  bId?: string | null;
  aSrc?: MatchSource | null;
  bSrc?: MatchSource | null;
  /** Resultado decisivo do jogo. Com modelo de sets, = sets vencidos por lado. */
  scoreA: number | null;
  scoreB: number | null;
  /** Detalhe set a set (games de cada set), quando o jogo usa sets. */
  sets?: SetScore[] | null;
  /** Data/horário do jogo (ISO). */
  playedAt?: string | null;
  /** Observações do jogo (W.O., lesão, etc.). */
  note?: string | null;
  round?: number;
  groupIdx?: number;
  koRound?: number;
  koTotal?: number;
  cnt?: number;
  slot?: number;
  third?: boolean;
  teamA?: string[];
  teamB?: string[];
}

export interface GroupDef {
  name: string;
  ids: string[];
}

/**
 * Regra de vitória do jogo. Modelo novo: sets + games por set + tie-break,
 * configurados de forma independente. Os campos `mode`/`target` são mantidos
 * apenas para compatibilidade com competições antigas.
 */
export interface WinRule {
  /** Melhor de N sets (1, 3, 5). */
  sets?: number;
  /** Games para vencer um set. */
  games?: number;
  /** Pontos do tie-break. */
  tiebreak?: number;
  // legado
  mode?: 'games' | 'sets' | 'points';
  target?: number;
}

export interface CompetitionConfig {
  rounds: 'single' | 'double';
  groups: number;
  qualifiers: number;
  thirdPlace: boolean;
  winRule: WinRule;
}

export interface Competition {
  id: string;
  name: string;
  format: Format;
  unit: Unit;
  status: 'setup' | 'active' | 'done';
  date: string;
  /** Local / quadras (opcional). */
  location?: string;
  /** Regras / observações gerais (opcional). */
  notes?: string;
  config: CompetitionConfig;
  competitors: Competitor[];
  groupDefs?: GroupDef[];
  matches: Match[];
}

export interface PlayerStat {
  id: string;
  played: number;
  wins: number;
  losses: number;
  gamesPro: number;
  gamesCon: number;
}

export interface RankedPlayer extends Player, PlayerStat {
  sg: number;
  ga: number;
  winRate: number;
  points: number;
}

export interface Standing {
  id: string;
  played: number;
  wins: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}
