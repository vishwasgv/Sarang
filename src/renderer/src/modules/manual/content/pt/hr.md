# RH: Funcionários, Frequência e Licenças

Abra **Funcionários**, **Frequência** e **Licença** na barra lateral para gerenciar sua equipe — essas três telas funcionam juntas e alimentam diretamente o capítulo Folha de Pagamento deste Manual. Visualizá-las exige apenas a permissão **View HR**; adicionar/editar funcionários, marcar frequência e aprovar licenças exigem todos a permissão **Manage HR**.

## Funcionários

Toque em **Adicionar Funcionário** para criar um registro de funcionário — nome, número de funcionário, telefone, e-mail, departamento e cargo são todos opcionais, exceto o nome completo do funcionário e a data de admissão. Escolha um **Tipo de Funcionário** (Tempo Integral, Tempo Parcial, Contrato ou Diarista) e um **Tipo de Salário** (Mensal, Diário ou Por Hora) — o Tipo de Salário controla exatamente como a Folha de Pagamento calcula o pagamento dessa pessoa; veja o capítulo Folha de Pagamento para o detalhamento completo.

O Salário Base e quaisquer **Adicionais** que você adicionar aqui (linhas nomeadas como Auxílio-Moradia ou Auxílio-Transporte, cada uma com seu próprio valor) formam juntos o Salário Bruto do funcionário — toda essa seção é claramente identificada como **Apenas para Referência**, porque é o valor de partida que a Folha de Pagamento lê, não um registro de folha de pagamento em si.

Se o seu negócio tiver um Catálogo de Serviços ativado (salões, clínicas e setores de serviço similares), editar um funcionário também mostra uma lista de **Serviços Qualificados** — marque quais serviços esse funcionário está capacitado a realizar, o que é o que permite que as telas de agendamento o ofereçam como prestador para esses serviços específicos.

Ative **Mostrar Inativos** para ver ex-funcionários. **Desative** um funcionário em vez de excluí-lo — isso mantém intactos seu histórico de frequência, licenças e contracheques, ao mesmo tempo em que o remove das listas de equipe ativa e dos seletores de prestador nos agendamentos daqui em diante.

## Frequência

A frequência é marcada um dia de cada vez, para cada funcionário ativo, a partir de um seletor de status simples: **Presente**, **Ausente**, **Meio Período**, **Licença**, **Feriado** ou **Folga Semanal**. Mude para outra data com o seletor de data no topo, use os atalhos **Marcar todos como** para definir o mesmo status para todos de uma vez (útil para um feriado da empresa), ajuste quem for a exceção, depois toque em **Salvar Frequência**.

Mude para a aba **Mensal** para uma grade somente leitura em estilo calendário — cada funcionário como uma linha, cada dia do mês como uma coluna, cada célula mostrando o status daquele dia rapidamente. Útil para identificar padrões ou revisar um mês antes de rodar a Folha de Pagamento.

**O que cada status realmente significa para o pagamento**: o pagamento de um funcionário assalariado mensal só é reduzido pelos dias **Ausente** e **Meio Período** — **Folga Semanal**, **Feriado** e **Licença** nunca reduzem um salário mensal, porque um salário mensal fixo deve permanecer fixo independentemente de fins de semana, feriados públicos ou licenças aprovadas. Funcionários com salário Diário ou Por Hora são pagos apenas pelos dias realmente marcados como Presente (um Meio Período conta como metade). Veja o capítulo Folha de Pagamento para o cálculo exato.

## Licenças

A aba **Solicitações de Licença** lista todas as solicitações de licença, filtráveis por status (Pendente/Aprovado/Rejeitado). Toque em **Nova Solicitação** para registrar uma em nome de um funcionário — escolha o funcionário, um Tipo de Licença, o período de datas (o número de dias é preenchido automaticamente) e um motivo opcional. Escolher um funcionário também mostra o saldo de licenças atual dele para cada tipo no ano, para que você veja quantos dias restam antes de enviar.

Uma solicitação Pendente pode ser **Aprovado** ou **Rejeitado**. Aprovar verifica primeiro o saldo restante do funcionário para aquele Tipo de Licença e bloqueia a aprovação com uma mensagem clara se isso ultrapassar o limite anual dele — nada é permitido silenciosamente além do limite.

A aba **Tipos de Licença** é onde você define quais tipos de licença existem no seu negócio — Licença Casual, Licença Médica, Licença Adquirida e assim por diante vêm como padrões sensatos. Cada tipo tem um nome, um limite máximo de dias por ano, e um indicador **Licença Remunerada** para seu próprio controle de quais tipos de licença são remunerados ou não remunerados no seu negócio.

Aprovar uma solicitação de licença aqui não marca automaticamente esses dias como **Licença** na tela de Frequência — os dois são controlados separadamente, então lembre-se de também marcar os dias correspondentes na Frequência se quiser que sejam refletidos ali para fins de folha de pagamento.
