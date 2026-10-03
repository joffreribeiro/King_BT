import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useSettings } from '@/store/SettingsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { Card } from '@/components';
import { AppInput, ChipGroup, FieldLabel, Hint, PrimaryButton, SelectField } from '@/components/competition/FormKit';
import { grantHonor, removeHonor } from '@/firebase/honors';
import { HONOR_NOTE_MAX, HONOR_PRESETS, HONOR_TITLE_MAX, newHonor, validateHonor } from '@/logic/honors';

const brDate = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

/** Admin: concede honrarias (troféus manuais) a jogadores do grupo. Aparecem no perfil, na aba Conquistas. */
export function HonorsAdminCard() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { group, isAdmin, user } = useAuth();
  const { honors } = useSettings();
  const { groupPlayers, findPlayer } = useGroupPlayers();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🏅');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!group || !isAdmin) return null;

  const error = title.trim() ? validateHonor(title, note) : null;
  const ready = !!playerId && !!title.trim() && !error;

  async function grant() {
    if (!ready || !playerId) return;
    const honor = newHonor({ playerId, title, icon, note }, user?.uid);
    if (!honor) return;
    setBusy(true); setMsg(null);
    try {
      await grantHonor(group!.id, honor);
      setMsg(`Honraria concedida a ${findPlayer(playerId)?.name ?? 'jogador'}.`);
      setTitle(''); setNote(''); setIcon('🏅');
    } catch {
      setMsg('Não foi possível conceder. Verifique a conexão e tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true); setMsg(null);
    try { await removeHonor(group!.id, id); setMsg('Honraria removida.'); }
    catch { setMsg('Não foi possível remover. Tente de novo.'); }
    finally { setBusy(false); }
  }

  return (
    <View>
      <Text style={s.title}>Honrarias</Text>
      <Text style={s.sectionHint}>Troféus que você concede a um jogador (Fair Play, Melhor da Temporada...). Aparecem no perfil dele, na aba Conquistas.</Text>
      <Card style={{ gap: Spacing.xs }}>
        <FieldLabel required>Jogador</FieldLabel>
        <SelectField
          title="Jogador"
          options={groupPlayers.map(p => ({ value: p.id, label: p.name }))}
          value={playerId} onChange={setPlayerId}
        />

        <FieldLabel required>Honraria</FieldLabel>
        <ChipGroup
          options={HONOR_PRESETS.map(p => ({ value: p.title, label: `${p.icon} ${p.title}` }))}
          value={HONOR_PRESETS.some(p => p.title === title) ? title : null}
          onChange={t => { setTitle(t); setIcon(HONOR_PRESETS.find(p => p.title === t)?.icon ?? '🏅'); }}
        />
        <Hint>Ou escreva o seu próprio nome:</Hint>
        <View style={s.row}>
          <AppInput style={{ width: 64, textAlign: 'center' }} value={icon} onChangeText={t => setIcon(t.slice(0, 8))} maxLength={8} accessibilityLabel="Emoji da honraria" />
          <AppInput style={{ flex: 1 }} value={title} onChangeText={t => setTitle(t.slice(0, HONOR_TITLE_MAX + 5))} placeholder="Ex.: Melhor defesa" accessibilityLabel="Nome da honraria" />
        </View>

        <FieldLabel>Observação (opcional)</FieldLabel>
        <AppInput value={note} onChangeText={setNote} placeholder="Por que ele merece?" multiline maxLength={HONOR_NOTE_MAX + 20} />
        {!!error && <Text style={[s.hint, { color: C.coral }]}>{error}</Text>}
        {!!msg && <Text style={[s.hint, { color: msg.startsWith('Honraria') ? C.teal : C.coral }]}>{msg}</Text>}
        <View style={{ marginTop: Spacing.sm }}>
          <PrimaryButton label="Conceder honraria" onPress={grant} disabled={!ready} busy={busy} />
        </View>

        {honors.length > 0 && (
          <View style={{ marginTop: Spacing.md }}>
            <Text style={s.group}>CONCEDIDAS RECENTEMENTE</Text>
            {honors.slice(0, 10).map(h => (
              <View key={h.id} style={s.item}>
                <Text style={s.itemIcon}>{h.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle} numberOfLines={1}>{h.title}</Text>
                  <Text style={s.hint} numberOfLines={1}>{findPlayer(h.playerId)?.name ?? 'Jogador removido'} · {brDate(h.date)}</Text>
                </View>
                <TouchableOpacity onPress={() => remove(h.id)} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remover honraria ${h.title}`}>
                  <Text style={s.remove}>Remover</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  title: { fontFamily: FontFamily.title, fontSize: 15, color: C.text, marginBottom: 4 },
  sectionHint: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, color: C.muted, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm, marginTop: 6 },
  hint: { fontFamily: FontFamily.body, fontSize: 13, color: C.muted },
  group: { fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.3, color: C.muted, marginBottom: 4 },
  item: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 6 },
  itemIcon: { fontSize: 24 },
  itemTitle: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.text },
  remove: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.coral, padding: 6 },
});
