import { resolvePlayer, type PlayerSource } from '@/logic/players';

// resolvePlayer (usado por MatchRow, StandingsTable, ranking, etc. via
// useGroupPlayers().findPlayer, que agora só delega para esta função) buscava,
// quando não achava o jogador real, um fallback em @/mocks/data — um array
// fixo de 7 jogadores fictícios (ids 'p1'..'p7', nomes "Joffre", "Marcelão"...).
// Como os ids reais do Firestore nunca colidem com esses, a função sempre
// "achava" alguém (undefined nunca acontecia de verdade) ou, em casos de má
// sorte de colisão de id, devolvia um nome TOTALMENTE ERRADO com aparência válida.

const grupo: PlayerSource[] = [
  { id: 'firestore-abc123', name: 'Ana', color: '#FFD166' },
  { id: 'firestore-def456', name: 'Bruno', color: '#2DD4BF' },
];

describe('resolvePlayer — sem fallback para dados fictícios', () => {
  it('encontra um jogador real do grupo', () => {
    expect(resolvePlayer(grupo, 'firestore-abc123')).toEqual({
      id: 'firestore-abc123', name: 'Ana', color: '#FFD166',
    });
  });

  it('jogador que não está no grupo retorna undefined — não um mock', () => {
    // 'p1' é exatamente o id que o antigo array mockado usava para "Joffre".
    // Antes desta correção, isso retornava { name: 'Joffre', ... } mesmo
    // sem nenhum jogador 'p1' cadastrado no grupo.
    expect(resolvePlayer(grupo, 'p1')).toBeUndefined();
  });

  it('grupo vazio (ainda carregando do Firestore): undefined, nunca dado fictício', () => {
    expect(resolvePlayer([], 'p1')).toBeUndefined();
    expect(resolvePlayer([], 'qualquer-id')).toBeUndefined();
  });
});
