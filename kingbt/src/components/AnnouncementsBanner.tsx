import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useSettings } from '@/store/SettingsContext';
import { useAnnouncementsDismissed } from '@/hooks/useAnnouncementsDismissed';
import { visibleAnnouncements } from '@/logic/announcements';

const brDate = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '');

/** Comunicados do admin no topo da Home. Some sozinho quando não há nenhum vigente. */
export function AnnouncementsBanner() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { announcements } = useSettings();
  const { dismissed, dismiss } = useAnnouncementsDismissed();
  const list = useMemo(() => visibleAnnouncements(announcements, dismissed), [announcements, dismissed]);

  if (list.length === 0) return null;
  return (
    <View style={{ gap: Spacing.sm }}>
      {list.map(a => (
        <View key={a.id} style={[s.card, a.pinned && s.cardPinned]} accessibilityRole="alert">
          <View style={s.top}>
            <Text style={s.tag}>{a.pinned ? '📌 COMUNICADO FIXADO' : '📣 COMUNICADO'}</Text>
            <Text style={s.date}>{brDate(a.date)}</Text>
            {!a.pinned && (
              <TouchableOpacity onPress={() => dismiss(a.id)} hitSlop={10} style={s.close} accessibilityRole="button" accessibilityLabel="Dispensar comunicado">
                <Text style={s.closeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!a.title && <Text style={s.title}>{a.title}</Text>}
          <Text style={s.text}>{a.text}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: C.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.gold + '66', padding: Spacing.md, gap: 4 },
  cardPinned: { borderColor: C.gold, backgroundColor: C.gold + '14' },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tag: { flex: 1, fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.2, color: C.gold },
  date: { fontFamily: FontFamily.body, fontSize: 13, color: C.muted },
  close: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: FontFamily.body, fontSize: 16, color: C.muted },
  title: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 22, lineHeight: 26, color: C.text },
  text: { fontFamily: FontFamily.body, fontSize: 15, lineHeight: 22, color: C.text },
});
