import { resolverNomes, JOGADOR_REMOVIDO } from '../btNomes';
import type { BtAnalise } from '../btTracker';

const base = (nomes: Record<string, string>) => ({ jogadores: { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2' }, nomes } as unknown as BtAnalise);

describe('resolverNomes', () => {
  it('usa o nome atual do grupo quando o jogador existe', () => {
    const r = resolverNomes(base({ A1: 'Antigo' }), id => (id === 'A1' ? 'Ana' : undefined));
    expect(r.nomes.A1).toBe('Ana');
  });
  it('mantém o nome salvo quando o jogador saiu do grupo', () => {
    expect(resolverNomes(base({ A2: 'Ari Souza' }), () => undefined).nomes.A2).toBe('Ari Souza');
  });
  it('troca o id cru por "Jogador removido"', () => {
    const r = resolverNomes(base({ B1: 'B1' }), () => undefined);
    expect(r.nomes.B1).toBe(JOGADOR_REMOVIDO);
    expect(r.nomes.B2).toBe(JOGADOR_REMOVIDO);
  });
});
