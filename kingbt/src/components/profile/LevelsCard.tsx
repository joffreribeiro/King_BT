import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Card } from '@/components';
import { ProgressBar } from '@/components/ProgressBar';
import { levelRows, playerLevel } from '@/logic/playerLevel';

/**
 * "Níveis e XP": o nível atual e quanto falta para o próximo, e, ao expandir, todos os níveis com o XP
 * de cada um e quanto ainda falta para chegar lá.
 */
export function LevelsCard({ xp }: { xp: number }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [open, setOpen] = useState(false);
  const level = playerLevel(xp);
  const rows = useMemo(() => levelRows(xp), [xp]);
  const fmt = (n: number) => n.toLocaleString('pt-BR');

  return (
    <Card>
      <Text style={s.title}>Níveis e XP</Text>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.cur}>{level.name}</Text>
          <Text style={s.hint}>
            {fmt(xp)} XP{level.next ? ` · faltam ${fmt(level.remaining)} para ${level.next.name}` : ' · nível máximo'}
          </Text>
        </View>
      </View>
      <View style={{ marginTop: Spacing.sm }}><ProgressBar pct={level.progress * 100} height={8} /></View>

      <TouchableOpacity style={s.toggle} onPress={() => setOpen(v => !v)} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={s.toggleText}>{open ? 'Esconder os níveis' : 'Ver todos os níveis'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: Spacing.xs }}>
          {rows.map((r, i) => (
            <View key={r.name}>
              {(i === 0 || rows[i - 1].tier !== r.tier) && <Text style={s.tier}>{r.tier.toUpperCase()}</Text>}
              <View style={[s.row, r.status === 'current' && s.rowCurrent]}>
                <Text style={[s.mark, r.status === 'locked' && { color: C.faint }]}>{r.status === 'reached' ? '✓' : r.status === 'current' ? '●' : '○'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.name, r.status === 'current' && { color: C.gold }, r.status === 'locked' && { color: C.muted }]}>{r.name}</Text>
                  <Text style={s.hint}>{r.min === 0 ? 'Nível inicial' : `a partir de ${fmt(r.min)} XP`}</Text>
                </View>
                <Text style={[s.status, r.status === 'current' && { color: C.gold }]}>
                  {r.status === 'reached' ? 'Alcançado' : r.status === 'current' ? 'Você está aqui' : `faltam ${fmt(r.remaining)} XP`}
                </Text>
              </View>
            </View>
          ))}
          <Text style={[s.hint, { marginTop: Spacing.sm }]}>O XP vem de jogos, vitórias, competições, avaliações e conquistas. Toque no seu nível, no topo do perfil, para ver a conta.</Text>
        </View>
      )}
    </Card>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  title: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 22, color: C.text },
  top: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  cur: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 26, lineHeight: 30, color: C.gold },
  hint: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: C.muted },
  toggle: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  toggleText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.gold },
  tier: { fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.3, color: C.muted, marginTop: Spacing.md, marginBottom: 4 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, paddingHorizontal: Spacing.sm, borderRadius: Radius.md },
  rowCurrent: { backgroundColor: C.gold + '1A', borderWidth: 1, borderColor: C.gold + '66' },
  mark: { width: 20, fontFamily: FontFamily.titleBold, fontSize: 16, color: C.teal, textAlign: 'center' },
  name: { fontFamily: FontFamily.titleBold, fontSize: 16, color: C.text },
  status: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.muted, textAlign: 'right' },
});
