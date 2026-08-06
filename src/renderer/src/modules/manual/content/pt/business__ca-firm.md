# Escritório de Contabilidade

As telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

## A base de serviço compartilhada

Todo tipo de negócio baseado em serviço no Sarang — incluindo Escritório de Contabilidade — parte dos mesmos quatro blocos de construção: **Agendamentos** (agendar reuniões com clientes), um **Catálogo de serviços** (a lista de serviços e seus preços), **Provider Schedules** (qual contador/membro da equipe está disponível quando), e uma **Notification Queue** automática que cuida dos lembretes sem que você precise enviá-los manualmente. O restante deste capítulo cobre as ferramentas do Sarang para um escritório de contabilidade: acompanhamento de prazos de conformidade, contratos com clientes, e controle de horas.

## Tarefas de Conformidade

A tela **Tarefas de conformidade** é o rastreador de prazos do seu escritório em todos os clientes — imposto de renda, GST, TDS, arquivamentos ROC/MCA, auditorias, e qualquer outra coisa que você definir. Os indicadores de KPI mostram contagens de Overdue, Due Today, Due in 7 Days, e Filed/Done, para que nada escape.

Adicione uma tarefa escolhendo um cliente, um título, categoria, data de vencimento, prioridade (Baixa/Normal/Alta/Urgente), e opcionalmente atribuindo a um membro da equipe — ou escolha na **Compliance Library** do seu escritório de modelos de eventos recorrentes para preencher automaticamente o título e a categoria. Use **Atualizar** em qualquer tarefa para movê-la através de Pending → In Progress → Filed/Done, registrando a data de protocolo e um número de comprovante assim que for realmente submetida, e anexe o documento realmente protocolado ou o comprovante de recebimento. Uma nota no rodapé da tela lembra que as datas de conformidade mostradas aqui são para sua própria conveniência de acompanhamento e sempre devem ser verificadas contra o calendário legal real.

### Arquivamentos relativos à AGM e listas de verificação de documentos do cliente

Abra **Clients & Checklists** na tela Compliance Tasks para definir a **data da AGM** de um cliente. Assim que definida, o Sarang gera automaticamente as tarefas de arquivamento MGT-7, AOC-4, e ADT-1 com seus prazos legais corretos (60/30/15 dias após a AGM, respectivamente) — você não precisa mais calculá-los e inseri-los manualmente. O próprio arquivamento da AGM ainda precisa ser adicionado manualmente, já que seu próprio prazo depende do agendamento do conselho, não de um deslocamento fixo.

O mesmo modal também contém uma **lista de verificação de documentos** por cliente — acompanhe quais documentos (PAN, Aadhaar, Extrato Bancário, Certificado de GST, ou qualquer item personalizado) foram coletados. Use **Add Standard Checklist** para inserir os 4 itens mais comuns com um clique, depois marque cada um como Collected ou Pending conforme os documentos chegam.

## Contratos

**Contratos de serviço** acompanha relacionamentos contínuos com clientes além de tarefas de conformidade pontuais: retenções, auditorias, trabalho de consultoria, e contratos fiscais. Cada contrato tem um título, tipo, estrutura de honorários (Fixo, Por Hora, ou Retenção Mensal com um dia de faturamento do mês escolhido), datas de início/fim, e status (Ativo / Concluído / Pausado / Encerrado). Os indicadores de KPI mostram Active Engagements, Monthly Retainer Revenue, e Fixed Fee Pipeline. Anexe cartas de contrato e documentos de apoio diretamente do formulário de edição.

Para qualquer contrato ativo com um valor de honorário, **Gerar Fatura** cria uma nota fiscal real para o período de faturamento atual — uma retenção mensal pode ser refaturada a cada mês do calendário (mostra "Invoiced" para o período atual assim que faturada, e reabre automaticamente no mês seguinte).

## Entradas de Tempo

A tela independente **Controle de horas** registra horas faturáveis contra clientes ou projetos — data, equipe, descrição, horas, taxa, valor calculado — filtrável por equipe, projeto, período, e status de faturamento, com indicadores de KPI para Hours This Month, Unbilled Hours, e Unbilled Amount. Selecione entradas não faturadas e **Gerar Fatura** para faturá-las diretamente; assim que faturada, uma entrada não pode mais ser editada ou excluída.
