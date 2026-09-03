import { useMemo, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Spacing, Type, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Icon } from './icons';

interface Props {
  title: string;
  /** Linha secundária sob o título (contagem, contexto da tela). */
  subtitle?: string;
  /** Conteúdo livre sob o título, quando a segunda linha não é só texto
   *  (badges de status, chips) — mutuamente exclusivo com `subtitle`. */
  below?: ReactNode;
  /** Padrão: router.back(). */
  onBack?: () => void;
  /** Slot opcional à direita do título (botão de ação, badge etc.). */
  right?: ReactNode;
  /** Atalho de toque longo no título (renomear, por exemplo). */
  onTitleLongPress?: () => void;
}

/**
 * Header padrão "voltar + título". Cada tela reescrevia este bloco, e o título
 * acabou renderizando em 17, 18, 20, 24 e 26px conforme o arquivo — com a seta
 * ora em `teal`, ora na cor do texto. Aqui é `Type.h1` e o ícone `chevronLeft`,
 * sempre; o que varia por tela entra por `subtitle` e `right`.
 */
export function ScreenHeader({ title, subtitle, below, onBack, right, onTitleLongPress }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={s.header}>
      <TouchableOpacity
        onPress={onBack ?? (() => router.back())}
        hitSlop={8}
        style={s.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <Icon name="chevronLeft" size={22} color={Colors.teal} />
      </TouchableOpacity>
      <View style={s.titleWrap}>
        {onTitleLongPress ? (
          <TouchableOpacity onLongPress={onTitleLongPress} activeOpacity={0.7}>
            <Text style={s.title} numberOfLines={1}>{title}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={s.title} numberOfLines={1}>{title}</Text>
        )}
        {!!subtitle && <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>}
        {below}
      </View>
      {right}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  // 44px de alvo — é o botão voltar de 16 telas, e era 32 de largura.
  backBtn:   { width: 44, height: 44, marginLeft: -10, alignItems: 'flex-start', justifyContent: 'center' },
  titleWrap: { flex: 1 },
  title:     { ...Type.h1, color: Colors.text },
  subtitle:  { ...Type.caption, color: Colors.muted, marginTop: 1 },
});
