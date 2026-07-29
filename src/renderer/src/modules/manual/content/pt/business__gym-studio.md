# Academia / Estúdio de Fitness

Academia / Estúdio de Fitness é um dos 24 modelos de negócio de serviço específicos do Sarang. Como todo tipo de negócio desse grupo, as telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

Todo modelo de negócio de serviço compartilha a mesma base: **Appointments** para agendamento, um **Service Catalog** do que você oferece e a que preço, **Provider Schedule** para definir o horário de trabalho de cada instrutor e gerar horários realmente reserváveis, e uma **Notification Queue** em segundo plano que envia lembretes de agendamento. Academia/Estúdio adiciona quatro coisas sobre essa base: pacotes de sessões, planos de matrícula, turmas, e comissão da equipe.

## Planos de Matrícula

**Memberships** é construído em torno de planos e check-ins, através de várias abas:

- **All Memberships** — a matrícula de cada membro com status (Ativa, Congelada, Expirada, Cancelada), status de pagamento (Pago, Pendente, Parcial), dias restantes, e sessões usadas. **Freeze** uma matrícula ativa com um motivo (uma pausa real, não apenas uma troca de status) — sua data de término genuinamente avança pelo número de dias que ficou congelada assim que você a **Resume**, para que um membro nunca perca tempo pago. Também cancele uma matrícula e gere sua nota fiscal diretamente desta lista.
- **Expiring Soon** — cada matrícula que vence dentro de uma janela que você escolhe (7/14/30/60 dias), para que você possa entrar em contato para renovação antes que ela expire em vez de depois.
- **Plans** — o catálogo de planos de matrícula que você vende: duração em dias, preço, um número opcional de sessões incluídas (deixe em branco para ilimitado), e uma lista opcional de turmas que o plano cobre.
- **Quick Check-In** — uma tela de busca rápida por nome ou telefone para que a recepção registre a entrada de um membro ativo sem navegar para outro lugar. Abra **Attendance History** em qualquer matrícula para ver seu registro completo de check-ins.

## Turmas (Aulas em Grupo)

Para sessões em grupo conduzidas por instrutor — ioga, Zumba, spinning, e similares — **Group Classes** permite definir uma turma com um instrutor, um horário semanal (escolha os dias e um horário), uma sala/local, uma capacidade, e uma data de início/fim. Cada turma mostra uma barra de capacidade em tempo real (matriculados versus máximo) e fica vermelha assim que lotada. A partir de uma turma você pode:

- **Manage enrollment** — adicionar ou remover membros, bloqueado assim que a turma atinge a capacidade.
- **Mark attendance** — escolher uma data de sessão e marcar quais membros matriculados compareceram; a presença é salva por data e pode ser revisitada depois.

## Pacotes de Sessões

O mesmo mecanismo de sessões pré-pagas usado em todos os setores de serviço do Sarang: um cliente compra um pacote de sessões de uma vez, e **Session Packs** acompanha quantas restam por cliente, sinalizando pacotes que estão acabando ou expirados. Atribua um **instrutor regular** a um pacote e o Sarang pré-preenche esse instrutor automaticamente nos agendamentos futuros do cliente — você ainda pode escolher outra pessoa para uma sessão de substituição pontual, isso é apenas um padrão conveniente, nunca uma obrigação.

## Comissão da Equipe

Quando um agendamento concluído e gerador de receita tem um instrutor associado, o Sarang pode calcular a comissão desse instrutor automaticamente (10% padrão da receita de serviço, com a taxa real de cada membro da equipe configurável no seu registro de Employee). A tela **Commission** fornece um relatório mensal por membro da equipe — receita, comissão, gorjetas, pago versus pendente — mais uma lista de registros filtrável que você pode marcar como paga em massa.
