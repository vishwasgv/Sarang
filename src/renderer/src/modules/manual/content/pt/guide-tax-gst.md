# Guia: Impostos e GST, como o Sarang calcula

O Sarang calcula o imposto da mesma forma em cada documento, e mostra-lhe os mesmos números no ecrã, no documento guardado, na impressão, no razão e nos relatórios. Este guia explica as regras, como configurá-las, e onde ver os totais. É um guia de trabalho para os seus próprios registos. A lei fiscal muda e depende da sua situação, por isso confirme as suas taxas e declarações com o seu contabilista.

## Duas formas de inserir preços

Cada preço no Sarang (preço de custo, preço de venda, custo unitário) é **antes de imposto** ou **com imposto incluído**, e cada documento indica qual.

- **Antes de imposto (o padrão para a Índia):** o Sarang acrescenta o imposto por cima.
- **Com imposto incluído:** o preço que digita já contém o imposto, como numa etiqueta de prateleira ou num MRP. O Sarang calcula o imposto ao contrário.

Escolha a forma como habitualmente define preços em **Settings → Currency & Locale → Prices include tax**. Essa torna-se a escolha inicial para cada novo documento. Em cada documento (fatura, orçamento, ordem de venda, ordem de compra, fatura de fornecedor, nota de crédito, nota de débito) existe um interruptor **Prices include tax**, e a coluna de preço tem a etiqueta **(excl. tax)** ou **(incl. tax)**, por isso nunca é ambíguo. Mudar o interruptor converte os preços que introduziu para que o cliente pague o mesmo. No ecrã de Faturação o interruptor fica bloqueado enquanto o carrinho tem artigos, assim uma fatura nunca mistura as duas formas.

### A aritmética

Antes de imposto:

```
valor da linha    = quantidade x preço
valor tributável   = valor da linha - desconto
imposto             = valor tributável x taxa de imposto
total da linha      = valor tributável + imposto
```

Exemplo: 2 unidades a 500, desconto 100, imposto 18 por cento. Valor da linha 1.000. Valor tributável 900. Imposto 162. Total 1.062.

Com imposto incluído:

```
valor da linha    = quantidade x preço          (já contém o imposto)
após desconto       = valor da linha - desconto
valor tributável    = após desconto / (1 + taxa)
imposto             = após desconto - valor tributável
```

Exemplo: 1 unidade com preço 118 incluindo 18 por cento de imposto. Valor tributável 100. Imposto 18. Total 118.

Em ambas as formas o imposto é calculado sobre o valor **após o desconto**, um desconto ao nível do documento é repartido de forma justa pelas linhas, e a última linha fica com o resto para que as linhas somem sempre o total. O subtotal, o desconto, o imposto e o total são unidades inteiras da sua moeda (paise, cêntimos, fils) sem decimais perdidos.

### Arredondar o total

**Settings → Currency & Locale → Invoice rounding** escolhe como o total a pagar é arredondado: **None**, **nearest 0.05**, **0.10**, **0.50** ou **1**. Os negócios em rupia indiana começam em "nearest 1"; qualquer outra moeda começa em "None". O arredondamento aparece como a sua própria linha na fatura. Notas de crédito e débito nunca são arredondadas desta forma.

## Defina a taxa de imposto uma vez, no produto

**Inventory → Produtos →** esse produto **→ Tax Rate %**. Digite uma taxa ou clique numa das suas taxas guardadas. Esta preenche-se depois automaticamente em faturas, orçamentos, ordens de venda, ordens de compra, faturas de fornecedor e notas de débito ao escolher o produto. Ainda pode alterar a taxa numa única linha. Se uma taxa que digita não for uma das suas taxas guardadas, o Sarang mostra um aviso suave para apanhar um erro de digitação como 81 em vez de 18.

Escolha também a **Tax category** do produto: **Standard**, **Reduced**, **Zero-rated**, **Exempt**, **Nil-rated** ou **Out of scope**. A categoria é memorizada em cada linha de documento e determina o Tax Report e as linhas do GSTR-1 para fornecimentos nil-rated, exempt e non-GST. Uma linha que efetivamente cobra imposto nunca pode ser declarada como exempt ou nil-rated.

## Taxas de GST na Índia

As taxas de GST mudaram a 22 de setembro de 2025. As taxas em vigor são agora **5 por cento**, **18 por cento** e **40 por cento** (uma lista curta de bens de luxo e "pecaminosos"), mais **nil**, com taxas especiais de **3 por cento** (ouro, prata, joalharia) e **0,25 por cento** (diamantes em bruto). As taxas de 12 e 28 por cento foram retiradas. O Sarang oferece-as como taxas guardadas e mantém as suas antigas taxas de 12 e 28 por cento visíveis em **Older rates (before 22 Sep 2025)** em **Settings → Tax Configuration**, para que os registos antigos continuem a fazer sentido. Qual taxa se aplica a um artigo depende do seu código HSN: pergunte ao seu contabilista e defina-a no produto. Os documentos antigos mantêm a taxa com que foram feitos; alterar a taxa de um produto nunca altera documentos passados.

## Como o imposto é mostrado: CGST + SGST, IGST, ou GST

Para um negócio com GST, cada documento fiscal tem uma escolha **Tax shown as**:

| Escolha | Use quando | O que é impresso |
|---|---|---|
| **CGST + SGST** | O comprador está no mesmo estado | Duas linhas iguais (para 18 por cento, 9 mais 9) |
| **IGST** | O comprador está noutro estado | Uma linha IGST |
| **GST** | Quer uma única linha combinada | Uma linha chamada GST |

O Sarang escolhe por si comparando o estado do seu negócio com o do cliente (ou, nas compras, o do fornecedor), e pode alterá-lo no documento. Se o cliente não tiver um estado guardado mas tiver GSTIN, usam-se os dois primeiros dígitos do GSTIN (o código de estado). Se nenhum for conhecido, o Sarang usa CGST + SGST.

**O valor do imposto e o total são exatamente os mesmos nas três opções.** Apenas a forma como o mesmo valor é mostrado muda. Quando um valor não se divide de forma exata, as duas metades diferem no máximo um paisa e somam sempre de volta o imposto completo. Nos relatórios, um documento mostrado como uma única linha de GST é classificado como CGST + SGST ou IGST pelo seu local de fornecimento, e o relatório avisa quantos documentos não tinham estado.

## Notas de crédito e débito: adicionar imposto ou omiti-lo

Cada nota de crédito e débito tem **Add tax to this note**. Começa ligada quando a fatura, ordem de compra ou fatura associada tinha imposto, e desligada caso contrário; pode alterá-la.

- **Omitir imposto:** o total da nota é igual ao valor; não se imprimem linhas de imposto; o saldo do cliente ou fornecedor move-se apenas por esse valor.
- **Adicionar imposto:** uma nota feita a partir de artigos usa a taxa de imposto de cada linha; uma nota de valor simples pede uma taxa de imposto e trata o valor como antes de imposto ou com imposto incluído conforme a própria definição de preço da nota. O imposto é mostrado como CGST + SGST, IGST ou GST, como qualquer outro documento.

Se omitir o imposto numa nota associada a um documento que cobrou imposto, o Sarang avisa que o imposto cobrado anteriormente não será revertido; pode continuar mesmo assim. O Tax Report, GSTR-1 e GSTR-3B incluem o imposto de uma nota apenas quando foi adicionado.

## Casos especiais

| Situação | O que fazer |
|---|---|
| O cliente está isento de imposto | Marque o cliente como isento de imposto na sua página e introduza o número do certificado de isenção e a data até à qual é válido. As suas faturas não têm imposto enquanto o certificado for válido; após essa data o Sarang cobra imposto novamente e o formulário do cliente mostra um aviso |
| Venda a um cliente noutro país (exportação) | No ecrã de Faturação marque **Export sale?** (aparece quando o país do cliente é diferente do seu). A venda fica então zero-rated. O Sarang nunca faz isto por si só; verifique as regras de exportação e guarde prova da exportação |
| O seu negócio está sob o Composition Scheme | **Settings → Business Profile → GST Scheme → Composition Scheme.** As vendas são então emitidas como Bill of Supply sem imposto separado |
| Uma compra onde **você** paga o imposto (reverse charge) | Marque **Reverse Charge** na fatura de fornecedor ou despesa. O imposto é registado como a sua própria obrigação em vez de parte do que deve ao fornecedor |
| Cliente ou fornecedor no estrangeiro | Use a opção de moeda estrangeira no documento; os valores mantêm as próprias casas decimais da sua moeda |
| Uma amostra grátis ou artigo de promoção | Use **Give free** na linha, ou deixe um esquema de preços adicionar linhas como "compre 2 leve 1 grátis". O stock sai; preço e imposto são zero |
| Entrega, embalagem ou outras taxas | **Add Charge** no ecrã de Faturação, com a taxa de imposto aplicável a essa taxa |
| O cliente reteve imposto sobre o rendimento (TDS) ao pagar | Registe-o na janela de pagamento da fatura como **TDS deducted**. Não é dinheiro recebido; é imposto pelo qual reclamará crédito (**Reports → TDS Receivable**) |

## Onde ver os totais de imposto

- **Reports → Tax Report:** imposto cobrado nas vendas, por taxa e por categoria de imposto.
- **Reports → GSTR-1:** vendas para a declaração, business-to-business por fatura e taxa, business-to-consumer por taxa e estado, linhas nil-rated, exempt e non-GST, e linhas de notas de crédito e débito.
- **Reports → GSTR-3B Preview:** fornecimentos de saída (incluindo zero-rated) e compras com reverse-charge do mês. É uma pré-visualização para comparar com o que o portal mostra; a submissão é feita no portal do governo.
- **Reports → HSN Summary:** vendas por código HSN (as linhas de orçamento levam o código HSN até à fatura).
- **Reports → Purchase GST Register** e **Purchase HSN Summary:** o mesmo para compras (faturas, ordens de compra recebidas e notas de débito).
- **Reports → GST Net Payable & Input Credit:** o imposto que cobrou, o crédito de imposto de entrada das suas compras, e o que falta pagar ou transportar, por CGST, SGST e IGST.
- **Reports → GSTR-9 Annual Data:** um documento de trabalho dos números do ano para a sua declaração anual.
- **Reports → TDS Deducted:** imposto que reteve a fornecedores, por secção, e quanto falta depositar.
- **Reports → TDS Receivable:** imposto que os seus clientes retiveram.
- Em cada fatura impressa: as linhas de imposto para a apresentação escolhida e, se aplicável, a nota "Prices include tax".

## Imposto nas compras e crédito de imposto de entrada

Faturas de fornecedor, ordens de compra e notas de débito calculam o imposto da mesma forma. O custo do stock nunca inclui o imposto de compra: para uma fatura ou ordem de compra com preço que inclui imposto, o Sarang usa o custo antes de imposto para o valor de inventário e o custo médio.

Para um negócio com GST no regime regular, o imposto em cada fatura de fornecedor, ordem de compra recebida e nota de débito é registado como **input tax credit** na sua própria conta. **GST Net Payable & Input Credit** mostra o que cobrou, o crédito que tem, e a diferença. O crédito só é registado para documentos feitos a partir de agora; compras anteriores não são contadas, e o relatório indica isso. Também não decide a ordem em que o crédito é compensado contra cada rubrica: isso é decidido pelo seu contabilista.

**Accounting → GST Payments** (Índia) regista o pagamento que faz ao governo: reduz o que deve em imposto e o crédito que usou, e reduz o seu banco ou dinheiro. Verifique os valores com o seu contabilista antes de pagar.

**Accounting → GST Return Files** (Índia) prepara **GSTR-1** e **GSTR-3B** como ficheiros JSON que pode carregar você mesmo no portal do governo ou abrir na sua ferramenta offline: escolha o mês, prepare o ficheiro e guarde-o. Na própria página de uma fatura, os cartões **e-invoice** e **e-way bill** preparam o ficheiro de pedido para essa fatura, e depois de o carregar manualmente digita o IRN que é devolvido para que seja impresso com o seu código QR (**Reports → E-invoice IRN Register** lista-os). Tudo isto são rascunhos feitos a partir dos seus registos. O esquema destes ficheiros segue o formato offline do portal tal como o entendemos, por isso abra cada um na ferramenta do próprio governo e corrija o que assinalar antes de confiar nele. Nada é enviado ao governo a partir do Sarang.

**Conciliar as suas compras com o portal:** descarregue o seu GSTR-2B (ou 2A) em JSON do portal e escolha-o em **GST Return Files**. O Sarang concilia-o com as suas faturas de fornecedor por GSTIN do fornecedor, número de fatura e data, e lista o que corresponde, o que é diferente, o que falta nos seus registos e o que falta no portal. Digite o próprio número e data de fatura de cada fornecedor na fatura para que a conciliação funcione.

## Erros comuns

| Erro | Resultado | Correção |
|---|---|---|
| Introduzir um preço com imposto incluído num documento antes de imposto | O imposto é adicionado sobre um preço que já o tinha | Ative **Prices include tax** para esse documento, ou introduza o preço antes de imposto |
| Esquecer-se de definir a taxa de imposto num produto novo | Os documentos não mostram imposto | Defina-a no produto |
| Usar a taxa errada para um artigo | Imposto incorreto em cada venda | Confirme o HSN e a taxa com o seu contabilista e corrija o produto |
| Escolher IGST para uma venda dentro do mesmo estado | Uma linha IGST em vez de CGST e SGST | Altere **Tax shown as** no documento antes de guardar, ou cancele e reemita, ou use uma Nota de crédito |
| Omitir o imposto numa nota de crédito de uma fatura com imposto | O imposto que cobrou fica nos livros | Reative **Add tax to this note** |
