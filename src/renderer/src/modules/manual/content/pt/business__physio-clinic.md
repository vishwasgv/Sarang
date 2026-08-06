# Clínica de Fisioterapia

As telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

## A base de serviço compartilhada

Todo tipo de negócio baseado em serviço no Sarang — incluindo Clínica de Fisioterapia — parte dos mesmos quatro blocos de construção: **Agendamentos** (agendar e programar visitas), um **Catálogo de serviços** (a lista de sessões de terapia e seus preços), **Provider Schedules** (qual fisioterapeuta está disponível quando), e uma **Notification Queue** automática que cuida dos lembretes sem que você precise enviá-los manualmente. O restante deste capítulo cobre o que é específico da fisioterapia: notas de consulta com pontuação de dor, fases de tratamento, programas de exercícios domiciliares, e pacotes de sessões.

## Notas de Consulta

Abrir a **Consultation Note** de um agendamento fornece a mesma nota SOAP estruturada usada em todos os tipos de negócio clínicos do Sarang (veja o capítulo *Clínica de Clínico Geral* para os campos básicos), mais dois adicionais específicos de fisioterapia:

- **Pain Score** — uma escala de 0 (nenhuma) a 10 (a pior), inserida como um número ou tocando um botão de seleção rápida.
- **Functional Score** — uma escala de 0-100 (mais alto = melhor função), acompanhando o quão bem o paciente realmente consegue se mover e realizar tarefas, junto com a dor.
- **Treatment Given This Session** — texto livre descrevendo o que foi realmente feito na sessão (por exemplo, terapia por ultrassom, TENS, terapia manual, bandagem).

Assim que um paciente tiver duas ou mais sessões registradas, um gráfico **Vitals Trend** aparece na sua nota — alterne entre os chips Pain Score e Functional Score para ver qualquer um deles plotado ao longo do tempo, para que você e o paciente possam ver o progresso real (ou sua ausência) rapidamente, em vez de folhear notas anteriores.

## Fases de Tratamento

O perfil de cada paciente de fisioterapia tem uma aba **Treatment** acompanhando sua jornada de reabilitação através de fases nomeadas: Avaliação Inicial, Fase Aguda, Sub-Aguda, Reabilitação Ativa, Manutenção, e Alta. Cada fase registra um título, data de início, objetivos, e — assim que você a encerra — uma nota de resultado. Apenas uma fase fica aberta ("ativa") por vez; encerrar uma permite iniciar a próxima, construindo uma linha do tempo clara de como o paciente progrediu.

## Programa de Exercícios Domiciliares (PED)

A aba **Exercise Program** permite construir um Programa de Exercícios Domiciliares imprimível para o paciente: uma lista numerada de exercícios, cada um com um nome, descrição de como executá-lo, e séries/repetições/tempo de sustentação/frequência. **Print HEP** produz um material formatado com o timbre da clínica e uma linha de assinatura, e registra quando foi impresso pela última vez.

## Pacotes de Sessões

A aba **Pacotes de sessões** acompanha pacotes pré-pagos de sessões (por exemplo, "Pacote de Fisioterapia de 10 sessões"): nome do pacote, total de sessões, preço, taxa de GST, datas de compra e vencimento. Um pacote ativo mostra uma barra de progresso das sessões restantes, e cada agendamento concluído contra esse pacote deduz uma sessão automaticamente. Assim que um pacote tiver um preço, você pode **Gerar Fatura** para ele diretamente desta tela — isso só é oferecido uma vez, e marca o pacote como "Invoiced" depois, para que nunca seja faturado duas vezes.
