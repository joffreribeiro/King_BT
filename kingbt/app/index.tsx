import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import SplashAnimation from '@/components/SplashAnimation';

export default function Root() {
  const { user, groupIds, loading, groupConfirmed } = useAuth();
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
    let cancelado = false;

    (async () => {
      if (!user) {
        // Quem nunca viu o onboarding vai para ele. O layout raiz faz a mesma checagem e dispara o próprio
        // redirecionamento; sem esta, os dois "corriam" e o destino dependia de qual chegava por último
        // (mudou ao trocar de SDK: o login passou a vencer e o novato nunca via o onboarding).
        const feito = await AsyncStorage.getItem('@kingbt:onboarding_done').catch(() => 'sim');
        if (!cancelado) router.replace(feito ? '/(auth)/login' : '/onboarding');
      }
      // Sem nenhum grupo — fluxo de entrar com código / criar
      else if (groupIds.length === 0) router.replace('/(auth)/join');
      // Com um grupo ativo do qual ainda é membro — abre direto nele; senão, escolhe o grupo
      else if (groupConfirmed) router.replace('/(app)/home');
      else router.replace('/(auth)/groups');
    })();

    return () => { cancelado = true; };
  }, [splashDone, loading, user, groupIds, groupConfirmed]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {!splashDone && <SplashAnimation onFinish={() => setSplashDone(true)} />}
    </View>
  );
}
