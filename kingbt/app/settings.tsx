import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Card } from '@/components';
import { useAuth } from '@/store/AuthContext';
import { useSettings } from '@/store/SettingsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { removeGuestPlayer } from '@/firebase/groupPlayers';
import type { Format } from '@/logic/types';

const MAX_SCORE_OPTIONS = [4, 6, 7, 8, 10];

const FORMAT_OPTIONS: { key: Format | ''; label: string }[] = [
  { key: '', label: 'Nenhum' },
  { key: 'avulso', label: 'Avulso' },
  { key: 'liga', label: 'Liga' },
  { key: 'grupos', label: 'Grupos' },
  { key: 'mata', label: 'Mata-mata' },
  { key: 'super8', label: 'Super 8' },
];

const version = Constants.expoConfig?.version ?? '1.0.0';

export default function SettingsScreen() {
  const { group, isAdmin, leaveGroup, user } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const { defaultMaxScore, setDefaultMaxScore, defaultFormat, setDefaultFormat } = useSettings();

  async function handleShareInvite() {
    if (!group) return;
    const msg = `Entra no grupo "${group.name}" no King BT!\nCódigo: ${group.code}`;
    Share.share({ message: msg }).catch(() => {});
  }

  async function handleShareCode() {
    if (!group) return;
    Share.share({ message: group.code, title: 'Código do grupo King BT' }).catch(() => {});
  }

  function handleRemoveGuest(playerId: string, name: string) {
    if (!group) return;
    const doRemove = () => removeGuestPlayer(group.id, playerId);
    if (Platform.OS === 'web') {
      if (window.confirm(`Remover ${name} do grupo?`)) doRemove();
    } else {
      Alert.alert('Remover convidado', `Remover ${name} do grupo?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: doRemove },
      ]);
    }
  }

  function handleLeaveGroup() {
    const doLeave = async () => {
      await leaveGroup();
      router.replace('/(auth)/join');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Sair do grupo atual?')) doLeave();
    } else {
      Alert.alert('Sair do grupo', 'Você poderá entrar em outro grupo.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: doLeave },
      ]);
    }
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/profile')}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Configurações</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Versão */}
        <Card style={s.versionCard}>
          <Text style={s.versionLabel}>KING BT</Text>
          <Text style={s.versionNum}>v{version}</Text>
          <Text style={s.versionSub}>Beach Tennis Tournament Manager</Text>
        </Card>

        {/* Placar padrão */}
        <View>
          <Text style={s.sectionTitle}>Placar padrão</Text>
          <Text style={s.sectionHint}>Pontuação máxima exibida nos atalhos rápidos do modal de placar</Text>
          <View style={s.chipRow}>
            {MAX_SCORE_OPTIONS.map(v => (
              <TouchableOpacity
                key={v}
                style={[s.chip, defaultMaxScore === v && s.chipActive]}
                onPress={() => setDefaultMaxScore(v)}
              >
                <Text style={[s.chipText, defaultMaxScore === v && s.chipTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Formato favorito */}
        <View>
          <Text style={s.sectionTitle}>Formato favorito</Text>
          <Text style={s.sectionHint}>Pré-selecionado ao criar nova competição</Text>
          <View style={s.chipRow}>
            {FORMAT_OPTIONS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[s.chip, defaultFormat === f.key && s.chipActive]}
                onPress={() => setDefaultFormat(f.key)}
              >
                <Text style={[s.chipText, defaultFormat === f.key && s.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tema */}
        <View>
          <Text style={s.sectionTitle}>Tema</Text>
          <Card style={s.themeCard}>
            <View style={[s.themeRow, s.themeRowActive]}>
              <Text style={s.themeLabel}>🌙 Escuro</Text>
              <View style={s.themeCheck}><Text style={s.themeCheckMark}>✓</Text></View>
            </View>
            <View style={[s.themeRow, { opacity: 0.45 }]}>
              <Text style={s.themeLabel}>☀️ Claro</Text>
              <View style={s.themeSoon}><Text style={s.themeSoonText}>em breve</Text></View>
            </View>
          </Card>
        </View>

        {/* Grupo */}
        {group && (
          <View>
            <Text style={s.sectionTitle}>Grupo</Text>
            <Card style={s.groupCard}>
              <Text style={s.groupName}>{group.name}</Text>
              <View style={s.codeRow}>
                <Text style={s.codeLabel}>Código</Text>
                <Text style={s.code}>{group.code}</Text>
                <TouchableOpacity style={s.codeShareBtn} onPress={handleShareCode}>
                  <Text style={s.codeShareText}>Copiar</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.inviteBtn} onPress={handleShareInvite}>
                <Text style={s.inviteBtnText}>🔗 Convidar para o grupo</Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}

        {/* Admin — Jogadores */}
        {isAdmin && group && (
          <View>
            <Text style={s.sectionTitle}>Jogadores do grupo</Text>
            <Card padding={0} style={{ overflow: 'hidden' }}>
              {groupPlayers.length === 0 && (
                <Text style={s.emptyPlayers}>Nenhum jogador cadastrado.</Text>
              )}
              {groupPlayers.map((p, i) => (
                <View key={p.id} style={[s.playerRow, i < groupPlayers.length - 1 && s.playerBorder]}>
                  <View style={[s.playerDot, { backgroundColor: p.color }]} />
                  <Text style={s.playerName} numberOfLines={1}>{p.name}</Text>
                  <View style={p.guest ? s.guestBadge : s.memberBadge}>
                    <Text style={p.guest ? s.guestText : s.memberText}>
                      {p.guest ? 'convidado' : 'membro'}
                    </Text>
                  </View>
                  {p.guest && (
                    <TouchableOpacity onPress={() => handleRemoveGuest(p.id, p.name)} hitSlop={8}>
                      <Text style={s.removeBtn}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Admin — Zona de perigo */}
        {isAdmin && (
          <View>
            <Text style={[s.sectionTitle, { color: Colors.coral }]}>Zona de perigo</Text>
            <Card style={s.dangerCard}>
              <Text style={s.dangerHint}>Ações irreversíveis. Use com cautela.</Text>
              <TouchableOpacity style={s.dangerBtn} onPress={handleLeaveGroup}>
                <Text style={s.dangerBtnText}>🚪 Sair do grupo</Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}

        {/* Conta */}
        {!isAdmin && (
          <View>
            <Text style={s.sectionTitle}>Conta</Text>
            <Card>
              <Text style={s.accountEmail}>{user?.email ?? user?.displayName ?? '—'}</Text>
              <TouchableOpacity style={s.leaveBtn} onPress={handleLeaveGroup}>
                <Text style={s.leaveBtnText}>Sair do grupo</Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  scroll: { padding: Spacing.md, gap: Spacing.lg },

  versionCard: { alignItems: 'center', gap: 4, paddingVertical: Spacing.lg },
  versionLabel: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.faint, letterSpacing: 2 },
  versionNum: { fontFamily: FontFamily.titleBold, fontSize: 40, color: Colors.gold },
  versionSub: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },

  sectionTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text, marginBottom: 4 },
  sectionHint: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginBottom: Spacing.sm },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full, backgroundColor: Colors.surf2,
    borderWidth: 1, borderColor: Colors.line,
  },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  chipText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  chipTextActive: { color: Colors.gold },

  themeCard: { gap: Spacing.xs },
  themeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, borderRadius: Radius.sm },
  themeRowActive: { backgroundColor: Colors.surf2 },
  themeLabel: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  themeCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.gold + '22', borderWidth: 1.5, borderColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  themeCheckMark: { fontFamily: FontFamily.numberBold, fontSize: 12, color: Colors.gold },
  themeSoon: { backgroundColor: Colors.surf2, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  themeSoonText: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },

  groupCard: { gap: Spacing.sm },
  groupName: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  codeLabel: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  code: { flex: 1, fontFamily: FontFamily.numberBold, fontSize: 22, color: Colors.teal, letterSpacing: 3 },
  codeShareBtn: { backgroundColor: Colors.teal + '22', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.teal + '44' },
  codeShareText: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.teal },
  inviteBtn: { backgroundColor: Colors.surf2, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.line },
  inviteBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },

  emptyPlayers: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center', padding: Spacing.md },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  playerBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  playerDot: { width: 10, height: 10, borderRadius: 5 },
  playerName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  guestBadge: { backgroundColor: Colors.gold + '22', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  guestText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold },
  memberBadge: { backgroundColor: Colors.teal + '22', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  memberText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.teal },
  removeBtn: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.coral, lineHeight: 20, paddingHorizontal: 4 },

  dangerCard: { gap: Spacing.sm },
  dangerHint: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  dangerBtn: { borderWidth: 1, borderColor: Colors.coral + '66', borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  dangerBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.coral },

  accountEmail: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', marginBottom: Spacing.sm },
  leaveBtn: { borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  leaveBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
});
