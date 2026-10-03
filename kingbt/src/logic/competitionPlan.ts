import type { Competition, CompetitionConfig, Competitor, Format, Gender, RegistrationSettings, Unit, WinRule } from './types';
import { WIN_RULE_PRESETS } from '@/constants/winRulePresets';
import { genLeague, genBracket, genGroups, genGroupsManual, resolveCompetition } from './formats';
import { generateSchedule, generateScheduleIndividual } from './roundRobin';
import { CATEGORIES, isoToBr } from './playerAbout';
import { parseBrDate, parseTime } from './eventDateTime';
import type { ScoringConfig } from './scoringConfig';

// ─── Rótulos e textos ─────────────────────────────────────────────────────────

export const FORMAT_ORDER: Format[] = ['liga', 'grupos', 'mata', 'avulso', 'super8'];

export const FORMAT_BUTTON: Record<Format, string> = {
  liga: 'Liga', grupos: 'Grupos + Elim.', mata: 'Mata-mata', avulso: 'Avulso', super8: 'Super 8',
};

export const FORMAT_NAME: Record<Format, string> = {
  liga: 'Liga', grupos: 'Grupos + Eliminatórias', mata: 'Mata-mata', avulso: 'Avulso', super8: 'Super 8',
};

export const FORMAT_HINT: Record<Format, string> = {
  liga: 'Todos jogam contra todos. Gera um ranking por pontos.',
  grupos: 'Divide em grupos; os melhores avançam para o chaveamento.',
  mata: 'Quem perde está fora. Direto à final.',
  avulso: 'Sessão livre: você registra manualmente cada jogo que aconteceu.',
  super8: 'Parceiros rotativos gerados automaticamente. Todos jogam com todos em duplas.',
};

export const LEVELS = ['Aberta', ...CATEGORIES] as const;

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'misto', label: 'Misto' },
];

/** Frase que explica "Competem em" e muda conforme o formato. */
export function unitText(format: Format | null, unit: Unit | null): string {
  if (!unit) return format === 'super8' ? 'Super 8: escolha entre duplas rotativas ou individual.' : '';
  if (format === 'super8') {
    return unit === 'duplas'
      ? 'Duplas rotativas: você joga em dupla uma vez com cada um dos outros jogadores. O sistema sorteia as duplas.'
      : 'Individual: todos contra todos, 1 contra 1. Você enfrenta cada jogador uma vez.';
  }
  return unit === 'duplas'
    ? 'Duplas fixas: cada dupla se inscreve junta e compete como uma só.'
    : 'Cada jogador compete por conta própria.';
}

/** "Super 8 · 10/10" */
export function suggestedName(format: Format | null, dateIso: string | null): string | null {
  if (!format) return null;
  const d = dateIso ? dateIso.split('-').reverse().slice(0, 2).join('/') : '';
  return FORMAT_NAME[format] + (d ? ` · ${d}` : '');
}

/** Locais já usados nas competições do grupo, do mais frequente ao menos (empate: o mais recente primeiro). */
export function usedLocations(comps: Pick<Competition, 'location' | 'date'>[], limit = 5): string[] {
  const count = new Map<string, { n: number; last: string }>();
  for (const c of comps) {
    const loc = c.location?.trim();
    if (!loc) continue;
    const cur = count.get(loc) ?? { n: 0, last: '' };
    count.set(loc, { n: cur.n + 1, last: (c.date ?? '') > cur.last ? (c.date ?? '') : cur.last });
  }
  return [...count.entries()]
    .sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([loc]) => loc);
}

// ─── Estimativas e sugestão de grupos ─────────────────────────────────────────

export const pairsOf = (n: number) => (n * (n - 1)) / 2;

export function pow2ge(x: number): number {
  let p = 1;
  while (p < x) p *= 2;
  return p;
}

/** Tamanho de cada grupo ao dividir n competidores em g grupos (os primeiros ficam com o resto). */
export function groupSizes(n: number, g: number): number[] {
  const base = Math.floor(n / g), rest = n % g;
  return Array.from({ length: g }, (_, i) => base + (i < rest ? 1 : 0));
}

export interface GroupSuggestion { groups: number; qualifiers: number; bestThirds: number }

/** Grupos = n/4 (2 a 8); 2 classificados por grupo (1 se algum grupo teria menos de 3); 3ºs completam a potência de 2. */
export function suggestGroups(n: number): GroupSuggestion {
  const groups = Math.max(2, Math.min(8, Math.round(n / 4)));
  const qualifiers = Math.floor(n / groups) < 3 ? 1 : 2;
  const total = groups * qualifiers;
  let bestThirds = pow2ge(total) - total;
  if (qualifiers !== 2 || bestThirds > groups) bestThirds = 0;
  return { groups, qualifiers, bestThirds };
}

export function groupPhaseGames(n: number, groups: number, double: boolean): number {
  return groupSizes(n, groups).reduce((a, s) => a + pairsOf(s), 0) * (double ? 2 : 1);
}

/** Jogos do mata-mata com `total` classificados (a disputa de 3º lugar não entra). */
export const knockoutGames = (total: number) => Math.max(0, total - 1);

export function estimateGames(format: Format | null, unit: Unit | null, n: number, double = false): number | null {
  if (!format || !n || n < 1) return null;
  if (format === 'avulso') return null;
  if (format === 'super8') return unit === 'individual' ? pairsOf(n) : Math.round((n * (n - 1)) / 4);
  if (format === 'liga') return pairsOf(n) * (double ? 2 : 1);
  if (format === 'mata') return knockoutGames(n);
  const s = suggestGroups(n);
  return groupPhaseGames(n, s.groups, double) + knockoutGames(s.groups * s.qualifiers + s.bestThirds);
}

export interface DisputeInput {
  presetIndex: number | null;
  manual: boolean;
  sets: number | null;
}

/** Minutos por jogo: do preset, ou por sets no modo manual (1 set = 20, melhor de 3 = 45, melhor de 5 = 70). */
export function minutesPerGame(d: DisputeInput): number | null {
  if (d.presetIndex !== null) return WIN_RULE_PRESETS[d.presetIndex]?.minutes ?? null;
  if (d.manual && d.sets) return d.sets <= 1 ? 20 : d.sets === 3 ? 45 : 70;
  return null;
}

/** Minutos por jogo de uma competição já criada: acha o preset equivalente; senão estima pelos sets. */
export function minutesForWinRule(w: WinRule | undefined): number | null {
  if (!w?.sets) return null;
  const p = WIN_RULE_PRESETS.find(x =>
    x.sets === w.sets && x.games === w.games && x.tb === w.tiebreak && x.tbAt === (w.tiebreakAt ?? 'deuce') && x.stb === !!w.superTiebreak);
  return p ? p.minutes : minutesPerGame({ presetIndex: null, manual: true, sets: w.sets });
}

export const durationMinutes =(games: number, minutes: number, courts: number) =>
  Math.ceil(games / Math.max(1, courts)) * minutes;

export function fmtMin(m: number): string {
  const h = Math.floor(m / 60), r = Math.round(m % 60);
  return h ? `${h} h${r ? ` ${String(r).padStart(2, '0')}` : ''}` : `${r} min`;
}

export function planWarnings(format: Format | null, n: number | null): string[] {
  const w: string[] = [];
  if (!format || format === 'avulso' || !n) return w;
  if (n < 4) w.push('Poucos competidores: o mínimo recomendado é 4.');
  if (format === 'grupos' && n < 6) w.push('Com menos de 6 competidores, grupos rendem pouco: considere Liga.');
  return w;
}

// ─── Formulário "Nova competição" ─────────────────────────────────────────────

export interface NewCompForm {
  name: string;
  format: Format | null;
  unit: Unit | null;
  gender: Gender | null;
  level: string | null;
  /** "DD/MM/AAAA" */
  dateText: string;
  /** A data foi preenchida sozinha (hoje, no Avulso) e pode ser apagada ao trocar de formato. */
  dateAuto: boolean;
  /** "HH:MM" */
  timeText: string;
  location: string;
  notes: string;

  registrationOn: boolean;
  vagasText: string;
  noLimit: boolean;
  regMode: NonNullable<RegistrationSettings['mode']>;
  scheduleOpen: boolean;
  opensDateText: string;
  opensTimeText: string;
  waitlist: boolean;
  cancelHoursText: string;

  // Configuração por formato
  winPts: string;
  drawPts: string;
  gdPts: string;
  tiebreak: string;
  thirdPlace: boolean;

  // Formato de disputa
  presetIndex: number | null;
  manual: boolean;
  sets: number | null;
  games: number;
  tiebreakPts: number;
  superTiebreak: boolean;
  superTiebreakPts: number;
  officialRules: boolean;

  countsForRanking: boolean;
  /** Placar lançado por jogador só vale depois que o adversário confirma. */
  requireConfirmation: boolean;
  courts: number;
  /** Série semanal: quantas competições criar (1 = só esta). */
  repeatWeeks: number;
}

export function emptyForm(): NewCompForm {
  return {
    name: '', format: null, unit: null, gender: null, level: null,
    dateText: '', dateAuto: false, timeText: '', location: '', notes: '',
    registrationOn: false, vagasText: '', noLimit: false, regMode: 'open',
    scheduleOpen: false, opensDateText: '', opensTimeText: '', waitlist: true, cancelHoursText: '10',
    winPts: '3', drawPts: '1', gdPts: '1', tiebreak: 'saldo', thirdPlace: true,
    presetIndex: null, manual: false, sets: null, games: 4, tiebreakPts: 7,
    superTiebreak: false, superTiebreakPts: 10, officialRules: false,
    countsForRanking: true, requireConfirmation: false, courts: 2, repeatWeeks: 1,
  };
}

export const digits = (t: string) => t.replace(/[^0-9]/g, '');

/** Vagas informadas (inteiro > 0) ou null. */
export function parseVagas(text: string): number | null {
  const n = parseInt(digits(text), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Nº de competidores usado nas estimativas: as vagas, quando há. */
export function expectedCompetitors(f: NewCompForm): number | null {
  return f.registrationOn && !f.noLimit ? parseVagas(f.vagasText) : null;
}

/** Rótulos do que falta preencher, na ordem da tela. Vazio = pode criar. */
export function missingFields(f: NewCompForm): string[] {
  const miss: string[] = [];
  if (!f.name.trim()) miss.push('nome');
  if (!f.format) miss.push('tipo de competição');
  if (!f.unit) miss.push('competem em');
  if (!f.gender) miss.push('gênero');
  if (!f.level) miss.push('categoria de nível');
  if (!parseBrDate(f.dateText)) miss.push('data');
  if (f.registrationOn && !parseTime(f.timeText)) miss.push('horário');
  if (f.registrationOn && !f.noLimit && !parseVagas(f.vagasText)) miss.push('vagas ou "sem limite"');
  if (f.presetIndex === null && !(f.manual && f.sets)) miss.push('formato de disputa');
  return miss;
}

export function winRuleOf(f: NewCompForm): WinRule {
  if (f.presetIndex !== null) {
    const p = WIN_RULE_PRESETS[f.presetIndex];
    return {
      sets: p.sets, games: p.games, tiebreak: p.tb, tiebreakAt: p.tbAt,
      superTiebreak: p.stb, superTiebreakPts: p.stbPts, scoutMode: 'avancado',
    };
  }
  const sets = f.sets ?? 1;
  return {
    sets, games: f.games, tiebreak: f.tiebreakPts, tiebreakAt: 'deuce',
    superTiebreak: sets > 1 && f.superTiebreak, superTiebreakPts: f.superTiebreakPts, scoutMode: 'avancado',
  };
}

export function disputeSummary(f: NewCompForm): string | null {
  if (f.presetIndex !== null) {
    const p = WIN_RULE_PRESETS[f.presetIndex];
    return `${p.label} · ${p.desc.toLowerCase()}`;
  }
  if (f.manual && f.sets) {
    const sets = f.sets <= 1 ? '1 set' : `Melhor de ${f.sets}`;
    return `${sets} · ${f.games} games · tie ${f.tiebreakPts}`;
  }
  return null;
}

const num = (t: string, d: number) => {
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : d;
};

/** Monta a competição a criar. `now` só entra para o id e a abertura agendada. */
export function competitionFromForm(f: NewCompForm, creatorId?: string | null): Competition {
  const format = f.format as Format;
  const unit = f.unit as Unit;
  const dateIso = parseBrDate(f.dateText) as string;
  const time = parseTime(f.timeText);
  const vagas = f.registrationOn && !f.noLimit ? parseVagas(f.vagasText) : null;

  const config: CompetitionConfig = {
    rounds: 'single', groups: 2, qualifiers: 2, bestThirds: 0,
    thirdPlace: format === 'mata' ? f.thirdPlace : false,
    winRule: winRuleOf(f),
    useOfficialRules: f.officialRules,
    ...(f.requireConfirmation ? { requireConfirmation: true } : {}),
  };
  if (format === 'super8') {
    config.scoring = { winPts: num(f.winPts, 3), gdPts: num(f.gdPts, 1), tiebreak: f.tiebreak };
  } else if (format === 'liga') {
    config.scoring = { winPts: num(f.winPts, 3), drawPts: num(f.drawPts, 1), tiebreak: f.tiebreak };
  } else if (format === 'grupos') {
    config.scoring = { winPts: num(f.winPts, 3), tiebreak: f.tiebreak };
  }

  let registration: RegistrationSettings | undefined;
  if (f.registrationOn) {
    registration = { mode: f.regMode, waitlist: f.noLimit ? true : f.waitlist };
    const hours = parseInt(digits(f.cancelHoursText), 10);
    if (Number.isFinite(hours) && hours >= 0 && f.cancelHoursText.trim() !== '') registration.cancelHoursBefore = hours;
    const opensDate = parseBrDate(f.opensDateText);
    if (f.scheduleOpen && opensDate) registration.opensAt = `${opensDate}T${parseTime(f.opensTimeText) ?? '00:00'}`;
  }

  const status: Competition['status'] = f.registrationOn ? 'upcoming' : format === 'avulso' ? 'active' : 'setup';

  return {
    id: 'comp_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
    name: f.name.trim(), format, unit, gender: f.gender as Gender,
    status, date: dateIso,
    ...(time ? { time } : {}),
    ...(f.location.trim() ? { location: f.location.trim() } : {}),
    ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
    config, competitors: [], matches: [],
    levelCategory: f.level ?? 'Aberta',
    ...(f.countsForRanking ? {} : { countsForRanking: false }),
    ...(registration ? { registration } : {}),
    ...(vagas ? { vagas } : {}),
    ...(f.registrationOn ? { confirmedIds: creatorId ? [creatorId] : [], waitlistIds: [] } : {}),
    ...(creatorId ? { createdBy: creatorId } : {}),
  };
}

/** Texto do botão de criar. */
export function createLabel(f: NewCompForm): string {
  if (f.repeatWeeks > 1) return `Criar série de ${f.repeatWeeks} competições${f.registrationOn ? ' e abrir inscrições' : ''}`;
  if (f.format === 'avulso') return 'Criar sessão avulsa';
  return f.registrationOn ? 'Criar e abrir inscrições' : 'Criar competição';
}

// ─── Repetir na semana seguinte e série semanal ───────────────────────────────

export const MAX_SERIES_WEEKS = 12;

/** Soma dias a uma data "AAAA-MM-DD" (sem depender de fuso nem de horário de verão). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

const shortBr = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const ORDINAL_RE = /(\d+)\s*ª/;

/** O nome já traz a data (DD/MM ou DD/MM/AAAA) ou um ordinal ("12ª Rodada")? */
function nameHasMarker(name: string, iso: string): boolean {
  return name.includes(isoToBr(iso)) || name.includes(shortBr(iso)) || ORDINAL_RE.test(name);
}

/**
 * Nome da competição da próxima semana: troca a data do nome pela nova, soma 1 ao ordinal
 * ("12ª Rodada" vira "13ª Rodada") e, se o nome não tinha nem data nem ordinal, acrescenta " · DD/MM".
 */
export function nextName(name: string, oldIso: string, newIso: string): string {
  let out = name;
  let changed = false;
  const oldFull = isoToBr(oldIso), newFull = isoToBr(newIso);
  if (out.includes(oldFull)) { out = out.split(oldFull).join(newFull); changed = true; }
  else if (out.includes(shortBr(oldIso))) { out = out.split(shortBr(oldIso)).join(shortBr(newIso)); changed = true; }
  out = out.replace(ORDINAL_RE, (_m, n) => { changed = true; return `${Number(n) + 1}ª`; });
  return changed ? out : `${name} · ${shortBr(newIso)}`;
}

/** Datas da série: a primeira e depois uma por semana. */
export function seriesDates(firstIso: string, count: number): string[] {
  const n = Math.max(1, Math.min(MAX_SERIES_WEEKS, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => addDaysIso(firstIso, 7 * i));
}

/** Nomes da série. Sem data nem ordinal no nome, todas ganham " · DD/MM" para não ficarem iguais. */
export function seriesNames(name: string, dates: string[]): string[] {
  const base = name.trim();
  if (dates.length === 0) return [];
  if (!nameHasMarker(base, dates[0])) return dates.map(d => `${base} · ${shortBr(d)}`);
  const out = [base];
  for (let i = 1; i < dates.length; i++) out.push(nextName(out[i - 1], dates[i - 1], dates[i]));
  return out;
}

/** Formulário preenchido a partir de uma competição existente, para a semana seguinte (data +7 dias). */
export function formFromCompetition(c: Competition, shiftDays = 7): NewCompForm {
  const f = emptyForm();
  const newIso = c.date ? addDaysIso(c.date, shiftDays) : '';
  f.name = c.date ? nextName(c.name, c.date, newIso) : c.name;
  f.format = c.format; f.unit = c.unit; f.gender = c.gender;
  f.level = c.levelCategory ?? 'Aberta';
  f.dateText = isoToBr(newIso); f.timeText = c.time ?? '';
  f.location = c.location ?? ''; f.notes = c.notes ?? '';
  f.countsForRanking = c.countsForRanking !== false;

  const reg = c.registration;
  f.registrationOn = !!reg || c.status === 'upcoming' || c.confirmedIds !== undefined || c.vagas !== undefined;
  if (f.registrationOn) {
    f.noLimit = !c.vagas;
    f.vagasText = c.vagas ? String(c.vagas) : '';
    f.regMode = reg?.mode ?? 'open';
    f.waitlist = reg?.waitlist ?? true;
    if (reg?.cancelHoursBefore != null) f.cancelHoursText = String(reg.cancelHoursBefore);
    if (reg?.opensAt) {
      const [d, t] = reg.opensAt.split('T');
      f.scheduleOpen = true;
      f.opensDateText = isoToBr(addDaysIso(d, shiftDays));
      f.opensTimeText = t ?? '';
    }
  }

  const sc = c.config?.scoring;
  if (sc?.winPts != null) f.winPts = String(sc.winPts);
  if (sc?.drawPts != null) f.drawPts = String(sc.drawPts);
  if (sc?.gdPts != null) f.gdPts = String(sc.gdPts);
  if (sc?.tiebreak) f.tiebreak = sc.tiebreak;
  f.thirdPlace = c.format === 'mata' ? !!c.config?.thirdPlace : true;

  const w = c.config?.winRule;
  if (w?.sets) {
    const idx = WIN_RULE_PRESETS.findIndex(p =>
      p.sets === w.sets && p.games === w.games && p.tb === w.tiebreak && p.tbAt === (w.tiebreakAt ?? 'deuce') && p.stb === !!w.superTiebreak);
    if (idx >= 0) f.presetIndex = idx;
    else {
      f.manual = true; f.sets = w.sets; f.games = w.games ?? 4; f.tiebreakPts = w.tiebreak ?? 7;
      f.superTiebreak = !!w.superTiebreak; f.superTiebreakPts = w.superTiebreakPts ?? 10;
    }
  }
  f.officialRules = !!c.config?.useOfficialRules;
  f.requireConfirmation = !!c.config?.requireConfirmation;
  return f;
}

/** Uma competição, ou a série semanal inteira (datas, nomes e abertura agendada deslocados semana a semana). */
export function competitionsFromForm(f: NewCompForm, creatorId?: string | null): Competition[] {
  const first = parseBrDate(f.dateText);
  const count = Math.max(1, Math.min(MAX_SERIES_WEEKS, Math.floor(f.repeatWeeks || 1)));
  if (count === 1 || !first) return [competitionFromForm(f, creatorId)];
  const dates = seriesDates(first, count);
  const names = seriesNames(f.name, dates);
  const opens0 = f.scheduleOpen ? parseBrDate(f.opensDateText) : null;
  return dates.map((d, i) => competitionFromForm({
    ...f, repeatWeeks: 1, name: names[i], dateText: isoToBr(d),
    ...(opens0 ? { opensDateText: isoToBr(addDaysIso(opens0, 7 * i)) } : {}),
  }, creatorId));
}

// ─── Rascunho ─────────────────────────────────────────────────────────────────

export const DRAFT_KEY = 'kingbt:newCompetitionDraft';

export function serializeDraft(f: NewCompForm, savedAt: Date = new Date()): string {
  return JSON.stringify({ v: 1, savedAt: savedAt.toISOString(), form: f });
}

/** Lê o rascunho tolerando lixo: campos ausentes ou de tipo errado ficam no padrão. */
export function parseDraft(raw: string | null | undefined): { form: NewCompForm; savedAt: Date } | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || o.v !== 1 || !o.form || typeof o.form !== 'object') return null;
    const base = emptyForm() as unknown as Record<string, unknown>;
    const src = o.form as Record<string, unknown>;
    for (const k of Object.keys(base)) {
      if (k in src && (typeof src[k] === typeof base[k] || (base[k] === null && (src[k] === null || typeof src[k] === 'string' || typeof src[k] === 'number')))) {
        base[k] = src[k];
      }
    }
    if (!FORMAT_ORDER.includes(base.format as Format)) base.format = null;
    if (base.unit !== 'individual' && base.unit !== 'duplas') base.unit = null;
    if (!GENDERS.some(g => g.value === base.gender)) base.gender = null;
    if (base.level !== null && !(LEVELS as readonly string[]).includes(base.level as string)) base.level = null;
    if (!['open', 'closed', 'adminOnly'].includes(base.regMode as string)) base.regMode = 'open';
    const savedAt = new Date(o.savedAt);
    return { form: base as unknown as NewCompForm, savedAt: Number.isNaN(savedAt.getTime()) ? new Date() : savedAt };
  } catch {
    return null;
  }
}

export function hasDraftContent(f: NewCompForm): boolean {
  const e = emptyForm();
  return (Object.keys(e) as (keyof NewCompForm)[]).some(k => k !== 'dateAuto' && f[k] !== e[k]);
}

// ─── Inscrições e categoria de nível ──────────────────────────────────────────

/** 'Aberta' (ou ausente) libera todos; uma categoria libera só quem tem a mesma no perfil. */
export function levelAllows(level: string | undefined | null, playerCategory: string | undefined | null): boolean {
  if (!level || level === 'Aberta') return true;
  return playerCategory === level;
}

export function levelBlockedMessage(level: string, playerCategory: string | undefined | null): string {
  return playerCategory
    ? `Competição da categoria ${level}. Seu perfil está como ${playerCategory}.`
    : `Competição da categoria ${level}. Informe sua categoria no perfil (aba Sobre) para se inscrever.`;
}

const startOf = (c: Pick<Competition, 'date' | 'time'>): Date | null => {
  if (!c.date) return null;
  const d = new Date(`${c.date}T${c.time ?? '00:00'}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export type Gate = { ok: true } | { ok: false; reason: string };

/** Pode ESTE jogador se inscrever agora? (cancelar/sair da fila segue `canCancelRegistration`.) */
export function registrationGate(
  c: Pick<Competition, 'status' | 'registration' | 'levelCategory' | 'vagas' | 'confirmedIds'>,
  playerCategory: string | undefined | null,
  now: Date = new Date(),
): Gate {
  if (c.status !== 'upcoming') return { ok: false, reason: 'As inscrições estão encerradas.' };
  const r = c.registration;
  if (r?.mode === 'closed') return { ok: false, reason: 'As inscrições estão fechadas.' };
  if (r?.mode === 'adminOnly') return { ok: false, reason: 'Nesta competição só o admin adiciona os jogadores.' };
  if (r?.opensAt) {
    const opens = new Date(r.opensAt + ':00');
    if (!Number.isNaN(opens.getTime()) && now < opens) {
      const p = (n: number) => String(n).padStart(2, '0');
      return { ok: false, reason: `As inscrições abrem em ${p(opens.getDate())}/${p(opens.getMonth() + 1)} às ${p(opens.getHours())}:${p(opens.getMinutes())}.` };
    }
  }
  if (!levelAllows(c.levelCategory, playerCategory)) {
    return { ok: false, reason: levelBlockedMessage(c.levelCategory as string, playerCategory) };
  }
  return { ok: true };
}

/** Prazo de cancelamento: com "cancelar até X h antes", depois disso não dá mais para sair sozinho. */
export function canCancelRegistration(c: Pick<Competition, 'registration' | 'date' | 'time'>, now: Date = new Date()): boolean {
  const h = c.registration?.cancelHoursBefore;
  if (h == null) return true;
  const start = startOf(c);
  if (!start) return true;
  return now.getTime() <= start.getTime() - h * 3600_000;
}

// ─── Montar: da lista fechada aos jogos ───────────────────────────────────────

export interface PlayerLite { id: string; name: string; color: string; handicap?: number }

export function competitorsFromPlayers(ids: string[], players: PlayerLite[]): Competitor[] {
  const out: Competitor[] = [];
  for (const id of ids) {
    const pl = players.find(p => p.id === id);
    if (pl) out.push({ id, name: pl.name, short: pl.name.slice(0, 3).toUpperCase(), color: pl.color, members: [id] });
  }
  return out;
}

/** Duplas fixas a partir de pares de ids de jogadores. */
export function competitorsFromPairs(pairs: [string, string][], players: PlayerLite[]): Competitor[] {
  const out: Competitor[] = [];
  pairs.forEach(([aId, bId], i) => {
    const a = players.find(p => p.id === aId), b = players.find(p => p.id === bId);
    if (!a || !b) return;
    out.push({
      id: `d${i}`, name: `${a.name.split(' ')[0]}/${b.name.split(' ')[0]}`,
      short: `${a.name[0]}${b.name[0]}`, color: a.color, members: [aId, bId],
    });
  });
  return out;
}

export function shuffled<T>(list: T[], rng: () => number = Math.random): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Distribution = 'auto' | 'ranking' | 'manual';

export interface SetupOptions {
  rounds: 'single' | 'double';
  groups: number;
  qualifiers: number;
  bestThirds: number;
  distribution: Distribution;
  /** Distribuição manual: ids dos competidores por grupo. */
  manualGroups?: string[][];
  /** Ids dos competidores do melhor para o pior (distribuição "por ranking"). */
  rankingOrder?: string[];
  rng?: () => number;
}

/** O que impede de gerar os jogos (vazio = pode). */
export function setupBlockers(format: Format, n: number, o: Pick<SetupOptions, 'groups' | 'qualifiers' | 'bestThirds' | 'distribution' | 'manualGroups'>): string[] {
  const b: string[] = [];
  if (n < 2) return ['É preciso ao menos 2 competidores.'];
  if (format === 'grupos') {
    const sizes = o.distribution === 'manual' && o.manualGroups ? o.manualGroups.map(g => g.length) : groupSizes(n, o.groups);
    if (n < o.groups * 2) b.push('Há mais grupos do que o possível: cada grupo precisa de ao menos 2 competidores.');
    else if (sizes.some(s => s < 2)) b.push('Todo grupo precisa de ao menos 2 competidores.');
    if (o.qualifiers < 1) b.push('Defina ao menos 1 classificado por grupo.');
    if (o.groups * o.qualifiers + o.bestThirds < 2) b.push('O mata-mata precisa de ao menos 2 classificados.');
  }
  return b;
}

/** Avisos que não impedem de gerar. */
export function setupWarnings(format: Format, n: number, o: Pick<SetupOptions, 'groups' | 'qualifiers' | 'bestThirds' | 'distribution' | 'manualGroups'>): string[] {
  const w: string[] = [];
  if (format !== 'grupos') return planWarnings(format, n);
  const sizes = o.distribution === 'manual' && o.manualGroups ? o.manualGroups.map(g => g.length) : groupSizes(n, o.groups);
  const total = o.groups * o.qualifiers + o.bestThirds;
  if (sizes.length && o.qualifiers > Math.min(...sizes)) w.push('Há grupo com menos jogadores do que classificados por grupo.');
  if (o.bestThirds > o.groups) w.push('Não há tantos 3ºs colocados: reduza os melhores 3ºs.');
  if (o.bestThirds > 0 && sizes.length && Math.min(...sizes) < 3) w.push('Há grupo com menos de 3 jogadores: ele não tem 3º colocado.');
  if (total > 1 && (total & (total - 1)) !== 0) w.push(`${total} não é potência de 2: confira como fica o chaveamento.`);
  return [...planWarnings(format, n), ...w];
}

/** Gera grupos/jogos/chave a partir dos competidores já escolhidos. status → 'active'. */
export function applySetup(comp: Competition, o: SetupOptions, scoring?: ScoringConfig): Competition {
  const ids = comp.competitors.map(c => c.id);
  const rng = o.rng ?? Math.random;
  const next: Competition = {
    ...comp, status: 'active', groupDefs: undefined, matches: [],
    config: { ...comp.config, rounds: o.rounds, groups: o.groups, qualifiers: o.qualifiers, bestThirds: o.bestThirds },
  };
  const ordered = () =>
    o.distribution === 'ranking' && o.rankingOrder
      ? [...ids].sort((a, b) => {
          const ra = o.rankingOrder!.indexOf(a), rb = o.rankingOrder!.indexOf(b);
          return (ra < 0 ? 9999 : ra) - (rb < 0 ? 9999 : rb);
        })
      : shuffled(ids, rng);

  if (comp.format === 'liga') {
    next.matches = genLeague(ids, o.rounds === 'double');
  } else if (comp.format === 'mata') {
    next.matches = genBracket(ordered(), comp.config.thirdPlace, 'K');
  } else if (comp.format === 'grupos') {
    const dbl = o.rounds === 'double';
    const r = o.distribution === 'manual' && o.manualGroups
      ? genGroupsManual(o.manualGroups.filter(g => g.length > 0), dbl, o.qualifiers, comp.config.thirdPlace, o.bestThirds)
      : genGroups(ordered(), o.groups, dbl, o.qualifiers, comp.config.thirdPlace, o.bestThirds);
    next.groupDefs = r.groupDefs;
    next.matches = r.matches;
  }
  if (next.groupDefs === undefined) delete next.groupDefs;
  resolveCompetition(next, scoring);
  return next;
}

/**
 * Fecha a lista de uma competição com inscrições. Liga/Grupos/Mata passam a
 * 'setup' (o admin monta); Super 8 gera as duplas/jogos; Avulso só ativa.
 */
export function closeRegistration(comp: Competition, players: PlayerLite[]): Competition {
  const confirmed = comp.confirmedIds ?? [];
  const individuals = competitorsFromPlayers(confirmed, players);
  if (comp.format === 'avulso') return { ...comp, status: 'active', competitors: individuals };
  if (comp.format === 'super8') {
    const matches = comp.unit === 'duplas'
      ? generateSchedule(individuals.map(c => ({ id: c.id, handicap: players.find(p => p.id === c.id)?.handicap })))
      : generateScheduleIndividual(individuals);
    return { ...comp, status: 'active', competitors: individuals, matches };
  }
  return { ...comp, status: 'setup', competitors: comp.unit === 'duplas' ? [] : individuals, matches: [] };
}
