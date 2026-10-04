import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FontFamily, Spacing, Type, wideContent, type ThemeColors } from '@/theme';
import { useIsWide } from '@/hooks/useIsWide';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import FeedScreen from './feed';
import RankingScreen from './ranking';
import { AtletasSection } from '@/components/AtletasSection';

type Section = 'feed' | 'ranking' | 'atletas';
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'feed', label: 'FEED' },
  { key: 'ranking', label: 'RANKING' },
  { key: 'atletas', label: 'ATLETAS' },
];

/**
 * Arena: onde o grupo se encontra. Três seções — Feed (o que aconteceu),
 * Ranking (quem está na frente) e Atletas (todos os jogadores). Abre em
 * `?tab=ranking` ou `?tab=atletas` quando o link pede.
 */
export default function ArenaScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { group } = useAuth();
  const wide = useIsWide();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [active, setActive] = useState<Section>(tab === 'ranking' || tab === 'atletas' ? tab : 'feed');

  // Links de outras telas ("Ver tudo", posição no ranking) escolhem a seção pelo parâmetro.
  useEffect(() => {
    if (tab === 'ranking' || tab === 'feed' || tab === 'atletas') setActive(tab);
  }, [tab]);

  return (
    <SafeAreaView style={s.container} edges={[]}>
      {/* Computador: título e abas alinhados com o conteúdo (mesma largura das colunas). */}
      <View style={wide ? s.headWide : undefined}>
      {!!group?.name && <Text style={s.groupTitle} numberOfLines={1}>{group.name}</Text>}
      <Text style={s.screenTitle}>Arena</Text>
      <View style={s.tabBar}>
        {SECTIONS.map(t => (
          <TouchableOpacity key={t.key} style={[s.tabItem, active === t.key && s.tabItemActive]} onPress={() => setActive(t.key)} accessibilityRole="button" accessibilityState={{ selected: active === t.key }}>
            <Text style={[s.tabLabel, active === t.key && s.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      </View>
      <View style={{ flex: 1 }}>
        {active === 'feed' ? <FeedScreen embedded /> : active === 'ranking' ? <RankingScreen embedded /> : <AtletasSection />}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  headWide: { ...wideContent, paddingHorizontal: Spacing.md },
  groupTitle: { fontFamily: FontFamily.bodyMed, fontSize: 14, letterSpacing: 0.4, color: Colors.gold, marginHorizontal: Spacing.md, marginTop: 0, marginBottom: Spacing.sm },
  screenTitle: { ...Type.screenTitle, color: Colors.text, marginHorizontal: Spacing.md, marginBottom: Spacing.md },
  tabBar: { flexDirection: 'row', marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabItemActive: { borderBottomColor: Colors.gold },
  tabLabel: { fontFamily: FontFamily.bodyMed, fontSize: 15, letterSpacing: 0.5, color: Colors.muted },
  tabLabelActive: { color: Colors.gold, fontFamily: FontFamily.title },
});
