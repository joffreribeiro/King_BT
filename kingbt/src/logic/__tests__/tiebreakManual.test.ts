import { erroTiebreak, erroTiebreakLivre, setTerminouEmTiebreak } from '../tiebreakManual';

describe('setTerminouEmTiebreak', () => {
  it('só 4×3 (tie em 3) ou 5×4 (tie em 4) terminam em tie-break', () => {
    expect(setTerminouEmTiebreak(4, 3, 3)).toBe(true);
    expect(setTerminouEmTiebreak(3, 4, 3)).toBe(true);
    expect(setTerminouEmTiebreak(5, 4, 4)).toBe(true);
    expect(setTerminouEmTiebreak(4, 2, 3)).toBe(false); // set normal
    expect(setTerminouEmTiebreak(3, 3, 3)).toBe(false); // ainda empatado
    expect(setTerminouEmTiebreak(6, 4, 4)).toBe(false); // vantagem de 2, sem tie-break
  });
});

describe('erroTiebreakLivre (Avulso, formato indefinido)', () => {
  it('exige os dois lados e um vencedor nos games', () => {
    expect(erroTiebreakLivre(4, 3, '', '')).toMatch(/Informe os pontos/);
    expect(erroTiebreakLivre(4, 3, '7', '')).toMatch(/Informe os pontos/);
    expect(erroTiebreakLivre(3, 3, '7', '5')).toMatch(/vencedor nos games/);
  });

  it('o vencedor do set (mais games) precisa ter mais pontos, sem exigir limite', () => {
    expect(erroTiebreakLivre(4, 3, '7', '5')).toBeNull();
    expect(erroTiebreakLivre(4, 3, '5', '3')).toBeNull(); // tie-break a 5: sem limite fixo
    expect(erroTiebreakLivre(3, 4, '5', '7')).toBeNull();
    expect(erroTiebreakLivre(4, 3, '5', '7')).toMatch(/mais pontos/);
    expect(erroTiebreakLivre(4, 3, '5', '5')).toMatch(/mais pontos/);
  });
});

describe('erroTiebreak', () => {
  it('é obrigatório: em branco ou só um lado preenchido são erro', () => {
    expect(erroTiebreak(4, 3, '', '', 7)).toMatch(/Informe os pontos/);
    expect(erroTiebreak(4, 3, undefined, undefined, 7)).toMatch(/Informe os pontos/);
    expect(erroTiebreak(4, 3, '7', '', 7)).toMatch(/dois lados/);
  });

  it('aceita 7–5, 7–0 e tie-break estendido 9–7', () => {
    expect(erroTiebreak(4, 3, '7', '5', 7)).toBeNull();
    expect(erroTiebreak(4, 3, '7', '0', 7)).toBeNull();
    expect(erroTiebreak(4, 3, '9', '7', 7)).toBeNull();
  });

  it('o lado do vencedor segue os games (set 3×4: quem ganhou foi B)', () => {
    expect(erroTiebreak(3, 4, '5', '7', 7)).toBeNull();
    expect(erroTiebreak(3, 4, '7', '5', 7)).toMatch(/mais pontos/);
  });

  it('recusa placar que não fecha o tie-break', () => {
    expect(erroTiebreak(4, 3, '7', '6', 7)).toMatch(/2 de diferença/); // falta diferença
    expect(erroTiebreak(4, 3, '5', '3', 7)).toMatch(/vai a 7/);        // não chegou ao limite
    expect(erroTiebreak(4, 3, '5', '5', 7)).toMatch(/mais pontos/);    // empate
    expect(erroTiebreak(4, 3, '3', '0', 3)).toBeNull(); // com limite 3, 3–0 é válido
  });

  it('respeita o limite da regra (tie-break a 10)', () => {
    expect(erroTiebreak(4, 3, '10', '8', 10)).toBeNull();
    expect(erroTiebreak(4, 3, '7', '2', 10)).toMatch(/vai a 10/);
  });
});
