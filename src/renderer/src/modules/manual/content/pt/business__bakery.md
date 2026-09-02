# Padaria / Doceria / Buffet

## O que é diferente neste tipo de negócio

Uma padaria vende produtos de giro rápido e curta validade feitos a partir de receitas (farinha, açúcar, manteiga descontados por bolo vendido), recebe pedidos personalizados de bolos encomendados com antecedência, e frequentemente atende pedidos de buffet para eventos — 50 salgadinhos e 20 cupcakes para uma festa, comparados com o catálogo e faturados de uma vez. Padaria combina o rastreamento de receitas/ingredientes do Restaurante (sem o fluxo de mesa/KOT — uma venda no balcão não é uma comanda), o rastreamento de lote/validade da Farmácia para curta validade, e o mecanismo de pedidos por lista em massa da Papelaria reaproveitado tal como está para buffet.

## Dedução de Ingredientes Baseada em Receita

Configure uma Receita em qualquer Produto de panificação (Produto → Receita) da mesma forma que um prato de Restaurante — liste cada ingrediente e quanto dele vai em uma unidade. Como uma venda no balcão da padaria não tem fluxo de comanda de cozinha, o estoque de ingredientes é deduzido automaticamente no momento em que a venda é faturada, não em uma etapa separada de "pedido concluído".

## Pedidos Personalizados

Abra **Custom Orders** na barra lateral para encomendar um bolo personalizado ou item sob encomenda: escolha o cliente, adicione cada item com sua quantidade e preço, e opcionalmente registre a personalização de uma linha — sabor, tamanho, mensagem ou design. Defina um valor de sinal e como foi cobrado; o sinal não pode exceder o total do pedido.

Quando o pedido estiver pronto, use **Generate Invoice** no pedido — isso cria a nota fiscal real a partir dos próprios itens do pedido e registra automaticamente o sinal já cobrado como um pagamento real contra ela.

## Pedidos de Buffet por Lista

Abra **Bulk-List Orders** (a mesma tela que a Papelaria usa para listas escolares) para lidar com um pedido de buffet: registre cada linha como texto livre ("50 salgadinhos", "20 cupcakes"), associe cada uma a um produto real do catálogo, e fature o pedido inteiro de uma vez assim que cada linha estiver associada.

## Eventos de Buffet

Abra **Eventos de Buffet** na barra lateral para uma reserva de evento completa — um casamento ou um evento grande, não um pedido em massa do mesmo dia. Escolha o cliente, a data de início (e término, para eventos de vários dias) do evento, o endereço do local, e o número de convidados, depois defina um **preço por prato** como cotação inicial. Adicione o cardápio do evento (produtos reais do catálogo com quantidade e preço), uma contagem de refeições e lanches para cada dia de serviço, e a equipe com seu próprio custo por função — cozinheiro, garçom, limpeza ou outro, cada um com sua própria quantidade de trabalhadores e taxa por trabalhador.

Assim que o preço for realmente negociado, use **Registrar Preço Final** para capturar o total acordado — mantido separado da cotação original por prato, para que o desconto negociado esteja sempre visível em vez de ser sobrescrito silenciosamente. **Gerar Fatura** no evento fatura pelo preço final negociado se um foi registrado, ou pela cotação original caso contrário, como uma única linha de Serviço de Buffet, e registra o sinal já cobrado como um pagamento real contra ela.

## Relatórios

Junto com os relatórios padrão de Vendas, Estoque e Financeiro, Padaria recebe:

- **Validade / Perdas** — estoque baixado por vencimento (use o motivo **Vencimento** ao ajustar estoque de produtos vencidos), por produto e valor — o mesmo relatório que a Mercearia usa para perecíveis.
- **Margem por Receita** — os relatórios de Custo de Alimentos e Margem de Contribuição por Prato (do rastreamento de ingredientes do Restaurante) funcionam aqui sem alterações, já que as deduções de ingredientes de uma padaria são registradas exatamente da mesma forma.
- **Folha de Produção por Encomenda Antecipada** — escolha uma data, e veja cada pedido personalizado que vence naquele dia mais a demanda típica de clientes de passagem para aquele dia da semana, consolidados no que assar e exatamente quanto de cada ingrediente você vai precisar.

## Idioma

Padaria não é um dos modelos de negócio de serviços do Sarang — é um tipo de negócio por categoria de produto, então **não** é bloqueada por idioma. A interface principal, incluindo a tela de Pedidos Personalizados, está disponível nos 13 idiomas suportados.
