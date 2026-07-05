import type { ThemeColors } from '@/theme';
import type {
  BtFinalizacao, BtTipoFinalizacao, BtPosicaoSaque,
  BtDirecao, BtQualidadeSaque, BtQualidadeDevolucao, BtDirecaoDevolucao,
  BtLado, BtDuracaoPonto, BtSituacao,
  BtTipoPrimeiraBola, BtDirecaoPrimeiraBola, BtQualidadePrimeiraBola,
} from '@/logic/btTracker';

// ─── Constantes do King Scout ────────────────────────────────────────────────

// Posição simplificada: Esquerda, Meio, Direita
// Mapeamos para os tipos existentes usando posição central de cada lado
export const POSICOES_SIMPLES: { key: BtPosicaoSaque; label: string }[] = [
  { key: 'Esquerda-3', label: 'Esquerda' },
  { key: 'Direita-3',  label: 'Meio' },
  { key: 'Direita-5',  label: 'Direita' },
];

// Direção do saque: Padrão 1-5 e Lob 1-5
export const DIRECOES_PADRAO: { key: BtDirecao; label: string }[] = [
  { key: '1', label: '1' }, { key: '2', label: '2' }, { key: '3', label: '3' },
  { key: '4', label: '4' }, { key: '5', label: '5' },
];
export const DIRECAO_LOB: BtDirecao = 'lob';

export const DIRECAO_DEVOLUCAO: { key: BtDirecaoDevolucao; label: string }[] = [
  { key: 'noSacador',  label: 'No Sacador' },
  { key: 'noParceiro', label: 'No Parceiro' },
  { key: 'noMeio',     label: 'No Meio' },
  { key: 'lob',        label: 'Lob' },
];

// Golpes sem "Saque" — usados em Winner e ErroNaoForcado
export const TIPOS_FIN: BtTipoFinalizacao[] = [
  'Smash', '1-2 Combination', 'Avanço', 'Curta',
  'Lob Alto', 'Lob Chutado', 'Anômalo', 'Rainbow',
  'Voleio Estático', 'Voleio Dinâmico', 'Devolução', 'Gancho',
  'Defesa Baixa', 'Defesa Alta', 'Neutra', 'Veronica',
];
// ForçouErro inclui "Saque" adicionalmente
export const TIPOS_FIN_FORCOU: BtTipoFinalizacao[] = [...TIPOS_FIN, 'Saque'];

export const LADOS: BtLado[] = ['Forehand', 'Backhand'];

export const DURACOES: { key: BtDuracaoPonto; label: string; hint: string }[] = [
  { key: 'Curto', label: 'Curto',  hint: '≤3 toques' },
  { key: 'Médio', label: 'Médio',  hint: '4-7 toques' },
  { key: 'Longo', label: 'Longo',  hint: '8+ toques' },
];

export const SITUACOES: { key: BtSituacao; label: string }[] = [
  { key: 'bolaNaFita',   label: 'Bola na Fita' },
  { key: 'bolaNaLinha',  label: 'Bola na Linha' },
  { key: 'torcida',      label: 'Torcida' },
  { key: 'provocacao',   label: 'Provocação' },
  { key: 'irritacao',    label: 'Irritação' },
  { key: 'lesao',        label: 'Lesão' },
  { key: 'furouBola',    label: 'Furou a Bola' },
  { key: 'footFault',    label: 'Foot Fault' },
  { key: 'avancoLinha',  label: 'Avanço de Linha' },
];

export const TIPOS_PRIMEIRA_BOLA: BtTipoPrimeiraBola[] = [
  'Lob', 'Curta', 'Neutra', 'Avanço', 'Smash', 'Gancho', '1-2 Combination',
];

export const DIRECOES_PRIMEIRA_BOLA: { key: BtDirecaoPrimeiraBola; label: string }[] = [
  { key: 'Paralela', label: 'Paralela' },
  { key: 'Meio',     label: 'Meio' },
  { key: 'Cruzada',  label: 'Cruzada' },
];

export const QUALIDADE_PRIMEIRA_BOLA: { key: BtQualidadePrimeiraBola; label: string; hint: string }[] = [
  { key: 'Boa',     label: 'Boa',     hint: 'Baixa' },
  { key: 'Regular', label: 'Regular', hint: 'Neutra' },
  { key: 'Ruim',    label: 'Ruim',    hint: 'Alta' },
];

// Opções que dependem de cor do tema — montadas via factory reativa ao ThemeContext
export function makeScoutOptions(Colors: ThemeColors) {
  const QUALIDADE_SAQUE: { key: BtQualidadeSaque; label: string; cor: string }[] = [
    { key: 'ace',       label: 'Ace ⭐',         cor: Colors.gold },
    { key: 'bom',       label: 'Bom ✓',           cor: Colors.teal },
    { key: 'regular',   label: 'Regular',           cor: Colors.muted },
    { key: 'ruim',      label: 'Ruim',              cor: Colors.coral },
    { key: 'erroSaque', label: 'Erro Saque ✕',     cor: Colors.coral },
  ];

  const QUALIDADE_DEVOLUCAO: { key: BtQualidadeDevolucao; label: string; cor: string }[] = [
    { key: 'winner',        label: 'Winner ⭐',       cor: Colors.gold },
    { key: 'boa',           label: 'Boa ✓',            cor: Colors.teal },
    { key: 'regular',       label: 'Regular',           cor: Colors.muted },
    { key: 'ruim',          label: 'Ruim',              cor: Colors.coral },
    { key: 'erroDevolucao', label: 'Erro Dev. ✕',      cor: Colors.coral },
  ];

  const FINALIZACAO_RALLY: { key: BtFinalizacao; label: string; cor: string }[] = [
    { key: 'Ace',            label: 'Ace',              cor: Colors.gold  },
    { key: 'Winner',         label: 'Winner',           cor: Colors.teal  },
    { key: 'ForçouErro',     label: 'Forçou Erro',      cor: Colors.teal  },
    { key: 'ErroNaoForcado', label: 'Erro não forçado', cor: Colors.coral },
    { key: 'ErroSaque',      label: 'Erro de Saque',    cor: Colors.coral },
    { key: 'ErroDevolucao',  label: 'Erro de devolução',cor: Colors.coral },
  ];

  return { QUALIDADE_SAQUE, QUALIDADE_DEVOLUCAO, FINALIZACAO_RALLY };
}
