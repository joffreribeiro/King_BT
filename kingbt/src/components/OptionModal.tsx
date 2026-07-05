import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import Avatar from './Avatar';

export interface OptionItem {
  key: string;
  label: string;
  color?: string;      // cor do texto (opcional)
  avatarColor?: string; // mostra Avatar com essa cor (opcional)
}

/**
 * Modal de escolha de opção multiplataforma.
 * Substitui Alert.alert com botões, que não funciona no React Native Web.
 */
export function OptionModal({ title, message, options, onSelect, onClose }: {
  title: string;
  message?: string;
  options: OptionItem[];
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const { colors: Colors } = useTheme();
  const om = useMemo(() => makeOmStyles(Colors), [Colors]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={om.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={om.box} activeOpacity={1}>
          <Text style={om.title}>{title}</Text>
          {message ? <Text style={om.message}>{message}</Text> : null}
          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {options.map((o, i) => (
              <TouchableOpacity
                key={o.key}
                style={[om.option, i < options.length - 1 && om.optionBorder]}
                onPress={() => onSelect(o.key)}
                activeOpacity={0.7}
              >
                {o.avatarColor && <Avatar name={o.label} color={o.avatarColor} size={26} />}
                <Text style={[om.optionText, o.color ? { color: o.color } : null]} numberOfLines={1}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={om.cancel} onPress={onClose} activeOpacity={0.8}>
            <Text style={om.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeOmStyles = (Colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  box: { backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 420, gap: Spacing.sm },
  title: { fontFamily: FontFamily.titleBold, fontSize: 17, color: Colors.text },
  message: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.xs },
  optionBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  optionText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text, flex: 1 },
  cancel: { borderWidth: 1.5, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center', marginTop: Spacing.xs },
  cancelText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted },
});
