import { useEffect, useMemo } from 'react';
import { AppState, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/store/ThemeContext';
import { useBiometria } from '@/store/BiometriaContext';
import { FontFamily, Spacing, type ThemeColors } from '@/theme';

/**
 * Tela de bloqueio por cima de todo o app. Enquanto a preferência não foi lida também cobre
 * (na web e com o bloqueio desligado some na hora), para o conteúdo não aparecer por um instante.
 */
export function BiometriaGate() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { carregado, bloqueado, desbloquear } = useBiometria();
  const coberto = !carregado || bloqueado;

  // Pede sozinho ao abrir/voltar; se o usuário cancelar, fica o botão "Desbloquear".
  useEffect(() => {
    if (bloqueado && AppState.currentState === 'active') void desbloquear();
  }, [bloqueado, desbloquear]);

  if (!coberto) return null;
  return (
    <View style={s.tela} accessibilityViewIsModal>
      <Image source={require('../../assets/kingbt-icon.png')} style={s.logo} resizeMode="contain" />
      <Text style={s.titulo}>KING BT</Text>
      {bloqueado && (
        <>
          <Text style={s.texto}>Use a digital ou o rosto para abrir.</Text>
          <TouchableOpacity style={s.botao} onPress={() => void desbloquear()} accessibilityRole="button">
            <Text style={s.botaoTxt}>Desbloquear</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  tela: {
    ...StyleSheet.absoluteFillObject, zIndex: 100000, elevation: 100000,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl,
  },
  logo: { width: 96, height: 96 },
  titulo: { fontFamily: FontFamily.title, fontSize: 28, color: C.gold },
  texto: { fontFamily: FontFamily.body, fontSize: 14, color: C.muted, textAlign: 'center' },
  botao: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: C.gold, borderRadius: 8 },
  botaoTxt: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: '#000' },
});
