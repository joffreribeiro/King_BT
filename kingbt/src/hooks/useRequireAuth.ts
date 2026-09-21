import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/store/AuthContext';

/**
 * Mesmo guard que `app/(app)/_layout.tsx` já aplica a toda rota dentro do
 * grupo `(app)` — mas várias telas (court, bracket, hall, trilha, player/[id],
 * desempenho-geral, etc.) moram soltas na raiz de `app/`, fora desse grupo,
 * e nunca passavam por nenhum guard: sem sessão, renderizavam vazias em vez
 * de mandar pra tela de entrada. Não é falha de segurança — as regras do
 * Firestore seguram os dados de qualquer jeito — mas é uma tela quebrada
 * pra quem chega numa dessas rotas (link direto, PWA restaurando aba) sem
 * sessão ativa.
 *
 * Chamar no topo do componente da tela: `useRequireAuth();`.
 */
export function useRequireAuth() {
  const { user, loading, groupConfirmed } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/(auth)/login'); return; }
    if (!groupConfirmed) router.replace('/(auth)/groups');
  }, [loading, user, groupConfirmed]);
}
