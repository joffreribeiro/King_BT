import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

export function EditNameModal({ current, title = 'Renomear competição', subtitle, onClose, onSave }: {
  current: string; title?: string; subtitle?: string; onClose: () => void; onSave: (name: string) => void;
}) {
  const { colors: Colors } = useTheme();
  const en = useMemo(() => makeEnStyles(Colors), [Colors]);
  const [name, setName] = useState(current);
  const valid = name.trim().length > 0 && name.trim() !== current;
  return (
    <Modal visible transparent animationType="fade">
      <TouchableOpacity style={en.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={en.box} activeOpacity={1}>
          <Text style={en.title}>{title}</Text>
          {subtitle && <Text style={en.subtitle}>{subtitle}</Text>}
          <TextInput
            style={en.input}
            value={name}
            onChangeText={setName}
            autoFocus
            selectTextOnFocus
            placeholderTextColor={Colors.faint}
          />
          <View style={en.btns}>
            <TouchableOpacity style={en.cancel} onPress={onClose}>
              <Text style={en.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[en.save, !valid && en.saveOff]}
              onPress={() => { if (valid) { onSave(name.trim()); onClose(); } }}
              disabled={!valid}
            >
              <Text style={en.saveText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeEnStyles = (Colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  box: { backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', gap: Spacing.md },
  title: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: -8 },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontFamily: FontFamily.body, fontSize: 16, color: Colors.text,
  },
  btns: { flexDirection: 'row', gap: Spacing.sm },
  cancel: { flex: 1, borderWidth: 1.5, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  cancelText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted },
  save: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  saveOff: { opacity: 0.4 },
  saveText: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
});
