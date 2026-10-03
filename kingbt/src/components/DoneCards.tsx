import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, Alert } from 'react-native';
import { useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius, Type, FontFamily, formatAccent, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { ensureFeedItem, toggleReaction, addComment, type FeedItem } from '@/firebase/feed';
import { goToPlayer } from '@/logic/nav';
import Avatar from './Avatar';

const EMOJIS = ['👑', '🔥', '💪'] as const;
const FORMAT_LABEL: Record<string, string> = {
  avulso: 'Avulso', liga: 'Liga', grupos: 'Grupos', mata: 'Mata-Mata', super8: 'Super 8',
};

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert('', msg);
}

function stamp(item: FeedItem): string {
  const d = item.timestamp?.toDate?.();
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Reações + data + caixa de comentário (como nos cards do Atlas). Os cards de
 * campeão/finalizado nascem derivados da competição; o documento no feed só é
 * criado no primeiro toque (reação ou comentário), antes de gravar.
 */
function Interactions({ item, align }: { item: FeedItem; align: 'center' | 'left' }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { user, group } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const center = align === 'center';

  async function react(emoji: string) {
    if (!user || !group) return;
    const has = (item.reactions[emoji] ?? []).includes(user.uid);
    try {
      if (item.derived) await ensureFeedItem(group.id, item);
      await toggleReaction(group.id, item.id, emoji, user.uid, has);
    } catch { notify('Não foi possível salvar sua reação. Verifique a conexão.'); }
  }

  async function send() {
    if (!user || !group || !text.trim() || busy) return;
    setBusy(true);
    try {
      if (item.derived) await ensureFeedItem(group.id, item);
      await addComment(group.id, item.id, user.uid, user.displayName ?? 'Jogador', text.trim());
      setText('');
    } catch { notify('Não foi possível enviar o comentário. Verifique a conexão.'); }
    finally { setBusy(false); }
  }

  return (
    <View style={{ gap: Spacing.sm + 2, alignItems: center ? 'center' : 'stretch' }}>
      <View style={[s.reactRow, center && { justifyContent: 'center' }]}>
        {EMOJIS.map(emoji => {
          const uids = item.reactions[emoji] ?? [];
          const mine = user ? uids.includes(user.uid) : false;
          return (
            <TouchableOpacity key={emoji} style={[s.reactBtn, mine && s.reactBtnOn]} onPress={() => react(emoji)} activeOpacity={0.7}>
              <Text style={s.reactEmoji}>{emoji}</Text>
              {uids.length > 0 && <Text style={[s.reactCount, mine && { color: Colors.gold }]}>{uids.length}</Text>}
            </TouchableOpacity>
          );
        })}
        <Text style={s.date}>{stamp(item)}</Text>
      </View>

      {item.comments.slice(-2).map((c, i) => (
        <Text key={i} style={s.comment} numberOfLines={3}>
          <Text style={{ fontFamily: FontFamily.title, color: Colors.text }}>{c.name} </Text>{c.text}
        </Text>
      ))}

      <View style={[s.inputRow, center && { width: '100%' }]}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Escreva um comentário…"
          placeholderTextColor={Colors.faint}
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <TouchableOpacity style={[s.send, (!text.trim() || busy) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || busy} accessibilityLabel="Enviar comentário">
          <Text style={s.sendTxt}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Card grande de campeão: troféu, foto do vencedor, nome em serifada e o título da conquista. */
export function ChampionCard({ item }: { item: FeedItem }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { findPlayer } = useGroupPlayers();
  const accent = formatAccent(Colors, item.format ?? '');
  const players = (item.involvedIds ?? []).map(id => findPlayer(id)).filter(Boolean) as NonNullable<ReturnType<typeof findPlayer>>[];
  const first = players[0];

  return (
    <View style={s.champCard}>
      <LinearGradient colors={[Colors.gold + '26', Colors.gold + '08']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={s.trophy}>🏆</Text>
      <View style={s.champBody}>
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          {players.length > 0 ? players.slice(0, 2).map((p, i) => (
            <TouchableOpacity key={p.id} onPress={() => goToPlayer(p.id)} style={i > 0 && { marginLeft: -14 }} activeOpacity={0.8}>
              <Avatar name={p.name} color={p.color} size={72} />
            </TouchableOpacity>
          )) : <Avatar name={item.playerName ?? '?'} color={Colors.gold} size={72} />}
        </View>
        <Text style={s.champName} numberOfLines={2}>{item.playerName ?? first?.name}</Text>
        <Text style={[s.champTitle, { color: accent }]}>Campeão {FORMAT_LABEL[item.format ?? ''] ?? item.compName}</Text>
        <Text style={s.champComp} numberOfLines={1}>{item.compName}</Text>
        <Interactions item={item} align="center" />
      </View>
    </View>
  );
}

/** Card de "competição finalizada" com o campeão em uma linha. */
export function CompDoneCard({ item }: { item: FeedItem }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={s.doneCard}>
      <Text style={s.doneTitle}>
        🏆 <Text style={{ fontFamily: FontFamily.titleBold }}>{item.compName}</Text> foi finalizado
        <Text style={{ color: Colors.muted }}> · {FORMAT_LABEL[item.format ?? ''] ?? ''}</Text>
      </Text>
      {!!item.playerName && <Text style={s.doneChamp}>Campeão: {item.playerName}</Text>}
      <Interactions item={item} align="left" />
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  champCard: { borderRadius: 20, overflow: 'hidden', backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.gold + '55' },
  trophy: { position: 'absolute', top: 14, left: 16, fontSize: 24, zIndex: 1 },
  champBody: { padding: Spacing.md, paddingTop: Spacing.lg, gap: Spacing.sm, alignItems: 'center' },
  champName: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 26, lineHeight: 30, color: Colors.text, textAlign: 'center', marginTop: Spacing.xs },
  champTitle: { fontFamily: FontFamily.titleBold, fontSize: 18, lineHeight: 24, textAlign: 'center' },
  champComp: { ...Type.body, color: Colors.muted, textAlign: 'center' },

  doneCard: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, padding: Spacing.md, gap: Spacing.sm },
  doneTitle: { fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, color: Colors.text },
  doneChamp: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.teal },

  reactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  reactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.surf2, borderRadius: 22, paddingHorizontal: 12, height: 44, minWidth: 46, borderWidth: 1, borderColor: Colors.line },
  reactBtnOn: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '66' },
  reactEmoji: { fontSize: 16 },
  reactCount: { fontFamily: FontFamily.numberBold, fontSize: 12, color: Colors.muted },
  date: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.faint, marginLeft: 4 },
  comment: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, color: Colors.muted, alignSelf: 'stretch' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: { flex: 1, minHeight: 44, borderRadius: Radius.md, backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.md, fontFamily: FontFamily.body, fontSize: 14, color: Colors.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.gold + '55', alignItems: 'center', justifyContent: 'center' },
  sendTxt: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.gold },
});
