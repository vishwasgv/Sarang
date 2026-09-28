# Guia: Comprar de fornecedores, do pedido ao pagamento

O ciclo completo de compra, com o efeito de cada etapa no seu estoque e no seu dinheiro. Leia primeiro a tabela: ela evita a confusão mais comum.

```
Pedido de compra  ->  Receber estoque / GRN  ->  Fatura do fornecedor  ->  Pagamento ao fornecedor  ->  (Nota de débito)
 o que você pediu      a mercadoria chega       o que você deve          o que você pagou             mercadoria devolvida
 sem estoque, sem dinheiro  O ESTOQUE sobe      A DÍVIDA sobe            a dívida diminui
```

| Etapa | Muda seu estoque? | Muda o que você deve? |
|---|---|---|
| Pedido de compra | Não | Não |
| Receber estoque (no PC) ou GRN vinculado | **Sim** | Sim (ao receber) |
| Fatura do fornecedor | **Não** | **Sim** |
| Pagamento ao fornecedor | Não | Sim (diminui) |
| Nota de débito | Só se a mercadoria voltar | Sim (diminui) |

**Uma Fatura do fornecedor nunca muda o estoque.** Ela só registra o dinheiro. O estoque sobe apenas quando você recebe a mercadoria.

## 1. Adicione o fornecedor (uma vez)

**Compras → Fornecedores → Add Supplier.** Informe nome, telefone, endereço, GSTIN e PAN se tiver, dados bancários para pagá-lo e um **saldo inicial** se você já deve dinheiro a ele.

O Sarang impede que você crie o mesmo fornecedor duas vezes. Ele não salva um fornecedor se já existir (ativo ou arquivado) algum com:

- o mesmo **número de telefone**,
- o mesmo **GSTIN**,
- o mesmo **e-mail**,
- o mesmo **nome na mesma cidade** (se deixar a cidade em branco, qualquer nome igual conta).

Se a coincidência for um fornecedor arquivado, o Sarang pede que você o restaure em vez de criar outro. GSTIN, PAN e IFSC têm o formato verificado (por exemplo, um GSTIN tem 15 caracteres como *29ABCDE1234F1Z5*) e são guardados em maiúsculas. Se dois fornecedores diferentes têm o mesmo nome, adicione a cidade de cada um para distingui-los. **Find duplicates** na tela Fornecedores lista registros que parecem o mesmo fornecedor e permite **mesclá-los** (a mesclagem move todas as faturas e pagamentos para o registro que você mantém e não pode ser desfeita).

Também úteis no fornecedor: uma **pessoa de contato**, uma **categoria** e uma **avaliação** para seu uso, **condições de pagamento** em dias (uma nova fatura então recebe o vencimento automaticamente) e um **limite de crédito** (um lembrete de quanto você aceita dever; ele é exibido, não bloqueia uma fatura). Um **saldo inicial** pode ser negativo quando você pagou o fornecedor adiantado. Como os clientes, um fornecedor pode ter **outros endereços** na sua página.

## 2. Confirme que o produto existe

Todo item comprado para revenda deve ser antes um **Produto** (**Estoque → Produtos**), com **preço de custo** e **alíquota de imposto**. Se for um item novo, crie-o agora. Você também pode criá-lo na tela de mercadoria recebida (etapa 4). O imposto de uma compra nunca entra no custo do seu estoque: o custo do estoque é sempre o preço sem imposto.

Comprando algo que não é estoque para revenda (aluguel, reparos, honorários, equipamento)? Pule os produtos: registre como linha de **Serviço** numa Fatura do fornecedor ou como **Despesa**.

## 3. Pedir: Pedido de compra (opcional, mas recomendado)

**Compras → Pedidos de compra → New PO.** Escolha o fornecedor (ou **+ Add New Supplier**), adicione itens com quantidade e custo, e uma data prevista. Ao escolher um produto, o preço de custo **e a alíquota de imposto** são preenchidos; você pode alterar qualquer um.

O PC passa de **Draft → Approved → Received**. Se houver regra de aprovação, ele vai primeiro a um aprovador. Você pode imprimir o PC ou enviá-lo ao fornecedor por WhatsApp ou Email. Estoque baixo? Na tela **Estoque**, **Generate Reorder POs** cria pedidos de compra em rascunho para tudo abaixo do nível de reposição, usando o fornecedor padrão de cada produto.

## 4. A mercadoria chega: receba

Duas formas. Use a que combina com o seu negócio.

**A. Receive Stock no Pedido de compra** (a mais simples). Abra o PC aprovado e clique em **Receive Stock**. O estoque sobe, o custo médio é atualizado e seus livros registram a compra.

**B. GRN (Goods Received Note, nota de recebimento)** (quando uma entrega chega em partes, ou você quer registrar quantidade danificada ou rejeitada). **Compras → GRN → New GRN**: escolha o fornecedor, vincule o PC se quiser e informe cada item com as quantidades recebida e rejeitada e o custo.

**Importante num GRN: vincule cada linha a um produto.** Cada linha tem uma lista de produtos.

- Escolhido na lista: a linha soma ao estoque desse produto quando o GRN é **Posted**.
- Deixado como **Not in catalog**: a linha é só um registro em papel. Mostra uma pequena etiqueta *unlinked* e **não** altera Estoque nem Produtos.
- Item ainda não está na lista? Digite o nome e clique em **+ Create product "…" and link**. O Sarang cria o produto pelo seu preço de custo e vincula a linha. Defina o **preço de venda** real em Produtos antes de vendê-lo.
- Ao clicar em **Post** num GRN com linhas não vinculadas, o Sarang avisa quantas não atualizarão o estoque. Cancele e vincule-as, ou lance mesmo assim.
- Um GRN lançado não pode ser alterado. Se uma linha foi lançada sem vínculo por engano, faça **Reverse** no GRN e registre-o de novo com o produto vinculado.

Um GRN é salvo como Draft, depois Verified e por fim **Posted** (o estoque só muda em Posted).

**Uma linha foi lançada sem vínculo e você não consegue reverter o GRN?** No GRN lançado, uma linha sem vínculo tem **Link to an item**. Escolha o produto e a quantidade é somada ao estoque. Isso vincula apenas o recebimento; não altera a quantidade recebida do pedido de compra nem dados de lote, então confira você mesmo.

**Qual das duas devo usar?** As telas de Pedido de compra e GRN mostram uma dica curta dizendo de qual forma você está recebendo. Use uma forma por entrega, nunca as duas: receber no PC e depois lançar um GRN da mesma mercadoria soma o estoque duas vezes.

## 5. Registre o que o fornecedor cobrou: Fatura do fornecedor

**Compras → Faturas de fornecedores → Record Bill.**

1. Escolha o fornecedor (ou adicione um).
2. Defina a **data da fatura** e o **vencimento**. O vencimento alimenta a lista de Vencidas. Se o fornecedor tem condições de pagamento, o vencimento é preenchido. Digite o **número e a data da fatura do próprio fornecedor** como impressos na fatura em papel: o Sarang avisa quando o mesmo número de fatura do fornecedor é informado duas vezes, e empresas com GST precisam dele para conferir as compras com o portal do governo.
3. Adicione linhas. Uma linha é um **Produto** (custo e imposto vêm do produto) ou um **Serviço** (texto livre, com categoria, para o que não é estoque).
4. Informe o **desconto** e a **alíquota de imposto** por linha para que os totais batam com a fatura em papel do fornecedor. Confira o total com o papel.
5. Marque **Reverse Charge** somente se seu contador disser que o imposto desta compra é pago por você e não pelo fornecedor.
6. Opcionalmente adicione **custos de importação (landed costs)** (frete, tarifas, manuseio); eles são rateados entre os itens e elevam o custo real.
7. **Salvar.** A fatura recebe um número (por exemplo BILL-00012) e o status **Open**. O que você deve a esse fornecedor sobe. Para empresa com GST, o imposto da fatura é registrado como **crédito de imposto de entrada** (a menos que esteja no regime Composition), e uma nota de débito o reduz de novo.

**Errou?** Enquanto a fatura estiver **Open** e **sem pagamento** registrado, abra-a e clique em **Edit bill**. Altere o que precisa e salve. O Sarang substitui a fatura com o mesmo número, estorna os lançamentos antigos e lança os corrigidos num só passo, e guarda a cópia antiga como *BILL-00012-R1 (Void)* para o histórico ficar completo. Se houver pagamento, estorne o pagamento primeiro. Para cancelar uma fatura por completo, use **Void** (motivo obrigatório).

**Status da fatura:** Open, Partially Paid, Paid, Void. A lista também tem um filtro **Overdue** e um selo **OVERDUE** em toda fatura aberta ou parcialmente paga cujo vencimento passou.

## 6. Pague o fornecedor: Pagamento ao fornecedor

Abra a fatura e clique em **Record Payment**: valor (parcial ou total), método (Cash, UPI, Card, Bank Transfer, Cheque), referência. A fatura passa a **Partially Paid** ou **Paid** e seu saldo a pagar diminui. **Compras → Pagamentos a fornecedores** lista todos os pagamentos feitos e permite estornar um errado. Pagando várias faturas de um fornecedor de uma vez? Use a opção de pagamento em lote.

Se você retém **TDS** ao pagar um profissional ou prestador, o Sarang sugere um valor para a seção escolhida. Trate como sugestão apenas: confirme a seção e a alíquota com seu contador, porque as regras mudaram em 2026. **Reports → TDS Deducted** lista o que você reteve, por seção, e quanto ainda falta depositar. No formulário de pagamento, **Ctrl + Enter** salva.

## 7. Devolver mercadoria ou corrigir uma fatura: Nota de débito

**Compras → Notas de débito → New.** Vincule ao fornecedor (e ao PC ou fatura). Ela reduz o que você deve. Marque **Itemize** para listar os itens devolvidos com imposto. Uma nota de débito é sua devolução de compra: é a gêmea, do lado do fornecedor, de uma Devolução de venda e de uma Nota de crédito.

## 8. Veja como você está

- **Compras → Visão geral de compras**: o que você deve, o que vence nos próximos 7 dias, faturas abertas e uma lista das faturas a pagar esta semana.
- **Fornecedores**: a página de cada fornecedor mostra o saldo a pagar e cada fatura e pagamento; o botão **Statement** abre a conta para imprimir ou enviar.
- **Reports → Purchase Register, Purchases by Vendor, Purchases by Item, AP Aging Summary**: o que você comprou e o que deve, por tempo de atraso.
- **Reports → Payables / Supplier Ledger**: a conta completa de um fornecedor.
- **Reports → Purchase GST Register, Purchase HSN Summary, GST Net Payable & Input Credit** (empresas com GST): compras com imposto, compras por código HSN e o imposto que você pode abater do que cobrou. Veja *Guide: Tax and GST*.
- Ask Sarang: "A quem devo dinheiro?", "Quais faturas de fornecedores estão vencidas?", "Faturas que vencem esta semana".

## Um exemplo prático

Você compra 50 lâmpadas LED a 40 rupias, mais 18 por cento de imposto, com 30 dias de prazo, e paga em duas partes.

1. **Produtos**: crie *LED Bulb 9W*, custo 40, imposto 18.
2. **Pedido de compra**: fornecedor *Amba Agencies*, 50 unidades. Aprove.
3. **Receive Stock**: chegam 50 lâmpadas; o Estoque agora mostra 50.
4. **Fatura do fornecedor**: data de hoje, vencimento em 30 dias; a linha preenche 50 x 40 com 18 por cento de imposto; total 2,360. Status Open, você deve 2,360.
5. **Pagamento ao fornecedor**: 1,000 por UPI (Partially Paid, deve 1,360), depois 1,360 por transferência bancária (Paid).
6. Dez lâmpadas vieram com defeito: **Nota de débito** de 10 x 40 mais imposto, e você as devolve.
