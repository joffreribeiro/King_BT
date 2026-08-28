// O pacote real precisa do módulo nativo; nos testes basta um mapa em memória
// com o mesmo contrato usado pela fila.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: (k: string) => Promise.resolve(store[k] ?? null),
      setItem: (k: string, v: string) => { store[k] = v; return Promise.resolve(); },
      removeItem: (k: string) => { delete store[k]; return Promise.resolve(); },
      clear: () => { store = {}; return Promise.resolve(); },
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueue, enqueueLatest, getQueue, getQueueSize, removeFromQueue } from '@/store/syncQueue';

const analiseKey = (a: { payload: Record<string, unknown> }) =>
  `SAVE_ANALISE:${(a.payload.analise as { matchId?: string } | undefined)?.matchId ?? ''}`;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('fila de sincronização offline', () => {
  it('empilha ações distintas', async () => {
    await enqueue({ type: 'UPDATE_COMP', payload: { groupId: 'g1', data: {} } });
    await enqueue({ type: 'UPDATE_COMP', payload: { groupId: 'g1', data: {} } });
    expect(await getQueueSize()).toBe(2);
  });

  it('mantém só a última versão da mesma análise', async () => {
    // O King Scout regrava a análise inteira a cada ponto: sem dedupe, uma
    // partida offline deixaria dezenas de cópias na fila.
    for (const pontos of [1, 2, 3]) {
      await enqueueLatest(
        { type: 'SAVE_ANALISE', payload: { groupId: 'g1', analise: { matchId: 'm1', pontos } } },
        analiseKey,
      );
    }
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect((queue[0].payload.analise as { pontos: number }).pontos).toBe(3);
  });

  it('não mistura análises de partidas diferentes', async () => {
    for (const matchId of ['m1', 'm2']) {
      await enqueueLatest(
        { type: 'SAVE_ANALISE', payload: { groupId: 'g1', analise: { matchId } } },
        analiseKey,
      );
    }
    expect(await getQueueSize()).toBe(2);
  });

  it('remove um item pelo id', async () => {
    await enqueue({ type: 'UPDATE_COMP', payload: { groupId: 'g1', data: {} } });
    const [item] = await getQueue();
    await removeFromQueue(item.id);
    expect(await getQueueSize()).toBe(0);
  });
});
