# Farmácia

Escolher **Farmácia** como seu tipo de negócio ativa o **rastreamento de lote**, o **rastreamento de validade** e o conjunto de módulos compartilhado de **Logística**. Tudo o mais — Faturamento, Produtos, Clientes, Estoque, Relatórios — funciona exatamente como descrito nesses capítulos; este capítulo cobre o que é específico de uma farmácia.

## Gestão de Lotes

Abra **Gestão de Lotes** na barra lateral para registrar todo lote de estoque recebido: produto, número de lote, quantidade recebida, data de validade, uma data de fabricação opcional, custo unitário e de qual fornecedor ele veio. Cada lote controla sua própria **quantidade restante** separadamente do que foi originalmente recebido, e a lista pode ser filtrada em **Todos**, **Vencendo em Breve** ou **Vencidos**. Selos de alerta no topo da tela sinalizam quantos lotes estão vencendo em até 30 dias ou já vencidos, para que uma conferência de estoque nunca seja uma surpresa. Você pode editar a data de validade, a data de fabricação, a quantidade restante ou o custo de um lote depois, ou desativar um lote assim que ele for totalmente utilizado ou baixado.

O relatório de **Vencimento de Lotes** (Relatórios → Batch Expiry) transforma esses mesmos dados em valor: além de quantos lotes há em cada janela de vencimento, ele agora mostra o **valor em risco** real em cada categoria, para que você veja de relance não apenas "12 lotes vencendo em breve", mas exatamente quanto valor de estoque isso representa — e um número separado de "Valor em Risco" totaliza o que ainda é recuperável (o estoque já vencido é uma perda definitiva, não algo que uma reposição ou devolução possa corrigir, por isso é excluído desse total).

## Como a venda utiliza os lotes

Você não escolhe um lote manualmente no momento da venda — o Faturamento consome do estoque de lotes automaticamente, o lote que vence primeiro primeiro (FIFO por data de validade), para qualquer produto que tenha lotes registrados. Se o único estoque de lote disponível para cobrir uma venda já estiver vencido, o Sarang bloqueia a venda por padrão, em vez de deixar silenciosamente estoque vencido sair pela porta — você precisaria registrar um novo lote válido, ou (apenas se genuinamente pretendido) ativar "Permitir venda de lote vencido" em Configurações para contornar isso. Devoluções em um produto rastreado por lote restauram a quantidade de volta ao lote correto da mesma forma, para que os números de quantidade restante permaneçam precisos após uma devolução.

## Medicamentos sob prescrição (Lista H/H1)

Marque um produto como **Prescrição Obrigatória** em seu formulário de Produto, e o Faturamento exigirá o nome do paciente e o nome do médico prescritor antes de permitir adicioná-lo a um carrinho — a venda simplesmente não pode ser concluída sem os dois, mantendo você em conformidade com as exigências de registro da Lista H/H1. Um relatório dedicado de **Vendas de Medicamentos Sob Prescrição** (somente Farmácia) lista toda venda desse tipo com os dados de paciente/médico capturados, e agora abre com um gráfico **Por Médico Prescritor** acima do registro — quais médicos estão lhe enviando mais negócio de prescrições neste período, de relance em vez de rolar o registro inteiro.

Para medicamentos narcóticos ou psicotrópicos (Lista H1/X — uma categoria mais rigorosa do que apenas exigir prescrição), marque também **Schedule H1/X** no formulário do produto (só aparece depois que Prescription Required já estiver marcado). Toda venda de um produto da Lista H1/X é registrada com os mesmos detalhes de paciente/médico/data acima, e um relatório **Registro da Lista H1/X** separado e mais restrito (Relatórios → Registro da Lista H1/X) lista apenas essas vendas — exatamente o subconjunto que um inspetor gostaria de ver, sem que você precise filtrá-lo do registro completo de prescrições. Isso mostra exatamente o que o Sarang registra (data, produto, quantidade, paciente, médico, fatura) — não é uma alegação de formato de registro estatutário completo.

## Número da licença de farmácia

Informe o **Número da Licença de Farmácia** do seu estabelecimento em Configurações → Perfil do Negócio — é específico deste tipo de negócio e só aparece quando Farmácia é o seu tipo de negócio ativo.

## Reposição automática a partir do estoque baixo

Defina um **Fornecedor Padrão** em um produto (ao lado do seu Nível/Quantidade de Reposição no formulário de Produto), e quando esse produto ficar com estoque baixo, use **Gerar Pedidos de Reposição** na barra de alerta de estoque baixo em Estoque. O Sarang monta um pedido de compra por fornecedor, agrupando todo produto pendente que tenha um fornecedor padrão configurado, e ignora qualquer item que já esteja em um pedido de compra em aberto, para que executá-lo novamente nunca crie duplicatas — produtos sem fornecedor padrão definido também são ignorados, com uma contagem exibida para que você saiba o que ainda precisa de atenção manual.

Um produto com estoque baixo também é verificado quanto ao seu próprio **estoque de lotes próximos do vencimento** antes de ser reposto: se uma quantidade significativa estiver prestes a vencer e a velocidade de vendas recente não for rápida o suficiente para vendê-la antes disso, a reposição é suprimida em vez de ser criada — pedir mais de algo que não está vendendo significa apenas comprar um segundo lote que também será desperdiçado. Os produtos suprimidos são contados na mesma mensagem de resumo que a tela já exibe, para que nada seja ignorado silenciosamente sem o seu conhecimento.

## Logística e Cadeia de Suprimentos

Como o modelo padrão da Farmácia inclui os módulos de Logística, você também tem **Frota**, **Transportadoras**, **Remessas**, **Nota de Recebimento (GRN)**, **Guia de Remessa**, **Livro de Fretes** e **Análise de Logística** para rastrear seus próprios veículos de entrega e as remessas de fornecedores — veja as telas de Logística sob esses nomes na barra lateral.

## O que é compartilhado com todo negócio

Faturamento, emissão de notas, pagamentos, Clientes, Produtos, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos.
