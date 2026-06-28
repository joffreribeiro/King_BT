import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/store/AuthContext';
import { Colors } from '@/theme';
import SplashAnimation from '@/components/SplashAnimation';

const ONBOARDING_KEY = '@kingbt:onboarding_done';

export default function Root() {
  const { user, group, loading } = useAuth();
  const router = useRouter();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setOnboardingDone(val === 'true');
      setCheckingOnboarding(false);
    });
  }, []);

  useEffect(() => {
    if (!splashDone || loading || checkingOnboarding) return;

    // Primeira vez — mostra onboarding
    if (!onboardingDone) {
      router.replace('/onboarding');
      return;
    }

    if (!user) router.replace('/(auth)/login');
    else if (!group) router.replace('/(auth)/join');
    else router.replace('/(app)');
  }, [splashDone, loading, checkingOnboarding, user, group, onboardingDone]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {!splashDone && <SplashAnimation onFinish={() => setSplashDone(true)} />}
    </View>
  );
}
