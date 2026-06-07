import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar } from '@/components';
import type { RankedPlayer } from '@/logic/scoring';
import type { MockPlayer } from '@/mocks/data';

type Props = {
  ranking: RankedPlayer[];
  players: MockPlayer[];
  groupName: string;
  season: string;
  roundsDone: number;
  location: string;
  date: string;
};

const MEDAL_COLOR: Record<number, string> = {
  1: '#F3C544',
  2: '#C7D4E0',
  3: '#D89A6A',
};

export default function RankingCard({ ranking, players, groupName, season, roundsDone, location, date }: Props) {
  const getPlayer = (id: string) => players.find(p => p.id === id);

  const top3 = ranking.slice(0, 3);
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  const totalPlayers = ranking.filter(r => r.played > 0).length;

  return (
    <View style={card.container}>
      {/* Header */}
      <View style={card.header}>
        <View style={card.headerLeft}>
          <Image
            source={require('../../assets/kingbt-logo.png')}
            style={card.logo}
            resizeMode="contain"
          />
          <View>
            <Text style={card.headerTitle}>RANKING GERAL</Text>
            <Text style={card.headerSub}>OFICIAL</Text>
            <Text style={card.headerAfter}>APÓS {roundsDone} RODADAS</Text>
          </View>
        </View>
        <View style={card.headerRight}>
          <View style={card.headerInfo}>
            <Text style={card.headerInfoLabel}>ATUALIZADO EM</Text>
            <Text style={card.headerInfoValue}>{date}</Text>
          </View>
          <View style={card.headerInfo}>
            <Text style={card.headerInfoLabel}>RODADAS HOMOLOGADAS</Text>
            <Text style={card.headerInfoValue}>{roundsDone}</Text>
          </View>
          <View style={card.headerInfo}>
            <Text style={card.headerInfoLabel}>ATLETAS RANQUEADOS</Text>
            <Text style={card.headerInfoValue}>{totalPlayers}</Text>
          </View>
          <View style={card.headerInfo}>
            <Text style={card.headerInfoLabel}>LOCAL</Text>
            <Text style={card.headerInfoValue}>{location}</Text>
          </View>
        </View>
      </View>

      {/* Pódio */}
      <View style={card.podiumWrap}>
        {/* 2° lugar */}
        <View style={[card.podCol, { paddingTop: 40 }]}>
          {second && (
            <>
              <Text style={card.podPos}>2°</Text>
              <Avatar name={getPlayer(second.id)?.name ?? ''} color={getPlayer(second.id)?.color ?? '#ccc'} size={52} />
              <Text style={[card.podName, { color: MEDAL_COLOR[2] }]}>{getPlayer(second.id)?.name?.split(' ')[0]}</Text>
              <Text style={[card.podPts, { color: MEDAL_COLOR[2] }]}>{second.points.toFixed(2)}</Text>
              <View style={[card.podBlock, { height: 80, backgroundColor: MEDAL_COLOR[2] + '22', borderTopColor: MEDAL_COLOR[2] }]}>
                <Text style={[card.podBlockNum, { color: MEDAL_COLOR[2] }]}>2</Text>
              </View>
            </>
          )}
        </View>

        {/* 1° lugar */}
        <View style={[card.podCol, { paddingTop: 0 }]}>
          {first && (
            <>
              <Text style={[card.podPos, { color: MEDAL_COLOR[1], fontSize: 16 }]}>1°</Text>
              <Avatar name={getPlayer(first.id)?.name ?? ''} color={getPlayer(first.id)?.color ?? '#ccc'} size={72} showCrown />
              <Text style={[card.podName, { color: MEDAL_COLOR[1], fontSize: 16 }]}>{getPlayer(first.id)?.name?.toUpperCase()}</Text>
              <Text style={[card.podPts, { color: MEDAL_COLOR[1], fontSize: 22 }]}>{first.points.toFixed(2)}</Text>
              <View style={[card.podBlock, { height: 120, backgroundColor: MEDAL_COLOR[1] + '22', borderTopColor: MEDAL_COLOR[1] }]}>
                <Text style={[card.podBlockNum, { color: MEDAL_COLOR[1], fontSize: 32 }]}>1</Text>
              </View>
            </>
          )}
        </View>

        {/* 3° lugar */}
        <View style={[card.podCol, { paddingTop: 60 }]}>
          {third && (
            <>
              <Text style={card.podPos}>3°</Text>
              <Avatar name={getPlayer(third.id)?.name ?? ''} color={getPlayer(third.id)?.color ?? '#ccc'} size={44} />
              <Text style={[card.podName, { color: MEDAL_COLOR[3] }]}>{getPlayer(third.id)?.name?.split(' ')[0]}</Text>
              <Text style={[card.podPts, { color: MEDAL_COLOR[3] }]}>{third.points.toFixed(2)}</Text>
              <View style={[card.podBlock, { height: 60, backgroundColor: MEDAL_COLOR[3] + '22', borderTopColor: MEDAL_COLOR[3] }]}>
                <Text style={[card.podBlockNum, { color: MEDAL_COLOR[3] }]}>3</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Tabela */}
      <View style={card.table}>
        {/* Header da tabela */}
        <View style={[card.tableRow, card.tableHeader]}>
          <Text style={[card.th, { width: 28 }]}>POS.</Text>
          <Text style={[card.th, { flex: 1 }]}>JOGADOR</Text>
          <Text style={[card.th, card.thNum]}>V</Text>
          <Text style={[card.th, card.thNum]}>D</Text>
          <Text style={[card.th, card.thNum]}>J</Text>
          <Text style={[card.th, card.thNum]}>GP</Text>
          <Text style={[card.th, card.thNum]}>GC</Text>
          <Text style={[card.th, card.thNum]}>SG</Text>
          <Text style={[card.th, card.thNum]}>GA</Text>
          <Text style={[card.th, { width: 52, textAlign: 'right' }]}>PTS KBT</Text>
        </View>

        {ranking.map((r, i) => {
          const pl = getPlayer(r.id);
          const sgColor = r.sg > 0 ? Colors.teal : r.sg < 0 ? Colors.coral : Colors.muted;
          const isTop = i < 3;
          return (
            <View key={r.id} style={[card.tableRow, i < ranking.length - 1 && card.rowBorder, isTop && card.rowTop]}>
              <Text style={[card.td, { width: 28, color: isTop ? MEDAL_COLOR[i + 1] : Colors.muted, fontFamily: FontFamily.numberBold }]}>{i + 1}°</Text>
              <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                {pl && <Avatar name={pl.name} color={pl.color} size={20} />}
                <Text style={[card.td, { flex: 1, fontFamily: FontFamily.bodyMed }]} numberOfLines={1}>{pl?.name}</Text>
              </View>
              <Text style={[card.td, card.tdNum]}>{r.wins}</Text>
              <Text style={[card.td, card.tdNum]}>{r.losses}</Text>
              <Text style={[card.td, card.tdNum]}>{r.played}</Text>
              <Text style={[card.td, card.tdNum]}>{r.gamesPro}</Text>
              <Text style={[card.td, card.tdNum]}>{r.gamesCon}</Text>
              <Text style={[card.td, card.tdNum, { color: sgColor }]}>{r.sg > 0 ? '+' : ''}{r.sg}</Text>
              <Text style={[card.td, card.tdNum]}>{r.ga.toFixed(2)}</Text>
              <Text style={[card.td, { width: 52, textAlign: 'right', fontFamily: FontFamily.numberBold, color: Colors.gold, fontSize: 13 }]}>{r.points.toFixed(2)}</Text>
            </View>
          );
        })}
      </View>

      {/* Rodapé */}
      <View style={card.footer}>
        <Text style={card.footerFormula}>
          {'PONTUAÇÃO: (V×3) + (J×0,5) + (GA×2)  ·  GA = GP÷GC'}
        </Text>
        <Text style={card.footerBrand}>KING BT · {groupName} · {season}</Text>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  container: {
    backgroundColor: '#0B0B0D',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.gold + '44',
    margin: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    backgroundColor: '#111114',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gold + '33',
    gap: Spacing.md,
  },
  headerLeft: { gap: 4 },
  logo: { width: 56, height: 56 },
  headerTitle: { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.gold, letterSpacing: 2 },
  headerSub: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold + 'aa', letterSpacing: 4 },
  headerAfter: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.muted, marginTop: 2 },
  headerRight: { flex: 1, gap: 4 },
  headerInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  headerInfoLabel: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.faint, letterSpacing: 0.5 },
  headerInfoValue: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.text },

  podiumWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 240,
    backgroundColor: '#0e0e12',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gold + '22',
  },
  podCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  podPos: { fontFamily: FontFamily.numberBold, fontSize: 12, color: Colors.muted, marginBottom: 4 },
  podName: { fontFamily: FontFamily.title, fontSize: 12, color: Colors.text, textAlign: 'center', marginTop: 4 },
  podPts: { fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.gold, marginBottom: 4 },
  podBlock: { width: '100%', borderTopWidth: 2, alignItems: 'center', justifyContent: 'center' },
  podBlockNum: { fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.gold },

  table: { padding: Spacing.sm },
  tableHeader: { backgroundColor: Colors.surf2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xs, paddingVertical: 7 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  rowTop: { backgroundColor: Colors.gold + '08' },
  th: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.faint, letterSpacing: 0.5 },
  thNum: { width: 28, textAlign: 'center' },
  td: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.text },
  tdNum: { width: 28, textAlign: 'center', fontFamily: FontFamily.number, fontSize: 12, color: Colors.text },

  footer: {
    backgroundColor: '#111114',
    padding: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gold + '22',
    alignItems: 'center',
    gap: 3,
  },
  footerFormula: { fontFamily: FontFamily.number, fontSize: 9, color: Colors.muted, textAlign: 'center' },
  footerBrand: { fontFamily: FontFamily.titleBold, fontSize: 10, color: Colors.gold + 'aa', letterSpacing: 2 },
});
