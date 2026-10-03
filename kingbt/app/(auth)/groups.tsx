import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { FontFamily, Spacing, centeredContent, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import type { Group, UnlinkedPlayer, PendingJoin } from '@/store/AuthContext';
import { LinkPlayerModal } from '@/components/LinkPlayerModal';
import { VisibilityPicker, type GroupVisibility, Icon } from '@/components';
import { HexBackground } from '@/components/HexBackground';
import { GroupInvitePreview } from '@/components/GroupInvitePreview';
import { getGroupPreview, syncGroupPreview, type GroupPreview } from '@/firebase/groupCodes';
import { DEFAULT_SCORING, isScoringConfigValid, type ScoringConfig } from '@/logic/scoringConfig';
import { statPoints } from '@/logic/scoring';

type Mode = 'list' | 'create';

const DESC_MAX = 140;

// Grupos antigos podem não ter o registro do código de convite; o admin recria uma vez por sessão.
const codeBackfilled = new Set<string>();

export default function GroupsScreen() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { user, group: currentGroup, joinGroup, createGroup, switchGroup, getMyGroups, checkPendingJoins, finishApprovedJoin, cancelPendingJoin, clearError, error, confirmGroup } = useAuth();
  const router = useRouter();
  const [mode, setMode]         = useState<Mode>('list');
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [pendingList, setPendingList] = useState<PendingJoin[]>([]);
  const [approvedList, setApprovedList] = useState<PendingJoin[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [code, setCode]         = useState('');
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [invite, setInvite] = useState<GroupPreview | null>(null);
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [name, setName]         = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<GroupVisibility>('privado');
  const [busy, setBusy]         = useState(false);

  // Fórmula de pontuação (opcional) — mesmo padrão de app/(app)/settings.tsx.
  const [showScoring, setShowScoring] = useState(false);
  const [scoreForm, setScoreForm] = useState({
    winCoef:    String(DEFAULT_SCORING.winCoef),
    playedCoef: String(DEFAULT_SCORING.playedCoef),
    gaCoef:     String(DEFAULT_SCORING.gaCoef),
    eventCoef:  String(DEFAULT_SCORING.eventCoef ?? 0),
  });
  const parseCoef = (v: string) => Number(v.replace(',', '.').trim());
  const parsedScoring: ScoringConfig = {
    winCoef:    parseCoef(scoreForm.winCoef),
    playedCoef: parseCoef(scoreForm.playedCoef),
    gaCoef:     parseCoef(scoreForm.gaCoef),
    eventCoef:  parseCoef(scoreForm.eventCoef),
  };
  const scoringValid = isScoringConfigValid(parsedScoring);
  // Preview em tempo real: exemplo fixo (5V, 8J, GA 1.5, 3 eventos).
  const previewPts = scoringValid
    ? statPoints({ played: 8, wins: 5, gamesPro: 3, gamesCon: 2, events: 3 }, parsedScoring)
    : null;

  // Modal de vínculo de perfil — só aparece ao entrar num grupo novo por código
  const [unlinked, setUnlinked] = useState<UnlinkedPlayer[]>([]);
  const [showLink, setShowLink] = useState(false);

  // Grupos públicos que o usuário pode visitar (somente leitura)
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [publicGroupsError, setPublicGroupsError] = useState(false);
  const [visitBusy, setVisitBusy] = useState(false);

  useEffect(() => {
    loadGroups();
    loadPublicGroups();
  }, []);

  async function loadGroups() {
    setLoadingGroups(true);
    const [groups, check] = await Promise.all([getMyGroups(), checkPendingJoins()]);
    setMyGroups(groups);
    if (user) {
      for (const g of groups) {
        if (!g.code || !(g.admins ?? []).includes(user.uid) || codeBackfilled.has(g.id)) continue;
        codeBackfilled.add(g.id);
        syncGroupPreview(g.code, g.id, { name: g.name, description: g.description ?? '', visibility: g.visibility ?? 'privado' }).catch(() => {});
      }
    }
    setPendingList(check.pending.filter(p => !groups.some(g => g.id === p.groupId)));
    setApprovedList(check.approved.filter(p => !groups.some(g => g.id === p.groupId)));
    if (check.rejected > 0) setJoinNotice(check.rejected === 1 ? 'Um pedido seu foi recusado pelo administrador.' : `${check.rejected} pedidos seus foram recusados.`);
    setLoadingGroups(false);
  }

  async function loadPublicGroups() {
    setLoadingPublic(true);
    setPublicGroupsError(false);
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
      // Antes uma falha de rede virava "nenhum grupo público" — indistinguível
      // de fato não haver grupos. Agora mostra retry em vez de esconder a seção.
      setPublicGroups([]);
      setPublicGroupsError(true);
    }
    setLoadingPublic(false);
  }

  async function handleVisit(groupId: string) {
    setVisitBusy(true);
    await switchGroup(groupId);
    setVisitBusy(false);
    confirmGroup();
    router.replace('/(app)/home');
  }

  async function handleSwitch(groupId: string) {
    // Grupo já ativo — entra direto, sem gravar nada
    if (currentGroup?.id === groupId) {
      confirmGroup();
      router.replace('/(app)/home');
      return;
    }
    setBusy(true);
    await switchGroup(groupId);
    setBusy(false);
    confirmGroup();
    router.replace('/(app)/home');
  }

  /** Passo 1: abre a prévia do grupo pelo código (nome, descrição), antes de pedir para entrar. */
  async function handleJoin() {
    if (!code.trim()) return;
    setBusy(true);
    clearError();
    setJoinNotice(null);
    try {
      const preview = await getGroupPreview(code);
      if (!preview) { setJoinNotice('Código do grupo não encontrado.'); return; }
      setInvite(preview);
    } catch {
      setJoinNotice('Não foi possível buscar o código. Verifique a conexão e tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  /** Passo 2: pede a entrada (ou entra direto, se já for membro). */
  async function handleRequestInvite() {
    if (!invite) return;
    setBusy(true);
    clearError();
    setJoinNotice(null);
    const result = await joinGroup(invite.code);
    setBusy(false);
    setInvite(null);
    if (result.pending) {
      // O código era válido, mas entrar depende do admin: não abre o grupo.
      setCode('');
      setJoinNotice('Pedido enviado! Um administrador precisa aprovar sua entrada. Ele aparece abaixo, em "Pedidos de entrada", até ser aprovado.');
      loadGroups();
      return;
    }
    if (result.needsLink === undefined) return; // falhou (o erro já aparece na tela)
    if (result.needsLink) {
      setUnlinked(result.unlinkedPlayers);
      setShowLink(true);
      return;
    }
    confirmGroup();
    router.replace('/(app)/home');
  }

  /** Pedido aprovado pelo admin: entra no grupo (e vincula o perfil, se for novo). */
  async function handleEnterApproved(groupId: string) {
    setBusy(true);
    clearError();
    const result = await finishApprovedJoin(groupId);
    setBusy(false);
    if (result.needsLink === undefined) return; // falhou (o erro já aparece na tela)
    if (result.needsLink) {
      setUnlinked(result.unlinkedPlayers);
      setShowLink(true);
      return;
    }
    confirmGroup();
    router.replace('/(app)/home');
  }

  async function handleCancelPending(groupId: string) {
    setBusy(true);
    await cancelPendingJoin(groupId);
    setBusy(false);
    setJoinNotice('Pedido cancelado.');
    loadGroups();
  }

  async function handleCreate() {
    if (!name.trim()) return;
    if (showScoring && !scoringValid) return;
    setBusy(true);
    clearError();
    await createGroup(name.trim(), visibility, showScoring ? parsedScoring : undefined, description);
    setBusy(false);
    confirmGroup();
    router.replace('/(app)/home');
  }

  function switchMode(m: Mode) {
    clearError();
    setCode('');
    setGroupsExpanded(false);
    setName('');
    setVisibility('privado');
    setShowScoring(false);
    setScoreForm({
      winCoef:    String(DEFAULT_SCORING.winCoef),
      playedCoef: String(DEFAULT_SCORING.playedCoef),
      gaCoef:     String(DEFAULT_SCORING.gaCoef),
      eventCoef:  String(DEFAULT_SCORING.eventCoef ?? 0),
    });
    setMode(m);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HexBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header — botão voltar só quando veio de dentro do app */}
        <View style={styles.header}>
          {router.canGoBack() && (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Icon name="chevronLeft" size={18} color={Colors.text} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Grupos</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Erro */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!!joinNotice && (
            <View style={styles.errorBox}>
              <Text style={[styles.errorText, { color: Colors.gold }]}>{joinNotice}</Text>
            </View>
          )}

          {invite && (
            <GroupInvitePreview
              preview={invite}
              status={myGroups.some(g => g.id === invite.groupId) ? 'member' : 'none'}
              busy={busy}
              onRequest={handleRequestInvite}
              onOpen={() => handleSwitch(invite.groupId)}
              onBack={() => setInvite(null)}
            />
          )}

          {/* Lista de grupos */}
          {mode === 'list' && !invite && (
            <>
              {loadingGroups ? (
                <ActivityIndicator color={Colors.gold} style={{ marginTop: Spacing.xl }} />
              ) : (
                <>
                  {myGroups.length > 0 && (() => {
                    const active = myGroups.find(g => g.id === currentGroup?.id) ?? myGroups[0];
                    const others = myGroups.filter(g => g.id !== active.id);
                    return (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Seus grupos</Text>
                        <TouchableOpacity
                          style={[styles.groupCard, styles.groupCardActive]}
                          onPress={() => handleSwitch(active.id)}
                          disabled={busy}
                          activeOpacity={0.8}
                        >
                          <View style={styles.groupCrest}>
                            <Icon name="crown" size={18} color={Colors.gold} />
                          </View>
                          <View style={styles.groupCardInfo}>
                            <Text style={styles.groupCardName}>{active.name}</Text>
                            <Text style={styles.groupCardCode}>{active.code}</Text>
                            {!!active.description && <Text style={styles.groupCardDesc} numberOfLines={2}>{active.description}</Text>}
                          </View>
                          {currentGroup?.id === active.id && <Text style={styles.activeBadge}>Ativo</Text>}
                          {others.length > 0 && (
                            <TouchableOpacity
                              onPress={(e) => { e.stopPropagation(); setGroupsExpanded(v => !v); }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              style={styles.dropdownToggle}
                            >
                              <Icon name={groupsExpanded ? 'chevronDown' : 'chevronRight'} size={18} color={Colors.faint} />
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>

                        {groupsExpanded && others.map(g => (
                          <TouchableOpacity
                            key={g.id}
                            style={styles.groupCardSub}
                            onPress={() => { setGroupsExpanded(false); handleSwitch(g.id); }}
                            disabled={busy}
                            activeOpacity={0.8}
                          >
                            <View style={styles.groupCardInfo}>
                              <Text style={styles.groupCardName}>{g.name}</Text>
                              <Text style={styles.groupCardCode}>{g.code}</Text>
                              {!!g.description && <Text style={styles.groupCardDesc} numberOfLines={2}>{g.description}</Text>}
                            </View>
                            <Icon name="chevronRight" size={18} color={Colors.faint} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })()}

                  {/* Pedidos de entrada: aguardando o admin ou já aprovados */}
                  {(approvedList.length > 0 || pendingList.length > 0) && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Pedidos de entrada</Text>
                      {approvedList.map(p => (
                        <TouchableOpacity key={p.groupId} style={styles.groupCardSub} onPress={() => handleEnterApproved(p.groupId)} disabled={busy} activeOpacity={0.8}>
                          <View style={styles.groupCardInfo}>
                            <Text style={styles.groupCardName}>Grupo {p.code}</Text>
                            <Text style={styles.groupCardCode}>Seu pedido foi aprovado</Text>
                          </View>
                          <Text style={[styles.activeBadge, { color: Colors.teal }]}>Entrar</Text>
                        </TouchableOpacity>
                      ))}
                      {pendingList.map(p => (
                        <View key={p.groupId} style={styles.groupCardSub}>
                          <View style={styles.groupCardInfo}>
                            <Text style={styles.groupCardName}>Grupo {p.code}</Text>
                            <Text style={styles.groupCardCode}>Aguardando aprovação do administrador</Text>
                          </View>
                          <TouchableOpacity onPress={() => handleCancelPending(p.groupId)} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancelar pedido">
                            <Text style={[styles.activeBadge, { color: Colors.muted }]}>Cancelar</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Entrar em outro grupo — inline, sem trocar de tela */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Entrar em outro grupo</Text>
                    <View style={styles.joinRow}>
                      <View style={styles.joinInputWrap}>
                        <Icon name="key" size={16} color={Colors.faint} />
                        <TextInput
                          style={styles.joinInput}
                          value={code}
                          onChangeText={t => { setCode(t.toUpperCase()); clearError(); }}
                          placeholder="Código do convite"
                          placeholderTextColor={Colors.faint}
                          autoCapitalize="characters"
                          autoCorrect={false}
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.joinBtn, (!code.trim() || busy) && styles.btnDisabled]}
                        onPress={handleJoin}
                        disabled={!code.trim() || busy}
                        activeOpacity={0.85}
                      >
                        {busy ? <ActivityIndicator color={Colors.bg} size="small" /> : <Text style={styles.btnText}>Entrar</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.createLink} onPress={() => switchMode('create')} activeOpacity={0.7}>
                    <Icon name="plus" size={16} color={Colors.teal} />
                    <Text style={styles.createLinkText}>Criar um novo grupo</Text>
                  </TouchableOpacity>

                  {/* Explorar grupos públicos */}
                  {publicGroupsError && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Explorar grupos públicos</Text>
                      <TouchableOpacity style={styles.publicGroupsRetry} onPress={loadPublicGroups} activeOpacity={0.7}>
                        <Text style={styles.publicGroupsRetryText}>Não foi possível carregar. Toque para tentar de novo.</Text>
                      </TouchableOpacity>
                    </View>
                  )}
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
                          <View style={styles.groupCrest}>
                            <Icon name="globe" size={16} color={Colors.teal} />
                          </View>
                          <View style={styles.groupCardInfo}>
                            <Text style={styles.groupCardName}>{g.name}</Text>
                            <Text style={styles.groupCardCode}>Público</Text>
                            {!!g.description && <Text style={styles.groupCardDesc} numberOfLines={2}>{g.description}</Text>}
                          </View>
                          <View style={styles.visitBadge}>
                            <Icon name="eye" size={13} color={Colors.teal} />
                            <Text style={styles.visitBadgeText}>Visitar</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {/* Criar grupo */}
          {mode === 'create' && (
            <View style={styles.formSection}>
              <TouchableOpacity onPress={() => switchMode('list')} style={styles.backLink}>
                <Icon name="chevronLeft" size={14} color={Colors.teal} />
                <Text style={styles.backLinkText}>Voltar</Text>
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
              <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.inputDesc}
                  value={description}
                  onChangeText={t => setDescription(t.slice(0, DESC_MAX))}
                  placeholder="Conte em uma frase quem joga e onde"
                  placeholderTextColor={Colors.faint}
                  multiline
                  maxLength={DESC_MAX}
                />
              </View>
              <Text style={styles.fieldHint}>{description.length}/{DESC_MAX} · quem receber o convite vê isso antes de entrar</Text>
              <VisibilityPicker value={visibility} onChange={setVisibility} />

              {/* Fórmula de pontuação — opcional, pré-preenchida com o padrão */}
              <TouchableOpacity onPress={() => setShowScoring(v => !v)} style={styles.scoreToggle} activeOpacity={0.7}>
                <Text style={styles.scoreToggleText}>
                  {showScoring ? '▾' : '▸'} Fórmula de pontuação (opcional)
                </Text>
              </TouchableOpacity>
              {showScoring && (
                <View style={styles.scoreCard}>
                  <Text style={styles.scoreHint}>
                    Pts = (Vitórias×A) + (Jogos×B) + (Game Average×C) + (Eventos×D). Dá pra ajustar depois em Configurações.
                  </Text>
                  <View style={styles.scoreRow}>
                    {([
                      { key: 'winCoef',    label: 'Vitórias (A)' },
                      { key: 'playedCoef', label: 'Jogos (B)' },
                      { key: 'gaCoef',     label: 'GA (C)' },
                      { key: 'eventCoef',  label: 'Eventos (D)' },
                    ] as const).map(f => (
                      <View key={f.key} style={styles.scoreField}>
                        <Text style={styles.scoreLabel}>{f.label}</Text>
                        <TextInput
                          style={styles.scoreInput}
                          value={scoreForm[f.key]}
                          onChangeText={t => setScoreForm(prev => ({ ...prev, [f.key]: t }))}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={Colors.faint}
                        />
                      </View>
                    ))}
                  </View>
                  <View style={styles.scorePreviewBox}>
                    {scoringValid ? (
                      <Text style={styles.scorePreviewText}>
                        Ex.: 5V + 8J + GA 1.5 + 3 eventos ={' '}
                        <Text style={styles.scorePreviewPts}>{previewPts} pontos</Text>
                      </Text>
                    ) : (
                      <Text style={styles.scorePreviewError}>Valores inválidos — use números entre 0 e 100.</Text>
                    )}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.btnPrimary, (!name.trim() || busy || (showScoring && !scoringValid)) && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={!name.trim() || busy || (showScoring && !scoringValid)}
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
        onDone={() => { setShowLink(false); confirmGroup(); router.replace('/(app)/home'); }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 28, lineHeight: 32, color: Colors.text },
  scroll: { ...centeredContent, padding: Spacing.md, gap: Spacing.md },

  errorBox: { backgroundColor: Colors.coral + '22', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.coral + '44' },
  errorText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral },

  section: { gap: Spacing.sm },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted, letterSpacing: 1, marginBottom: Spacing.xs },
  publicGroupsRetry: {
    borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, alignItems: 'center',
  },
  publicGroupsRetryText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },

  groupCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, padding: Spacing.md },
  groupCardActive: { borderColor: Colors.gold, backgroundColor: Colors.surf2 },
  groupCardSub: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, padding: Spacing.md, marginTop: Spacing.xs },
  groupCrest: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gold + '1a', alignItems: 'center', justifyContent: 'center' },
  groupCardInfo: { flex: 1, gap: 2 },
  groupCardName: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  groupCardDesc: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, color: Colors.muted, marginTop: 4 },
  fieldLabel: { fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.3, color: Colors.muted, marginTop: Spacing.sm },
  fieldHint: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: -4 },
  inputDesc: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.text, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, minHeight: 84, textAlignVertical: 'top' },
  groupCardCode: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.muted, letterSpacing: 1 },
  dropdownToggle: { padding: 4 },
  activeBadge: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.gold, backgroundColor: Colors.gold + '22', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  visitBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.teal + '22', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  visitBadgeText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.teal },

  joinRow: { flexDirection: 'row', gap: Spacing.sm },
  joinInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, paddingHorizontal: Spacing.md },
  joinInput: { flex: 1, fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.text, paddingVertical: Spacing.md, letterSpacing: 1 },
  joinBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, alignItems: 'center', justifyContent: 'center' },

  createLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  createLinkText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.teal },

  formSection: { gap: Spacing.md },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingBottom: Spacing.xs },
  backLinkText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.teal },
  formTitle: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.text },

  inputWrap: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line },
  inputName: { fontFamily: FontFamily.body, fontSize: 18, color: Colors.text, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, textAlign: 'center' },

  codePreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.surf2, borderRadius: Radius.sm, padding: Spacing.sm },
  codePreviewLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  codePreviewValue: { fontFamily: FontFamily.numberBold, fontSize: 17, color: Colors.gold, letterSpacing: 2 },

  scoreToggle: { paddingVertical: Spacing.xs },
  scoreToggleText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.teal },
  scoreCard: { gap: Spacing.sm, backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, padding: Spacing.md },
  scoreHint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  scoreRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  scoreField: { flexGrow: 1, minWidth: 70, gap: 4 },
  scoreLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  scoreInput: { backgroundColor: Colors.surf2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.text, textAlign: 'center' },
  scorePreviewBox: { backgroundColor: Colors.surf2, borderRadius: Radius.sm, padding: Spacing.sm },
  scorePreviewText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  scorePreviewPts: { fontFamily: FontFamily.numberBold, color: Colors.gold },
  scorePreviewError: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral },

  btnPrimary: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnText: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg },
});
