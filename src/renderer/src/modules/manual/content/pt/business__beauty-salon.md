# Salão de Beleza

Salão de Beleza é um dos 24 modelos de negócio de serviço específicos do Sarang. Como todo tipo de negócio desse grupo, as telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

Todo modelo de negócio de serviço compartilha a mesma base: **Agendamentos** para agendamento, um **Catálogo de serviços** do que você oferece e a que preço, **Agenda do prestador** para definir o horário de trabalho de cada membro da equipe e gerar horários realmente reserváveis, e uma **Notification Queue** em segundo plano que envia lembretes de agendamento. Salão de Beleza adiciona três coisas sobre essa base: pacotes de sessões, comissão da equipe, e agendamento multisserviço.

## Agendamento Multisserviço

Um agendamento de salão raramente é apenas um serviço — uma cliente pode fazer um corte, uma coloração, e uma escova na mesma visita. O formulário de agendamento do Salão de Beleza permite adicionar vários serviços a um único agendamento; o Sarang soma seus preços e durações automaticamente e reserva um horário combinado em vez de forçá-lo a criar agendamentos separados. Os agendamentos também podem trazer uma **atribuição de cadeira** para que você saiba em qual posto uma cliente está agendada. Anexe **fotos reais de antes/depois** a um agendamento pelo seu botão de ícone de câmera.

Se você definiu quais cabeleireiros são qualificados para quais serviços (a partir do registro de Employee de um cabeleireiro — veja *Comissão da Equipe* abaixo), o seletor Provider do formulário de agendamento se restringe automaticamente apenas aos cabeleireiros qualificados assim que um serviço correspondente é escolhido.

## Checkout com venda adicional no varejo

Concluir um agendamento abre um **Checkout** real — o total do serviço já está lá automaticamente, e você pode adicionar produtos reais de varejo (shampoo, produto de styling) com quantidade diretamente na mesma nota, além de escolher o método de pagamento real recebido. Tudo sai como uma única nota fiscal com as linhas de serviço e de varejo juntas, em vez de duas transações separadas.

## Pacotes de Sessões

Uma cliente pode comprar um pacote de sessões pré-pagas de uma vez (por exemplo, "pacote de spa capilar de 10 sessões") em vez de pagar por visita. **Pacotes de sessões** lista os pacotes de cada cliente com quantas sessões restam, sinaliza pacotes que estão acabando (2 ou menos restantes) ou já expirados, e permite pesquisar por cliente. Quando um agendamento vinculado a uma cliente com um pacote ativo é marcado como **Concluído**, o Sarang deduz automaticamente uma sessão daquele pacote em vez de exigir uma nota fiscal separada — a lista de agendamentos marca esses como "Paid via pack" em vez de mostrar uma ação de nota fiscal.

## Comissão da Equipe

Quando um agendamento concluído tem um prestador e um valor, o Sarang pode calcular a comissão desse membro da equipe automaticamente (10% padrão da receita de serviço, embora a taxa real de cada membro da equipe seja configurável no seu registro de Employee). A tela **Comissão** fornece um relatório mensal por membro da equipe — receita gerada, comissão ganha, gorjetas, e quanto está pago versus ainda pendente — mais uma lista completa registro por registro que você pode filtrar por equipe ou status de pagamento e marcar como pago em massa assim que os pagamentos forem liquidados.

No formulário de edição de um funcionário, marque quais serviços ele está **qualificado** para realizar — deixe um serviço sem cabeleireiros qualificados definidos e qualquer prestador ainda pode ser agendado para ele, então isso é totalmente opcional e não muda nada a menos que você o configure.
