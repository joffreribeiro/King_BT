import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { Spacing, Radius, Type, FontFamily, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { todayLocal } from '@/logic/eventDateTime';
import { eventView, nextUpcoming, type EventView } from '@/logic/eventRegistration';
import { EventHero } from './EventInfo';

function infoText(ev: EventView): string | null {
  if (ev.me === 'principal') return 'Você está inscrito.';
  if (ev.me === 'espera') return `Você é o ${ev.waitPos}º da fila de espera.`;
  if (ev.full) return ev.waitCount > 0 ? `Lotado — ${ev.waitCount} na lista de espera.` : 'Lotado — entre na lista de espera.';
  return null;
}

/**
 * Cartão da próxima competição agendada. "Ver inscrição" abre o painel do
 * evento (tela da competição), onde ficam a inscrição, a lista principal e a
 * fila de espera. O cartão só resume: data, horário, local e vagas.
 */
export function EventCard() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { state } = useCompetitions();
  const { group, myPlayerId, isMember } = useAuth();

  const comp = useMemo(() => nextUpcoming(state.competitions, todayLocal().iso), [state.competitions]);
  if (!comp || !isMember || !group) return null;

  const ev = eventView(comp, myPlayerId);
  const status = ev.me === 'principal' ? { t: 'Você está dentro', c: Colors.teal }
    : ev.me === 'espera' ? { t: 'Na lista de espera', c: Colors.gold }
    : ev.full ? { t: 'Lotado', c: Colors.gold }
    : { t: 'Inscrições abertas', c: Colors.teal };
  const info = infoText(ev);
  const dots = ev.vagas != null && ev.vagas <= 16 ? Array.from({ length: ev.vagas }, (_, i) => i < ev.taken) : null;
  const open = () => router.push({ pathname: '/competitions/[id]', params: { id: comp.id } });

  return (
    <View style={s.wrap}>
      <Text style={s.label}>PRÓXIMO EVENTO</Text>
      <View style={s.card}>
        <TouchableOpacity activeOpacity={0.92} onPress={open} accessibilityRole="button" accessibilityLabel={`Abrir ${comp.name}`}>
          <EventHero comp={comp} statusLabel={status.t} statusColor={status.c} height={210} showMeta suave />
        </TouchableOpacity>

        <View style={s.body}>
          {ev.lastSpot && <View style={s.alert}><Text style={s.alertText}>🔥 Última vaga</Text></View>}
          {!!info && <Text style={s.info}>{info}</Text>}

          <View style={s.row}>
            <TouchableOpacity style={s.cta} onPress={open} activeOpacity={0.85} accessibilityRole="button">
              <Text style={s.ctaText}>Ver inscrição</Text>
            </TouchableOpacity>
            <View style={s.slots}>
              <Text style={s.slotsNum}>{ev.vagas != null ? `${ev.taken}/${ev.vagas}` : ev.taken}</Text>
              <Text style={s.slotsLabel}>{ev.vagas != null ? 'vagas ocupadas' : ev.taken === 1 ? 'confirmado' : 'confirmados'}</Text>
              {dots && (
                <View style={s.dots}>
                  {dots.map((on, i) => <View key={i} style={[s.dot, on && { backgroundColor: Colors.gold }]} />)}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  label: { ...Type.sectionLabel, color: Colors.gold, marginBottom: Spacing.sm, marginLeft: 2 },
  card: { borderRadius: 22, overflow: 'hidden', backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line },
  body: { padding: Spacing.md, gap: Spacing.sm + 2 },
  alert: { alignSelf: 'flex-start', backgroundColor: Colors.gold + '22', borderWidth: 1, borderColor: Colors.gold + '80', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  alertText: { ...Type.body, fontFamily: FontFamily.title, color: Colors.gold },
  info: { ...Type.body, color: Colors.muted },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 2 },
  cta: { flex: 1, minHeight: 50, borderRadius: Radius.full, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: Colors.bg },
  slots: { alignItems: 'flex-end', minWidth: 92 },
  slotsNum: { fontFamily: FontFamily.numberBold, fontSize: 28, lineHeight: 30, color: Colors.text },
  slotsLabel: { ...Type.body, fontSize: 12, color: Colors.muted, marginTop: 2 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 3, marginTop: 6, maxWidth: 110 },
  dot: { width: 7, height: 7, borderRadius: 2, backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line },
});
