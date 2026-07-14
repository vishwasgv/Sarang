# Código de Barras e Faturamento por Peso/a Granel

A geração de código de barras, a impressão de etiquetas de código de barras e o faturamento por peso/a granel são recursos opcionais para negócios que vendem produtos (varejo, farmácia, lojas de conveniência e similares). Os três vêm desativados por padrão para todo tipo de negócio — nada muda em como você fatura até que você os ative.

## Ativando

Vá em **Configurações → Barcode & Loose Billing** e ative os recursos que precisar, de forma independente entre si:

- **Barcode Generation & Scanning** — gera códigos de barras automaticamente para produtos e permite escanear códigos de barras no caixa e na consulta de estoque.
- **Barcode Label Printing** — permite imprimir etiquetas de código de barras + preço, em uma impressora térmica de etiquetas ou em uma impressora comum A4/carta.
- **Loose / Weight-Based Billing** — permite vender um produto por peso (por exemplo, por kg) em vez de, ou junto com, um preço fixo por pacote.

Desativar qualquer um desses recursos depois não afeta os códigos de barras existentes nem os produtos já configurados para venda a granel.

## Configurando um produto para venda por peso

No formulário de edição do produto (**Produtos**), marque **Sell by Weight**, depois escolha uma unidade (kg, g, L ou mL) e defina o **Preço por Unidade** (por exemplo, R$ 80 por kg). Um produto ou é vendido em pacotes fixos pelo seu preço de venda normal, ou é vendido a granel por peso, a este preço por unidade — nunca os dois ao mesmo tempo.

## Gerando códigos de barras

Com a geração de código de barras ativada, editar um produto existente sem código de barras mostra um botão **Generate** ao lado do campo Código de Barras — clique nele para atribuir um imediatamente. Produtos novos recebem um código de barras automaticamente ao salvar, caso você não tenha digitado um você mesmo. Os códigos de barras gerados internamente são códigos EAN-13 padrão de 13 dígitos, que qualquer leitor comum consegue ler, usando uma faixa de numeração reservada que códigos de fabricantes reais nunca usam, para que nunca possam colidir com um código de produto escaneado.

Se você ativou a geração de código de barras depois de já ter produtos no sistema, vá em **Configurações → Barcode & Loose Billing → Generate Missing Barcodes** para atribuir um código de barras a todo produto que ainda não tenha um, em um único clique — seguro de executar mais de uma vez, já que nunca altera um produto que já tem um código de barras.

## Imprimindo etiquetas

Abra **Print Labels** (acessível assim que a impressão de etiquetas de código de barras estiver ativada). Busque ou escaneie um produto para adicioná-lo ao lote de etiquetas, defina quantas cópias de cada etiqueta você precisa (até 500 por linha), escolha **A4 / Letter Sheet** ou **Thermal Label Printer** como saída, depois **Preview** ou **Print** diretamente. Se algum produto do lote ainda não tiver código de barras, o Sarang informa quais são e interrompe — gere um código de barras para eles primeiro (na tela de Produtos ou no preenchimento em massa acima).

O tamanho físico da etiqueta térmica (largura e altura em milímetros) é configurado uma vez em **Configurações → Barcode & Loose Billing → Thermal Label Size**, para corresponder aos adesivos da sua impressora; isso não afeta a impressão em folha A4.

## Pesando e imprimindo um item a granel

Na mesma tela **Print Labels**, em **Weigh & Print a Loose Item**: busque um produto vendido a granel, pese-o em qualquer balança, digite o peso em gramas e clique em **Print Label**. O Sarang calcula o preço para aquele peso exato e imprime uma etiqueta única com um código de barras especial que codifica tanto o produto quanto a quantidade pesada. Escanear essa etiqueta no caixa a adiciona à conta em uma única leitura, já com o preço correto — sem necessidade de digitar o peso manualmente no balcão.

Se você reimprimir uma etiqueta do mesmo produto com exatamente o mesmo peso depois que o preço mudou, o Sarang avisa na tela para que você localize e remova o adesivo antigo — uma etiqueta física antiga escaneada depois cobraria o preço desatualizado, sem forma de diferenciá-la de uma nova.

## Vendendo itens a granel no balcão

No **Faturamento**, você pode escanear uma etiqueta de peso impressa (adicionada ao carrinho instantaneamente com seu preço e peso impressos) ou buscar um produto vendido a granel pelo nome e adicioná-lo manualmente — ele é adicionado com uma quantidade inicial de 1 na sua unidade configurada, que você então ajusta para o peso realmente pesado antes de finalizar. Se o preço impresso em uma etiqueta escaneada não corresponder mais ao preço atual do produto, o Sarang ainda assim cobra o que está impresso na etiqueta (já que é isso que o cliente vê), mas mostra um aviso para que você saiba que precisa reimprimir as etiquetas restantes com o novo preço.

Escanear a mesma etiqueta física duas vezes na mesma conta é sinalizado com um aviso (caso tenha sido uma leitura duplicada acidental), embora ainda assim seja adicionada — vender genuinamente dois pacotes pesados de forma idêntica do mesmo item é um cenário real que o sistema permite.
