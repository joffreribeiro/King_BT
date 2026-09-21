import type { PlayerInfo } from './types';

/** Forma mínima aceita por resolvePlayer — qualquer lista de jogadores com id/name/color. */
export type PlayerSource = { id: string; name: string; color: string };

/**
 * Busca um jogador pelo id numa lista real de jogadores do grupo. Sem
 * match, retorna undefined — nunca inventa dados. Fica em src/logic/ (não
 * em src/store/) de propósito: assim não arrasta nenhum SDK ou dependência
 * de runtime, e pode ser testado importando só esta função.
 */
export function resolvePlayer(players: PlayerSource[], id: string): PlayerInfo | undefined {
  const p = players.find(x => x.id === id);
  return p ? { id: p.id, name: p.name, color: p.color } : undefined;
}
