import { devePedirDeNovo, BIOMETRIA_LIMITE_MS } from '../biometria';

describe('devePedirDeNovo', () => {
  it('não pede se o app não saiu do primeiro plano', () => {
    expect(devePedirDeNovo(null, 1_000_000)).toBe(false);
  });
  it('não pede numa saída curta', () => {
    expect(devePedirDeNovo(1000, 1000 + BIOMETRIA_LIMITE_MS - 1)).toBe(false);
  });
  it('pede depois do limite', () => {
    expect(devePedirDeNovo(1000, 1000 + BIOMETRIA_LIMITE_MS)).toBe(true);
  });
});
