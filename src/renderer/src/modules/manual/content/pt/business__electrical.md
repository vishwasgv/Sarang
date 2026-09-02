# Elétrica

## O que é diferente neste tipo de negócio

Uma loja de material elétrico vende uma mistura de itens contados por peça (interruptores, disjuntores, acessórios) e fio ou cabo cortado por comprimento de uma bobina — a mesma bobina é um único item de estoque, mas cada venda tem um comprimento diferente. Elétrica também ativa o rastreamento de série e garantia (para quadros elétricos e outras unidades individualmente identificáveis), contas correntes de obra para empreiteiros, e rastreamento de variantes (para bitolas de fio, tamanhos de acessórios, e outras especificações vendidas sob um nome de produto).

## Faturamento de fio/cabo por metro

Ao criar ou editar um produto, ative **Vender por Comprimento** e escolha uma unidade (metros ou pés) e um preço por unidade. No momento do faturamento, adicionar esse produto ao carrinho o adiciona com quantidade de uma unidade de comprimento em vez de uma peça, com uma entrada de quantidade de granularidade fina (passo de 0,1) para que um caixa possa inserir exatamente quanto foi cortado da bobina — 4,5 metros, não "5 peças".

## Contas de Obra

Abra **Job-Site Accounts** na barra lateral para abrir uma conta corrente para um empreiteiro trabalhando em uma obra específica — útil quando o mesmo eletricista está comprando material para uma obra em várias visitas e você quer rastrear o que essa obra deve como sua própria linha, separada do razão geral de cliente do empreiteiro. Crie uma conta com um nome (ex.: "Residência Sharma — Ala B"), o empreiteiro contra o qual ela fatura, e um endereço de obra opcional.

Ao faturar uma venda a CRÉDITO para esse empreiteiro, aparece um seletor de **Job-Site Account** — selecione a conta para vincular a nota fiscal a ela. Abra uma conta na lista para ver todas as notas fiscais vinculadas a ela e o total faturado e pendente em andamento. Uma conta só pode ser fechada depois que seu saldo pendente for totalmente quitado.

## Construtor de Kits de Serviço

Ao editar um produto e marcá-lo como kit (veja o capítulo de Estoque para como os kits funcionam em geral), os produtos Elétrica ganham um botão extra **Suggest from past orders** no editor de componentes do kit. Ele analisa o histórico real de notas fiscais para o que já foi comprado junto com esse produto antes — um ventilador de teto vendido junto com fio, um interruptor, e uma caixa de junção, por exemplo — e pré-preenche a lista de componentes com os acompanhantes mais frequentes e suas quantidades típicas. Revise, ajuste, ou remova qualquer linha sugerida antes de salvar; nada é adicionado ao kit até você salvar.

## Relatórios

Junto com os relatórios padrão de Vendas, Estoque e Financeiro, Elétrica recebe:

- **Perda e Rendimento de Bobina** — para cada produto vendido por comprimento, quanto foi recebido (dos registros de compra), quanto foi realmente vendido por comprimento, e quanto foi registrado como baixa/ajuste de estoque. O percentual de rendimento e a perda estimada facilitam identificar uma bobina que está perdendo mais material em sobras do que o esperado.
- **Mais Vendidos por Especificação** — a mesma matriz de velocidade-de-venda versus margem de itens de giro rápido/lento que as lojas de Ferragens usam, lida para Elétrica: sob rastreamento de variantes, o nome e SKU de um produto já carregam sua especificação (bitola de fio, tamanho de acessório), então isso classifica quais especificações realmente giram rápido e quais estão paradas.
- **Registro de Segurança ISI/BIS** — um registro de rastreabilidade de cada unidade rastreada por série: qual produto, seu número de série/lote, quando foi recebida, sua garantia, e quando e em qual nota fiscal foi vendida — o registro que você precisaria em mãos para uma verificação de conformidade de segurança ou um recall.

## Idioma

Elétrica não é um dos modelos de negócio de serviços do Sarang — é um tipo de negócio por categoria de produto, então **não** é bloqueada por idioma. A interface principal está disponível nos 13 idiomas suportados.
