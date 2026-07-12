jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { novoTreino, ajustarContagem, calcularAnaliseTreino, TREINO_GOLPES } from '../btTreino';

describe('TREINO_GOLPES — catálogo de golpes', () => {
  it('tem 29 linhas, no padrão do BT Tracker (golpes com FH/BH + golpes únicos + 3 saques)', () => {
    expect(TREINO_GOLPES.length).toBe(29);
  });

  it('tem chaves únicas', () => {
    const keys = TREINO_GOLPES.map(g => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('calcularAnaliseTreino', () => {
  it('retorna tudo vazio para um treino sem golpes registrados', () => {
    const treino = novoTreino('g1', 'p1', 'Treino teste');
    const analise = calcularAnaliseTreino(treino);
    expect(analise.totalTentativas).toBe(0);
    expect(analise.aproveitamentoGeral).toBe(0);
    expect(analise.melhorGolpe).toBeNull();
    expect(analise.piorGolpe).toBeNull();
  });

  it('calcula aproveitamento geral e melhor/pior golpe respeitando o mínimo de 4 tentativas', () => {
    let treino = novoTreino('g1', 'p1', 'Treino teste');
    // Saque: 4 bons, 0 ruins → 100% (qualifica, min 4 tentativas)
    for (let i = 0; i < 4; i++) treino = ajustarContagem(treino, 'Saque', 'bom', 1);
    // Smash: 1 bom, 3 ruins → 25% mas só 4 tentativas, qualifica
    treino = ajustarContagem(treino, 'Smash', 'bom', 1);
    treino = ajustarContagem(treino, 'Smash', 'ruim', 1);
    treino = ajustarContagem(treino, 'Smash', 'ruim', 1);
    treino = ajustarContagem(treino, 'Smash', 'ruim', 1);
    // Gancho: só 2 tentativas (não deve qualificar para melhor/pior)
    treino = ajustarContagem(treino, 'Gancho', 'bom', 1);
    treino = ajustarContagem(treino, 'Gancho', 'bom', 1);

    const analise = calcularAnaliseTreino(treino);
    expect(analise.totalTentativas).toBe(10);
    expect(analise.melhorGolpe?.key).toBe('Saque');
    expect(analise.melhorGolpe?.pct).toBe(100);
    expect(analise.piorGolpe?.key).toBe('Smash');
    expect(analise.piorGolpe?.pct).toBe(25);
    expect(analise.maisUtilizado?.key).toBe('Saque');
  });

  it('ajustarContagem nunca deixa a contagem ficar negativa', () => {
    const treino = novoTreino('g1', 'p1', 'Treino teste');
    const ajustado = ajustarContagem(treino, 'Saque', 'bom', -1);
    expect(ajustado.contagens['Saque'].bom).toBe(0);
  });
});
