# Farmácia

Escolher **Farmácia** como seu tipo de negócio ativa o **rastreamento de lote**, o **rastreamento de validade** e o conjunto de módulos compartilhado de **Logística**. Tudo o mais — Faturamento, Produtos, Clientes, Estoque, Relatórios — funciona exatamente como descrito nesses capítulos; este capítulo cobre o que é específico de uma farmácia.

## Gestão de Lotes

Abra **Gestão de Lotes** na barra lateral para registrar todo lote de estoque recebido: produto, número de lote, quantidade recebida, data de validade, uma data de fabricação opcional, custo unitário e de qual fornecedor ele veio. Cada lote controla sua própria **quantidade restante** separadamente do que foi originalmente recebido, e a lista pode ser filtrada em **Todos**, **Vencendo em Breve** ou **Vencidos**. Selos de alerta no topo da tela sinalizam quantos lotes estão vencendo em até 30 dias ou já vencidos, para que uma conferência de estoque nunca seja uma surpresa. Você pode editar a data de validade, a data de fabricação, a quantidade restante ou o custo de um lote depois, ou desativar um lote assim que ele for totalmente utilizado ou baixado.

## Como a venda utiliza os lotes

Você não escolhe um lote manualmente no momento da venda — o Faturamento consome do estoque de lotes automaticamente, o lote que vence primeiro primeiro (FIFO por data de validade), para qualquer produto que tenha lotes registrados. Se o único estoque de lote disponível para cobrir uma venda já estiver vencido, o Sarang bloqueia a venda por padrão, em vez de deixar silenciosamente estoque vencido sair pela porta — você precisaria registrar um novo lote válido, ou (apenas se genuinamente pretendido) ativar "Permitir venda de lote vencido" em Configurações para contornar isso. Devoluções em um produto rastreado por lote restauram a quantidade de volta ao lote correto da mesma forma, para que os números de quantidade restante permaneçam precisos após uma devolução.

## Logística e Cadeia de Suprimentos

Como o modelo padrão da Farmácia inclui os módulos de Logística, você também tem **Frota**, **Transportadoras**, **Remessas**, **Nota de Recebimento (GRN)**, **Guia de Remessa**, **Livro de Fretes** e **Análise de Logística** para rastrear seus próprios veículos de entrega e as remessas de fornecedores — veja as telas de Logística sob esses nomes na barra lateral.

## O que é compartilhado com todo negócio

Faturamento, emissão de notas, pagamentos, Clientes, Produtos, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos.
