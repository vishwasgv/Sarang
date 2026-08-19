# Clínica de Especialista

As telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

## A base de serviço compartilhada

Todo tipo de negócio baseado em serviço no Sarang — incluindo Clínica de Especialista — parte dos mesmos quatro blocos de construção: **Agendamentos** (agendar e programar visitas), um **Catálogo de serviços** (a lista de consultas e procedimentos que seu consultório oferece), **Provider Schedules** (qual especialista está disponível quando), e uma **Notification Queue** automática que cuida dos lembretes sem que você precise enviá-los manualmente. O restante deste capítulo cobre o que é específico de um consultório de especialista.

O Sarang deliberadamente não tem um tipo de negócio separado por especialidade médica (ORL, oftalmologia, dermatologia, cardiologia, e assim por diante). Em vez disso, "Clínica de Especialista" é construída para cobrir **qualquer especialidade** através do mesmo Service Catalog genérico — você define seus próprios tipos de consulta e procedimento com seus próprios preços, e a nota clínica abaixo se adapta para trazer campos específicos de especialista independentemente de qual seja sua especialidade.

## Notas de Consulta com Detalhes de Encaminhamento

Abrir a **Consultation Note** de um agendamento fornece a mesma nota SOAP estruturada usada em todos os tipos de negócio clínicos do Sarang (Patient Information, Subjective, Vitals com sinalização automática, Objective, Assessment, Plan, Follow-up) — veja o capítulo *Clínica de Clínico Geral* para o passo a passo completo campo por campo — mais uma seção **Referral Details** exclusiva de Clínica de Especialista:

- **Referred By** e **Referral Date** — registra quem enviou este paciente a você (um médico externo ou outra clínica) e quando.
- **Referral Reason** — texto livre.
- **Referring Doctor's Phone** e **Referring Doctor's Email** — dados de contato opcionais do médico que encaminhou. São eles que permitem fechar o ciclo: assim que a nota é finalizada, um botão **Share** aparece ao lado de Print Summary e envia ao médico que encaminhou um resumo da visita via WhatsApp ou Email (como PDF), para que ele saiba o que aconteceu com o paciente que enviou. O botão só aparece quando há um médico encaminhador registrado na nota e a nota está finalizada — um rascunho ainda não é um resultado real para enviar. Se deixar o telefone ou o e-mail em branco, a opção de compartilhamento correspondente simplesmente fica desabilitada, não falha.

Isso é separado de **Refer to Another Provider**, uma ação real dentro do aplicativo mais abaixo na mesma tela: assim que a nota é salva, você pode agendar um agendamento de saída real com outro prestador na sua própria clínica (escolha o prestador, data, hora, e um motivo opcional) — este é um agendamento genuíno, não apenas uma anotação. Cada encaminhamento que você envia mostra seu próprio status (Agendado / Concluído / Cancelado / Não Compareceu) bem ali na nota de visita, com um botão **Print Referral Letter** produzindo uma carta formal endereçada ao prestador encaminhado.

Uma caixa de seleção separada **"This is a second-opinion consultation"** na mesma seção sinaliza uma visita em que o paciente já foi diagnosticado ou tratado em outro lugar e veio especificamente para outra opinião — diferente de um encaminhamento, já que uma visita de segunda opinião não exige que alguém o tenha enviado, e um paciente encaminhado não está necessariamente buscando uma segunda opinião. Uma nota marcada mostra um selo **Second Opinion** ao lado do título da nota, e alimenta o relatório de Conversão de Segunda Opinião abaixo.

Um menu suspenso **Case Complexity** logo após a seção Assessment permite marcar uma visita como **Routine** ou **Complex** — deixe sem definir se preferir não classificar uma visita específica; notas não definidas são simplesmente excluídas do relatório de Mix de Complexidade de Casos abaixo, em vez de serem contadas como Rotineiro por padrão.

A nota também traz a mesma tabela detalhada de **Prescription** e o gráfico **Vitals Trend** descritos no capítulo *Clínica de Clínico Geral* — ambos funcionam de forma idêntica aqui.

## Fila de Senhas

Clínica de Especialista também inclui a tela **Fila de senhas** para pacientes sem hora marcada do mesmo dia, exatamente como descrito no capítulo *Clínica de Clínico Geral* — emita senhas para pacientes sem hora marcada, chame o próximo paciente, e acompanhe as contagens de Aguardando / Chamado / Atendido / Pulado. Filas sem hora marcada são tão comuns em consultórios ambulatoriais de especialista (mutirões de ORL, mutirões de oftalmologia, clínicas de dermatologia) quanto na clínica geral.

Uma adição aqui exclusiva da Clínica de Especialista: o formulário **Add Walk-in** tem uma caixa de seleção **"Mark as urgent (referring doctor flagged this as urgent)"**. Uma senha marcada como urgente mostra um selo vermelho **Urgent** na fila e é chamada antes dos pacientes que fizeram check-in mais cedo — **Call Next** sempre escolhe a senha em espera de maior prioridade, primeiro os pacientes urgentes, depois por ordem de chegada. Use isso para um paciente sem hora marcada cujo médico encaminhador sinalizou que o caso precisa ser visto mais rapidamente, não como uma ferramenta de prioridade geral — a maioria dos pacientes sem hora marcada deve seguir a ordem normal de chegada.

## Impressão

**Print Summary** produz um resumo de visita formatado incluindo a seção de encaminhamento quando preenchida, com a mesma isenção de responsabilidade clínica usada em todos os documentos médicos do Sarang: é um documento de conveniência gerado pelo Sarang, não um registro médico validado — sempre verifique antes de uso clínico.

## Relatórios

Abra **Reports → Referral Leaderboard** para ver quais médicos encaminhadores estão enviando mais pacientes para você em um intervalo de datas — uma lista classificada com contagens, além de um gráfico de barras dos dez principais. Este é o mesmo campo real "Referred By" capturado na Nota de Consulta, finalmente agregado em vez de ficar sem uso por nota.

Abra **Reports → Second-Opinion Conversion** para ver, das visitas que você marcou como segunda opinião em um intervalo de datas, quantos desses pacientes voltaram para um agendamento posterior concluído e se tornaram pacientes contínuos — uma contagem total, uma contagem de convertidos, e uma taxa de conversão, além de uma linha por paciente com sua data de visita e (se voltaram) sua próxima data de visita. Apenas pacientes vinculados a um registro de cliente real podem ser rastreados assim; um cliente sem cadastro não é contado de nenhuma forma.

Abra **Reports → Case-Complexity Mix** para ver a divisão entre casos Rotineiros e Complexos em um intervalo de datas — um gráfico de barras empilhadas mês a mês, além do total de casos marcados, as contagens de Rotineiro e Complexo, e a porcentagem geral de Complexo. Somente as visitas em que você definiu o menu Case Complexity são contadas; uma visita não marcada não é considerada Rotineira, ela é simplesmente deixada de fora do mix.

Se você usar **Refer to Another Provider** para enviar um paciente dentro da sua própria clínica, assim que esse profissional finaliza sua própria nota no agendamento de encaminhamento, o resultado aparece automaticamente na sua nota original — sem necessidade de uma busca separada para saber o que aconteceu com um paciente que você encaminhou.
