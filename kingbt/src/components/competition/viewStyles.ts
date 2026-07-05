import { StyleSheet } from 'react-native';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';

// Estilos compartilhados pelas views por formato (Rotating/League/Groups/KO/Bracket)
// Parametrizados pela paleta ativa — chamar com useMemo(() => makeVw(Colors), [Colors]) no componente.
export const makeVw = (Colors: ThemeColors) => StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  prog: { gap: Spacing.sm, marginBottom: Spacing.sm },
  progRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  progCount: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.text },
  track: { height: 4, backgroundColor: Colors.line, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: Colors.teal, borderRadius: 2 },
  rei: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.gold, textAlign: 'center' },
  section: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted, letterSpacing: 1, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  locked: { alignItems: 'center', padding: Spacing.xl },
  lockedText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, textAlign: 'center' },
  groupsDoneBanner: { backgroundColor: Colors.teal + '18', borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.teal + '44', marginTop: Spacing.sm },
  groupsDoneTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.teal },
  groupsDoneBtn: { backgroundColor: Colors.teal, borderRadius: Radius.md, paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.md },
  groupsDoneBtnText: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.bg },
});

export const makeTabs = (Colors: ThemeColors) => StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: Colors.surf2, borderBottomWidth: 1, borderBottomColor: Colors.line },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center' },
  active: { borderBottomWidth: 2, borderBottomColor: Colors.gold },
  text: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.faint },
  textActive: { color: Colors.gold },
});
