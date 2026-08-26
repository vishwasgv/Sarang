# Serviço / Consultoria / Reparo

Estes são três dos tipos de negócio originais e de uso geral do Sarang — para qualquer negócio que não se encaixe em um modelo vertical específico, mas que faça trabalho no estilo de projeto, chamado ou reparo: um empreiteiro geral, um consultor autônomo, uma pequena oficina de reparos, uma empresa de suporte de TI e afins. Todos os três executam a interface do Sarang no idioma normalmente escolhido por você (esses três não fazem parte dos 24 modelos específicos de serviço vertical, portanto não há bloqueio de idioma somente em inglês aqui).

Eles compartilham um modelo genérico subjacente — Projetos, Ordens de Serviço, Tickets de Serviço, Controle de Trabalho e Histórico do Cliente — mas cada tipo de negócio ativa uma combinação diferente dele:

- **Serviço** recebe Projetos, Tickets de Serviço e Controle de Trabalho — um negócio que faz tanto trabalho no estilo de projeto quanto solicitações de suporte pontuais.
- **Consultant** recebe apenas Projetos e Controle de Trabalho, sem Ordens de Serviço nem Tickets de Serviço — uma prática pura de projetos/horas faturáveis.
- **Reparo** recebe Ordens de Serviço e Tickets de Serviço, sem Projetos — um negócio construído em torno de itens individuais que os clientes trazem, não engajamentos com múltiplas tarefas.

Todos os três também recebem **Histórico do Cliente**, uma visão unificada de tudo o que está vinculado a um cliente, independentemente de qual desses modelos o produziu.

## Projetos (Service, Consultant)

Um projeto tem um título, prioridade (Baixa/Média/Alta/Urgente), um cliente e responsável opcionais, horas/valor estimados e uma data de vencimento. Ele passa por cinco status — Aberto, Em Andamento, Em Espera, Concluído, Cancelado — que você altera livremente a partir da visualização detalhada do projeto.

Abrir a tela de detalhes de um projeto oferece mais duas coisas:

- **Tarefas** — uma checklist simples que você marca; a lista de projetos mostra uma barra de progresso "concluído / total" calculada a partir disso.
- **Registros de Trabalho** — horas lançadas contra o projeto, cada uma marcada como faturável ou não faturável, com um total corrente exibido tanto na lista quanto na visualização de detalhes.

Tem um **Orçamento** aceito que usa como carta de contratação? Selecione-o no menu suspenso **Converter de Orçamento** ao criar um projeto, e o Sarang vincula os dois — um orçamento só pode se converter em um único projeto, portanto é um registro real de quantas das suas cartas de contratação realmente se tornaram trabalho faturado.

**Consultant** também vê uma **taxa de sucesso de propostas** contínua ao lado da contagem de projetos no cabeçalho — ganhas vs. perdidas vs. orçamentos ainda pendentes, para que você sempre saiba num relance como seu pipeline de cartas de contratação está convertendo, não apenas quantos projetos estão abertos atualmente.

## Ordens de Serviço (Repair, Service via o modelo genérico)

Uma ordem de serviço é criada para um item físico que um cliente deixa: um título, descrição do item, prioridade, custo estimado e datas de recebimento/previsão/entrega. Ela tem seu próprio ciclo de vida de sete estágios — **Recebido → Diagnosticando → Em Reparo → (opcionalmente Aguardando Peças) → Pronto → Entregue**, ou **Cancelado** a qualquer momento antes da entrega. A tela de detalhes exibe isso como um rastreador visual de estágios e sempre destaca o único próximo botão de ação (por exemplo, "Marcar Em Reparo"), além de uma ação dedicada "Aguardando Peças" enquanto uma ordem está em reparo. Entregar uma ordem de serviço é o momento em que você informa o custo final real, separado da estimativa original — **Gerar Fatura** transforma esse custo final em uma nota fiscal real assim que a ordem for entregue.

Adicione **peças utilizadas** reais a uma ordem de serviço a partir da sua tela de detalhes — busque um produto, defina a quantidade, e o Sarang deduz do seu estoque de verdade (não uma anotação em texto livre); remover uma peça restaura o estoque. Defina um **período de garantia** em dias na entrega, e um selo real de Em Garantia / Vencida passa a ser exibido automaticamente a partir daquele momento. Se o mesmo item voltar por um problema coberto por garantia, inicie uma nova ordem de serviço e vincule-a como uma **reclamação de garantia** contra a original — o status de garantia ao vivo da original aparece diretamente no formulário da nova ordem de serviço.

## Tickets de Serviço (Service, Repair)

Um ticket é uma solicitação de suporte mais leve: título, descrição, prioridade, uma etiqueta de categoria opcional e um cliente/responsável opcionais. Ele passa por **Aberto → Em Andamento → Resolvido → Fechado**, e resolver um ticket permite anexar uma nota de resolução. Tickets urgentes e não resolvidos são destacados com um indicador de bandeira vermelha na lista, para que não fiquem esquecidos. Informe um valor e **Gerar Fatura** para faturar um ticket resolvido.

Cada ticket também recebe um **temporizador de SLA** no momento em que é criado, dimensionado conforme sua prioridade (Urgente 4 horas, Alta 24 horas, Média 3 dias, Baixa 7 dias). Um ticket ainda aberto após seu próprio SLA é sinalizado diretamente como **SLA Violado** na lista e na contagem do cabeçalho — um alerta de prazo real, não apenas um rótulo de prioridade.

Um **Orçamento** aceito se transformou em trabalho real? Selecione-o no menu suspenso **Converter de Orçamento** ao criar um ticket, e o Sarang vincula os dois — um orçamento só pode se converter em um único ticket, portanto é um registro real de quantos dos seus orçamentos realmente se tornaram trabalhos faturáveis.

## Contratos de Serviço (Service)

Abra **Contratos de Serviço** na barra lateral para gerenciar um acordo recorrente tipo contrato de manutenção para um cliente recorrente — um valor fixo, faturado conforme um cronograma (Mensal/Trimestral/Semestral/Anual) em vez de renegociado a cada vez. Crie um contrato com seu escopo de trabalho, frequência, data de início e valor, depois clique em **Gerar Fatura** sempre que um período de faturamento vencer — o Sarang rastreia qual período foi faturado por último para que o mesmo período nunca seja faturado duas vezes, a mesma proteção que um contrato de retenção ou manutenção comum já possui em outras partes do Sarang.

## Retenções (Consultant)

Abra **Retenções** na barra lateral para gerenciar um acordo mensal recorrente para um cliente recorrente — taxa fixa, um pacote de horas, ou um escopo baseado em entregáveis, faturado conforme o cronograma que você definir. Para uma retenção de pacote de horas, registre o tempo contra ela em **Controle de Tempo** e o próprio cartão da retenção mostra uma barra de progresso ao vivo de **horas usadas / horas alocadas**, que fica vermelha assim que a cota do mês se esgota — o consumo da retenção num relance, sem necessidade de um relatório separado.

## Relatórios

Quatro relatórios são específicos deste conjunto de segmentos. **Tempo de Resolução por Categoria** detalha quanto tempo os tickets realmente levam para fechar, média/mais rápido/mais lento por categoria — uma métrica real de qualidade de serviço, não apenas uma contagem de status. **Taxa de Negócios Recorrentes** mostra a tendência, mês a mês, de qual parcela dos seus clientes que abrem tickets são recorrentes versus totalmente novos — o sinal de retenção que essa estrutura genérica nunca teve antes. **Taxa de Utilização** (Consultant) é a métrica de consultoria nº 1: horas faturáveis vs. não faturáveis por membro da equipe, ordenadas para mostrar primeiro quem tem menor utilização. **Rentabilidade do Cliente** (Consultant) mostra a receita em relação às horas gastas por cliente, ordenadas da pior para a melhor, para que você possa ver num relance quais clientes realmente valem a pena manter.

## Agendamentos e faturamento de Projetos

Todos os três tipos de negócio também recebem **Agendamentos** (reserva, horários de prestadores e lembretes — veja os capítulos de *Faturamento* e os capítulos universais) para agendar reuniões com clientes ou horários de entrega, e um Projeto pode ser faturado diretamente com **Gerar Fatura** assim que estiver pronto, da mesma forma que uma Ordem de Serviço ou um Ticket.

## Controle de Trabalho

Uma planilha de horas única e combinada, cobrindo o que quer que esse tipo de negócio tenha ativado — um Projeto, uma Ordem de Serviço ou um Ticket — mostrando o total de horas, horas faturáveis e horas não faturáveis rapidamente. Toda hora lançada aqui é marcada como faturável ou não, à sua escolha no momento do lançamento, e cada entrada se vincula de volta ao registro contra o qual foi lançada.

## Histórico do Cliente

Para qualquer cliente, uma visão expansível lista toda nota fiscal, projeto, ticket de serviço e ordem de serviço vinculados a ele em um só lugar, cada um exibido com seu próprio status e data — uma forma rápida de responder "o que este cliente já fez conosco antes" sem procurar em telas separadas.
