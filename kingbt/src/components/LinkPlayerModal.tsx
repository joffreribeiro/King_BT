import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Modal,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { useAuth, type UnlinkedPlayer } from '@/store/AuthContext';

type LinkMode = 'ask' | 'search' | 'list' | 'create';

/**
 * Modal de vínculo de perfil ao entrar num grupo novo:
 * pergunta se já jogou no grupo, permite buscar/escolher um perfil
 * existente sem dono ou criar um perfil novo vinculado ao uid.
 * Usado no fluxo de join (join.tsx) e na tela de escolha de grupos.
 */
export function LinkPlayerModal({ visible, unlinkedPlayers, onDone }: {
  visible: boolean;
  unlinkedPlayers: UnlinkedPlayer[];
  onDone: () => void;
}) {
  const { user, group, linkToPlayer } = useAuth();
  const [linkBusy, setLinkBusy]     = useState(false);
  const [linkMode, setLinkMode]     = useState<LinkMode>('ask');
  const [searchName, setSearchName] = useState('');
  const [searchError, setSearchError] = useState('');
  const [newProfileName, setNewProfileName] = useState('');

  // Reinicia o fluxo sempre que o modal abre
  useEffect(() => {
    if (visible) {
      setLinkMode('ask');
      setSearchName('');
      setSearchError('');
      setNewProfileName('');
    }
  }, [visible]);

  async function handleLinkTo(playerId: string) {
    setLinkBusy(true);
    await linkToPlayer(playerId);
    setLinkBusy(false);
    onDone();
  }

  async function handleLinkByName() {
    const trimmed = searchName.trim().toLowerCase();
    if (!trimmed) return;
    const match = unlinkedPlayers.find(p => p.name.trim().toLowerCase() === trimmed);
    if (!match) {
      setSearchError('Nenhum perfil encontrado com esse nome. Verifique a grafia ou crie um novo.');
      return;
    }
    setSearchError('');
    await handleLinkTo(match.id);
  }

  async function handleCreateNew() {
    if (!user || !group) return;
    const profileName = newProfileName.trim() || user.displayName || 'Jogador';
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
                style={styles.btnOutline}
                onPress={() => { setNewProfileName(''); setLinkMode('create'); }}
                activeOpacity={0.8}
              >
                <Text style={styles.btnOutlineText}>+ Não, criar novo perfil</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Criar novo perfil ── */}
          {linkMode === 'create' && (
            <>
              <TouchableOpacity onPress={() => setLinkMode('ask')} style={styles.backBtn}>
                <Text style={styles.backText}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Como você quer ser chamado?</Text>
              <Text style={styles.modalSubtitle}>
                Digite o nome que vai aparecer no ranking e nas competições.
              </Text>

              <TextInput
                style={styles.searchInput}
                value={newProfileName}
                onChangeText={setNewProfileName}
                placeholder="Seu nome no grupo"
                placeholderTextColor={Colors.faint}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.btnPrimary, (!newProfileName.trim() || linkBusy) && styles.btnDisabled]}
                onPress={handleCreateNew}
                disabled={!newProfileName.trim() || linkBusy}
                activeOpacity={0.85}
              >
                {linkBusy
                  ? <ActivityIndicator color={Colors.bg} />
                  : <Text style={styles.btnText}>Criar perfil</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {/* ── Busca por nome ── */}
          {linkMode === 'search' && (
            <>
              <TouchableOpacity onPress={() => { setLinkMode('ask'); setSearchName(''); setSearchError(''); }} style={styles.backBtn}>
                <Text style={styles.backText}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Qual é o seu nome no grupo?</Text>
              <Text style={styles.modalSubtitle}>
                Digite seu nome exatamente como aparece no grupo.
              </Text>

              <TextInput
                style={styles.searchInput}
                value={searchName}
                onChangeText={t => { setSearchName(t); setSearchError(''); }}
                placeholder="Seu nome no grupo"
                placeholderTextColor={Colors.faint}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
              />

              {searchError !== '' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{searchError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.btnPrimary, (!searchName.trim() || linkBusy) && styles.btnDisabled]}
                onPress={handleLinkByName}
                disabled={!searchName.trim() || linkBusy}
                activeOpacity={0.85}
              >
                {linkBusy
                  ? <ActivityIndicator color={Colors.bg} />
                  : <Text style={styles.btnText}>Vincular perfil</Text>
                }
              </TouchableOpacity>

              <View style={styles.modalDivider} />

              <TouchableOpacity onPress={() => setLinkMode('list')} activeOpacity={0.7}>
                <Text style={styles.linkText}>Ver todos os perfis disponíveis</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Lista completa ── */}
          {linkMode === 'list' && (
            <>
              <TouchableOpacity onPress={() => setLinkMode('search')} style={styles.backBtn}>
                <Text style={styles.backText}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Selecione seu perfil</Text>

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {unlinkedPlayers.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.playerRow}
                    onPress={() => handleLinkTo(p.id)}
                    disabled={linkBusy}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.playerDot, { backgroundColor: p.color }]} />
                    <Text style={styles.playerName}>{p.name}</Text>
                    <Text style={styles.playerArrow}>→</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  errorBox: { backgroundColor: Colors.coral + '22', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.coral + '44' },
  errorText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral },

  btnPrimary: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnText: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg },

  backBtn: { paddingBottom: Spacing.xs },
  backText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.teal },
  linkText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.gold, textAlign: 'center' },

  searchInput: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: 16, color: Colors.text },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  modalTitle: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.text },
  modalSubtitle: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, lineHeight: 20 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.line },
  playerDot: { width: 14, height: 14, borderRadius: 7 },
  playerName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 16, color: Colors.text },
  playerArrow: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.gold },
  modalDivider: { height: 1, backgroundColor: Colors.line },
  btnOutline: { borderWidth: 1.5, borderColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  btnOutlineText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.gold },
});
