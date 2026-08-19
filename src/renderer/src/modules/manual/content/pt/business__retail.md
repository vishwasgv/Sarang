# Varejo

Escolher **Varejo** como seu tipo de negócio ativa **Devoluções** mais o conjunto de módulos compartilhado de **Logística**. Tudo o mais — Faturamento, Produtos, Clientes, Estoque, Relatórios — funciona exatamente como descrito nesses capítulos; este capítulo cobre o que é específico de uma loja de varejo.

## Devoluções

Abra **Devoluções** na barra lateral para processar a devolução ou troca de um cliente referente a uma venda anterior. Busque a nota original pelo número da nota, e o Sarang carrega seus itens com uma quantidade **Máx. a Devolver** para cada um — esta é a quantidade original menos qualquer coisa já devolvida na mesma nota em uma visita anterior, para que você nunca devolva acidentalmente mais de um item do que o cliente realmente comprou (o Sarang também verifica e bloqueia isso ao salvar, não apenas no controle de quantidade).

Escolha a quantidade a devolver de cada item usando os controles +/-, informe um motivo (obrigatório) e envie. Isso cria uma **nota de devolução** propriamente dita (com seu próprio número de nota, prefixado com RET-) que reverte proporcionalmente a receita, o desconto e o imposto da venda original — não é um ajuste silencioso de estoque, é uma transação real e vinculada que você pode encontrar depois a partir de qualquer uma das duas notas.

## Logística e Cadeia de Suprimentos

Como o modelo padrão do Varejo inclui os módulos de Logística, você também tem **Frota**, **Transportadoras**, **Remessas**, **Nota de Recebimento (GRN)**, **Guia de Remessa**, **Livro de Fretes** e **Análise de Logística** para rastrear seus próprios veículos de entrega e as remessas de fornecedores — veja as telas de Logística sob esses nomes na barra lateral.

## Relatórios

Abra **Relatórios → Lista de Liquidação de Estoque Parado** para ver cada produto ainda em estoque sem nenhuma venda nos últimos 90 dias — um gráfico de barras mais uma tabela completa, ordenados para que os produtos que imobilizam mais dinheiro fiquem no topo, não apenas os mais antigos. Cada linha mostra o estoque atual do produto, seu custo, e o **capital parado** resultante (estoque × custo) — o dinheiro real parado sem fazer nada na sua prateleira. Um produto que nunca vendeu mostra "Nunca Vendido" em vez de uma data de última venda — uma distinção honesta em relação a um que simplesmente não vendeu recentemente. Use esta lista para decidir o que realmente precisa de uma redução de preço, um pacote, ou um impulso de liquidação — não um palpite baseado em qual prateleira parece empoeirada.

Abra **Relatórios → Taxa de Giro por Categoria** na barra lateral para ver, mês a mês, quanto do estoque disponível de cada categoria de produto está realmente girando — um gráfico de barras agrupadas mais uma tabela completa, uma barra por categoria por mês. Cada barra mostra a parcela das unidades vendidas-mais-em-estoque dessa categoria que vendeu naquele mês: uma categoria que gira rápido fica alta, uma que se acumula silenciosamente fica baixa. Cada mês mostrado é comparado com seu estoque ATUAL disponível, não com o nível de estoque histórico próprio daquele mês, então leia como uma visão de tendência do que está vendendo agora, não como um histórico exato mês a mês — genuinamente útil para identificar quais categorias merecem mais espaço na prateleira ou um pedido maior, e quais precisam desacelerar, sem revisar dezenas de produtos individuais um por um.

Abra **Relatórios → Composição da Cesta** na barra lateral para ver quais produtos seus clientes mais compram juntos na mesma venda — um gráfico de barras mais uma tabela completa de cada par de produtos, ordenada por quantas cestas continham ambos. O resumo ao lado mostra o número total de cestas no período, a média de itens diferentes por cesta, e o valor médio da cesta. Use isso para decidir o que colocar lado a lado na prateleira, ou qual oferta combinada é realmente respaldada por comportamento de compra real, não por um palpite.

## Reduções de Preço

Abra **Reduções de Preço** na barra lateral para reduzir o preço de um produto por tempo limitado e fazê-lo reverter sozinho — sem precisar lembrar de alterá-lo de volta. Escolha um produto, defina o preço reduzido e escolha a data em que deve terminar; o novo preço aplica-se ao produto imediatamente, e o Sarang restaura automaticamente o preço original assim que essa data passar (verificado na inicialização do app e aproximadamente a cada hora, então você não precisa estar com o app aberto naquele momento exato). Apenas uma redução pode estar ativa em um produto por vez — cancele a atual primeiro se precisar mudar os termos.

Se você mesmo alterar o preço de venda desse produto enquanto uma redução ainda está em andamento, o Sarang percebe: a reversão automática é ignorada em vez de sobrescrever sua alteração manual, e a redução simplesmente se encerra marcada como "Alterada Manualmente" em vez de "Revertida" — assim uma redução nunca pode desfazer silenciosamente uma decisão de preço que você tomou de propósito. Use **Cancelar** em uma redução ativa para encerrá-la antes do prazo — se o preço não foi alterado desde que a redução começou, ele volta ao original imediatamente; se foi, cancelar apenas para de rastrear a redução sem tocar no preço. **Verificar Agora** nesta tela executa a mesma verificação de reversão sob demanda, caso você não queira esperar pelo próximo ciclo automático.

## Programa de Fidelidade

Abra **Programa de Fidelidade** na barra lateral para administrar uma recompensa simples por cartão de carimbos — defina quantas visitas geram uma recompensa e qual é essa recompensa (um item grátis, uma porcentagem de desconto, o que você quiser oferecer). Uma vez ativado, um carimbo é adicionado automaticamente ao cartão de um cliente em toda venda qualificada — nenhuma etapa extra no checkout, e você pode definir um valor mínimo de compra se quiser dar carimbos apenas em vendas acima de um determinado valor.

Esta tela mostra o progresso atual de cada cliente rumo à próxima recompensa, junto com quantos carimbos ele ganhou no total e quantas recompensas já resgatou. Assim que um cliente atinge a meta, use **Resgatar** aqui para dar a ele sua recompensa — isso usa exatamente os carimbos necessários, então qualquer carimbo extra além da meta é levado para a próxima recompensa em vez de ser perdido.

## O que é compartilhado com todo negócio

Faturamento, emissão de notas, pagamentos, Clientes, Produtos, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos. Uma loja de varejo também pode ativar recursos transversais independentemente em Configurações → Additional Business Features — a geração/impressão de código de barras e o faturamento por peso/a granel (Loose/Weight billing) são escolhas comuns para uma loja de varejo, mas vêm desativados por padrão e não são específicos do tipo de negócio Varejo.
