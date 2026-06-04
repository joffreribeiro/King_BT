import { Redirect } from 'expo-router';

// Mock: false = não logado → vai para login
// Quando integrar Firebase, trocar por: const { user } = useAuth()
const IS_LOGGED_IN = false;

export default function Root() {
  if (!IS_LOGGED_IN) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(app)" />;
}
