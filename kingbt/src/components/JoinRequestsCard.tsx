import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupJoinRequests } from '@/hooks/useGroupJoinRequests';
import { approveJoinRequest, rejectJoinRequest } from '@/firebase/joinRequests';

/** Pedidos de entrada no grupo: o admin aprova ou recusa. Some quando não há pedidos. */
export function JoinRequestsCard() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { group, isAdmin } = useAuth();
  const requests = useGroupJoinRequests(group?.id, isAdmin);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!group || !isAdmin || requests.length === 0) return null;

  async function run(uid: string, task: () => Promise<void>) {
    setBusy(uid); setError(null);
    try { await task(); }
    catch { setError('Não foi possível concluir. Verifique a conexão e tente de novo.'); }
    finally { setBusy(null); }
  }

  return (
    <View style={s.card}>
      <Text style={s.title}>Pedidos de entrada</Text>
      <Text style={s.hint}>Quem pediu para entrar no grupo só vê os eventos, rankings e conquistas depois que você aprovar.</Text>
      {requests.map(r => (
        <View key={r.uid} style={s.row}>
          <Text style={s.name} numberOfLines={1}>{r.name}</Text>
          {busy === r.uid ? (
            <ActivityIndicator color={Colors.gold} />
          ) : (
            <View style={s.actions}>
              <TouchableOpacity style={s.reject} onPress={() => run(r.uid, () => rejectJoinRequest(group.id, r.uid))} accessibilityRole="button" accessibilityLabel={`Recusar ${r.name}`}>
                <Text style={s.rejectText}>Recusar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.approve} onPress={() => run(r.uid, () => approveJoinRequest(group.id, r.uid))} accessibilityRole="button" accessibilityLabel={`Aprovar ${r.name}`}>
                <Text style={s.approveText}>Aprovar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
      {!!error && <Text style={[s.hint, { color: Colors.coral }]}>{error}</Text>}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: Colors.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.gold + '66', padding: Spacing.md, gap: Spacing.sm },
  title: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 22, color: Colors.text },
  hint: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 19, color: Colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  name: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 16, color: Colors.text },
  actions: { flexDirection: 'row', gap: Spacing.xs },
  reject: { minHeight: 40, paddingHorizontal: 14, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  rejectText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  approve: { minHeight: 40, paddingHorizontal: 16, borderRadius: Radius.full, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  approveText: { fontFamily: FontFamily.titleBold, fontSize: 14, color: Colors.bg },
});
