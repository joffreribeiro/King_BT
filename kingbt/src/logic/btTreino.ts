// ─── Análise Individual (treino técnico fora de uma partida) ─────────────────
// Contador Bom/Ruim por tipo de golpe para um atleta, independente de uma
// partida específica — pensado para sessões de treino. Reaproveita o mesmo
// catálogo de golpes (TIPOS_FIN/LADOS) usado no scout de partida em
// src/components/analise/scoutOptions.ts, só achatado em linhas golpe×lado
// (mesma organização usada pelo BT Tracker: 29 linhas no total).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIPOS_FIN, LADOS } from '@/components/analise/scoutOptions';
import type { BtTipoFinalizacao, BtLado } from './btTracker';

// Golpes que fazem sentido diferenciar por lado (Forehand/Backhand)
const GOLPES_COM_LADO: BtTipoFinalizacao[] = [
  'Devolução', 'Avanço', 'Curta', 'Defesa Alta', 'Defesa Baixa',
  'Lob Alto', 'Lob Chutado', 'Neutra', 'Voleio Estático', 'Voleio Dinâmico',
];

export interface TreinoGolpe {
  key: string;
  tipo: BtTipoFinalizacao | 'Saque' | 'SaqueLob' | 'SaqueForcado';
  lado?: BtLado;
  label: string;
}

export const TREINO_GOLPES: TreinoGolpe[] = [
  { key: 'Saque', tipo: 'Saque', label: 'Saque' },
  { key: 'SaqueLob', tipo: 'SaqueLob', label: 'Saque Lob' },
  { key: 'SaqueForcado', tipo: 'SaqueForcado', label: 'Saque Forçado' },
  ...GOLPES_COM_LADO.flatMap(tipo =>
    LADOS.map((lado): TreinoGolpe => ({ key: `${tipo}-${lado}`, tipo, lado, label: `${tipo} ${lado}` }))
  ),
  ...TIPOS_FIN.filter(t => !GOLPES_COM_LADO.includes(t)).map((tipo): TreinoGolpe => ({
    key: tipo, tipo, label: tipo,
  })),
];

export interface BtTreinoContagem {
  bom: number;
  ruim: number;
}

export interface BtTreino {
  id: string;
  groupId: string;
  playerId: string;
  titulo: string;
  criadoEm: number;
  contagens: Record<string, BtTreinoContagem>; // key = TreinoGolpe.key
  observacoes?: string;
}

export function novoTreino(groupId: string, playerId: string, titulo: string): BtTreino {
  return { id: Date.now().toString(), groupId, playerId, titulo, criadoEm: Date.now(), contagens: {} };
}

export function ajustarContagem(treino: BtTreino, golpeKey: string, campo: 'bom' | 'ruim', delta: 1 | -1): BtTreino {
  const atual = treino.contagens[golpeKey] ?? { bom: 0, ruim: 0 };
  const novoValor = Math.max(0, atual[campo] + delta);
  return {
    ...treino,
    contagens: { ...treino.contagens, [golpeKey]: { ...atual, [campo]: novoValor } },
  };
}

export interface BtAnaliseTreino {
  totalTentativas: number;
  aproveitamentoGeral: number; // %
  melhorGolpe: { key: string; label: string; pct: number } | null;
  piorGolpe: { key: string; label: string; pct: number } | null;
  maisUtilizado: { key: string; label: string; total: number } | null;
  menosUtilizado: { key: string; label: string; total: number } | null;
  golpesAcima50: { count: number; total: number };
}

const MIN_TENTATIVAS_MELHOR_PIOR = 4;

export function calcularAnaliseTreino(treino: BtTreino): BtAnaliseTreino {
  let somaBom = 0, somaTotal = 0;
  let melhor: { key: string; label: string; pct: number } | null = null;
  let pior: { key: string; label: string; pct: number } | null = null;
  let mais: { key: string; label: string; total: number } | null = null;
  let menos: { key: string; label: string; total: number } | null = null;
  let acima50 = 0, comDados = 0;

  for (const g of TREINO_GOLPES) {
    const c = treino.contagens[g.key];
    if (!c) continue;
    const total = c.bom + c.ruim;
    if (total === 0) continue;

    somaBom += c.bom;
    somaTotal += total;
    comDados += 1;
    const pct = Math.round((c.bom / total) * 100);
    if (pct > 50) acima50 += 1;

    if (total >= MIN_TENTATIVAS_MELHOR_PIOR) {
      if (!melhor || pct > melhor.pct) melhor = { key: g.key, label: g.label, pct };
      if (!pior || pct < pior.pct) pior = { key: g.key, label: g.label, pct };
    }
    if (!mais || total > mais.total) mais = { key: g.key, label: g.label, total };
    if (!menos || total < menos.total) menos = { key: g.key, label: g.label, total };
  }

  return {
    totalTentativas: somaTotal,
    aproveitamentoGeral: somaTotal > 0 ? Math.round((somaBom / somaTotal) * 100) : 0,
    melhorGolpe: melhor,
    piorGolpe: pior,
    maisUtilizado: mais,
    menosUtilizado: menos,
    golpesAcima50: { count: acima50, total: comDados },
  };
}

// ─── Persistência (AsyncStorage) ─────────────────────────────────────────────

const PREFIX = 'btTreino:';

function storageKey(playerId: string, treinoId: string): string {
  return PREFIX + playerId + ':' + treinoId;
}

export async function salvarTreino(treino: BtTreino): Promise<void> {
  await AsyncStorage.setItem(storageKey(treino.playerId, treino.id), JSON.stringify(treino));
}

export async function carregarTreino(playerId: string, treinoId: string): Promise<BtTreino | null> {
  const raw = await AsyncStorage.getItem(storageKey(playerId, treinoId));
  return raw ? (JSON.parse(raw) as BtTreino) : null;
}

export async function listarTreinos(): Promise<BtTreino[]> {
  const keys = await AsyncStorage.getAllKeys();
  const treinoKeys = keys.filter(k => k.startsWith(PREFIX));
  if (treinoKeys.length === 0) return [];
  const pairs = await AsyncStorage.multiGet(treinoKeys);
  return pairs
    .map(([, v]) => v ? (JSON.parse(v) as BtTreino) : null)
    .filter(Boolean) as BtTreino[];
}

export async function deletarTreino(playerId: string, treinoId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(playerId, treinoId));
}
