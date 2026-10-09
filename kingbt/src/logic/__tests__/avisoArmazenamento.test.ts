import {
  falhouGravar, gravouOk, totalFalhasArmazenamento, tentarGravarDeNovo, assinarFalhasArmazenamento, limparFalhasArmazenamento,
} from '../avisoArmazenamento';

beforeEach(() => limparFalhasArmazenamento());

describe('avisoArmazenamento', () => {
  it('conta falhas por chave e limpa quando a gravação dá certo', () => {
    falhouGravar('a', async () => {});
    falhouGravar('a', async () => {});
    falhouGravar('b', async () => {});
    expect(totalFalhasArmazenamento()).toBe(2);
    gravouOk('a');
    expect(totalFalhasArmazenamento()).toBe(1);
  });

  it('tentar de novo remove as que passam e mantém as que ainda falham', async () => {
    falhouGravar('ok', async () => {});
    falhouGravar('ruim', async () => { throw new Error('cheio'); });
    expect(await tentarGravarDeNovo()).toBe(1);
    expect(totalFalhasArmazenamento()).toBe(1);
  });

  it('avisa quem assinou a cada mudança', () => {
    const fn = jest.fn();
    const cancela = assinarFalhasArmazenamento(fn);
    falhouGravar('a', async () => {});
    gravouOk('a');
    expect(fn).toHaveBeenCalledTimes(2);
    cancela();
    falhouGravar('b', async () => {});
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
