import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import SplashAnimation from '@/components/SplashAnimation';

export default function Root() {
  const { user, groupIds, loading } = useAuth();
  const { colors: Colors } = useTheme();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(true); // splash desativada temporariamente

  // A checagem de onboarding mora só em app/_layout.tsx (raiz) — ele decide
  // ANTES desta tela montar de verdade se redireciona pra /onboarding. Duas
  // checagens independentes (esta tela lia o AsyncStorage de novo, com uma
  // comparação diferente — `val === 'true'` aqui contra `!done` no layout)
  // rodavam em paralelo desde o boot, uma corrida que não mudava o
  // resultado final (os dois sempre concordavam), mas podia fazer a tela
  // "piscar" entre rotas por um instante.
  useEffect(() => {
    if (!splashDone || loading) return;

    if (!user) router.replace('/(auth)/login');
    // Sem nenhum grupo — fluxo de entrar com código / criar
    else if (groupIds.length === 0) router.replace('/(auth)/join');
    // Com 1+ grupos — sempre passa pela tela de escolha de grupo
    else router.replace('/(auth)/groups');
  }, [splashDone, loading, user, groupIds]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {!splashDone && <SplashAnimation onFinish={() => setSplashDone(true)} />}
    </View>
  );
}
