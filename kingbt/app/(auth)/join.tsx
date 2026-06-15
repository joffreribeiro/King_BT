import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { useAuth, type UnlinkedPlayer } from '@/store/AuthContext';

type Mode = 'join' | 'create';
type LinkMode = 'ask' | 'search' | 'list';

export default function JoinGroupScreen() {
  const { user, group, loading, joinGroup, linkToPlayer, createGroup, logout, error, clearError } = useAuth();
  const router = useRouter();
  const [mode, setMode]   = useState<Mode>('join');
  const [code, setCode]   = useState('');
  const [name, setName]   = useState('');
  const [busy, setBusy]   = useState(false);

  // Modal de vínculo de perfil
  const [unlinked, setUnlinked]     = useState<UnlinkedPlayer[]>([]);
  const [showLink, setShowLink]     = useState(false);
  const [linkBusy, setLinkBusy]     = useState(false);
  const [linkMode, setLinkMode]     = useState<LinkMode>('ask');
  const [searchName, setSearchName] = useState('');
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (user && group) router.replace('/(app)');
  }, [loading, user, group]);

  async function handleJoin() {
    if (!code.trim()) return;
    setBusy(true);
    clearError();
    const result = await joinGroup(code.trim());
    setBusy(false);
    if (result.unlinkedPlayers.length > 0) {
      setUnlinked(result.unlinkedPlayers);
      setLinkMode('ask');
      setSearchName('');
      setSearchError('');
      setShowLink(true);
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    clearError();
    await createGroup(name.trim());
    setBusy(false);
  }

  async function handleLinkTo(playerId: string) {
    setLinkBusy(true);
    await linkToPlayer(playerId);
    setLinkBusy(false);
    setShowLink(false);
  }

  async function handleLinkByName() {
    const trimmed = searchName.trim().toLowerCase();
    if (!trimmed) return;
    const match = unlinked.find(p => p.name.trim().toLowerCase() === trimmed);
    if (!match) {
      setSearchError('Nenhum perfil encontrado com esse nome. Verifique a grafia ou crie um novo.');
      return;
    }
    setSearchError('');
    await handleLinkTo(match.id);
  }

  async function handleCreateNew() {
    if (!user || !group) return;
    setLinkBusy(true);
    try {
      const [{ doc, setDoc }, { db }] = await Promise.all([
        import('firebase/firestore'),
        import('@/firebase/config'),
      ]);
      await setDoc(doc(db, 'groups', group.id, 'players', user.uid), {
        name: user.displayName ?? 'Jogador',
        uid: user.uid,
        color: '#FFD166',
        guest: false,
      });
      await linkToPlayer(user.uid);
    } catch {}
    setLinkBusy(false);
    setShowLink(false);
  }

  function switchMode(m: Mode) {
    clearError();
    setCode('');
    setName('');
    setMode(m);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.center}>

          <View style={styles.top}>
            <Text style={styles.title}>
              {mode === 'join' ? 'Entrar no grupo' : 'Criar grupo'}
            </Text>
            <Text style={styles.subtitle}>
              Olá, {user?.displayName?.split(' ')[0]}!{'\n'}
              {mode === 'join'
                ? 'Insira o código do grupo para continuar.'
                : 'Digite o nome do seu novo grupo.'}
            </Text>
          </View>

          {/* Abas */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, mode === 'join' && styles.tabActive]}
              onPress={() => switchMode('join')}
            >
              <Text style={[styles.tabText, mode === 'join' && styles.tabTextActive]}>Entrar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'create' && styles.tabActive]}
              onPress={() => switchMode('create')}
            >
              <Text style={[styles.tabText, mode === 'create' && styles.tabTextActive]}>Criar grupo</Text>
            </TouchableOpacity>
          </View>

          {/* Erro */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Input entrar */}
          {mode === 'join' && (
            <>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={t => { setCode(t.toUpperCase()); clearError(); }}
                  placeholder="Código do grupo"
                  placeholderTextColor={Colors.faint}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                />
              </View>
              <TouchableOpacity
                style={[styles.btnPrimary, (!code.trim() || busy) && styles.btnDisabled]}
                onPress={handleJoin}
                disabled={!code.trim() || busy}
                activeOpacity={0.85}
              >
                {busy
                  ? <ActivityIndicator color={Colors.bg} />
                  : <><Text style={styles.btnIcon}>⚡</Text><Text style={styles.btnText}>Entrar no grupo</Text></>
                }
              </TouchableOpacity>
            </>
          )}

          {/* Input criar */}
          {mode === 'create' && (
            <>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.inputName}
                  value={name}
                  onChangeText={t => { setName(t); clearError(); }}
                  placeholder="Nome do grupo"
                  placeholderTextColor={Colors.faint}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoFocus
                />
              </View>
              {name.trim().length > 0 && (
                <View style={styles.codePreview}>
                  <Text style={styles.codePreviewLabel}>Código gerado:</Text>
                  <Text style={styles.codePreviewValue}>
                    {name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || '...'}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.btnPrimary, (!name.trim() || busy) && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={!name.trim() || busy}
                activeOpacity={0.85}
              >
                {busy
                  ? <ActivityIndicator color={Colors.bg} />
                  : <><Text style={styles.btnIcon}>🏆</Text><Text style={styles.btnText}>Criar grupo</Text></>
                }
              </TouchableOpacity>
            </>
          )}

          {/* Sair */}
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>

      {/* Modal: selecionar perfil existente */}
      <Modal visible={showLink} transparent animationType="slide" onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>

            {/* ── Pergunta inicial ── */}
            {linkMode === 'ask' && (
              <>
                <Text style={styles.modalTitle}>Você já está no grupo?</Text>
                <Text style={styles.modalSubtitle}>
                  Se você já jogou neste grupo antes, vincule seu perfil existente. Caso contrário, crie um novo.
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
                    : <Text style={styles.btnOutlineText}>+ Criar novo perfil</Text>
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
                  {unlinked.map(p => (
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
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  top: { gap: Spacing.sm, marginBottom: Spacing.sm },
  title: { fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted, lineHeight: 22 },

  tabBar: { flexDirection: 'row', backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: 3 },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.sm - 2 },
  tabActive: { backgroundColor: Colors.gold },
  tabText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  tabTextActive: { color: Colors.bg },

  errorBox: { backgroundColor: Colors.coral + '22', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.coral + '44' },
  errorText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral },

  inputWrap: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line },
  input: { fontFamily: FontFamily.numberBold, fontSize: 22, color: Colors.text, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, letterSpacing: 2, textAlign: 'center' },
  inputName: { fontFamily: FontFamily.body, fontSize: 18, color: Colors.text, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, textAlign: 'center' },

  codePreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.surf2, borderRadius: Radius.sm, padding: Spacing.sm },
  codePreviewLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  codePreviewValue: { fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.gold, letterSpacing: 2 },

  btnPrimary: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnIcon: { fontSize: 18 },
  btnText: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg },
  logoutBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  logoutText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.faint },

  backBtn: { paddingBottom: Spacing.xs },
  backText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.teal },
  linkText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.gold, textAlign: 'center' },

  searchInput: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: 16, color: Colors.text },

  // Modal
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
