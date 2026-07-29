# Instituto de Ensino Complementar

## O que está incluído

Instituto de Ensino Complementar é construído sobre a base compartilhada de negócios de serviço do Sarang — agendamentos, um catálogo de serviços, horários de prestadores, e a fila de notificações — mais módulos que juntos cobrem um fluxo de trabalho completo de ensino: **Students**, **Batches** (com uma lista de espera e um rastreador de conteúdo programático), **Attendance**, **Fees**, **Test Scores**, **Performances & Recitals**, e um **Progress Report** voltado para os pais. Este é um dos modelos de negócio mais completos do Sarang, então vale a pena percorrer cada parte.

## Alunos

**Students** é seu livro de matrícula — cada perfil de aluno traz um número de chamada, série/turma, nome da escola, telefone do responsável, data de matrícula, e status ativo/inativo, sobreposto ao mesmo registro de cliente usado em todo o Sarang (para que um aluno que já é cliente seja encontrado por busca de telefone, não duplicado). Desativar um aluno mantém seu histórico; não apaga nada.

Toda linha de aluno tem um **ícone de impressora** — clique nele para gerar um Progress Report imprimível para aquele aluno. Ele é feito para ser entregue a um responsável: lista cada turma em que o aluno está matriculado com sua porcentagem de frequência, todas as notas de provas registradas, e o status de pagamento para cada mês, tudo em uma página.

## Turmas

**Batches** gerencia seus grupos de aula — nome da turma, matéria/curso, instrutor, horário (dias da semana e horário), sala, capacidade máxima, e mensalidade. Matricular um aluno em uma turma pode aplicar um desconto (tipo e valor), o que produz a mensalidade efetiva própria daquele aluno para aquela turma, distinta do preço de tabela da turma.

**Lista de espera.** Assim que uma turma atinge sua capacidade máxima, o botão "Enroll Student" muda para "Join Waitlist" — o aluno ainda é adicionado à turma, apenas com status Em Lista de Espera em vez de Ativo, e não é cobrado até ser promovido. No momento em que uma vaga se abre (um aluno atual é removido, ou você aumenta a capacidade da turma), um ícone verde de promoção aparece ao lado de cada aluno em lista de espera para que você possa movê-lo para Ativo com um clique.

**Conteúdo programático.** Expanda uma turma e abra seu painel Syllabus para construir uma lista de verificação tópico por tópico para aquela turma — adicione tópicos, marque-os conforme os cobre, e uma barra de progresso mostra qual fração do conteúdo programático está realmente concluída. Desmarcar um tópico apaga sua data de conclusão, para que o rastreador sempre reflita o que realmente foi ensinado, não apenas o que foi planejado.

## Frequência

**Attendance** permite escolher uma turma e uma data, depois marcar cada aluno matriculado como presente ou ausente com um único clique (todos são presentes por padrão; desmarque os ausentes, ou use Mark All Present/Absent). Reabrir uma data já registrada carrega o registro existente para que você possa corrigi-lo. Uma folha de frequência imprimível está disponível para a turma e data selecionadas.

## Mensalidades

**Fees** gera os registros de mensalidade de um mês para toda matrícula ativa com um clique, aplicando opcionalmente uma taxa de GST (uma matrícula em lista de espera é ignorada automaticamente — só é cobrada assim que promovida a Ativo). Cada registro mostra o valor devido, o valor recebido, e um status de Pendente, Parcial, Pago, ou Isento, com registros atrasados sinalizados automaticamente assim que sua data de vencimento passa. Você pode marcar uma mensalidade como totalmente paga, editar um pagamento parcial, ou isentá-la completamente, e imprimir um recibo de mensalidade — que inclui um código QR de UPI para qualquer saldo restante onde a cobrança por UPI estiver configurada.

## Notas de Provas

**Test Scores** (em Performance) registra um nome de prova, matéria, nota obtida sobre um máximo, data da prova, e conceito para um aluno específico em uma turma específica. Inserir as notas sugere um conceito automaticamente em uma escala indiana comum de A+ a F, mas o campo de conceito permanece em texto livre — sobrescreva-o ou apague-o se seu instituto avalia de forma diferente. A barra de KPI mostra provas registradas, a média das notas em todas as provas registradas, e quantos resultados ficam abaixo de 50%.

## Apresentações e Recitais

**Performances & Recitals** é um recurso separado de Test Scores — é para agendamentos de eventos e recitais, não notas acadêmicas. Use-o para coisas como uma festa junina anual, um recital de música, ou uma mostra de oratória: registre um nome de apresentação, data, local, e quais alunos matriculados de uma turma estão participando. É uma simples lista de evento, não uma avaliação com nota — combine-o com Test Scores quando uma apresentação também estiver sendo avaliada.

## Idioma

Instituto de Ensino Complementar é um dos 24 modelos de negócio de serviço dedicados do Sarang, e como quase todos eles, sua interface é **apenas em inglês**, independentemente do idioma que você configurou no restante do Sarang.
