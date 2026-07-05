import { StyleSheet } from 'react-native';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';

// Estilos compartilhados pelas abas do perfil (Resumo/Histórico/Rivalidades)
export const makeTab = (Colors: ThemeColors) => StyleSheet.create({
  content: { gap: Spacing.md },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text, marginBottom: Spacing.xs },
  filterBtn: { flex: 1, paddingVertical: Spacing.xs + 2, borderRadius: Radius.sm, backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line, alignItems: 'center' },
  filterBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filterLabel: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.faint },
  filterLabelActive: { color: Colors.bg, fontWeight: '700' },
});
