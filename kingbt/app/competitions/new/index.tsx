import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HexBackground } from '@/components/HexBackground';
import { ScreenHeader } from '@/components';
import { FontFamily, Spacing, Radius, centeredContent, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { WIN_RULE_PRESETS } from '@/constants/winRulePresets';
import { maskDate, maskTime, parseBrDate, todayLocal } from '@/logic/eventDateTime';
import {
  FORMAT_ORDER, FORMAT_BUTTON, FORMAT_HINT, FORMAT_NAME, LEVELS, GENDERS, emptyForm, missingFields,
  competitionsFromForm, formFromCompetition, seriesDates, createLabel, unitText, suggestedName, usedLocations, expectedCompetitors, estimateGames,
  minutesPerGame, durationMinutes, fmtMin, planWarnings, disputeSummary, digits, DRAFT_KEY, serializeDraft,
  parseDraft, hasDraftContent, type NewCompForm,
} from '@/logic/competitionPlan';
import type { Format, Gender, Unit } from '@/logic/types';
import {
  SectionTitle, FieldLabel, Hint, Notice, AppInput, ChipGroup, SelectField, Segment, ToggleRow, StepperRow, Box, SummaryRow, PrimaryButton,
} from '@/components/competition/FormKit';

const TIEBREAKS: Record<'liga' | 'grupos' | 'super8', { value: string; label: string }[]> = {
  liga: [{ value: 'saldo', label: 'Saldo de games' }, { value: 'confronto', label: 'Confronto direto' }, { value: 'vitorias', label: 'Vitórias' }],
  grupos: [{ value: 'saldo', label: 'Saldo de games' }, { value: 'confronto', label: 'Confronto direto' }],
  super8: [{ value: 'saldo', label: 'Saldo de games' }, { value: 'vitorias', label: 'Vitórias' }, { value: 'pontos', label: 'Pontos' }],
};

const SUPER8_ORDER_HINT: Record<string, string> = {
  saldo: 'Saldo de games; desempate: vitórias, depois confronto direto.',
  vitorias: 'Vitórias; desempate: saldo de games.',
  pontos: 'Pontos; desempate: confronto direto.',
};

const pad = (n: number) => String(n).padStart(2, '0');

export default function NewCompetition() {
  useRequireAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { state, addCompetition } = useCompetitions();
  const { myPlayerId } = useAuth();
  const [form, setForm] = useState<NewCompForm>(emptyForm);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);
  // "Repetir na próxima semana": abre o formulário já preenchido a partir de uma competição.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const prefilled = useRef(false);

  const set = useCallback((patch: Partial<NewCompForm>) => setForm(f => ({ ...f, ...patch })), []);

  // Restaura o rascunho uma única vez ao abrir.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        const d = parseDraft(raw);
        if (alive && !from && d && hasDraftContent(d.form)) { setForm(d.form); setSavedAt(d.savedAt); }
      } catch { /* sem rascunho */ }
      loaded.current = true;
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!from || prefilled.current) return;
    const src = state.competitions.find(c => c.id === from);
    if (!src) return;
    prefilled.current = true;
    setForm(formFromCompetition(src));
  }, [from, state.competitions]);

  // Salva sozinho, sem pressa, a cada mudança.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(async () => {
      try {
        if (hasDraftContent(form)) {
          const now = new Date();
          await AsyncStorage.setItem(DRAFT_KEY, serializeDraft(form, now));
          setSavedAt(now);
        } else {
          await AsyncStorage.removeItem(DRAFT_KEY);
          setSavedAt(null);
        }
      } catch { /* rascunho é conveniência */ }
    }, 600);
    return () => clearTimeout(t);
  }, [form]);

  const dateIso = parseBrDate(form.dateText);
  const nameSug = suggestedName(form.format, dateIso);
  const locations = useMemo(() => usedLocations(state.competitions), [state.competitions]);
  const miss = missingFields(form);
  const nEst = expectedCompetitors(form);
  const games = estimateGames(form.format, form.unit, nEst ?? 0);
  const mins = minutesPerGame(form);
  const warns = planWarnings(form.format, nEst);

  function pickFormat(format: Format) {
    setForm(f => {
      const next: NewCompForm = { ...f, format };
      if (format === 'avulso' && !f.dateText) { next.dateText = todayLocal().br; next.dateAuto = true; }
      else if (format !== 'avulso' && f.dateAuto) { next.dateText = ''; next.dateAuto = false; }
      next.tiebreak = 'saldo';
      return next;
    });
  }

  async function create() {
    if (busy || miss.length > 0) return;
    setBusy(true);
    try {
      const comps = competitionsFromForm(form, myPlayerId);
      const ids: string[] = [];
      for (const c of comps) ids.push(await addCompetition(c));
      try { await AsyncStorage.removeItem(DRAFT_KEY); } catch { /* ok */ }
      if (comps.length > 1) router.replace('/(app)');
      else router.replace({ pathname: '/competitions/[id]', params: { id: ids[0] } });
    } finally {
      setBusy(false);
    }
  }

  const unitOptions: { value: Unit; label: string }[] = [
    { value: 'individual', label: 'Individual' },
    { value: 'duplas', label: 'Duplas' },
  ];

  const draftLine = savedAt ? `Rascunho salvo automaticamente · ${pad(savedAt.getHours())}:${pad(savedAt.getMinutes())}` : '';
  const headerSummary = [
    form.format && FORMAT_NAME[form.format], form.unit === 'duplas' ? 'Duplas' : form.unit === 'individual' ? 'Individual' : null,
    GENDERS.find(g => g.value === form.gender)?.label,
    form.level && (form.level === 'Aberta' ? 'categoria aberta' : `categoria ${form.level}`),
  ].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <HexBackground />
      <ScreenHeader
        title="Nova competição"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
      />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.meta}>
          <Text style={s.draft}>{draftLine}</Text>
          {headerSummary ? <Text style={s.chipSum}>{headerSummary}</Text> : null}
        </View>

        {/* ── Informações gerais ── */}
        <SectionTitle>Informações gerais</SectionTitle>

        <FieldLabel required>Nome da competição</FieldLabel>
        <AppInput
          value={form.name} onChangeText={name => set({ name })}
          placeholder={nameSug ? `Ex.: ${nameSug}` : 'Ex.: Super 8 · 10/10'}
          accessibilityLabel="Nome da competição"
        />
        {nameSug && !form.name.trim() ? (
          <View style={s.sugRow}>
            <TouchableOpacity style={s.sugChip} onPress={() => set({ name: nameSug })} activeOpacity={0.8}>
              <Text style={s.sugText}>Usar sugestão: {nameSug}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <FieldLabel required>Tipo de competição</FieldLabel>
        <SelectField
          title="Tipo de competição" options={FORMAT_ORDER.map(f => ({ value: f, label: FORMAT_BUTTON[f], desc: FORMAT_HINT[f] }))}
          value={form.format} onChange={pickFormat}
        />
        <Hint>{form.format ? FORMAT_HINT[form.format] : 'Escolha o tipo de competição.'}</Hint>

        <FieldLabel required>Competem em</FieldLabel>
        <SelectField title="Competem em" options={unitOptions} value={form.unit} onChange={unit => set({ unit })} />
        {unitText(form.format, form.unit) ? <Hint>{unitText(form.format, form.unit)}</Hint> : null}

        <FieldLabel required>Gênero</FieldLabel>
        <SelectField title="Gênero" options={GENDERS} value={form.gender} onChange={(gender: Gender) => set({ gender })} />

        <FieldLabel required>Categoria de nível</FieldLabel>
        <SelectField
          title="Categoria de nível"
          options={LEVELS.map(l => ({ value: l, label: l, desc: l === 'Aberta' ? 'Qualquer nível pode participar' : `Só jogadores da categoria ${l}` }))}
          value={form.level} onChange={level => set({ level })}
        />
        <Hint>Aberta: qualquer nível pode participar. Uma categoria específica: só jogadores dessa categoria (a do perfil) podem se inscrever.</Hint>

        <View style={s.row2}>
          <View style={{ flex: 3 }}>
            <FieldLabel required>Data</FieldLabel>
            <AppInput
              value={form.dateText} onChangeText={t => set({ dateText: maskDate(t), dateAuto: false })}
              placeholder="DD/MM/AAAA" keyboardType="number-pad" maxLength={10}
            />
          </View>
          <View style={{ flex: 2 }}>
            <FieldLabel required={form.registrationOn}>Horário</FieldLabel>
            <AppInput
              value={form.timeText} onChangeText={t => set({ timeText: maskTime(t) })}
              placeholder="20:00" keyboardType="number-pad" maxLength={5}
            />
          </View>
        </View>

        <FieldLabel>Local (opcional)</FieldLabel>
        <AppInput value={form.location} onChangeText={location => set({ location })} placeholder="Ex.: Arena Beach, quadras 1 e 2" />
        {!form.location.trim() && locations.length > 0 ? (
          <View style={s.sugRow}>
            {locations.map(l => (
              <TouchableOpacity key={l} style={s.sugChip} onPress={() => set({ location: l })} activeOpacity={0.8}>
                <Text style={s.sugText} numberOfLines={1}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <FieldLabel>Descrição (opcional)</FieldLabel>
        <AppInput
          value={form.notes} onChangeText={notes => set({ notes })} multiline
          placeholder="Critério de desempate, premiação, observações…"
        />

        {/* ── Série semanal ── */}
        <SectionTitle>Série semanal (opcional)</SectionTitle>
        <ToggleRow
          title="Repetir toda semana"
          subtitle="Cria várias competições iguais de uma vez, uma por semana, a partir da data escolhida."
          value={form.repeatWeeks > 1} onChange={on => set({ repeatWeeks: on ? 4 : 1 })}
        />
        {form.repeatWeeks > 1 ? (
          <View>
            <StepperRow label="Quantas semanas" value={form.repeatWeeks} min={2} max={12} onChange={repeatWeeks => set({ repeatWeeks })} />
            <Hint>
              {dateIso
                ? `Cria ${form.repeatWeeks} competições, uma por semana: ${seriesDates(dateIso, form.repeatWeeks).map(d => d.split('-').reverse().slice(0, 2).join('/')).join(', ')}.`
                : 'Escolha a data para ver as datas da série.'}
            </Hint>
          </View>
        ) : null}

        {/* ── Inscrições ── */}
        <SectionTitle>Inscrições (opcional)</SectionTitle>
        <ToggleRow
          title="Abrir inscrições"
          subtitle={form.registrationOn
            ? 'Os jogadores pedem para entrar; você aprova e depois fecha a lista.'
            : 'Desligado: depois de criar, o admin adiciona os jogadores na página da competição.'}
          value={form.registrationOn} onChange={registrationOn => set({ registrationOn })}
        />
        {form.registrationOn ? (
          <View>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Vagas ({form.unit === 'duplas' ? 'duplas' : 'atletas'})</FieldLabel>
                <AppInput
                  value={form.noLimit ? '' : form.vagasText} editable={!form.noLimit}
                  onChangeText={t => set({ vagasText: digits(t).slice(0, 3) })}
                  placeholder={form.noLimit ? 'Sem limite' : 'Ex.: 8'} keyboardType="number-pad" maxLength={3}
                />
              </View>
            </View>
            <FieldLabel>Status</FieldLabel>
            <ChipGroup
              options={[
                { value: 'open', label: 'Inscrições abertas' },
                { value: 'closed', label: 'Inscrições fechadas' },
                { value: 'adminOnly', label: 'Só o admin adiciona' },
              ]}
              value={form.regMode} onChange={regMode => set({ regMode })}
            />
            <ToggleRow
              title="Sem limite de vagas" subtitle="Todo mundo que pedir entra, sem lista de espera."
              value={form.noLimit} onChange={noLimit => set({ noLimit, ...(noLimit ? { vagasText: '' } : {}) })}
            />
            <ToggleRow
              title="Agendar abertura" subtitle="As inscrições abrem sozinhas na data e hora escolhidas."
              value={form.scheduleOpen} onChange={scheduleOpen => set({ scheduleOpen })}
            />
            {form.scheduleOpen ? (
              <View style={s.row2}>
                <View style={{ flex: 3 }}>
                  <FieldLabel>Abre em</FieldLabel>
                  <AppInput value={form.opensDateText} onChangeText={t => set({ opensDateText: maskDate(t) })} placeholder="DD/MM/AAAA" keyboardType="number-pad" maxLength={10} />
                </View>
                <View style={{ flex: 2 }}>
                  <FieldLabel>Hora</FieldLabel>
                  <AppInput value={form.opensTimeText} onChangeText={t => set({ opensTimeText: maskTime(t) })} placeholder="08:00" keyboardType="number-pad" maxLength={5} />
                </View>
              </View>
            ) : null}
            {!form.noLimit ? (
              <>
                <FieldLabel>Lista de espera</FieldLabel>
                <Segment
                  options={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }]}
                  value={form.waitlist ? 'sim' : 'nao'} onChange={v => set({ waitlist: v === 'sim' })}
                />
              </>
            ) : null}
            <FieldLabel>Cancelar até (h antes)</FieldLabel>
            <AppInput value={form.cancelHoursText} onChangeText={t => set({ cancelHoursText: digits(t).slice(0, 3) })} keyboardType="number-pad" maxLength={3} placeholder="10" />
          </View>
        ) : null}

        {/* ── Configuração do formato ── */}
        <SectionTitle>{form.format ? `Configuração · ${FORMAT_NAME[form.format]}` : 'Configuração do formato'}</SectionTitle>
        <Box>
          {!form.format ? <Text style={s.empty}>Escolha o tipo de competição para ver as configurações.</Text> : null}
          {form.format === 'liga' ? (
            <>
              <View style={s.row2}>
                <View style={{ flex: 1 }}><FieldLabel>Pontos por vitória</FieldLabel><AppInput value={form.winPts} onChangeText={t => set({ winPts: digits(t).slice(0, 2) })} keyboardType="number-pad" /></View>
                <View style={{ flex: 1 }}><FieldLabel>Pontos por empate</FieldLabel><AppInput value={form.drawPts} onChangeText={t => set({ drawPts: digits(t).slice(0, 2) })} keyboardType="number-pad" /></View>
              </View>
              <FieldLabel>Critério de desempate</FieldLabel>
              <ChipGroup options={TIEBREAKS.liga} value={form.tiebreak} onChange={tiebreak => set({ tiebreak })} />
              <Notice>Turno único ou ida e volta: escolhido <Text style={s.bold}>ao fechar a lista</Text>, já com a estimativa de jogos.</Notice>
            </>
          ) : null}
          {form.format === 'grupos' ? (
            <>
              <FieldLabel>Pontos por vitória</FieldLabel>
              <AppInput value={form.winPts} onChangeText={t => set({ winPts: digits(t).slice(0, 2) })} keyboardType="number-pad" />
              <FieldLabel>Critério de desempate</FieldLabel>
              <ChipGroup options={TIEBREAKS.grupos} value={form.tiebreak} onChange={tiebreak => set({ tiebreak })} />
              <Notice>Nº de grupos, classificados, melhores 3ºs e turnos são definidos <Text style={s.bold}>depois de fechar as inscrições</Text>, com sugestão automática pelo número de inscritos.</Notice>
            </>
          ) : null}
          {form.format === 'mata' ? (
            <>
              <ToggleRow title="Disputa de 3º lugar" value={form.thirdPlace} onChange={thirdPlace => set({ thirdPlace })} />
              <Notice>O chaveamento é sorteado <Text style={s.bold}>quando a lista fecha</Text>.</Notice>
            </>
          ) : null}
          {form.format === 'avulso' ? (
            <Notice>Sem calendário fixo e sem chaveamento. Depois de criar, você lança cada jogo à mão.</Notice>
          ) : null}
          {form.format === 'super8' ? (
            <>
              <View style={s.row2}>
                <View style={{ flex: 1 }}><FieldLabel>Pontos por vitória</FieldLabel><AppInput value={form.winPts} onChangeText={t => set({ winPts: digits(t).slice(0, 2) })} keyboardType="number-pad" /></View>
                <View style={{ flex: 1 }}><FieldLabel>Pontos por saldo de games</FieldLabel><AppInput value={form.gdPts} onChangeText={t => set({ gdPts: digits(t).slice(0, 2) })} keyboardType="number-pad" /></View>
              </View>
              <FieldLabel>Critério de ordenação da classificação final</FieldLabel>
              <ChipGroup options={TIEBREAKS.super8} value={form.tiebreak} onChange={tiebreak => set({ tiebreak })} />
              <Hint>{SUPER8_ORDER_HINT[form.tiebreak] ?? ''}</Hint>
            </>
          ) : null}
        </Box>

        {/* ── Formato de disputa ── */}
        <SectionTitle required>Formato de disputa</SectionTitle>
        <Hint>Como cada jogo é decidido. Escolha um preset ou configure manualmente. MD1 = 1 set; MD3 = melhor de 3 sets.</Hint>
        <SelectField
          title="Formato de disputa"
          options={[
            ...WIN_RULE_PRESETS.map((p, i) => ({ value: `p${i}`, label: p.label, desc: p.desc })),
            { value: 'manual', label: 'Configurar manualmente', desc: 'Sets, games, tie-break e super tie-break' },
          ]}
          value={form.manual ? 'manual' : form.presetIndex !== null ? `p${form.presetIndex}` : null}
          onChange={v => (v === 'manual' ? set({ manual: true, presetIndex: null }) : set({ presetIndex: parseInt(v.slice(1), 10), manual: false }))}
        />
        {form.manual ? (
          <Box>
            <FieldLabel>Quantos sets</FieldLabel>
            <Segment
              options={[{ value: '1', label: '1 set' }, { value: '3', label: 'Melhor de 3' }, { value: '5', label: 'Melhor de 5' }]}
              value={form.sets ? String(form.sets) : null} onChange={v => set({ sets: parseInt(v, 10) })}
            />
            <StepperRow label="Games por set" value={form.games} min={1} max={12} onChange={games => set({ games })} />
            <StepperRow label="Pontos do tie-break" value={form.tiebreakPts} min={5} max={15} onChange={tiebreakPts => set({ tiebreakPts })} />
            {form.sets && form.sets > 1 ? (
              <>
                <ToggleRow
                  title="Super tie-break no set decisivo" subtitle={`${form.sets}º set substituído por super tie-break`}
                  value={form.superTiebreak} onChange={superTiebreak => set({ superTiebreak })}
                />
                {form.superTiebreak ? (
                  <StepperRow label="Pontos do super tie-break" value={form.superTiebreakPts} min={7} max={15} onChange={superTiebreakPts => set({ superTiebreakPts })} />
                ) : null}
              </>
            ) : null}
            <ToggleRow
              title="Usar regras oficiais BT" subtitle="Valida placares: 6-0 a 6-4, 7-5, 7-6 (TB)"
              value={form.officialRules} onChange={officialRules => set({ officialRules })}
            />
          </Box>
        ) : null}

        {/* ── Ranking ── */}
        <SectionTitle>Ranking</SectionTitle>
        <ToggleRow
          title="Vale pontos no ranking" subtitle="Desligado, vira uma competição amistosa."
          value={form.countsForRanking} onChange={countsForRanking => set({ countsForRanking })}
        />
        {!form.countsForRanking ? (
          <Notice tone="coral">
            <Text style={s.bold}>Competição amistosa:</Text> não conta para o ranking, nem para o XP, as conquistas ou a avaliação dos colegas.
          </Notice>
        ) : null}

        <ToggleRow
          title="Confirmar placares" subtitle="O placar lançado por um jogador só vale depois que o adversário confirma. Quem criou a competição e o admin lançam direto."
          value={form.requireConfirmation} onChange={requireConfirmation => set({ requireConfirmation })}
        />

        {/* ── Resumo ── */}
        <View style={s.summary}>
          <Text style={s.sumTitle}>Resumo antes de criar</Text>
          <SummaryRow
            label="Competição"
            value={(form.format ? FORMAT_NAME[form.format] : '—') + (form.unit ? ` · ${form.unit === 'duplas' ? 'Duplas' : 'Individual'}` : '')
              + (form.gender ? ` · ${GENDERS.find(g => g.value === form.gender)?.label}` : '')
              + (form.level ? ` · ${form.level === 'Aberta' ? 'Aberta' : `Cat. ${form.level}`}` : '')}
          />
          <SummaryRow
            label="Quem joga"
            value={form.registrationOn
              ? (form.noLimit ? 'Inscrições sem limite de vagas' : nEst ? `${nEst} vagas, com inscrições` : 'Inscrições (defina as vagas)')
              : 'O admin adiciona depois de criar'}
          />
          <SummaryRow label="Cada jogo" value={disputeSummary(form) ?? '—'} />
          <SummaryRow label="Ranking" value={form.countsForRanking ? 'Vale ranking' : 'Competição amistosa'} />
          <SummaryRow
            label="Estimativa"
            last
            value={form.format === 'avulso' ? 'Sem jogos pré-definidos.'
              : nEst && games != null
                ? `≈ ${games} jogos${mins ? ` · ≈ ${fmtMin(durationMinutes(games, mins, form.courts))} com ${form.courts} ${form.courts === 1 ? 'quadra' : 'quadras'}` : ''}${form.format === 'liga' || form.format === 'grupos' ? ' (turno único)' : ''}`
                : form.registrationOn ? 'Defina as vagas para ver.' : 'Calculada quando você adicionar os jogadores.'}
          />
          <StepperRow label="Quadras disponíveis" sub="só para estimar a duração" value={form.courts} min={1} max={20} onChange={courts => set({ courts })} />
          {warns.length ? <Text style={s.warn}>{warns.join(' ')}</Text> : null}
        </View>

        <View style={{ marginTop: Spacing.md }}>
          <PrimaryButton label={createLabel(form)} onPress={create} disabled={miss.length > 0} busy={busy} />
        </View>
        {miss.length ? <Text style={s.miss}>Falta preencher: {miss.join(', ')}.</Text> : null}
        <Text style={s.after}>
          {form.repeatWeeks > 1 ? 'Depois de criar, as competições aparecem na lista de Competições.'
            : form.format === 'avulso' ? 'Depois de criar, você lança cada jogo à mão.'
            : form.registrationOn ? 'Depois de criar, as inscrições ficam abertas até você fechar a lista.'
            : 'Depois de criar, você adiciona os jogadores na página da competição.'}
        </Text>
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { ...centeredContent, paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  meta: { minHeight: 36, gap: 2 },
  draft: { fontFamily: FontFamily.body, fontSize: 14, color: C.teal, minHeight: 18 },
  chipSum: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.gold },
  row2: { flexDirection: 'row', gap: Spacing.sm },
  sugRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  sugChip: { minHeight: 44, paddingHorizontal: 14, borderRadius: Radius.full, borderWidth: 1, borderStyle: 'dashed', borderColor: C.gold + '88', justifyContent: 'center', maxWidth: '100%' },
  sugText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.gold },
  empty: { fontFamily: FontFamily.body, fontSize: 14, color: C.faint, paddingTop: Spacing.md },
  bold: { fontFamily: FontFamily.title },
  summary: { backgroundColor: C.surf, borderWidth: 1, borderColor: C.gold + '99', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginTop: Spacing.lg },
  sumTitle: { fontFamily: FontFamily.titleBold, fontSize: 14, letterSpacing: 1.3, color: C.gold, textTransform: 'uppercase', paddingVertical: Spacing.sm },
  warn: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: C.gold, paddingVertical: Spacing.sm },
  miss: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: C.coral, textAlign: 'center', marginTop: Spacing.sm },
  after: { fontFamily: FontFamily.body, fontSize: 14, color: C.muted, textAlign: 'center', marginTop: Spacing.sm },
});
