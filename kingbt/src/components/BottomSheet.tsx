import { Animated, View, PanResponder, Dimensions, StyleSheet, Pressable, Platform } from 'react-native';
import { useEffect, useRef, useMemo } from 'react';
import { Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

const { height: SCREEN_H } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  height?: number;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, height = 400, children }: BottomSheetProps) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const open = () => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, bounciness: 0, speed: 14, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const close = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SCREEN_H, duration: 240, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_H);
      open();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, g) => g.dy > 0,
      onMoveShouldSetPanResponder:  (_, g) => g.dy > 0,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          close();
        } else {
          Animated.spring(translateY, { toValue: 0, bounciness: 0, speed: 14, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <>
      <Animated.View style={[s.overlay, { opacity: overlayOpacity }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <Animated.View
        style={[s.sheet, { height, transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <View style={s.handle} />
        {children}
      </Animated.View>
    </>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 40,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surf,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 50,
    paddingBottom: Spacing.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.muted,
    alignSelf: 'center',
    marginVertical: Spacing.sm,
    opacity: 0.5,
  },
});
