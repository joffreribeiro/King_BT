import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, FontFamily } from '@/theme';

export interface ShareStatsData {
  name: string;
  color: string;
  position: number;
  points: number;
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  sg: number;
  ga: number;
  groupName: string;
}

export function ShareStatsCard({ data }: { data: ShareStatsData }) {
  const medal = data.position === 1 ? '🥇' : data.position === 2 ? '🥈' : data.position === 3 ? '🥉' : `${data.position}°`;

  return (
    <View style={s.card}>
      {/* Fundo degradê */}
      <View style={[s.topBand, { backgroundColor: data.color + '33' }]} />

      {/* Header */}
      <View style={s.header}>
        <View style={[s.avatar, { backgroundColor: data.color }]}>
          <Text style={s.avatarText}>{data.name.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.name} numberOfLines={1}>{data.name}</Text>
          <Text style={s.group} numberOfLines={1}>King BT · {data.groupName}</Text>
        </View>
        <Text style={s.medal}>{medal}</Text>
      </View>

      {/* Pontuação destaque */}
      <View style={s.ptsRow}>
        <Text style={s.ptsLabel}>PONTUAÇÃO</Text>
        <Text style={[s.ptsVal, { color: data.color === '#FFD166' ? Colors.gold : data.color }]}>
          {data.points.toFixed(2)}
        </Text>
      </View>

      {/* Stats grid */}
      <View style={s.grid}>
        {[
          { l: 'Jogos',    v: data.played,               c: Colors.text },
          { l: 'Vitórias', v: data.wins,                 c: Colors.teal },
          { l: 'Derrotas', v: data.losses,               c: Colors.coral },
          { l: 'Win %',    v: `${data.winRate}%`,        c: Colors.gold },
          { l: 'SG',       v: (data.sg >= 0 ? '+' : '') + data.sg, c: data.sg >= 0 ? Colors.teal : Colors.coral },
          { l: 'GA',       v: data.ga.toFixed(2),        c: Colors.gold },
        ].map(item => (
          <View key={item.l} style={s.cell}>
            <Text style={[s.cellVal, { color: item.c }]}>{item.v}</Text>
            <Text style={s.cellLbl}>{item.l}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>👑 King BT</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: '#0B0B0D',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topBand: {
    height: 6,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.titleBold,
    fontSize: 18,
    color: '#0B0B0D',
  },
  name: {
    fontFamily: FontFamily.titleBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  group: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  medal: {
    fontSize: 28,
  },
  ptsRow: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 2,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 16,
  },
  ptsLabel: {
    fontFamily: FontFamily.number,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
  },
  ptsVal: {
    fontFamily: FontFamily.titleBold,
    fontSize: 48,
    lineHeight: 56,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 0,
  },
  cell: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 3,
  },
  cellVal: {
    fontFamily: FontFamily.numberBold,
    fontSize: 20,
  },
  cellLbl: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },
  footer: {
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 10,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: FontFamily.bodyMed,
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1,
  },
});
