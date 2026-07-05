import { router } from 'expo-router';

export function goToPlayer(id: string) {
  router.push({ pathname: '/player/[id]', params: { id } });
}
