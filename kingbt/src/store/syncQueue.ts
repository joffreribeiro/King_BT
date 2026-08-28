import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'kingbt_sync_queue';

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
  return raw ? JSON.parse(raw) : [];
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  await AsyncStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(queue.filter(q => q.id !== id))
  );
}

export async function getQueueSize(): Promise<number> {
  return (await getQueue()).length;
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
