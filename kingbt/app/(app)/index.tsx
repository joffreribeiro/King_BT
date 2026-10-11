import { Redirect } from 'expo-router';

/**
 * A lista de competições mora dentro da Arena (aba Competições). Esta rota continua existindo para os links antigos,
 * o botão voltar das telas de competição e as notificações, que ainda apontam para "/(app)".
 */
export default function CompetitionsRoute() {
  return <Redirect href={{ pathname: '/(app)/arena', params: { tab: 'competicoes' } }} />;
}
