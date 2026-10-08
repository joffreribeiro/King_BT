import type { BtAnalise } from './btTracker';

export const JOGADOR_REMOVIDO = 'Jogador removido';

/**
 * Nomes de exibição de uma análise. A análise guarda `nomes[id]`, mas quando o jogador não era
 * encontrado na hora de gravar o "nome" salvo foi o próprio id (ex.: "u_8f3k…"). Aqui o nome vem do
 * grupo atual se o jogador ainda existe; senão, o nome salvo; e se o salvo é só o id, "Jogador removido".
 */
export function resolverNomes(a: BtAnalise, nomeNoGrupo: (id: string) => string | undefined): BtAnalise {
  const nomes: Record<string, string> = { ...a.nomes };
  for (const id of Object.values(a.jogadores)) {
    if (!id) continue;
    const salvo = nomes[id];
    nomes[id] = nomeNoGrupo(id) ?? (salvo && salvo !== id ? salvo : JOGADOR_REMOVIDO);
  }
  return { ...a, nomes };
}
