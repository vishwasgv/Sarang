# Fabricação

A Fabricação transforma o Sarang de um sistema de compra-e-venda em um sistema de fabricar-e-vender: você rastreia a entrada de matérias-primas, define o que um produto acabado realmente precisa para ser feito, executa ordens de produção que consomem materiais e produzem estoque, e depois despacha os produtos acabados para os clientes. A Fabricação também recebe o conjunto completo de módulos de Logística e Cadeia de Suprimentos (Frota, Transportadoras, GRN, Fretes) por padrão, já que receber remessas formais de fornecedores de matéria-prima é uma parte normal de administrar uma fábrica.

## 1. Matérias-Primas

**Matérias-Primas** é seu inventário de ingredientes/componentes, separado do seu estoque regular de produtos. Cada material tem um nome, uma unidade (kg, litro, peça, caixa e semelhantes), um ponto de reposição e um custo unitário. A lista sinaliza qualquer item abaixo do seu ponto de reposição e totaliza o valor atual do seu estoque.

O estoque só se movimenta através de **Ajustar Estoque**, que registra um dentre três tipos de movimento — Compra (entrada de estoque), Devolução (entrada de estoque) ou Ajustar Para (uma correção manual) — mais um quarto tipo, Consumido, que o sistema cria automaticamente sempre que uma ordem de produção é iniciada (veja abaixo). Todo movimento é registrado com um saldo corrente em **Histórico de Movimentos**, para que você possa ver exatamente por que o estoque de um material está no nível em que está.

## 2. Lista de Materiais (BOM)

Uma BOM (Lista de Materiais) define o que um produto acabado realmente precisa: escolha o produto, defina uma quantidade de saída por lote e liste o que ele consome — uma matéria-prima, ou **outro produto fabricado como subconjunto** (alterne o tipo da linha), com uma quantidade necessária e uma porcentagem opcional de desperdício. O desperdício infla a quantidade efetivamente consumida (por exemplo, 5% de desperdício sobre 10 kg necessários significa que 10,5 kg são realmente planejados para consumo). Ao montar um produto de múltiplos níveis — digamos, um Carro que precisa de um Motor, que por sua vez é fabricado a partir de Aço bruto — o Sarang verifica referências circulares (um componente que acabaria precisando de si mesmo) e bloqueia salvar uma delas. O Sarang totaliza o custo do material por lote a partir do custo unitário atual de cada ingrediente — essa é a base de custo que uma ordem de produção usará mais tarde.

Apenas uma BOM por produto é permitida; editar uma BOM existente permite alterar quantidades, desperdício e linhas de componentes, mas não para qual produto ela é.

Matérias-primas recebidas em lotes distintos (uma entrega hoje pode ter um custo diferente da do mês passado) podem ser rastreadas como **lotes de material** a partir de Matérias-Primas — receba um lote com sua própria quantidade, e uma ordem de produção consome automaticamente primeiro do lote mais antigo (FIFO), para que você sempre saiba exatamente qual lote entrou em qual execução de produção.

## 3. Ordens de Produção

Este é o fluxo de trabalho central da fabricação, e ele passa por quatro estados:

- **Rascunho** — você escolhe um produto com uma BOM e uma quantidade planejada; o Sarang calcula exatamente quanto de cada matéria-prima esse plano precisa.
- **Em Andamento** — iniciar uma ordem verifica se cada matéria-prima necessária tem estoque suficiente; se algo estiver faltando, ela informa exatamente o quê e quanto, e se recusa a iniciar. Uma vez iniciada, as matérias-primas são deduzidas imediatamente (registradas como um movimento "Consumido" contra cada material) — isso acontece no início, não na conclusão.
- **Concluída** — você informa a quantidade realmente produzida, uma **quantidade de descarte/rejeitado** (unidades que consumiram material e mão de obra mas não renderam nada vendável) e o **custo de mão de obra** da execução. O Sarang adiciona a quantidade produzida ao estoque do produto acabado e recalcula seu custo médio a partir do custo de material somado ao custo de mão de obra, dividido apenas entre as unidades produzidas — o custo das unidades descartadas é absorvido pelo custo das unidades boas, já que elas também consumiram recursos reais.
- **Cancelada** — disponível a partir de Rascunho ou Em Andamento, com um motivo opcional. Cancelar uma ordem que já consumiu matérias-primas devolve-as ao estoque.

Cada ordem de produção também pode ter uma lista opcional de **etapas da ordem de serviço** (por exemplo, "Mistura", "Cozimento", "Embalagem") que você marca uma a uma conforme a produção realmente acontece no chão de fábrica. Marque uma etapa como **ponto de controle de qualidade** e o Sarang exige um resultado real de Aprovado/Reprovado antes que ela possa ser marcada — um controle de qualidade não pode ser silenciosamente pulado com uma simples marcação.

## 4. Rastreamento de Despacho

Uma vez que um produto esteja pronto e em estoque, **Despacho** registra sua saída: escolha o produto, uma quantidade e, opcionalmente, um cliente e um destino. Um registro de despacho começa como **Pronto**, passa para **Despachado** (este é o momento em que o Sarang efetivamente deduz a quantidade do estoque de produtos acabados — não na criação) e finalmente **Entregue**. Criar um registro de despacho verifica se há estoque acabado suficiente antes de permitir que você prossiga.

## 5. Produtos Acabados

**Produtos Acabados** lista todo produto que tem uma BOM definida para ele — em outras palavras, tudo o que você realmente fabrica, em vez de apenas revender. Para cada um, você pode ver o estoque atual, o preço de venda e acessar seu **histórico de produção** completo (toda ordem de produção que já o produziu, quantidade planejada vs. produzida e status).

## 6. Gestão de Fornecedores

Esta tela é o seu diretório de fornecedores de matéria-prima: todo fornecedor ativo que tenha ao menos uma matéria-prima vinculada a ele, com dados de contato, saldo pendente e uma visão detalhada de exatamente quais materiais você compra dele (com o estoque atual de cada material, sinalização de estoque baixo e custo unitário). Ela reutiliza os mesmos registros de Fornecedor do resto do Sarang — não há uma lista separada de "fornecedor de fabricação" para manter.

## 7. Análise de Produção

Um painel da sua atividade de fabricação: contagem de ordens por status (Rascunho / Em Andamento / Concluída / Cancelada), sua **taxa de rendimento** geral (total produzido ÷ total planejado entre as ordens concluídas), o custo total de material gasto e uma tabela de ordens concluídas recentemente mostrando a porcentagem de rendimento por ordem e o custo por unidade — útil para identificar quais produtos consistentemente produzem menos do que o planejado ou custam mais do que o esperado.
