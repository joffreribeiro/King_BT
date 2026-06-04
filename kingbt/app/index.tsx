import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/store/AuthContext';
import { Colors } from '@/theme';

export default function Root() {
  const { user, group, loading } = useAuth();

  if (loading) return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
  if (!user || !group) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(app)" />;
}
