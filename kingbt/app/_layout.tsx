import { Stack } from 'expo-router';
import Head from 'expo-router/head';
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
import { AuthProvider } from '@/store/AuthContext';
import { CompetitionsProvider } from '@/store/CompetitionsContext';
import { GroupPlayersProvider } from '@/store/GroupPlayersContext';
import { SettingsProvider } from '@/store/SettingsContext';
import { FeedProvider } from '@/store/FeedContext';
import { SyncQueueProvider } from '@/store/SyncQueueContext';
import { UpdateProvider, useUpdate } from '@/store/UpdateContext';
import { ThemeProvider, useTheme } from '@/store/ThemeContext';
import { MandatoryUpdateScreen } from '@/components';

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

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    AsyncStorage.getItem('@kingbt:onboarding_done')
      .then(done => {
        if (!done) router.replace('/onboarding');
      })
      .catch(() => {})
  }, [fontsLoaded, fontError]);

  // Título padrão da aba/link compartilhado na web. Usa o mesmo mecanismo
  // (react-helmet-async) que o Expo Router já deixa como placeholder vazio
  // no <head> — por isso reconcilia em vez de duplicar, e qualquer tela
  // específica que use seu próprio <Head> continua livre para sobrescrever
  // este valor. Precisa ficar ANTES do return null: `expo export` faz SSG
  // (renderiza a árvore sem browser real), e useFonts nunca resolve nesse
  // ambiente — se o <Head> estivesse depois do gate de loading, o HTML
  // estático gerado nunca chegaria a montá-lo, e o <title> continuaria vazio
  // para crawlers que não executam JS (WhatsApp, Facebook, Google Rich Cards).
  const headTag = (
    <Head>
      <title>King BT</title>
    </Head>
  );

  if (!fontsLoaded && !fontError) return headTag;

  return (
    <>
      {headTag}
    <ThemeProvider>
    <AuthProvider>
    <UpdateProvider>
    <SettingsProvider>
    <GroupPlayersProvider>
    <CompetitionsProvider>
    <FeedProvider>
    <SyncQueueProvider>
      <RootStack splashDone={splashDone} onSplashFinish={() => setSplashDone(true)} />
    </SyncQueueProvider>
    </FeedProvider>
    </CompetitionsProvider>
    </GroupPlayersProvider>
    </SettingsProvider>
    </UpdateProvider>
    </AuthProvider>
    </ThemeProvider>
    </>
  );
}

function RootStack({ splashDone, onSplashFinish }: { splashDone: boolean; onSplashFinish: () => void }) {
  const { mode, colors } = useTheme();
  const { updateRequired } = useUpdate();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {updateRequired ? (
        <MandatoryUpdateScreen />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="bracket" options={{ headerShown: false }} />
        </Stack>
      )}
      {!splashDone && (
        <SplashAnimation onFinish={onSplashFinish} />
      )}
    </>
  );
}
