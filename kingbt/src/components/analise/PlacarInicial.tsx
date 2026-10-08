import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { FontFamily, Radius, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import type { BtPlacarSeed, BtWinRule } from '@/logic/btTracker';
import { validarSeed } from '@/logic/btSeed';

const numero = (t: string) => Math.max(0, parseInt(t, 10) || 0);

type Props = {
  rule: BtWinRule;
  /** Placar já aplicado (para mostrar o resumo e permitir limpar). */
  aplicado?: BtPlacarSeed;
  onAplicar: (seed: BtPlacarSeed | undefined) => void;
};

/**
 * "A partida já começou?": permite abrir o scout no meio do jogo, informando os sets já jogados e os games do
 * set em andamento. Só aparece antes do primeiro ponto; o placar é validado contra a regra da competição.
 */
export function PlacarInicial({ rule, aplicado, onAplicar }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const [aberto, setAberto] = useState(false);
  const [sets, setSets] = useState<{ a: string; b: string }[]>([]);
  const [gamesA, setGamesA] = useState('');
  const [gamesB, setGamesB] = useState('');

  const maxSetsJogados = Math.max(0, Math.ceil(rule.sets / 2) * 2 - 2); // ex.: MD3 => até 2 sets antes do decisivo
  const seed = useMemo<BtPlacarSeed>(() => ({
    setsFechados: sets.map(x => ({ a: numero(x.a), b: numero(x.b) })),
    gamesA: numero(gamesA), gamesB: numero(gamesB),
  }), [sets, gamesA, gamesB]);
  const validacao = useMemo(() => validarSeed(rule, seed), [rule, seed]);
  const vazio = sets.length === 0 && numero(gamesA) === 0 && numero(gamesB) === 0;

  const resumo = aplicado
    ? [...(aplicado.setsFechados ?? []).map(x => `${x.a}-${x.b}`), `${aplicado.gamesA}-${aplicado.gamesB}`].join(' · ')
    : null;

  function atualizarSet(i: number, lado: 'a' | 'b', v: string) {
    setSets(prev => prev.map((x, j) => (j === i ? { ...x, [lado]: v.replace(/\D/g, '').slice(0, 2) } : x)));
  }

  return (
    <View style={s.wrap}>
      <TouchableOpacity style={s.toggle} onPress={() => setAberto(v => !v)} activeOpacity={0.75}>
        <Text style={s.toggleTxt}>
          {aplicado ? `✔ Começou em: ${resumo} (games do set atual no fim)` : aberto ? '▲ A partida já começou?' : '▼ A partida já começou? (opcional)'}
        </Text>
      </TouchableOpacity>

      {aberto && (
        <View style={s.corpo}>
          <Text style={s.hint}>Informe os sets já jogados e os games do set em andamento. Os pontos do game atual começam do zero.</Text>

          {sets.map((set, i) => (
            <View key={i} style={s.linha}>
              <Text style={s.rotulo}>Set {i + 1}</Text>
              <TextInput style={s.input} value={set.a} onChangeText={v => atualizarSet(i, 'a', v)} keyboardType="number-pad" placeholder="A" placeholderTextColor={Colors.faint} />
              <Text style={s.x}>×</Text>
              <TextInput style={s.input} value={set.b} onChangeText={v => atualizarSet(i, 'b', v)} keyboardType="number-pad" placeholder="B" placeholderTextColor={Colors.faint} />
              <TouchableOpacity onPress={() => setSets(prev => prev.filter((_, j) => j !== i))} hitSlop={8}>
                <Text style={s.remover}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {sets.length < maxSetsJogados && (
            <TouchableOpacity onPress={() => setSets(prev => [...prev, { a: '', b: '' }])}>
              <Text style={s.link}>+ Adicionar set já jogado</Text>
            </TouchableOpacity>
          )}

          <View style={s.linha}>
            <Text style={s.rotulo}>Set atual (games)</Text>
            <TextInput style={s.input} value={gamesA} onChangeText={v => setGamesA(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="A" placeholderTextColor={Colors.faint} />
            <Text style={s.x}>×</Text>
            <TextInput style={s.input} value={gamesB} onChangeText={v => setGamesB(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="B" placeholderTextColor={Colors.faint} />
          </View>

          {!vazio && !validacao.valido && <Text style={s.erro}>{validacao.erro}</Text>}

          <View style={s.acoes}>
            <TouchableOpacity
              style={[s.btn, (vazio || !validacao.valido) && { opacity: 0.4 }]}
              disabled={vazio || !validacao.valido}
              onPress={() => { onAplicar(seed); setAberto(false); }}
            >
              <Text style={s.btnTxt}>Começar deste placar</Text>
            </TouchableOpacity>
            {aplicado && (
              <TouchableOpacity
                style={[s.btn, s.btnSec]}
                onPress={() => { onAplicar(undefined); setSets([]); setGamesA(''); setGamesB(''); setAberto(false); }}
              >
                <Text style={[s.btnTxt, { color: Colors.muted }]}>Voltar ao 0x0</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  wrap: { marginBottom: Spacing.sm },
  toggle: { borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  toggleTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  corpo: { gap: Spacing.sm, paddingTop: Spacing.sm },
  hint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  linha: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rotulo: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text, minWidth: 110 },
  input: {
    width: 52, textAlign: 'center', fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.text,
    backgroundColor: Colors.surf2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, paddingVertical: 6,
  },
  x: { fontFamily: FontFamily.number, fontSize: 16, color: Colors.faint },
  remover: { fontSize: 15, color: Colors.coral, paddingHorizontal: 6 },
  link: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.teal },
  erro: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.coral },
  acoes: { flexDirection: 'row', gap: Spacing.sm },
  btn: { flex: 1, backgroundColor: Colors.teal, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  btnSec: { backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line },
  btnTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.bg },
});
