import { Redirect } from 'expo-router';

export default function Root() {
  // Em produção: checar auth e redirecionar para login se não autenticado
  return <Redirect href="/(app)" />;
}
