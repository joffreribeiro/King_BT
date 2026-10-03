import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Card } from '@/components';
import { Icon } from '@/components/icons';
import {
  SKILLS, cleanSkills, skillAverage, withDefaults,
  type Skills, type SkillKey,
} from '@/logic/skills';
import { RadarChart } from './RadarChart';
import { SkillGrid, SkillSliders } from './SkillParts';
import { CommunityRadar } from './CommunityRadar';
import { makeTab } from './profileStyles';

/**
 * Radar só para leitura (perfil de outro jogador): gráfico + habilidades em duas
 * colunas. Sem autoavaliação, o cartão avisa disso — o "5 em tudo" padrão
 * pareceria uma nota dada por ela.
 */
export function RadarReadOnly({ skills, playerName }: { skills?: Skills; playerName: string }) {
  const { colors: Colors } = useTheme();
  const tab = useMemo(() => makeTab(Colors), [Colors]);
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  if (Object.keys(cleanSkills(skills)).length === 0) {
    // O cartão aparece sempre; sem autoavaliação, diz isso em vez de mostrar um "5 em tudo" que a pessoa não deu.
    const first = playerName.trim().split(/s+/)[0] || 'O jogador';
    return (
      <Card>
        <Text style={tab.sectionTitle}>Avaliação</Text>
        <Text style={s.note}>{first} ainda não fez a autoavaliação.</Text>
      </Card>
    );
  }

  const shown = withDefaults(skills);
  const avg = skillAverage(shown);
  return (
    <Card>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={tab.sectionTitle}>Avaliação</Text>
          <Text style={s.note}>Autoavaliação, notas de 1 a 10.</Text>
        </View>
        <View style={s.avgBox}>
          <Text style={s.avgVal}>{(avg ?? 0).toFixed(1).replace('.', ',')}</Text>
          <Text style={s.avgLbl}>média</Text>
        </View>
      </View>
      <RadarChart values={SKILLS.map(sk => shown[sk.key])} />
      <SkillGrid values={shown} />
    </Card>
  );
}

interface Props {
  /** Jogador dono do perfil (para a avaliação da comunidade). */
  playerId: string;
  playerName: string;
  skills?: Skills;
  /** Grava a autoavaliação (só no próprio perfil). */
  onSave: (skills: Skills) => Promise<void>;
}

/**
 * Aba "Radar": autoavaliação do jogador nas 10 habilidades. Quem ainda não
 * avaliou começa com 5 em tudo. Em repouso mostra o gráfico e as habilidades em
 * duas colunas; "Editar autoavaliação" abre os botões − e + e o salvar.
 * A avaliação da comunidade ainda não existe no app (precisaria de notas dadas
 * por outros jogadores), então o seletor mostra o aviso em vez de um gráfico vazio.
 */
export function RadarTab({ playerId, playerName, skills, onSave }: Props) {
  const { colors: Colors } = useTheme();
  const tab = useMemo(() => makeTab(Colors), [Colors]);
  const s = useMemo(() => makeStyles(Colors), [Colors]);

  const [mode, setMode] = useState<'self' | 'community'>('self');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<SkillKey, number>>(withDefaults(skills));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Em edição mostra o rascunho; fora dela, o que está salvo (com 5 nas que faltam).
  const shown = editing ? draft : withDefaults(skills);
  const values = SKILLS.map(sk => shown[sk.key]);
  const avg = skillAverage(shown);

  function startEdit() { setDraft(withDefaults(skills)); setMsg(null); setEditing(true); }
  function cancel() { setEditing(false); setMsg(null); }
  function setSkill(key: SkillKey, value: number) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try { await onSave(cleanSkills(draft)); setEditing(false); setMsg('Autoavaliação salva.'); }
    catch { setMsg('Não foi possível salvar. Verifique a conexão.'); }
    finally { setSaving(false); }
  }

  return (
    <View style={tab.content}>
      <View style={s.toggleRow}>
        <TouchableOpacity style={[s.toggle, mode === 'self' && s.toggleOn]} onPress={() => setMode('self')} activeOpacity={0.8}>
          <Text style={[s.toggleText, mode === 'self' && s.toggleTextOn]}>Minha Autoavaliação</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toggle, mode === 'community' && s.toggleOn]} onPress={() => setMode('community')} activeOpacity={0.8}>
          <Text style={[s.toggleText, mode === 'community' && s.toggleTextOn]}>Avaliação da Comunidade</Text>
        </TouchableOpacity>
      </View>

      {mode === 'community' ? (
        <CommunityRadar playerId={playerId} playerName={playerName} isSelf />
      ) : (
        <>
          <RadarChart values={values} />

          <Card>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.headTitle}>Minha Autoavaliação</Text>
                <Text style={s.note}>Notas de 1 a 10 em cada habilidade.</Text>
              </View>
              <View style={s.avgBox}>
                <Text style={s.avgVal}>{(avg ?? 0).toFixed(1).replace('.', ',')}</Text>
                <Text style={s.avgLbl}>média</Text>
              </View>
            </View>

            {editing ? <SkillSliders values={draft} onChange={setSkill} /> : <SkillGrid values={shown} />}
          </Card>

          {!!msg && <Text style={[s.note, { textAlign: 'center' }]}>{msg}</Text>}

          {editing ? (
            <View style={s.actions}>
              <TouchableOpacity style={s.ghost} onPress={cancel} disabled={saving} activeOpacity={0.8}>
                <Text style={s.ghostTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.save, { flex: 1 }, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
                <Text style={s.saveTxt}>{saving ? 'Salvando…' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.save} onPress={startEdit} activeOpacity={0.85} accessibilityRole="button">
              <View style={s.saveInner}>
                <Icon name="edit" size={18} color={Colors.bg} />
                <Text style={s.saveTxt}>Editar autoavaliação</Text>
              </View>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  toggleRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  toggle: { paddingHorizontal: 16, minHeight: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line },
  toggleOn: { backgroundColor: Colors.gold + '26', borderColor: Colors.gold },
  toggleText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  toggleTextOn: { fontFamily: FontFamily.title, color: Colors.gold },

  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  headTitle: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  note: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, color: Colors.muted },
  avgBox: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.md, backgroundColor: Colors.gold + '1F' },
  avgVal: { fontFamily: FontFamily.numberBold, fontSize: 22, color: Colors.gold },
  avgLbl: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },

  actions: { flexDirection: 'row', gap: Spacing.sm },
  ghost: { flex: 1, minHeight: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.line },
  ghostTxt: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.muted },
  save: { minHeight: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gold },
  saveInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveTxt: { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.bg },
});
