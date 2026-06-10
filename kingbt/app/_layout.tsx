import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { Colors } from '@/theme';
import { AuthProvider } from '@/store/AuthContext';
import { CompetitionsProvider } from '@/store/CompetitionsContext';
import { GroupPlayersProvider } from '@/store/GroupPlayersContext';
import { SettingsProvider } from '@/store/SettingsContext';
import { FeedProvider } from '@/store/FeedContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
  }

  return (
    <AuthProvider>
    <SettingsProvider>
    <GroupPlayersProvider>
    <CompetitionsProvider>
    <FeedProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'slide_from_right',
        }}
      />
    </FeedProvider>
    </CompetitionsProvider>
    </GroupPlayersProvider>
    </SettingsProvider>
    </AuthProvider>
  );
}
