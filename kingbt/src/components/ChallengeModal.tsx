import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import Avatar from '@/components/Avatar';
import { AppInput, FieldLabel, Hint, SelectField } from '@/components/competition/FormKit';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { createChallenge } from '@/firebase/challenges';
import { CHALLENGE_MESSAGE_MAX, CHALLENGE_WHEN_MAX, alreadyChallenged, newChallenge, type Challenge } from '@/logic/challenges';

interface Props {
  visible: boolean;
  opponent: { id: string; name: string; color: string; uid?: string | null } | null;
  /** Desafios já existentes (para não mandar duas vezes enquanto o primeiro espera resposta). */
  challenges: Challenge[];
  onClose: () => void;
}

/** Convite para um jogo 1 contra 1: mensagem e, se quiser, quando. O desafiado responde no app. */
export function ChallengeModal({ visible, opponent, challenges, onClose }: Props) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { user, group, myPlayerId } = useAuth();
  const [message, setMessage] = useState('');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { groupPlayers } = useGroupPlayers();
  const [doubles, setDoubles] = useState(false);
  const [myPartner, setMyPartner] = useState<string | null>(null);
  const [theirPartner, setTheirPartner] = useState<string | null>(null);

  if (!opponent) return null;
  const first = opponent.name.split(' ')[0];
  const dup = !!myPlayerId && alreadyChallenged(challenges, myPlayerId, opponent.id);

  const pickable = (exclude: (string | null | undefined)[]) =>
    groupPlayers.filter(p => !exclude.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(p => ({ value: p.id, label: p.name }));
  const pairReady = !doubles || (!!myPartner && !!theirPartner);

  function close() { setMessage(''); setWhen(''); setError(null); setSent(false); setDoubles(false); setMyPartner(null); setTheirPartner(null); onClose(); }

  async function send() {
    if (!user || !group || !myPlayerId || !opponent) return;
    const data = newChallenge({ fromId: myPlayerId, toId: opponent.id, fromUid: user.uid, toUid: opponent.uid, message, when, ...(doubles && myPartner && theirPartner ? { fromPartnerId: myPartner, toPartnerId: theirPartner } : {}) });
    if (!data) { setError('Não foi possível montar o desafio. Confira os textos.'); return; }
    setBusy(true); setError(null);
    try {
      await createChallenge(group.id, data);
      setSent(true);
    } catch (e: any) {
      setError(e?.code === 'permission-denied'
        ? 'Os desafios ainda não estão liberados neste grupo. Tente de novo mais tarde.'
        : 'Não foi possível enviar. Verifique a conexão e tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={close}>
        <TouchableOpacity style={s.sheet} activeOpacity={1}>
          <View style={s.top}>
            <Avatar name={opponent.name} color={opponent.color} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Desafiar {first}</Text>
              <Text style={s.sub}>{doubles ? 'Jogo de duplas' : 'Jogo 1 contra 1'}. {first} aceita ou recusa no app.</Text>
            </View>
          </View>

          {sent ? (
            <View style={{ gap: Spacing.md }}>
              <Text style={s.done}>Desafio enviado! {first} vai ver na Home e pode aceitar ou recusar.</Text>
              <TouchableOpacity style={s.primary} onPress={close} activeOpacity={0.85}><Text style={s.primaryText}>Fechar</Text></TouchableOpacity>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
              <View style={s.seg}>
                {([[false, '1 contra 1'], [true, 'Duplas']] as const).map(([v, label]) => (
                  <TouchableOpacity key={label} style={[s.segBtn, doubles === v && s.segBtnOn]} onPress={() => setDoubles(v)} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: doubles === v }}>
                    <Text style={[s.segText, doubles === v && s.segTextOn]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {doubles && (
                <>
                  <FieldLabel>Seu parceiro</FieldLabel>
                  <SelectField title="Seu parceiro" placeholder="Escolha quem joga com você" value={myPartner} onChange={setMyPartner} options={pickable([myPlayerId, opponent.id, theirPartner])} />
                  <FieldLabel>Parceiro de {first}</FieldLabel>
                  <SelectField title={`Parceiro de ${first}`} placeholder={`Escolha quem joga com ${first}`} value={theirPartner} onChange={setTheirPartner} options={pickable([myPlayerId, opponent.id, myPartner])} />
                  <Hint>Só {first} responde ao desafio. Os parceiros veem o jogo na lista de desafios.</Hint>
                </>
              )}
              <FieldLabel>Mensagem (opcional)</FieldLabel>
              <AppInput value={message} onChangeText={t => setMessage(t.slice(0, CHALLENGE_MESSAGE_MAX))} placeholder="Ex.: Revanche do último jogo?" multiline />
              <Hint>{message.length}/{CHALLENGE_MESSAGE_MAX}</Hint>
              <FieldLabel>Quando (opcional)</FieldLabel>
              <AppInput value={when} onChangeText={t => setWhen(t.slice(0, CHALLENGE_WHEN_MAX))} placeholder="Ex.: sábado de manhã" />
              {dup && <Text style={s.warn}>Você já desafiou {first} e ainda não houve resposta.</Text>}
              {!!error && <Text style={s.error}>{error}</Text>}
              <View style={s.actions}>
                <TouchableOpacity style={s.ghost} onPress={close} activeOpacity={0.8}><Text style={s.ghostText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity
                  style={[s.primary, (busy || dup || !pairReady) && { opacity: 0.45 }]} disabled={busy || dup || !pairReady} onPress={send} activeOpacity={0.85}
                  accessibilityRole="button" accessibilityLabel={`Enviar desafio para ${first}`}
                >
                  <Text style={s.primaryText}>{busy ? 'Enviando…' : 'Enviar desafio'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: C.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.line, padding: Spacing.md, maxWidth: 480, width: '100%', alignSelf: 'center', gap: Spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 24, color: C.text },
  sub: { fontFamily: FontFamily.body, fontSize: 14, color: C.muted },
  done: { fontFamily: FontFamily.body, fontSize: 16, lineHeight: 23, color: C.text },
  seg: { flexDirection: 'row', backgroundColor: C.surf2, borderRadius: Radius.md, padding: 3, marginBottom: Spacing.xs },
  segBtn: { flex: 1, minHeight: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  segBtnOn: { backgroundColor: C.surf },
  segText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.muted },
  segTextOn: { color: C.gold },
  warn: { fontFamily: FontFamily.body, fontSize: 14, color: C.gold, marginTop: Spacing.sm },
  error: { fontFamily: FontFamily.body, fontSize: 14, color: C.coral, marginTop: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  ghost: { minHeight: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.muted },
  primary: { flex: 1, minHeight: 48, borderRadius: Radius.full, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: C.bg },
});
