import { StyleSheet } from 'react-native';
import { FontFamily, Spacing, Radius, Type, type ThemeColors } from '@/theme';

// Estilos compartilhados pelas abas do perfil (Resumo/Histórico/Rivalidades)
export const makeTab = (Colors: ThemeColors) => StyleSheet.create({
  content: { gap: Spacing.md },
  // Título de seção como na Home: 12px, maiúsculo, cinza.
  sectionTitle: { ...Type.sectionLabel, color: Colors.muted, textTransform: 'uppercase', marginBottom: Spacing.sm },
  filterBtn: { flex: 1, paddingVertical: Spacing.xs + 2, borderRadius: Radius.sm, backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line, alignItems: 'center' },
  filterBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filterLabel: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.faint },
  filterLabelActive: { color: Colors.bg, fontWeight: '700' },
});
