# Arquiteto

As telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

## A base de serviço compartilhada

Todo tipo de negócio baseado em serviço no Sarang — incluindo Arquiteto — parte dos mesmos quatro blocos de construção: **Agendamentos** (agendar reuniões com clientes), um **Catálogo de serviços** (a lista de serviços e seus preços), **Provider Schedules** (qual membro da equipe está disponível quando), e uma **Notification Queue** automática que cuida dos lembretes sem que você precise enviá-los manualmente. O restante deste capítulo cobre o que é específico de um escritório de arquitetura: um funil de leads, gestão de projetos, controle de horas, e o registro de pranchas.

## Leads

**Leads** é um funil estilo Kanban de clientes em potencial: Aberto → Contatado → Proposta → Ganho → Perdido. Arraste um cartão de lead entre colunas para atualizar seu status, ou adicione um novo lead com nome, dados de contato, empresa, origem (Indicação, Site, Visita Espontânea, Redes Sociais, Ligação Fria, Outro), valor estimado, e um membro da equipe atribuído.

## Projetos

**Service Projects** acompanha cada contrato com cliente do contrato até a conclusão — nome do projeto, tipo, etapa, status (Ativo / Em Espera / Concluído / Cancelado), valor total do contrato, datas de início e término previsto, e um membro da equipe atribuído. Cada projeto pode trazer **marcos** — entregáveis nomeados com seu próprio valor e data de vencimento — e assim que um marco está concluído, gere uma nota fiscal para ele diretamente do projeto.

## Entradas de Tempo

Registre horas faturáveis contra um projeto na tela independente **Controle de horas** — data, equipe, descrição, horas, taxa, e valor calculado — filtrável por equipe, projeto, período, e status de faturamento. Selecione entradas não faturadas e **Gerar Fatura** para faturar diretamente o cliente.

## Registro de Pranchas

O **Registro de desenhos** é o verdadeiro diferencial cotidiano de um escritório de arquitetura: para cada projeto, acompanhe cada prancha que você emite — número da prancha, título, disciplina (Arquitetônica, Estrutural, MEP, Paisagismo, Interiores), número de revisão, status (Rascunho / Emitida para Revisão / Aprovada / Substituída), e data de emissão. Altere o status de uma prancha diretamente da lista conforme ela avança na revisão, e anexe arquivos (os documentos reais da prancha) a cada revisão de prancha.

As pranchas são agrupadas por número de prancha, com a revisão atual mostrada como a linha principal. Clique em **New Revision** para emitir a próxima revisão de uma prancha — o Sarang cria um registro genuinamente novo e separado e marca automaticamente o anterior como Substituída, para que você sempre tenha uma comparação real de Rev A versus Rev B, não apenas um campo que foi sobrescrito. Abra **History** em qualquer prancha para ver todas as revisões anteriores.

Mover uma prancha para **Aprovado** exige registrar quem realmente aprovou — o Sarang solicitará o nome do aprovador se ainda não estiver registrado, e não permitirá que a mudança de status ocorra sem isso. Isso dá a você um rastro genuíno de aprovação do cliente, não apenas um rótulo de status.
