import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily } from '@/theme';
import { useSyncQueue } from '@/store/SyncQueueContext';

type TabIconProps = { label: string; focused: boolean; icon: string };

function TabIcon({ label, focused, icon }: TabIconProps) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.iconEmoji, { opacity: focused ? 1 : 0.5 }]}>{icon}</Text>
      <Text style={[styles.iconLabel, { color: focused ? Colors.gold : Colors.faint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function OfflineBanner() {
  const { isOnline, pendingCount } = useSyncQueue();
  if (isOnline) return null;
  return (
    <View style={styles.offlineBanner}>
      <Text style={{ fontSize: 11 }}>📶</Text>
      <Text style={styles.offlineText}>
        {pendingCount > 0
          ? `Offline · ${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`
          : 'Offline'}
      </Text>
    </View>
  );
}

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  return (
    <>
    <OfflineBanner />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8), height: 56 + Math.max(insets.bottom, 8) }],
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.faint,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Feed" focused={focused} icon="📰" />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Competições" focused={focused} icon="🏆" />
          ),
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Ranking" focused={focused} icon="📊" />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Grupo" focused={focused} icon="🏟️" />
          ),
        }}
      />
      <Tabs.Screen
        name="fab"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Calendário" focused={focused} icon="📅" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Perfil" focused={focused} icon="👤" />
          ),
        }}
      />
    </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surf,
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    paddingTop: 4,
  },
  iconWrap: { alignItems: 'center', gap: 2, width: 80 },
  iconEmoji: { fontSize: 22 },
  iconLabel: { fontFamily: FontFamily.body, fontSize: 10, textAlign: 'center' },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.coral + '22', borderBottomWidth: 1, borderBottomColor: Colors.coral + '44',
    paddingVertical: 5,
  },
  offlineText: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.coral },
});
