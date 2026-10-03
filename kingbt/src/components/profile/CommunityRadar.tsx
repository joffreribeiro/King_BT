import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useRatings } from '@/hooks/useRatings';
import { useCompetitions } from '@/store/CompetitionsContext';
import { havePlayedTogether } from '@/logic/playedWith';
import { saveRating, deleteRating } from '@/firebase/ratings';
import { Card } from '@/components';
import { Icon } from '@/components/icons';
import { CATEGORIES, type Category } from '@/logic/playerAbout';
import { CATEGORY_BONUS } from '@/logic/categorySuggestion';
import { SKILLS, cleanSkills, communityAverage, skillAverage, withDefaults, type SkillKey } from '@/logic/skills';
import { RadarChart } from './RadarChart';
import { SkillGrid, SkillSliders } from './SkillParts';
import { makeTab } from './profileStyles';

interface Props {
  /** Jogador avaliado. */
  playerId: string;
  playerName: string;
  /** true no perfil da própria pessoa: só mostra a média recebida, sem botão de avaliar. */
  isSelf: boolean;
}

/**
 * Avaliação da comunidade: média das notas que os outros jogadores do grupo
 * deram a este jogador (radar + habilidades), e, no perfil dos outros, o botão
 * para dar ou trocar a sua nota. Uma avaliação por pessoa; ninguém avalia a si mesmo.
 */
export function CommunityRadar({ playerId, playerName, isSelf }: Props) {
  const { colors: Colors } = useTheme();
  const tab = useMemo(() => makeTab(Colors), [Colors]);
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { group, user, isMember, myPlayerId } = useAuth();
  const { ratings, loaded, denied } = useRatings(playerId);
  const { state } = useCompetitions();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<SkillKey, number>>(withDefaults(undefined));
  const [draftCat, setDraftCat] = useState<Category | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { avg, count } = useMemo(() => communityAverage(ratings.map(r => r.skills)), [ratings]);
  const mine = user ? ratings.find(r => r.raterUid === user.uid) : undefined;
  // Só avalia quem já jogou com ou contra você numa partida com placar. Quem já
  // tinha avaliado antes dessa regra continua podendo editar ou remover a nota.
  const played = !!myPlayerId && havePlayedTogether(state.competitions, myPlayerId, playerId);
  const canRate = !isSelf && isMember && !!user && !!group && (played || !!mine);
  const blocked = !isSelf && isMember && !!user && !!group && !played && !mine;
  const first = playerName.trim().split(/\s+/)[0] || 'jogador';

  function startEdit() { setDraft(withDefaults(mine?.skills)); setDraftCat(mine?.category); setMsg(null); setEditing(true); }
  function setSkill(key: SkillKey, value: number) { setDraft(d => ({ ...d, [key]: value })); }

  async function run(task: () => Promise<void>, ok: string) {
    setBusy(true); setMsg(null);
    try { await task(); setEditing(false); setMsg(ok); }
    catch { setMsg('Não foi possível salvar. Verifique a conexão e tente de novo.'); }
    finally { setBusy(false); }
  }
  const save = () => run(() => saveRating(group!.id, playerId, user!.uid, cleanSkills(draft), myPlayerId, draftCat), 'Sua avaliação foi salva.');
  const remove = () => run(() => deleteRating(group!.id, playerId, user!.uid, myPlayerId), 'Sua avaliação foi removida.');

  const shown = editing ? draft : avg;
  const overall = shown ? skillAverage(shown) : null;

  return (
    <View style={{ gap: Spacing.md }}>
      <Card>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={tab.sectionTitle}>Avaliação da comunidade</Text>
            <Text style={s.note}>
              {editing ? `Sua nota para ${first}, de 1 a 10 em cada habilidade.`
                : count > 0 ? `Média de ${count} ${count === 1 ? 'avaliação' : 'avaliações'} dos colegas do grupo.`
                : 'Média das notas dos colegas do grupo.'}
            </Text>
          </View>
          {overall != null && (
            <View style={s.avgBox}>
              <Text style={s.avgVal}>{overall.toFixed(1).replace('.', ',')}</Text>
              <Text style={s.avgLbl}>média</Text>
            </View>
          )}
        </View>

        {denied ? (
          <Text style={s.note}>As avaliações ainda não estão liberadas neste grupo. Tente de novo mais tarde.</Text>
        ) : editing ? (
          <>
            <SkillSliders values={draft} onChange={setSkill} />
            <Text style={[s.note, { marginTop: Spacing.md, fontFamily: FontFamily.titleBold, color: Colors.text }]}>Em que categoria {first} joga? (opcional)</Text>
            <Text style={s.note}>Sua escolha soma pontos na nota dele(a): Open +{CATEGORY_BONUS.Open}, A +{CATEGORY_BONUS.A}, B +{CATEGORY_BONUS.B}, C +{CATEGORY_BONUS.C}, D +{CATEGORY_BONUS.D}, Iniciante +{CATEGORY_BONUS.Iniciante}.</Text>
            <View style={s.catRow}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c} style={[s.catChip, draftCat === c && s.catChipOn]} onPress={() => setDraftCat(draftCat === c ? undefined : c)} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: draftCat === c }}>
                  <Text style={[s.catText, draftCat === c && s.catTextOn]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : avg ? (
          <>
            <RadarChart values={SKILLS.map(sk => avg[sk.key])} />
            <SkillGrid values={avg} decimals />
          </>
        ) : (
          <Text style={s.note}>
            {!loaded ? 'Carregando…' : isSelf ? 'Ninguém avaliou você ainda.' : `Ninguém avaliou ${first} ainda. Seja o primeiro!`}
          </Text>
        )}
      </Card>

      {!!msg && <Text style={[s.note, { textAlign: 'center' }]}>{msg}</Text>}

      {blocked && !denied && (
        <Text style={[s.note, { textAlign: 'center' }]}>
          Você só pode avaliar quem já jogou com ou contra você. Depois de uma partida com {first}, o botão de avaliar aparece aqui.
        </Text>
      )}

      {canRate && !denied && (editing ? (
        <View style={{ gap: Spacing.sm }}>
          <View style={s.actions}>
            <TouchableOpacity style={s.ghost} onPress={() => setEditing(false)} disabled={busy} activeOpacity={0.8}>
              <Text style={s.ghostTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.primary, { flex: 1 }, busy && { opacity: 0.6 }]} onPress={save} disabled={busy} activeOpacity={0.85}>
              <Text style={s.primaryTxt}>{busy ? 'Salvando…' : 'Salvar avaliação'}</Text>
            </TouchableOpacity>
          </View>
          {!!mine && (
            <TouchableOpacity onPress={remove} disabled={busy} hitSlop={8} style={{ alignSelf: 'center', padding: 6 }}>
              <Text style={[s.note, { color: Colors.coral }]}>Remover minha avaliação</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity style={s.primary} onPress={startEdit} activeOpacity={0.85} accessibilityRole="button">
          <View style={s.primaryInner}>
            <Icon name="edit" size={18} color={Colors.bg} />
            <Text style={s.primaryTxt}>{mine ? 'Editar minha avaliação' : `Avaliar ${first}`}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  catChip: { minHeight: 40, paddingHorizontal: 16, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.surf, alignItems: 'center', justifyContent: 'center' },
  catChipOn: { borderColor: Colors.gold, backgroundColor: Colors.gold + '26' },
  catText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  catTextOn: { fontFamily: FontFamily.titleBold, color: Colors.gold },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  note: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, color: Colors.muted },
  avgBox: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.md, backgroundColor: Colors.gold + '1F' },
  avgVal: { fontFamily: FontFamily.numberBold, fontSize: 22, color: Colors.gold },
  avgLbl: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  ghost: { flex: 1, minHeight: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.line },
  ghostTxt: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.muted },
  primary: { minHeight: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gold },
  primaryInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryTxt: { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.bg },
});
