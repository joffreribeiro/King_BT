import { View, Text, StyleSheet, ScrollView } from 'react-native';
import React from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import type { Competition } from '@/logic/types';

export function RulesView({ comp }: { comp: Competition }) {
  const wr = comp.config.winRule;

  const formatName: Record<string, string> = {
    liga: 'Liga', grupos: 'Grupos + Mata-mata', mata: 'Mata-mata', avulso: 'Avulso', super8: 'Super 8',
  };
  const unitName: Record<string, string> = { individual: 'Individual', duplas: 'Duplas' };
  const genderName: Record<string, string> = { masculino: 'Masculino', feminino: 'Feminino', misto: 'Misto' };

  const sets = wr.sets ?? 3;
  const games = wr.games ?? 6;
  const tb = wr.tiebreak ?? 7;
  const superTb = wr.superTiebreak ?? false;
  const superTbPts = wr.superTiebreakPts ?? 10;

  function RuleRow({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
    return (
      <View style={rls.row}>
        <Text style={rls.icon}>{icon}</Text>
        <Text style={rls.label}>{label}</Text>
        <Text style={[rls.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      </View>
    );
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View style={rls.section}>
        <Text style={rls.sectionTitle}>{title}</Text>
        <View style={rls.card}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={rls.scroll} showsVerticalScrollIndicator={false}>

      {/* Informações gerais */}
      <Section title="INFORMAÇÕES GERAIS">
        <RuleRow icon="🏆" label="Formato" value={formatName[comp.format] ?? comp.format} />
        <View style={rls.divider} />
        <RuleRow icon="👥" label="Modalidade" value={unitName[comp.unit] ?? comp.unit} />
        <View style={rls.divider} />
        <RuleRow icon="⚧" label="Categoria" value={genderName[comp.gender] ?? comp.gender} />
        {comp.location && (
          <>
            <View style={rls.divider} />
            <RuleRow icon="📍" label="Local" value={comp.location} />
          </>
        )}
        <View style={rls.divider} />
        <RuleRow icon="📅" label="Data" value={new Date(comp.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} />
        <View style={rls.divider} />
        <RuleRow icon="🎮" label="Participantes" value={`${comp.competitors.length} jogadores`} />
      </Section>

      {/* Regras do jogo */}
      <Section title="REGRAS DO JOGO">
        <RuleRow icon="🎯" label="Sets para vencer" value={`Melhor de ${sets} set${sets > 1 ? 's' : ''}`} valueColor={Colors.gold} />
        <View style={rls.divider} />
        <RuleRow icon="🎾" label="Games por set" value={`${games} games`} valueColor={Colors.gold} />
        <View style={rls.divider} />
        <RuleRow icon="⚡" label="Tie-break" value={`Primeiro a ${tb} pontos`} />
        <View style={rls.divider} />
        <RuleRow
          icon="🔥"
          label={`Set decisivo (${sets}º set)`}
          value={superTb ? `Super Tie-Break (${superTbPts} pts)` : `Set completo (${games} games)`}
          valueColor={superTb ? Colors.coral : Colors.muted}
        />
      </Section>

      {/* Pontuação */}
      <Section title="PONTUAÇÃO">
        <RuleRow icon="🥇" label="Vitória" value="+3 pontos" valueColor={Colors.teal} />
        <View style={rls.divider} />
        <RuleRow icon="🥈" label="Derrota" value="+0 pontos" valueColor={Colors.muted} />
        <View style={rls.divider} />
        <RuleRow icon="📊" label="Jogo disputado" value="+0.5 pontos" />
      </Section>

      {/* Critérios de desempate */}
      <Section title="CRITÉRIOS DE DESEMPATE">
        {[
          { n: '1º', label: 'Confronto direto entre empatados' },
          { n: '2º', label: 'Maior saldo de games (GP − GC)' },
          { n: '3º', label: 'Maior GA (games pró ÷ games contra)' },
          { n: '4º', label: 'Maior número de vitórias' },
          { n: '5º', label: 'Alfabético (último recurso)' },
        ].map((c, i) => (
          <View key={i}>
            {i > 0 && <View style={rls.divider} />}
            <View style={rls.row}>
              <View style={rls.tiebreakBadge}>
                <Text style={rls.tiebreakN}>{c.n}</Text>
              </View>
              <Text style={[rls.label, { flex: 1 }]}>{c.label}</Text>
            </View>
          </View>
        ))}
      </Section>

      {/* Observações */}
      {comp.notes && (
        <Section title="OBSERVAÇÕES">
          <Text style={rls.notes}>{comp.notes}</Text>
        </Section>
      )}

      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

const rls = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.md },
  section: { gap: Spacing.xs },
  sectionTitle: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.muted, letterSpacing: 1.5, paddingLeft: 2 },
  card: { backgroundColor: Colors.surf, borderRadius: Radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.line, marginHorizontal: Spacing.md },
  icon: { fontSize: 16, width: 24, textAlign: 'center' },
  label: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, flex: 1 },
  value: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text, textAlign: 'right', flexShrink: 0, maxWidth: '55%' },
  tiebreakBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.gold + '22', alignItems: 'center', justifyContent: 'center' },
  tiebreakN: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold },
  notes: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, lineHeight: 20, padding: Spacing.md },
});
