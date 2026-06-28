import { Tabs, router } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Modal, ScrollView, Pressable, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useEffect, useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { useSyncQueue } from '@/store/SyncQueueContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { Avatar } from '@/components';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Svg, { Path, Rect, Circle, Polyline } from 'react-native-svg';
import type { ReactElement } from 'react';

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function IconFeed({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12h3l3-7 3 14 3-10 3 5h3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCompetitions({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 2h8v8a4 4 0 01-8 0V2z" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
      <Path d="M5 3H3v4a4 4 0 004 4M19 3h2v4a4 4 0 01-4 4M12 14v4M9 21h6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    </Svg>
  );
}
function IconRanking({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 3h10v9c0 2.76-2.24 5-5 5s-5-2.24-5-5V3z" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
      <Path d="M7 7H4v3a3 3 0 003 3M17 7h3v3a3 3 0 01-3 3M12 17v2M9 21h6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    </Svg>
  );
}
function IconProfile({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" fill="none" />
      <Path d="M4 21c0-3.87 3.58-7 8-7s8 3.13 8 7" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const TAB_CONFIG: Record<string, { icon: (p: { color: string; size: number }) => ReactElement; label: string }> = {
  feed:    { icon: IconFeed,         label: 'Atividade'    },
  index:   { icon: IconCompetitions, label: 'Competições'  },
  ranking: { icon: IconRanking,      label: 'Ranking'      },
  profile: { icon: IconProfile,      label: 'Eu'           },
};

// ── Drawer ────────────────────────────────────────────────────────────────────
function DrawerMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { logout, group, user } = useAuth();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 240, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  async function handleLogout() {
    onClose();
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Overlay */}
      <Animated.View style={[dr.overlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View style={[dr.panel, { transform: [{ translateX: slideAnim }] }]}>
        {/* Header */}
        <View style={dr.header}>
          <View>
            <Text style={dr.headerTitle}>Menu</Text>
            {group && <Text style={dr.headerSub}>{group.name}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={dr.closeBtn}>
            <Text style={dr.closeBtnTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={dr.content} showsVerticalScrollIndicator={false}>

          {/* Meus Grupos */}
          <Text style={dr.sectionLabel}>MEUS GRUPOS</Text>
          {group && (
            <TouchableOpacity style={[dr.groupBtn, dr.groupBtnActive]}>
              <Text style={dr.groupBtnTxtActive}>{group.name}</Text>
              <Text style={{ color: Colors.gold, fontSize: 14 }}>✓</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={dr.groupBtnNew} onPress={() => { onClose(); router.push('/(auth)/groups'); }}>
            <Text style={dr.groupBtnNewTxt}>+ Trocar de grupo</Text>
          </TouchableOpacity>

          <View style={dr.divider} />

          {/* Calendário */}
          <Text style={dr.sectionLabel}>CALENDÁRIO</Text>
          <TouchableOpacity style={dr.menuBtn} onPress={() => { onClose(); router.push('/(app)/calendar'); }}>
            <Text style={dr.menuBtnIcon}>📅</Text>
            <Text style={dr.menuBtnTxt}>Calendário</Text>
          </TouchableOpacity>

          <View style={dr.divider} />

          {/* Dashboard do Grupo */}
          <Text style={dr.sectionLabel}>GRUPO</Text>
          <TouchableOpacity style={dr.menuBtn} onPress={() => { onClose(); router.push('/(app)/dashboard'); }}>
            <Text style={dr.menuBtnIcon}>👥</Text>
            <Text style={dr.menuBtnTxt}>Dashboard do Grupo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dr.menuBtn} onPress={() => { onClose(); router.push('/hall'); }}>
            <Text style={dr.menuBtnIcon}>👑</Text>
            <Text style={dr.menuBtnTxt}>Hall dos Campeões</Text>
          </TouchableOpacity>

          <View style={dr.divider} />

          {/* Configurações */}
          <Text style={dr.sectionLabel}>CONFIGURAÇÕES</Text>
          <TouchableOpacity style={dr.menuBtn} onPress={() => { onClose(); router.push('/(app)/settings'); }}>
            <Text style={dr.menuBtnIcon}>⚙️</Text>
            <Text style={dr.menuBtnTxt}>Configurações</Text>
          </TouchableOpacity>

        </ScrollView>

        {/* Footer */}
        <View style={dr.footer}>
          <TouchableOpacity style={dr.logoutBtn} onPress={handleLogout}>
            <Text style={dr.logoutTxt}>Sair da conta</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── FAB ───────────────────────────────────────────────────────────────────────
function FABMenu({ insetBottom }: { insetBottom: number }) {
  const [open, setOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const item1Anim = useRef(new Animated.Value(0)).current;
  const item2Anim = useRef(new Animated.Value(0)).current;
  const item3Anim = useRef(new Animated.Value(0)).current;

  function toggle() {
    const toValue = open ? 0 : 1;
    Animated.parallel([
      Animated.timing(rotateAnim, { toValue, duration: 200, useNativeDriver: true }),
      Animated.timing(item1Anim,  { toValue, duration: 180, delay: open ? 0 : 20,  useNativeDriver: true }),
      Animated.timing(item2Anim,  { toValue, duration: 180, delay: open ? 0 : 60,  useNativeDriver: true }),
      Animated.timing(item3Anim,  { toValue, duration: 180, delay: open ? 0 : 100, useNativeDriver: true }),
    ]).start();
    setOpen(v => !v);
  }

  function action(path: string) {
    toggle();
    setTimeout(() => router.push(path as any), 200);
  }

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });
  const makeItemStyle = (anim: Animated.Value, offset: number) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
  });

  const fabBottom = Math.max(insetBottom, 8) + 68;

  const FAB_ITEMS = [
    { icon: '➕', label: 'Nova Competição', path: '/competitions/new/format' },
    { icon: '🏓', label: 'Quadra ao Vivo',  path: '/court' },
    { icon: '🔗', label: 'Convidar Jogador', path: '/settings' },
  ];

  return (
    <>
      {/* Overlay para fechar — só quando aberto */}
      {open && (
        <Pressable style={[StyleSheet.absoluteFill, { zIndex: 25 }]} onPress={toggle} />
      )}

      {/* Items do FAB — só renderiza quando aberto */}
      {open && FAB_ITEMS.map((item, i) => (
        <Animated.View key={item.path} style={[
          fab.itemAbsolute,
          { bottom: fabBottom + 68 + i * 58, right: 20 },
          makeItemStyle(
            i === 0 ? item1Anim : i === 1 ? item2Anim : item3Anim,
            i === 0 ? 20 : i === 1 ? 40 : 60
          ),
        ]}>
          <TouchableOpacity style={fab.itemBtn} onPress={() => action(item.path)} activeOpacity={0.85}>
            <Text style={fab.itemIcon}>{item.icon}</Text>
            <Text style={fab.itemLabel}>{item.label}</Text>
          </TouchableOpacity>
        </Animated.View>
      ))}

      {/* Botão principal — tamanho exato, sem container */}
      <TouchableOpacity style={[fab.btn, { position: 'absolute', bottom: fabBottom, right: 20 }]} onPress={toggle} activeOpacity={0.85}>
        <Animated.Text style={[fab.btnIcon, { transform: [{ rotate }] }]}>+</Animated.Text>
      </TouchableOpacity>
    </>
  );
}

// ── Tab Item ──────────────────────────────────────────────────────────────────
function TabItem({ route, isFocused, onPress }: {
  route: { name: string; key: string };
  isFocused: boolean;
  onPress: () => void;
}) {
  const config = TAB_CONFIG[route.name];
  if (!config) return null;

  const anim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: isFocused ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [isFocused]);

  const color = isFocused ? Colors.gold : '#666';

  return (
    <TouchableOpacity onPress={onPress} style={tb.tabItem} activeOpacity={0.75}
      accessibilityRole="button" accessibilityState={{ selected: isFocused }}>
      {/* Indicador topo */}
      <Animated.View style={[tb.indicator, { opacity: anim, backgroundColor: Colors.gold }]} />
      <config.icon color={color} size={22} />
      <Text style={[tb.label, { color }]}>{config.label}</Text>
    </TouchableOpacity>
  );
}

// ── Custom Tab Bar ─────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter(r => {
    const opts = descriptors[r.key].options as any;
    return opts.href !== null && opts.href !== false;
  });

  return (
    <View style={[tb.bar, { paddingBottom: Math.max(insets.bottom, 8), height: 60 + Math.max(insets.bottom, 8) }]}>
      {visibleRoutes.map(route => {
        const isFocused = state.routes[state.index].key === route.key;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return <TabItem key={route.key} route={route} isFocused={isFocused} onPress={onPress} />;
      })}
    </View>
  );
}

// ── Offline Banner ─────────────────────────────────────────────────────────────
function OfflineBanner() {
  const { isOnline, pendingCount } = useSyncQueue();
  if (isOnline) return null;
  return (
    <View style={styles.offlineBanner}>
      <Text style={{ fontSize: 11 }}>📶</Text>
      <Text style={styles.offlineText}>
        {pendingCount > 0 ? `Offline · ${pendingCount} pendente${pendingCount > 1 ? 's' : ''}` : 'Offline'}
      </Text>
    </View>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────
function AppHeader({ onMenuPress }: { onMenuPress: () => void }) {
  const { group, user, myPlayerId } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const insets = useSafeAreaInsets();
  const myPlayer = groupPlayers.find(p => p.id === myPlayerId);

  return (
    <View style={[hd.bar, { paddingTop: insets.top }]}>
      <View style={hd.inner}>
        {/* Logo + grupo */}
        <View style={hd.logoGroup}>
          <Image
            source={require('../../assets/kingbt-icon.png')}
            style={hd.logoImg}
            resizeMode="contain"
          />
          <View>
            <Text style={hd.groupLabel}>Grupo</Text>
            {group && <Text style={hd.groupName} numberOfLines={1}>{group.name}</Text>}
          </View>
        </View>

        {/* Sino + Avatar + Menu */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.push('/(app)/notifications')}
            style={hd.bellBtn}
            activeOpacity={0.75}
          >
            <Text style={hd.bellIcon}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(app)/profile')} activeOpacity={0.8}>
            <Avatar
              name={myPlayer?.name ?? user?.displayName ?? '?'}
              color={myPlayer?.color ?? Colors.gold}
              size={40}
            />
          </TouchableOpacity>
          <TouchableOpacity style={hd.menuBtn} onPress={onMenuPress} activeOpacity={0.75}>
            <Text style={hd.menuIcon}>≡</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Root Layout ────────────────────────────────────────────────────────────────
export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <OfflineBanner />
      <AppHeader onMenuPress={() => setDrawerOpen(true)} />

      <Tabs
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false, animation: 'fade' }}
        initialRouteName="feed"
      >
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="index" />
        <Tabs.Screen name="ranking" />
        <Tabs.Screen name="profile" />
        {/* Ocultas da tab bar */}
        <Tabs.Screen name="dashboard"    options={{ href: null }} />
        <Tabs.Screen name="calendar"     options={{ href: null }} />
        <Tabs.Screen name="fab"          options={{ href: null }} />
        <Tabs.Screen name="achievements" options={{ href: null }} />
        <Tabs.Screen name="history"      options={{ href: null }} />
        <Tabs.Screen name="stats"        options={{ href: null }} />
        <Tabs.Screen name="settings"     options={{ href: null }} />
        <Tabs.Screen name="h2h"          options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>

      <FABMenu insetBottom={insets.bottom} />
      <DrawerMenu visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const hd = StyleSheet.create({
  bar: { backgroundColor: '#1a1a1a', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, height: 80 },
  logoGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImg: { width: 64, height: 64, borderRadius: 14 },
  groupLabel: { fontFamily: FontFamily.numberBold, fontSize: 11, color: '#888', letterSpacing: 1 },
  groupName: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text },
  bellBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  bellIcon: { fontSize: 16 },
  menuBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 20, color: '#888' },
});

const tb = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: '#1a1a1a',
    borderTopWidth: 1, borderTopColor: '#2a2a2a',
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8, gap: 3 },
  indicator: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, borderRadius: 1 },
  label: { fontFamily: FontFamily.bodyMed, fontSize: 11, fontWeight: '600' },
});

const dr = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40 },
  panel: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 280,
    backgroundColor: '#1a1a1a', borderLeftWidth: 1, borderLeftColor: '#2a2a2a',
    zIndex: 50, flexDirection: 'column',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', paddingTop: 56 },
  headerTitle: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  headerSub: { fontFamily: FontFamily.body, fontSize: 12, color: '#888', marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  closeBtnTxt: { fontSize: 14, color: '#888' },
  content: { flex: 1, padding: 16 },
  sectionLabel: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.gold, letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  groupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1 },
  groupBtnActive: { backgroundColor: '#2a2a2a', borderColor: Colors.gold },
  groupBtnTxtActive: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.gold, flex: 1 },
  groupBtnNew: { padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  groupBtnNewTxt: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: '#888' },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginVertical: 16 },
  menuBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, marginBottom: 8 },
  menuBtnIcon: { fontSize: 18, width: 28 },
  menuBtnTxt: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  logoutBtn: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(229,72,61,0.12)', borderWidth: 1, borderColor: 'rgba(229,72,61,0.3)', alignItems: 'center' },
  logoutTxt: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.coral },
});

const fab = StyleSheet.create({
  itemAbsolute: { position: 'absolute', alignItems: 'flex-end', zIndex: 30 },
  btn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  btnIcon: { fontFamily: FontFamily.titleBold, fontSize: 28, color: '#000', lineHeight: 34 },
  item: { marginBottom: 10, alignItems: 'flex-end' },
  itemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#2a2a2a', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: '#3a3a3a',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  itemIcon: { fontSize: 18 },
  itemLabel: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
});

const styles = StyleSheet.create({
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#E5483D22', borderBottomWidth: 1, borderBottomColor: '#E5483D44',
    paddingVertical: 5,
  },
  offlineText: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.coral },
});
