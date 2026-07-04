import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert, Platform, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { useAuth } from '@/store/AuthContext';
import { useSettings } from '@/store/SettingsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { addGuestPlayer, removeGuestPlayer, updatePlayerHandicap, deleteGroup } from '@/firebase/groupPlayers';
import type { Format } from '@/logic/types';

const GUEST_COLORS = ['#FFD166', '#2DD4BF', '#A78BFA', '#34D399', '#F472B6', '#94A3B8', '#FB923C', '#60A5FA'];

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
  const { group, isAdmin, leaveGroup, user, removeFromGroup, promoteToAdmin, setGroupVisibility } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const [activeTab, setActiveTab] = useState<'geral' | 'admin'>('geral');
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [guestName, setGuestName]       = useState('');
  const [guestColor, setGuestColor]     = useState(GUEST_COLORS[0]);
  const [copied, setCopied]             = useState<'code' | 'invite' | null>(null);

  async function handleAddGuest() {
    if (!guestName.trim() || !group) return;
    await addGuestPlayer(group.id, guestName.trim(), guestColor);
    setGuestName(''); setGuestColor(GUEST_COLORS[0]); setShowAddGuest(false);
  }
  const { defaultMaxScore, setDefaultMaxScore, defaultFormat, setDefaultFormat } = useSettings();

  // Na web o Share.share abre o painel de compartilhamento do sistema, que
  // falha no desktop ("Não foi possível mostrar todas as maneiras de
  // compartilhar") — então copiamos para a área de transferência.
  async function shareOrCopy(msg: string, which: 'code' | 'invite') {
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(msg);
        setCopied(which);
        setTimeout(() => setCopied(null), 2500);
      } catch {
        window.prompt('Copie o convite:', msg);
      }
    } else {
      Share.share({ message: msg }).catch(() => {});
    }
  }

  async function handleShareInvite() {
    if (!group) return;
    await shareOrCopy(`Entra no grupo "${group.name}" no King BT!\nCódigo: ${group.code}`, 'invite');
  }

  async function handleShareCode() {
    if (!group) return;
    await shareOrCopy(group.code, 'code');
  }

  function handleRemovePlayer(playerId: string, playerUid: string | null | undefined, name: string) {
    if (!group) return;
    if (playerUid && playerUid === user?.uid) {
      Alert.alert('Ação inválida', 'Você não pode remover a si mesmo do grupo.');
      return;
    }
    const doRemove = async () => {
      await removeGuestPlayer(group.id, playerId);
      if (playerUid) await removeFromGroup(playerUid);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remover ${name} do grupo?`)) doRemove();
    } else {
      Alert.alert('Remover jogador', `Remover ${name} do grupo?\n\nEle não poderá mais ver as competições.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: doRemove },
      ]);
    }
  }

  function handlePromoteToAdmin(playerUid: string, name: string) {
    const doPr = () => promoteToAdmin(playerUid);
    if (Platform.OS === 'web') {
      if (window.confirm(`Promover ${name} a admin?`)) doPr();
    } else {
      Alert.alert('Promover a admin', `${name} terá acesso completo ao grupo.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Promover', onPress: doPr },
      ]);
    }
  }

  function handleDeleteGroup() {
    if (!group) return;
    const doDelete = async () => {
      await deleteGroup(group.id);
      await leaveGroup();
      router.replace('/(auth)/join');
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`EXCLUIR "${group.name}"? Isso apaga o grupo e TODAS as competições permanentemente.`)) doDelete();
    } else {
      Alert.alert(
        'EXCLUIR GRUPO',
        `Isso apaga "${group.name}" e TODAS as competições permanentemente. Ação irreversível.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir tudo', style: 'destructive', onPress: doDelete },
        ]
      );
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

      {/* Tab bar — só aparece para admin */}
      {isAdmin && (
        <View style={s.tabBar}>
          {(['geral', 'admin'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tabItem, activeTab === tab && s.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[s.tabLabel, activeTab === tab && s.tabLabelActive]}>
                {tab === 'geral' ? 'Geral' : '⚙️ Admin'}
              </Text>
              {activeTab === tab && <View style={s.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── ABA GERAL ── */}
        {activeTab === 'geral' && <>

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
                  <Text style={s.codeShareText}>{copied === 'code' ? '✓ Copiado!' : 'Copiar'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.inviteBtn} onPress={handleShareInvite}>
                <Text style={s.inviteBtnText}>
                  {copied === 'invite' ? '✓ Convite copiado! Cole no WhatsApp' : '🔗 Convidar para o grupo'}
                </Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}

        </> /* fim aba Geral */}

        {/* ── ABA ADMIN ── */}
        {activeTab === 'admin' && <>

        {/* Visibilidade do grupo */}
        {group && (
          <View>
            <Text style={s.sectionTitle}>Visibilidade do grupo</Text>
            <Card style={{ gap: Spacing.sm }}>
              <TouchableOpacity
                style={s.visRow}
                onPress={() => setGroupVisibility('privado')}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.visLabel}>🔒 Privado</Text>
                  <Text style={s.visDesc}>Só quem tem o código pode entrar e ver o grupo.</Text>
                </View>
                {(group.visibility ?? 'privado') === 'privado' && <Text style={s.visCheck}>✓</Text>}
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: Colors.line }} />
              <TouchableOpacity
                style={s.visRow}
                onPress={() => setGroupVisibility('publico')}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.visLabel}>🌍 Público</Text>
                  <Text style={s.visDesc}>Qualquer pessoa pode visitar (ver ranking e jogos) sem entrar no grupo.</Text>
                </View>
                {group.visibility === 'publico' && <Text style={s.visCheck}>✓</Text>}
              </TouchableOpacity>
            </Card>
          </View>
        )}

        {/* Admin — Jogadores */}
        {group && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={s.sectionTitle}>Jogadores do grupo</Text>
              <TouchableOpacity onPress={() => setShowAddGuest(v => !v)}
                style={{ paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: Colors.surf2, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line }}>
                <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.teal }}>
                  {showAddGuest ? '− Cancelar' : '+ Convidado'}
                </Text>
              </TouchableOpacity>
            </View>
            <Card padding={0} style={{ overflow: 'hidden' }}>
              {groupPlayers.length === 0 && (
                <Text style={s.emptyPlayers}>Nenhum jogador cadastrado.</Text>
              )}
              {groupPlayers.map((p, i) => {
                const isSelf       = p.uid != null && p.uid === user?.uid;
                const isPlayerAdmin= !p.guest && p.uid != null && group?.admins?.includes(p.uid);
                const canPromote   = !p.guest && p.uid != null && !isPlayerAdmin && !isSelf;
                const h            = p.handicap ?? 0;
                return (
                  <View key={p.id} style={[s.playerRow, i < groupPlayers.length - 1 && s.playerBorder]}>
                    <Avatar name={p.name} color={p.color} size={28} />
                    <Text style={s.playerName} numberOfLines={1}>{p.name}</Text>
                    {/* Handicap */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TouchableOpacity onPress={() => updatePlayerHandicap(group.id, p.id, Math.max(-3, h - 1))} hitSlop={6}
                        style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.line }}>
                        <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 14, color: Colors.text, lineHeight: 18 }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 13, width: 24, textAlign: 'center', color: h > 0 ? Colors.teal : h < 0 ? Colors.coral : Colors.faint }}>
                        {h > 0 ? `+${h}` : h === 0 ? '0' : h}
                      </Text>
                      <TouchableOpacity onPress={() => updatePlayerHandicap(group.id, p.id, Math.min(3, h + 1))} hitSlop={6}
                        style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.line }}>
                        <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 14, color: Colors.text, lineHeight: 18 }}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {isPlayerAdmin && <View style={s.adminBadge}><Text style={s.adminText}>👑 admin</Text></View>}
                    {!isPlayerAdmin && (
                      <View style={p.guest ? s.guestBadge : s.memberBadge}>
                        <Text style={p.guest ? s.guestText : s.memberText}>{p.guest ? 'conv.' : 'membro'}</Text>
                      </View>
                    )}
                    {canPromote && (
                      <TouchableOpacity style={s.promoteBtn} onPress={() => handlePromoteToAdmin(p.uid!, p.name)} hitSlop={8}>
                        <Text style={s.promoteBtnText}>👑</Text>
                      </TouchableOpacity>
                    )}
                    {!isSelf && (
                      <TouchableOpacity onPress={() => handleRemovePlayer(p.id, p.uid, p.name)} hitSlop={8}>
                        <Text style={s.removeBtn}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </Card>
            {/* Formulário adicionar convidado */}
            {showAddGuest && (
              <Card style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
                <TextInput
                  style={{ backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: 10, fontFamily: FontFamily.body, fontSize: 15, color: Colors.text }}
                  value={guestName} onChangeText={setGuestName}
                  placeholder="Nome do convidado" placeholderTextColor={Colors.faint} autoFocus
                />
                <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  {GUEST_COLORS.map(c => (
                    <TouchableOpacity key={c} onPress={() => setGuestColor(c)}
                      style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: guestColor === c ? 3 : 0, borderColor: Colors.text }} />
                  ))}
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', opacity: guestName.trim() ? 1 : 0.4 }}
                  onPress={handleAddGuest} disabled={!guestName.trim()}>
                  <Text style={{ fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg }}>Adicionar convidado</Text>
                </TouchableOpacity>
              </Card>
            )}
          </View>
        )}

        {/* Zona de perigo */}
        <View>
          <Text style={[s.sectionTitle, { color: Colors.coral }]}>Zona de perigo</Text>
          <Card style={s.dangerCard}>
            <Text style={s.dangerHint}>Ações irreversíveis. Use com cautela.</Text>
            <TouchableOpacity style={s.dangerBtn} onPress={handleLeaveGroup}>
              <Text style={s.dangerBtnText}>🚪 Sair do grupo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.dangerBtn, s.dangerBtnRed]} onPress={handleDeleteGroup}>
              <Text style={[s.dangerBtnText, s.dangerBtnTextRed]}>🗑️ Excluir grupo permanentemente</Text>
            </TouchableOpacity>
          </Card>
        </View>

        </> /* fim aba Admin */}

        {/* Conta — não admin */}
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
  visRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  visLabel: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  visDesc: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 2 },
  visCheck: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.teal },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.line, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md },
  tabItem: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', position: 'relative' },
  tabItemActive: {},
  tabLabel: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.faint },
  tabLabelActive: { color: Colors.gold, fontWeight: '700' },
  tabIndicator: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2.5, backgroundColor: Colors.gold, borderRadius: 1 },
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
  adminBadge: { backgroundColor: Colors.gold + '33', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  adminText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold },
  promoteBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  promoteBtnText: { fontSize: 14 },

  dangerCard: { gap: Spacing.sm },
  dangerHint: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  dangerBtn: { borderWidth: 1, borderColor: Colors.coral + '66', borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  dangerBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.coral },
  dangerBtnRed: { borderColor: '#e53935', backgroundColor: '#e5393511' },
  dangerBtnTextRed: { color: '#e53935' },

  accountEmail: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', marginBottom: Spacing.sm },
  leaveBtn: { borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  leaveBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
});
