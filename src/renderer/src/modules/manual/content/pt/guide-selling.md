# Guia: vender, do orçamento ao dinheiro

Tudo o que faz quando um cliente compra, pela ordem em que acontece. Salte os passos de que não precisa: uma loja que fatura ao balcão só precisa do passo 4.

```
Orçamento  ->  Pedido de Venda  ->  Fatura (Faturamento)  ->  Pagamento  ->  (Devolução / Nota de Crédito)
 opcional        opcional            sempre                    quando pago     só se algo voltar
```

## 1. Adicionar o cliente (uma vez)

**Sales → Clientes → Add Customer.** Escreva nome e telefone. Acrescente morada, e-mail e número fiscal (GSTIN) se fatura a empresas. Escolha **Individual** ou **Business**; uma empresa também pede número de registo comercial e uma pessoa de contacto.

- **Pesquise antes de adicionar.** Escreva primeiro o número de telefone. O Sarang bloqueia um segundo cliente com o mesmo telefone, para que uma pessoa nunca vire dois registos. Também verifica o GSTIN e o e-mail, e o botão **Find duplicates** no ecrã Clientes lista os registos que parecem a mesma pessoa para que os possa **fundir**. Uma fusão move todas as faturas e pagamentos para o registo que mantém e não pode ser desfeita.
- **Limite de crédito**: defina-o para clientes que compram a crédito. O Sarang não deixa uma venda fazê-los passar do limite.
- **Condições de pagamento**: escreva o número de dias que este cliente costuma ter para pagar (por exemplo 30). Cada fatura nova para ele recebe então a data de vencimento automaticamente.
- **Outras moradas**: na página do cliente, **Other addresses** guarda uma morada de entrega, armazém ou filial junto da principal.
- **Isento de imposto**: marque para um cliente a quem não deve cobrar imposto. Pode registar o número do certificado de isenção e a data até à qual é válido. Depois dessa data o Sarang volta a cobrar imposto, e o formulário do cliente avisa que o certificado expirou.
- **Não enviar mensagens a este cliente**: marque se ele pediu para não receber lembretes ou ofertas. Os lembretes em espera para ele são removidos e não são oferecidos novos para envio.
- **Extrato**: o botão **Statement** na página do cliente abre a conta dele (cada fatura, pagamento e nota de crédito com saldo corrente), pronta para imprimir ou enviar.
- **Arquive, não elimine**, um cliente que já não serve. O histórico fica.

Também pode adicionar um cliente no momento, enquanto fatura (**+ Add Customer**, só nome e telefone).

## 2. Dar um preço: Orçamento (opcional)

**Sales → Orçamentos → New Quotation.** Escolha o cliente (ou escreva um nome), adicione artigos e defina **Valid until** (o último dia em que o preço se mantém). Guarde-o como Rascunho, imprima-o ou partilhe-o por WhatsApp e marque-o **Sent**.

- Quando o cliente concordar, abra-o e clique em **Convert to Invoice** (ou **Convert to Sales Order** para um cliente que se comprometeu mas ainda não é faturado). O orçamento passa a **Accepted**.
- **Os orçamentos expiram sozinhos.** No dia a seguir a *Valid until*, um orçamento em Rascunho ou Enviado passa a **Expired**. Um orçamento expirado não pode ser convertido. Se decidir honrá-lo, volte a pôr o estado em **Sent**; o Sarang limpa a expiração antiga para que não caduque de novo na mesma hora. Use o filtro **Expired** para ver quem não respondeu.
- **Fatura pró-forma**: escolha *Proforma invoice* como tipo de documento quando precisar de pedir pagamento adiantado. É numerada PF-, imprime como "PROFORMA INVOICE, Not a tax invoice" e converte-se numa fatura real como um orçamento.
- O imposto de cada linha vem do produto; pode alterá-lo na linha.

## 3. Confirmar um pedido: Pedido de Venda (opcional)

**Sales → Pedidos de Venda → New Sales Order.** Use-o quando o cliente disse que sim mas ainda não pode faturar (mercadoria não pronta, à espera de um sinal).

1. **New Sales Order**: cliente, data prevista, artigos. Cada artigo assume o preço e a taxa de imposto do produto.
2. **Confirm Order** para o bloquear. (Se houver uma regra de aprovação, espera primeiro pela aprovação.)
3. **Create Invoice** quando estiver pronto. Pode faturar uma parte agora e o resto depois; o pedido acompanha quanto já está faturado (*Partially Invoiced* e depois *Invoiced*).

Um Pedido de Venda aberto **promete** estoque: **Estoque** e o relatório Stock Summary mostram quanto está prometido em pedidos, e o Sarang avisa-o quando confirma um pedido por mais do que tem livre. É só um aviso: nada o impede de vender estoque prometido, por isso confira antes de prometer as últimas unidades. O pedido não toca nos seus livros até faturar.

## 4. Vender: o ecrã de Faturamento (o trabalho principal)

**Sales → Faturamento.** Este é o ecrã de venda.

1. **Adicione artigos.** Pesquise por nome, SKU ou código de barras, ou toque num mosaico de produto. Os produtos mais vendidos aparecem como mosaicos acima da caixa de pesquisa. Use **Browse Products** para percorrer categorias sem escrever.
2. **Defina quantidade e desconto** em cada linha. O botãozinho junto ao desconto alterna entre **percentagem**, **valor** e **preço negociado/final** (escreva o preço acordado e o Sarang calcula o desconto).
3. **Escolha o cliente** (ou deixe em branco para um cliente de passagem).
4. **Escolha como paga**: Dinheiro, UPI, Cartão, Carteira, **Crédito (pagar depois)** (precisa de um cliente; a fatura fica por pagar e soma ao que ele deve) ou **Dividido** (por exemplo parte em dinheiro, parte em UPI).
5. **Imposto.** O imposto vem de cada produto. Se estiver em GST, **Tax shown as** escolhe CGST + SGST, IGST ou uma única linha GST; o Sarang escolhe a partir dos dois estados e pode mudar. O valor do imposto é o mesmo, seja como for mostrado. Veja *Guide: Tax and GST*.
6. **Extras na fatura.**
   - **Add Charge** acrescenta uma linha de gorjeta, transporte ou entrega, embalagem, manuseamento, instalação ou outro encargo. Indique o valor e, exceto para a gorjeta, a taxa de imposto que se aplica.
   - **Give free** (sob o nome de uma linha) transforma a linha toda numa amostra ou oferta: o estoque sai na mesma, o preço e o imposto passam a zero e a fatura mostra-o como grátis.
   - **Export sale?** aparece quando o cliente está noutro país. Marque para não cobrar imposto nesta venda (uma exportação a taxa zero). O Sarang nunca o faz sozinho, e as notas da fatura dizem "Export supply, zero-rated". Confira as regras de exportação do seu país e guarde a prova de exportação.
7. Confira os totais. O total é arredondado pela regra escolhida em **Configurações → Currency & Locale → Invoice rounding** (nenhum, 0,05, 0,10, 0,50 ou 1 mais próximo). O arredondamento aparece como linha própria.
8. **Confirm Sale** (ou prima **F10** ou **Ctrl + Enter**). A fatura abre.

**A atender dois clientes ao mesmo tempo?** **Hold Sale** estaciona o carrinho; **Resume Sale** traz de volta.

**Preço ou artigo errado?** Corrija antes de confirmar. Depois de confirmar, uma fatura não pode ser editada; cancele-a (com um motivo) e faça outra, ou use uma Nota de Crédito para uma correção parcial.

**A enviar mercadoria para um cliente na Índia?** Numa venda com GST de 50.000 ou mais, o Sarang lembra-o da e-way bill e deixa guardar o número na fatura. Outros dados da guia de remessa (transportador, número LR) estão em **Create Delivery Note**.

## 5. Dar ao cliente a sua cópia

No ecrã da fatura:

- **Print** (A4) ou **Print Receipt** (rolo térmico).
- **Share on WhatsApp** ou **Email**: o Sarang abre o WhatsApp ou o seu e-mail com a mensagem pronta. Anexe o PDF guardado e prima Enviar você mesmo. Nada é enviado sem si.
- **Create Delivery Note** se estiver a enviar mercadoria.

## 6. Receber o dinheiro

- **Pago ao balcão**: escolheu o método no passo 4; a fatura já está Paga.
- **Pago depois**: abra a fatura (**Faturamento → lista de faturas**) e clique em **Record Payment**. Escreva o valor (parcial ou total), o método e uma referência. Um pagamento parcial deixa a fatura em **Partial**.
- **O cliente pagou menos porque reteve imposto sobre o rendimento (TDS)?** Na janela de pagamento escolha **TDS deducted** e escreva o imposto que ele reteve. Isto salda essa parte da fatura sem que chegue dinheiro, e o Sarang regista-o como imposto de que terá crédito. O relatório **TDS Receivable** lista-o para o cruzar com os certificados deles.
- **Pagamento registado por engano**: **Reverse** com um motivo. Continua no ecrã, riscado, para registo.
- **Ver todos os pagamentos recebidos**: **Payment History** (a partir dos ecrãs de Faturamento), com pesquisa por fatura, cliente ou referência.
- **Quem me deve?** **Clientes** mostra cada saldo; **Relatórios → Outstanding** classifica as dívidas por antiguidade (corrente, 1 a 30 dias, 31 a 60, etc.). O Ask Sarang também responde a "Quem me deve dinheiro?".

## 7. Quando volta mercadoria ou o preço estava errado

- **Venda devolvida no todo ou em parte**: **Sales → Sales Returns** (ative em **Configurações → Additional Business Features** se não o vir). O estoque volta à prateleira e o saldo do cliente ou o reembolso é ajustado.
- **Dinheiro a devolver sem devolução de estoque** (cobrança a mais, boa vontade): **Sales → Notas de Crédito → New**, ligada ao cliente e à fatura. Reduz o que o cliente lhe deve. Cada nota tem **Add tax to this note**: deixe ligado para devolver também o imposto, ou desligue para um valor simples.
- **Fatura feita por engano**: abra-a e **Cancel Invoice** (motivo obrigatório).

## 8. Clientes habituais e maus pagadores

- **Perfis Recorrentes** (grupo Accounting) criam a mesma fatura num calendário, para rendas, subscrições e avenças.
- **Listas de Preços** dão a um grupo de clientes os seus próprios preços; **Esquemas de Preços** gerem ofertas (leve 2 pague 1, 10 % de desconto numa categoria). O Sarang mostra a oferta no carrinho; você decide se a aplica.
- **Juros por atraso**: ative em **Configurações → Business Features → Interest on overdue balances** e defina uma taxa anual (simples ou composta mensal). Nada é cobrado sozinho: na página de um cliente vê os juros que cada fatura em atraso gerou e prime o botão para os cobrar.

## 9. Resumo de vendas e relatórios

**Sales → Sales Overview** mostra vendas e faturas de hoje, o que os clientes lhe devem e quanto está em atraso, orçamentos abertos e atalhos para cada ecrã de vendas. **Relatórios** tem vendas por cliente, artigo, categoria e vendedor (escolha o vendedor ao balcão), lucro por artigo e cliente, um registo de vendas, contas a receber e mais, cada um com um gráfico.

## Perguntas frequentes

**Posso vender sem estoque?** O Sarang bloqueia a venda de um produto em estoque quando não há suficiente no Estoque ("Insufficient stock"). Receba primeiro a compra, ou ajuste o estoque com um motivo. Se às vezes tiver de vender antes de a mercadoria estar lançada, consulte o seu contabilista e depois ative o estoque negativo em **Configurações → Business Features → Stock rules**.

**Onde vejo as vendas de hoje?** No **Painel**, ou em **Relatórios → Sales**.

**Por que o imposto aparece por cima do preço?** Por defeito o Sarang trata cada preço como *antes de impostos* e soma o imposto por cima. Se os seus preços já incluem imposto, ative **Prices include tax** (Configurações, ou o interruptor no documento). Veja *Guide: Tax and GST*.

**Por que não há imposto nesta fatura?** O artigo não tem taxa de imposto, o cliente está marcado como isento, a venda foi marcada como exportação, ou o seu negócio está no regime de Composição.
