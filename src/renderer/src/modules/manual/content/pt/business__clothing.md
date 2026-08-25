# Vestuário

Escolher **Clothing** como seu tipo de negócio ativa o **rastreamento de variações de tamanho/cor**, **Devoluções** e o conjunto de módulos compartilhado de **Logística**. Tudo o mais — Faturamento, Produtos, Clientes, Estoque, Relatórios — funciona exatamente como descrito nesses capítulos; este capítulo cobre o que é específico de uma loja de roupas.

## Rastreamento de variações (tamanho e cor)

Um item de vestuário geralmente não é um único número de estoque — "Camiseta Masculina" pode existir em cinco tamanhos e quatro cores, cada uma com sua própria contagem de estoque. Em **Produtos**, toque no ícone de camadas em qualquer produto para abrir **Gerenciar Variações**. Adicione uma linha para cada combinação de tamanho/cor que você realmente estoca (os campos de tamanho e cor sugerem tamanhos comuns de roupas conforme você digita — de XS a 3XL — mas você pode digitar qualquer coisa), cada uma com seu próprio SKU opcional, um preço adicional sobre o preço base do produto caso essa variação custe mais (por exemplo, um tamanho plus size) e sua própria quantidade em estoque. A tela mostra um total corrente de variações e o estoque combinado de todas elas.

Registros de produto para um negócio de Vestuário também têm um campo opcional de **Gênero** (Masculino/Feminino/Unissex) e um campo de texto livre **Estação / Coleção** (ex. "Verão 2026", "Coleção Diwali") para ajudar a organizar seu catálogo.

Precisa estocar várias combinações de uma vez? Use **Gerar Matriz de Tamanho × Cor** na parte inferior de Gerenciar Variações — digite seus tamanhos e cores como listas separadas por vírgula (por exemplo, "P, M, G" e "Preto, Branco") e o Sarang cria cada combinação como uma nova linha de uma só vez, ignorando qualquer combinação que você já tenha adicionado manualmente.

Cada linha de variação tem seu próprio **código de barras** — gere um por linha, ou use **Gerar Códigos de Barras Ausentes** para preencher toda variação que ainda não tenha um. Ao imprimir etiquetas, um produto com variações rastreadas abre um seletor para que a etiqueta traga o código de barras e o preço exatos daquela variação, não os do produto principal.

Pronto para fazer um novo pedido de um produto, mas não tem certeza de como dividi-lo entre os tamanhos? Abra **Divisão de Reposição Sugerida** na parte inferior de Gerenciar Variações, insira uma quantidade total (ou deixe em branco para usar a quantidade de reposição já configurada do produto), e o Sarang pondera a divisão em direção aos tamanhos e cores que realmente têm vendido nos últimos 90 dias — em vez de dividir igualmente. É a solução para o problema clássico de "esgotou M e L três semanas antes de S e XL, mas repôs todos igualmente mesmo assim". Isso é apenas uma sugestão, não um pedido ao vivo — você ainda faz o Pedido de Compra real você mesmo, informado pela divisão.

## Vendendo uma variação

No **Faturamento**, adicionar um produto que tem variações configuradas não o adiciona diretamente ao carrinho — abre-se um seletor para você escolher exatamente qual combinação de tamanho/cor está sendo vendida, e é o estoque e o preço daquela variação específica (preço base + seu preço adicional, se houver) que realmente entra no carrinho. Isso mantém suas contagens de estoque por tamanho/cor precisas, em vez de simplesmente decrementar um único número compartilhado para o produto inteiro.

## Relatório de Taxa de Venda por Estação/Coleção

Se você marcar seus produtos com uma **Estação / Coleção**, abra **Relatórios → Taxa de Venda por Estação/Coleção** para ver, mês a mês, qual parcela das unidades vendidas-mais-em-estoque de cada coleção realmente vendeu — uma forma rápida de identificar qual coleção está vendendo e qual está silenciosamente acumulando na prateleira. O gráfico mostra cada coleção como sua própria barra por mês, com uma linha de tendência de média geral sobreposta; o número é comparado com seu estoque atual disponível para cada mês mostrado, então leia como uma tendência contínua, não como um instantâneo histórico exato de cada mês. Produtos sem estação definida são totalmente excluídos deste relatório — marque os que deseja rastrear.

## Relatório de Mapa de Calor Tamanho × Estilo

Abra **Relatórios → Mapa de Calor Tamanho × Estilo** para ver uma grade mostrando exatamente quais combinações de tamanho/produto ("estilo") estão realmente vendendo — cada produto na lateral, cada tamanho no topo, cada célula sombreada de acordo com quantas unidades daquela combinação exata venderam no intervalo de datas escolhido. Células mais escuras significam mais unidades vendidas; uma célula em branco significa que aquele par tamanho/estilo não vendeu nada. Foi feito para identificar padrões que uma lista de vendas simples esconderia — um estilo que só vende em M e L, ou um tamanho que nunca vende não importa o estilo. A grade mostra seus 15 estilos mais vendidos por volume, para permanecer legível mesmo em um catálogo grande.

## Relatório de Margem por Marca/Fornecedor

Atribua um **Fornecedor** aos seus produtos (ecrã Produtos — o mesmo campo usado para compras) e abra **Relatórios → Margem por Marca/Fornecedor** para ver a receita, o custo e a margem divididos por qual fornecedor cada produto vendido veio. Isto responde a uma pergunta diferente da própria vista de valor-de-stock-por-produto do Relatório de Inventário — trata-se de quais marcas/fornecedores são realmente rentáveis de manter, não apenas quais vendem mais. Um fornecedor cuja margem resulta negativa é mostrado honestamente como um prejuízo, sem ser escondido ou limitado a zero — é exatamente esse o caso que vale a pena detetar. Produtos sem fornecedor atribuído ficam totalmente excluídos deste relatório — atribua um aos que quiser acompanhar.

## Devoluções

Vestuário também tem a tela padrão de **Devoluções** — busque uma nota anterior pelo número, selecione quais itens e quantidades devolver (limitado ao que ainda é realmente devolvível, considerando o que já foi devolvido antes), informe um motivo e envie. Veja a seção *Devoluções* do capítulo de Varejo para o comportamento completo — funciona de forma idêntica aqui.

Para uma linha com variante (qualquer produto vendido com tamanho/cor), a tela de Devoluções também oferece um botão de **Troca** ao lado do seletor de quantidade a devolver — para quando o cliente quer um tamanho ou cor diferente, não um reembolso. Escolha uma quantidade, selecione o tamanho/cor de substituição entre o que está atualmente em stock, informe um motivo e confirme. Nos bastidores, isso cria em uma única etapa duas transações vinculadas e totalmente reais: uma nota de devolução para o item entregue (repondo-o no stock e creditando o cliente exatamente como uma devolução normal faria) e uma nova nota de venda para o item de substituição, com o preço atual próprio desse item — não o preço do item antigo, para que um preço já alterado seja refletido honestamente. O Sarang mostra imediatamente a diferença exata: se a substituição custar mais, quanto cobrar a mais; se custar menos, quanto reembolsar; e se os preços coincidirem exatamente, nenhum saldo fica devido.

## Logística e Cadeia de Suprimentos

Como o modelo padrão do Vestuário inclui os módulos de Logística, você também tem **Frota**, **Transportadoras**, **Remessas**, **Nota de Recebimento (GRN)**, **Guia de Remessa**, **Livro de Fretes** e **Análise de Logística** para rastrear seus próprios veículos de entrega e as remessas de fornecedores — veja as telas de Logística sob esses nomes na barra lateral.

## O que é compartilhado com todo negócio

Faturamento, emissão de notas, pagamentos, Clientes, Produtos, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos.
