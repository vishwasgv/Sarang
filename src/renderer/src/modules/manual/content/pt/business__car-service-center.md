# Centro Automotivo

## O que está incluído

Centro Automotivo é construído sobre a base compartilhada de negócios de serviço do Sarang — agendamentos, um catálogo de serviços, horários de prestadores, e a fila de notificações — mais um único módulo dedicado: **Job Cards**.

## Ordens de Serviço

Cada ordem de serviço registra o cliente e o veículo — placa do veículo, marca, modelo, ano, tipo de veículo (2R, 4R, Comercial, Outro), leitura do odômetro na entrada (e na saída, assim que o veículo é devolvido), o consultor de serviço, e um ou mais técnicos atribuídos.

Uma ordem de serviço traz duas listas de itens:

- **Service items** — encargos de mão de obra: um nome, quantidade, e taxa, totalizados como o total de mão de obra.
- **Parts** — digitadas em texto livre (uma peça obtida pontualmente, não rastreada contra o estoque), ou adicionadas **buscando no seu estoque real**, o que vincula a linha a um Product real. Uma peça vinculada é o que faz o faturamento realmente deduzi-la do estoque quando a ordem de serviço é faturada; uma peça em texto livre nunca toca o estoque.

Uma ordem de serviço avança através de um funil de status: **Received → Inspection → In Progress → (Waiting Parts, se necessário) → Ready → Delivered**, com Cancelled como um resultado separado. Assim que Ready, um botão **Generate Invoice** fatura a mão de obra e as peças juntas como uma nota fiscal real.

Defina uma data de **próxima manutenção prevista** e/ou uma leitura de odômetro em uma ordem de serviço, e clique em **Remind** para agendar um lembrete real por WhatsApp ao cliente antes dela. Abra a aba **Vehicles** para ver cada veículo distinto que você já atendeu, agrupado por placa com um selo Due Soon/Overdue — clique em **History** em qualquer veículo para seu histórico completo de manutenção agrupado, do mais recente ao mais antigo.

A barra de KPI mostra ordens ativas, ordens prontas para retirada, e ordens entregues neste mês.

## Idioma

Centro Automotivo é um dos 24 modelos de negócio de serviço dedicados do Sarang, e como quase todos eles, sua interface é **apenas em inglês**, independentemente do idioma que você configurou no restante do Sarang.
