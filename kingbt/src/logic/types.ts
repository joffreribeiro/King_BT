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

/** Forma mínima de jogador para exibição (avatar, nome) — sem os campos de competição do Player. */
export interface PlayerInfo {
  id: string;
  name: string;
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
  /**
   * Set decidido em super tie-break: `a`/`b` são os PONTOS disputados
   * (ex.: 10-8), não games. Quem soma games precisa tratar este set à parte —
   * ver `matchGames` em logic/setOutcome.ts. Ausente nos jogos gravados antes
   * desta marca existir.
   */
  stb?: boolean;
  /**
   * Pontos do tie-break comum que decidiu o set (ex.: 4-3 com tb {a: 3, b: 7}), para mostrar como expoente
   * (4³ 3⁷). Só existe quando o jogo foi marcado ponto a ponto no scout; ausente nos demais.
   */
  tb?: { a: number; b: number };
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

/** Placar lançado por um jogador que ainda espera a confirmação do outro lado (ver scoreValidation.ts). */
export interface PendingScore {
  scoreA: number;
  scoreB: number;
  sets?: SetScore[];
  /** Id do jogador que lançou. */
  by: string;
  at: string;
  disputed?: boolean;
  disputedBy?: string;
  disputedAt?: string;
  reason?: string;
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
  /** Placar aguardando confirmação (só em competições que exigem). Não vale para ranking até ser confirmado. */
  pendingScore?: PendingScore | null;
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

/** Pontuação própria da competição (escolhida na criação). Ausente = fórmula do grupo. */
export interface CompetitionScoring {
  winPts?: number;
  drawPts?: number;
  /** Super 8: pontos por saldo de games. */
  gdPts?: number;
  /** Critério de desempate / ordenação: 'saldo' | 'confronto' | 'vitorias' | 'pontos'. */
  tiebreak?: string;
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
  scoring?: CompetitionScoring;
  /** Placar lançado por jogador só vale depois que o outro lado confirma (admin lança direto). Ausente = não exige. */
  requireConfirmation?: boolean;
}

export interface Substitution {
  originalId: string;
  substituteId: string;
  fromMatchId: string;
  timestamp: string;
}

/** Como as inscrições funcionam, quando o criador liga "Abrir inscrições". */
export interface RegistrationSettings {
  /** 'open' = qualquer um se inscreve; 'closed' = ninguém; 'adminOnly' = só o admin adiciona. Ausente = 'open'. */
  mode?: 'open' | 'closed' | 'adminOnly';
  /** Abertura agendada, "AAAA-MM-DDTHH:MM" (fuso local). Antes disso as inscrições estão fechadas. */
  opensAt?: string;
  /** Fila de espera quando lota. Ausente = sim. */
  waitlist?: boolean;
  /** Horas antes do início até quando dá para cancelar. Ausente = sem prazo. */
  cancelHoursBefore?: number;
}

export interface Competition {
  id: string;
  name: string;
  format: Format;
  unit: Unit;
  gender: Gender;
  /** upcoming = inscrições abertas; setup = lista fechada, o admin monta grupos/chave; active; done. */
  status: 'upcoming' | 'setup' | 'active' | 'done';
  date: string;
  /** Local / quadras (opcional). */
  location?: string;
  /** Horário de início, "HH:MM" (opcional). */
  time?: string;
  /** Regras / observações gerais (opcional). */
  notes?: string;
  config: CompetitionConfig;
  competitors: Competitor[];
  groupDefs?: GroupDef[];
  matches: Match[];
  substitutions?: Substitution[];
  /** IDs dos jogadores que confirmaram participação (status: upcoming) */
  confirmedIds?: string[];
  /** Limite de vagas na lista principal (confirmedIds). Ausente = sem limite. */
  vagas?: number;
  /** Fila de espera, em ordem de chegada. O 1º entra quando uma vaga abre. */
  waitlistIds?: string[];
  /** UID do criador da competição */
  createdBy?: string;
  /** Solicitações de inscrição de visitantes (não-membros de grupo público) */
  joinRequests?: JoinRequest[];
  /** Vale para ranking, XP, conquistas e avaliação dos colegas. Ausente = vale; false = competição amistosa. */
  countsForRanking?: boolean;
  /** 'Aberta' libera todos; uma categoria restringe a inscrição à do perfil (about.category). Ausente = Aberta. */
  levelCategory?: string;
  registration?: RegistrationSettings;
  /** Sessão avulsa criada pelo atalho "Jogo Rápido" — some das listas de competições/hall/calendário, mas conta normalmente em stats/feed/histórico. */
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
  /** Nº de competições distintas em que o jogador teve pelo menos 1 jogo válido. */
  events?: number;
}

export interface RankedPlayer extends Player, PlayerStat {
  sg: number;
  ga: number;
  winRate: number;
  points: number;
  /** Jogou menos que o mínimo do grupo: aparece abaixo dos classificados, sem posição. */
  provisional?: boolean;
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
