# Auditoria

A **Auditoria** (barra lateral) é um registro permanente das ações significativas realizadas no Sarang — quem fez o quê, e quando. Ela existe para que você sempre possa responder "quem alterou isso?" ou "quem fez login e quando?", e para ajudar a identificar qualquer coisa fora do comum.

## O que é registrado

O Sarang registra uma entrada de auditoria para ações em todo o aplicativo, incluindo (entre muitas outras): logins, logouts e tentativas de login malsucedidas; alterações de senha; criação e cancelamento de notas fiscais; pagamentos registrados e revertidos; estoque adicionado ou ajustado; backups criados, restaurados ou excluídos; e alterações nas configurações do negócio. Cada entrada mostra a data e a hora, a ação (por exemplo, "INVOICE CREATED", "PAYMENT REVERSED"), a entidade afetada (por exemplo, qual Nota ou Produto) e qual usuário a realizou — ou "Sistema" se não estiver vinculada a um usuário logado específico.

## Visualizando e filtrando o registro

A tela de Auditoria lista as entradas das mais recentes para as mais antigas, 50 por página, com controles de página **Anterior/Próximo**. Use o menu suspenso de tipo de entidade no topo para filtrar por um tipo específico de registro (Usuário, Nota Fiscal, Pagamento, Estoque, Produto, Cliente, Backup e muitos outros tipos de entidade específicos do negócio). Clique em **Ver** em qualquer linha que tenha detalhes registrados para expandi-la e ver os valores antigo e novo envolvidos naquela ação (mostrados como dados legíveis, não código bruto).

Entradas muito antigas são automaticamente eliminadas após um período de retenção configurável (2 anos por padrão), para que o registro não cresça para sempre — isso remove apenas histórico genuinamente antigo, não nada recente.

## Verificando se o seu histórico de auditoria não foi adulterado

Clique em **Verificar Integridade** no topo da tela de Auditoria. O Sarang consegue verificar se todo o seu histórico de auditoria não foi adulterado — cada entrada é secretamente vinculada à anterior no momento em que é criada, então, se alguém alguma vez conseguisse entrar e editar ou excluir discretamente uma entrada passada (por exemplo, para esconder que uma nota cancelada realmente aconteceu, ou para apagar um ajuste de estoque suspeito), esse vínculo se romperia e o Sarang detectaria.

Executar a verificação informa uma de duas coisas:
- **A cadeia está intacta** — mostrando quantas entradas foram verificadas, confirmando que nada no seu histórico registrado foi alterado.
- **A cadeia está quebrada** — apontando aproximadamente onde a quebra foi encontrada, para que você saiba que algo na sua trilha de auditoria não corresponde ao que deveria.

Essa verificação é executada sob demanda (não é automática a cada abertura do aplicativo, já que verificar um histórico grande é um trabalho real) — execute-a sempre que quiser ter certeza de que seus registros são confiáveis, por exemplo antes de recorrer ao registro de auditoria para resolver uma disputa.
