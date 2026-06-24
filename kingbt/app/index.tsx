import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/store/AuthContext';
import { Colors } from '@/theme';

const ONBOARDING_KEY = '@kingbt:onboarding_done';

export default function Root() {
  const { user, group, loading } = useAuth();
  const router = useRouter();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setOnboardingDone(val === 'true');
      setCheckingOnboarding(false);
    });
  }, []);

  useEffect(() => {
    if (loading || checkingOnboarding) return;

    // Primeira vez — mostra onboarding
    if (!onboardingDone) {
      router.replace('/onboarding');
      return;
    }

    if (!user) router.replace('/(auth)/login');
    else if (!group) router.replace('/(auth)/join');
    else router.replace('/(app)');
  }, [loading, checkingOnboarding, user, group, onboardingDone]);

  return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
}
