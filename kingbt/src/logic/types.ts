export type Format = 'liga' | 'grupos' | 'mata' | 'avulso' | 'super8';
export type Unit   = 'individual' | 'duplas';
export type Gender = 'masculino' | 'feminino' | 'misto';
export type Stage  = 'league' | 'group' | 'ko' | 'rotating';

export interface Player {
  id: string;
  name: string;
  short: string;
  color: string;
  handicap?: number;
}

export interface Competitor {
  id: string;
  name: string;
  short: string;
  color: string;
  members: string[];
}

export interface MatchSource {
  type: 'winner' | 'loser' | 'group' | 'best3';
  match?: string;
  g?: number;
  pos?: number;
  /** Para type='best3': qual posição entre os melhores 3ºs (1=melhor, 2=segundo melhor...) */
  best3Rank?: number;
}

export interface SetScore {
  a: number;
  b: number;
}

export interface LiveScore {
  gamesA: number;
  gamesB: number;
  setsA: number;
  setsB: number;
  updatedAt: string;
  /** Quem está marcando este jogo (trava contra dois marcadores simultâneos). */
  scorerUid?: string | null;
  scorerName?: string | null;
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
  /** Placar ao vivo durante a partida (apagado ao finalizar). */
  liveScore?: LiveScore | null;
  /** Detalhe set a set (games de cada set), quando o jogo usa sets. */
  sets?: SetScore[] | null;
  /** Placar rascunho — salvo mas não conta no ranking até estar completo. */
  draftSets?: SetScore[] | null;
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
  /**
   * Em qual placar de games o tie-break é ativado.
   * 'deuce': tie em gamesWin-1 x gamesWin-1 (ex: 3-3 num set de 4 games).
   * 'full':  tie em gamesWin x gamesWin (ex: 4-4 num set de 4 games).
   * Padrão: 'deuce'.
   */
  tiebreakAt?: 'deuce' | 'full';
  /** Super tie-break no set decisivo em vez de jogar o set completo. */
  superTiebreak?: boolean;
  /** Pontos do super tie-break (padrão 10). */
  superTiebreakPts?: number;
  scoutMode?: 'aovivo' | 'padrao' | 'avancado';
  // legado
  mode?: 'games' | 'sets' | 'points';
  target?: number;
}

export interface CompetitionConfig {
  rounds: 'single' | 'double';
  groups: number;
  qualifiers: number;
  /** Quantos melhores 3ºs colocados (de todos os grupos) avançam para o KO. 0 = nenhum. */
  bestThirds?: number;
  thirdPlace: boolean;
  winRule: WinRule;
  useOfficialRules?: boolean;
}

export interface Substitution {
  originalId: string;
  substituteId: string;
  fromMatchId: string;
  timestamp: string;
}

export interface Competition {
  id: string;
  name: string;
  format: Format;
  unit: Unit;
  gender: Gender;
  status: 'upcoming' | 'setup' | 'active' | 'done';
  date: string;
  /** Local / quadras (opcional). */
  location?: string;
  /** Regras / observações gerais (opcional). */
  notes?: string;
  config: CompetitionConfig;
  competitors: Competitor[];
  groupDefs?: GroupDef[];
  matches: Match[];
  substitutions?: Substitution[];
  /** IDs dos jogadores que confirmaram participação (status: upcoming) */
  confirmedIds?: string[];
  /** UID do criador da competição */
  createdBy?: string;
  /** Solicitações de inscrição de visitantes (não-membros de grupo público) */
  joinRequests?: JoinRequest[];
  /** Sessão avulsa criada pelo atalho "Jogo Amistoso" — some das listas de competições/hall/calendário, mas conta normalmente em stats/feed/histórico. */
  isFriendly?: boolean;
}

export interface JoinRequest {
  uid: string;
  name: string;
  requestedAt: string;
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
