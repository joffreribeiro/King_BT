import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/store/AuthContext';
import { Colors } from '@/theme';

export default function Root() {
  const { user, group, loading } = useAuth();

  if (loading) return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
  if (!user) return <Redirect href="/(auth)/login" />;      // não logado → login
  if (!group) return <Redirect href="/(auth)/join" />;      // logado mas sem grupo → join
  return <Redirect href="/(app)" />;                         // tudo ok → hub
}
