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

export interface Match {
  id: string;
  stage: Stage;
  aId?: string | null;
  bId?: string | null;
  aSrc?: MatchSource | null;
  bSrc?: MatchSource | null;
  scoreA: number | null;
  scoreB: number | null;
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

export interface CompetitionConfig {
  rounds: 'single' | 'double';
  groups: number;
  qualifiers: number;
  thirdPlace: boolean;
  winRule: { mode: 'games' | 'sets' | 'points'; target: number };
}

export interface Competition {
  id: string;
  name: string;
  format: Format;
  unit: Unit;
  status: 'setup' | 'active' | 'done';
  date: string;
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
