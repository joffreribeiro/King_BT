/**
 * Rating/pontuação do jogador. Consolida ~15 pontos que formatavam cada um
 * do seu jeito — alguns com 1 casa decimal, alguns com 2, e só um mostrando
 * vírgula (padrão pt-BR); o resto mostrava ponto. O mesmo valor aparecia
 * "8.5" num card e "8,47" no card ao lado, no mesmo app em português.
 */
export function formatRating(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

/**
 * Game average (GA). Mesma inconsistência do rating (ponto em vez de
 * vírgula, espalhado por ~9 pontos) — inclusive lado a lado com o rating na
 * mesma linha de tabela (ex.: comparação H2H em ranking.tsx). Preserva a
 * precisão adaptativa que já existia em 2 desses pontos (1 casa a partir de
 * 10, pra caber na coluna estreita da tabela quando o GA é muito distorcido).
 */
export function formatGA(n: number): string {
  return (n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace('.', ',');
}

/**
 * Converte uma data guardada no Firestore — ISO completo com hora (como
 * `Match.playedAt`) ou "YYYY-MM-DD" puro (como `Competition.date`) — num
 * Date correto. Datas puras ganham meio-dia local antes do parse: sem isso,
 * `new Date('2026-09-21')` vira meia-noite UTC, que em fusos negativos
 * (Brasil) já cai no dia anterior. Um dos dois pontos que já faziam essa
 * conversão (history.tsx) aplicava esse sufixo mesmo em datas que já tinham
 * hora — `"...T16:30:00.000Z" + "T12:00:00"` vira uma string inválida, e o
 * `toLocaleDateString` de qualquer partida com placar registrado (que tem
 * `playedAt`) mostrava "Invalid Date".
 */
export function parseStoredDate(value: string): Date {
  return new Date(value.includes('T') ? value : `${value}T12:00:00`);
}

/**
 * Data relativa para linhas de lista (histórico de partidas, atividade
 * recente). Unifica duas versões quase-iguais que já existiam
 * (app/(app)/history.tsx e app/(app)/index.tsx): uma capitalizava
 * "Hoje"/"Ontem" e a outra não, e só uma removia o ponto final de "set."
 * do Intl — o mesmo tipo de informação aparecia diferente conforme a tela.
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return `Há ${diff} dias`;
  if (diff < 30) return `Há ${Math.floor(diff / 7)} sem.`;
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}
