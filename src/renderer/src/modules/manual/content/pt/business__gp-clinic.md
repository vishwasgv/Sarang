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
- **P — Plan**: plano de tratamento, medicamentos, exames solicitados.
- **Follow-up**: uma data de retorno opcional e instruções.

Clique em **Save Note** conforme avança, e depois em **Finalizar** quando a consulta estiver concluída. Uma nota finalizada se torna somente leitura (exibida com um selo de cadeado) — isso protege o registro clínico contra alterações posteriores. Você pode **Print Summary** a qualquer momento para entregar ao paciente (ou manter em seus arquivos) um resumo de visita formatado, que traz uma isenção de responsabilidade clara informando que é um documento de conveniência gerado pelo Sarang, não um registro médico validado — sempre verifique antes de uso clínico.

**Prescription.** Adicione uma receita real como sua própria lista detalhada — nome do medicamento, dosagem, frequência, duração e instruções, uma linha por medicamento — separada do campo de texto livre Plan acima. **Print Prescription** produz um documento de receita (℞) adequado com a tabela detalhada de medicamentos (diferente do resumo geral de visita, este é destinado a servir como uma receita real, então não traz a isenção "não é um registro validado" — só precisa da sua assinatura/carimbo para ser válida).

**Vitals Trend.** Assim que um paciente tiver duas ou mais visitas com sinais vitais registrados, um gráfico de tendência aparece mostrando como uma métrica escolhida (pressão arterial, pulso, temperatura ou peso) se moveu ao longo do tempo — escolha qual métrica plotar na linha de chips acima do gráfico.

**Cartas de encaminhamento.** Usar a ação existente "Refer to Another Provider" cria um encaminhamento real; assim que um existe, **Print Referral Letter** produz uma carta formal endereçada ao médico encaminhado com o motivo do encaminhamento — um documento genuinamente diferente do resumo completo de consulta, feito para ser entregue ao paciente levar ao especialista.

## Fila de Senhas

A tela **Fila de senhas** gerencia pacientes sem hora marcada do mesmo dia sem precisar de um agendamento pré-reservado. Ela mostra:

- Um grande painel **Now Serving** com o número da senha atual e o nome do paciente.
- Chips de contagem para Aguardando / Chamado / Atendido / Pulado.
- **Add Walk-in** para emitir uma nova senha (nome do paciente, idade, gênero, telefone, notas).
- **Call Next** para chamar a próxima senha em espera.

Cada senha na lista pode ser chamada, marcada como atendida, pulada, ou redefinida para aguardando — a fila se reorganiza automaticamente em seções de "Atualmente Chamado," "Aguardando," e "Concluído." Isso é totalmente separado da lista Appointments pré-reservada — foi feito para a realidade de pacientes que simplesmente chegam e aguardam sua vez.
