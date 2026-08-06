# Advogado / Escritório de Advocacia

As telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

## A base de serviço compartilhada

Todo tipo de negócio baseado em serviço no Sarang — incluindo Advogado / Escritório de Advocacia — parte dos mesmos quatro blocos de construção: **Agendamentos** (agendar reuniões com clientes), um **Catálogo de serviços** (a lista de serviços jurídicos e seus preços), **Provider Schedules** (qual advogado está disponível quando), e uma **Notification Queue** automática que cuida dos lembretes sem que você precise enviá-los manualmente. O restante deste capítulo cobre as ferramentas dedicadas do Sarang para um escritório de advocacia: gestão de processos e controle de horas.

## Processos Jurídicos

A tela **Legal Cases** é um espaço de trabalho completo de gestão de processos com três abas:

- **Casos** — cada processo com seu número de processo, título, tribunal, cliente, próxima data de audiência, e status (Ativo / Suspenso / Extinto / Encerrado / Transferido). Adicione um novo processo com número de processo, título, tipo de processo (Cível, Criminal, Família, Empresarial, Imobiliário, Arbitragem, Outro), nome/comarca/estado do tribunal, um ID de processo eCourt opcional (que adiciona um link rápido para o portal de status de processo eCourts), o cliente, o advogado responsável, data de protocolo, e honorário acordado. Os indicadores de KPI no topo mostram Active Cases, Today's Hearings, Hearings in 3 Days, e contagens de Closed/Disposed.
- **Upcoming Hearings** — cada audiência agendada em todos os processos, filtrável em Upcoming / Today / All, com a possibilidade de marcar uma audiência como **Concluído** ou **Adjourn** (registrando um resultado e a próxima data de audiência) diretamente da lista.
- **Time Entries** — cada hora faturável registrada em todos os processos, filtrável em Unbilled / Billed / All, com um total corrente do valor não faturado.

Abrir um processo mostra seu detalhe completo: informações do processo, uma lista corrente de audiências (adicione uma com data, hora, sala do tribunal, e finalidade — Sustentação Oral, Produção de Provas, Fixação de Questões, Sentença, Audiência de Fiança, Decisão Interlocutória, Outro), e suas entradas de tempo. A partir daqui você também pode marcar o processo como **Fechado** ou **Disposed**, anexar documentos do processo (petições protocoladas, ordens judiciais, provas digitalizadas), e definir uma data de prescrição/prazo.

## Verificação de conflito de interesses

Ao criar um novo processo, informe tanto o cliente quanto um **nome da parte contrária**. O Sarang verifica — em ambas as direções — se a parte contrária proposta já é cliente em outro lugar, ou se o cliente proposto foi anteriormente registrado como parte contrária em outro processo. Se qualquer um dos dois for verdadeiro, um banner de aviso aparece no formulário de New Case mostrando o motivo. Essa verificação é apenas consultiva — nunca bloqueia o salvamento do processo — já que uma verificação real de conflito exige seu próprio julgamento profissional, não o de um computador.

## Lembretes de prescrição / prazo

Defina uma **data de prescrição** em um processo (na criação, ou depois no painel de detalhe do processo) para que o Sarang acompanhe seu prazo prescricional ou prazo de protocolo. Você receberá um lembrete automático por WhatsApp 30 dias antes e novamente 7 dias antes da data, dando tempo suficiente para reunir documentos e instruções. Alterar a data cancela os lembretes antigos e agenda novos — você nunca precisa acompanhar isso manualmente.

## Entradas de Tempo

O tempo pode ser registrado tanto de dentro de um processo (na tela Legal Cases) quanto na tela independente **Controle de horas**, que lista cada entrada em todos os processos com data, membro da equipe, descrição, horas, taxa, e valor calculado. Filtre por equipe, período, ou status de faturamento. Selecione uma ou mais entradas não faturadas e clique em **Gerar Fatura** para transformar diretamente as horas registradas em uma nota fiscal real para o cliente — entradas faturadas não podem mais ser editadas ou excluídas, mantendo intacto o rastro de faturamento.
