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
import { toggleReaction, addComment, type FeedItem } from '@/firebase/feed';

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

        {/* Placar */}
        <View style={mc.scoreRow}>
          {/* Side A */}
          <View style={mc.side}>
            <View style={mc.avatarRow}>
              {(item.sideA?.ids ?? []).slice(0, 2).map((id, i) => {
                const pl = findPlayer(id);
                return pl
                  ? <Avatar key={i} name={pl.name} color={pl.color} size={30} />
                  : <View key={i} style={[mc.avatarFallback, { backgroundColor: Colors.surf2 }]}><Text style={mc.avatarFallbackTxt}>?</Text></View>;
              })}
            </View>
            <Text style={[mc.sideName, aWon && mc.sideNameWin]} numberOfLines={1}>
              {item.sideA?.name}
            </Text>
          </View>

          {/* Placar central com glow */}
          <Animated.View style={[mc.scoreBox, { shadowColor: Colors.gold, shadowRadius: scoreShadow, shadowOpacity: 0.6, shadowOffset: { width: 0, height: 0 } }]}>
            <Text style={mc.scoreText}>
              <Text style={{ color: aWon ? Colors.teal : Colors.muted }}>{item.sideA?.score}</Text>
              <Text style={{ color: Colors.faint }}> – </Text>
              <Text style={{ color: !aWon ? Colors.teal : Colors.muted }}>{item.sideB?.score}</Text>
            </Text>
          </Animated.View>

          {/* Side B */}
          <View style={[mc.side, mc.sideRight]}>
            <View style={[mc.avatarRow, { justifyContent: 'flex-end' }]}>
              {(item.sideB?.ids ?? []).slice(0, 2).map((id, i) => {
                const pl = findPlayer(id);
                return pl
                  ? <Avatar key={i} name={pl.name} color={pl.color} size={30} />
                  : <View key={i} style={[mc.avatarFallback, { backgroundColor: Colors.surf2 }]}><Text style={mc.avatarFallbackTxt}>?</Text></View>;
              })}
            </View>
            <Text style={[mc.sideName, mc.sideNameRight, !aWon && mc.sideNameWin]} numberOfLines={1}>
              {item.sideB?.name}
            </Text>
          </View>
        </View>

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
    </Card>
  );
}

const mc = StyleSheet.create({
  card:            { padding: 0, overflow: 'hidden' },
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

  return (
    <Card style={mil.card}>
      <View style={mil.inner}>
        <Text style={mil.emoji}>{item.milestoneEmoji ?? '🏅'}</Text>
        <View style={mil.info}>
          <Text style={mil.title}>{item.milestoneTitle}</Text>
          <Text style={mil.desc}>{item.milestoneDesc}</Text>
          {players.length > 0 && (
            <View style={mil.avatars}>
              {players.map((p, i) => (
                <Avatar key={i} name={p.name} color={p.color} size={24} />
              ))}
            </View>
          )}
        </View>
        <Text style={mil.time}>{timeAgo(item.timestamp)}</Text>
      </View>
    </Card>
  );
}

const mil = StyleSheet.create({
  card:    { borderWidth: 1, borderColor: Colors.gold + '33' },
  inner:   { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
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

  return (
    <Card style={rc.card}>
      <View style={rc.left}>
        {pl
          ? <Avatar name={pl.name} color={pl.color} size={40} />
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
      </View>
      <View style={rc.badge}>
        <Text style={rc.arrow}>↑{climbed}</Text>
      </View>
    </Card>
  );
}

const rc = StyleSheet.create({
  card:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  return (
    <Card style={mc.card}>
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
    </Card>
  );
}

function MatchRow({ item, last }: { item: FeedItem; last: boolean }) {
  const { user, group } = useAuth();
  const { findPlayer } = useGroupPlayers();
  const [showComments, setShowComments] = useState(false);
  const aWon = (item.sideA?.score ?? 0) > (item.sideB?.score ?? 0);

  async function handleReaction(emoji: string) {
    if (!user || !group) return;
    const has = (item.reactions[emoji] ?? []).includes(user.uid);
    try { await toggleReaction(group.id, item.id, emoji, user.uid, has); }
    catch { /* ignore */ }
  }

  return (
    <View style={[mr.wrap, !last && mr.border]}>
      {/* Placar */}
      <View style={mr.scoreRow}>
        <View style={mr.side}>
          <Text style={[mr.sideName, aWon && mr.win]} numberOfLines={1}>{item.sideA?.name}</Text>
        </View>
        <Text style={mr.score}>
          <Text style={{ color: aWon ? Colors.teal : Colors.muted }}>{item.sideA?.score}</Text>
          <Text style={{ color: Colors.faint }}> – </Text>
          <Text style={{ color: !aWon ? Colors.teal : Colors.muted }}>{item.sideB?.score}</Text>
        </Text>
        <View style={[mr.side, { alignItems: 'flex-end' }]}>
          <Text style={[mr.sideName, !aWon && mr.win]} numberOfLines={1}>{item.sideB?.name}</Text>
        </View>
      </View>
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
