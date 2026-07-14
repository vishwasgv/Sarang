# Varejo

Escolher **Varejo** como seu tipo de negócio ativa **Devoluções** mais o conjunto de módulos compartilhado de **Logística**. Tudo o mais — Faturamento, Produtos, Clientes, Estoque, Relatórios — funciona exatamente como descrito nesses capítulos; este capítulo cobre o que é específico de uma loja de varejo.

## Devoluções

Abra **Devoluções** na barra lateral para processar a devolução ou troca de um cliente referente a uma venda anterior. Busque a nota original pelo número da nota, e o Sarang carrega seus itens com uma quantidade **Máx. a Devolver** para cada um — esta é a quantidade original menos qualquer coisa já devolvida na mesma nota em uma visita anterior, para que você nunca devolva acidentalmente mais de um item do que o cliente realmente comprou (o Sarang também verifica e bloqueia isso ao salvar, não apenas no controle de quantidade).

Escolha a quantidade a devolver de cada item usando os controles +/-, informe um motivo (obrigatório) e envie. Isso cria uma **nota de devolução** propriamente dita (com seu próprio número de nota, prefixado com RET-) que reverte proporcionalmente a receita, o desconto e o imposto da venda original — não é um ajuste silencioso de estoque, é uma transação real e vinculada que você pode encontrar depois a partir de qualquer uma das duas notas.

## Logística e Cadeia de Suprimentos

Como o modelo padrão do Varejo inclui os módulos de Logística, você também tem **Frota**, **Transportadoras**, **Remessas**, **Nota de Recebimento (GRN)**, **Guia de Remessa**, **Livro de Fretes** e **Análise de Logística** para rastrear seus próprios veículos de entrega e as remessas de fornecedores — veja as telas de Logística sob esses nomes na barra lateral.

## O que é compartilhado com todo negócio

Faturamento, emissão de notas, pagamentos, Clientes, Produtos, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos. Uma loja de varejo também pode ativar recursos transversais independentemente em Configurações → Additional Business Features — a geração/impressão de código de barras e o faturamento por peso/a granel (Loose/Weight billing) são escolhas comuns para uma loja de varejo, mas vêm desativados por padrão e não são específicos do tipo de negócio Varejo.
