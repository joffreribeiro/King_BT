import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { APK_URL } from '@/store/UpdateContext';

/**
 * Bloqueia o app inteiro quando o build atual está abaixo da versão mínima
 * obrigatória (ver UpdateContext.updateRequired). Sem botão de fechar —
 * só sai daqui atualizando.
 */
export function MandatoryUpdateScreen() {
  const { colors: Colors } = useTheme();
  const s = makeStyles(Colors);

  function handleUpdate() {
    if (Platform.OS === 'web') window.location.reload();
    else Linking.openURL(APK_URL);
  }

  return (
    <View style={s.container}>
      <Text style={s.icon}>⬆️</Text>
      <Text style={s.title}>Atualização obrigatória</Text>
      <Text style={s.message}>
        Uma nova versão do King BT precisa ser instalada para continuar usando o app.
      </Text>
      <TouchableOpacity style={s.button} onPress={handleUpdate} activeOpacity={0.85}>
        <Text style={s.buttonText}>
          {Platform.OS === 'web' ? 'Atualizar agora' : 'Baixar atualização'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  icon:    { fontSize: 48 },
  title:   { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center' },
  message: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted, textAlign: 'center', lineHeight: 22 },
  button:  { backgroundColor: Colors.gold, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: Radius.md },
  buttonText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: Colors.bg },
});
