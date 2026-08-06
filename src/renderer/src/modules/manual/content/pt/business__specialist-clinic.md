# Clínica de Especialista

As telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

## A base de serviço compartilhada

Todo tipo de negócio baseado em serviço no Sarang — incluindo Clínica de Especialista — parte dos mesmos quatro blocos de construção: **Agendamentos** (agendar e programar visitas), um **Catálogo de serviços** (a lista de consultas e procedimentos que seu consultório oferece), **Provider Schedules** (qual especialista está disponível quando), e uma **Notification Queue** automática que cuida dos lembretes sem que você precise enviá-los manualmente. O restante deste capítulo cobre o que é específico de um consultório de especialista.

O Sarang deliberadamente não tem um tipo de negócio separado por especialidade médica (ORL, oftalmologia, dermatologia, cardiologia, e assim por diante). Em vez disso, "Clínica de Especialista" é construída para cobrir **qualquer especialidade** através do mesmo Service Catalog genérico — você define seus próprios tipos de consulta e procedimento com seus próprios preços, e a nota clínica abaixo se adapta para trazer campos específicos de especialista independentemente de qual seja sua especialidade.

## Notas de Consulta com Detalhes de Encaminhamento

Abrir a **Consultation Note** de um agendamento fornece a mesma nota SOAP estruturada usada em todos os tipos de negócio clínicos do Sarang (Patient Information, Subjective, Vitals com sinalização automática, Objective, Assessment, Plan, Follow-up) — veja o capítulo *Clínica de Clínico Geral* para o passo a passo completo campo por campo — mais uma seção **Referral Details** exclusiva de Clínica de Especialista:

- **Referred By** e **Referral Date** — registra quem enviou este paciente a você (um médico externo ou outra clínica) e quando.
- **Referral Reason** — texto livre.

Isso é separado de **Refer to Another Provider**, uma ação real dentro do aplicativo mais abaixo na mesma tela: assim que a nota é salva, você pode agendar um agendamento de saída real com outro prestador na sua própria clínica (escolha o prestador, data, hora, e um motivo opcional) — este é um agendamento genuíno, não apenas uma anotação. Cada encaminhamento que você envia mostra seu próprio status (Agendado / Concluído / Cancelado / Não Compareceu) bem ali na nota de visita, com um botão **Print Referral Letter** produzindo uma carta formal endereçada ao prestador encaminhado.

A nota também traz a mesma tabela detalhada de **Prescription** e o gráfico **Vitals Trend** descritos no capítulo *Clínica de Clínico Geral* — ambos funcionam de forma idêntica aqui.

## Fila de Senhas

Clínica de Especialista também inclui a tela **Fila de senhas** para pacientes sem hora marcada do mesmo dia, exatamente como descrito no capítulo *Clínica de Clínico Geral* — emita senhas para pacientes sem hora marcada, chame o próximo paciente, e acompanhe as contagens de Aguardando / Chamado / Atendido / Pulado. Filas sem hora marcada são tão comuns em consultórios ambulatoriais de especialista (mutirões de ORL, mutirões de oftalmologia, clínicas de dermatologia) quanto na clínica geral.

## Impressão

**Print Summary** produz um resumo de visita formatado incluindo a seção de encaminhamento quando preenchida, com a mesma isenção de responsabilidade clínica usada em todos os documentos médicos do Sarang: é um documento de conveniência gerado pelo Sarang, não um registro médico validado — sempre verifique antes de uso clínico.
