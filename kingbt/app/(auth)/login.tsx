import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';

const GROUP_CODES: Record<string, string> = {
  'KINGS-2026': 'BT na Quadra',
  'KINGBT': 'King BT',
};

export default function LoginScreen() {
  const [code, setCode] = useState('');
  const groupName = GROUP_CODES[code.toUpperCase()] ?? null;

  function handleEnterGroup() {
    if (!groupName) return;
    router.replace('/(app)');
  }

  function handleGoogle() {
    router.replace('/(app)');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/kingbt-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Formulário */}
          <View style={styles.form}>
            {/* Campo código do grupo */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Código do grupo</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={t => setCode(t.toUpperCase())}
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
              style={[styles.btnPrimary, !groupName && styles.btnDisabled]}
              onPress={handleEnterGroup}
              activeOpacity={0.85}
              disabled={!groupName}
            >
              <Text style={styles.btnPrimaryIcon}>⚡</Text>
              <Text style={styles.btnPrimaryText}>Entrar no grupo</Text>
            </TouchableOpacity>

            {/* Separador */}
            <View style={styles.separator}>
              <View style={styles.sepLine} />
              <Text style={styles.sepText}>ou</Text>
              <View style={styles.sepLine} />
            </View>

            {/* Botão Google */}
            <TouchableOpacity
              style={styles.btnGoogle}
              onPress={handleGoogle}
              activeOpacity={0.85}
            >
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.btnGoogleText}>Continuar com Google</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
  },
  logo: {
    width: 280,
    height: 280,
  },

  // Form
  form: {
    gap: Spacing.md,
    paddingTop: Spacing.lg,
  },

  // Input código
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.muted,
    paddingLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surf,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.line,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.numberBold,
    fontSize: 18,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    letterSpacing: 1,
  },
  groupBadge: {
    backgroundColor: Colors.teal + '22',
    borderLeftWidth: 1,
    borderLeftColor: Colors.teal + '44',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginRight: 2,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 90,
  },
  groupBadgeText: {
    fontFamily: FontFamily.bodyMed,
    fontSize: 11,
    color: Colors.teal,
    textAlign: 'center',
  },

  // Botão principal
  btnPrimary: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  btnDisabled: {
    backgroundColor: Colors.surf2,
  },
  btnPrimaryIcon: {
    fontSize: 18,
  },
  btnPrimaryText: {
    fontFamily: FontFamily.title,
    fontSize: 17,
    color: Colors.bg,
  },

  // Separador
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  sepLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.line,
  },
  sepText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.faint,
  },

  // Botão Google
  btnGoogle: {
    borderWidth: 1.5,
    borderColor: Colors.line,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surf,
  },
  googleG: {
    fontFamily: FontFamily.titleBold,
    fontSize: 18,
    color: Colors.text,
  },
  btnGoogleText: {
    fontFamily: FontFamily.bodyMed,
    fontSize: 16,
    color: Colors.text,
  },
});
