import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/store/ThemeContext';
import { FontFamily, Spacing, type ThemeColors } from '@/theme';
import { assinarFalhasArmazenamento, tentarGravarDeNovo, totalFalhasArmazenamento } from '@/logic/avisoArmazenamento';

/**
 * Faixa no topo de qualquer tela quando o aparelho não conseguiu gravar (memória cheia ou
 * armazenamento indisponível). O jogo segue na tela; o botão tenta gravar de novo.
 */
export function StorageAlertBanner() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const [total, setTotal] = useState(totalFalhasArmazenamento());
  const [tentando, setTentando] = useState(false);
  useEffect(() => assinarFalhasArmazenamento(() => setTotal(totalFalhasArmazenamento())), []);
  if (total === 0) return null;

  async function tentar() {
    setTentando(true);
    await tentarGravarDeNovo();
    setTentando(false);
  }

  return (
    <View style={[s.faixa, { paddingTop: insets.top + 6 }]} accessibilityRole="alert" pointerEvents="box-none">
      <View style={{ flex: 1 }}>
        <Text style={s.titulo}>Não consegui salvar no aparelho</Text>
        <Text style={s.texto}>O jogo continua na tela. Libere espaço no celular e toque em Tentar novamente.</Text>
      </View>
      <TouchableOpacity onPress={tentar} disabled={tentando} style={s.botao} accessibilityRole="button">
        <Text style={s.botaoTxt}>{tentando ? '...' : 'Tentar novamente'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  faixa: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, elevation: 9999,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingBottom: 8,
    backgroundColor: C.surf, borderBottomWidth: 1, borderBottomColor: C.coral,
  },
  titulo: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: C.coral },
  texto: { fontFamily: FontFamily.body, fontSize: 11, color: C.text },
  botao: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: C.gold, borderRadius: 6 },
  botaoTxt: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: '#000' },
});
