import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'kingbt_sync_queue';

// Depois desse número de tentativas falhas, um item para de ser retentado
// automaticamente — sem isso, um item com erro permanente (permission-denied,
// documento apagado por outro caminho) ficava preso pra sempre, retentado a
// cada evento de rede e inflando o contador de pendências indefinidamente.
// Não é descartado: fica visível como "travado" para decisão manual, porque
// descartar sozinho apagaria silenciosamente algo que o usuário registrou.
export const MAX_RETRIES = 8;

export interface QueuedAction {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

export async function enqueue(
  action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>
): Promise<void> {
  const queue = await getQueue();
  queue.push({
    ...action,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    retries: 0,
  });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueue(): Promise<QueuedAction[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Storage corrompido (escrita cortada no meio, etc.) — sem o try/catch,
    // isso derrubava a fila inteira com uma exceção não tratada toda vez
    // que qualquer código chamasse getQueue. Reseta para vazio: perder o
    // que estava pendente é ruim, mas travar o app inteiro é pior.
    await AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
    return [];
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  await AsyncStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(queue.filter(q => q.id !== id))
  );
}

/** Registra mais uma tentativa falha de um item. */
export async function incrementRetries(id: string): Promise<void> {
  const queue = await getQueue();
  const next = queue.map(q => (q.id === id ? { ...q, retries: q.retries + 1 } : q));
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
}

export async function getQueueSize(): Promise<number> {
  return (await getQueue()).length;
}

/** Itens que já esgotaram as tentativas automáticas (ver MAX_RETRIES). */
export async function getStuckCount(): Promise<number> {
  return (await getQueue()).filter(q => q.retries >= MAX_RETRIES).length;
}

/**
 * Texto do banner de sincronização.
 *
 * Antes, o banner só aparecia com `isOnline === false` — então uma escrita
 * que falhasse por timeout/instabilidade (Wi-Fi "conectado" o tempo todo,
 * mas perdendo pacotes) ficava pendente na fila sem NENHUM sinal na tela:
 * `isOnline` continuava `true`, e o banner desaparecia por completo.
 *
 * `stuckCount` (itens que pararam de ser retentados automaticamente) é
 * sempre mostrado quando > 0, mesmo online e sem mais pendências normais —
 * é o único jeito da pessoa saber que algo não sincronizou e nunca vai
 * sincronizar sozinho.
 */
export function syncBannerLabel(isOnline: boolean, pendingCount: number, stuckCount = 0): string | null {
  if (stuckCount > 0) {
    const base = isOnline ? 'Sincronizando' : 'Offline';
    return `${base} · ${pendingCount} pendente${pendingCount > 1 ? 's' : ''} · ${stuckCount} com erro`;
  }
  if (isOnline && pendingCount === 0) return null;
  if (!isOnline) {
    return pendingCount > 0 ? `Offline · ${pendingCount} pendente${pendingCount > 1 ? 's' : ''}` : 'Offline';
  }
  return `Sincronizando · ${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`;
}

/**
 * Enfileira substituindo o item pendente com a mesma chave, em vez de empilhar.
 * O King Scout grava a análise inteira a cada ponto marcado — sem isto, uma
 * partida offline deixaria dezenas de cópias da mesma análise na fila, e o
 * contador de pendências viraria ruído.
 */
export async function enqueueLatest(
  action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>,
  dedupeKey: (a: QueuedAction) => string,
): Promise<void> {
  const queue = await getQueue();
  const incoming: QueuedAction = {
    ...action,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    retries: 0,
  };
  const key = dedupeKey(incoming);
  const kept = queue.filter(q => dedupeKey(q) !== key);
  kept.push(incoming);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(kept));
}
