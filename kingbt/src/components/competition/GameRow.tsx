import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';
import { ScoreboardCard } from './ScoreboardCard';

// Jogo de Super 8 / Americano / Avulso (times via teamA/teamB de ids de jogadores)
export function GameRow({ match: m, index, comp, isNext, onPress, onLongPress, canEdit = false }: {
  match: Match; index?: number; comp: Competition; isNext: boolean;
  onPress: () => void; onLongPress?: () => void;
  /** Admin: anuncia na dica que o toque longo abre a edição do jogo. */
  canEdit?: boolean;
}) {
  const { findPlayer } = useGroupPlayers();
  const pA = (m.teamA ?? []).map(id => findPlayer(id)).filter(Boolean) as { name: string; color: string }[];
  const pB = (m.teamB ?? []).map(id => findPlayer(id)).filter(Boolean) as { name: string; color: string }[];

  const label = (ps: { name: string }[]) =>
    ps.map(p => p.name.split(' ')[0]).join(' / ') || '?';

  return (
    <ScoreboardCard
      match={m}
      sideA={{ label: label(pA), players: pA }}
      sideB={{ label: label(pB), players: pB }}
      isNext={isNext}
      hint={
        m.scoreA == null && !m.liveScore
          ? (canEdit ? 'Toque para registrar placar · segure para editar' : 'Toque para registrar placar')
          : (canEdit ? 'Segure para corrigir, trocar jogadores ou excluir' : null)
      }
      onPress={onPress}
      onLongPress={onLongPress}
    />
  );
}
