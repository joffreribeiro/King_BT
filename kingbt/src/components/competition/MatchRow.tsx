import type { Match, Competition } from '@/logic/types';
import { getPlayer, getCompetitor, srcLabel, isByeSlot } from './helpers';
import { ScoreboardCard, type ScoreSide } from './ScoreboardCard';

// Jogo de liga/grupos/mata-mata (competidores via aId/bId, com BYE e placeholders)
export function MatchRow({ match: m, comp, isNext, onPress, onLongPress }: {
  match: Match; comp: Competition; isNext: boolean;
  onPress: () => void; onLongPress?: () => void;
}) {
  const cA = m.aId ? getCompetitor(comp, m.aId) : null;
  const cB = m.bId ? getCompetitor(comp, m.bId) : null;
  const pA = cA?.members[0] ? getPlayer(cA.members[0]) : null;
  const pB = cB?.members[0] ? getPlayer(cB.members[0]) : null;
  const byeA = isByeSlot(m.aId, m.aSrc);
  const byeB = isByeSlot(m.bId, m.bSrc);
  const pending = !cA || !cB;

  const side = (c: typeof cA, p: typeof pA, bye: boolean, src: Match['aSrc']): ScoreSide => ({
    label: c?.name ?? (bye ? 'BYE' : srcLabel(comp, src) ?? 'A definir'),
    players: c && p && !bye ? [{ name: p.name, color: p.color }] : undefined,
    placeholder: !c && !bye,
    bye,
  });

  return (
    <ScoreboardCard
      match={m}
      sideA={side(cA, pA, byeA, m.aSrc)}
      sideB={side(cB, pB, byeB, m.bSrc)}
      isNext={isNext}
      pending={pending}
      onPress={onPress}
      onLongPress={onLongPress}
    />
  );
}
