import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import type { Group, UnlinkedPlayer } from '@/store/AuthContext';
import { LinkPlayerModal } from '@/components/LinkPlayerModal';

type Mode = 'list' | 'join' | 'create';

export default function GroupsScreen() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { user, group: currentGroup, loading, joinGroup, createGroup, switchGroup, getMyGroups, clearError, error } = useAuth();
  const router = useRouter();
  const [mode, setMode]         = useState<Mode>('list');
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [code, setCode]         = useState('');
  const [name, setName]         = useState('');
  const [busy, setBusy]         = useState(false);

  // Modal de vínculo de perfil — só aparece ao entrar num grupo novo por código
  const [unlinked, setUnlinked] = useState<UnlinkedPlayer[]>([]);
  const [showLink, setShowLink] = useState(false);

  // Grupos públicos que o usuário pode visitar (somente leitura)
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [visitBusy, setVisitBusy] = useState(false);

  useEffect(() => {
    loadGroups();
    loadPublicGroups();
  }, []);

  async function loadGroups() {
    setLoadingGroups(true);
    const groups = await getMyGroups();
    setMyGroups(groups);
    setLoadingGroups(false);
  }

  async function loadPublicGroups() {
    setLoadingPublic(true);
    try {
      const [{ collection, query, where, limit, getDocs }, myIds] = await Promise.all([
        import('firebase/firestore'),
        getMyGroups().then(gs => gs.map(g => g.id)),
      ]);
      const { db } = await import('@/firebase/config');
      const snap = await getDocs(query(collection(db, 'groups'), where('visibility', '==', 'publico'), limit(20)));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Group);
      setPublicGroups(all.filter(g => !myIds.includes(g.id)));
    } catch {
      setPublicGroups([]);
    }
    setLoadingPublic(false);
  }

  async function handleVisit(groupId: string) {
    setVisitBusy(true);
    await switchGroup(groupId);
    setVisitBusy(false);
    router.replace('/(app)');
  }

  async function handleSwitch(groupId: string) {
    // Grupo já ativo — entra direto, sem gravar nada
    if (currentGroup?.id === groupId) {
      router.replace('/(app)');
      return;
    }
    setBusy(true);
    await switchGroup(groupId);
    setBusy(false);
    router.replace('/(app)');
  }

  async function handleJoin() {
    if (!code.trim()) return;
    setBusy(true);
    clearError();
    const result = await joinGroup(code.trim());
    setBusy(false);
    if (result.needsLink) {
      setUnlinked(result.unlinkedPlayers);
      setShowLink(true);
      return;
    }
    router.replace('/(app)');
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    clearError();
    await createGroup(name.trim());
    setBusy(false);
    router.replace('/(app)');
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

        {/* Header — botão voltar só quando veio de dentro do app */}
        <View style={styles.header}>
          {router.canGoBack() && (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Escolha seu grupo</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Erro */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Lista de grupos */}
          {mode === 'list' && (
            <>
              {loadingGroups ? (
                <ActivityIndicator color={Colors.gold} style={{ marginTop: Spacing.xl }} />
              ) : (
                <>
                  {myGroups.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Seus grupos</Text>
                      {myGroups.map(g => (
                        <TouchableOpacity
                          key={g.id}
                          style={[styles.groupCard, currentGroup?.id === g.id && styles.groupCardActive]}
                          onPress={() => handleSwitch(g.id)}
                          disabled={busy}
                          activeOpacity={0.8}
                        >
                          <View style={styles.groupCardInfo}>
                            <Text style={styles.groupCardName}>{g.name}</Text>
                            <Text style={styles.groupCardCode}>{g.code}</Text>
                          </View>
                          {currentGroup?.id === g.id && <Text style={styles.activeBadge}>Ativo</Text>}
                          <Text style={styles.groupCardArrow}>›</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Outras opções</Text>
                    <TouchableOpacity style={styles.optionBtn} onPress={() => switchMode('join')} activeOpacity={0.8}>
                      <Text style={styles.optionIcon}>🔑</Text>
                      <View style={styles.optionInfo}>
                        <Text style={styles.optionTitle}>Entrar com código</Text>
                        <Text style={styles.optionDesc}>Tem um convite? Digite o código</Text>
                      </View>
                      <Text style={styles.groupCardArrow}>›</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.optionBtn} onPress={() => switchMode('create')} activeOpacity={0.8}>
                      <Text style={styles.optionIcon}>➕</Text>
                      <View style={styles.optionInfo}>
                        <Text style={styles.optionTitle}>Criar novo grupo</Text>
                        <Text style={styles.optionDesc}>Comece seu próprio grupo</Text>
                      </View>
                      <Text style={styles.groupCardArrow}>›</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Explorar grupos públicos */}
                  {!loadingPublic && publicGroups.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Explorar grupos públicos</Text>
                      {publicGroups.map(g => (
                        <TouchableOpacity
                          key={g.id}
                          style={styles.groupCard}
                          onPress={() => handleVisit(g.id)}
                          disabled={visitBusy}
                          activeOpacity={0.8}
                        >
                          <View style={styles.groupCardInfo}>
                            <Text style={styles.groupCardName}>{g.name}</Text>
                            <Text style={styles.groupCardCode}>🌍 Público</Text>
                          </View>
                          <Text style={styles.visitBadge}>👁 Visitar</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {/* Entrar com código */}
          {mode === 'join' && (
            <View style={styles.formSection}>
              <TouchableOpacity onPress={() => switchMode('list')} style={styles.backLink}>
                <Text style={styles.backLinkText}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={styles.formTitle}>Entrar com código</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={t => { setCode(t.toUpperCase()); clearError(); }}
                  placeholder="Ex: KINGBT"
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
                {busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.btnText}>Entrar no grupo</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Criar grupo */}
          {mode === 'create' && (
            <View style={styles.formSection}>
              <TouchableOpacity onPress={() => switchMode('list')} style={styles.backLink}>
                <Text style={styles.backLinkText}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={styles.formTitle}>Criar novo grupo</Text>
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
                {busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.btnText}>Criar grupo</Text>}
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <LinkPlayerModal
        visible={showLink}
        unlinkedPlayers={unlinked}
        onDone={() => { setShowLink(false); router.replace('/(app)'); }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, lineHeight: 24 },
  headerTitle: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.text },
  scroll: { padding: Spacing.md, gap: Spacing.md },

  errorBox: { backgroundColor: Colors.coral + '22', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.coral + '44' },
  errorText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral },

  section: { gap: Spacing.sm },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted, letterSpacing: 1, marginBottom: Spacing.xs },

  groupCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, padding: Spacing.md },
  groupCardActive: { borderColor: Colors.gold, backgroundColor: Colors.surf2 },
  groupCardInfo: { flex: 1, gap: 2 },
  groupCardName: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  groupCardCode: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted, letterSpacing: 1 },
  groupCardArrow: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.faint },
  activeBadge: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.gold, backgroundColor: Colors.gold + '22', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  visitBadge: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.teal, backgroundColor: Colors.teal + '22', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },

  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, padding: Spacing.md },
  optionIcon: { fontSize: 22 },
  optionInfo: { flex: 1, gap: 2 },
  optionTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text },
  optionDesc: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },

  formSection: { gap: Spacing.md },
  backLink: { paddingBottom: Spacing.xs },
  backLinkText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.teal },
  formTitle: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.text },

  inputWrap: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line },
  input: { fontFamily: FontFamily.numberBold, fontSize: 22, color: Colors.text, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, letterSpacing: 2, textAlign: 'center' },
  inputName: { fontFamily: FontFamily.body, fontSize: 18, color: Colors.text, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, textAlign: 'center' },

  codePreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.surf2, borderRadius: Radius.sm, padding: Spacing.sm },
  codePreviewLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  codePreviewValue: { fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.gold, letterSpacing: 2 },

  btnPrimary: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnText: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg },
});
