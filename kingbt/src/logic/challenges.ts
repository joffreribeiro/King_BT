/**
 * Desafios: um jogador convida outro para um jogo 1 contra 1 (ou, com parceiros, de duplas). O desafiado aceita ou recusa;
 * aceito, um dos dois marca o jogo (que vira uma partida avulsa com placar) e o desafio fica ligado a ela.
 * Vive em groups/{gid}/challenges/{id}.
 */
export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface Challenge {
  id: string;
  /** Jogador que desafia e jogador desafiado (ids dos perfis no grupo). */
  fromId: string;
  toId: string;
  /** uid das contas — é por eles que as regras do Firestore sabem quem pode responder. */
  fromUid: string;
  toUid: string;
  /** Desafio de duplas: o parceiro de quem desafia e o parceiro de quem é desafiado. Quem responde é só o desafiado (toId). */
  fromPartnerId?: string;
  toPartnerId?: string;
  message?: string;
  /** Quando o desafiante propõe jogar, em texto livre ("sábado de manhã"). */
  when?: string;
  status: ChallengeStatus;
  createdAt: string;
  respondedAt?: string;
  /** Competição (partida avulsa) criada para este desafio, depois de aceito. */
  compId?: string;
}

export const CHALLENGE_MESSAGE_MAX = 140;
export const CHALLENGE_WHEN_MAX = 60;
/** Desafio sem resposta por tanto tempo deixa de valer. */
export const CHALLENGE_EXPIRE_DAYS = 14;

export const STATUS_LABEL: Record<ChallengeStatus | 'expired', string> = {
  pending: 'Aguardando resposta', accepted: 'Aceito', declined: 'Recusado', cancelled: 'Cancelado', expired: 'Expirado',
};

/** Lê um desafio gravado; null se faltar o essencial. */
export function parseChallenge(id: string, d: Record<string, unknown> | undefined): Challenge | null {
  if (!d) return null;
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
  const status = d.status;
  if (!str('fromId') || !str('toId') || !str('fromUid') || !str('toUid')) return null;
  if (status !== 'pending' && status !== 'accepted' && status !== 'declined' && status !== 'cancelled') return null;
  return {
    id, fromId: str('fromId'), toId: str('toId'), fromUid: str('fromUid'), toUid: str('toUid'),
    ...(str('fromPartnerId') && str('toPartnerId') ? { fromPartnerId: str('fromPartnerId'), toPartnerId: str('toPartnerId') } : {}),
    ...(str('message') ? { message: str('message') } : {}),
    ...(str('when') ? { when: str('when') } : {}),
    status, createdAt: str('createdAt'),
    ...(str('respondedAt') ? { respondedAt: str('respondedAt') } : {}),
    ...(str('compId') ? { compId: str('compId') } : {}),
  };
}

/** Desafio a gravar (já limpo), ou null se for inválido (a si mesmo, sem conta do desafiado, textos grandes). */
export function newChallenge(
  input: { fromId: string; toId: string; fromUid: string; toUid: string | null | undefined; message?: string; when?: string; fromPartnerId?: string; toPartnerId?: string },
  now: Date = new Date(),
): Omit<Challenge, 'id'> | null {
  const { fromId, toId, fromUid, toUid } = input;
  if (!fromId || !toId || !fromUid || !toUid || fromId === toId || fromUid === toUid) return null;
  // Duplas: os dois parceiros ou nenhum, e os quatro jogadores precisam ser diferentes.
  const fp = input.fromPartnerId ?? '', tp = input.toPartnerId ?? '';
  if (!!fp !== !!tp) return null;
  if (fp && new Set([fromId, toId, fp, tp]).size !== 4) return null;
  const message = (input.message ?? '').trim();
  const when = (input.when ?? '').trim();
  if (message.length > CHALLENGE_MESSAGE_MAX || when.length > CHALLENGE_WHEN_MAX) return null;
  return {
    fromId, toId, fromUid, toUid,
    ...(fp ? { fromPartnerId: fp, toPartnerId: tp } : {}),
    ...(message ? { message } : {}),
    ...(when ? { when } : {}),
    status: 'pending', createdAt: now.toISOString(),
  };
}

export function isExpired(c: Challenge, now: Date = new Date()): boolean {
  if (c.status !== 'pending') return false;
  const t = Date.parse(c.createdAt);
  return Number.isFinite(t) && now.getTime() - t > CHALLENGE_EXPIRE_DAYS * 86_400_000;
}

export const effectiveStatus = (c: Challenge, now: Date = new Date()): ChallengeStatus | 'expired' => (isExpired(c, now) ? 'expired' : c.status);

/** Desafios que chegaram para mim e esperam resposta. */
export const incomingChallenges = (list: Challenge[], myId: string | null | undefined, now: Date = new Date()): Challenge[] =>
  myId ? list.filter(c => c.toId === myId && c.status === 'pending' && !isExpired(c, now)) : [];

/** Desafios que mandei e ainda não foram respondidos. */
export const sentChallenges = (list: Challenge[], myId: string | null | undefined, now: Date = new Date()): Challenge[] =>
  myId ? list.filter(c => c.fromId === myId && c.status === 'pending' && !isExpired(c, now)) : [];

/** Aceitos em que eu jogo e o jogo ainda não foi marcado. */
export const awaitingGame = (list: Challenge[], myId: string | null | undefined): Challenge[] =>
  myId ? list.filter(c => c.status === 'accepted' && !c.compId && (c.fromId === myId || c.toId === myId)) : [];

/** Quantos desafios pedem uma ação sua (responder ou marcar o jogo). */
export const attentionCount = (list: Challenge[], myId: string | null | undefined, now: Date = new Date()): number =>
  incomingChallenges(list, myId, now).length + awaitingGame(list, myId).length;

/** Já existe desafio meu para este jogador esperando resposta? (evita mandar duas vezes) */
export const alreadyChallenged = (list: Challenge[], fromId: string, toId: string, now: Date = new Date()): boolean =>
  list.some(c => c.fromId === fromId && c.toId === toId && c.status === 'pending' && !isExpired(c, now));

/** Desafio de duplas (2 contra 2)? */
export const isDoubles = (c: Challenge): boolean => !!c.fromPartnerId && !!c.toPartnerId;

/** Lados do jogo: [quem desafia (+ parceiro), quem é desafiado (+ parceiro)]. */
export const challengeSides = (c: Challenge): [string[], string[]] =>
  isDoubles(c) ? [[c.fromId, c.fromPartnerId as string], [c.toId, c.toPartnerId as string]] : [[c.fromId], [c.toId]];

/** O jogador está em campo neste desafio (como desafiante, desafiado ou parceiro)? */
export const involves = (c: Challenge, id: string | null | undefined): boolean =>
  !!id && challengeSides(c).some(side => side.includes(id));
