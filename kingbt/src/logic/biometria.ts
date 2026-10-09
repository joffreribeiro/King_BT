/** Depois de quanto tempo em segundo plano o app volta a pedir a biometria (ms). */
export const BIOMETRIA_LIMITE_MS = 60_000;

/**
 * O app voltou ao primeiro plano: precisa pedir a biometria de novo?
 * `saiuEm` é o instante em que foi para segundo plano (null = não saiu). Trocar rápido de app
 * (atender uma mensagem, por exemplo) não deve trancar o jogo que está sendo marcado.
 */
export function devePedirDeNovo(saiuEm: number | null, agora: number, limite = BIOMETRIA_LIMITE_MS): boolean {
  return saiuEm != null && agora - saiuEm >= limite;
}
