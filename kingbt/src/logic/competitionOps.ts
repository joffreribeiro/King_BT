import type { Competition, Match, SetScore } from './types';
import { resolveCompetition } from './formats';
import { DEFAULT_SCORING, type ScoringConfig } from './scoringConfig';

/**
 * Operações que produzem a próxima versão de uma competição.
 *
 * Moradas aqui, e não dentro do contexto React, porque rodam em dois lugares:
 * na tela (estado local, resposta imediata) e de novo dentro da transação que
 * grava no Firestore, sobre a versão que veio do servidor. É a mesma função
 * nos dois casos — se divergissem, o que a pessoa vê e o que fica salvo
 * também divergiriam.
 */

/** Recalcula chaveamento e status depois de mexer nos jogos. */
function reavaliar(comp: Competition, updated: Competition, cfg: ScoringConfig): Competition {
  resolveCompetition(updated, cfg);
  // Avulso é uma sessão livre: não fecha sozinha ao "esgotar" os jogos
  // registrados até agora — só o usuário encerra manualmente.
  if (comp.format === 'avulso') return updated;
  const scoreable = updated.matches.filter(
    m => (m.aId != null && m.bId != null) || (m.teamA && m.teamB)
  );
  updated.status = scoreable.length > 0 && scoreable.every(m => m.scoreA != null)
    ? 'done' : 'active';
  return updated;
}

/** Registra (ou corrige) o placar de um jogo. */
export function applyScore(
  comp: Competition,
  matchId: string,
  scoreA: number,
  scoreB: number,
  sets?: SetScore[],
  cfg: ScoringConfig = DEFAULT_SCORING,
): Competition {
  return reavaliar(comp, {
    ...comp,
    matches: comp.matches.map(m =>
      m.id === matchId
        ? {
            ...m,
            scoreA, scoreB,
            ...(sets ? { sets } : {}),
            // Só carimba na PRIMEIRA vez que o jogo recebe placar — uma
            // correção posterior (CORRECT_SCORE) não deve fingir que o jogo
            // foi jogado agora. Sem isso o campo nunca era gravado, e a aba
            // de notificações (que filtra por `playedAt` em
            // useNotifications.ts) ficava sempre vazia.
            playedAt: m.playedAt ?? new Date().toISOString(),
          }
        : m
    ),
  }, cfg);
}

/**
 * Troca a lista de jogos e reavalia chaveamento e status.
 * Excluir um jogo ou trocar quem jogou muda quem está classificado e se a
 * competição ainda tem jogo pendente, então não dá pra só mexer no array.
 */
export function withMatches(
  comp: Competition,
  matches: Match[],
  cfg: ScoringConfig = DEFAULT_SCORING,
): Competition {
  return reavaliar(comp, { ...comp, matches }, cfg);
}

/** Apaga o placar de um jogo já registrado. */
export function clearScore(
  comp: Competition,
  matchId: string,
  cfg: ScoringConfig = DEFAULT_SCORING,
): Competition {
  return reavaliar(comp, {
    ...comp,
    matches: comp.matches.map(m =>
      m.id === matchId
        ? {
            ...m,
            scoreA: null, scoreB: null,
            // Some junto com o placar: se o jogo for registrado de novo mais
            // tarde, é o applyScore daquele momento que deve carimbar a data
            // real, não a da tentativa apagada.
            playedAt: null,
          }
        : m
    ),
  }, cfg);
}
