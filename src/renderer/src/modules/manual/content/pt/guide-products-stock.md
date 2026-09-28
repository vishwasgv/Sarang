# Guia: Produtos, categorias e stock

Como configurar o que vende, manter o stock correto, e descobrir porque é que um número é o que é.

## 1. Primeiro as categorias (2 minutos, poupa horas)

As categorias agrupam produtos para filtragem e relatórios (por exemplo *Lâmpadas*, *Interruptores*, *Fio*).

- **Inventory → Produtos → botão Categoria** abre **Manage Categories**: adicionar, renomear, adicionar uma subcategoria, ou arquivar.
- **Adição rápida ao criar um produto**: no formulário do produto, escolha **+ Create new category…**, digite o nome (e uma categoria principal se for uma subcategoria) e é criada e selecionada de imediato.

## 2. Adicionar um produto

**Inventory → Produtos → Add Product.**

| Campo | O que inserir |
|---|---|
| Nome do produto | Como você e os seus clientes lhe chamam |
| SKU / Código de barras | O seu próprio código, ou digitalize o código de barras do fabricante |
| Código HSN | O código de classificação de mercadorias dado pelo seu contabilista (serviços usam SAC) |
| Tipo de produto | **Standard** (o stock é contado) ou **Service** (sem stock, por exemplo mão de obra) |
| Unidade | PCS, KG, L, M, BOX, etc. |
| Preço de custo | O que paga por unidade, **antes de imposto** (o custo do stock nunca inclui o imposto de compra) |
| Preço de venda | O que cobra por unidade. Antes de imposto por defeito; com imposto incluído se ativar **Prices include tax** |
| PVP (MRP) | O preço máximo impresso, se existir (mostrado riscado ao lado do seu preço) |
| Taxa de imposto % | A taxa de GST deste produto. Digite-a, ou clique numa taxa em **Settings → Tax Configuration** |
| Nível / quantidade de reposição | O nível de stock que gera um alerta de stock baixo, e quanto costuma encomendar |
| Quantidade de abertura | O stock que já tem ao adicionar o produto |

**Os preços são antes de imposto salvo indicação em contrário.** Por defeito, o Sarang acrescenta o imposto ao vender ou comprar: um preço de venda de 100 com 18 por cento de imposto vende-se a 118. Se o seu preço de prateleira já inclui imposto, ative **Prices include tax** (em Settings, ou o interruptor em cada documento) e o Sarang calcula o imposto ao contrário, sem que tenha de dividir à mão. Veja *Guia: Impostos e GST*.

A taxa de imposto definida aqui preenche-se automaticamente em faturas, orçamentos, ordens de venda, ordens de compra, faturas de fornecedor e notas de débito ao escolher o produto. Ainda pode alterá-la numa única linha.

Variantes (tamanho e cor), venda por peso, lotes com validade, números de série ou IMEI, e kits (vários produtos vendidos como um) são ativados pelo seu tipo de negócio ou em **Settings → Additional Business Features**.

## 3. Fazer entrar stock

O stock sobe **apenas** quando um destes acontece:

1. **Receive Stock** numa Ordem de compra aprovada.
2. Um **GRN** com a linha ligada a um produto é **confirmado (Posted)**.
3. **Quantidade de abertura** ao criar o produto pela primeira vez.
4. Um **ajuste de stock** (abaixo).
5. Uma **Devolução de venda** que recebe mercadoria de volta, ou uma **produção** termina (fabricantes).

Uma **Fatura de fornecedor** sozinha nunca adiciona stock. Veja *Guia: Comprar a fornecedores*.

## 4. Fazer sair stock

O stock desce ao confirmar uma venda em Faturação (ou uma Ordem de venda é faturada), quando uma **Nota de débito** devolve mercadoria, quando é usado em produção, ou quando o ajusta para baixo.

O Sarang não o deixará vender mais do que tem. Se uma venda for bloqueada com *Insufficient stock*, receba primeiro a compra ou corrija a contagem de stock com um motivo. Se realmente precisar de vender antes de a mercadoria estar registada, ative o stock negativo em **Settings → Business Features → Stock rules**; a quantidade mostra-se então abaixo de zero até receber a mercadoria.

## 5. Verificar e corrigir o stock

- **Inventory** lista cada produto com a sua quantidade atual, nível de reposição, custo médio e valor de stock. O separador **Low Stock** mostra o que precisa de ser encomendado.
- **Ajustar stock**: clique no ícone de ajuste de uma linha e introduza a **nova quantidade** (não a diferença). Dê um motivo (dano, contagem, saldo de abertura). Ao aumentar o stock pode registar o custo das unidades adicionadas.
- **Movements** (botão em Inventory) é um histórico apenas de leitura de cada alteração: Stock Added, Sale, PO Received, Adjustment, Sale Return, e mais. Use-o para responder "porque é que este número é o que é?".
- **Contar stock**: **Inventory → Stock Counts → New count**. O Sarang tira uma fotografia do que pensa que tem de cada artigo; digita o que realmente contou, e mostra a diferença e o seu valor. Nada muda até premir **Post**, que transforma cada diferença num ajuste de stock (motivo: contagem de stock) na sua localização principal. Só pode haver uma contagem aberta de cada vez. Artigos com lotes, números de série ou validade são contados apenas pela quantidade total. Se a confirmação for interrompida, a contagem mantém-se aberta e as linhas já confirmadas permanecem confirmadas: prima Post outra vez para terminar o resto. **Reports → Stock Count Variances** mostra o que faltava ou sobrava.
- **Stock Locations**: mantenha stock separado para loja, armazém ou carrinha, e mova-o entre eles.
- **Bin Locations**: **Inventory → Bin Locations** regista em que prateleira, estante ou caixa (por exemplo A-3-2) está cada artigo dentro de uma localização, para que qualquer pessoa o encontre. É uma etiqueta digitada à mão: uma caixa por artigo por localização, e aparece apenas neste ecrã (ainda não em relatórios ou listas impressas).
- **Stock Journal**: **Inventory → Stock Journal** regista mercadoria que muda de forma, como partir uma caixa em pacotes: escolha o que sai e o que entra e guarde-os juntos. O valor que sai é repartido pelos artigos que entram, por quantidade. Não pode ser editado nem revertido depois de guardado: corrija um erro com um lançamento oposto.
- **Prometido em encomendas**: **Inventory** e o relatório Stock Summary mostram, ao lado de cada artigo, quanto está prometido em Ordens de venda abertas. É um lembrete, não um bloqueio: nada o impede de vender stock prometido.

## 6. Reabastecer antes de esgotar

- Defina um **Nível de reposição** em cada produto.
- Observe os mosaicos de stock baixo no **Dashboard** e os alertas do sino. Um alerta de stock baixo abre **Inventory** ao clicar.
- No ecrã **Inventory**, **Generate Reorder POs** cria ordens de compra em rascunho para tudo o que estiver abaixo do seu nível de reposição, usando o fornecedor predefinido de cada produto (defina primeiro um fornecedor predefinido no produto).

## 7. Quanto vale o meu stock?

**Inventory** mostra o valor de cada produto (quantidade x custo médio). **Reports → Stock Summary**, **Stock Ledger** (cada movimento com abertura e fecho), **Inventory Ageing** e os relatórios de stock por localização e transferência mostram valorização, movimento e há quanto tempo os artigos estão parados. A valorização segue o método que usa (médio, FIFO e outros onde ativado) e cada relatório indica que é à data de hoje. Custos de frete ou taxas alfandegárias introduzidos como **custo de desembarque (landed cost)** numa compra aumentam o custo desses artigos.

## Erros comuns

| Erro | O que acontece | Correção |
|---|---|---|
| Digitar um novo artigo num GRN sem o ligar | O stock não sobe | Use **+ Create product and link** na linha antes de confirmar |
| Introduzir um preço de venda com imposto incluído com Prices include tax desligado | Os clientes são cobrados o imposto duas vezes | Ative **Prices include tax**, ou introduza o preço antes de imposto |
| Taxa de imposto deixada em 0 | Falta o imposto nos documentos | Defina a taxa no produto |
| Ajustar o stock pela diferença | Quantidade errada | Introduza a quantidade **nova total** |
| Eliminar um produto com histórico | Não permitido | Arquive-o em vez disso |

**Imprimir etiquetas de prateleira e de envio.** **Inventory → Print Labels** imprime etiquetas de artigo; um envio tem **Print labels** e **Track**, que mostra a sua própria linha temporal de despachos, atrasos e entrega que você próprio atualiza (não há rastreio ao vivo da transportadora).
