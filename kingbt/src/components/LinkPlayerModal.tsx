import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useState, useEffect, useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useAuth, type UnlinkedPlayer } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';

type LinkMode = 'ask' | 'search';

/**
 * Modal de vínculo de perfil ao entrar num grupo novo:
 * pergunta se já jogou no grupo, permite buscar/escolher um perfil
 * existente sem dono ou criar um perfil novo vinculado ao uid (usando
 * direto o nome de perfil global — mesmo nome em todos os grupos).
 * Usado no fluxo de join (join.tsx) e na tela de escolha de grupos.
 */
export function LinkPlayerModal({ visible, unlinkedPlayers, onDone }: {
  visible: boolean;
  unlinkedPlayers: UnlinkedPlayer[];
  onDone: () => void;
}) {
  const { user, group, linkToPlayer } = useAuth();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const [linkBusy, setLinkBusy]     = useState(false);
  const [linkMode, setLinkMode]     = useState<LinkMode>('ask');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  // Reinicia o fluxo sempre que o modal abre
  useEffect(() => {
    if (visible) {
      setLinkMode('ask');
      setSelectedPlayerId('');
    }
  }, [visible]);

  async function handleLinkTo(playerId: string) {
    setLinkBusy(true);
    await linkToPlayer(playerId);
    setLinkBusy(false);
    onDone();
  }

  async function handleLinkSelected() {
    if (!selectedPlayerId) return;
    await handleLinkTo(selectedPlayerId);
  }

  async function handleCreateNew() {
    if (!user || !group) return;
    const profileName = user.displayName?.trim() || 'Jogador';
    setLinkBusy(true);
    try {
      const [{ doc, setDoc }, { db }] = await Promise.all([
        import('firebase/firestore'),
        import('@/firebase/config'),
      ]);
      await setDoc(doc(db, 'groups', group.id, 'players', user.uid), {
        name: profileName,
        uid: user.uid,
        color: '#FFD166',
        guest: false,
      });
      await linkToPlayer(user.uid);
    } catch {}
    setLinkBusy(false);
    onDone();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>

          {/* ── Pergunta inicial ── */}
          {linkMode === 'ask' && (
            <>
              <Text style={styles.modalTitle}>Você já jogou neste grupo?</Text>
              <Text style={styles.modalSubtitle}>
                Se já jogou antes, vincule seu perfil existente. Caso contrário, crie um novo.
              </Text>

              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => setLinkMode('search')}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>✅  Sim, já tenho perfil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnOutline, linkBusy && styles.btnDisabled]}
                onPress={handleCreateNew}
                disabled={linkBusy}
                activeOpacity={0.8}
              >
                {linkBusy
                  ? <ActivityIndicator color={Colors.gold} />
                  : <Text style={styles.btnOutlineText}>+ Não, criar novo perfil ({user?.displayName ?? 'Jogador'})</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* ── Seleção de perfil ── */}
          {linkMode === 'search' && (
            <>
              <TouchableOpacity onPress={() => { setLinkMode('ask'); setSelectedPlayerId(''); }} style={styles.backBtn}>
                <Text style={styles.backText}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Selecione seu perfil</Text>
              <Text style={styles.modalSubtitle}>
                Escolha na lista abaixo o perfil que você deseja vincular.
              </Text>

              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedPlayerId}
                  onValueChange={setSelectedPlayerId}
                  style={styles.picker}
                  itemStyle={{ color: Colors.text }}
                >
                  <Picker.Item label="Escolha um perfil..." value="" />
                  {unlinkedPlayers.map(p => (
                    <Picker.Item key={p.id} label={p.name} value={p.id} />
                  ))}
                </Picker>
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, (!selectedPlayerId || linkBusy) && styles.btnDisabled]}
                onPress={handleLinkSelected}
                disabled={!selectedPlayerId || linkBusy}
                activeOpacity={0.85}
              >
                {linkBusy
                  ? <ActivityIndicator color={Colors.bg} />
                  : <Text style={styles.btnText}>Vincular perfil</Text>
                }
              </TouchableOpacity>
            </>
          )}


        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  btnPrimary: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnText: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg },

  backBtn: { paddingBottom: Spacing.xs },
  backText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.teal },

  pickerContainer: { backgroundColor: Colors.surf2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, overflow: 'hidden' },
  picker: { height: 180 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  modalTitle: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.text },
  modalSubtitle: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, lineHeight: 20 },
  btnOutline: { borderWidth: 1.5, borderColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  btnOutlineText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.gold },
});
