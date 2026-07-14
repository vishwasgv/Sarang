# Distribuidor / Atacado

Escolher **Distribuidor** como seu tipo de negócio ativa a **imposição de limite de crédito**, a **entrada de pedidos em atacado**, a **análise de saldos pendentes** e o conjunto de módulos compartilhado de **Logística**. Tudo o mais — Faturamento, Produtos, Clientes, Estoque, Relatórios — funciona exatamente como descrito nesses capítulos; este capítulo cobre o que é específico de um negócio de distribuição/atacado.

## Entrada de Pedidos em Atacado

Abra **Bulk Order Entry** na barra lateral para montar rapidamente um grande pedido de atacado — busque e adicione produtos um a um (cada nova linha começa com quantidade 1 e seu preço de venda normal), depois ajuste as quantidades diretamente. A precificação por volume entra em ação automaticamente por linha, com base na quantidade pedida:

- 10+ unidades → 5% de desconto
- 50+ unidades → 10% de desconto
- 100+ unidades → 15% de desconto

Aplica-se a maior faixa para a qual a linha se qualifica; quantidades pequenas comuns não recebem desconto. Busque e vincule um cliente atacadista ao pedido (obrigatório se você escolher Crédito como forma de pagamento — pedidos em Dinheiro, UPI e Cartão não precisam de cliente), opcionalmente anote uma referência do pedido e observações de entrega, e envie — isso cria uma nota normal que você encontrará depois em Notas, marcada com a referência do pedido em atacado em suas observações.

## Análise de Saldos Pendentes

Abra **Outstanding Analytics** para ver sua exposição total de crédito entre todos os clientes atacadistas com saldo em aberto: total pendente, quantos clientes estão atualmente acima do limite de crédito e o saldo pendente médio por cliente. Uma divisão por **antiguidade** mostra há quanto tempo cada valor está pendente — Atual, 1–30 dias, 31–60 dias, 61–90 dias, 90+ dias — para que você veja não apenas quanto é devido, mas o quanto está atrasado. A lista de clientes abaixo mostra o limite de crédito de cada um, o saldo pendente atual (com uma barra de progresso em relação ao limite) e seu valor de 90+ dias, e é ordenada para que quem estiver acima do limite se destaque em vermelho. Toque em qualquer cliente para ir direto ao registro completo dele.

## Imposição de limite de crédito

Defina um **limite de crédito** para um cliente a partir do seu registro em **Clientes**, e o Sarang bloqueia qualquer nova venda a *crédito* (do Faturamento ou da Entrada de Pedidos em Atacado) que faça o saldo pendente dele ultrapassar esse limite — rejeitada diretamente no momento de salvar, com uma mensagem mostrando o saldo pendente dele, o valor da nova nota e o limite dele. Isso se aplica apenas a vendas pelo método Crédito; vendas em Dinheiro, UPI, Cartão e Divididas não são afetadas. Um limite de crédito de 0 significa que nenhum limite é imposto.

## Logística e Cadeia de Suprimentos

Como o modelo padrão do Distribuidor inclui os módulos de Logística, você também tem **Frota**, **Transportadoras**, **Remessas**, **Nota de Recebimento (GRN)**, **Guia de Remessa**, **Livro de Fretes** e **Análise de Logística** para rastrear seus próprios veículos de entrega e as remessas de fornecedores — veja as telas de Logística sob esses nomes na barra lateral.

## O que é compartilhado com todo negócio

Faturamento, emissão de notas, pagamentos, Clientes, Produtos, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos.
