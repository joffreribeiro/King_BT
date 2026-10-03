import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import Avatar from '@/components/Avatar';
import { Icon } from '@/components/icons';
import { Card } from '@/components';
import {
  battleHighlights, computeBattles, computePartnerships, filterByPeriod, partnerHighlights,
  type Battle, type BattlePeriod, type Partnership,
} from '@/logic/battles';
import type { Competition } from '@/logic/types';
import { makeTab } from './profileStyles';

interface PlayerLite { id: string; name: string; color: string }

interface Props {
  /** Dono do perfil (contra quem os confrontos são contados). */
  playerId: string;
  competitions: Competition[];
  findPlayer: (id: string) => PlayerLite | undefined;
}

const PERIODS: { key: BattlePeriod; label: string }[] = [
  { key: 'mes', label: 'Este mês' },
  { key: 'ano', label: 'Este ano' },
  { key: 'geral', label: 'Geral' },
];

/** "2026-09-12" → "12/09". */
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Aba "Rivalidade": os confrontos diretos. Em cima, o filtro de período e os
 * destaques (carrasco, freguês, rival, melhor e pior dupla); embaixo, o placar
 * contra cada adversário. Tocar abre a comparação lado a lado (H2H).
 */
export function BatalhasTab({ playerId, competitions, findPlayer }: Props) {
  const { colors: Colors } = useTheme();
  const tab = useMemo(() => makeTab(Colors), [Colors]);
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const [period, setPeriod] = useState<BattlePeriod>('geral');
  const comps = useMemo(() => filterByPeriod(competitions, period), [competitions, period]);
  const battles = useMemo(() => computeBattles(playerId, comps), [playerId, comps]);
  const allPartners = useMemo(() => computePartnerships(playerId, comps), [playerId, comps]);
  const partnerships = useMemo(() => allPartners.filter(p => p.played >= 2).slice(0, 5), [allPartners]);
  const { carrasco, fregues, rival } = useMemo(() => battleHighlights(battles), [battles]);
  const { best, worst } = useMemo(() => partnerHighlights(allPartners), [allPartners]);

  const openH2H = (oppId: string) =>
    router.push({ pathname: '/(app)/h2h', params: { playerId1: playerId, playerId2: oppId } });
  const openPlayer = (id: string) => router.push({ pathname: '/player/[id]', params: { id } });

  const periodChips = (
    <View style={s.periodRow}>
      {PERIODS.map(p => (
        <TouchableOpacity
          key={p.key}
          style={[s.periodChip, period === p.key && s.periodChipOn]}
          onPress={() => setPeriod(p.key)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ selected: period === p.key }}
        >
          <Text style={[s.periodText, period === p.key && s.periodTextOn]}>{p.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (battles.length === 0) {
    return (
      <View style={tab.content}>
        {periodChips}
        <Card style={{ alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg }}>
          <Icon name="compare" size={32} color={Colors.faint} />
          <Text style={s.emptyTitle}>Nenhuma rivalidade {period === 'geral' ? 'ainda' : 'neste período'}</Text>
          <Text style={s.emptySub}>Quando houver partidas com placar, seus confrontos contra cada adversário aparecem aqui.</Text>
        </Card>
      </View>
    );
  }

  /** Card de destaque: adversário (Battle) ou parceiro (Partnership). */
  const card = (label: string, who: { id: string; wins: number; losses: number } | null, color: string, sub: string, onPress: (id: string) => void) => {
    const p = who ? findPlayer(who.id) : undefined;
    return (
      <TouchableOpacity
        key={label}
        style={[s.hl, { borderColor: color + '55' }, !who && { opacity: 0.5 }]}
        onPress={who ? () => onPress(who.id) : undefined}
        disabled={!who}
        activeOpacity={0.8}
      >
        <Text style={[s.hlLabel, { color }]}>{label}</Text>
        {p && who ? (
          <>
            <Avatar name={p.name} color={p.color} size={52} />
            <Text style={s.hlName} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
            <Text style={[s.hlRecord, { color }]}>{who.wins}V · {who.losses}D</Text>
            <Text style={s.hlSub}>{sub}</Text>
          </>
        ) : (
          <Text style={s.hlSub}>—</Text>
        )}
      </TouchableOpacity>
    );
  };
  const opp = (b: Battle | null) => (b ? { id: b.id, wins: b.wins, losses: b.losses } : null);
  const partner = (p: Partnership | null) => (p ? { id: p.partnerId, wins: p.wins, losses: p.losses } : null);

  const rivalPlayer = rival ? findPlayer(rival.id) : undefined;
  const streakText = rival && rivalPlayer && rival.streak.count >= 2
    ? `${rival.streak.won ? 'Você ganhou' : 'Você perdeu'} os últimos ${rival.streak.count} contra ${rivalPlayer.name.split(' ')[0]}`
    : null;

  return (
    <View style={tab.content}>
      {periodChips}

      <View style={s.hlRow}>
        {card('CARRASCO', opp(carrasco), Colors.coral, 'te vence mais', openH2H)}
        {card('FREGUÊS', opp(fregues), Colors.teal, 'você vence mais', openH2H)}
        {card('RIVAL', opp(rival), Colors.gold, 'mais enfrentado', openH2H)}
      </View>
      {streakText && rival && (
        <Text style={[s.streak, { color: rival.streak.won ? Colors.teal : Colors.coral }]}>{streakText}</Text>
      )}

      {(best || worst) && (
        <View style={s.hlRow}>
          {card('MELHOR DUPLA', partner(best), Colors.teal, 'você mais ganha', openPlayer)}
          {card('PIOR DUPLA', partner(worst), Colors.coral, 'você mais perde', openPlayer)}
        </View>
      )}

      <Card>
        <Text style={tab.sectionTitle}>Todos os confrontos</Text>
        {battles.map((b, i) => {
          const p = findPlayer(b.id);
          if (!p) return null;
          return (
            <TouchableOpacity key={b.id} style={[s.row, i > 0 && s.rowBorder]} onPress={() => openH2H(b.id)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`Comparar com ${p.name}`}>
              <Avatar name={p.name} color={p.color} size={40} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={s.rowTop}>
                  <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                  <Text style={s.rowRecord}>
                    <Text style={{ color: Colors.teal }}>{b.wins}V</Text>
                    <Text style={{ color: Colors.muted }}> · </Text>
                    <Text style={{ color: Colors.coral }}>{b.losses}D</Text>
                  </Text>
                </View>
                <View style={s.bar}>
                  <View style={[s.barWin, { flex: b.wins || 0.001 }]} />
                  <View style={[s.barLoss, { flex: b.losses || 0.001 }]} />
                </View>
                <Text style={s.rowMeta}>
                  Games {b.gamesPro}×{b.gamesCon}
                  {b.last ? ` · Último ${shortDate(b.last.date)}: ${b.last.won ? 'V' : 'D'} ${b.last.gf}×${b.last.gc}` : ''}
                </Text>
              </View>
              <Icon name="chevronRight" size={16} color={Colors.faint} />
            </TouchableOpacity>
          );
        })}
      </Card>

      {partnerships.length > 0 && (
        <Card>
          <Text style={tab.sectionTitle}>Parcerias</Text>
          {partnerships.map((p, i) => {
            const pl = findPlayer(p.partnerId);
            if (!pl) return null;
            return (
              <TouchableOpacity key={p.partnerId} style={[s.row, i > 0 && s.rowBorder]} onPress={() => openPlayer(p.partnerId)} activeOpacity={0.75}>
                <Avatar name={pl.name} color={pl.color} size={40} />
                <Text style={[s.rowName, { flex: 1 }]} numberOfLines={1}>{pl.name}</Text>
                <Text style={s.rowRecord}>
                  <Text style={{ color: Colors.teal }}>{p.wins}V</Text>
                  <Text style={{ color: Colors.muted }}> · </Text>
                  <Text style={{ color: Colors.coral }}>{p.losses}D</Text>
                </Text>
              </TouchableOpacity>
            );
          })}
        </Card>
      )}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  periodRow: { flexDirection: 'row', gap: Spacing.sm },
  periodChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.surf },
  periodChipOn: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  periodText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  periodTextOn: { color: Colors.gold, fontFamily: FontFamily.title },
  streak: { fontFamily: FontFamily.bodyMed, fontSize: 14, textAlign: 'center' },

  hlRow: { flexDirection: 'row', gap: Spacing.sm },
  hl: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.md, paddingHorizontal: 6, borderRadius: Radius.md, backgroundColor: Colors.surf, borderWidth: 1 },
  hlLabel: { fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.2 },
  hlName: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  hlRecord: { fontFamily: FontFamily.numberBold, fontSize: 18 },
  hlSub: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.line },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  rowName: { flexShrink: 1, fontFamily: FontFamily.bodyMed, fontSize: 16, color: Colors.text },
  rowRecord: { fontFamily: FontFamily.numberBold, fontSize: 15 },
  rowMeta: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: Colors.surf2 },
  barWin: { backgroundColor: Colors.teal + 'CC' },
  barLoss: { backgroundColor: Colors.coral + 'CC' },

  emptyTitle: { fontFamily: FontFamily.title, fontSize: 18, color: Colors.text },
  emptySub: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: Colors.muted, textAlign: 'center' },
});
