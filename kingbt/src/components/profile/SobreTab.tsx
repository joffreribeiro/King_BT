import { View, Text, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { FontFamily, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Card } from '@/components';
import {
  HANDS, SIDES, ageFromBirthday, formatHeight, practiceTime, type PlayerAbout,
} from '@/logic/playerAbout';
import { makeTab } from './profileStyles';
import { CategorySuggestionCard } from './CategorySuggestionCard';
import type { CategorySuggestion } from '@/logic/categorySuggestion';
import type { Category } from '@/logic/playerAbout';

/**
 * Aba "Sobre": a ficha do jogador, só para ler. A edição fica no lápis ao lado
 * do nome (EditProfileModal) — uma porta de entrada só para mudar dados.
 */
export function SobreTab({ about, ownerView = true, playerName = '', suggestion, onApplyCategory }: {
  about?: PlayerAbout;
  /** false = perfil de outro jogador: sem a dica do lápis. */
  ownerView?: boolean;
  playerName?: string;
  /** Categoria sugerida pelo Radar (autoavaliação + colegas). */
  suggestion?: CategorySuggestion | null;
  /** Só no próprio perfil: grava a sugestão como categoria. */
  onApplyCategory?: (c: Category) => void | Promise<void>;
}) {
  const { colors: Colors } = useTheme();
  const tab = useMemo(() => makeTab(Colors), [Colors]);
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const a = about ?? {};

  const age = ageFromBirthday(a.birthday);
  const since = practiceTime(a.since);

  const rows: { label: string; value: string | null; hint?: string | null }[] = [
    // A data de aniversário só é pedida na edição; aqui aparece a idade calculada a partir dela.
    { label: 'Idade', value: age != null ? `${age} ${age === 1 ? 'ano' : 'anos'}` : null },
    { label: 'Altura', value: a.heightM != null ? `${formatHeight(a.heightM)} m` : null },
    { label: 'Mão dominante', value: HANDS.find(h => h.key === a.hand)?.label ?? null },
    { label: 'Lado preferido', value: SIDES.find(x => x.key === a.side)?.label ?? null },
    // A data de início só é pedida na edição; aqui aparece só o tempo de prática.
    { label: 'Praticando beach tennis há', value: since },
    { label: 'Categoria', value: a.category ?? null, hint: suggestion && suggestion.category !== a.category ? `Avaliação sugere ${suggestion.category}` : null },
  ];
  const empty = rows.every(r => r.value == null);
  if (!ownerView && empty) {
    const first = playerName.trim().split(/\s+/)[0] || 'O jogador';
    return (
      <View style={tab.content}>
        <Card>
          <Text style={tab.sectionTitle}>Sobre</Text>
          <Text style={s.note}>{first} ainda não preencheu o Sobre.</Text>
        </Card>
        {!!suggestion && <CategorySuggestionCard suggestion={suggestion} />}
      </View>
    );
  }

  return (
    <View style={tab.content}>
      <Card>
        <Text style={tab.sectionTitle}>{ownerView ? 'Sobre você' : 'Sobre'}</Text>
        {rows.map((r, i) => (
          <View key={r.label} style={[s.row, i > 0 && s.rowBorder]}>
            <Text style={s.label}>{r.label}</Text>
            <View style={s.valueBox}>
              <Text style={[s.value, r.value == null && s.valueEmpty]}>{r.value ?? 'Não informado'}</Text>
              {!!r.hint && <Text style={s.hint}>{r.hint}</Text>}
            </View>
          </View>
        ))}
      </Card>
      {!!suggestion && (
        <CategorySuggestionCard suggestion={suggestion} declared={a.category} onApply={ownerView ? onApplyCategory : undefined} />
      )}
      {ownerView && (
        <Text style={s.note}>
          {empty ? 'Ainda não há nada por aqui. ' : ''}Toque no lápis, ao lado do seu nome, para preencher ou editar.
        </Text>
      )}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.line },
  label: { flex: 1, fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  valueBox: { alignItems: 'flex-end', flexShrink: 1 },
  value: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text, textAlign: 'right' },
  valueEmpty: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.faint },
  hint: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.gold, marginTop: 2 },
  note: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, color: Colors.muted, textAlign: 'center', paddingHorizontal: Spacing.md },
});
