import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/icons';
import { FontFamily, Radius, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { todayLocal } from '@/logic/eventDateTime';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const p2 = (n: number) => String(n).padStart(2, '0');

/**
 * Calendário simples (sem biblioteca, igual na web e no celular) para escolher uma data.
 * `valueIso`/`onSelect` usam "AAAA-MM-DD". Sem data escolhida, abre no mês de hoje.
 */
export function CalendarModal({ visible, valueIso, onSelect, onClose }: {
  visible: boolean;
  valueIso?: string | null;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const hoje = todayLocal().iso;
  const inicial = valueIso && /^\d{4}-\d{2}-\d{2}$/.test(valueIso) ? valueIso : hoje;
  const [ano, setAno] = useState(Number(inicial.slice(0, 4)));
  const [mes, setMes] = useState(Number(inicial.slice(5, 7)) - 1);

  // Cada vez que abre, mostra o mês da data atual do campo (ou o de hoje)
  useEffect(() => {
    if (visible) { setAno(Number(inicial.slice(0, 4))); setMes(Number(inicial.slice(5, 7)) - 1); }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array.from({ length: primeiroDia }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas = Array.from({ length: celulas.length / 7 }, (_, i) => celulas.slice(i * 7, i * 7 + 7));

  function mover(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.card} activeOpacity={1}>
          <View style={s.head}>
            <TouchableOpacity onPress={() => mover(-1)} style={s.nav} hitSlop={8} accessibilityRole="button" accessibilityLabel="Mês anterior">
              <Icon name="chevronLeft" size={18} color={Colors.gold} />
            </TouchableOpacity>
            <Text style={s.titulo}>{MESES[mes]} {ano}</Text>
            <TouchableOpacity onPress={() => mover(1)} style={s.nav} hitSlop={8} accessibilityRole="button" accessibilityLabel="Próximo mês">
              <Icon name="chevronRight" size={18} color={Colors.gold} />
            </TouchableOpacity>
          </View>
          <View style={s.linha}>
            {SEMANA.map((d, i) => <Text key={i} style={s.diaSemana}>{d}</Text>)}
          </View>
          {semanas.map((sem, i) => (
            <View key={i} style={s.linha}>
              {sem.map((dia, j) => {
                if (dia == null) return <View key={j} style={s.celula} />;
                const iso = `${ano}-${p2(mes + 1)}-${p2(dia)}`;
                const sel = iso === valueIso;
                const ehHoje = iso === hoje;
                return (
                  <TouchableOpacity
                    key={j} style={[s.celula, sel && s.celulaSel, !sel && ehHoje && s.celulaHoje]}
                    onPress={() => { onSelect(iso); onClose(); }}
                    accessibilityRole="button" accessibilityLabel={`${dia} de ${MESES[mes]} de ${ano}`}
                  >
                    <Text style={[s.dia, sel && s.diaSel]}>{dia}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <View style={s.rodape}>
            <TouchableOpacity onPress={() => { onSelect(hoje); onClose(); }} hitSlop={8} accessibilityRole="button">
              <Text style={s.link}>Hoje</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button">
              <Text style={[s.link, { color: Colors.muted }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card: { width: '100%', maxWidth: 340, backgroundColor: Colors.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.gold + '55', padding: Spacing.md, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  nav: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.text },
  linha: { flexDirection: 'row' },
  diaSemana: { flex: 1, textAlign: 'center', fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted, paddingVertical: 4 },
  celula: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  celulaSel: { backgroundColor: Colors.gold },
  celulaHoje: { borderWidth: 1, borderColor: Colors.gold },
  dia: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  diaSel: { fontFamily: FontFamily.titleBold, color: Colors.bg },
  rodape: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 },
  link: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.gold },
});
