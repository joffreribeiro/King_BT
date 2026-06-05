import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily } from '@/theme';

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
        }}
      />
      <Tabs.Screen
        name="fab"
        options={{ href: null }}
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
  iconWrap: { alignItems: 'center', gap: 2, width: 80 },
  iconEmoji: { fontSize: 22 },
  iconLabel: { fontFamily: FontFamily.body, fontSize: 10, textAlign: 'center' },
});
