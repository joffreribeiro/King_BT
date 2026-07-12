import { router } from 'expo-router';

export function goToPlayer(id: string) {
  router.push({ pathname: '/player/[id]', params: { id } });
}

export function goToTreino(treinoId: string, playerId: string) {
  router.push({ pathname: '/treino/[treinoId]', params: { treinoId, playerId } });
}

export function goToTrilha(competitionId: string, playerId: string) {
  router.push({ pathname: '/trilha', params: { competitionId, playerId } });
}
