import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { Avatar } from '@/components';
import {
  listarTreinos, novoTreino, salvarTreino, calcularAnaliseTreino, type BtTreino,
} from '@/logic/btTreino';
import { saveTreinoFs, listTreinosFs } from '@/firebase/treinos';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function TreinoCard({ treino, nomeJogador }: { treino: BtTreino; nomeJogador: string }) {
  const { colors: Colors } = useTheme();
  const card = useMemo(() => makeCardStyles(Colors), [Colors]);
  const analise = calcularAnaliseTreino(treino);

  return (
    <TouchableOpacity
      style={card.wrap}
      activeOpacity={0.8}
      onPress={() => router.push({ pathname: '/treino/[treinoId]', params: { treinoId: treino.id, playerId: treino.playerId } })}
    >
      <View style={card.header}>
        <Text style={card.titulo} numberOfLines={1}>{treino.titulo}</Text>
        <Text style={card.date}>{formatDate(treino.criadoEm)}</Text>
      </View>
      <Text style={card.jogador}>{nomeJogador}</Text>
      <Text style={card.hint}>
        {analise.totalTentativas} golpes · {analise.aproveitamentoGeral}% de aproveitamento
      </Text>
    </TouchableOpacity>
  );
}

const makeCardStyles = (Colors: ThemeColors) => StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surf, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
    borderLeftWidth: 3, borderLeftColor: Colors.teal,
    padding: Spacing.md, gap: Spacing.xs,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { flex: 1, fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  date: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  jogador: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.teal },
  hint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
});

export default function TreinoListScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { group } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const [treinos, setTreinos] = useState<BtTreino[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovo, setShowNovo] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      let list = await listarTreinos();
      if (group?.id) {
        try {
          const remote = await listTreinosFs(group.id);
          const localIds = new Set(list.map(t => t.id));
          list = [...list, ...remote.filter(t => !localIds.has(t.id))];
        } catch { /* offline ou sem permissão */ }
      }
      list.sort((a, b) => b.criadoEm - a.criadoEm);
      setTreinos(list);
      setLoading(false);
    }
    load();
  }, [group?.id]);

  async function criarTreino() {
    if (!titulo.trim() || !playerId || !group?.id) return;
    const treino = novoTreino(group.id, playerId, titulo.trim());
    await salvarTreino(treino);
    saveTreinoFs(group.id, treino).catch(() => {});
    setTreinos(prev => [treino, ...prev]);
    setTitulo(''); setPlayerId(null); setShowNovo(false);
    router.push({ pathname: '/treino/[treinoId]', params: { treinoId: treino.id, playerId: treino.playerId } });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Análise Individual</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.novoBtn} onPress={() => setShowNovo(v => !v)} activeOpacity={0.85}>
          <Text style={s.novoBtnTxt}>{showNovo ? '− Cancelar' : '+ Nova análise'}</Text>
        </TouchableOpacity>

        {showNovo && (
          <View style={s.novoForm}>
            <Text style={s.novoLabel}>Título</Text>
            <TextInput
              style={s.input}
              value={titulo}
              onChangeText={setTitulo}
              placeholder="Ex: treino de saque"
              placeholderTextColor={Colors.faint}
            />
            <Text style={s.novoLabel}>Jogador</Text>
            <View style={s.playerGrid}>
              {groupPlayers.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.playerChip, playerId === p.id && s.playerChipActive]}
                  onPress={() => setPlayerId(p.id)}
                  activeOpacity={0.8}
                >
                  <Avatar name={p.name} color={p.color} size={20} />
                  <Text style={[s.playerChipTxt, playerId === p.id && s.playerChipTxtActive]}>{p.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.criarBtn, (!titulo.trim() || !playerId) && s.criarBtnDisabled]}
              onPress={criarTreino}
              disabled={!titulo.trim() || !playerId}
            >
              <Text style={s.criarBtnTxt}>Criar</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && <Text style={s.hint}>Carregando análises...</Text>}

        {!loading && treinos.length === 0 && !showNovo && (
          <View style={s.center}>
            <Text style={{ fontSize: 40, textAlign: 'center' }}>🎯</Text>
            <Text style={s.emptyTitle}>Nenhuma análise individual ainda</Text>
            <Text style={s.hint}>
              Use "Nova análise" para marcar golpes Bom/Ruim de um jogador fora do contexto de uma partida.
            </Text>
          </View>
        )}

        {treinos.map(t => (
          <TreinoCard key={t.id} treino={t} nomeJogador={findPlayer(t.playerId)?.name ?? t.playerId} />
        ))}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  novoBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  novoBtnTxt: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg },
  novoForm: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, padding: Spacing.md, gap: Spacing.sm },
  novoLabel: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted },
  input: { backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: 10, fontFamily: FontFamily.body, fontSize: 15, color: Colors.text },
  playerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  playerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line },
  playerChipActive: { backgroundColor: Colors.teal + '22', borderColor: Colors.teal },
  playerChipTxt: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted },
  playerChipTxtActive: { color: Colors.teal },
  criarBtn: { backgroundColor: Colors.teal, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  criarBtnDisabled: { opacity: 0.4 },
  criarBtnTxt: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text, textAlign: 'center' },
  hint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
