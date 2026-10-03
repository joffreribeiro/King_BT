import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useSettings } from '@/store/SettingsContext';
import { Card } from '@/components';
import { AppInput, ChipGroup, FieldLabel, Hint, PrimaryButton, ToggleRow } from '@/components/competition/FormKit';
import { publishAnnouncement, removeAnnouncement } from '@/firebase/announcements';
import {
  ANNOUNCEMENT_TEXT_MAX, ANNOUNCEMENT_TITLE_MAX, VALIDITY_OPTIONS, isActive, newAnnouncement, validateAnnouncement,
} from '@/logic/announcements';

const brDate = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

/** Admin: publica comunicados para o grupo inteiro. Aparecem no topo da Home de todos. */
export function AnnouncementsAdminCard() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { group, isAdmin, user } = useAuth();
  const { announcements } = useSettings();

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [days, setDays] = useState<string>('7');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!group || !isAdmin) return null;

  const error = text.trim() || title.trim() ? validateAnnouncement(title, text) : null;
  const ready = !!text.trim() && !validateAnnouncement(title, text);

  async function publish() {
    if (!ready) return;
    const a = newAnnouncement({ title, text, validityDays: days === 'none' ? null : parseInt(days, 10), pinned }, user?.uid);
    if (!a) return;
    setBusy(true); setMsg(null);
    try {
      await publishAnnouncement(group!.id, a);
      setMsg('Comunicado publicado. Já aparece na Home de todos.');
      setTitle(''); setText(''); setPinned(false);
    } catch {
      setMsg('Não foi possível publicar. Verifique a conexão e tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true); setMsg(null);
    try { await removeAnnouncement(group!.id, id); setMsg('Comunicado removido.'); }
    catch { setMsg('Não foi possível remover. Tente de novo.'); }
    finally { setBusy(false); }
  }

  return (
    <View>
      <Text style={s.title}>Comunicados</Text>
      <Text style={s.sectionHint}>Avisos para o grupo todo ("jogo cancelado por chuva", "inscrições abertas"). Aparecem no topo da Home de todos.</Text>
      <Card style={{ gap: Spacing.xs }}>
        <FieldLabel>Título (opcional)</FieldLabel>
        <AppInput value={title} onChangeText={t => setTitle(t.slice(0, ANNOUNCEMENT_TITLE_MAX + 5))} placeholder="Ex.: Atenção ao horário" />
        <FieldLabel required>Mensagem</FieldLabel>
        <AppInput value={text} onChangeText={t => setText(t.slice(0, ANNOUNCEMENT_TEXT_MAX + 20))} placeholder="Escreva o aviso" multiline />
        <Hint>{text.trim().length}/{ANNOUNCEMENT_TEXT_MAX}</Hint>

        <FieldLabel>Vale por</FieldLabel>
        <ChipGroup
          options={VALIDITY_OPTIONS.map(o => ({ value: o.days == null ? 'none' : String(o.days), label: o.label }))}
          value={days} onChange={setDays}
        />
        <ToggleRow title="Fixar no topo" subtitle="Fica sempre à vista e ninguém consegue dispensar." value={pinned} onChange={setPinned} />

        {!!error && <Text style={[s.hint, { color: C.coral }]}>{error}</Text>}
        {!!msg && <Text style={[s.hint, { color: msg.startsWith('Comunicado') ? C.teal : C.coral }]}>{msg}</Text>}
        <View style={{ marginTop: Spacing.sm }}>
          <PrimaryButton label="Publicar comunicado" onPress={publish} disabled={!ready} busy={busy} />
        </View>

        {announcements.length > 0 && (
          <View style={{ marginTop: Spacing.md }}>
            <Text style={s.group}>PUBLICADOS</Text>
            {announcements.slice(0, 10).map(a => (
              <View key={a.id} style={s.item}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle} numberOfLines={2}>{a.pinned ? '📌 ' : ''}{a.title ? `${a.title}: ` : ''}{a.text}</Text>
                  <Text style={s.hint}>
                    {brDate(a.date)} · {!isActive(a) ? 'expirado' : a.expiresAt ? `vale até ${brDate(a.expiresAt)}` : 'sem prazo'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => remove(a.id)} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remover comunicado">
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
  hint: { fontFamily: FontFamily.body, fontSize: 13, color: C.muted },
  group: { fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.3, color: C.muted, marginBottom: 4 },
  item: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 8 },
  itemTitle: { fontFamily: FontFamily.bodyMed, fontSize: 15, lineHeight: 21, color: C.text },
  remove: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.coral, padding: 6 },
});
