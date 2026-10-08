import { setFoiFechado, type BtPlacarSeed, type BtWinRule } from './btTracker';
import { tieAtGames } from './setOutcome';

export interface ResultadoValidacaoSeed { valido: boolean; erro?: string }

/**
 * Valida o placar de uma partida já em andamento contra a regra da competição, antes de deixar o scout
 * começar dele. Usa a mesma conta que fecha um set ao vivo (`setFoiFechado`), então os dois nunca
 * divergem sobre o que é um set decidido. Portado de seedValidacao.ts do scout do KING BT Playbook.
 */
export function validarSeed(rule: BtWinRule, seed: BtPlacarSeed): ResultadoValidacaoSeed {
  const { gamesA, gamesB } = seed;
  const fechados = seed.setsFechados ?? [];

  // Cada set já jogado tem que ser um set realmente fechado nesta regra
  for (let i = 0; i < fechados.length; i++) {
    const { a, b } = fechados[i];
    const n = i + 1;
    if (a < 0 || b < 0) return { valido: false, erro: `Set ${n}: games não podem ser negativos.` };
    const venc = Math.max(a, b), perd = Math.min(a, b);
    // Fechado agora, mas não um game antes — senão o set teria acabado antes (ex.: 6x0 num set de 4 games)
    const fechaAgora = setFoiFechado(venc, perd, rule);
    const fechavaAntes = setFoiFechado(venc - 1, perd, rule) || setFoiFechado(perd, venc - 1, rule);
    if (!fechaAgora || fechavaAntes) {
      return { valido: false, erro: `Set ${n}: ${a}x${b} não é um placar final de set nesse formato.` };
    }
  }

  const setsA = fechados.filter(x => x.a > x.b).length;
  const setsB = fechados.filter(x => x.b > x.a).length;
  if (gamesA < 0 || gamesB < 0) return { valido: false, erro: 'Games não podem ser negativos.' };

  const setsParaVencer = Math.ceil(rule.sets / 2);
  const maxSetsPorLado = setsParaVencer - 1;
  if (setsA > maxSetsPorLado || setsB > maxSetsPorLado) {
    return {
      valido: false,
      erro: `Esse placar de sets já decidiria a partida — no máximo ${maxSetsPorLado} set${maxSetsPorLado === 1 ? '' : 's'} por dupla nesse formato.`,
    };
  }

  const T = tieAtGames(rule.games, rule.tiebreakAt);
  if (gamesA > T || gamesB > T) {
    return { valido: false, erro: `Games acima do máximo do set nesse formato (máximo ${T}).` };
  }
  if (setFoiFechado(gamesA, gamesB, rule) || setFoiFechado(gamesB, gamesA, rule)) {
    return { valido: false, erro: 'Esse placar de games já teria fechado o set.' };
  }

  // Set decisivo em super tie-break é disputado em pontos, não em games
  const noSuperTiebreak = !!rule.superTiebreak && setsA === maxSetsPorLado && setsB === maxSetsPorLado;
  if (noSuperTiebreak && (gamesA > 0 || gamesB > 0)) {
    return { valido: false, erro: 'Com sets empatados, o set decisivo é o super tie-break — deixe os games do set atual em 0.' };
  }
  return { valido: true };
}
