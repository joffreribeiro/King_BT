import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, TextInput, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { addGuestPlayer, removeGuestPlayer, updatePlayerHandicap } from '@/firebase/groupPlayers';
import QRCode from 'react-native-qrcode-svg';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames, competitionChampion } from '@/logic/formats';
import { computeBadges } from '@/logic/badges';
import { computeFormatStats } from '@/logic/formatStats';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';

const GUEST_COLORS = ['#FFD166', '#2DD4BF', '#A78BFA', '#34D399', '#F472B6', '#94A3B8', '#FB923C', '#60A5FA'];

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <View style={bar.row}>
      <Text style={bar.label}>{label}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { width: `${Math.min(value / Math.max(max, 1), 1) * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={bar.val}>{typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}</Text>
    </View>
  );
}
const bar = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, width: 80 },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: Colors.line },
  fill: { height: 5, borderRadius: 3 },
  val: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.text, width: 40, textAlign: 'right' },
});

export default function ProfileScreen() {
  const { state } = useCompetitions();
  const { logout, leaveGroup, group, user, isAdmin, myPlayerId } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const MY_ID = myPlayerId ?? groupPlayers[0]?.id ?? '';
  const player = groupPlayers.find(p => p.id === MY_ID) ?? groupPlayers[0];
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestColor, setGuestColor] = useState(GUEST_COLORS[0]);
  async function handleLeaveGroup() {
    const doLeave = async () => {
      await leaveGroup();
      router.replace('/(auth)/join');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Sair do grupo atual? Você poderá entrar em outro grupo.')) await doLeave();
    } else {
      Alert.alert('Trocar de grupo', 'Sair do grupo atual?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair do grupo', style: 'destructive', onPress: doLeave },
      ]);
    }
  }

  async function handleLogout() {
    const doLogout = async () => {
      await logout();
      router.replace('/(auth)/login');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja sair da sua conta?')) await doLogout();
    } else {
      Alert.alert('Sair', 'Deseja sair da sua conta?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: doLogout },
      ]);
    }
  }

  async function handleAddGuest() {
    if (!guestName.trim() || !group) return;
    await addGuestPlayer(group.id, guestName.trim(), guestColor);
    setGuestName('');
    setGuestColor(GUEST_COLORS[0]);
    setShowAddGuest(false);
  }

  function handleRemoveGuest(playerId: string, name: string) {
    if (!group) return;
    const doRemove = () => removeGuestPlayer(group.id, playerId);
    if (Platform.OS === 'web') {
      if (window.confirm(`Remover ${name} do grupo?`)) doRemove();
    } else {
      Alert.alert('Remover convidado', `Remover ${name} do grupo?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: doRemove },
      ]);
    }
  }

  const allGames = state.competitions.flatMap(extractPlayerGames);
  const ranking = buildRanking(
    groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0,3).toUpperCase(), color: p.color, handicap: p.handicap })),
    allGames
  );
  const me = ranking.find(r => r.id === MY_ID) ?? ranking[0];
  const myPos = ranking.findIndex(r => r.id === MY_ID) + 1;
  const winRate = me.played > 0 ? Math.round((me.wins / me.played) * 100) : 0;
  const wPts = me.wins * 3;
  const jPts = Math.round(me.played * 0.5 * 10) / 10;
  const gaPts = Math.round(me.ga * 2 * 100) / 100;

  // Full match history for MY_ID
  const matchHistory: Array<{
    compName: string;
    opponents: string;
    myScore: number;
    oppScore: number;
    won: boolean;
  }> = [];

  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreB == null) return;
      const inA = m.teamA ? m.teamA.includes(MY_ID) : m.aId === MY_ID;
      const inB = m.teamB ? m.teamB.includes(MY_ID) : m.bId === MY_ID;
      if (!inA && !inB) return;

      const myScore  = inA ? m.scoreA : m.scoreB;
      const oppScore = inA ? m.scoreB : m.scoreA;
      const won = myScore > oppScore;

      let opponents = '?';
      if (m.teamA && m.teamB) {
        const oppTeam = inA ? m.teamB : m.teamA;
        opponents = oppTeam.map(pid => findPlayer(pid)?.name.split(' ')[0] ?? pid).join(' / ');
      } else {
        const oppId = inA ? m.bId : m.aId;
        if (oppId) {
          const oppComp = comp.competitors.find(c => c.id === oppId);
          opponents = oppComp?.name ?? findPlayer(oppId)?.name ?? oppId;
        }
      }

      matchHistory.push({ compName: comp.name, opponents, myScore, oppScore, won });
    });
  });
  matchHistory.reverse();

  // Evolution chart: pontos do jogador por competição
  const screenW = Dimensions.get('window').width - Spacing.md * 2 - Spacing.md * 2 - 32;
  const evoPoints: { label: string; pts: number }[] = state.competitions
    .filter(c => c.status === 'done' || c.matches.some(m => m.scoreA != null))
    .map(comp => {
      const games = extractPlayerGames(comp);
      const myGames = games.filter(g => g.teamA.includes(MY_ID) || g.teamB.includes(MY_ID));
      if (myGames.length === 0) return null;
      let wins = 0, played = 0, gp = 0, gc = 0;
      myGames.forEach(g => {
        const inA = g.teamA.includes(MY_ID);
        played++;
        if (inA) { gp += g.scoreA; gc += g.scoreB; if (g.scoreA > g.scoreB) wins++; }
        else { gp += g.scoreB; gc += g.scoreA; if (g.scoreB > g.scoreA) wins++; }
      });
      const ga = gc > 0 ? gp / gc : gp > 0 ? 999 : 0;
      const pts = Math.round((wins * 3 + played * 0.5 + ga * 2) * 100) / 100;
      const label = comp.name.slice(0, 8);
      return { label, pts };
    })
    .filter(Boolean) as { label: string; pts: number }[];

  // Best partnerships
  type PairInfo = { partnerId: string; wins: number; losses: number; played: number };
  const partnerMap = new Map<string, PairInfo>();
  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || !m.teamA || !m.teamB) return;
      const inA = m.teamA.includes(MY_ID);
      const inB = m.teamB.includes(MY_ID);
      if (!inA && !inB) return;
      const myTeam = inA ? m.teamA : m.teamB;
      const partner = myTeam.find(id => id !== MY_ID);
      if (!partner) return;
      const myScore = inA ? m.scoreA! : m.scoreB!;
      const oppScore = inA ? m.scoreB! : m.scoreA!;
      const won = myScore > oppScore;
      if (!partnerMap.has(partner)) partnerMap.set(partner, { partnerId: partner, wins: 0, losses: 0, played: 0 });
      const ps = partnerMap.get(partner)!;
      ps.played++;
      if (won) ps.wins++; else ps.losses++;
    });
  });
  const partnerships = [...partnerMap.values()]
    .filter(p => p.played >= 2)
    .sort((a, b) => b.wins - a.wins || (b.wins / b.played) - (a.wins / a.played))
    .slice(0, 5);

  const badges = computeBadges(MY_ID, state.competitions, id => findPlayer(id)?.name ?? id);
  const unlockedBadges = badges.filter(b => b.unlocked);
  const formatStats = computeFormatStats(state.competitions, MY_ID);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.heroBanner}>
          <View style={[styles.heroBg, { backgroundColor: (player?.color ?? '#FFD166') + '22' }]} />
          <View style={styles.heroInner}>
            <Avatar
              name={player?.name ?? '?'}
              color={player?.color ?? '#FFD166'}
              size={88}
              showCrown={myPos === 1}
            />
            <Text style={styles.name}>{player?.name ?? user?.displayName ?? 'Jogador'}</Text>
            <Text style={styles.titleText}>{user?.email ?? ''}</Text>
            <View style={styles.badges}>
              <Badge label={`${myPos}° lugar`} variant="gold" />
              <Badge label={`${winRate}% aproveit.`} variant="teal" />
            </View>
          </View>
        </View>

        {/* Pontuação */}
        <Card elevated style={styles.ptsCard}>
          <Text style={styles.ptsLabel}>PONTUAÇÃO KING BT</Text>
          <Text style={styles.ptsVal}>{me.points.toFixed(2)}</Text>
          <Text style={styles.ptsEq}>
            ({me.wins}×3) + ({me.played}×0,5) + ({me.ga.toFixed(2)}×2)
          </Text>
        </Card>

        {/* Grid de stats */}
        <View style={styles.grid}>
          {[
            { l: 'Vitórias',      v: me.wins,                         c: Colors.teal },
            { l: 'Derrotas',      v: me.losses,                       c: Colors.coral },
            { l: 'Partidas',      v: me.played,                       c: Colors.text },
            { l: 'Game Avg',      v: me.ga.toFixed(2),                c: Colors.gold },
            { l: 'Games Pró',    v: me.gamesPro,                      c: Colors.teal },
            { l: 'Games Contra', v: me.gamesCon,                      c: Colors.coral },
            { l: 'Saldo',         v: (me.sg >= 0 ? '+' : '') + me.sg, c: me.sg >= 0 ? Colors.teal : Colors.coral },
            { l: 'Win Rate',      v: `${winRate}%`,                    c: Colors.goldBright },
          ].map(item => (
            <View key={item.l} style={[styles.cell, { borderLeftWidth: 3, borderLeftColor: item.c + '88' }]}>
              <Text style={[styles.cellVal, { color: item.c }]}>{item.v}</Text>
              <Text style={styles.cellLabel}>{item.l}</Text>
            </View>
          ))}
        </View>

        {/* Forma recente */}
        {(() => {
          const recentGames = state.competitions
            .flatMap(c => c.matches)
            .filter(m => m.scoreA != null && m.scoreB != null)
            .filter(m => (m.teamA ?? [m.aId]).includes(MY_ID) || (m.teamB ?? [m.bId]).includes(MY_ID))
            .slice(-6);
          if (recentGames.length === 0) return null;
          const results = recentGames.map(m => {
            const inA = (m.teamA ?? [m.aId]).includes(MY_ID);
            return inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
          });
          return (
            <Card>
              <Text style={styles.sectionTitle}>Forma recente</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {results.map((w, i) => (
                  <View key={i} style={{
                    width: 32, height: 32, borderRadius: 8,
                    backgroundColor: w ? Colors.teal + '33' : Colors.coral + '33',
                    borderWidth: 1, borderColor: w ? Colors.teal + '66' : Colors.coral + '66',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 12, color: w ? Colors.teal : Colors.coral }}>
                      {w ? 'V' : 'D'}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          );
        })()}

        {/* Conquistas */}
        <Card>
          <Text style={styles.sectionTitle}>Conquistas</Text>
          <View style={bdg.grid}>
            {badges.map(b => (
              <View key={b.id} style={[bdg.item, !b.unlocked && bdg.locked]}>
                <Text style={[bdg.emoji, !b.unlocked && bdg.emojiLocked]}>{b.emoji}</Text>
                <Text style={[bdg.name, !b.unlocked && bdg.nameLocked]} numberOfLines={2}>{b.name}</Text>
              </View>
            ))}
          </View>
          {unlockedBadges.length === 0 && (
            <Text style={bdg.empty}>Dispute partidas para desbloquear conquistas.</Text>
          )}
        </Card>

        {/* Aproveitamento por formato */}
        {formatStats.length > 0 && (
          <Card style={{ gap: Spacing.sm }}>
            <Text style={styles.sectionTitle}>Aproveitamento por Formato</Text>
            {formatStats.map(fs => (
              <View key={fs.format} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text }}>
                    {fs.label}
                  </Text>
                  <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 13, color: fs.color }}>
                    {fs.pct}%
                  </Text>
                </View>
                <View style={{ height: 5, backgroundColor: Colors.line, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 5, width: `${fs.pct}%`, backgroundColor: fs.color, borderRadius: 3 }} />
                </View>
                <Text style={{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint }}>
                  {fs.wins}V · {fs.played - fs.wins}D · {fs.played} jogos
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Quebra de pontos */}
        <Card>
          <Text style={styles.sectionTitle}>Quebra dos Pontos</Text>
          <Bar label="Vitórias ×3"   value={wPts}  max={me.points} color={Colors.teal} />
          <Bar label="Partidas ×0,5" value={jPts}  max={me.points} color={Colors.text} />
          <Bar label="GA ×2"         value={gaPts} max={me.points} color={Colors.gold} />
        </Card>

        {/* Histórico de partidas */}
        {matchHistory.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Histórico de partidas</Text>
            {matchHistory.map((h, i) => (
              <View key={i} style={[hist.row, i < matchHistory.length - 1 && hist.border]}>
                <View style={[hist.badge, { backgroundColor: h.won ? Colors.teal + '33' : Colors.coral + '33' }]}>
                  <Text style={[hist.badgeText, { color: h.won ? Colors.teal : Colors.coral }]}>
                    {h.won ? 'V' : 'D'}
                  </Text>
                </View>
                <View style={hist.info}>
                  <Text style={hist.opp} numberOfLines={1}>vs {h.opponents}</Text>
                  <Text style={hist.compName} numberOfLines={1}>{h.compName}</Text>
                </View>
                <Text style={[hist.score, { color: h.won ? Colors.teal : Colors.coral }]}>
                  {h.myScore}–{h.oppScore}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Gráfico de evolução */}
        {evoPoints.length >= 2 && (() => {
          const chartH = 100;
          const chartW = screenW;
          const maxPts = Math.max(...evoPoints.map(p => p.pts));
          const minPts = Math.min(...evoPoints.map(p => p.pts));
          const range = Math.max(maxPts - minPts, 1);
          const pad = 12;
          const xStep = evoPoints.length > 1 ? (chartW - pad * 2) / (evoPoints.length - 1) : chartW - pad * 2;
          const toY = (pts: number) => pad + ((maxPts - pts) / range) * (chartH - pad * 2);
          const pts = evoPoints.map((p, i) => `${pad + i * xStep},${toY(p.pts)}`).join(' ');
          return (
            <Card>
              <Text style={styles.sectionTitle}>Evolução de pontos</Text>
              <Svg width={chartW} height={chartH}>
                <Line x1={pad} y1={chartH - pad} x2={chartW - pad} y2={chartH - pad} stroke={Colors.line} strokeWidth={1} />
                <Polyline points={pts} fill="none" stroke={Colors.gold} strokeWidth={2} />
                {evoPoints.map((p, i) => (
                  <Circle key={i} cx={pad + i * xStep} cy={toY(p.pts)} r={4} fill={Colors.gold} />
                ))}
                {evoPoints.map((p, i) => (
                  <SvgText key={i} x={pad + i * xStep} y={chartH - 2} fontSize={9} fill={Colors.faint} textAnchor="middle">
                    {p.label}
                  </SvgText>
                ))}
              </Svg>
            </Card>
          );
        })()}

        {/* Melhores parcerias */}
        {partnerships.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Melhores parcerias</Text>
            {partnerships.map((ps, i) => {
              const p = findPlayer(ps.partnerId);
              const wr = Math.round((ps.wins / ps.played) * 100);
              return (
                <View key={ps.partnerId} style={[pship.row, i < partnerships.length - 1 && pship.border]}>
                  <Avatar name={p?.name ?? '?'} color={p?.color ?? Colors.gold} size={30} />
                  <Text style={pship.name} numberOfLines={1}>{p?.name ?? ps.partnerId}</Text>
                  <Text style={pship.rec}>{ps.wins}V / {ps.losses}D</Text>
                  <Text style={[pship.wr, { color: wr >= 60 ? Colors.teal : wr >= 40 ? Colors.text : Colors.coral }]}>
                    {wr}%
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Jogadores do grupo (admin) */}
        {isAdmin && group && (
          <Card>
            <View style={guest.header}>
              <Text style={styles.sectionTitle}>Jogadores do grupo</Text>
              <TouchableOpacity onPress={() => setShowAddGuest(v => !v)} style={guest.addBtn}>
                <Text style={guest.addBtnText}>{showAddGuest ? '− Cancelar' : '+ Convidado'}</Text>
              </TouchableOpacity>
            </View>

            {groupPlayers.length === 0 && (
              <Text style={guest.empty}>Nenhum jogador cadastrado ainda.</Text>
            )}

            {groupPlayers.map((p, i) => {
              const h = p.handicap ?? 0;
              return (
                <View key={p.id} style={[guest.playerRow, i < groupPlayers.length - 1 && guest.border]}>
                  <Avatar name={p.name} color={p.color} size={30} />
                  <Text style={guest.playerName} numberOfLines={1}>{p.name}</Text>
                  {/* Handicap controls */}
                  <View style={guest.hcRow}>
                    <TouchableOpacity
                      onPress={() => group && updatePlayerHandicap(group.id, p.id, Math.max(-3, h - 1))}
                      hitSlop={6}
                      style={guest.hcBtn}
                    >
                      <Text style={guest.hcBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={[guest.hcVal, { color: h > 0 ? Colors.teal : h < 0 ? Colors.coral : Colors.faint }]}>
                      {h > 0 ? `+${h}` : h === 0 ? '0' : h}
                    </Text>
                    <TouchableOpacity
                      onPress={() => group && updatePlayerHandicap(group.id, p.id, Math.min(3, h + 1))}
                      hitSlop={6}
                      style={guest.hcBtn}
                    >
                      <Text style={guest.hcBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  {p.guest
                    ? <View style={guest.guestBadge}><Text style={guest.guestText}>conv.</Text></View>
                    : null
                  }
                  {p.guest && (
                    <TouchableOpacity onPress={() => handleRemoveGuest(p.id, p.name)} hitSlop={8}>
                      <Text style={guest.removeBtn}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {showAddGuest && (
              <View style={guest.form}>
                <TextInput
                  style={guest.input}
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="Nome do convidado"
                  placeholderTextColor={Colors.faint}
                  autoFocus
                />
                <View style={guest.colorRow}>
                  {GUEST_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setGuestColor(c)}
                      style={[guest.colorDot, { backgroundColor: c }, guestColor === c && guest.colorDotSel]}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  style={[guest.confirmBtn, !guestName.trim() && { opacity: 0.4 }]}
                  onPress={handleAddGuest}
                  disabled={!guestName.trim()}
                >
                  <Text style={guest.confirmText}>Adicionar convidado</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}

        {/* Conta */}
        <Card style={styles.accountCard}>
          <Text style={styles.accountEmail}>{user?.email ?? user?.displayName}</Text>
          {group && (
            <TouchableOpacity onPress={() => setShowQR(true)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.groupInfo}>Grupo: {group.name} · {group.code}</Text>
              <Text style={{ fontSize: 14 }}>⊞</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/hall')} activeOpacity={0.8}>
            <Text style={styles.settingsBtnText}>👑  Hall dos Campeões</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/court')} activeOpacity={0.8}>
            <Text style={styles.settingsBtnText}>🏓  Modo Quadra ao Vivo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')} activeOpacity={0.8}>
            <Text style={styles.settingsBtnText}>⚙️  Configurações</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.leaveGroupBtn} onPress={() => router.push('/(auth)/groups')} activeOpacity={0.8}>
            <Text style={styles.leaveGroupText}>Trocar de grupo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>
        </Card>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Modal QR Code de convite */}
      <Modal visible={showQR} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setShowQR(false)}
          activeOpacity={1}
        >
          <View style={{ backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, margin: Spacing.xl }}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text }}>
              Convidar para o grupo
            </Text>
            <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' }}>
              {group?.name}
            </Text>
            <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12 }}>
              <QRCode
                value={group?.code ?? ''}
                size={200}
                color="#0B0B0D"
                backgroundColor="#ffffff"
              />
            </View>
            <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 26, color: Colors.gold, letterSpacing: 6 }}>
              {group?.code}
            </Text>
            <Text style={{ fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, textAlign: 'center' }}>
              Mostre este código ou peça para digitar em{'\n'}"Entrar com código"
            </Text>
            <TouchableOpacity
              style={{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl }}
              onPress={() => setShowQR(false)}
            >
              <Text style={{ fontFamily: FontFamily.bodyMed, color: Colors.coral }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const hist = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  badge: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FontFamily.numberBold, fontSize: 12 },
  info: { flex: 1, gap: 2 },
  opp: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  compName: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  score: { fontFamily: FontFamily.numberBold, fontSize: 15 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  heroBanner: { position: 'relative', overflow: 'hidden', borderRadius: Radius.lg, marginBottom: Spacing.sm },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  heroInner: { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.sm },
  name: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text },
  titleText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  badges: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  ptsCard: { alignItems: 'center', gap: 4 },
  ptsLabel: { fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted, letterSpacing: 2 },
  ptsVal: { fontFamily: FontFamily.titleBold, fontSize: 52, color: Colors.gold, lineHeight: 60 },
  ptsEq: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cell: { width: '47%', alignItems: 'center', gap: 2, padding: Spacing.md, backgroundColor: Colors.surf, borderRadius: Radius.md },
  cellVal: { fontFamily: FontFamily.titleBold, fontSize: 26 },
  cellLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text, marginBottom: Spacing.sm },
  accountCard: { gap: Spacing.sm, alignItems: 'center' },
  accountEmail: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  groupInfo: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.gold },
  settingsBtn: {
    borderWidth: 1, borderColor: Colors.line,
    borderRadius: Radius.md, paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl, alignItems: 'center',
  },
  settingsBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  leaveGroupBtn: {
    borderWidth: 1, borderColor: Colors.line,
    borderRadius: Radius.md, paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl, alignItems: 'center',
  },
  leaveGroupText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  logoutBtn: {
    borderWidth: 1, borderColor: Colors.coral + '66',
    borderRadius: Radius.md, paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl, alignItems: 'center',
  },
  logoutText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.coral },
});

const bdg = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 4 },
  item: {
    width: '22%', alignItems: 'center', gap: 4, padding: Spacing.sm,
    backgroundColor: Colors.gold + '18', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '44',
  },
  locked: { backgroundColor: Colors.surf2, borderColor: Colors.line, opacity: 0.5 },
  emoji: { fontSize: 24 },
  emojiLocked: { opacity: 0.4 },
  name: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.gold, textAlign: 'center' },
  nameLocked: { color: Colors.faint },
  empty: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.faint, textAlign: 'center', paddingVertical: Spacing.sm },
});

const pship = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  name: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  rec: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted },
  wr: { fontFamily: FontFamily.numberBold, fontSize: 13, width: 38, textAlign: 'right' },
});

const guest = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  addBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: Colors.surf2, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line },
  addBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.teal },
  empty: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center', paddingVertical: Spacing.sm },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  playerName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  guestBadge: { backgroundColor: Colors.gold + '22', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  guestText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold },
  memberBadge: { backgroundColor: Colors.teal + '22', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  memberText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.teal },
  removeBtn: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.coral, lineHeight: 20, paddingHorizontal: 4 },
  form: { borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontFamily: FontFamily.body, fontSize: 15, color: Colors.text,
  },
  colorRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotSel: { borderWidth: 3, borderColor: Colors.text },
  confirmBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  confirmText: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg },
  hcRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hcBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.line },
  hcBtnText: { fontFamily: FontFamily.titleBold, fontSize: 14, color: Colors.text, lineHeight: 18 },
  hcVal: { fontFamily: FontFamily.numberBold, fontSize: 13, width: 24, textAlign: 'center' },
});
