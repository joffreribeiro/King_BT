# Ideias do LetzPlay para o King BT

Levantamento feito navegando (somente leitura) pelo app web do [LetzPlay](https://letzplay.me/u/feed) — plataforma de gestão de torneios/rankings de Beach Tennis — comparando com o que o King BT já tem, pra identificar gaps que valem a pena implementar.

## Já coberto pelo King BT (não repetido abaixo)
- Feed com resultados agrupados por competição, reações por emoji e comentários (`feed.tsx`)
- Milestone de rivalidade e card de subida no ranking no feed
- H2H com abas Geral/Histórico/Stats (`h2h.tsx`)
- Timeline de evolução de pontos (`stats.tsx`)
- Sistema de conquistas por categoria: vitórias, sequência, rating, títulos, formatos, social (`achievements.tsx`)
- Notificações de resultado, início de competição, conquista desbloqueada, subida no ranking, convite (`notifications.tsx`)
- Ranking, calendário, dashboard, módulo de treino, análise ponto a ponto

## Sugestões

### 1. Ranking em escada ("Desafio/Pontos")
No LetzPlay existem dois tipos de ranking: "Corrida" (pontos acumulados — igual ao que o King BT já faz) e **"Desafio/Pontos"**, onde cada jogador pode desafiar quem está posicionado acima dele na lista; vencendo, sobe de posição. É um formato de engajamento contínuo, sem precisar de uma competição fechada.
- **Esforço estimado:** alto — exige novo modelo de dados (desafios pendentes/aceitos/expirados), fluxo de notificação e regra de reposicionamento.

### 2. Jogo amistoso avulso
"Painel de Jogos" do LetzPlay permite chamar um amigo pra um amistoso ou simplesmente lançar o resultado de um jogo que já aconteceu fora de qualquer torneio/competição, só para alimentar as estatísticas pessoais. No King BT hoje o registro de partida parece sempre atrelado a uma competição.
- **Esforço estimado:** médio — precisa de um tipo de "partida solta" (sem `compId`) e ajuste nas telas que assumem competição.

### 3. Estatísticas cruzadas por característica do confronto
O dashboard de estatísticas do LetzPlay quebra o desempenho por: tipo de piso, lateralidade do adversário (destro/canhoto), tipo de backhand (uma mão/duas mãos) e faixa etária. São cortes que dão insight tático e que o King BT ainda não expõe.
- **Esforço estimado:** médio — depende do item 6 (dados cadastrais do jogador) e de agregações novas em `stats.tsx`.

### 4. Sequência de resultados (streak) nas estatísticas gerais
Hoje o streak só aparece dentro de conquistas. No LetzPlay é um gráfico dedicado na tela de estatísticas, mostrando a sequência recente de W/L visualmente.
- **Esforço estimado:** baixo — o dado de streak já deve existir na lógica de conquistas; é reaproveitar e expor em `stats.tsx`.

### 5. Aproveitamento em situações específicas
Percentual de vitórias em tiebreak, super tiebreak, 3º set e 5º set — mostra quem "fecha" jogos apertados.
- **Esforço estimado:** médio — precisa que o registro de partida capture esses metadados por set (parte já deve existir em `analise/[matchId]`).

### 6. Características físicas/técnicas no perfil do jogador
Altura, forehand, backhand (uma mão/duas mãos), lateralidade, "joga há quanto tempo". Enriquece o perfil e habilita os cruzamentos dos itens 3 e H2H.
- **Esforço estimado:** baixo — campos novos no cadastro do jogador + UI de exibição/edição.

### 7. "Onde joga" no perfil
Lista de clubes/academias que o jogador frequenta, exibida no perfil público.
- **Esforço estimado:** baixo/médio — depende de já existir (ou criar) um cadastro simples de locais.

### 8. Sistema de amigos/seguir
No LetzPlay, amizade é independente de grupo — permite comparar (H2H) e ver atividade de qualquer jogador da base, não só do seu grupo fechado. Só faz sentido se o King BT quiser abrir a interação além do grupo fixo atual.
- **Esforço estimado:** alto — muda o modelo social do app (hoje baseado em grupo fechado).

### 9. "Torcer" (cheer) em partida
Reação social diferente de reagir a um resultado: torcer por alguém em um jogo agendado/em andamento, antes do placar sair.
- **Esforço estimado:** baixo/médio — pode reaproveitar a infraestrutura de reações do feed, aplicada a um jogo agendado em vez de um resultado.

### 10. Trilha do jogador no chaveamento
Visão do caminho percorrido por um jogador dentro do bracket de um torneio (quem enfrentou, em que fase, resultado), separada da visão geral do chaveamento.
- **Esforço estimado:** médio — é uma filtragem/visualização nova em cima dos dados de chaveamento que já existem em `bracket.tsx`/competições.

### 11. Perfil de clube/liga/organizador
Página agregando jogadores, rankings e torneios de uma entidade organizadora (ex.: uma liga ou clube), com abas próprias. Só relevante se o King BT evoluir para suportar múltiplos grupos/organizadores públicos — hoje o modelo parece ser um grupo fechado só.
- **Esforço estimado:** alto — é essencialmente um novo tipo de entidade no modelo de dados.

### 12. Fora de escopo (não recomendado)
Reserva de quadra, agendamento de aula e pagamentos são features de marketplace (conectam jogadores a clubes/professores parceiros). Não combinam com o modelo atual do King BT, que é um tracker de competições de grupo fechado, não uma plataforma de marketplace esportivo.

## Prioridades sugeridas (quick wins primeiro)
1. Item 6 (características do jogador) — baixo esforço, desbloqueia os itens 3 e melhora H2H
2. Item 4 (streak nas estatísticas) — baixo esforço, dado já deve existir
3. Item 9 (torcer) — baixo/médio, reaproveita infra de reações
4. Item 2 (amistoso avulso) — médio, mas alto valor de engajamento
5. Item 10 (trilha no chaveamento) — médio, boa visualização em cima de dado existente
6. Itens 1, 8 e 11 — mudanças estruturais maiores, avaliar caso a caso conforme direção do produto
