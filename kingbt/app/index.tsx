import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/AuthContext';
import { Colors } from '@/theme';

export default function Root() {
  const { user, group, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    console.log('[Root] user:', user?.uid ?? 'null', 'group:', group?.id ?? 'null');
    if (!user) router.replace('/(auth)/login');
    else if (!group) router.replace('/(auth)/join');
    else router.replace('/(app)');
  }, [loading, user, group]);

  return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
}
