import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { FontFamily } from '@/theme';
import type { Achievement } from '@/constants/achievements';

interface Props {
  achievement: Achievement | null;
  visible: boolean;
  onClose: () => void;
}

export function AchievementUnlockedModal({ achievement, visible, onClose }: Props) {
  const scaleAnim   = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.6);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!achievement) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[m.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[
          m.modal,
          { borderColor: `${achievement.color}44`, transform: [{ scale: scaleAnim }] },
        ]}>
          {/* Glow ring */}
          <View style={[m.glowRing, { borderColor: `${achievement.color}30` }]} />

          <Text style={m.icon}>{achievement.icon}</Text>
          <Text style={[m.badgeUnlocked, { color: achievement.color }]}>
            Badge Desbloqueado!
          </Text>
          <Text style={m.badgeTitle}>{achievement.title}</Text>
          <Text style={m.badgeDesc}>{achievement.description}</Text>

          <TouchableOpacity
            style={[m.btn, { backgroundColor: achievement.color }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={m.btnText}>Continuar 🎉</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center',
  },
  modal: {
    backgroundColor: '#16140F',
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '80%',
    gap: 8,
  },
  glowRing: {
    position: 'absolute',
    top: -1, left: -1, right: -1, bottom: -1,
    borderRadius: 21, borderWidth: 6,
  },
  icon:         { fontSize: 64, lineHeight: 72, marginBottom: 4 },
  badgeUnlocked:{ fontFamily: FontFamily.titleBold, fontSize: 18, fontWeight: '800' },
  badgeTitle:   { fontFamily: FontFamily.title, fontSize: 15, color: '#F6EFDD', fontWeight: '700' },
  badgeDesc:    { fontFamily: FontFamily.body, fontSize: 12, color: '#A99B7C', textAlign: 'center', lineHeight: 18 },
  btn: {
    marginTop: 12,
    paddingHorizontal: 40, paddingVertical: 13,
    borderRadius: 12,
  },
  btnText: { fontFamily: FontFamily.title, color: '#000', fontWeight: '700', fontSize: 14 },
});
