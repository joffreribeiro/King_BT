/**
 * Falhas ao gravar no aparelho (memória cheia, armazenamento indisponível). O AsyncStorage guarda a
 * marcação ponto a ponto; se a gravação falha, o jogo continua na tela mas nada fica salvo localmente —
 * e antes ninguém era avisado. Aqui ficam as gravações que falharam, para avisar e tentar de novo.
 */
type Gravar = () => Promise<void>;

const pendentes = new Map<string, Gravar>();
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach(f => f());

/** A gravação de `chave` falhou: guarda como tentar de novo (só a mais recente por chave). */
export function falhouGravar(chave: string, tentar: Gravar): void {
  pendentes.set(chave, tentar);
  avisar();
}

/** A gravação de `chave` deu certo: sai da lista de pendentes. */
export function gravouOk(chave: string): void {
  if (pendentes.delete(chave)) avisar();
}

export function totalFalhasArmazenamento(): number {
  return pendentes.size;
}

/** Tenta de novo tudo que falhou; devolve quantas continuam falhando. */
export async function tentarGravarDeNovo(): Promise<number> {
  for (const [chave, tentar] of [...pendentes]) {
    try { await tentar(); pendentes.delete(chave); } catch { /* continua pendente */ }
  }
  avisar();
  return pendentes.size;
}

export function assinarFalhasArmazenamento(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => { ouvintes.delete(fn); };
}

/** Só para testes. */
export function limparFalhasArmazenamento(): void {
  pendentes.clear();
  ouvintes.clear();
}
