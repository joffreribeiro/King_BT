import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo } from 'react';
import { Calendar } from 'react-native-calendars';
import { router } from 'expo-router';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Card } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import type { Competition } from '@/logic/types';

const FORMAT_LABEL: Record<string, string> = {
  avulso: 'Avulso', liga: 'Liga', grupos: 'Grupos',
  mata: 'Mata-Mata', super8: 'Super 8',
};
const FORMAT_COLOR: Record<string, string> = {
  avulso: '#38BDF8', liga: '#54B981', grupos: '#6B7FD7',
  mata: '#E5483D',   super8: '#F472B6',
};

export default function CalendarScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { state } = useCompetitions();
  const [selected, setSelected] = useState<string | null>(null);

  const compsByDate = useMemo(() => {
    const map: Record<string, Competition[]> = {};
    state.competitions.forEach(comp => {
      if (!comp.date) return;
      const d = comp.date.split('T')[0];
      if (!map[d]) map[d] = [];
      map[d].push(comp);
    });
    return map;
  }, [state.competitions]);

  const markedDates = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const result: Record<string, object> = {};

    Object.entries(compsByDate).forEach(([date]) => {
      const isPast = date <= today;
      result[date] = {
        marked: true,
        dotColor: isPast ? Colors.gold : Colors.teal,
      };
    });

    if (selected) {
      result[selected] = {
        ...(result[selected] ?? {}),
        selected: true,
        selectedColor: 'rgba(243,197,68,0.25)',
        selectedTextColor: Colors.gold,
      };
    }

    return result;
  }, [compsByDate, selected]);

  const selectedComps: Competition[] = selected ? (compsByDate[selected] ?? []) : [];

  const totalMatches = state.competitions.reduce(
    (sum, c) => sum + c.matches.filter(m => m.scoreA != null).length, 0
  );

  // Strip semanal — semana atual começando na segunda
  const today = new Date();
  const WEEK_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const weekDays = useMemo(() => {
    const startOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + startOffset + i);
      const dateStr = d.toISOString().split('T')[0];
      return {
        date: d,
        dateStr,
        dayNum: d.getDate(),
        letter: WEEK_LETTERS[i],
        isToday: d.toDateString() === today.toDateString(),
        hasComp: !!compsByDate[dateStr],
      };
    });
  }, [compsByDate]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <Text style={s.title}>Calendário 📅</Text>
          <Text style={s.subtitle}>Dias com competições registradas</Text>
        </View>

        {/* Strip de 7 dias */}
        <View style={s.weekStrip}>
          {weekDays.map((day, i) => (
            <TouchableOpacity
              key={i}
              style={s.dayCol}
              onPress={() => setSelected(day.dateStr)}
              activeOpacity={0.75}
            >
              <Text style={s.dayLetter}>{day.letter}</Text>
              <View style={[
                s.dayCircle,
                day.isToday && s.dayCircleToday,
                selected === day.dateStr && !day.isToday && s.dayCircleSelected,
              ]}>
                <Text style={[
                  s.dayNum,
                  day.isToday && s.dayNumToday,
                  selected === day.dateStr && !day.isToday && { color: Colors.gold },
                ]}>
                  {day.dayNum}
                </Text>
              </View>
              {day.hasComp && (
                <View style={[s.dayDot, { backgroundColor: day.isToday ? '#fff' : Colors.gold }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.calWrap}>
          <Calendar
            markingType="dot"
            markedDates={markedDates}
            onDayPress={day => setSelected(day.dateString)}
            theme={{
              backgroundColor: Colors.surf,
              calendarBackground: Colors.surf,
              textSectionTitleColor: Colors.muted,
              selectedDayBackgroundColor: Colors.gold,
              selectedDayTextColor: Colors.bg,
              todayTextColor: Colors.gold,
              dayTextColor: Colors.text,
              textDisabledColor: Colors.faint,
              dotColor: Colors.gold,
              selectedDotColor: Colors.bg,
              arrowColor: Colors.gold,
              disabledArrowColor: Colors.faint,
              monthTextColor: Colors.text,
              indicatorColor: Colors.gold,
              textDayFontFamily: FontFamily.bodyMed,
              textMonthFontFamily: FontFamily.titleBold,
              textDayHeaderFontFamily: FontFamily.title,
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 12,
            }}
          />
        </View>

        {/* Legenda */}
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: Colors.gold }]} />
            <Text style={s.legendText}>Sessão passada</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: Colors.teal }]} />
            <Text style={s.legendText}>Próxima sessão</Text>
          </View>
        </View>

        {/* Competições do dia selecionado */}
        {selected && (
          <View style={s.daySection}>
            <Text style={s.dayLabel}>
              {new Date(selected + 'T12:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long',
              }).toUpperCase()}
            </Text>

            {selectedComps.length === 0 ? (
              <Card>
                <Text style={s.emptyText}>Nenhuma competição neste dia.</Text>
              </Card>
            ) : (
              selectedComps.map(comp => {
                const accent = FORMAT_COLOR[comp.format] ?? Colors.gold;
                const played = comp.matches.filter(m => m.scoreA != null).length;
                return (
                  <TouchableOpacity
                    key={comp.id}
                    onPress={() => router.push({ pathname: '/competitions/[id]', params: { id: comp.id } })}
                    activeOpacity={0.75}
                  >
                    <Card style={s.compCard}>
                      <View style={[s.accentBar, { backgroundColor: accent }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.compName}>{comp.name}</Text>
                        <Text style={s.compMeta}>
                          {FORMAT_LABEL[comp.format]} · {played}/{comp.matches.length} jogos
                        </Text>
                      </View>
                      <View style={[s.statusBadge, {
                        backgroundColor: comp.status === 'done'
                          ? 'rgba(84,185,129,0.12)' : 'rgba(243,197,68,0.12)',
                        borderColor: comp.status === 'done'
                          ? 'rgba(84,185,129,0.3)' : 'rgba(243,197,68,0.3)',
                      }]}>
                        <Text style={[s.statusText, {
                          color: comp.status === 'done' ? Colors.teal : Colors.gold,
                        }]}>
                          {comp.status === 'done' ? 'Encerrada' : 'Em andamento'}
                        </Text>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Resumo geral */}
        <View style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.xl }}>
          <Card style={s.summary}>
            <Text style={s.summaryTitle}>RESUMO GERAL</Text>
            <View style={s.summaryRow}>
              {[
                { label: 'Sessões',     value: Object.keys(compsByDate).length },
                { label: 'Competições', value: state.competitions.length },
                { label: 'Partidas',    value: totalMatches },
              ].map(stat => (
                <View key={stat.label} style={s.summaryItem}>
                  <Text style={s.summaryValue}>{stat.value}</Text>
                  <Text style={s.summaryLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg },
  header:      { padding: Spacing.md, paddingBottom: Spacing.sm },
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 4,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dayLetter: {
    fontFamily: FontFamily.numberBold,
    fontSize: 10,
    color: Colors.faint,
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    backgroundColor: '#F3C544',
    shadowColor: '#F3C544',
    shadowRadius: 8,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  dayCircleSelected: {
    borderWidth: 1,
    borderColor: 'rgba(243,197,68,0.4)',
    backgroundColor: 'rgba(243,197,68,0.1)',
  },
  dayNum: {
    fontFamily: FontFamily.numberBold,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
  },
  dayNumToday: { color: '#000' },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  title:       { fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.text },
  subtitle:    { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: 4 },
  calWrap:     { margin: Spacing.md, borderRadius: Radius.lg, overflow: 'hidden',
                 borderWidth: 1, borderColor: Colors.line },
  legend:      { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.md,
                 marginBottom: Spacing.md },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  daySection:  { paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md },
  dayLabel:    { fontFamily: FontFamily.title, fontSize: 12, color: Colors.muted, letterSpacing: 1 },
  emptyText:   { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  compCard:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  accentBar:   { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  compName:    { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text },
  compMeta:    { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusText:  { fontFamily: FontFamily.bodyMed, fontSize: 11 },
  summary:     { gap: Spacing.sm },
  summaryTitle:{ fontFamily: FontFamily.title, fontSize: 12, color: Colors.muted, letterSpacing: 1 },
  summaryRow:  { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue:{ fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.gold },
  summaryLabel:{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
});
