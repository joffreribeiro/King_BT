import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Card } from '@/components';
import { CONFIDENCE_LABEL, suggestionBasis, type CategorySuggestion } from '@/logic/categorySuggestion';
import type { Category } from '@/logic/playerAbout';

interface Props {
  suggestion: CategorySuggestion;
  /** Categoria que o jogador declarou no perfil. */
  declared?: Category;
  /** Só no próprio perfil: aplica a sugestão como categoria. */
  onApply?: (c: Category) => void;
  applying?: boolean;
}

/** "Categoria sugerida pelo Radar": mistura da autoavaliação com a opinião dos colegas. */
export function CategorySuggestionCard({ suggestion, declared, onApply, applying }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const same = declared === suggestion.category;

  return (
    <Card>
      <Text style={s.label}>CATEGORIA SUGERIDA PELA AVALIAÇÃO</Text>
      <View style={s.row}>
        <View style={s.badge}><Text style={s.badgeText}>{suggestion.category}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.score}>Nota {Math.round(suggestion.score)} de 100</Text>
          <Text style={[s.conf, suggestion.confidence === 'baixa' && { color: Colors.coral }]}>{CONFIDENCE_LABEL[suggestion.confidence]}</Text>
        </View>
      </View>
      <Text style={s.basis}>{suggestionBasis(suggestion)}</Text>
      {same ? (
        <Text style={s.ok}>É a categoria que {onApply ? 'você escolheu' : 'ele(a) escolheu'}.</Text>
      ) : (
        <Text style={s.basis}>
          {declared ? `Categoria escolhida: ${declared}. ` : 'Nenhuma categoria escolhida. '}A sugestão é só uma referência.
        </Text>
      )}
      {!!onApply && !same && (
        <TouchableOpacity style={[s.btn, applying && { opacity: 0.5 }]} onPress={() => onApply(suggestion.category)} disabled={applying} accessibilityRole="button" accessibilityLabel={`Usar categoria ${suggestion.category}`}>
          <Text style={s.btnText}>Usar categoria {suggestion.category}</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  label: { fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.3, color: Colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.sm },
  badge: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: Colors.gold, backgroundColor: Colors.gold + '1F', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 24, color: Colors.gold },
  score: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.text },
  conf: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.teal, marginTop: 2 },
  basis: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: Colors.muted, marginTop: 4 },
  ok: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.teal, marginTop: 6 },
  btn: { marginTop: Spacing.md, minHeight: 46, borderRadius: Radius.full, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: Colors.bg },
});
