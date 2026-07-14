# Estoque

## Adicionando e editando produtos

Abra **Produtos** na barra lateral para ver a lista completa de produtos, filtrável por categoria. Clique em **Adicionar Produto** para criar um, ou no ícone de edição em qualquer linha para alterá-lo. Os campos principais de um produto são:

- **Nome do Produto**, **SKU**, **Código de Barras**, **Código NCM/Item** e uma **Descrição** curta.
- **Tipo de Produto** — Físico (um item físico com estoque controlado) ou Serviço (sem estoque a controlar, por exemplo, uma taxa de mão de obra).
- **Unidade** — escolha de uma lista fixa (PCS, KG, G, L, ML, M, CM, SQFT, SQM, BOX, DOZEN, PACKET, PAIR, SET, BOTTLE, BAG, ROLL, HOUR, SERVICE).
- **Preço de Custo**, **Preço de Venda** e **Alíquota (%)** — a alíquota pode ser digitada livremente, ou aplicada com um clique a partir de qualquer taxa configurada em **Configurações → Tax Configuration**.
- **Ponto de Reposição** e Quantidade de Reposição — o limite de estoque que dispara um alerta de estoque baixo, e quanto você normalmente recompraria.
- **Quantidade Inicial** — a contagem de estoque com que o produto começa quando é criado pela primeira vez.
- Uma **imagem do produto** opcional.

As **Categorias** são gerenciadas pelo botão **Categoria** na tela de Produtos, permitindo agrupar produtos para filtragem e relatórios.

Alguns tipos de produto são opcionais e só aparecem quando o recurso correspondente está ativado para o seu negócio (em **Configurações → Additional Business Features** ou no próprio modelo do seu tipo de negócio): venda por peso/faturamento a granel, variações de tamanho/cor, itens alugáveis e precificação de metal para joalheria. Esses recursos são opcionais por produto — ativar um recurso não força todo produto a esse modo. O rastreamento de lote/validade, o rastreamento de série/IMEI e outros comportamentos de estoque específicos de cada tipo de negócio são abordados no capítulo do respectivo tipo de negócio, não aqui.

## Níveis de estoque e movimentos

**Estoque** (`/inventory`) lista o estoque atual, o ponto de reposição, o custo médio e o valor em estoque de cada produto, com uma contagem em tempo real de itens com estoque baixo e sem estoque exibida como selos de alerta no topo. Alterne entre as abas **Todos** e **Estoque Baixo**.

Para corrigir manualmente uma contagem de estoque — após uma contagem física, avaria ou um saldo inicial — clique no ícone de ajuste de estoque em uma linha. Informe a nova quantidade (não a diferença); a tela mostra quanto será adicionado ou removido antes de você salvar, e exige um motivo. Se você estiver aumentando o estoque, pode opcionalmente registrar o custo por unidade dessa adição, que alimenta o custo médio do produto usado para avaliação.

Toda alteração no estoque — uma venda, um ajuste manual, um pedido de compra recebido, uma devolução ou uma ordem de produção — é registrada como um **movimento** imutável. **Movimentos** (`/inventory/movements`, acessado pelo botão **Movimentos**) é um razão somente leitura de cada um desses eventos, filtrável por tipo (Stock Added, Sale, PO Received, Adjustment, Sale Return, Return Received, Dispatched, Produced) e pesquisável, para que você sempre possa rastrear exatamente por que o estoque de um produto está no nível em que está.

## Pedidos de Compra

**Pedidos de Compra** (`/purchase-orders`) acompanham o que você encomendou dos fornecedores. Crie um com **New PO**: escolha um fornecedor, adicione itens (buscados por nome do produto ou SKU) com quantidade, custo unitário e alíquota, e uma data de entrega prevista opcional.

Um pedido de compra passa por um ciclo de vida fixo:

1. **Draft** — ainda editável.
2. **Approve** para travá-lo contra novas alterações.
3. **Receive Stock** — esta é a etapa que efetivamente adiciona as quantidades pedidas ao seu estoque e registra um movimento de compra para cada item. Uma vez recebido, o pedido mostra o nível de estoque resultante de cada item ao lado da linha do pedido.
4. Um pedido em Draft ou Approve pode, em vez disso, ser **cancelado**, com um motivo.

## Visibilidade de estoque baixo

As contagens de estoque baixo e sem estoque aparecem em três lugares que permanecem sempre sincronizados: os selos de alerta no topo da tela de Estoque, os cartões de estoque baixo e sem estoque no Painel, e o filtro de estoque baixo nas telas de Produtos/Estoque. Definir um ponto de reposição sensato em cada produto (o padrão é 5) é o que torna esses alertas úteis — um produto sem ponto de reposição definido efetivamente nunca dispara um alerta de estoque baixo.
