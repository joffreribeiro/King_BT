import { useMemo, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Spacing, Type, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

interface Props {
  title: string;
  /** Padrão: router.back(). */
  onBack?: () => void;
  /** Slot opcional à direita do título (botão de ação, badge etc.). */
  right?: ReactNode;
}

/** Header padrão "← título" — consolida o padrão repetido em ~24 telas. */
export function ScreenHeader({ title, onBack, right }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack ?? (() => router.back())} hitSlop={8}>
        <Text style={s.back}>←</Text>
      </TouchableOpacity>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  back:  { fontFamily: Type.h1.fontFamily, fontSize: 22, color: Colors.teal, width: 32 },
  title: { ...Type.h1, color: Colors.text, flex: 1 },
});
