import { StyleSheet } from 'react-native';
import { FontFamily, Spacing, centeredContent, Radius, Type, type ThemeColors } from '@/theme';

// Estilos compartilhados pelas views por formato (Rotating/League/Groups/KO/Bracket)
// Parametrizados pela paleta ativa — chamar com useMemo(() => makeVw(Colors), [Colors]) no componente.
export const makeVw = (Colors: ThemeColors) => StyleSheet.create({
  scroll: { ...centeredContent, padding: Spacing.md, gap: Spacing.sm },
  prog: { gap: Spacing.sm, marginBottom: Spacing.sm },
  progRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progLabel: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  progCount: { fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.text },
  track: { height: 6, backgroundColor: Colors.line, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: Colors.teal, borderRadius: 3 },
  rei: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.gold, textAlign: 'center' },
  section: { ...Type.sectionLabel, color: Colors.muted, textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: Spacing.sm },
  locked: { alignItems: 'center', padding: Spacing.xl },
  lockedText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted, textAlign: 'center' },
  groupsDoneBanner: { backgroundColor: Colors.teal + '18', borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.teal + '44', marginTop: Spacing.sm },
  groupsDoneTitle: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.teal },
  groupsDoneBtn: { backgroundColor: Colors.teal, borderRadius: Radius.md, paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.md },
  groupsDoneBtnText: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
});

export const makeTabs = (Colors: ThemeColors) => StyleSheet.create({
  bar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.line },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  active: { borderBottomColor: Colors.gold },
  text: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.muted },
  textActive: { color: Colors.gold, fontFamily: FontFamily.title },
});
