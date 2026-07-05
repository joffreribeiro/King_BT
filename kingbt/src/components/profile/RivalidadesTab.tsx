import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { goToPlayer } from '@/logic/nav';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Avatar } from '@/components';
import { makeTab } from './profileStyles';

// ─── Aba Rivalidades ──────────────────────────────────────────────────────────
export function RivalidadesTab({ rivalries, partnerships, findPlayer }: any) {
  const { colors: Colors } = useTheme();
  const tab = useMemo(() => makeTab(Colors), [Colors]);
  const rv = useMemo(() => makeRvStyles(Colors), [Colors]);

  const rivalItems = [
    rivalries.biggestRival  && { ...rivalries.biggestRival,  icon: '⚔️', label: 'Maior Rival',   sub: 'Quem você mais enfrentou' },
    rivalries.carrasco      && { ...rivalries.carrasco,      icon: '👹', label: 'Carrasco',        sub: 'Quem mais te venceu' },
    rivalries.fregues       && { ...rivalries.fregues,       icon: '😅', label: 'Freguês',         sub: 'Quem você mais venceu' },
  ].filter(Boolean) as any[];

  const partnerItems = [
    rivalries.biggestPartner && { ...rivalries.biggestPartner, icon: '🎾', label: 'Maior Parceiro',        sub: 'Com quem você mais jogou' },
    rivalries.bestPartner    && { ...rivalries.bestPartner,    icon: '🤝', label: 'Parceiro Mais Eficiente', sub: 'Com quem você mais venceu' },
    ...partnerships.map((p: any) => ({ ...p, id: p.partnerId, icon: '🎾', label: 'Parceria', sub: `${p.wins}V / ${p.losses}D` })),
  ].filter(Boolean).slice(0, 5) as any[];

  function H2HCard({ item, type }: { item: any; type: 'rival' | 'partner' }) {
    const pl = findPlayer(item.id);
    if (!pl) return null;

    const played  = item.played ?? 0;
    // wins = minhas vitórias contra esse rival
    // losses = minhas derrotas (played - wins)
    const myWins   = item.wins ?? 0;
    const myLosses = played - myWins;
    const wr = played > 0 ? Math.round((myWins / played) * 100) : 0;

    return (
      <TouchableOpacity
        style={rv.card}
        onPress={() => goToPlayer(item.id)}
        activeOpacity={0.8}
      >
        <View style={rv.cardTop}>
          <Text style={rv.icon}>{item.icon}</Text>
          <Avatar name={pl.name} color={pl.color} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={rv.name} numberOfLines={1}>{pl.name}</Text>
            <Text style={rv.sub}>{item.label} · {item.sub}</Text>
          </View>
          <Text style={rv.arrow}>›</Text>
        </View>
        <View style={rv.stats}>
          <View style={rv.statCell}>
            <Text style={[rv.statVal, { color: Colors.teal }]}>{myWins}</Text>
            <Text style={rv.statLbl}>Vitórias</Text>
          </View>
          <View style={[rv.statCell, rv.statBorder]}>
            <Text style={[rv.statVal, { color: Colors.coral }]}>{myLosses}</Text>
            <Text style={rv.statLbl}>Derrotas</Text>
          </View>
          <View style={[rv.statCell, rv.statBorder]}>
            <Text style={[rv.statVal, { color: Colors.gold }]}>{played}</Text>
            <Text style={rv.statLbl}>Jogos</Text>
          </View>
          <View style={[rv.statCell, rv.statBorder]}>
            <Text style={[rv.statVal, { color: wr >= 50 ? Colors.teal : Colors.coral }]}>{wr}%</Text>
            <Text style={rv.statLbl}>Taxa</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={tab.content}>
      {rivalItems.length > 0 && (
        <View style={{ gap: Spacing.sm }}>
          <Text style={tab.sectionTitle}>Seus Maiores Rivais</Text>
          {rivalItems.map((r: any, i: number) => <H2HCard key={i} item={r} type="rival" />)}
        </View>
      )}

      {partnerItems.length > 0 && (
        <View style={{ gap: Spacing.sm, marginTop: rivalItems.length > 0 ? Spacing.md : 0 }}>
          <Text style={tab.sectionTitle}>Melhores Parcerias</Text>
          {partnerItems.map((p: any, i: number) => <H2HCard key={i} item={p} type="partner" />)}
        </View>
      )}

      {rivalItems.length === 0 && partnerItems.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm }}>
          <Text style={{ fontSize: 36 }}>⚔️</Text>
          <Text style={{ fontFamily: FontFamily.title, fontSize: 16, color: Colors.text }}>Sem rivalidades ainda</Text>
          <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' }}>
            Dispute partidas para ver seus rivais e parceiros aqui.
          </Text>
        </View>
      )}
    </View>
  );
}

const makeRvStyles = (Colors: ThemeColors) => StyleSheet.create({
  card:      { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, overflow: 'hidden', marginBottom: 4 },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm },
  icon:      { fontSize: 20, width: 26 },
  name:      { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  sub:       { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  arrow:     { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.faint },
  stats:     { flexDirection: 'row', backgroundColor: Colors.surf2, borderTopWidth: 1, borderTopColor: Colors.line },
  statCell:  { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  statBorder:{ borderLeftWidth: 1, borderLeftColor: Colors.line },
  statVal:   { fontFamily: FontFamily.numberBold, fontSize: 14 },
  statLbl:   { fontFamily: FontFamily.number, fontSize: 9, color: Colors.faint },
});
