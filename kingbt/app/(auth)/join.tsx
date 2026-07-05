import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth, type UnlinkedPlayer } from '@/store/AuthContext';
import { LinkPlayerModal } from '@/components/LinkPlayerModal';

type Mode = 'join' | 'create';

export default function JoinGroupScreen() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { user, group, loading, myPlayerId, joinGroup, createGroup, logout, error, clearError } = useAuth();
  const router = useRouter();
  const [mode, setMode]   = useState<Mode>('join');
  const [code, setCode]   = useState('');
  const [name, setName]   = useState('');
  const [busy, setBusy]   = useState(false);

  // Modal de vínculo de perfil
  const [unlinked, setUnlinked] = useState<UnlinkedPlayer[]>([]);
  const [showLink, setShowLink] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && group && myPlayerId !== null && !showLink) {
      router.replace('/(app)');
    }
  }, [loading, user, group, myPlayerId, showLink]);

  async function handleJoin() {
    if (!code.trim()) return;
    setBusy(true);
    clearError();
    const result = await joinGroup(code.trim());
    setBusy(false);
    if (result.needsLink) {
      setUnlinked(result.unlinkedPlayers);
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

      <LinkPlayerModal
        visible={showLink}
        unlinkedPlayers={unlinked}
        onDone={() => setShowLink(false)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
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
});
