import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { useAuth } from '@/store/AuthContext';

export default function LoginScreen() {
  const { signInWithGoogle, joinGroup, user, group, loading, error, clearError } = useAuth();
  const [code, setCode]           = useState('');
  const [loadingCode, setLoadingCode]   = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  // Se já autenticado com grupo → vai para o app
  if (!loading && user && group) {
    router.replace('/(app)');
    return null;
  }

  async function handleGoogle() {
    setLoadingGoogle(true);
    await signInWithGoogle();
    setLoadingGoogle(false);
  }

  async function handleJoinGroup() {
    if (!code.trim()) return;
    setLoadingCode(true);
    clearError();
    if (!user) {
      // Login anônimo via Google primeiro
      await signInWithGoogle();
    }
    await joinGroup(code.trim());
    setLoadingCode(false);
  }

  const groupName = code.toUpperCase() === 'KINGS-2026' ? 'BT na Quadra'
    : code.toUpperCase() === 'KINGBT' ? 'King BT'
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image source={require('../../assets/kingbt-logo.png')} style={styles.logo} resizeMode="contain" />
          </View>

          {/* Formulário */}
          <View style={styles.form}>

            {/* Erro */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Campo código */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Código do grupo</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={t => { setCode(t.toUpperCase()); clearError(); }}
                  placeholder="Ex: KINGS-2026"
                  placeholderTextColor={Colors.faint}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                {groupName && (
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>{groupName}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Botão entrar no grupo */}
            <TouchableOpacity
              style={[styles.btnPrimary, (!code.trim() || loadingCode) && styles.btnDisabled]}
              onPress={handleJoinGroup}
              activeOpacity={0.85}
              disabled={!code.trim() || loadingCode}
            >
              {loadingCode
                ? <ActivityIndicator color={Colors.bg} />
                : <>
                    <Text style={styles.btnPrimaryIcon}>⚡</Text>
                    <Text style={styles.btnPrimaryText}>Entrar no grupo</Text>
                  </>
              }
            </TouchableOpacity>

            {/* Separador */}
            <View style={styles.separator}>
              <View style={styles.sepLine} />
              <Text style={styles.sepText}>ou</Text>
              <View style={styles.sepLine} />
            </View>

            {/* Botão Google */}
            <TouchableOpacity
              style={[styles.btnGoogle, loadingGoogle && styles.btnDisabled]}
              onPress={handleGoogle}
              activeOpacity={0.85}
              disabled={loadingGoogle}
            >
              {loadingGoogle
                ? <ActivityIndicator color={Colors.text} />
                : <>
                    <Text style={styles.googleG}>G</Text>
                    <Text style={styles.btnGoogleText}>Continuar com Google</Text>
                  </>
              }
            </TouchableOpacity>

            {/* Info pós-Google */}
            {user && !group && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  ✓ Logado como {user.displayName}. Agora insira o código do grupo.
                </Text>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  logoWrap: { alignItems: 'center', paddingTop: Spacing.lg },
  logo: { width: 280, height: 280 },
  form: { gap: Spacing.md, paddingTop: Spacing.lg },
  errorBox: { backgroundColor: Colors.coral + '22', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.coral + '44' },
  errorText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral },
  inputGroup: { gap: Spacing.xs },
  inputLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, paddingLeft: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, overflow: 'hidden' },
  input: { flex: 1, fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.text, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, letterSpacing: 1 },
  groupBadge: { backgroundColor: Colors.teal + '22', borderLeftWidth: 1, borderLeftColor: Colors.teal + '44', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, marginRight: 2, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', maxWidth: 90 },
  groupBadgeText: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.teal, textAlign: 'center' },
  btnPrimary: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 52 },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnPrimaryIcon: { fontSize: 18 },
  btnPrimaryText: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg },
  separator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.xs },
  sepLine: { flex: 1, height: 1, backgroundColor: Colors.line },
  sepText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint },
  btnGoogle: { borderWidth: 1.5, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.surf, minHeight: 52 },
  googleG: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  btnGoogleText: { fontFamily: FontFamily.bodyMed, fontSize: 16, color: Colors.text },
  infoBox: { backgroundColor: Colors.teal + '22', borderRadius: Radius.sm, padding: Spacing.sm },
  infoText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.teal },
});
