# Clínica de Clínico Geral

As telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

## A base de serviço compartilhada

Todo tipo de negócio baseado em serviço no Sarang — incluindo Clínica de Clínico Geral — parte dos mesmos quatro blocos de construção: **Agendamentos** (agendar e programar visitas), um **Catálogo de serviços** (a lista de consultas e seus preços), **Provider Schedules** (qual médico está disponível quando), e uma **Notification Queue** automática que cuida dos lembretes sem que você precise enviá-los manualmente. O restante deste capítulo cobre o que é específico de uma clínica de clínico geral: notas de consulta e uma fila de senhas para pacientes sem hora marcada.

## Notas de Consulta (Notas de Visita)

Abrir a **Consultation Note** de um agendamento fornece uma nota clínica estruturada, no formato SOAP:

- **Patient Information** — nome, idade, queixa principal.
- **S — Subjective**: o que o paciente relata (histórico, sintomas, início).
- **Vitals**: pressão arterial (sistólica/diastólica), pulso, temperatura, altura, peso — cada campo é automaticamente sinalizado (Normal / Baixo / Alto) contra uma referência de faixa normal salva assim que você salva, para que leituras fora da faixa se destaquem imediatamente.
- **O — Objective**: achados do exame.
- **A — Assessment**: diagnóstico / impressão clínica.
- **Diagnosis Category** (opcional): uma breve tag de categoria — Infecção, Acompanhamento de Doença Crônica, Lesão, e similares — separada do texto livre de Assessment acima. Marcar isso alimenta **Reports → Diagnosis-Category Trend**, então escolha da lista sugerida ou digite a sua se nenhuma se encaixar.
- **P — Plan**: plano de tratamento, medicamentos, exames solicitados.
- **Follow-up**: uma data de retorno opcional e instruções.

Clique em **Save Note** conforme avança, e depois em **Finalizar** quando a consulta estiver concluída. Uma nota finalizada se torna somente leitura (exibida com um selo de cadeado) — isso protege o registro clínico contra alterações posteriores. Você pode **Print Summary** a qualquer momento para entregar ao paciente (ou manter em seus arquivos) um resumo de visita formatado, que traz uma isenção de responsabilidade clara informando que é um documento de conveniência gerado pelo Sarang, não um registro médico validado — sempre verifique antes de uso clínico.

**Prescription.** Adicione uma receita real como sua própria lista detalhada — nome do medicamento, dosagem, frequência, duração e instruções, uma linha por medicamento — separada do campo de texto livre Plan acima. **Print Prescription** produz um documento de receita (℞) adequado com a tabela detalhada de medicamentos (diferente do resumo geral de visita, este é destinado a servir como uma receita real, então não traz a isenção "não é um registro validado" — só precisa da sua assinatura/carimbo para ser válida).

**Vitals Trend.** Assim que um paciente tiver duas ou mais visitas com sinais vitais registrados, um gráfico de tendência aparece mostrando como uma métrica escolhida (pressão arterial, pulso, temperatura ou peso) se moveu ao longo do tempo — escolha qual métrica plotar na linha de chips acima do gráfico.

**Encaminhando um paciente.** Use "Refer to Another Provider" para agendar uma consulta real com outro profissional — assim que uma existe, **Print Referral Letter** produz uma carta formal endereçada ao médico encaminhado com o motivo do encaminhamento, um documento genuinamente diferente do resumo completo de consulta, feito para o paciente levar consigo. Assim que essa consulta de encaminhamento acontece e sua própria nota é finalizada, a avaliação do profissional encaminhado aparece bem aqui como uma linha de **Outcome** abaixo do encaminhamento, para que você não precise ir procurar a nota dele separadamente para ver o que foi encontrado.

**Resultado de Encaminhamento Externo.** Todos os seus encaminhamentos externos, em um só lugar — abra **Reports → Referral-Out Outcome** e escolha um intervalo de datas. Você verá quantos encaminhamentos fez, quantos já têm um resultado registrado, e quantos ainda estão pendentes, além de uma tabela de cada encaminhamento com seu status e resultado (quando disponível).

**Tendência por Categoria de Diagnóstico.** Toda vez que você marca uma Diagnosis Category em uma nota de consulta, isso alimenta **Reports → Diagnosis-Category Trend** — escolha um intervalo de datas e você verá um gráfico de linhas com uma linha por categoria, mês a mês, além de uma tabela de detalhamento. Isso é separado do próprio texto de Assessment: Assessment é sua nota clínica em texto livre, enquanto a categoria é uma tag curta puramente para identificar padrões ao longo do tempo (ex. "infecções estão aumentando neste trimestre"). Visitas sem categoria marcada ainda contam no seu total de visitas mas não aparecem no gráfico, já que não há nada para agrupá-las.

## Fila de Senhas

A tela **Fila de senhas** gerencia pacientes sem hora marcada do mesmo dia sem precisar de um agendamento pré-reservado. Ela mostra:

- Um grande painel **Now Serving** com o número da senha atual e o nome do paciente.
- Chips de contagem para Aguardando / Chamado / Atendido / Pulado.
- **Add Walk-in** para emitir uma nova senha (nome do paciente, idade, gênero, telefone, notas).
- **Call Next** para chamar a próxima senha em espera.

Cada senha na lista pode ser chamada, marcada como atendida, pulada, ou redefinida para aguardando — a fila se reorganiza automaticamente em seções de "Atualmente Chamado," "Aguardando," e "Concluído." Isso é totalmente separado da lista Appointments pré-reservada — foi feito para a realidade de pacientes que simplesmente chegam e aguardam sua vez.

Para ver quanto do seu dia é de pacientes sem hora marcada versus consultas pré-agendadas, abra **Reports → Walk-in vs. Appointment Ratio** e escolha um intervalo de datas. Isso mostra sua divisão total como uma porcentagem, além de um gráfico de barras dia a dia, para que você saiba rapidamente se sua clínica funciona principalmente com consultas agendadas ou principalmente com pessoas que simplesmente aparecem.

## Lembrete de Condição Crônica

Para pacientes com condições contínuas — diabetes, hipertensão e similares — que precisam de acompanhamento periódico independentemente de reservarem uma nova consulta, a tela **Chronic Recall** (na barra lateral) permite marcar um paciente com uma condição e um cronograma de lembrete, separado de qualquer visita única.

- **Tag Condition** — selecione o paciente, nomeie a condição (condições comuns como Diabetes e Hypertension são sugeridas, mas você pode digitar qualquer condição), opcionalmente registre quando foi diagnosticada, e defina a data desta visita junto com a próxima data de lembrete que deseja que o paciente retorne.
- A lista classifica cada paciente acompanhado em **Overdue**, **Due Soon** (dentro de 7 dias), **This Month**, e **Upcoming** — clique em qualquer paciente para registrar sua visita de acompanhamento real e definir a próxima data de lembrete, da mesma forma que você definiu a primeira.
- Cada vez que você registra um acompanhamento, o Sarang silenciosamente registra se ele ocorreu na data de lembrete prevista ou antes. Com o tempo isso constrói uma **porcentagem de conformidade** real — exibida no topo da tela e no cartão Chronic Recall do seu Dashboard — indicando qual proporção dos lembretes está realmente sendo cumprida, não apenas quantos estão agendados.
- Um paciente pode ser marcado com mais de uma condição ao mesmo tempo (por exemplo, diabetes e hipertensão juntas), cada uma acompanhada e lembrada de forma independente.

Isso é separado da própria data de **Follow-up** única da Nota de Consulta acima — aquela é para "voltar após esta visita específica"; Chronic Recall é para "este paciente tem uma condição contínua que preciso continuar verificando, visita após visita."

Esse mesmo número de conformidade também tem seu próprio relatório dedicado — abra **Reports → Recall Compliance**, escolha um intervalo de datas, e você verá um medidor mostrando qual porcentagem dos lembretes encerrados nesse período foram cumpridos no prazo, além de uma divisão por condição (para você saber, por exemplo, que seus lembretes de diabetes estão em 90% mas a hipertensão está caindo).
