import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar } from '@/components';
import { PLAYERS } from '@/mocks/data';
import { buildCompetition } from '@/logic/formats';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Format, Competitor, Gender } from '@/logic/types';
import { useState } from 'react';

const STEPS = ['Formato', 'Ajustes', 'Quem joga', 'Revisar'];

const FORMAT_LABEL: Record<Format, string> = {
  avulso: 'Avulso', liga: 'Liga', grupos: 'Grupos + Eliminatórias',
  mata: 'Mata-mata', super8: 'Super 8',
};
const FORMAT_ICON: Record<Format, string> = {
  liga: '≡', grupos: '⊞', mata: '⇌', avulso: '✕', super8: '◈',
};
const FORMAT_ICON_BG: Record<Format, string> = {
  liga: '#1a2e1a', grupos: '#1a1a2e', mata: '#2e1a1a', avulso: '#1a2a2e', super8: '#2a1a2e',
};
const FORMAT_ICON_COLOR: Record<Format, string> = {
  liga: '#54B981', grupos: '#6B7FD7', mata: '#E5483D', avulso: '#2DD4BF', super8: '#C084FC',
};

type Params = {
  format: Format; name: string; unit: string; gender: string; rounds: string;
  sets: string; games: string; tiebreak: string;
  location?: string; notes?: string;
  useOfficialRules?: string;
  groups: string; qualifiers: string;
  thirdPlace: string; playerIds: string; guestData?: string;
};

export default function ReviewStep() {
  const { addCompetition } = useCompetitions();
  const { myPlayerId } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const p = useLocalSearchParams<Params>();
  const [busy, setBusy] = useState(false);

  const isDuplas = p.unit === 'duplas';
  const gender = (p.gender ?? 'misto') as Gender;
  const GENDER_LABEL: Record<Gender, string> = { masculino: 'Masculino', feminino: 'Feminino', misto: 'Misto' };
  const roundsLabel = p.rounds === 'double' ? 'Ida e volta' : 'Turno único';
  const setsN = parseInt(p.sets ?? '1', 10) || 1;
  const gamesN = parseInt(p.games ?? '6', 10) || 6;
  const tiebreakN = parseInt(p.tiebreak ?? '7', 10) || 7;
  const setsLabel = setsN <= 1 ? '1 set' : `Melhor de ${setsN} sets`;
  const winRule = `${setsLabel} · até ${gamesN} games · TB ${tiebreakN} pts`;

  // Jogadores + convidados
  const guests: { id: string; name: string; color: string }[] = p.guestData ? JSON.parse(p.guestData) : [];
  const allPlayers = [
    ...PLAYERS.map(pl => ({ id: pl.id, name: pl.name, color: pl.color })),
    ...guests,
  ];

  // Montar competitors a partir dos playerIds
  const competitors: Competitor[] = (() => {
    if (!p.playerIds) return [];
    if (isDuplas) {
      return p.playerIds.split(',').map((pair, i) => {
        const [aId, bId] = pair.split('+');
        const pA = allPlayers.find(pl => pl.id === aId);
        const pB = allPlayers.find(pl => pl.id === bId);
        if (!pA || !pB) return null;
        return {
          id: `d${i}`,
          name: `${pA.name.split(' ')[0]}/${pB.name.split(' ')[0]}`,
          short: `${pA.name[0]}${pB.name[0]}`,
          color: pA.color,
          members: [aId, bId],
        };
      }).filter(Boolean) as Competitor[];
    }
    return p.playerIds.split(',').map(id => {
      const pl = allPlayers.find(x => x.id === id);
      if (!pl) return null;
      return { id, name: pl.name, short: pl.name.slice(0, 3).toUpperCase(), color: pl.color, members: [id] };
    }).filter(Boolean) as Competitor[];
  })();

  const comp = buildCompetition({
    name: p.name,
    format: p.format,
    unit: isDuplas ? 'duplas' : 'individual',
    gender,
    competitors,
    location: p.location?.trim() || undefined,
    notes: p.notes?.trim() || undefined,
    config: {
      rounds: p.rounds === 'double' ? 'double' : 'single',
      groups: parseInt(p.groups ?? '2'),
      qualifiers: parseInt(p.qualifiers ?? '2'),
      thirdPlace: p.thirdPlace === 'true',
      winRule: { sets: setsN, games: gamesN, tiebreak: tiebreakN },
      useOfficialRules: p.useOfficialRules !== 'false',
    },
  });

  async function start() {
    setBusy(true);
    const id = await addCompetition({ ...comp, createdBy: myPlayerId ?? undefined });
    setBusy(false);
    router.dismissAll();
    router.replace({ pathname: '/competitions/[id]', params: { id } });
  }

  async function schedule() {
    setBusy(true);
    // Cria sem jogos, status upcoming, participantes em aberto
    const upcoming = {
      ...comp,
      status: 'upcoming' as const,
      matches: [],
      competitors: [],
      confirmedIds: myPlayerId ? [myPlayerId] : [],
      createdBy: myPlayerId ?? undefined,
    };
    const id = await addCompetition(upcoming);
    setBusy(false);
    router.dismissAll();
    router.replace({ pathname: '/competitions/[id]', params: { id } });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/competitions/new/participants')} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova competição</Text>
      </View>

      {/* Steps */}
      <View style={styles.stepBar}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepLine, styles.stepLineActive]} />
            <Text style={[styles.stepLabel, i === 3 && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Cabeçalho do formato */}
        <View style={styles.fmtHeader}>
          <View style={[styles.fmtIcon, { backgroundColor: FORMAT_ICON_BG[p.format] }]}>
            <Text style={[styles.fmtIconText, { color: FORMAT_ICON_COLOR[p.format] }]}>
              {FORMAT_ICON[p.format]}
            </Text>
          </View>
          <View>
            <Text style={styles.fmtName}>{p.name}</Text>
            <Text style={styles.fmtSub}>
              {p.format === 'liga' ? 'Todos contra todos'
                : p.format === 'mata' ? 'Eliminação direta'
                : p.format === 'grupos' ? 'Fase de grupos + chave'
                : p.format === 'super8' ? 'Super 8 — parceiros rotativos'
                : 'Duplas rotativas'}
            </Text>
          </View>
        </View>

        {/* Resumo */}
        <View style={styles.summaryCard}>
          <SummaryRow label="Formato" value={FORMAT_LABEL[p.format]} />
          <SummaryRow label="Categoria" value={GENDER_LABEL[gender]} />
          <SummaryRow
            label="Competidores"
            value={`${competitors.length} ${isDuplas ? 'duplas' : 'jogadores'}`}
          />
          {(p.format === 'liga' || p.format === 'grupos') && (
            <SummaryRow label="Turnos" value={roundsLabel} />
          )}
          <SummaryRow label="Cada jogo" value={winRule} />
          {p.location?.trim() ? <SummaryRow label="Local" value={p.location.trim()} /> : null}
          {p.notes?.trim() ? <SummaryRow label="Observações" value={p.notes.trim()} /> : null}
          <SummaryRow
            label={p.format === 'avulso' ? 'Jogos' : 'Jogos gerados'}
            value={p.format === 'avulso' ? 'Registro manual' : String(comp.matches.length)}
            last
          />
        </View>

        {/* Grid de competidores */}
        <View style={styles.competitorGrid}>
          {competitors.map(c => {
            const mainPlayer = allPlayers.find(pl => pl.id === c.members[0]);
            return (
              <View key={c.id} style={styles.competitorChip}>
                {mainPlayer && <Avatar name={mainPlayer.name} color={mainPlayer.color} size={28} />}
                <Text style={styles.competitorName}>{c.name}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.btnSchedule, busy && styles.btnDisabled]} onPress={schedule} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color={Colors.gold} size="small" /> : <>
            <Text style={styles.btnScheduleIcon}>📅</Text>
            <Text style={styles.btnScheduleText}>Agendar (abrir confirmações)</Text>
          </>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnCreate, busy && styles.btnDisabled]} onPress={start} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color={Colors.bg} size="small" /> : <>
            <Text style={styles.btnCreateIcon}>⚡</Text>
            <Text style={styles.btnCreateText}>Criar e gerar jogos agora</Text>
          </>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[sr.row, !last && sr.border]}>
      <Text style={sr.label}>{label}</Text>
      <Text style={sr.value}>{value}</Text>
    </View>
  );
}
const sr = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  label: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  value: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, lineHeight: 24 },
  headerTitle: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.text },
  stepBar: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs, gap: Spacing.xs },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepLine: { height: 3, width: '100%', borderRadius: 2, backgroundColor: Colors.surf2 },
  stepLineActive: { backgroundColor: Colors.gold },
  stepLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  stepLabelActive: { color: Colors.gold, fontFamily: FontFamily.bodyMed },
  scroll: { padding: Spacing.md, gap: Spacing.md },

  fmtHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  fmtIcon: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  fmtIconText: { fontSize: 24, fontWeight: '700' },
  fmtName: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text },
  fmtSub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: 2 },

  summaryCard: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.md },

  competitorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  competitorChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.surf2, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.sm },
  competitorName: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, paddingBottom: Spacing.lg, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.line, gap: Spacing.sm },
  btnCreate: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 50 },
  btnDisabled: { opacity: 0.5 },
  btnCreateIcon: { fontSize: 18 },
  btnCreateText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
  btnSchedule: { borderWidth: 1.5, borderColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 46 },
  btnScheduleIcon: { fontSize: 16 },
  btnScheduleText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.gold },
});
