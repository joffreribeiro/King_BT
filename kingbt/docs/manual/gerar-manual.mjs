// Gera o Manual do Usuário do KING BT (HTML em páginas A4, pronto para virar PDF).
//
// Uso (de D:\KINGBT\projeto\docs\manual):
//   node gerar-manual.mjs            -> grava Manual-do-King-BT.html
//   (PDF) msedge --headless --no-pdf-header-footer --print-to-pdf=Manual-do-King-BT.pdf Manual-do-King-BT.html
//
// O conteúdo fica nas listas CAPITULOS abaixo; as imagens são capturas do app, em img/ (grupo de teste).
import { writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const aqui = dirname(fileURLToPath(import.meta.url));

/** Cada capítulo vira uma ou mais páginas A4. `figs` são as telas (até 3 por página). */
const CAPITULOS = [
  {
    cap: 'Capítulo 1', titulo: 'Primeiros passos',
    intro: 'O KING BT é o app do grupo de beach tennis: competições, placares, ranking e a análise de jogo ponto a ponto (King Scout). Funciona no navegador do celular e como aplicativo Android.',
    passos: [
      '<b>Abra o app</b> pelo endereço do grupo (<code>kingbt.web.app</code>) ou pelo aplicativo instalado. Depois do primeiro acesso, o app <b>abre direto no último grupo</b> que você usou, na tela Início.',
      'Toque em <b>Entrar com e-mail</b> e use o seu e-mail e senha. Quem ainda não tem conta toca em <b>Criar conta</b>.',
      'Você pode participar de <b>mais de um grupo</b>. Para trocar, entrar em outro (com o <b>código de convite</b>) ou criar um, toque no <b>+</b> ao lado do nome do grupo, no topo do Perfil.',
      '<b>Instale o app.</b> No celular, use o menu do navegador e escolha <b>Adicionar à tela inicial</b>; no Android também há o aplicativo (APK) do grupo, baixado como <b>KingBT_&lt;versão&gt;.apk</b>.',
      '<b>Atualizações.</b> Quando existe uma versão nova, uma barra mostra “Atualizar para v…”; toque nela. Para conferir na hora, use <b>Configurações → Ajuda → Verificar atualização</b>: o app responde “Você está na versão mais recente” ou avisa se não conseguiu consultar (sem internet).',
      '<b>Ajuda.</b> Em <b>Configurações → Ajuda</b> você abre este manual em PDF. No rodapé de Configurações aparece a <b>versão</b> instalada (a mesma do nome do arquivo, por exemplo KingBT_1.0.0-58.apk) — informe-a ao administrador se algo der errado.',
    ],
    tabela: { cab: ['Onde', 'Para que serve'], linhas: [
      ['Início', 'Pendências, sua posição no ranking, o próximo evento e o feed do grupo.'],
      ['Arena', 'Competições do grupo, Ranking (pódio e tabela) e lista de Atletas.'],
      ['Perfil', 'Seu cartão, nível, estatísticas, histórico e relatórios do King Scout.'],
      ['Botão +', 'Atalhos: Nova Competição, Jogo Rápido e Marcação ponto a ponto.'],
    ] },
    nota: 'As telas deste manual foram capturadas em um <b>grupo de teste</b>, por isso os jogadores têm nomes como A, B, C e Joffre.',
    figs: [],
    capa: true,
  },
  {
    cap: 'Capítulo 2', titulo: 'Início',
    intro: 'A tela Início resume o que importa para você no grupo e mostra o que está acontecendo nele.',
    passos: [
      '<b>Pendências</b> mostra o que espera por você: jogos sem placar, colegas para avaliar e pedidos de inscrição. Toque numa linha para ir direto ao assunto.',
      '<b>Sua posição</b> mostra onde você está no ranking do grupo e quantos pontos tem.',
      '<b>Próximo evento</b> mostra a próxima competição marcada, com data, horário e local.',
      '<b>Acontecendo no grupo</b> é o <b>feed</b>: conquistas, primeiras vitórias, subidas no ranking e resultados, dia a dia. Dá para reagir e comentar. Toque em <b>Ver mais</b> no fim da lista para carregar mais novidades.',
      'A <b>barra de baixo</b> leva às três áreas: Início, Arena e Perfil. O botão amarelo <b>+</b> abre os atalhos (veja o capítulo 5).',
    ],
    figs: [
      { img: '01-home.png', cap: 'Início: pendências, posição e próximo evento.' },
      { img: '36-home-feed.png', cap: 'Mais abaixo, o feed do grupo.' },
    ],
  },
  {
    cap: 'Capítulo 3', titulo: 'Arena: Competições, Ranking e Atletas',
    intro: 'A Arena é o jogo do grupo, em três abas.',
    passos: [
      '<b>Competições</b>: todas as disputas do grupo, com filtros e busca (veja o capítulo 4). Abre por padrão.',
      '<b>Ranking</b>: pódio dos três primeiros e a tabela completa. Os filtros <b>Este mês</b>, <b>Temporada</b> e <b>Acumulado</b> mudam o período. A pontuação está explicada no capítulo 13.',
      '<b>Atletas</b>: a lista dos jogadores do grupo. Toque num nome para abrir o perfil dele.',
    ],
    figs: [
      { img: '03-competicoes.png', cap: 'Arena: aba Competições.' },
      { img: '02-arena.png', cap: 'Arena: aba Ranking, com o pódio.' },
    ],
  },
  {
    cap: 'Capítulo 4', titulo: 'Competições',
    intro: 'Todas as disputas do grupo ficam na aba Competições, dentro da Arena.',
    passos: [
      'Na <b>lista</b>, cada competição mostra o tipo (Super 8, Avulso, Liga…), a data, o número de jogadores e uma barra com os jogos já registrados. Use <b>Todas</b>, <b>Agendadas</b> e <b>Em andamento</b> para filtrar, e a lupa para buscar.',
      'Ao abrir uma competição, a aba <b>Partidas</b> mostra a <b>classificação</b> (V vitórias, D derrotas, GP games pró, SALDO e PTS) e o <b>progresso</b> (por exemplo, 8/14 jogos). Ao voltar, você retorna à Arena.',
      'Mais abaixo ficam os <b>jogos</b>. Cada cartão tem uma linha por dupla e uma coluna por set (“SET 1”). O <b>game ganho aparece em verde</b>. O jogo seguinte vem destacado com o selo <b>PRÓXIMO</b>.',
      'A aba <b>Regras</b> explica o formato de disputa (sets, games, tie-break) e a pontuação que vale na competição (a do grupo ou a própria da competição).',
    ],
    figs: [
      { img: '03-competicoes.png', cap: 'Lista de competições.' },
      { img: '10-competicao-classificacao.png', cap: 'Classificação e progresso.' },
      { img: '11-jogos-placar.png', cap: 'Jogos: SET 1, verde no game ganho, selo PRÓXIMO.' },
    ],
  },
  {
    cap: 'Capítulo 5', titulo: 'Criar uma competição',
    intro: 'Quem administra o grupo cria as competições pelo botão amarelo <b>+</b>.',
    passos: [
      'Toque no <b>+</b> e escolha <b>Nova Competição</b>. Os outros atalhos do menu são <b>Jogo Rápido</b> e <b>Marcação ponto a ponto</b>.',
      'Preencha as <b>Informações gerais</b>: nome, tipo (Liga, Grupos + Eliminatórias, Mata-mata, Avulso ou Super 8), “Competem em” (duplas ou individual), gênero e categoria de nível. A <b>data é opcional</b>: em branco, a competição leva a data de hoje; o botão de <b>calendário</b> ao lado do campo abre um calendário para escolher o dia. Horário, local e descrição também são opcionais (o horário passa a ser obrigatório se abrir inscrições).',
      'Escolha o <b>formato de disputa</b> na lista (por exemplo, MD1 · 4 games com tie-break a 7). Ele define quando o set termina e quando entra o tie-break. Há dois formatos de 4 games sem tie-break: <b>Sem tie</b> (em 3–3 o próximo game decide) e <b>4 games no total</b> (joga só 4 games e pode terminar empatado em 2–2).',
      '<b>Pontuação própria</b> (opcional): desligada, a competição segue a fórmula de pontuação do grupo. Ligada, aparecem os mesmos critérios da fórmula do grupo (Vitórias A, Jogos B, GA C e Eventos D), valendo só para a classificação dessa competição.',
      'No fim: <b>Série semanal</b> (repete a competição toda semana; exige a data de início) e <b>Inscrições</b> (deixa os jogadores pedirem para entrar).',
      'Confira o <b>Resumo antes de criar</b>. O botão <b>Criar competição</b> só habilita quando tudo obrigatório está preenchido; o aviso em vermelho diz o que falta.',
    ],
    figs: [
      { img: '06-menu-mais.png', cap: 'O botão + e seus atalhos.' },
      { img: '07-nova-competicao-1.png', cap: 'Data opcional, com o botão de calendário.' },
      { img: '38-formatos-disputa.png', cap: 'Lista de formatos de disputa.' },
    ],
  },
  {
    cap: 'Capítulo 6', titulo: 'Registrar o placar à mão',
    intro: 'Quando o jogo acabou e você só quer lançar o resultado, toque no jogo para abrir o <b>Registrar Placar</b>.',
    passos: [
      'Use <b>−</b> e <b>+</b> para os <b>games de cada dupla em cada set</b>; não precisa de teclado. O sistema respeita o formato: não deixa passar do limite do set. O vencedor do set aparece em verde.',
      '<b>Atalhos de placar</b> (por exemplo 4–0, 4–2, 5–4) preenchem os games com um toque; <b>⇄ inverter</b> troca os lados.',
      'Se o formato tem mais de um set, toque em <b>+ Adicionar set</b>. O placar de sets (por exemplo, 1 × 0) é calculado sozinho. Em melhor de 1 set o botão não aparece.',
      '<b>Tie-break obrigatório.</b> Quando um set termina como termina um set decidido no tie-break, aparece a linha <b>Tie-break</b> com <b>−</b> e <b>+</b> para os pontos de cada dupla (ex.: 7–5). O tie-break vai a 7 pontos, com 2 de diferença, e o vencedor do set precisa ganhar o tie-break. Enquanto estiver vazio ou inválido, o botão <b>Salvar placar</b> fica desabilitado.',
      'O tie-break aparece depois como número pequeno ao lado dos games (4³ – 3⁷) no cartão do jogo, no Feed e nos relatórios.',
      'No formato <b>4 games no total</b>, o jogo acaba quando os 4 games são jogados e pode ser salvo <b>empatado</b> (2–2); o cartão mostra “Empate”.',
      '<b>Rascunho</b> guarda um placar incompleto sem valer para o ranking. Administradores podem <b>Corrigir</b> ou <b>Apagar placar</b> de um jogo já salvo.',
    ],
    nota: 'Abaixo dos botões ficam os links <b>Ver pontos</b> e <b>Marcar ponto a ponto</b> (capítulo 8). O botão <b>Usar King Scout</b> (capítulo 9) só aparece para o super admin.',
    figs: [
      { img: '12-registrar-placar-scout.jpg', cap: 'Registrar Placar de um jogo sem placar.' },
      { img: '13-placar-tiebreak-vazio.png', cap: 'Set 5–4: o tie-break é obrigatório e o Salvar espera.' },
      { img: '14-placar-tiebreak-ok.png', cap: 'Tie-break informado: Salvar liberado.' },
    ],
  },
  {
    cap: 'Capítulo 7', titulo: 'Competição Avulsa',
    intro: 'O formato <b>Avulso</b> é uma sessão livre: você lança cada jogo que aconteceu, sem tabela pré-definida.',
    passos: [
      'Abra a competição e toque em <b>Registrar jogo</b> (ou toque num jogo “Aguardando placar”).',
      'Informe os <b>games de cada dupla</b> com <b>−</b> e <b>+</b>. Os atalhos 6–0, 6–4, 7–5 e 7–6 e o <b>⇄ inverter</b> aceleram. Cada linha é um set (“Set 1”, “Set 2”…); use <b>+ Adicionar set</b> para mais.',
      'No Avulso o formato não é definido, então o app <b>não adivinha o tie-break</b>. Se o set teve tie-break, marque a caixa <b>Tie-break</b> abaixo do set (o atalho 7–6 já marca) e informe os pontos de cada dupla com <b>−</b> e <b>+</b>. Marcado, os pontos são obrigatórios.',
      'O placar <b>pode terminar empatado</b>: o Salvar não exige vencedor.',
    ],
    figs: [
      { img: '15-avulso.png', cap: 'Competição Avulsa: “Registrar jogo” e jogos aguardando placar.' },
      { img: '17-avulso-tiebreak-vazio.jpg', cap: 'Atalho 7–6: Tie-break marcado, pontos pendentes.' },
      { img: '18-avulso-tiebreak-ok.jpg', cap: 'Tie-break informado.' },
    ],
  },
  {
    cap: 'Capítulo 8', titulo: 'Marcação ponto a ponto',
    intro: 'Para marcar o jogo enquanto ele acontece, ponto por ponto, sem as estatísticas detalhadas do scout.',
    passos: [
      'Toque no <b>+</b> e em <b>Marcação ponto a ponto</b>. A tela lista as competições com jogos pendentes (“8/14 jogos · Próximo disponível”).',
      'Toque na competição: o app abre o <b>próximo jogo</b>. Ele aparece como cartão <b>PRÓXIMO</b>; toque nele para começar.',
      'No <b>placar ao vivo</b>, cada dupla tem uma linha com o <b>SET</b> em andamento e os <b>PONTOS</b> do game (0, 15, 30, 40). Toque em <b>+</b> na dupla que fez o ponto; o <b>−</b> desfaz. O game, o set e o tie-break avançam sozinhos.',
      '<b>Pontos</b> (canto superior) mostra o histórico de pontos do jogo. <b>Sair</b> volta sem perder o que foi marcado.',
      'No Avulso, o botão <b>Fechar set</b> encerra o set atual (quem tem mais games vence) e <b>Registrar placar</b> grava o resultado.',
    ],
    figs: [
      { img: '19-marcacao-lista.png', cap: 'Competições com jogos para marcar.' },
      { img: '21-marcacao-proximo.png', cap: 'Próximo jogo da competição.' },
      { img: '20-marcacao-ao-vivo.jpg', cap: 'Placar ao vivo.' },
    ],
  },
  {
    cap: 'Capítulo 9', titulo: 'King Scout: marcar um jogo',
    intro: 'O King Scout registra cada ponto com detalhe (quem sacou, como o ponto terminou, golpe, lado, posição na quadra). Para marcar, é preciso ser <b>super admin</b>; todos os membros podem consultar o resultado (capítulo 11).',
    passos: [
      'Abra o jogo (ainda sem placar) e toque em <b>👑 Usar King Scout</b>. Se já existe análise do jogo, aparecem <b>Continuar King Scout</b> ou <b>Ver análise do King Scout</b>.',
      'No topo, o selo mostra o <b>modo</b> (Simples, Padrão ou Avançado) e o botão <b>Encerrar</b> fecha a análise. O modo só pode ser trocado antes do primeiro ponto.',
      'O placar tem uma linha por dupla, a coluna do set e os <b>PONTOS</b> do game. A dupla que está sacando recebe a marca “● sacando”.',
      '<b>Ponto rápido</b>, embaixo do placar, soma o ponto de uma dupla sem detalhar a jogada.',
    ],
    tabela: {
      cab: ['Modo', 'O que registra'],
      linhas: [
        ['Simples', 'Sacador, finalização (Ace, Winner, Forçou Erro, Erro não forçado, Erro de saque, Erro de devolução), golpe, quem fez e lado. Sem dados do saque nem duração.'],
        ['Padrão', 'Tudo do Simples + posição e direção do saque + duração do ponto.'],
        ['Avançado', 'Tudo do Padrão + qualidade do saque, devolução, primeira bola, situações e comentário.'],
      ],
    },
    figs: [
      { img: '29-scout-inicio.jpg', cap: 'Início do King Scout (modo Avançado).' },
      { img: '31-scout-simples-1.jpg', cap: 'Modo Simples: sacador e finalização.' },
    ],
  },
  {
    cap: 'Capítulo 9', titulo: 'King Scout: registrar um ponto',
    intro: 'O mesmo caminho vale para os três modos; cada modo só acrescenta informação.',
    passos: [
      'Escolha o <b>sacador</b>. A rotação é automática: em duplas, os dois primeiros games são manuais e dali em diante o sacador é sugerido; no tie-break o primeiro saca 1 ponto e depois cada jogador saca 2.',
      'Escolha a <b>Finalização</b>. Os chips têm borda colorida (verde: ponto ganho com jogada; vermelho: erro; dourado: Ace).',
      'Responda, nesta ordem: <b>Como o Winner foi feito?</b> (o golpe), <b>Quem fez</b> e <b>De que lado</b> (Forehand ou Backhand, opcional). Nos erros, “quem fez” é quem errou.',
      '<b>Mapa de Calor (opcional)</b>: nos Winners, Forçou Erro e Erros não forçados, marque no primeiro grid onde estava quem fez o lance e no segundo para onde a bola foi (no erro não forçado vale a bola fora). Use <b>Inverter lados do mapa</b> se precisar.',
      'Toque em <b>Registrar Ponto</b>. Os últimos pontos aparecem embaixo e podem ser editados (toque neles) ou desfeitos (<b>↩ Desfazer</b>).',
    ],
    nota: '<b>A partida já começou?</b> Se você abriu o scout no meio do jogo, toque nessa opção antes do primeiro ponto, informe os sets já jogados e os games do set atual e toque em <b>Começar deste placar</b>. O app confere se o placar é possível no formato da competição.',
    figs: [
      { img: '32-scout-simples-winner.jpg', cap: 'Golpe, quem fez e lado.' },
      { img: '33-scout-mapa-1.jpg', cap: 'Mapa de calor: posição de quem fez.' },
      { img: '30-scout-semente.jpg', cap: 'A partida já começou?' },
    ],
  },
  {
    cap: 'Capítulo 10', titulo: 'King Scout: o relatório',
    intro: 'Ao encerrar, o relatório da partida abre sozinho. Ele também fica no histórico (capítulo 11).',
    passos: [
      '<b>Resumo</b>: placar em sets, games por set (com tie-break em número pequeno), pontos ganhos, 40×40, winners, aces, erros, confirmação de saque e break points.',
      '<b>Stats</b>: tabela por atleta. A estrela <b>★</b> marca o melhor da coluna (o menor, nos erros).',
      '<b>Qualidade</b>, <b>Saques</b> e <b>Finalizações</b>: gráficos por jogador. A aba <b>Mapa</b> só aparece quando algum lance teve posição marcada: escolha a dupla, o tipo de finalização e, se quiser, o jogador.',
      '<b>Dinâmica</b>: gráfico de momento do jogo e os <b>Momentos da partida</b> (sequências de 3 ou mais pontos seguidos e viradas).',
      '<b>Log</b>: todos os pontos, do mais recente ao primeiro, com o placar <b>depois</b> de cada ponto (“3x2 40x0”, “Set 1 encerrado”, “Fim · 1x0 em sets”).',
      'No topo: <b>⬇ PDF</b> gera o relatório da partida; <b>Excluir</b> apaga a análise (pede confirmação e <b>não muda</b> o placar da competição).',
    ],
    figs: [
      { img: '23-relatorio-resumo.jpg', cap: 'Resumo.' },
      { img: '25-relatorio-dinamica.jpg', cap: 'Dinâmica e momentos.' },
      { img: '26-relatorio-log.jpg', cap: 'Log: placar depois do ponto.' },
    ],
  },
  {
    cap: 'Capítulo 11', titulo: 'King Scout: histórico, atletas e PDF',
    intro: 'Qualquer membro do grupo pode consultar os jogos gravados pelo scout.',
    passos: [
      'Abra o <b>Perfil</b>, entre na aba <b>Estatísticas</b> e role até o atalho <b>King Scout</b> (“Jogos gravados ponto a ponto, relatórios em PDF e análise por atleta”).',
      'O <b>histórico</b> lista os jogos do grupo atual, do mais recente ao mais antigo, com a tabela de sets (tie-break em número pequeno). Toque num jogo para abrir o relatório, ou em <b>⬇ PDF</b> para gerar o PDF só desse jogo.',
      '<b>⬇ Relatório dos jogos</b> gera um PDF com todos os jogos gravados: data, duplas, placar por set, pontos e situação.',
      '<b>📈 Atletas</b> abre a análise de um atleta ao longo de várias partidas. Escolha o período (7, 30, 90 dias ou tudo) e o atleta.',
    ],
    figs: [
      { img: '05-perfil-king-scout.jpg', cap: 'Atalho King Scout no perfil.' },
      { img: '22-king-scout-historico.jpg', cap: 'Histórico de jogos gravados.' },
    ],
  },
  {
    cap: 'Capítulo 11', titulo: 'Análise do atleta',
    intro: 'Soma o que o scout registrou do atleta em todas as partidas do período.',
    passos: [
      '<b>Números</b>: partidas (com vitórias e derrotas), nota média, confirmação de saque, winners, aces, forçou erro e os erros de saque, devolução e não forçados.',
      '<b>Evolução recente</b> compara as últimas 3 partidas com as anteriores (precisa de pelo menos 4 partidas). <b>Evolução da nota</b> é o gráfico partida a partida: verde para vitória, vermelho para derrota.',
      '<b>O que treinar</b> traz sugestões baseadas nos números (só aparecem quando há dados suficientes).',
      '<b>Adversários</b>: toque num adversário para ver <b>como jogar contra</b> ele. <b>Por competição</b> mostra o saldo em cada uma.',
      '<b>⬇ PDF</b>, no topo, gera o relatório do atleta.',
    ],
    figs: [
      { img: '27-atleta-1.jpg', cap: 'Números do atleta e evolução recente.' },
      { img: '28-atleta-2.jpg', cap: 'Evolução da nota e adversários.' },
    ],
  },
  {
    cap: 'Capítulo 12', titulo: 'Perfil',
    intro: 'O seu cartão no grupo, com nível, conquistas e estatísticas.',
    passos: [
      'No topo, o <b>cartão</b> mostra o nome do grupo (com o <b>+</b> para trocar ou entrar em outro), seu círculo com as iniciais, o nome, a posição no ranking, os pontos e o aproveitamento. O <b>lápis</b> ao lado do círculo edita o perfil; o botão no canto envia o cartão para compartilhar.',
      'O <b>Nível</b> sobe com o XP. Toque no quadro do nível para ver <b>como o XP é calculado</b> (jogos, vitórias, competições, avaliações, honrarias e conquistas).',
      'As abas: <b>Sobre</b> (seus dados), <b>Avaliação</b> (a <b>Autoavaliação</b> e a <b>Avaliação da Comunidade</b>), <b>Conquistas</b>, <b>Rivalidade</b>, <b>Estatísticas</b> e <b>Histórico</b>.',
    ],
    figs: [
      { img: '04-perfil.png', cap: 'Cartão do perfil.' },
      { img: '05b-perfil-xp.jpg', cap: 'Como o XP é calculado.' },
      { img: '39-configuracoes.png', cap: 'Configurações: Ajuda e verificar atualização.' },
    ],
  },
  {
    cap: 'Capítulo 13', titulo: 'Pontuação e ranking',
    intro: 'Como o ranking do grupo calcula os pontos.',
    passos: [
      'A fórmula é <b>Pts = (Vitórias × A) + (Jogos × B) + (GA × C) + (Eventos × D)</b>. Os valores padrão são <b>A = 3</b>, <b>B = 0,5</b>, <b>C = 2</b> e <b>D = 0</b>. O administrador do grupo pode mudá-los em <b>Configurações → Fórmula de pontuação</b>.',
      '<b>GA (game average)</b> é games pró ÷ games contra, com máximo de 9,99. Quem nunca tomou game aproxima-se do teto, por isso o administrador pode ligar a <b>suavização do GA</b> (valor K): GA = (pró + K) ÷ (contra + K). Assim, uma única vitória 6×0 não leva ninguém ao topo.',
      '<b>Mínimo de jogos para ranquear</b>: quem jogou menos que o mínimo aparece “em classificação”, sem posição.',
      'Desempate, nesta ordem: saldo de games, GA, vitórias, confronto direto (só entre empatados) e ordem alfabética.',
      'Ao criar uma competição, a <b>Pontuação própria</b> é opcional. Desligada, a classificação da competição usa a fórmula do grupo; ligada, usa os seus números, mas <b>só na classificação daquela competição</b>. O ranking geral continua com a fórmula do grupo.',
      'Competições “amistosas” (que não valem ranking) não entram na pontuação.',
    ],
    figs: [],
  },
  {
    cap: 'Capítulo 14', titulo: 'Dúvidas frequentes',
    intro: '',
    faq: [
      ['O app abriu num grupo que eu não esperava.', 'Ele abre direto no último grupo que você usou. Para trocar, toque no “+” ao lado do nome do grupo, no topo do Perfil.'],
      ['Não vejo o botão “Usar King Scout”.', 'Marcar jogos no scout é exclusivo do super admin. Os demais membros consultam o histórico, os relatórios e as análises de atleta pelo Perfil.'],
      ['Por que o Salvar placar está desabilitado?', 'Provavelmente o set terminou em tie-break e faltam os pontos dele (ou estão inválidos), ou o placar ainda não define um vencedor. A mensagem embaixo do set diz o que falta.'],
      ['O tie-break não aparece no registro à mão.', 'Ele só aparece quando o set termina como termina um set decidido no tie-break no formato da competição. No Avulso, marque a caixa “Tie-break” no set (ou use o atalho 7–6).'],
      ['Posso empatar um jogo?', 'No Avulso e no formato “4 games no total”, sim. Nas demais competições o jogo precisa ter um vencedor.'],
      ['Apaguei uma análise do scout sem querer.', 'Ela não tem como ser desfeita pelo app. O placar da competição não muda ao excluir a análise; só os pontos detalhados e o relatório se perdem.'],
      ['Como ligo o bloqueio por biometria?', 'No aplicativo Android, em Configurações → Preferências, ligue “Bloqueio por biometria” e confirme a digital ou o rosto. O app passa a pedir a biometria ao abrir e depois de 5 minutos fora dele. Não substitui a senha da conta.'],
      ['Como atualizo o app?', 'Quando há versão nova, uma barra “Atualizar para v…” aparece no app; toque nela. Para conferir na hora, use Configurações → Ajuda → Verificar atualização. No navegador, basta recarregar a página.'],
    ],
    figs: [],
  },
];

const esc = s => String(s);

function figuras(figs, peq) {
  if (!figs || figs.length === 0) return '';
  return `<div class="figs n${figs.length}${peq ? ' peq' : ''}">${figs
    .map(f => `<figure><img src="img/${f.img}" alt="${esc(f.cap)}"><figcaption>${f.cap}</figcaption></figure>`)
    .join('')}</div>`;
}

function tabela(t) {
  if (!t) return '';
  return `<table class="tab"><tr>${t.cab.map(c => `<th>${c}</th>`).join('')}</tr>${t.linhas
    .map(l => `<tr><td class="modo">${l[0]}</td><td>${l[1]}</td></tr>`).join('')}</table>`;
}

let pagina = 1;
function pagina_(conteudo, opts = {}) {
  const n = pagina++;
  return `<section class="page${opts.capa ? ' cover' : ''}">${conteudo}${opts.capa ? '' : `<footer><span>King BT · Manual do Usuário</span><span>${n}</span></footer>`}</section>`;
}

function capitulo(c) {
  const passos = c.passos ? `<ol class="passos">${c.passos.map(p => `<li>${p}</li>`).join('')}</ol>` : '';
  const faq = c.faq ? c.faq.map(([q, r]) => `<div class="faq"><div class="q">${q}</div><div class="r">${r}</div></div>`).join('') : '';
  return pagina_(`
    <header><span class="chip">${c.cap}</span><h2>${c.titulo}</h2></header>
    ${c.intro ? `<p class="intro">${c.intro}</p>` : ''}
    ${passos}${tabela(c.tabela)}${faq}
    ${c.nota ? `<div class="nota">${c.nota}</div>` : ''}
    ${figuras(c.figs, c.peq)}`);
}

const indice = [
  ['1', 'Primeiros passos'], ['2', 'Início'], ['3', 'Arena: Competições, Ranking e Atletas'], ['4', 'Competições'],
  ['5', 'Criar uma competição'], ['6', 'Registrar o placar à mão'], ['7', 'Competição Avulsa'],
  ['8', 'Marcação ponto a ponto'], ['9', 'King Scout: marcar um jogo'], ['10', 'King Scout: o relatório'],
  ['11', 'King Scout: histórico, atletas e PDF'], ['12', 'Perfil'], ['13', 'Pontuação e ranking'], ['14', 'Dúvidas frequentes'],
];

const capa = pagina_(`
  <div class="capa-in">
    <img class="logo" src="img/icon.png" alt="KING BT">
    <div class="capa-titulo">KING BT</div>
    <div class="capa-sub">BEACH TENNIS</div>
    <div class="regua"></div>
    <div class="doc">Manual do Usuário</div>
    <div class="doc-sub">Passo a passo, com imagens das telas</div>
    <div class="toc">
      <div class="toc-h">ÍNDICE</div>
      ${indice.map(([n, t]) => `<div class="toc-r"><span class="toc-n">${n}</span><span class="toc-t">${t}</span></div>`).join('')}
    </div>
    <div class="capa-rod"><span>Versão de outubro de 2026</span><span>As telas são do grupo de teste</span></div>
  </div>`, { capa: true });

const paginas = [capa, ...CAPITULOS.map(capitulo)];

const css = `
@page { size: A4; margin: 0; }
:root { --bg:#070500; --gold:#F3C544; --gold2:#C2891A; --text:#F6EFDD; --muted:#A99B7C; --faint:#6E6452; --line:rgba(243,197,68,.2); --surf:#121008; --surf2:#1C1810; --teal:#54C98A; --coral:#E5483D; }
* { box-sizing:border-box; margin:0; padding:0; }
html, body { background:#030200; }
body { font-family:'Sora', 'Segoe UI', Arial, sans-serif; color:var(--text); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page { width:210mm; height:296mm; margin:0 auto; background:var(--bg); page-break-after:always; position:relative; overflow:hidden; padding:13mm 15mm 16mm; display:flex; flex-direction:column; gap:4.5mm; }
.page::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 100% 40% at 50% -5%, rgba(243,197,68,.12), transparent 60%); pointer-events:none; }
.page > * { position:relative; z-index:1; }
header { display:flex; align-items:center; gap:3.5mm; padding-bottom:3.5mm; border-bottom:.3mm solid var(--line); }
.chip { font-family:'Space Grotesk', sans-serif; font-size:7.5pt; font-weight:700; letter-spacing:.35mm; text-transform:uppercase; color:var(--gold); border:.25mm solid var(--line); border-radius:1.5mm; padding:.8mm 2.5mm; background:rgba(243,197,68,.08); }
h2 { font-size:17pt; font-weight:800; letter-spacing:-.2mm; }
.intro { font-size:9.6pt; line-height:1.55; color:var(--muted); }
.passos { list-style:none; counter-reset:p; display:flex; flex-direction:column; gap:2.6mm; }
.passos li { counter-increment:p; position:relative; padding-left:8mm; font-size:9.3pt; line-height:1.5; color:#E9E0C8; }
.passos li::before { content:counter(p); position:absolute; left:0; top:.2mm; width:5.6mm; height:5.6mm; border-radius:50%; border:.3mm solid var(--gold); color:var(--gold); font-family:'Space Grotesk', sans-serif; font-weight:700; font-size:7.5pt; display:flex; align-items:center; justify-content:center; background:rgba(243,197,68,.07); }
b { color:#fff; font-weight:700; }
code { font-family:'Space Grotesk', monospace; color:var(--gold); background:rgba(243,197,68,.1); padding:.2mm 1.2mm; border-radius:1mm; font-size:8.6pt; }
.nota { border-left:.9mm solid var(--gold); background:var(--surf); padding:3mm 4mm; font-size:8.9pt; line-height:1.5; color:#E9E0C8; border-radius:0 2mm 2mm 0; }
.tab { width:100%; border-collapse:collapse; font-size:8.8pt; }
.tab th { text-align:left; color:var(--gold); font-size:7.5pt; letter-spacing:.25mm; text-transform:uppercase; padding:1.6mm 2.4mm; border-bottom:.3mm solid var(--line); }
.tab td { padding:2mm 2.4mm; border-bottom:.2mm solid rgba(243,197,68,.08); line-height:1.45; color:#E9E0C8; vertical-align:top; }
.tab .modo { width:23mm; font-weight:800; color:var(--gold); }
.figs { margin-top:auto; display:flex; justify-content:center; align-items:flex-start; gap:6mm; }
figure { display:flex; flex-direction:column; align-items:center; gap:1.8mm; }
figure img { display:block; border-radius:3.4mm; border:.35mm solid rgba(243,197,68,.35); box-shadow:0 1.5mm 5mm rgba(0,0,0,.6); background:#0b0905; }
.n1 img { width:76mm; } .figs.peq img { width:38mm; } .n2 img { width:58mm; } .n3 img { width:52mm; }
figcaption { font-size:7.4pt; line-height:1.35; color:var(--muted); text-align:center; max-width:56mm; }
.faq { border-bottom:.2mm solid rgba(243,197,68,.12); padding:2.4mm 0; }
.faq .q { font-weight:700; font-size:9.6pt; color:var(--gold); margin-bottom:1mm; }
.faq .r { font-size:9pt; line-height:1.5; color:#E9E0C8; }
footer { position:absolute !important; left:15mm; right:15mm; bottom:7mm; display:flex; justify-content:space-between; font-size:7pt; color:var(--faint); border-top:.2mm solid var(--line); padding-top:2mm; }
.cover { padding:0; justify-content:center; align-items:center; }
.capa-in { width:100%; display:flex; flex-direction:column; align-items:center; gap:4.2mm; padding:16mm 24mm; text-align:center; }
.logo { width:44mm; height:44mm; object-fit:contain; filter:drop-shadow(0 0 8mm rgba(243,197,68,.5)); }
.capa-titulo { font-size:44pt; font-weight:900; letter-spacing:-1.4mm; line-height:.9; background:linear-gradient(155deg,#FFE880 0%,#F3C544 45%,#9A6200 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.capa-sub { font-size:8.5pt; font-weight:700; letter-spacing:2.2mm; color:var(--muted); }
.regua { width:30mm; height:.3mm; background:linear-gradient(90deg,transparent,var(--gold),transparent); }
.doc { font-size:19pt; font-weight:800; }
.doc-sub { font-size:9.6pt; color:var(--muted); }
.toc { width:100%; max-width:118mm; margin-top:4mm; background:var(--surf); border:.3mm solid var(--line); border-radius:4mm; padding:5mm 6.5mm; text-align:left; }
.toc-h { font-size:7.5pt; font-weight:700; letter-spacing:.7mm; color:var(--gold); padding-bottom:2.6mm; margin-bottom:1.6mm; border-bottom:.3mm solid var(--line); }
.toc-r { display:flex; gap:3mm; padding:1.25mm 0; font-size:9pt; border-bottom:.2mm solid rgba(243,197,68,.06); }
.toc-n { width:6mm; text-align:right; color:var(--gold2); font-family:'Space Grotesk', sans-serif; font-weight:700; }
.toc-t { font-weight:600; }
.capa-rod { margin-top:6mm; width:100%; display:flex; justify-content:space-between; font-size:7.6pt; color:var(--faint); border-top:.25mm solid var(--line); padding-top:3mm; }
@media screen { body { padding:6mm 0; } .page { margin-bottom:6mm; } }
`;

const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>King BT — Manual do Usuário</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>${css}</style></head>
<body>${paginas.join('\n')}</body></html>`;

const saida = resolve(aqui, 'Manual-do-King-BT.html');
writeFileSync(saida, html, 'utf8');
console.log(`OK: ${paginas.length} páginas em ${saida}`);
