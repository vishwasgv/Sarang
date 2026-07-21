# Faturamento e Documentos

## Criando uma nota fiscal

Abra **Faturamento** na barra lateral (`/billing`) para acessar a tela de ponto de venda. É aqui que toda nota fiscal começa:

1. **Busque produtos** na caixa à esquerda — por nome, SKU ou código de barras. Selecionar um resultado (ou escanear um código de barras) o adiciona ao carrinho. Se o produto tiver variações (tamanho/cor) ou números de série rastreados (IMEI), um seletor é exibido para você escolher exatamente qual unidade antes de ela ser adicionada.
2. **Ajuste a quantidade e o desconto** em cada linha do carrinho. A quantidade é ajustada em unidades inteiras, ou de 0,1 em 0,1 para um item precificado por peso. O desconto pode ser informado como um valor em moeda ou como uma porcentagem — o pequeno botão de alternância ao lado do campo de desconto alterna entre os dois modos.
3. **Escolha o cliente**, no lado direito. Digite um nome ou número de telefone para buscar clientes já cadastrados; se for novo, clique em **+ Add Customer** para adicionar rapidamente apenas um nome e telefone sem sair da nota. Deixar o campo de cliente vazio fatura para um cliente avulso.
4. **Escolha uma forma de pagamento**: Dinheiro, UPI, Cartão, Wallet, Crédito (Pagar Depois) ou Dividido. **Crédito** exige que um cliente esteja selecionado — a nota é criada como PENDENTE e o valor é adicionado ao razão daquele cliente. **Dividido** permite informar valores separados em Dinheiro e UPI que devem somar o total da nota.
5. **Aplique um desconto global** (além de qualquer desconto por linha), se necessário, usando a caixa de desconto no painel de resumo.
6. Se o seu modelo de imposto for GST, marque **Inter-State Sale (IGST)** quando a venda cruzar limites de estado — isso muda as linhas de imposto impressas de CGST+SGST para uma única linha de IGST.
7. Clique em **Confirmar Venda** (ou pressione **F10** / **Ctrl+Enter**) para criar a nota. Você é levado diretamente à tela de detalhes da nova nota.

O carrinho mostra um subtotal, desconto, imposto, ajuste de arredondamento e total em tempo real, conforme você o monta. **Limpar Tudo**, na parte inferior, zera tudo sem salvar.

Uma grade de blocos com seus **produtos mais vendidos** aparece acima da caixa de busca — um toque adiciona o item direto ao carrinho, sem precisar digitar, ordenados pelo que realmente mais vende.

No meio de uma venda, precisa atender outro cliente sem perder o carrinho atual? Clique em **Reter Venda** para colocá-lo em espera e começar do zero; **Retomar Venda** traz de volta seus carrinhos retidos para continuar exatamente de onde parou. O **MRP** de um produto, quando definido acima do seu preço de venda, aparece como um preço de referência riscado ao lado do preço real nos resultados de busca.

## Histórico e detalhes das notas

A **lista de notas** (`/billing`, na visualização de lista) mostra todas as notas com cliente, quantidade de itens, total, saldo pendente e status de pagamento (PENDENTE / PARCIAL / PAGA / CANCELADA). Busque por número da nota ou cliente, filtre por período ou por status Ativa/Cancelada.

Ao abrir uma nota, você vê seus itens completos, o detalhamento de impostos e o histórico de pagamentos. A partir daqui você pode:

- **Registrar Pagamento** — informe um valor (total ou parcial), escolha uma forma (Dinheiro, UPI, Cartão ou Wallet — Crédito não é oferecido aqui, já que registrar um pagamento significa que dinheiro de verdade foi recebido), e um número de referência e observações opcionais. Registrar um pagamento atualiza o saldo e o status de pagamento imediatamente; registrar menos do que o saldo total deixa a nota como PARCIAL.
- **Reverse Payment** — se um pagamento foi registrado por engano, reverta-o informando um motivo. O pagamento revertido continua visível (com um traço sobre ele) para fins de auditoria.
- **Imprimir Nota** ou **Imprimir Recibo** — visualize o layout da nota em A4 ou do recibo térmico antes de enviar para a impressora.
- **Cancel Invoice** — exige um motivo e não pode ser desfeita.
- **Send to Kitchen** — só aparece para negócios do tipo Restaurante com KOT ativado, e apenas antes de já existir um KOT para aquela nota.

O **Histórico de Pagamentos** é uma tela separada que lista todo pagamento já registrado, em todas as notas — pesquisável por nota, cliente ou número de referência, e filtrável por forma de pagamento ou período. Reverter um pagamento também pode ser feito a partir daqui.

## Orçamentos

**Orçamentos** (`/billing/quotations`) são estimativas de preço sem compromisso que você pode entregar a um cliente antes que ele se decida. Crie um com **Novo Orçamento**: escolha ou digite o nome do cliente, adicione os itens (buscados da mesma forma que no Faturamento), uma data de validade opcional e observações.

Um orçamento começa como **RASCUNHO** e pode ser marcado como **ENVIADO**, **ACEITO** ou **EXPIRADO**. Assim que o cliente concordar, clique em **Converter em Fatura** — isso cria uma nota real a partir dos itens do orçamento e marca o orçamento como Aceito. Um orçamento já convertido mostra um link para a nota resultante em vez do botão de conversão. Orçamentos podem ser impressos em A4 ou na largura de recibo, e excluídos enquanto não tiverem sido convertidos.

## Notas de Crédito e Notas de Débito

**Notas de Crédito** (`/billing/credit-notes`) registram dinheiro devido *de volta* a um cliente — normalmente por uma devolução, uma cobrança a mais ou um ajuste de cortesia. Crie uma informando um motivo e um valor, vinculando-a opcionalmente a um cliente e/ou à nota original. Vinculá-la a um cliente credita automaticamente o razão dele, reduzindo o que ele deve a você.

**Notas de Débito** (`/billing/debit-notes`) são o equivalente do lado do fornecedor — dinheiro que um fornecedor deve devolver a você, por exemplo uma devolução de estoque comprado ou uma correção de cobrança. Vincular uma nota de débito a um fornecedor debita o razão dele, reduzindo o que você deve a ele. Tanto as notas de crédito quanto as de débito podem opcionalmente referenciar a nota fiscal ou o pedido de compra relacionado, podem ser editadas ou excluídas, e são impressas em A4 ou na largura de recibo.

## Observações sobre impostos e arredondamento

Todo total de nota fiscal é arredondado para a unidade inteira mais próxima da moeda, com a diferença de arredondamento mostrada em sua própria linha para que a conta sempre feche de forma visível. No modelo de imposto GST, o imposto é impresso como CGST+SGST para uma venda dentro do mesmo estado, ou como uma única linha de IGST para uma venda interestadual, com base na caixa de seleção marcada no momento em que a nota foi criada.
