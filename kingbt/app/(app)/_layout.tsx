import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';

type TabIconProps = { label: string; focused: boolean; icon: string };

function TabIcon({ label, focused, icon }: TabIconProps) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.iconEmoji, { opacity: focused ? 1 : 0.5 }]}>{icon}</Text>
      <Text style={[styles.iconLabel, { color: focused ? Colors.gold : Colors.faint }]}>
        {label}
      </Text>
    </View>
  );
}

function FABButton() {
  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={() => router.push('/competitions/new/format')}
      activeOpacity={0.85}
    >
      <Text style={styles.fabText}>+</Text>
    </TouchableOpacity>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.faint,
      }}
    >
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
          tabBarButton: (props) => (
            <View style={{ flex: 1 }}>
              {props.children}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="fab"
        options={{
          tabBarIcon: () => null,
          tabBarButton: () => <FABButton />,
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
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surf,
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 8,
    paddingTop: 4,
  },
  iconWrap: { alignItems: 'center', gap: 2 },
  iconEmoji: { fontSize: 22 },
  iconLabel: { fontFamily: FontFamily.body, fontSize: 10 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontFamily: FontFamily.titleBold,
    fontSize: 32,
    color: Colors.bg,
    lineHeight: 38,
  },
});
