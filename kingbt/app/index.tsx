import { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/AuthContext';
import { Colors } from '@/theme';

const { width, height } = Dimensions.get('window');

export default function Root() {
  const { user, group, loading, myPlayerId, playerLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || playerLoading) return;
    if (!user) { router.replace('/(auth)/login'); return; }
    if (!group) { router.replace('/(auth)/join'); return; }
    if (myPlayerId === null) { router.replace('/(auth)/join'); return; }
    router.replace('/(app)');
  }, [loading, playerLoading, user, group, myPlayerId]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/kingbt-icon-final.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  logo: { width: width * 0.85, height: height * 0.85 },
});
