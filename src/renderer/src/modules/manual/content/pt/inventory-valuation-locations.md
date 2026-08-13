# Avaliação de Estoque e Estoque Multi-Localização

## Método de Avaliação

Agora cada produto possui um **Método de Avaliação**, definido no formulário do produto: **Média Ponderada** (padrão — o custo que você vê é uma média corrente ao longo de cada compra), **FIFO** (Primeiro a Entrar, Primeiro a Sair — o custo reflete suas camadas de compra mais antigas ainda em estoque), ou **Custo Padrão** (um custo fixo que você mesmo define, que não muda com os preços de compra). Seja qual for o método usado por um produto, esse é o valor de custo que o Sarang usa em todos os lugares onde o custo importa para aquele produto — a margem no Painel, o relatório de Lucros e Perdas, o relatório de Custo de Alimentos, e as sugestões de rascunho de reposição, todos leem o mesmo custo resolvido, portanto nunca discordam entre si.

Alterar o método de avaliação de um produto não reescreve seu histórico de compras — apenas muda qual valor o Sarang lê daqui em diante.

## Localizações e Transferência de Estoque

**Localizações** (`/locations`) é para empresas que armazenam estoque em mais de um lugar — um armazém mais um balcão de varejo, ou duas filiais. Toda empresa começa com uma única localização padrão "Principal" à qual já pertence todo o estoque existente, portanto nada muda até que você realmente adicione uma segunda localização. Adicione uma com **Nova Localização** (nome e um endereço opcional); a primeira localização criada é sempre a padrão, e uma localização padrão não pode ser desativada, já que toda movimentação de estoque que não especifique uma localização concreta vai para ela.

Assim que existir uma segunda localização, uma ação **Transferir Estoque** aparece: escolha um produto, uma quantidade, uma localização de origem e destino, e um motivo opcional. Uma transferência apenas move o estoque entre localizações — nunca muda quanto você tem no total, portanto não cria uma nova movimentação de estoque do tipo "estoque adicionado" ou "estoque removido", apenas uma mudança de localização para localização.

## Custo de Desembarque

O **Custo de Desembarque** permite incorporar custos adicionais do lado da compra — frete, taxas alfandegárias, manuseio, ou qualquer outra coisa — ao custo real de um produto, em vez de deixá-los como uma despesa separada e não atribuída.

Em uma **Ordem de Compra**, adicione um custo de desembarque a partir de sua tela de detalhes: escolha um tipo (Frete, Imposto, Manuseio, ou Outro), um valor, e como distribuí-lo pelas linhas da ordem — **por valor da linha** (uma linha de maior valor na ordem absorve uma parcela maior do custo) ou **por quantidade** (distribuído igualmente por unidade, independentemente do preço). Você pode adicionar ou remover custos de desembarque livremente até que a Ordem de Compra seja recebida pela primeira vez; assim que o recebimento começa, eles ficam bloqueados, já que o histórico de custos ao qual alimentam nunca é reescrito depois. Em um **Fatura de Compra**, os custos de desembarque são inseridos em linha apenas no momento da criação, em uma seção opcional — uma Fatura de Compra publica seu histórico de custos imediatamente, sem uma etapa separada de "recebimento" para adicionar custos depois.

De qualquer forma, o custo de desembarque é incorporado ao custo por unidade registrado para aquela compra, que é exatamente o que seu método de avaliação (acima) lê em seguida.

## Itens Compostos (Kits)

Um **Kit** é um produto composto por outros produtos, vendido e armazenado como um único item, mas com preço e inventário determinados através de seus componentes reais. Transforme um produto em kit a partir de seu próprio formulário: marque **Este é um Kit** e escolha seus componentes (cada um deve ser um produto Padrão real, em estoque — serviços e outros kits não podem ser adicionados como componente, já que o estoque de um kit deve poder ser rastreado até algo que realmente está em uma prateleira).

Quando você vende um kit, a fatura ainda mostra uma única linha pelo preço próprio do kit — nada muda para o cliente ou o operador de caixa. Nos bastidores, o Sarang verifica se cada componente tem estoque suficiente antes de permitir a venda, depois deduz a quantidade real de cada componente, então suas contagens de estoque em nível de componente sempre permanecem precisas, mesmo que o que foi vendido tenha sido o kit.

## Ordem de Compra Automática por Nível de Reposição

O **Nível de Reposição** de cada produto já existe para disparar alertas de estoque baixo (veja o capítulo *Estoque*); esse mesmo limite agora também aciona a **geração de rascunhos de Ordem de Compra**. A partir da tela de Estoque, gerar rascunhos de reposição agrupa cada produto abaixo do limite pelo seu fornecedor habitual e cria uma Ordem de Compra em Rascunho por fornecedor, pré-preenchida com uma quantidade de reposição sugerida e o custo resolvido atual do produto — você ainda revisa e aprova cada uma antes que se torne real, nada é enviado automaticamente a um fornecedor.

## Conversão de Unidade Flutuante (GRN)

Algumas mercadorias compradas não se convertem para sua unidade de venda em uma proporção perfeitamente fixa — um "saco de arroz" pode pesar nominalmente 25 kg, mas o saco que você realmente recebe pode pesar 24,6 kg. Ative a **Conversão de Unidade Flutuante** em um produto (junto com sua configuração existente de venda por pacote/peso) para capturar isso no momento do recebimento: em um **GRN** (Nota de Recebimento de Mercadoria), um campo de **Qtd. da Unidade de Compra** aparece ao lado dessa linha — informe quantos sacos você recebeu, enquanto o campo existente **Recebido** permanece a quantidade real e medida efetivamente levada ao estoque. Os dois podem diferir; o Sarang deriva o fator de conversão real para aquele recebimento específico a partir dos dois números que você informou, em vez de assumir que cada saco pesava exatamente 25 kg.
