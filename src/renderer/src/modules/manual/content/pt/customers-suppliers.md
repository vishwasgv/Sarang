# Clientes e Fornecedores

## Adicionando clientes e fornecedores

Abra **Clientes** ou **Fornecedores** na barra lateral para ver a lista completa. Clique em **Adicionar Cliente** / **Adicionar Fornecedor** para criar um. Um cadastro de cliente contém nome, telefone, e-mail, endereço (cidade/estado/país), número fiscal, limite de crédito e observações; um cadastro de fornecedor contém os detalhes equivalentes do lado empresarial (nome, telefone, e-mail, endereço, número fiscal, observações).

Ambos podem ser **arquivados** em vez de excluídos, o que os oculta das listas do dia a dia (faturamento, criação de pedido de compra, e assim por diante) sem perder o histórico de transações.

## Razão e saldo pendente

Clicar em um cliente ou fornecedor abre a tela de detalhes dele, que mostra as informações de contato junto com a conta corrente:

- A tela de detalhes de um **cliente** mostra o limite de crédito e o **saldo pendente** — quanto ele deve a você atualmente — além de um razão de transações com todo débito (uma nota de venda a crédito) e crédito (um pagamento ou nota de crédito) que afeta esse saldo, cada um com um total corrente.
- A tela de detalhes de um **fornecedor** mostra o **Balance Payable** — quanto você deve a ele atualmente — com o mesmo tipo de razão (uma compra aumenta o que você deve; um pagamento ou nota de débito o reduz). Se você deve dinheiro a um fornecedor, um botão **Record Payment** permite registrar um pagamento diretamente para ele (Dinheiro, Transferência Bancária, Cheque, UPI, Cartão ou Outro), com um número de referência e observações opcionais.

Ambos os razões mostram os últimos 100 lançamentos. O saldo exibido é sempre calculado a partir do histórico completo de transações, não de um número corrente em cache, então ele nunca pode ficar dessincronizado do que realmente aconteceu.

## O padrão de busca por telefone com adição rápida

Sempre que o Sarang precisa que você vincule um cliente a algo — uma nova nota, um orçamento, um agendamento, um check-in de hotel, e assim por diante — ele usa a mesma caixa de busca de cliente: comece digitando um nome ou número de telefone, e qualquer correspondência existente aparece em uma lista suspensa em instantes. Se o cliente ainda não existir, **+ Add new customer** expande um formulário simples apenas com nome e telefone, e seleciona imediatamente o cliente recém-criado sem sair da tela em que você estava.

Isso é proposital: buscar pelo número de telefone antes de criar um novo cadastro é o que evita que a mesma pessoa acabe com vários cadastros de Cliente duplicados em diferentes partes do aplicativo. Sempre busque primeiro — se um cliente foi criado em qualquer outra tela do Sarang, o número de telefone dele o encontrará novamente aqui.

## Histórico de compras do fornecedor

O envolvimento de um fornecedor nas suas compras aparece em alguns lugares conectados, em vez de uma única tela: **Pedidos de Compra** filtrados ou pesquisados pelo nome do fornecedor, o próprio razão do fornecedor (que reflete cada pedido de compra recebido e cada pagamento feito a ele) e qualquer **Nota de Débito** emitida contra um pedido de compra com aquele fornecedor. Juntas, essas informações dão um panorama completo do que você comprou de um fornecedor e do que você deve a ele atualmente.
