import { Tabs } from 'expo-router';
import { Colors, FontFamily } from '@/theme';
import { Text, View } from 'react-native';

type TabIconProps = { label: string; focused: boolean; emoji: string };

function TabIcon({ label, focused, emoji }: TabIconProps) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text
        style={{
          fontFamily: FontFamily.body,
          fontSize: 10,
          color: focused ? Colors.gold : Colors.textSoft,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface1,
          borderTopColor: Colors.line,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.textSoft,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Home" focused={focused} emoji="🏠" />
          ),
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Ranking" focused={focused} emoji="🏆" />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Sessões" focused={focused} emoji="🎾" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Perfil" focused={focused} emoji="👤" />
          ),
        }}
      />
    </Tabs>
  );
}
