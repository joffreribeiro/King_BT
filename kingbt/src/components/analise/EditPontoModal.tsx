import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import type { BtPonto, BtFinalizacao } from '@/logic/btTracker';
import { Chip } from './Chip';

export function EditPontoModal({ ponto, nomes, jogadoresA, jogadoresB, onSave, onClose }: {
  ponto: BtPonto;
  nomes: Record<string, string>;
  jogadoresA: string[];
  jogadoresB: string[];
  onSave: (p: BtPonto) => void;
  onClose: () => void;
}) {
  const todosJogadores = [...jogadoresA, ...jogadoresB];
  const nome = (id: string) => nomes[id]?.split(' ')[0] ?? id;

  const [vencedor, setVencedor] = useState<'A' | 'B'>(ponto.vencedorDupla);
  const [finalizacao, setFinalizacao] = useState<BtFinalizacao>(ponto.finalizacao);
  const [sacador, setSacador] = useState(ponto.sacador);

  const FINS: { key: BtFinalizacao; label: string }[] = [
    { key: 'Ace',            label: 'Ace' },
    { key: 'Winner',         label: 'Winner' },
    { key: 'ForçouErro',     label: 'Forçou Erro' },
    { key: 'ErroNaoForcado', label: 'Erro n. forçado' },
    { key: 'ErroSaque',      label: 'Erro de Saque' },
    { key: 'ErroDevolucao',  label: 'Erro de devolução' },
  ];

  return (
    <View>
      <Text style={ep.title}>Editar Ponto</Text>
      <Text style={ep.sub}>{ponto.setScore} · {ponto.gameScore}</Text>

      <Text style={ep.label}>Sacador</Text>
      <View style={ep.row}>
        {todosJogadores.map(id => (
          <Chip key={id} label={nome(id)} selected={sacador === id}
            onPress={() => setSacador(id)}
            color={jogadoresA.includes(id) ? Colors.gold : Colors.teal} small />
        ))}
      </View>

      <Text style={ep.label}>Vencedor do ponto</Text>
      <View style={ep.row}>
        <Chip label={jogadoresA.map(nome).join(' / ')} selected={vencedor === 'A'}
          onPress={() => setVencedor('A')} color={Colors.gold} />
        <Chip label={jogadoresB.map(nome).join(' / ')} selected={vencedor === 'B'}
          onPress={() => setVencedor('B')} color={Colors.teal} />
      </View>

      <Text style={ep.label}>Finalização</Text>
      <View style={ep.row}>
        {FINS.map(f => (
          <Chip key={f.key} label={f.label} selected={finalizacao === f.key}
            onPress={() => setFinalizacao(f.key)} small />
        ))}
      </View>

      <View style={ep.btnRow}>
        <TouchableOpacity style={ep.btnCancel} onPress={onClose}>
          <Text style={ep.btnCancelTxt}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ep.btnSave}
          onPress={() => onSave({ ...ponto, sacador, vencedorDupla: vencedor, finalizacao })}>
          <Text style={ep.btnSaveTxt}>Salvar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ep = StyleSheet.create({
  title:      { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.text, marginBottom: 2 },
  sub:        { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted, marginBottom: Spacing.md },
  label:      { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted, marginTop: Spacing.sm, marginBottom: 4 },
  row:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  btnRow:     { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  btnCancel:  { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  btnCancelTxt: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  btnSave:    { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  btnSaveTxt: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg },
});
