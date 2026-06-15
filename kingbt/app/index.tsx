import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/AuthContext';
import { Colors } from '@/theme';

export default function Root() {
  const { user, group, loading, myPlayerId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/(auth)/login'); return; }
    if (!group) { router.replace('/(auth)/join'); return; }
    // Usuário tem grupo mas ainda não tem perfil vinculado → mostrar modal de seleção
    if (myPlayerId === null) { router.replace('/(auth)/join'); return; }
    router.replace('/(app)');
  }, [loading, user, group, myPlayerId]);

  return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
}
