# Autoescola

Autoescola é um dos 24 modelos de negócio de serviço específicos do Sarang. Como todo tipo de negócio desse grupo, as telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

Todo modelo de negócio de serviço compartilha a mesma base: **Agendamentos** para agendamento, um **Catálogo de serviços**, **Agenda do prestador** para os horários de trabalho da equipe, e uma **Notification Queue** em segundo plano para lembretes. Autoescola adiciona sua própria tela dedicada — com cinco abas — para as partes de administrar uma autoescola que não se encaixam em um agendamento genérico: perfis de alunos, aulas práticas, veículos, exames, e pacotes.

## Alunos

Escolha qualquer cliente existente na lista de busca à esquerda para abrir seu **perfil de aluno** à direita: categoria de habilitação (LMV, HMV, duas rodas, ou uma combinação), uma categoria de veículo preferida, número de solicitação de CNH, número da permissão de aprendizagem e data de emissão, e número da habilitação definitiva e data de emissão assim que aprovado. Este é o registro de conformidade que uma autoescola precisa para acompanhar o progresso de um aluno desde a permissão de aprendizagem até a habilitação completa.

## Aulas Práticas

Cada aula de direção individual é agendada com um aluno, um instrutor, um veículo ativo, uma data/hora, uma duração, e um ponto de embarque opcional. O status de uma aula avança através de **Scheduled → Completed** (ou **No Show**). Assim que concluída, você pode ou:

- inserir uma **taxa da sessão** e gerar uma nota fiscal avulsa apenas para aquela aula, ou
- resgatá-la contra um **pacote** que o aluno já comprou (veja Pacotes abaixo), caso em que não há nota fiscal separada — é marcada como "Via package" em vez disso.

A aba Sessions filtra por Hoje, Todas, Agendadas, ou Concluídas.

## Veículos

A própria frota de veículos de instrução da escola: número de placa, marca/modelo, categoria de veículo (LMV, duas rodas, HMV), um instrutor atribuído, e um status (Ativo, Manutenção, Aposentado). Apenas veículos marcados como Ativo podem ser escolhidos ao agendar uma nova aula.

Defina um **intervalo de manutenção** em um veículo — por número de aulas ou por distância no odômetro — e o Sarang o sinaliza como Due for Service assim que qualquer um dos dois limites for ultrapassado, com base em aulas realmente concluídas e na leitura do odômetro que você registra. Abra **Manutenção** em um veículo para registrar um serviço concluído (odômetro, tipo de serviço, custo) e ver seu histórico completo de manutenção.

## Exames

Acompanha os agendamentos reais de exame de um aluno — exame da permissão de aprendizagem ou exame de direção — com uma data de exame, centro de exame, e um resultado: Pendente, Aprovado, ou Reprovado, com uma data de reexame opcional se não passar na primeira vez. Registre qual **instrutor** ensinou o aluno, e um cartão de resumo **Pass Rate by Instructor** mostra o histórico real de aprovações/reprovações de cada instrutor.

## Pacotes

O padrão de faturamento mais comum de uma autoescola é vender um pacote de N aulas de uma vez em vez de faturar aula por aula. **Pacotes** tem duas partes:

- **Package Catalog** — defina o nome de um pacote, o número total de aulas, preço, e a qual categoria de veículo ele se aplica.
- **Learner Enrollments** — matricule um aluno em um pacote, acompanhe as aulas usadas contra o total, e gere a nota fiscal do pacote uma única vez (um pacote é faturado como um todo, não por aula). Cada aula agendada contra essa matrícula é deduzida automaticamente da sua contagem restante em vez de precisar de sua própria taxa ou nota fiscal.
