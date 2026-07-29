# Controle de Pragas

## O que está incluído

Controle de Pragas é construído sobre a base compartilhada de negócios de serviço do Sarang — agendamentos, um catálogo de serviços, horários de prestadores, e a fila de notificações — mais um único módulo dedicado: **Pest Control**, cobrindo tanto contratos de serviço recorrentes quanto ordens de serviço individuais.

## Contratos de Serviço

Um contrato registra o cliente, endereço e tipo de propriedade (Residencial, Comercial, Industrial), os tipos de praga cobertos (Baratas, Roedores, Cupins, Formigas, Mosquitos, Percevejos, Outro — escolha quantos se aplicarem), a frequência de serviço (Mensal, Trimestral, Semestral, Anual, Único), um valor de contrato, datas de início/fim, e status (Ativo, Pendente, Expirado, Cancelado).

Um contrato ativo com um valor pode ser faturado pela sua taxa recorrente com **Generate Invoice** — isso não é uma ação única: o Sarang acompanha para qual período o contrato foi faturado por último, para que você possa faturar o mesmo contrato novamente a cada período em que ele se repete, no ritmo correspondente à sua própria frequência. As notas fiscais de contrato usam SAC 998534 a 18% de GST.

## Ordens de Serviço

Uma ordem de serviço é uma única visita — opcionalmente vinculada a um contrato, ou criada como uma visita única/avulsa — registrando data/hora da visita, técnicos atribuídos, pesticida usado, áreas atendidas (uma lista de seleção rápida: Cozinha, Banheiros, Quarto, Depósito, Terraço, Jardim, Porão, Escritório, Armazém, Cozinha de Restaurante, Áreas Comuns), tipo de tratamento (Pulverização, Gel, Fumigação, Armadilha, Isca, Combinado), valor do serviço, e se a assinatura do cliente foi obtida. Uma ordem de serviço avança através de **Scheduled → In Progress → Completed** (com Cancelled como um resultado separado); assim que Completed, **Generate Invoice** fatura aquela visita (mesmo SAC 998534, 18% de GST).

Para um registro real e detalhado dos produtos químicos realmente usados em uma visita, adicione linhas a **Pesticides Used** — nome, quantidade, unidade, praga alvo, e uma nota de dosagem opcional. Vincule uma linha a um produto real do estoque para que ela deduza o estoque automaticamente quando usada, ou deixe-a sem vínculo para um negócio que não rastreia o estoque de produtos químicos no Sarang.

A barra de KPI mostra contratos ativos, ordens de serviço pendentes, e ordens de serviço agendadas nesta semana.

## Idioma

Controle de Pragas é um dos 24 modelos de negócio de serviço dedicados do Sarang, e como quase todos eles, sua interface é **apenas em inglês**, independentemente do idioma que você configurou no restante do Sarang.
