# Usuários e Permissões

Se mais de uma pessoa usa o Sarang — um proprietário mais operadores de caixa, equipe de cozinha ou gerentes — adicione cada uma delas como seu próprio **Usuário**, com um **Perfil** que controla exatamente o que ela pode ver e fazer. Isso é gerenciado em **Configurações → Users & Roles**.

## Adicionando um usuário

Clique em **Adicionar Usuário** e preencha:

- **Nome Completo** (obrigatório)
- **Usuário** (obrigatório — usado para fazer login)
- **Senha** (obrigatória, comprimento mínimo definido pela sua Política de Senhas, no mínimo 6 caracteres)
- **Perfil** (obrigatório — veja abaixo)
- **E-mail** e **Telefone** (opcionais)

Salve, e a nova conta pode fazer login imediatamente com o usuário e a senha definidos.

## Perfis

Todo usuário recebe um perfil, e todo perfil vem com um conjunto fixo de permissões já incorporado ao Sarang — não existe uma tela para criar perfis personalizados ou escolher permissões individuais manualmente. Os perfis internos são:

- **Admin** — acesso total ao sistema, incluindo todas as configurações, todos os relatórios e a própria gestão de usuários.
- **Manager** — controle operacional amplo (faturamento, estoque, compras, relatórios, a maioria das configurações) sem acesso total de administrador.
- **Cashier** — focado em faturamento: criação de notas fiscais, registro de pagamentos e as operações do dia a dia do balcão relevantes para o seu tipo de negócio.
- **Staff** — suporte operacional geral, com acesso mais restrito do que Cashier/Manager.
- **Kitchen Staff** — limitado às operações de cozinha do restaurante (visualização/atualização de KOT), para negócios que usam o modelo Restaurante.

Cada tela e ação no Sarang verifica as permissões do perfil do usuário atual antes de permiti-la — por exemplo, a própria seção Users & Roles só é visível para um usuário cujo perfil inclua a permissão `users.view`, e criar, editar ou desativar outros usuários exigem, cada um, sua própria permissão separada. Se o seu perfil não tiver acesso a algo, a opção fica oculta ou aparece desabilitada.

## Editando um usuário ou alterando seu perfil

Clique no ícone de edição (lápis) ao lado de um usuário para alterar seu nome completo, perfil, e-mail ou telefone. O usuário e a senha não são alterados por este formulário — veja redefinição de senha abaixo.

## Desativando um usuário

Clique no ícone de exclusão ao lado de um usuário ativo para desativá-lo (exige a permissão de desabilitar). Uma conta desativada não pode mais fazer login, mas seus registros históricos (notas criadas, ações registradas, etc.) são preservados. Você não pode desativar sua própria conta a partir desta tela.

## Redefinindo a senha de outro usuário

Clique no ícone de escudo ao lado de um usuário (não disponível para a sua própria conta) para definir uma nova senha diretamente para ele — útil se ele a esqueceu. Isso invalida imediatamente qualquer sessão já autenticada desse usuário.

## Alterando sua própria senha

Vá em **Configurações → Security**, informe sua senha atual, depois sua nova senha duas vezes. Sua nova senha precisa atender ao comprimento mínimo configurado (10 caracteres por padrão). Após uma alteração bem-sucedida, você precisará fazer login novamente.

## Política de senhas

Também em **Configurações → Security**, um administrador pode definir o **comprimento mínimo de senha** exigido para toda conta daí em diante (entre 4 e 64 caracteres). Isso só se aplica na próxima vez que uma senha for criada ou alterada — senhas já existentes não são afetadas retroativamente.

## Expiração de sessão

Por segurança, o Sarang encerra automaticamente a sessão de um login inativo após um período sem atividade (30 minutos por padrão) — qualquer clique do mouse, tecla pressionada, rolagem ou toque reinicia o contador. Isso protege contra alguém se afastar de um caixa ou computador de escritório desbloqueado. Fazer login novamente exige apenas seu usuário e senha de novo; nenhum trabalho em andamento é perdido além do que ainda não havia sido salvo.

## Proteção de login

Após 5 tentativas de login sem sucesso para o mesmo usuário dentro de 15 minutos, o Sarang bloqueia temporariamente novas tentativas e informa quantos minutos esperar — isso se aplica tanto ao login quanto à alteração da sua própria senha, para dificultar quem estiver tentando adivinhar uma senha.
