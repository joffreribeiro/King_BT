import type { Competition } from './types';

/** Só os campos de inscrição de uma competição agendada. */
export interface RegistrationState {
  confirmedIds: string[];
  waitlistIds: string[];
  vagas?: number;
}

export function registrationOf(c: Pick<Competition, 'confirmedIds' | 'waitlistIds' | 'vagas'>): RegistrationState {
  return { confirmedIds: c.confirmedIds ?? [], waitlistIds: c.waitlistIds ?? [], vagas: c.vagas };
}

/** Vagas só valem se for um inteiro positivo; 0/negativo/NaN = sem limite. */
export function hasLimit(vagas: number | undefined): vagas is number {
  return typeof vagas === 'number' && Number.isFinite(vagas) && vagas > 0;
}

export type RegisterOutcome = 'principal' | 'espera' | 'already' | 'full' | 'blocked';

/**
 * Inscreve o jogador: lista principal se ainda há vaga, senão fila de espera.
 * Roda dentro da transação do Firestore, sobre o documento do servidor — é
 * isso que impede duas pessoas de pegarem a última vaga ao mesmo tempo.
 */
export function applyRegister(s: RegistrationState, id: string, opts: { waitlist?: boolean } = {}): RegistrationState & { outcome: RegisterOutcome } {
  if (s.confirmedIds.includes(id) || s.waitlistIds.includes(id)) return { ...s, outcome: 'already' };
  if (hasLimit(s.vagas) && s.confirmedIds.length >= s.vagas) {
    if (opts.waitlist === false) return { ...s, outcome: 'full' };
    return { ...s, waitlistIds: [...s.waitlistIds, id], outcome: 'espera' };
  }
  return { ...s, confirmedIds: [...s.confirmedIds, id], outcome: 'principal' };
}

/**
 * Cancela a inscrição (principal ou espera). Se liberou uma vaga, o primeiro
 * da fila é promovido — `promotedId` diz quem, para avisar a pessoa depois.
 */
export function applyCancel(s: RegistrationState, id: string): RegistrationState & { promotedId: string | null } {
  const wasWaiting = s.waitlistIds.includes(id);
  let confirmedIds = s.confirmedIds.filter(x => x !== id);
  let waitlistIds = s.waitlistIds.filter(x => x !== id);
  let promotedId: string | null = null;
  if (!wasWaiting && waitlistIds.length > 0 && (!hasLimit(s.vagas) || confirmedIds.length < s.vagas)) {
    promotedId = waitlistIds[0];
    confirmedIds = [...confirmedIds, promotedId];
    waitlistIds = waitlistIds.slice(1);
  }
  return { ...s, confirmedIds, waitlistIds, promotedId };
}

export type EventAction = 'register' | 'waitlist' | 'cancel' | 'leaveWaitlist';

export interface EventView {
  me: 'principal' | 'espera' | null;
  taken: number;
  vagas: number | null;
  free: number | null;
  /** Sobrou exatamente uma vaga e você ainda não está dentro. */
  lastSpot: boolean;
  full: boolean;
  waitCount: number;
  /** Posição na fila (1 = próximo a entrar), ou null se você não está nela. */
  waitPos: number | null;
  action: EventAction;
  /** Lotado e sem lista de espera: quem não está dentro não consegue entrar. */
  closedFull: boolean;
}

/** Tudo que o cartão precisa para desenhar o estado do evento para um jogador. */
export function eventView(c: Pick<Competition, 'confirmedIds' | 'waitlistIds' | 'vagas'> & { registration?: Competition['registration'] }, myId: string | null | undefined): EventView {
  const s = registrationOf(c);
  const limited = hasLimit(s.vagas);
  const taken = s.confirmedIds.length;
  const me = myId && s.confirmedIds.includes(myId) ? 'principal'
    : myId && s.waitlistIds.includes(myId) ? 'espera' : null;
  const full = limited && taken >= (s.vagas as number);
  const free = limited ? Math.max(0, (s.vagas as number) - taken) : null;
  const waitPos = me === 'espera' ? s.waitlistIds.indexOf(myId as string) + 1 : null;
  const action: EventAction = me === 'principal' ? 'cancel' : me === 'espera' ? 'leaveWaitlist' : full ? 'waitlist' : 'register';
  return {
    me, taken, vagas: limited ? (s.vagas as number) : null, free,
    lastSpot: free === 1 && !me, full, waitCount: s.waitlistIds.length, waitPos, action,
    closedFull: full && !me && c.registration?.waitlist === false,
  };
}

/** Próxima competição agendada: a mais próxima a partir de hoje; sem futuras, a mais recente. */
export function nextUpcoming(comps: Competition[], today: string): Competition | null {
  const ups = comps.filter(c => c.status === 'upcoming' && !c.isFriendly);
  if (ups.length === 0) return null;
  const future = ups.filter(c => (c.date ?? '') >= today).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  if (future.length) return future[0];
  return ups.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
}
