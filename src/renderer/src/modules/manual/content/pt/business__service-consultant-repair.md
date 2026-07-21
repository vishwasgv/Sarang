# Serviço / Consultoria / Reparo

Estes são três dos tipos de negócio originais e de uso geral do Sarang — para qualquer negócio que não se encaixe em um modelo vertical específico, mas que faça trabalho no estilo de projeto, chamado ou reparo: um empreiteiro geral, um consultor autônomo, uma pequena oficina de reparos, uma empresa de suporte de TI e afins. Todos os três executam a interface do Sarang no idioma normalmente escolhido por você (esses três não fazem parte dos 24 modelos específicos de serviço vertical, portanto não há bloqueio de idioma somente em inglês aqui).

Eles compartilham um modelo genérico subjacente — Projetos, Ordens de Serviço, Tickets de Serviço, Controle de Trabalho e Histórico do Cliente — mas cada tipo de negócio ativa uma combinação diferente dele:

- **Service** recebe Projetos, Tickets de Serviço e Controle de Trabalho — um negócio que faz tanto trabalho no estilo de projeto quanto solicitações de suporte pontuais.
- **Consultant** recebe apenas Projetos e Controle de Trabalho, sem Ordens de Serviço nem Tickets de Serviço — uma prática pura de projetos/horas faturáveis.
- **Repair** recebe Ordens de Serviço e Tickets de Serviço, sem Projetos — um negócio construído em torno de itens individuais que os clientes trazem, não engajamentos com múltiplas tarefas.

Todos os três também recebem **Histórico do Cliente**, uma visão unificada de tudo o que está vinculado a um cliente, independentemente de qual desses modelos o produziu.

## Projetos (Service, Consultant)

Um projeto tem um título, prioridade (Baixa/Média/Alta/Urgente), um cliente e responsável opcionais, horas/valor estimados e uma data de vencimento. Ele passa por cinco status — Aberto, Em Andamento, Em Espera, Concluído, Cancelado — que você altera livremente a partir da visualização detalhada do projeto.

Abrir a tela de detalhes de um projeto oferece mais duas coisas:

- **Tarefas** — uma checklist simples que você marca; a lista de projetos mostra uma barra de progresso "concluído / total" calculada a partir disso.
- **Registros de Trabalho** — horas lançadas contra o projeto, cada uma marcada como faturável ou não faturável, com um total corrente exibido tanto na lista quanto na visualização de detalhes.

## Ordens de Serviço (Repair, Service via o modelo genérico)

Uma ordem de serviço é criada para um item físico que um cliente deixa: um título, descrição do item, prioridade, custo estimado e datas de recebimento/previsão/entrega. Ela tem seu próprio ciclo de vida de sete estágios — **Recebido → Diagnosticando → Em Reparo → (opcionalmente Aguardando Peças) → Pronto → Entregue**, ou **Cancelado** a qualquer momento antes da entrega. A tela de detalhes exibe isso como um rastreador visual de estágios e sempre destaca o único próximo botão de ação (por exemplo, "Marcar Em Reparo"), além de uma ação dedicada "Aguardando Peças" enquanto uma ordem está em reparo. Entregar uma ordem de serviço é o momento em que você informa o custo final real, separado da estimativa original — **Gerar Fatura** transforma esse custo final em uma nota fiscal real assim que a ordem for entregue.

Adicione **peças utilizadas** reais a uma ordem de serviço a partir da sua tela de detalhes — busque um produto, defina a quantidade, e o Sarang deduz do seu estoque de verdade (não uma anotação em texto livre); remover uma peça restaura o estoque. Defina um **período de garantia** em dias na entrega, e um selo real de Em Garantia / Vencida passa a ser exibido automaticamente a partir daquele momento. Se o mesmo item voltar por um problema coberto por garantia, inicie uma nova ordem de serviço e vincule-a como uma **reclamação de garantia** contra a original — o status de garantia ao vivo da original aparece diretamente no formulário da nova ordem de serviço.

## Tickets de Serviço (Service, Repair)

Um ticket é uma solicitação de suporte mais leve: título, descrição, prioridade, uma etiqueta de categoria opcional e um cliente/responsável opcionais. Ele passa por **Aberto → Em Andamento → Resolvido → Fechado**, e resolver um ticket permite anexar uma nota de resolução. Tickets urgentes e não resolvidos são destacados com um indicador de bandeira vermelha na lista, para que não fiquem esquecidos. Informe um valor e **Gerar Fatura** para faturar um ticket resolvido.

## Agendamentos e faturamento de Projetos

Todos os três tipos de negócio também recebem **Agendamentos** (reserva, horários de prestadores e lembretes — veja os capítulos de *Faturamento* e os capítulos universais) para agendar reuniões com clientes ou horários de entrega, e um Projeto pode ser faturado diretamente com **Gerar Fatura** assim que estiver pronto, da mesma forma que uma Ordem de Serviço ou um Ticket.

## Controle de Trabalho

Uma planilha de horas única e combinada, cobrindo o que quer que esse tipo de negócio tenha ativado — um Projeto, uma Ordem de Serviço ou um Ticket — mostrando o total de horas, horas faturáveis e horas não faturáveis rapidamente. Toda hora lançada aqui é marcada como faturável ou não, à sua escolha no momento do lançamento, e cada entrada se vincula de volta ao registro contra o qual foi lançada.

## Histórico do Cliente

Para qualquer cliente, uma visão expansível lista toda nota fiscal, projeto, ticket de serviço e ordem de serviço vinculados a ele em um só lugar, cada um exibido com seu próprio status e data — uma forma rápida de responder "o que este cliente já fez conosco antes" sem procurar em telas separadas.
