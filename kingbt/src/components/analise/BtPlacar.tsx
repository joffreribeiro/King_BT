import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '@/store/ThemeContext';
import { FontFamily, Radius, Spacing, type ThemeColors } from '@/theme';
import { GamesComTb } from './GamesComTb';
import { tiebreaksDosSets } from '@/logic/btPlacarPonto';
import { formatGameScore, type BtPlacardState, type BtPlacarSeed, type BtPonto } from '@/logic/btTracker';

type Props = {
  placard: BtPlacardState;
  pontos: BtPonto[];
  /** Placar semeado da análise (sets já jogados antes do scout), se houver. */
  inicial?: BtPlacarSeed;
  nomeA: string;
  nomeB: string;
  /** Dupla que está sacando agora (marca a linha no placar). */
  sacadorDupla?: 'A' | 'B' | null;
  onPontoRapido: (dupla: 'A' | 'B') => void;
};

/** Placar ao vivo: uma linha por dupla, uma coluna por set e os pontos do game; tie-break como expoente. */
export function BtPlacar({ placard, pontos, inicial, nomeA, nomeB, sacadorDupla, onPontoRapido }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const rule = placard.rule;
  const tbs = useMemo(() => tiebreaksDosSets({ pontos, rule, inicial }), [pontos, rule, inicial]);

  const linha = (d: 'A' | 'B') => {
    const cor = d === 'A' ? Colors.gold : Colors.teal;
    const hist = d === 'A' ? placard.historicGamesA : placard.historicGamesB;
    const games = d === 'A' ? placard.gamesA : placard.gamesB;
    const colunas = [...hist, games];
    const pts = formatGameScore(placard).split('x')[d === 'A' ? 0 : 1] ?? '0';
    const sacando = sacadorDupla === d;
    return (
      <View style={[s.linha, { borderLeftColor: cor }]}>
        <View style={s.linhaNome}>
          <Text style={s.nome} numberOfLines={1}>{sacando ? '● ' : ''}{d === 'A' ? nomeA : nomeB}</Text>
          {sacando && <Text style={s.sacando}>sacando</Text>}
        </View>
        {colunas.map((g, i) => (
          <GamesComTb
            key={i}
            games={g}
            tb={i < hist.length && !placard.historicStb[i] && tbs[i] ? (d === 'A' ? tbs[i]!.a : tbs[i]!.b) : undefined}
            style={[s.colGames, i < colunas.length - 1 && s.colGamesPassado]}
          />
        ))}
        <Text style={[s.colPts, { color: cor }]}>{pts}</Text>
      </View>
    );
  };

  return (
    <View style={s.scoreboard}>
      <View style={s.cabecalho}>
        <Text style={s.cabTxt}>
          MD{rule.sets} · {rule.games} games · Set {placard.historicGamesA.length + 1}
          {placard.tiebreak ? (placard.superTiebreakAtivo ? ` · SUPER TIE-BREAK ${rule.superTiebreakPts ?? 10} pts` : ' · TIEBREAK') : ''}
        </Text>
        <View style={s.cabCols}>
          {[...placard.historicGamesA, 0].map((_, i) => (
            <Text key={i} style={s.cabCol}>SET {i + 1}</Text>
          ))}
          <Text style={[s.cabCol, { width: 64 }]}>PONTOS</Text>
        </View>
      </View>
      {linha('A')}
      {linha('B')}

      {/* Ponto rápido: credita o placar sem abrir o formulário completo */}
      <View style={s.quickRow}>
        <TouchableOpacity style={[s.quickBtn, { borderColor: Colors.gold + '66' }]} onPress={() => onPontoRapido('A')} activeOpacity={0.75}>
          <Text style={[s.quickTxt, { color: Colors.gold }]}>⚡ Ponto rápido</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.quickBtn, { borderColor: Colors.teal + '66' }]} onPress={() => onPontoRapido('B')} activeOpacity={0.75}>
          <Text style={[s.quickTxt, { color: Colors.teal }]}>⚡ Ponto rápido</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  scoreboard: { backgroundColor: Colors.surf, borderBottomWidth: 1, borderBottomColor: Colors.line },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 4 },
  cabTxt: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, flexShrink: 1 },
  cabCols: { flexDirection: 'row', alignItems: 'center' },
  cabCol: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.faint, width: 44, textAlign: 'center' },
  linha: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surf2, borderRadius: Radius.md, borderLeftWidth: 3, marginHorizontal: Spacing.md, marginBottom: 6, paddingVertical: 6, paddingLeft: 10 },
  linhaNome: { flex: 1, paddingRight: 6 },
  nome: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  sacando: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  colGamesPassado: { color: Colors.muted },
  colGames: { fontFamily: FontFamily.numberBold, fontSize: 22, color: Colors.text, width: 44, textAlign: 'center' },
  colPts: { fontFamily: FontFamily.numberBold, fontSize: 34, lineHeight: 40, width: 64, textAlign: 'center' },
  quickRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  quickBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, backgroundColor: Colors.surf2, minHeight: 44, justifyContent: 'center' },
  quickTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13 },
});
