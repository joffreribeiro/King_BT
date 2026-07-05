import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { useFeed } from '@/store/FeedContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { toggleReaction, addComment, type FeedItem } from '@/firebase/feed';
import { goToPlayer } from '@/logic/nav';

const EMOJIS = ['👑', '🔥', '💪'] as const;

const FORMAT_COLOR: Record<string, string> = {
  liga:   Colors.teal,
  grupos: '#6B7FD7',
  mata:   Colors.coral,
  avulso: '#38BDF8',
  super8: '#F472B6',
};

function timeAgo(ts: any): string {
  const ms = Date.now() - (ts?.toDate?.()?.getTime?.() ?? Date.now());
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// O feed guarda só o placar em sets (ex.: 1–0); os games por set vivem no jogo
// original da competição — busca via compId/matchId (funciona para posts antigos).
function useMatchGames(item: FeedItem): { a: number; b: number }[] | null {
  const { state } = useCompetitions();
  // Prioridade 1: games gravados direto no post (sobrevive à exclusão da competição)
  if (item.sets?.length) return item.sets;
  // Prioridade 2: posts antigos, sem o campo — busca ao vivo na competição
  // (só funciona se a competição/jogo original ainda existir)
  const comp = state.competitions.find(c => c.id === item.compId);
  const match = item.matchId ? comp?.matches.find(m => m.id === item.matchId) : undefined;
  return match?.sets?.length ? match.sets : null;
}

// Placar estilo painel de TV: cada lado numa linha, games por set em colunas
// alinhadas da esquerda (mesmo visual do ScoreboardCard das competições)
function FeedScoreboard({ item, sets }: { item: FeedItem; sets: { a: number; b: number }[] | null }) {
  const { findPlayer } = useGroupPlayers();
  const aWon = (item.sideA?.score ?? 0) > (item.sideB?.score ?? 0);

  function Row({ side }: { side: 'a' | 'b' }) {
    const info = side === 'a' ? item.sideA : item.sideB;
    const won = side === 'a' ? aWon : !aWon;
    const ids = info?.ids ?? [];
    return (
      <View style={fsb.row}>
        {ids.slice(0, 2).map(id => {
          const pl = findPlayer(id);
          return pl
            ? <TouchableOpacity key={id} onPress={() => goToPlayer(id)} hitSlop={4}>
                <Avatar name={pl.name} color={pl.color} size={24} />
              </TouchableOpacity>
            : null;
        })}
        {ids.length > 0 ? (
          <Text style={[fsb.name, won && fsb.nameWin, fsb.nameWrap]} numberOfLines={1}>
            {ids.map((id, i) => {
              const pl = findPlayer(id);
              return (
                <Text key={id} onPress={pl ? () => goToPlayer(id) : undefined}>
                  {i > 0 ? ' / ' : ''}{pl?.name ?? id}
                </Text>
              );
            })}
          </Text>
        ) : (
          <Text style={[fsb.name, won && fsb.nameWin]} numberOfLines={1}>{info?.name}</Text>
        )}
        <View style={fsb.scoreZone}>
          {sets
            ? sets.map((s, i) => {
                const win = side === 'a' ? s.a > s.b : s.b > s.a;
                return (
                  <Text key={i} style={[fsb.col, win && fsb.colWin]}>
                    {side === 'a' ? s.a : s.b}
                  </Text>
                );
              })
            // Jogo antigo sem games gravados: troféu no vencedor, sem placar em sets
            : won ? <Text style={fsb.trophy}>🏆</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={fsb.box}>
      <Row side="a" />
      <View style={fsb.div} />
      <Row side="b" />
    </View>
  );
}

const fsb = StyleSheet.create({
  box: { borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: Spacing.sm, height: 42 },
  nameWrap: { flex: 1 },
  name: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: '#FFFFFF' },
  nameWin: { color: Colors.gold, fontFamily: FontFamily.title },
  scoreZone: {
    width: 100, alignSelf: 'stretch',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start',
    borderLeftWidth: 1, borderLeftColor: Colors.line,
    paddingLeft: 6, backgroundColor: Colors.surf2,
  },
  col: { width: 30, textAlign: 'center', fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.muted },
  colWin: { color: Colors.teal },
  trophy: { fontSize: 14, paddingLeft: 4 },
  div: { height: 1, backgroundColor: Colors.line, marginHorizontal: Spacing.sm },
});

// ─── Card de resultado de partida ────────────────────────────────────────────

function CommentsModal({ item, visible, onClose }: { item: FeedItem; visible: boolean; onClose: () => void }) {
  const { user, group } = useAuth();
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  async function handleComment() {
    if (!user || !group || !comment.trim() || sending) return;
    setSending(true);
    try {
      await addComment(group.id, item.id, user.uid, user.displayName ?? 'Jogador', comment.trim());
      setComment('');
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={cm.overlay} activeOpacity={1} onPress={onClose} />
        <View style={cm.sheet}>
          <View style={cm.handle} />
          <Text style={cm.title}>Comentários</Text>
          <ScrollView style={cm.list} contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.sm }}>
            {item.comments.length === 0 && (
              <Text style={cm.empty}>Seja o primeiro a comentar.</Text>
            )}
            {item.comments.map((c, i) => (
              <View key={i} style={cm.commentRow}>
                <View style={cm.commentDot} />
                <View style={{ flex: 1 }}>
                  <Text style={cm.commentAuthor}>{c.name.split(' ')[0]}</Text>
                  <Text style={cm.commentText}>{c.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={cm.inputRow}>
            <TextInput
              style={cm.input}
              value={comment}
              onChangeText={setComment}
              placeholder="Adicionar comentário..."
              placeholderTextColor={Colors.faint}
              returnKeyType="send"
              onSubmitEditing={handleComment}
              editable={!sending}
              autoFocus
            />
            <TouchableOpacity
              onPress={handleComment}
              disabled={!comment.trim() || sending}
              style={[cm.sendBtn, (!comment.trim() || sending) && cm.sendBtnOff]}
            >
              <Text style={cm.sendTxt}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:       { backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.md, maxHeight: '70%' },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.line, alignSelf: 'center', marginBottom: Spacing.sm },
  title:       { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text, marginBottom: Spacing.sm },
  list:        { maxHeight: 300 },
  empty:       { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', paddingVertical: Spacing.md },
  commentRow:  { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  commentDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold, marginTop: 6 },
  commentAuthor: { fontFamily: FontFamily.title, fontSize: 12, color: Colors.gold },
  commentText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.text },
  inputRow:    { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.sm },
  input:       { flex: 1, backgroundColor: Colors.surf2, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8, fontFamily: FontFamily.body, fontSize: 13, color: Colors.text, borderWidth: 1, borderColor: Colors.line },
  sendBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff:  { opacity: 0.35 },
  sendTxt:     { fontSize: 18, color: Colors.bg },
});

function MatchResultCard({ item }: { item: FeedItem }) {
  const { user, group } = useAuth();
  const { findPlayer } = useGroupPlayers();
  const [showComments, setShowComments] = useState(false);
  const gameSets = useMatchGames(item);

  const aWon = (item.sideA?.score ?? 0) > (item.sideB?.score ?? 0);
  const accent = FORMAT_COLOR[item.format ?? ''] ?? Colors.gold;

  // Score glow animado
  const scoreGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scoreGlow, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(scoreGlow, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    ).start();
  }, []);
  const scoreShadow = scoreGlow.interpolate({ inputRange: [0, 1], outputRange: [4, 16] });

  // Card fade-in ao montar
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardY,       { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleReaction(emoji: string) {
    if (!user || !group) return;
    const has = (item.reactions[emoji] ?? []).includes(user.uid);
    try { await toggleReaction(group.id, item.id, emoji, user.uid, has); }
    catch { /* ignore */ }
  }

  return (
    <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardY }] }}>
    <View style={[mc.card, { borderColor: `${accent}33`, overflow: 'hidden' }]}>
      {/* Gradiente de fundo por formato */}
      <LinearGradient
        colors={[`${accent}18`, `${accent}06`]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Barra colorida de formato */}
      <View style={[mc.accentBar, { backgroundColor: accent }]} />

      <View style={mc.body}>
        {/* Header */}
        <View style={mc.header}>
          <Text style={[mc.compName, { color: accent }]} numberOfLines={1}>{item.compName}</Text>
          <Text style={mc.time}>{timeAgo(item.timestamp)}</Text>
        </View>

        {/* Placar — cada lado numa linha, games em colunas */}
        <FeedScoreboard item={item} sets={gameSets} />

        {/* Reações */}
        <View style={mc.reactRow}>
          {EMOJIS.map(emoji => {
            const uids = item.reactions[emoji] ?? [];
            const hasReacted = user ? uids.includes(user.uid) : false;
            return (
              <TouchableOpacity
                key={emoji}
                style={[mc.reactBtn, hasReacted && mc.reactBtnActive]}
                onPress={() => handleReaction(emoji)}
                activeOpacity={0.7}
              >
                <Text style={mc.reactEmoji}>{emoji}</Text>
                {uids.length > 0 && (
                  <Text style={[mc.reactCount, hasReacted && mc.reactCountActive]}>
                    {uids.length}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={mc.commentToggle}
            onPress={() => setShowComments(true)}
          >
            <Text style={mc.commentToggleTxt}>
              {item.comments.length > 0 ? `💬 ${item.comments.length}` : '💬'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <CommentsModal
        item={item}
        visible={showComments}
        onClose={() => setShowComments(false)}
      />
    </View>
    </Animated.View>
  );
}

const mc = StyleSheet.create({
  card:            { padding: 0, overflow: 'hidden', backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line },
  accentBar:       { height: 3 },
  body:            { padding: Spacing.md, gap: Spacing.sm },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compName:        { flex: 1, fontFamily: FontFamily.title, fontSize: 12 },
  time:            { fontFamily: FontFamily.number, fontSize: 11, color: Colors.faint },
  scoreRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.sm, gap: 4 },
  side:            { flex: 1, gap: 4 },
  sideRight:       { alignItems: 'flex-end' },
  avatarRow:       { flexDirection: 'row', gap: -6 },
  avatarFallback:  { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackTxt: { fontFamily: FontFamily.numberBold, fontSize: 12, color: Colors.faint },
  sideName:        { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.muted },
  sideNameRight:   { textAlign: 'right' },
  sideNameWin:     { color: Colors.text },
  scoreBox:        { alignItems: 'center', minWidth: 72 },
  scoreText:       { fontFamily: FontFamily.titleBold, fontSize: 24 },
  reactRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reactBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surf2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.line },
  reactBtnActive:  { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '44' },
  reactEmoji:      { fontSize: 14 },
  reactCount:      { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.muted },
  reactCountActive:{ color: Colors.gold },
  commentToggle:    { marginLeft: 'auto' as any },
  commentToggleTxt: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.faint },
});

// ─── Card de milestone de rivalidade ─────────────────────────────────────────

function MilestoneCard({ item }: { item: FeedItem }) {
  const { findPlayer } = useGroupPlayers();

  const players = (item.involvedIds ?? [])
    .map(id => findPlayer(id))
    .filter(Boolean) as NonNullable<ReturnType<typeof findPlayer>>[];

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardY,       { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardY }] }}>
    <View style={[mil.card, { overflow: 'hidden' }]}>
      <LinearGradient
        colors={[`${Colors.gold}28`, `${Colors.coral}10`]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={mil.inner}>
        <Text style={mil.emoji}>{item.milestoneEmoji ?? '🏅'}</Text>
        <View style={mil.info}>
          <Text style={mil.title}>{item.milestoneTitle}</Text>
          <Text style={mil.desc}>{item.milestoneDesc}</Text>
          {players.length > 0 && (
            <View style={mil.avatars}>
              {players.map((p, i) => (
                <TouchableOpacity key={i} onPress={() => goToPlayer(p.id)} hitSlop={4}>
                  <FadeAvatar name={p.name} color={p.color} size={24} delay={i * 80} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <Text style={mil.time}>{timeAgo(item.timestamp)}</Text>
      </View>
    </View>
    </Animated.View>
  );
}

function FadeAvatar({ name, color, size, delay }: { name: string; color: string; size: number; delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(scale,   { toValue: 1, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <Avatar name={name} color={color} size={size} />
    </Animated.View>
  );
}

const mil = StyleSheet.create({
  card:    { borderWidth: 1, borderColor: Colors.gold + '33', borderRadius: Radius.md, backgroundColor: Colors.surf },
  inner:   { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md },
  emoji:   { fontSize: 28, lineHeight: 34 },
  info:    { flex: 1, gap: 3 },
  title:   { fontFamily: FontFamily.title, fontSize: 13, color: Colors.gold },
  desc:    { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  avatars: { flexDirection: 'row', gap: 4, marginTop: 4 },
  time:    { fontFamily: FontFamily.number, fontSize: 11, color: Colors.faint },
});

// ─── Card de mudança de ranking ───────────────────────────────────────────────

function RankChangeCard({ item }: { item: FeedItem }) {
  const { findPlayer } = useGroupPlayers();
  const pl = item.playerId ? findPlayer(item.playerId) : null;
  const climbed = (item.oldPos ?? 0) - (item.newPos ?? 0);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(16)).current;
  const badgePulse  = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardY,       { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(badgePulse, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardY }] }}>
    <View style={[rc.card, { overflow: 'hidden' }]}>
      <LinearGradient
        colors={[`${Colors.teal}22`, `${Colors.gold}10`]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <TouchableOpacity
        style={rc.left}
        onPress={() => item.playerId && goToPlayer(item.playerId)}
        disabled={!item.playerId}
        activeOpacity={0.7}
      >
        {pl
          ? <FadeAvatar name={pl.name} color={pl.color} size={40} delay={0} />
          : <Text style={{ fontSize: 28 }}>📊</Text>
        }
        <View style={rc.info}>
          <Text style={rc.title} numberOfLines={1}>
            {item.playerName} subiu no ranking!
          </Text>
          <Text style={rc.sub}>
            Agora em <Text style={rc.pos}>#{item.newPos}</Text>
            {' · '}{item.newPoints?.toFixed(2)} pts
          </Text>
        </View>
      </TouchableOpacity>
      <Animated.View style={[rc.badge, { transform: [{ scale: badgePulse }] }]}>
        <Text style={rc.arrow}>↑{climbed}</Text>
      </Animated.View>
    </View>
    </Animated.View>
  );
}

const rc = StyleSheet.create({
  card:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line },
  left:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  info:  { flex: 1 },
  title: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.text },
  sub:   { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  pos:   { color: Colors.gold },
  badge: { backgroundColor: Colors.teal + '22', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  arrow: { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.teal },
});

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <View style={{ gap: Spacing.sm }}>
      {[1, 2, 3].map(i => (
        <Card key={i} style={{ gap: Spacing.sm }}>
          <View style={{ height: 12, width: '60%', backgroundColor: Colors.surf2, borderRadius: 6 }} />
          <View style={{ height: 56, backgroundColor: Colors.surf2, borderRadius: Radius.md }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3].map(j => (
              <View key={j} style={{ height: 28, width: 52, backgroundColor: Colors.surf2, borderRadius: 20 }} />
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}

// ─── Card agrupado por competição ────────────────────────────────────────────

function CompGroupCard({ compName, matches }: { compName: string; matches: FeedItem[] }) {
  const accent = FORMAT_COLOR[matches[0]?.format ?? ''] ?? Colors.gold;
  const time = timeAgo(matches[0]?.timestamp);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardY,       { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardY }] }}>
    <View style={[mc.card, { overflow: 'hidden' }]}>
      <LinearGradient
        colors={[`#9C27B026`, `#E91E6312`]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[mc.accentBar, { backgroundColor: accent }]} />
      <View style={mc.body}>
        <View style={mc.header}>
          <Text style={[mc.compName, { color: accent }]} numberOfLines={1}>{compName}</Text>
          <Text style={mc.time}>{time}</Text>
        </View>
        {matches.map((item, i) => (
          <MatchRow key={item.id} item={item} last={i === matches.length - 1} />
        ))}
      </View>
    </View>
    </Animated.View>
  );
}

function MatchRow({ item, last }: { item: FeedItem; last: boolean }) {
  const { user, group } = useAuth();
  const { findPlayer } = useGroupPlayers();
  const [showComments, setShowComments] = useState(false);
  const gameSets = useMatchGames(item);
  const aWon = (item.sideA?.score ?? 0) > (item.sideB?.score ?? 0);

  async function handleReaction(emoji: string) {
    if (!user || !group) return;
    const has = (item.reactions[emoji] ?? []).includes(user.uid);
    try { await toggleReaction(group.id, item.id, emoji, user.uid, has); }
    catch { /* ignore */ }
  }

  return (
    <View style={[mr.wrap, !last && mr.border]}>
      {/* Placar — cada lado numa linha, games em colunas */}
      <FeedScoreboard item={item} sets={gameSets} />
      {/* Reações */}
      <View style={mr.reactRow}>
        {EMOJIS.map(emoji => {
          const uids = item.reactions[emoji] ?? [];
          const hasReacted = user ? uids.includes(user.uid) : false;
          return (
            <TouchableOpacity
              key={emoji}
              style={[mc.reactBtn, hasReacted && mc.reactBtnActive]}
              onPress={() => handleReaction(emoji)}
              activeOpacity={0.7}
            >
              <Text style={mc.reactEmoji}>{emoji}</Text>
              {uids.length > 0 && (
                <Text style={[mc.reactCount, hasReacted && mc.reactCountActive]}>{uids.length}</Text>
              )}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={mc.commentToggle} onPress={() => setShowComments(true)}>
          <Text style={mc.commentToggleTxt}>{item.comments.length > 0 ? `💬 ${item.comments.length}` : '💬'}</Text>
        </TouchableOpacity>
      </View>
      <CommentsModal item={item} visible={showComments} onClose={() => setShowComments(false)} />
    </View>
  );
}

const mr = StyleSheet.create({
  wrap:     { gap: 6, paddingVertical: Spacing.sm },
  border:   { borderBottomWidth: 1, borderBottomColor: Colors.line },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surf2, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  side:     { flex: 1 },
  sideName: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted },
  win:      { color: Colors.text },
  score:    { fontFamily: FontFamily.titleBold, fontSize: 20, textAlign: 'center', minWidth: 60 },
  reactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

// ─── Tela principal ───────────────────────────────────────────────────────────

type FeedRow =
  | { kind: 'group'; compName: string; matches: FeedItem[] }
  | { kind: 'single'; item: FeedItem };

export default function FeedScreen() {
  const { items, loaded, error } = useFeed();
  const { group } = useAuth();

  // Agrupar match_result por compName preservando ordem cronológica
  const rows: FeedRow[] = [];
  const seen = new Map<string, FeedItem[]>();
  for (const item of items) {
    if (item.type === 'match_result') {
      const key = item.compName ?? '__unknown__';
      if (!seen.has(key)) {
        const bucket: FeedItem[] = [];
        seen.set(key, bucket);
        rows.push({ kind: 'group', compName: key, matches: bucket });
      }
      seen.get(key)!.push(item);
    } else {
      rows.push({ kind: 'single', item });
    }
  }

  function renderRow({ item }: { item: FeedRow }) {
    if (item.kind === 'group') return <CompGroupCard compName={item.compName} matches={item.matches} />;
    if (item.item.type === 'rank_change') return <RankChangeCard item={item.item} />;
    if (item.item.type === 'rivalry_milestone') return <MilestoneCard item={item.item} />;
    return null;
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <FlatList
        data={rows}
        keyExtractor={(r, i) => r.kind === 'group' ? r.compName : r.item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={s.titleRow}>
            <Text style={s.title}>Feed do grupo</Text>
            {group && <Text style={s.groupName}>{group.name}</Text>}
          </View>
        }
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={
          !loaded
            ? <FeedSkeleton />
            : error
            ? (
              <Card style={s.empty}>
                <Text style={{ fontSize: 36 }}>🔒</Text>
                <Text style={s.emptyTitle}>Sem permissão</Text>
                <Text style={s.emptySub}>
                  Adicione a coleção <Text style={{ color: Colors.gold }}>feed</Text> nas regras do Firestore e publique.
                </Text>
                <Text style={[s.emptySub, { color: Colors.faint, fontSize: 11, marginTop: 4 }]}>
                  {error}
                </Text>
              </Card>
            )
            : (
              <Card style={s.empty}>
                <Text style={{ fontSize: 36 }}>🏝️</Text>
                <Text style={s.emptyTitle}>Nenhum jogo ainda</Text>
                <Text style={s.emptySub}>
                  Registre o primeiro placar e ele aparece aqui com reações e comentários.
                </Text>
              </Card>
            )
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.bg },
  list:       { padding: Spacing.md, paddingBottom: 140 },
  titleRow:   { marginBottom: Spacing.md },
  title:      { fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.text },
  groupName:  { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: 2 },
  empty:      { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.muted },
  emptySub:   { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
