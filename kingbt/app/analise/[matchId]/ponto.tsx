import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Modal, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import {
  placardInicial, avancaPonto, formatGameScore, formatSetScore,
  salvarAnalise, carregarAnalise, winRuleFromComp,
  type BtAnalise, type BtPonto, type BtFinalizacao,
  type BtTipoFinalizacao, type BtPosicaoSaque, type BtPlacardState, type BtWinRule,
  type BtDirecao, type BtQualidadeSaque, type BtQualidadeDevolucao, type BtDirecaoDevolucao,
  type BtLado, type BtDuracaoPonto, type BtSituacao,
  type BtTipoPrimeiraBola, type BtDirecaoPrimeiraBola, type BtQualidadePrimeiraBola,
} from '@/logic/btTracker';
import { saveAnaliseFs, loadAnaliseFs } from '@/firebase/analises';
import { useAuth } from '@/store/AuthContext';

// ─── Constantes ──────────────────────────────────────────────────────────────

// Posição simplificada: Esquerda, Meio, Direita
// Mapeamos para os tipos existentes usando posição central de cada lado
const POSICOES_SIMPLES: { key: BtPosicaoSaque; label: string }[] = [
  { key: 'Esquerda-3', label: 'Esquerda' },
  { key: 'Direita-3',  label: 'Meio' },
  { key: 'Direita-5',  label: 'Direita' },
];

// Direção do saque: Padrão 1-5 e Lob 1-5
const DIRECOES_PADRAO: { key: BtDirecao; label: string }[] = [
  { key: '1', label: '1' }, { key: '2', label: '2' }, { key: '3', label: '3' },
  { key: '4', label: '4' }, { key: '5', label: '5' },
];
const DIRECAO_LOB: BtDirecao = 'lob';

// No BT há apenas 1 saque — falta = ponto do adversário imediatamente
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

const DIRECAO_DEVOLUCAO: { key: BtDirecaoDevolucao; label: string }[] = [
  { key: 'noSacador',  label: 'No Sacador' },
  { key: 'noParceiro', label: 'No Parceiro' },
  { key: 'noMeio',     label: 'No Meio' },
  { key: 'lob',        label: 'Lob' },
];

// Golpes sem "Saque" — usados em Winner e ErroNaoForcado
const TIPOS_FIN: BtTipoFinalizacao[] = [
  'Smash', '1-2 Combination', 'Avanço', 'Curta',
  'Lob Alto', 'Lob Chutado', 'Anômalo', 'Rainbow',
  'Voleio Estático', 'Voleio Dinâmico', 'Devolução', 'Gancho',
  'Defesa Baixa', 'Defesa Alta', 'Neutra', 'Veronica',
];
// ForçouErro inclui "Saque" adicionalmente
const TIPOS_FIN_FORCOU: BtTipoFinalizacao[] = [...TIPOS_FIN, 'Saque'];

const LADOS: BtLado[] = ['Forehand', 'Backhand'];

const DURACOES: { key: BtDuracaoPonto; label: string; hint: string }[] = [
  { key: 'Curto', label: 'Curto',  hint: '≤3 toques' },
  { key: 'Médio', label: 'Médio',  hint: '4-7 toques' },
  { key: 'Longo', label: 'Longo',  hint: '8+ toques' },
];

const SITUACOES: { key: BtSituacao; label: string }[] = [
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

const TIPOS_PRIMEIRA_BOLA: BtTipoPrimeiraBola[] = [
  'Lob', 'Curta', 'Neutra', 'Avanço', 'Smash', 'Gancho', '1-2 Combination',
];

const DIRECOES_PRIMEIRA_BOLA: { key: BtDirecaoPrimeiraBola; label: string }[] = [
  { key: 'Paralela', label: 'Paralela' },
  { key: 'Meio',     label: 'Meio' },
  { key: 'Cruzada',  label: 'Cruzada' },
];

const QUALIDADE_PRIMEIRA_BOLA: { key: BtQualidadePrimeiraBola; label: string; hint: string }[] = [
  { key: 'Boa',     label: 'Boa',     hint: 'Baixa' },
  { key: 'Regular', label: 'Regular', hint: 'Neutra' },
  { key: 'Ruim',    label: 'Ruim',    hint: 'Alta' },
];

const FINALIZACAO_RALLY: { key: BtFinalizacao; label: string; cor: string }[] = [
  { key: 'Ace',            label: 'Ace',              cor: Colors.gold  },
  { key: 'Winner',         label: 'Winner',           cor: Colors.teal  },
  { key: 'ForçouErro',     label: 'Forçou Erro',      cor: Colors.teal  },
  { key: 'ErroNaoForcado', label: 'Erro não forçado', cor: Colors.coral },
  { key: 'ErroSaque',      label: 'Erro de Saque',    cor: Colors.coral },
  { key: 'ErroDevolucao',  label: 'Erro de devolução',cor: Colors.coral },
];

// ─── Componente chip ─────────────────────────────────────────────────────────

function Chip({
  label, selected, onPress, color, small,
}: { label: string; selected: boolean; onPress: () => void; color?: string; small?: boolean }) {
  const bg = selected ? (color ?? Colors.gold) : Colors.surf2;
  const tc = selected ? Colors.bg : Colors.muted;
  return (
    <TouchableOpacity
      style={[chip.base, small && chip.small, { backgroundColor: bg, borderColor: selected ? (color ?? Colors.gold) : Colors.line }]}
      onPress={onPress} activeOpacity={0.75}
    >
      <Text style={[chip.txt, small && chip.smallTxt, { color: tc }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const chip = StyleSheet.create({
  base: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  small: { paddingHorizontal: 10, paddingVertical: 5 },
  txt: { fontFamily: FontFamily.bodyMed, fontSize: 13 },
  smallTxt: { fontSize: 11 },
});

// ─── Modal de edição de ponto ─────────────────────────────────────────────────
function EditPontoModal({ ponto, nomes, jogadoresA, jogadoresB, onSave, onClose }: {
  ponto: BtPonto;
  nomes: Record<string, string>;
  jogadoresA: string[];
  jogadoresB: string[];
  onSave: (p: BtPonto) => void;
  onClose: () => void;
}) {
  const todosJogadores = [...jogadoresA, ...jogadoresB];
  const nome = (id: string) => nomes[id]?.split(' ')[0] ?? id;

  const [vencedor, setVencedor] = useState<'A' | 'B'>(ponto.vencedorDupla);
  const [finalizacao, setFinalizacao] = useState<BtFinalizacao>(ponto.finalizacao);
  const [sacador, setSacador] = useState(ponto.sacador);

  const FINS: { key: BtFinalizacao; label: string }[] = [
    { key: 'Ace',            label: 'Ace' },
    { key: 'Winner',         label: 'Winner' },
    { key: 'ForçouErro',     label: 'Forçou Erro' },
    { key: 'ErroNaoForcado', label: 'Erro n. forçado' },
    { key: 'ErroSaque',      label: 'Erro de Saque' },
    { key: 'ErroDevolucao',  label: 'Erro de devolução' },
  ];

  return (
    <View>
      <Text style={ep.title}>Editar Ponto</Text>
      <Text style={ep.sub}>{ponto.setScore} · {ponto.gameScore}</Text>

      <Text style={ep.label}>Sacador</Text>
      <View style={ep.row}>
        {todosJogadores.map(id => (
          <Chip key={id} label={nome(id)} selected={sacador === id}
            onPress={() => setSacador(id)}
            color={jogadoresA.includes(id) ? Colors.gold : Colors.teal} small />
        ))}
      </View>

      <Text style={ep.label}>Vencedor do ponto</Text>
      <View style={ep.row}>
        <Chip label={jogadoresA.map(nome).join(' / ')} selected={vencedor === 'A'}
          onPress={() => setVencedor('A')} color={Colors.gold} />
        <Chip label={jogadoresB.map(nome).join(' / ')} selected={vencedor === 'B'}
          onPress={() => setVencedor('B')} color={Colors.teal} />
      </View>

      <Text style={ep.label}>Finalização</Text>
      <View style={ep.row}>
        {FINS.map(f => (
          <Chip key={f.key} label={f.label} selected={finalizacao === f.key}
            onPress={() => setFinalizacao(f.key)} small />
        ))}
      </View>

      <View style={ep.btnRow}>
        <TouchableOpacity style={ep.btnCancel} onPress={onClose}>
          <Text style={ep.btnCancelTxt}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ep.btnSave}
          onPress={() => onSave({ ...ponto, sacador, vencedorDupla: vencedor, finalizacao })}>
          <Text style={ep.btnSaveTxt}>Salvar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ep = StyleSheet.create({
  title:      { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.text, marginBottom: 2 },
  sub:        { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted, marginBottom: Spacing.md },
  label:      { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted, marginTop: Spacing.sm, marginBottom: 4 },
  row:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  btnRow:     { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  btnCancel:  { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  btnCancelTxt: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  btnSave:    { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  btnSaveTxt: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg },
});

function PhaseDivider({ label }: { label: string }) {
  return (
    <View style={ph.wrap}>
      <View style={ph.line} />
      <Text style={ph.txt}>{label}</Text>
      <View style={ph.line} />
    </View>
  );
}

const ph = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: Colors.line },
  txt: { fontFamily: FontFamily.bodyMed, fontSize: 10, color: Colors.faint, letterSpacing: 1 },
});

// ─── Tela principal ──────────────────────────────────────────────────────────

export default function PontoScreen() {
  const params = useLocalSearchParams<{
    matchId: string; compId: string;
    a1: string; a2?: string;
    b1: string; b2?: string;
    sets?: string; games?: string; tiebreak?: string;
    superTiebreak?: string; superTiebreakPts?: string;
    scoutMode?: string;
  }>();

  const { findPlayer } = useGroupPlayers();
  const { dispatch } = useCompetitions();
  const { group } = useAuth();

  const matchId = params.matchId;
  const compId  = params.compId;
  const rule: BtWinRule = winRuleFromComp({
    sets:             params.sets             ? parseInt(params.sets)             : undefined,
    games:            params.games            ? parseInt(params.games)            : undefined,
    tiebreak:         params.tiebreak         ? parseInt(params.tiebreak)         : undefined,
    superTiebreak:    params.superTiebreak === 'true',
    superTiebreakPts: params.superTiebreakPts ? parseInt(params.superTiebreakPts) : undefined,
  });

  const ids = { a1: params.a1, a2: params.a2 ?? '', b1: params.b1, b2: params.b2 ?? '' };

  // Modo de scout: aovivo | padrao | avancado — pode ser trocado durante o jogo
  type ScoutMode = 'aovivo' | 'padrao' | 'avancado';
  const [mode, setMode] = useState<ScoutMode>((params.scoutMode as ScoutMode) ?? 'avancado');
  const isAoVivo   = mode === 'aovivo';
  const isPadrao   = mode === 'padrao';
  const isAvancado = mode === 'avancado';
  // Flags de visibilidade por seção
  const showPosicaoDirecao  = !isAoVivo;           // Padrão + Avançado
  const showQualidadeSaque  = isAvancado;           // só Avançado
  const showDevolucao       = isAvancado;           // só Avançado
  const showPrimeiraBola    = isAvancado;           // só Avançado
  const showDuracao         = !isAoVivo;            // Padrão + Avançado
  const showExtrasSection   = isAvancado;           // só Avançado

  function nome(id: string) { return id ? (findPlayer(id)?.name.split(' ')[0] ?? id) : ''; }

  const nomes: Record<string, string> = {};
  [ids.a1, ids.a2, ids.b1, ids.b2].filter(Boolean).forEach(id => { nomes[id] = findPlayer(id)?.name ?? id; });

  const jogadoresA = [ids.a1, ids.a2].filter(Boolean);
  const jogadoresB = [ids.b1, ids.b2].filter(Boolean);
  const todosJogadores = [...jogadoresA, ...jogadoresB];

  // ── Estado da análise ────────────────────────────────────────────────────
  const placardRef = useRef<BtPlacardState>(placardInicial(rule));
  const pontosRef  = useRef<BtPonto[]>([]);
  const analiseRef = useRef<BtAnalise | null>(null);
  const [, forceUpdate] = useState(0);

  function atualizarPlacard(pl: BtPlacardState) { placardRef.current = pl; }
  function atualizarPontos(ps: BtPonto[])       { pontosRef.current = ps; }
  function atualizarAnalise(a: BtAnalise)        { analiseRef.current = a; }
  function commit() { forceUpdate(n => n + 1); }

  // ── Rotação de saque por game ────────────────────────────────────────────
  // Sequência de sacadores por game no set atual (state para forçar re-render)
  const [seqSacadores, setSeqSacadores] = useState<string[]>([]);
  const sacadorPrimeiroRef = useRef<string | null>(null);

  const isDuplas = jogadoresA.length > 1 || jogadoresB.length > 1;

  function proximoSacadorAutomatico(seq: string[]): string | null {
    if (isDuplas) {
      // Duplas: games 1 e 2 manuais, a partir do 3 automático (parceiro de 2 atrás)
      if (seq.length < 2) return null;
      const ref = seq[seq.length - 2];
      const equipe = jogadoresA.includes(ref) ? jogadoresA : jogadoresB;
      return equipe.find(id => id !== ref) ?? null;
    } else {
      // Simples: game 1 manual, a partir do game 2 sempre automático (alterna)
      if (seq.length === 0) return null;
      const ultimo = seq[seq.length - 1];
      const todos = [...jogadoresA, ...jogadoresB];
      return todos.find(id => id !== ultimo) ?? null;
    }
  }

  function snapState(pl: BtPlacardState) {
    // gamesA + gamesB muda quando um game fecha dentro do set
    // setsA + setsB muda quando um set fecha
    return `${pl.setsA}-${pl.setsB}-${pl.gamesA}-${pl.gamesB}`;
  }

  // ── Formulário ───────────────────────────────────────────────────────────
  const [sacador,          setSacador]          = useState<string>('');
  const [posicaoSaque,     setPosicaoSaque]     = useState<BtPosicaoSaque | null>(null);
  // direcaoSaque armazena 'p1'..'p5' (padrão) ou 'l1'..'l5' (lob) — apenas uma marcação
  const [direcaoSaque,     setDirecaoSaque]     = useState<string | null>(null);
  const [qualidadeSaque,   setQualidadeSaque]   = useState<BtQualidadeSaque | null>(null);
  const [devolvedor,         setDevolvedor]         = useState<string | null>(null);
  const [qualidadeDevolucao, setQualidadeDevolucao] = useState<BtQualidadeDevolucao | null>(null);
  const [direcaoDevolucao,   setDirecaoDevolucao]   = useState<BtDirecaoDevolucao | null>(null);
  const [vencedorJogador,    setVencedorJogador]    = useState<string | null>(null);
  const [tipoFin,            setTipoFin]            = useState<BtTipoFinalizacao | null>(null);
  const [direcaoFinalizacao, setDirecaoFinalizacao] = useState<BtDirecao | null>(null);
  const [finalizacaoRally,   setFinalizacaoRally]   = useState<BtFinalizacao | null>(null);
  const [ladoFinalizacao,    setLadoFinalizacao]    = useState<BtLado | null>(null);
  const [primeiraBola,          setPrimeiraBola]          = useState<string | null>(null);
  const [tipoPrimeiraBola,      setTipoPrimeiraBola]      = useState<BtTipoPrimeiraBola | null>(null);
  const [direcaoPrimeiraBola,   setDirecaoPrimeiraBola]   = useState<BtDirecaoPrimeiraBola | null>(null);
  const [qualidadePrimeiraBola, setQualidadePrimeiraBola] = useState<BtQualidadePrimeiraBola | null>(null);
  const [duracaoPonto,       setDuracaoPonto]       = useState<BtDuracaoPonto | null>(null);
  const [situacoes,          setSituacoes]          = useState<BtSituacao[]>([]);
  const [comentario,         setComentario]         = useState('');
  const [showExtras,         setShowExtras]         = useState(false);

  const [modalEncerrar, setModalEncerrar] = useState(false);
  const [editPonto, setEditPonto]         = useState<BtPonto | null>(null);

  // Carrega análise existente
  useEffect(() => {
    async function load() {
      let a = await carregarAnalise(matchId, compId);
      if (!a && group?.id) {
        a = await loadAnaliseFs(group.id, matchId).catch(() => null);
        if (a) await salvarAnalise(a);
      }
      if (a) {
        analiseRef.current = a;
        pontosRef.current  = a.pontos;
        const r = a.rule ?? rule;

        // Reconstrói sequência de sacadores por game
        // Estratégia: registrar o sacador do 1º ponto de cada game
        let pl = placardInicial(r);
        let seq: string[] = [];
        let currentGameSacador: string | null = null;
        let lastSets  = 0;
        let lastGames = 0;

        for (const p of a.pontos) {
          const curSets  = pl.setsA + pl.setsB;
          const curGames = pl.gamesA + pl.gamesB; // games dentro do set atual

          // Detecta início de novo game ou novo set
          const isNewGame = curGames !== lastGames || curSets !== lastSets;
          if (isNewGame) {
            if (currentGameSacador !== null) {
              if (curSets > lastSets) seq = []; // novo set — reinicia
              seq.push(currentGameSacador);
            }
            currentGameSacador = p.sacador;
            lastGames = curGames;
            lastSets  = curSets;
          }
          if (currentGameSacador === null) currentGameSacador = p.sacador;

          pl = avancaPonto(pl, p.vencedorDupla, p.sacador);
        }
        // Não registra o game atual (ainda em andamento)

        sacadorPrimeiroRef.current = currentGameSacador;
        placardRef.current = pl;

        // Sugere próximo sacador
        const sugerido = proximoSacadorAutomatico(seq);
        setSeqSacadores(seq);
        setSacador(sugerido ?? '');

        commit();
      }
    }
    load();
  }, [matchId]);

  // ── Derivados ────────────────────────────────────────────────────────────
  const placard   = placardRef.current;
  const pontos    = pontosRef.current;
  const analise   = analiseRef.current;
  const gameScore = formatGameScore(placard);
  const setScore  = formatSetScore(placard);

  const sacadorEhDuplaA = jogadoresA.includes(sacador);
  const opositores      = sacadorEhDuplaA ? jogadoresB : jogadoresA;
  // No modo Ao Vivo não há qualidade de saque — o saque sempre "entrou" para mostrar a finalização
  const saqueIn = isAoVivo
    ? true
    : qualidadeSaque !== null && qualidadeSaque !== 'ace' && qualidadeSaque !== 'erroSaque';
  const devolucaoIn     = qualidadeDevolucao === 'boa' || qualidadeDevolucao === 'regular' || qualidadeDevolucao === 'ruim';

  // Rotação de saque no tie-break
  const sacadorSugerido: string | null = (() => {
    if (!placard.tiebreak || !placard.sacadorInicioTiebreak) return null;
    const inicio = placard.sacadorInicioTiebreak;
    const n = placard.pontosJogadosNoTiebreak;
    const inicioEmA = jogadoresA.includes(inicio);
    const aServe = (n % 4 === 0 || n % 4 === 3) ? inicioEmA : !inicioEmA;
    return (aServe ? jogadoresA : jogadoresB)[0] ?? null;
  })();

  const finalizacaoDerived: BtFinalizacao | null =
    finalizacaoRally === 'Ace'       ? 'Ace' :
    finalizacaoRally === 'ErroSaque' ? 'ErroSaque' :
    qualidadeSaque === 'ace'                  ? 'Ace' :
    qualidadeSaque === 'erroSaque'            ? 'ErroSaque' :
    qualidadeDevolucao === 'winner'           ? 'Winner' :
    qualidadeDevolucao === 'erroDevolucao'    ? 'ErroDevolucao' :
    finalizacaoRally;

  // Erros: quem cometeu perde — dupla vencedora é a oposta
  const erroFinalizacao = finalizacaoRally === 'ErroNaoForcado' || finalizacaoRally === 'ErroDevolucao';

  const vencedorDuplaDerived: 'A' | 'B' | null =
    finalizacaoRally === 'Ace'       ? (sacadorEhDuplaA ? 'A' : 'B') :
    finalizacaoRally === 'ErroSaque' ? (sacadorEhDuplaA ? 'B' : 'A') :
    qualidadeSaque === 'ace'                  ? (sacadorEhDuplaA ? 'A' : 'B') :
    qualidadeSaque === 'erroSaque'            ? (sacadorEhDuplaA ? 'B' : 'A') :
    qualidadeDevolucao === 'winner'           ? (devolvedor && jogadoresA.includes(devolvedor) ? 'A' : 'B') :
    qualidadeDevolucao === 'erroDevolucao'    ? (sacadorEhDuplaA ? 'A' : 'B') :
    vencedorJogador ? (
      erroFinalizacao
        // Erro: quem está em vencedorJogador errou — dupla oposta vence
        ? (jogadoresA.includes(vencedorJogador) ? 'B' : 'A')
        // Winner/ForçouErro: quem está em vencedorJogador ganhou
        : (jogadoresA.includes(vencedorJogador) ? 'A' : 'B')
    ) :
    null;

  const vencedorJogadorDerived: string | null =
    finalizacaoRally === 'Ace'      ? sacador :
    qualidadeSaque === 'ace'        ? sacador :
    qualidadeDevolucao === 'winner' ? devolvedor :
    vencedorJogador;

  const podeRegistrar = !!(
    sacador &&
    finalizacaoDerived !== null &&
    vencedorDuplaDerived !== null &&
    (
      isAoVivo
        // AO VIVO: só precisa sacador + finalização + vencedor
        ? (finalizacaoRally !== null)
        : (
          // PADRÃO e AVANÇADO: exige posição do saque
          posicaoSaque && (
            // Ace/ErroSaque direto
            (finalizacaoRally === 'Ace') ||
            (finalizacaoRally === 'ErroSaque') ||
            // Via qualidade do saque
            (qualidadeSaque === 'ace') ||
            (qualidadeSaque === 'erroSaque') ||
            // Padrão: precisa finalização + vencedorJogador (Ace/ErroSaque já tratados acima)
            (isPadrao && !!finalizacaoRally && !!vencedorJogador) ||
            // Avançado: cadeia completa
            (isAvancado && qualidadeSaque && saqueIn && devolvedor && qualidadeDevolucao && (
              qualidadeDevolucao === 'winner' ||
              qualidadeDevolucao === 'erroDevolucao' ||
              (devolucaoIn && vencedorJogador && finalizacaoRally)
            ))
          )
        )
    )
  );

  // ── Registrar ponto ──────────────────────────────────────────────────────
  const registrarPonto = async () => {
    if (!podeRegistrar || !vencedorDuplaDerived || !finalizacaoDerived) return;

    const placardAtual = placardRef.current;
    const pontosAtuais = pontosRef.current;
    const analiseAtual = analiseRef.current;
    const gs = formatGameScore(placardAtual);
    const ss = formatSetScore(placardAtual);

    const novoPonto: BtPonto = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      gameScore: gs, setScore: ss,
      sacador,
      posicaoSaque: posicaoSaque!,
      ...(direcaoSaque ? { direcaoSaque: direcaoSaque.slice(1) as BtDirecao, direcaoSaqueTipo: direcaoSaque.startsWith('l') ? 'lob' : 'padrao' } : {}),
      qualidadeSaque: qualidadeSaque!,
      ...(devolvedor          ? { devolvedor }          : {}),
      ...(qualidadeDevolucao  ? { qualidadeDevolucao }  : {}),
      ...(direcaoDevolucao    ? { direcaoDevolucao }    : {}),
      vencedorDupla: vencedorDuplaDerived,
      ...(vencedorJogadorDerived ? { vencedorJogador: vencedorJogadorDerived } : {}),
      finalizacao: finalizacaoDerived,
      ...(tipoFin             ? { tipoFinalizacao: tipoFin }  : {}),
      ...(ladoFinalizacao     ? { ladoFinalizacao }           : {}),
      ...(direcaoFinalizacao  ? { direcaoFinalizacao }        : {}),
      ...(primeiraBola          ? { primeiraBola }                           : {}),
      ...(tipoPrimeiraBola      ? { tipoPrimeiraBola }                       : {}),
      ...(direcaoPrimeiraBola   ? { direcaoPrimeiraBola }                    : {}),
      ...(qualidadePrimeiraBola ? { qualidadePrimeiraBola }                  : {}),
      ...(duracaoPonto          ? { duracaoPonto }                           : {}),
      ...(situacoes.length      ? { situacoes }                              : {}),
      ...(comentario.trim()     ? { comentario: comentario.trim() }          : {}),
    };

    const novosPontos  = [...pontosAtuais, novoPonto];
    const novoPlaycard = avancaPonto(placardAtual, vencedorDuplaDerived, sacador);

    const baseAnalise: BtAnalise = analiseAtual ?? {
      id: matchId, competitionId: compId, matchId,
      criadaEm: Date.now(), rule,
      jogadores: { a1: ids.a1, a2: ids.a2, b1: ids.b1, b2: ids.b2 },
      nomes, pontos: [],
    };
    const analiseAtualizada = { ...baseAnalise, pontos: novosPontos };

    await salvarAnalise(analiseAtualizada);
    if (group?.id) saveAnaliseFs(group.id, analiseAtualizada).catch(() => {});

    // Detecta mudança de game ou set ANTES de atualizar o ref
    const snapAntes  = snapState(placardAtual);
    const snapDepois = snapState(novoPlaycard);
    const novoSet    = novoPlaycard.setsA + novoPlaycard.setsB > placardAtual.setsA + placardAtual.setsB;
    const novoGame   = snapDepois !== snapAntes;

    // Rastreia sacador do 1º ponto do game atual
    if (sacadorPrimeiroRef.current === null) {
      sacadorPrimeiroRef.current = sacador;
    }

    if (novoGame) {
      const sacadorDoGame = sacadorPrimeiroRef.current ?? sacador;
      const novaSeq = novoSet ? [sacadorDoGame] : [...seqSacadores, sacadorDoGame];
      sacadorPrimeiroRef.current = null;
      const sugerido = proximoSacadorAutomatico(novaSeq);

      atualizarPlacard(novoPlaycard);
      atualizarPontos(novosPontos);
      atualizarAnalise(analiseAtualizada);
      setSeqSacadores(novaSeq);

      // Reseta formulário e define próximo sacador explicitamente
      const proximoId = sugerido ?? '';
      setSacador(proximoId);
      setPosicaoSaque(null); setDirecaoSaque(null); setQualidadeSaque(null);
      setDevolvedor(null); setQualidadeDevolucao(null); setDirecaoDevolucao(null);
      setVencedorJogador(null); setTipoFin(null); setLadoFinalizacao(null);
      setDirecaoFinalizacao(null); setFinalizacaoRally(null);
      setPrimeiraBola(null); setTipoPrimeiraBola(null);
      setDirecaoPrimeiraBola(null); setQualidadePrimeiraBola(null);
      setDuracaoPonto(null); setSituacoes([]); setComentario('');
      setShowExtras(false);
    } else {
      atualizarPlacard(novoPlaycard);
      atualizarPontos(novosPontos);
      atualizarAnalise(analiseAtualizada);
      resetFormulario(sacador);
    }

    commit();

    if (novoPlaycard.encerrada) {
      await encerrarPartida(analiseAtualizada, novoPlaycard);
    }
  };

  function resetFormulario(proximoSacador?: string | null) {
    // Se sugerido = string → seta automaticamente
    // Se sugerido = null → desmarca (escolha manual)
    // Se sugerido = undefined → mantém sacador atual
    if (proximoSacador !== undefined) setSacador(proximoSacador ?? '');
    setPosicaoSaque(null); setDirecaoSaque(null); setQualidadeSaque(null);
    setDevolvedor(null); setQualidadeDevolucao(null); setDirecaoDevolucao(null);
    setVencedorJogador(null); setTipoFin(null); setLadoFinalizacao(null);
    setDirecaoFinalizacao(null); setFinalizacaoRally(null);
    setPrimeiraBola(null); setTipoPrimeiraBola(null);
    setDirecaoPrimeiraBola(null); setQualidadePrimeiraBola(null);
    setDuracaoPonto(null); setSituacoes([]); setComentario('');
    setShowExtras(false);
  }

  // ── Desfazer ─────────────────────────────────────────────────────────────
  function desfazer() {
    if (pontosRef.current.length === 0) return;
    const novosPontos = pontosRef.current.slice(0, -1);
    let pl = placardInicial(placardRef.current.rule);
    for (const p of novosPontos) pl = avancaPonto(pl, p.vencedorDupla, p.sacador);
    const base = (analiseRef.current ?? {
      id: matchId, competitionId: compId, matchId,
      criadaEm: Date.now(), jogadores: ids as BtAnalise['jogadores'], nomes, pontos: [],
      rule: placardRef.current.rule,
    }) as BtAnalise;
    const atualizada = { ...base, pontos: novosPontos };
    atualizarPlacard(pl); atualizarPontos(novosPontos); atualizarAnalise(atualizada);
    salvarAnalise(atualizada);
    if (group?.id) saveAnaliseFs(group.id, atualizada).catch(() => {});
    commit();
  }

  // ── Encerrar ─────────────────────────────────────────────────────────────
  async function encerrarPartida(a: BtAnalise, pl: BtPlacardState) {
    const analiseComPlacar: BtAnalise = {
      ...a,
      placarFinal: { setsA: pl.setsA, setsB: pl.setsB, gamesA: pl.historicGamesA, gamesB: pl.historicGamesB },
    };
    await salvarAnalise(analiseComPlacar);
    if (group?.id) saveAnaliseFs(group.id, analiseComPlacar).catch(() => {});
    dispatch({ type: 'SAVE_SCORE', compId, matchId, scoreA: pl.setsA, scoreB: pl.setsB });
    router.replace({ pathname: '/analise/[matchId]/relatorio' as any, params: { matchId, compId } });
  }

  async function salvarEdicaoPonto(pontoEditado: BtPonto) {
    const novosPontos = pontosRef.current.map(p => p.id === pontoEditado.id ? pontoEditado : p);
    // Reconstrói placar do zero com a edição aplicada
    let pl = placardInicial(placardRef.current.rule);
    for (const p of novosPontos) pl = avancaPonto(pl, p.vencedorDupla, p.sacador);
    const base = (analiseRef.current ?? {
      id: matchId, competitionId: compId, matchId,
      criadaEm: Date.now(), jogadores: ids as BtAnalise['jogadores'], nomes, pontos: [],
      rule: placardRef.current.rule,
    }) as BtAnalise;
    const atualizada = { ...base, pontos: novosPontos };
    atualizarPlacard(pl);
    atualizarPontos(novosPontos);
    atualizarAnalise(atualizada);
    await salvarAnalise(atualizada);
    if (group?.id) saveAnaliseFs(group.id, atualizada).catch(() => {});
    setEditPonto(null);
    commit();
  }

  function pedirEncerrar() {
    if (pontos.length === 0) { Alert.alert('Sem pontos', 'Registre ao menos um ponto antes de encerrar.'); return; }
    setModalEncerrar(true);
  }

  function confirmarEncerrar() {
    setModalEncerrar(false);
    const a = (analise ?? { id: matchId, competitionId: compId, matchId, criadaEm: Date.now(), jogadores: ids as BtAnalise['jogadores'], nomes, pontos, rule: placard.rule }) as BtAnalise;
    encerrarPartida({ ...a, pontos }, placard);
  }

  const ultimos = pontos.slice(-3).reverse();
  const tiebreakLabel = placard.superTiebreakAtivo
    ? `SUPER TIE-BREAK — primeiro a ${rule.superTiebreakPts ?? 10} pts`
    : 'TIEBREAK';

  // ────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace({ pathname: '/competitions/[id]', params: { id: compId } });
        }}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.headerTitle}>BT Tracker</Text>
            <View style={[s.modeBadge, {
              backgroundColor: isAoVivo ? 'rgba(84,185,129,0.15)' : isPadrao ? 'rgba(107,127,215,0.15)' : 'rgba(192,132,252,0.15)',
              borderColor: isAoVivo ? 'rgba(84,185,129,0.4)' : isPadrao ? 'rgba(107,127,215,0.4)' : 'rgba(192,132,252,0.4)',
            }]}>
              <Text style={[s.modeBadgeTxt, {
                color: isAoVivo ? Colors.teal : isPadrao ? '#6B7FD7' : '#C084FC',
              }]}>
                {isAoVivo ? 'Ao Vivo' : isPadrao ? 'Padrão' : 'Avançado'}
              </Text>
            </View>
          </View>
          <Text style={s.headerSub}>{pontos.length} pontos registrados</Text>
        </View>
        <TouchableOpacity style={s.encerrarBtn} onPress={pedirEncerrar}>
          <Text style={s.encerrarTxt}>Encerrar</Text>
        </TouchableOpacity>
      </View>

      <View style={s.scoreboard}>
        <View style={s.scoreTeam}>
          <Text style={s.scoreTeamName} numberOfLines={1}>{jogadoresA.map(nome).join(' / ')}</Text>
          <Text style={[s.scoreNum, { color: placard.gamesA >= placard.gamesB ? Colors.gold : Colors.muted }]}>
            {placard.gamesA}
          </Text>
          <Text style={s.setsLabel}>Set: {placard.setsA}</Text>
        </View>
        <View style={s.scoreCenter}>
          <Text style={s.gameScore}>{gameScore}</Text>
          <Text style={s.setScoreLabel}>MD{rule.sets} · {rule.games} games</Text>
          {placard.tiebreak && <Text style={s.tiebreakLabel}>{tiebreakLabel}</Text>}
        </View>
        <View style={s.scoreTeam}>
          <Text style={s.scoreTeamName} numberOfLines={1}>{jogadoresB.map(nome).join(' / ')}</Text>
          <Text style={[s.scoreNum, { color: placard.gamesB >= placard.gamesA ? Colors.gold : Colors.muted }]}>
            {placard.gamesB}
          </Text>
          <Text style={s.setsLabel}>Set: {placard.setsB}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── MODO DE SCOUT ─────────────────────────────────────────────── */}
        <View style={s.modeBar}>
          {([
            { key: 'aovivo',   label: 'Ao Vivo',   color: Colors.teal },
            { key: 'padrao',   label: 'Padrão',    color: '#6B7FD7'  },
            { key: 'avancado', label: 'Avançado',  color: '#C084FC'  },
          ] as { key: ScoutMode; label: string; color: string }[]).map(m => (
            <TouchableOpacity
              key={m.key}
              style={[s.modeBtn, mode === m.key && { backgroundColor: `${m.color}22`, borderColor: `${m.color}66` }]}
              onPress={() => {
                setMode(m.key);
                // Limpa campos do ponto ao trocar de modo para evitar valores residuais
                setFinalizacaoRally(null);
                setVencedorJogador(null);
                setTipoFin(null);
                setLadoFinalizacao(null);
                setDuracaoPonto(null);
                setQualidadeSaque(null);
                setDevolvedor(null);
                setQualidadeDevolucao(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={[s.modeBtnTxt, { color: mode === m.key ? m.color : Colors.faint }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── SAQUE ─────────────────────────────────────────────────────── */}
        <PhaseDivider label="SAQUE" />

        <Text style={s.label}>Sacador</Text>

        {/* Hint de rotação automática */}
        {(() => {
          const sugerido = proximoSacadorAutomatico(seqSacadores);
          if (sugerido && sacador === sugerido) {
            return (
              <Text style={s.tiebreakHint}>
                ↺ Rotação automática: {nome(sugerido)} ✓
              </Text>
            );
          }
          const gc = seqSacadores.length;
          const isManual = isDuplas ? gc < 2 : gc === 0;
          if (!sugerido && isManual) {
            return (
              <Text style={[s.tiebreakHint, { color: Colors.muted }]}>
                Game {gc + 1} — escolha manual
              </Text>
            );
          }
          return null;
        })()}

        {/* Tiebreak hint */}
        {placard.tiebreak && sacadorSugerido && (
          <Text style={s.tiebreakHint}>
            ↺ Tie-break: {nome(sacadorSugerido)}{sacadorSugerido !== sacador ? ' — toque para selecionar' : ' ✓'}
          </Text>
        )}

        {sacador === '' && (
          <Text style={[s.tiebreakHint, { color: Colors.coral }]}>
            Selecione o sacador deste game
          </Text>
        )}

        <View style={s.row}>
          {todosJogadores.map(id => {
            // Jogadores que já sacaram neste set não podem ser selecionados novamente
            const jaUsado = seqSacadores.includes(id);
            return (
              <View key={id} style={{ opacity: jaUsado ? 0.35 : 1 }}>
                <Chip
                  label={nome(id)}
                  selected={sacador === id}
                  onPress={() => {
                    if (jaUsado) return; // bloqueado
                    setSacador(id);
                    setDevolvedor(null); setQualidadeDevolucao(null); setDirecaoDevolucao(null);
                  }}
                  color={jogadoresA.includes(id) ? Colors.gold : Colors.teal}
                />
              </View>
            );
          })}
        </View>

        {/* Posição + Direção — Padrão e Avançado */}
        {showPosicaoDirecao && (
          <>
            <Text style={s.label}>Posição do Saque</Text>
            <View style={s.row}>
              {POSICOES_SIMPLES.map(p => (
                <Chip key={p.key} label={p.label} selected={posicaoSaque === p.key}
                  onPress={() => setPosicaoSaque(p.key)} small />
              ))}
            </View>

            <Text style={s.label}>Direção do Saque</Text>
            <Text style={s.sublabel}>Baseada na posição do saque, sendo 1 a mais paralela e 5 a mais cruzada</Text>
            <Text style={s.sublabel}>Padrão</Text>
            <View style={s.row}>
              {DIRECOES_PADRAO.map(d => (
                <Chip key={`p-${d.key}`} label={d.label}
                  selected={direcaoSaque === `p${d.key}`}
                  onPress={() => setDirecaoSaque(direcaoSaque === `p${d.key}` ? null : `p${d.key}`)} small />
              ))}
            </View>
            <Text style={s.sublabel}>Lob</Text>
            <View style={s.row}>
              {DIRECOES_PADRAO.map(d => (
                <Chip key={`l-${d.key}`} label={d.label}
                  selected={direcaoSaque === `l${d.key}`}
                  onPress={() => setDirecaoSaque(direcaoSaque === `l${d.key}` ? null : `l${d.key}`)} small />
              ))}
            </View>
          </>
        )}

        {/* Qualidade do Saque — só Avançado */}
        {showQualidadeSaque && (
          <>
            <Text style={s.label}>Qualidade do Saque</Text>
            <View style={s.row}>
              {QUALIDADE_SAQUE.map(q => (
                <Chip key={q.key} label={q.label} selected={qualidadeSaque === q.key}
                  onPress={() => {
                    setQualidadeSaque(q.key);
                    if (q.key === 'ace' || q.key === 'erroSaque') {
                      setDevolvedor(null); setQualidadeDevolucao(null); setDirecaoDevolucao(null);
                      setVencedorJogador(null); setTipoFin(null); setDirecaoFinalizacao(null); setFinalizacaoRally(null);
                    }
                  }}
                  color={q.cor} small />
              ))}
            </View>
          </>
        )}

        {/* ── DEVOLUÇÃO — só Avançado ───────────────────────────────────── */}
        {showDevolucao && saqueIn && (
          <>
            <PhaseDivider label="DEVOLUÇÃO" />

            <Text style={s.label}>Devolvedor</Text>
            <View style={s.row}>
              {opositores.map(id => (
                <Chip key={id} label={nome(id)} selected={devolvedor === id}
                  onPress={() => { setDevolvedor(id); setQualidadeDevolucao(null); setDirecaoDevolucao(null); }}
                  color={jogadoresA.includes(id) ? Colors.gold : Colors.teal} />
              ))}
            </View>

            <Text style={s.label}>Qualidade da Devolução</Text>
            <View style={s.row}>
              {QUALIDADE_DEVOLUCAO.map(q => (
                <Chip key={q.key} label={q.label} selected={qualidadeDevolucao === q.key}
                  onPress={() => {
                    setQualidadeDevolucao(q.key);
                    if (q.key === 'winner' || q.key === 'erroDevolucao') {
                      setVencedorJogador(null); setTipoFin(null); setDirecaoFinalizacao(null); setFinalizacaoRally(null);
                    }
                  }}
                  color={q.cor} small />
              ))}
            </View>

            <Text style={s.label}>Direção da Devolução</Text>
            <View style={s.row}>
              {DIRECAO_DEVOLUCAO.map(d => (
                <Chip key={d.key} label={d.label} selected={direcaoDevolucao === d.key}
                  onPress={() => setDirecaoDevolucao(direcaoDevolucao === d.key ? null : d.key)} small />
              ))}
            </View>

          </>
        )}

        {/* ── PRIMEIRA BOLA — só Avançado ───────────────────────────────── */}
        {showPrimeiraBola && saqueIn && devolucaoIn && (
          <>
            <PhaseDivider label="PRIMEIRA BOLA" />
            <Text style={s.sublabel}>Bola após a devolução — terceira bola</Text>

            <Text style={s.label}>Quem fez a primeira bola? <Text style={s.opt}>(opcional)</Text></Text>
            <View style={s.row}>
              {todosJogadores.map(id => (
                <Chip key={id} label={nome(id)} selected={primeiraBola === id}
                  onPress={() => setPrimeiraBola(primeiraBola === id ? null : id)}
                  color={jogadoresA.includes(id) ? Colors.gold : Colors.teal} />
              ))}
            </View>

            <Text style={s.label}>Tipo <Text style={s.opt}>(opcional)</Text></Text>
            <View style={s.row}>
              {TIPOS_PRIMEIRA_BOLA.map(t => (
                <Chip key={t} label={t} selected={tipoPrimeiraBola === t}
                  onPress={() => setTipoPrimeiraBola(tipoPrimeiraBola === t ? null : t)} small />
              ))}
            </View>

            <Text style={s.label}>Direção <Text style={s.opt}>(opcional)</Text></Text>
            <View style={s.row}>
              {DIRECOES_PRIMEIRA_BOLA.map(d => (
                <Chip key={d.key} label={d.label} selected={direcaoPrimeiraBola === d.key}
                  onPress={() => setDirecaoPrimeiraBola(direcaoPrimeiraBola === d.key ? null : d.key)} small />
              ))}
            </View>

            <Text style={s.label}>Qualidade <Text style={s.opt}>(opcional)</Text></Text>
            <Text style={s.sublabel}>Boa (Baixa) · Regular (Neutra) · Ruim (Alta)</Text>
            <View style={s.row}>
              {QUALIDADE_PRIMEIRA_BOLA.map(q => (
                <Chip key={q.key} label={q.label} selected={qualidadePrimeiraBola === q.key}
                  onPress={() => setQualidadePrimeiraBola(qualidadePrimeiraBola === q.key ? null : q.key)} small />
              ))}
            </View>
          </>
        )}

        {/* ── PONTO (rali) ──────────────────────────────────────────────── */}
        {/* AoVivo: mostra quando sacador selecionado | Padrão/Avançado: após devolução */}
        {(isAoVivo ? !!sacador : (saqueIn && devolucaoIn)) && (
          <>
            <PhaseDivider label="PONTO" />

            <Text style={s.label}>Finalização</Text>
            <View style={s.row}>
              {FINALIZACAO_RALLY.map(f => (
                <Chip key={f.key} label={f.label} selected={finalizacaoRally === f.key}
                  onPress={() => {
                    setFinalizacaoRally(f.key);
                    setTipoFin(null); setLadoFinalizacao(null);
                    setVencedorJogador(null); // sempre limpa — vencedorDuplaDerived calcula automaticamente
                  }} color={f.cor} small />
              ))}
            </View>

            {/* ── AO VIVO: Quem fez/errou — simples ──────────────────── */}
            {isAoVivo && finalizacaoRally && finalizacaoRally !== 'Ace' && finalizacaoRally !== 'ErroSaque' && (
              <>
                <Text style={s.label}>
                  {finalizacaoRally === 'Winner'         ? 'Quem fez o Winner?' :
                   finalizacaoRally === 'ForçouErro'     ? 'Quem forçou o erro do adversário?' :
                   finalizacaoRally === 'ErroNaoForcado' ? 'Quem cometeu o Erro não forçado?' :
                   'Quem cometeu o Erro de devolução?'}
                </Text>
                <View style={s.row}>
                  {(finalizacaoRally === 'ErroDevolucao' ? opositores : todosJogadores).map(id => (
                    <Chip key={id} label={nome(id)} selected={vencedorJogador === id}
                      onPress={() => setVencedorJogador(id)}
                      color={Colors.coral} />
                  ))}
                </View>
              </>
            )}

            {/* ── PADRÃO: campos contextuais expandidos por finalização ── */}
            {isPadrao && finalizacaoRally === 'Winner' && (
              <>
                <Text style={s.label}>O Winner foi de?</Text>
                <View style={s.row}>
                  {LADOS.map(l => (
                    <Chip key={l} label={l} selected={ladoFinalizacao === l}
                      onPress={() => setLadoFinalizacao(ladoFinalizacao === l ? null : l)} small />
                  ))}
                </View>
                <Text style={s.label}>Quem fez o Winner?</Text>
                <View style={s.row}>
                  {todosJogadores.map(id => (
                    <Chip key={id} label={nome(id)} selected={vencedorJogador === id}
                      onPress={() => setVencedorJogador(id)}
                      color={jogadoresA.includes(id) ? Colors.gold : Colors.teal} />
                  ))}
                </View>
                <Text style={s.label}>Duração do Ponto</Text>
                <View style={s.row}>
                  {DURACOES.map(d => (
                    <Chip key={d.key} label={d.key} selected={duracaoPonto === d.key}
                      onPress={() => setDuracaoPonto(duracaoPonto === d.key ? null : d.key)} small />
                  ))}
                </View>
              </>
            )}

            {isPadrao && finalizacaoRally === 'ForçouErro' && (
              <>
                <Text style={s.label}>Como o jogador forçou o erro do adversário?</Text>
                <View style={s.row}>
                  {TIPOS_FIN_FORCOU.map(t => (
                    <Chip key={t} label={t} selected={tipoFin === t}
                      onPress={() => setTipoFin(tipoFin === t ? null : t)} small />
                  ))}
                </View>
                <Text style={s.label}>O Forçou Erro foi de?</Text>
                <View style={s.row}>
                  {LADOS.map(l => (
                    <Chip key={l} label={l} selected={ladoFinalizacao === l}
                      onPress={() => setLadoFinalizacao(ladoFinalizacao === l ? null : l)} small />
                  ))}
                </View>
                <Text style={s.label}>Quem forçou o erro do adversário?</Text>
                <View style={s.row}>
                  {todosJogadores.map(id => (
                    <Chip key={id} label={nome(id)} selected={vencedorJogador === id}
                      onPress={() => setVencedorJogador(id)}
                      color={jogadoresA.includes(id) ? Colors.gold : Colors.teal} />
                  ))}
                </View>
                <Text style={s.label}>Duração do Ponto</Text>
                <View style={s.row}>
                  {DURACOES.map(d => (
                    <Chip key={d.key} label={d.key} selected={duracaoPonto === d.key}
                      onPress={() => setDuracaoPonto(duracaoPonto === d.key ? null : d.key)} small />
                  ))}
                </View>
              </>
            )}

            {isPadrao && finalizacaoRally === 'ErroNaoForcado' && (
              <>
                <Text style={s.label}>Como o Erro não forçado ocorreu?</Text>
                <View style={s.row}>
                  {TIPOS_FIN.map(t => (
                    <Chip key={t} label={t} selected={tipoFin === t}
                      onPress={() => setTipoFin(tipoFin === t ? null : t)} small />
                  ))}
                </View>
                <Text style={s.label}>O Erro não forçado foi de?</Text>
                <View style={s.row}>
                  {LADOS.map(l => (
                    <Chip key={l} label={l} selected={ladoFinalizacao === l}
                      onPress={() => setLadoFinalizacao(ladoFinalizacao === l ? null : l)} small />
                  ))}
                </View>
                <Text style={s.label}>Quem cometeu o Erro não forçado?</Text>
                <View style={s.row}>
                  {todosJogadores.map(id => (
                    <Chip key={id} label={nome(id)} selected={vencedorJogador === id}
                      onPress={() => setVencedorJogador(id)}
                      color={Colors.coral} />
                  ))}
                </View>
                <Text style={s.label}>Duração do Ponto</Text>
                <View style={s.row}>
                  {DURACOES.map(d => (
                    <Chip key={d.key} label={d.key} selected={duracaoPonto === d.key}
                      onPress={() => setDuracaoPonto(duracaoPonto === d.key ? null : d.key)} small />
                  ))}
                </View>
              </>
            )}

            {isPadrao && finalizacaoRally === 'ErroDevolucao' && (
              <>
                <Text style={s.label}>O Erro de devolução foi de?</Text>
                <View style={s.row}>
                  {LADOS.map(l => (
                    <Chip key={l} label={l} selected={ladoFinalizacao === l}
                      onPress={() => setLadoFinalizacao(ladoFinalizacao === l ? null : l)} small />
                  ))}
                </View>
                <Text style={s.label}>Quem cometeu o Erro de devolução?</Text>
                <View style={s.row}>
                  {opositores.map(id => (
                    <Chip key={id} label={nome(id)} selected={vencedorJogador === id}
                      onPress={() => setVencedorJogador(id)}
                      color={Colors.coral} />
                  ))}
                </View>
              </>
            )}

            {/* Avançado: Vencedor do Ponto separado (Padrão usa campos contextuais acima) */}
            {isAvancado && (
              <>
                <Text style={s.label}>Vencedor do Ponto</Text>
                <View style={s.row}>
                  {todosJogadores.map(id => (
                    <Chip key={id} label={nome(id)} selected={vencedorJogador === id}
                      onPress={() => setVencedorJogador(id)}
                      color={jogadoresA.includes(id) ? Colors.gold : Colors.teal} />
                  ))}
                </View>
              </>
            )}

            {/* Golpe + Lado — só Avançado */}
            {isAvancado && finalizacaoRally && (
              <>
                <Text style={s.label}>Golpe <Text style={s.opt}>(opcional)</Text></Text>
                <View style={s.row}>
                  {(finalizacaoRally === 'ForçouErro' ? TIPOS_FIN_FORCOU : TIPOS_FIN).map(t => (
                    <Chip key={t} label={t} selected={tipoFin === t}
                      onPress={() => setTipoFin(tipoFin === t ? null : t)} small />
                  ))}
                </View>

                <Text style={s.label}>Lado <Text style={s.opt}>(opcional)</Text></Text>
                <View style={s.row}>
                  {LADOS.map(l => (
                    <Chip key={l} label={l} selected={ladoFinalizacao === l}
                      onPress={() => setLadoFinalizacao(ladoFinalizacao === l ? null : l)} small />
                  ))}
                </View>
              </>
            )}

            {/* Duração — Padrão + Avançado (Ao Vivo já inclui nos blocos acima) */}
            {showDuracao && !isAoVivo && (
              <>
                <Text style={s.label}>Duração do Ponto <Text style={s.opt}>(opcional)</Text></Text>
                <View style={s.row}>
                  {DURACOES.map(d => (
                    <Chip key={d.key} label={`${d.key} · ${d.hint}`} selected={duracaoPonto === d.key}
                      onPress={() => setDuracaoPonto(duracaoPonto === d.key ? null : d.key)} small />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* ── EXTRAS (situações + comentário) — só Avançado ────────────── */}
        {showExtrasSection && saqueIn && (
          <>
            <TouchableOpacity
              style={s.extrasToggle}
              onPress={() => setShowExtras(v => !v)}
              activeOpacity={0.75}
            >
              <Text style={s.extrasToggleTxt}>
                {showExtras ? '▲ Ocultar extras' : '▼ Situações e comentário'}
              </Text>
            </TouchableOpacity>

            {showExtras && (
              <>
                <Text style={s.label}>Situações <Text style={s.opt}>(marque todas que ocorreram)</Text></Text>
                <View style={s.row}>
                  {SITUACOES.map(sit => (
                    <Chip
                      key={sit.key}
                      label={sit.label}
                      selected={situacoes.includes(sit.key)}
                      onPress={() => setSituacoes(prev =>
                        prev.includes(sit.key) ? prev.filter(s => s !== sit.key) : [...prev, sit.key]
                      )}
                      small
                    />
                  ))}
                </View>

                <Text style={s.label}>Comentário <Text style={s.opt}>(opcional)</Text></Text>
                <View style={s.commentWrap}>
                  <TextInput
                    style={s.commentInput}
                    value={comentario}
                    onChangeText={setComentario}
                    placeholder="Observação sobre este ponto..."
                    placeholderTextColor={Colors.faint}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </>
            )}
          </>
        )}

        <TouchableOpacity
          style={[s.regBtn, !podeRegistrar && s.regBtnOff]}
          onPress={registrarPonto} disabled={!podeRegistrar} activeOpacity={0.8}
        >
          <Text style={s.regBtnTxt}>Registrar Ponto</Text>
        </TouchableOpacity>

        {ultimos.length > 0 && (
          <>
            <View style={s.logHeader}>
              <Text style={s.label}>Últimos pontos <Text style={s.opt}>(toque para editar)</Text></Text>
              <TouchableOpacity onPress={desfazer}>
                <Text style={s.undoTxt}>↩ Desfazer</Text>
              </TouchableOpacity>
            </View>
            {ultimos.map((p, i) => (
              <TouchableOpacity key={p.id} style={[s.logRow, i === 0 && s.logRowFirst]}
                onPress={() => setEditPonto(p)} activeOpacity={0.7}>
                <View style={[s.logDot, { backgroundColor: p.vencedorDupla === 'A' ? Colors.gold : Colors.teal }]} />
                <Text style={s.logTxt}>
                  {p.setScore} · {p.gameScore} · {nomes[p.sacador] ?? p.sacador} · {p.finalizacao}
                  {p.tipoFinalizacao ? ` (${p.tipoFinalizacao})` : ''}
                </Text>
                <Text style={{ fontSize: 14, color: Colors.faint }}>✏️</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: Spacing.xl * 2 }} />
      </ScrollView>

      {/* Modal de edição de ponto */}
      <Modal visible={!!editPonto} transparent animationType="slide" onRequestClose={() => setEditPonto(null)}>
        <View style={m.overlay}>
          <View style={[m.card, { maxHeight: '80%' }]}>
            {editPonto && (
              <EditPontoModal
                ponto={editPonto}
                nomes={nomes}
                jogadoresA={jogadoresA}
                jogadoresB={jogadoresB}
                onSave={salvarEdicaoPonto}
                onClose={() => setEditPonto(null)}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={modalEncerrar} transparent animationType="fade">
        <View style={m.overlay}>
          <View style={m.card}>
            <Text style={m.title}>Encerrar partida?</Text>
            <Text style={m.sub}>
              Placar atual: {placard.setsA} × {placard.setsB} sets{'\n'}
              {pontos.length} pontos registrados
            </Text>
            <Text style={m.sub2}>O placar será salvo automaticamente no torneio.</Text>
            <View style={m.row}>
              <TouchableOpacity style={m.btnCancel} onPress={() => setModalEncerrar(false)}>
                <Text style={m.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.btnConfirm} onPress={confirmarEncerrar}>
                <Text style={m.btnConfirmTxt}>Encerrar e Ver Relatório</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  headerTitle: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  headerSub: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  encerrarBtn: { backgroundColor: Colors.coral + '22', borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: Colors.coral + '66' },
  encerrarTxt: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.coral },
  scoreboard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surf, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  scoreTeam:     { flex: 1, alignItems: 'center', gap: 4 },
  scoreTeamName: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, textAlign: 'center' },
  scoreNum:      { fontFamily: FontFamily.numberBold, fontSize: 42, lineHeight: 48 },
  setsLabel:     { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  scoreCenter:   { alignItems: 'center', paddingHorizontal: Spacing.md, gap: 2 },
  gameScore:     { fontFamily: FontFamily.numberBold, fontSize: 20, color: Colors.text },
  setScoreLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  tiebreakLabel: { fontFamily: FontFamily.bodyMed, fontSize: 9, color: Colors.gold, backgroundColor: Colors.gold + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, textAlign: 'center' },
  scroll:   { padding: Spacing.md, gap: Spacing.sm },
  label:    { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted, marginTop: Spacing.sm },
  sublabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, marginBottom: 2 },
  opt:      { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  row:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  tiebreakHint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.gold, marginBottom: 2 },
  regBtn:   { backgroundColor: Colors.gold, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  regBtnOff:{ opacity: 0.35 },
  regBtnTxt:{ fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
  logHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
  undoTxt:  { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.teal },
  logRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.line },
  logRowFirst: { borderTopWidth: 0 },
  logDot:   { width: 8, height: 8, borderRadius: 4 },
  logTxt:   { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, flex: 1 },
  modeBadge: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  modeBadgeTxt: { fontFamily: FontFamily.numberBold, fontSize: 9, letterSpacing: 0.5 },
  modeBar: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.line },
  modeBtn: { flex: 1, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: 'transparent', alignItems: 'center' },
  modeBtnTxt: { fontFamily: FontFamily.bodyMed, fontSize: 12 },
  extrasToggle: { borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: 8, alignItems: 'center', marginTop: Spacing.sm },
  extrasToggleTxt: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted },
  commentWrap: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.sm, marginTop: 4 },
  commentInput: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.text, paddingVertical: Spacing.sm, minHeight: 56, textAlignVertical: 'top' },
});

const m = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: '#000000BB', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card:         { backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', gap: Spacing.md, borderWidth: 1, borderColor: Colors.line },
  title:        { fontFamily: FontFamily.title, fontSize: 18, color: Colors.text, textAlign: 'center' },
  sub:          { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text, textAlign: 'center' },
  sub2:         { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, textAlign: 'center' },
  row:          { flexDirection: 'row', gap: Spacing.sm },
  btnCancel:    { flex: 1, padding: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line, alignItems: 'center' },
  btnCancelTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  btnConfirm:   { flex: 1, padding: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.teal, alignItems: 'center' },
  btnConfirmTxt:{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.bg },
});
