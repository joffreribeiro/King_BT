import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashAnimation from '@/components/SplashAnimation';
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
import { SyncQueueProvider } from '@/store/SyncQueueContext';

SplashScreen.preventAutoHideAsync();
// Timeout de segurança: esconde a splash em no máximo 5s independente das fontes
setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 5000);

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
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    AsyncStorage.getItem('@kingbt:onboarding_done')
      .then(done => {
        if (!done) router.replace('/onboarding');
      })
      .catch(() => {})
      .finally(() => setOnboardingChecked(true));
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AuthProvider>
    <SettingsProvider>
    <GroupPlayersProvider>
    <CompetitionsProvider>
    <FeedProvider>
    <SyncQueueProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="bracket" options={{ headerShown: false }} />
      </Stack>
      {!splashDone && (
        <SplashAnimation onFinish={() => setSplashDone(true)} />
      )}
    </SyncQueueProvider>
    </FeedProvider>
    </CompetitionsProvider>
    </GroupPlayersProvider>
    </SettingsProvider>
    </AuthProvider>
  );
}
