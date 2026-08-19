# Clínica Odontológica

As telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

## A base de serviço compartilhada

Todo tipo de negócio baseado em serviço no Sarang — incluindo Clínica Odontológica — parte dos mesmos quatro blocos de construção: **Agendamentos** (agendar e programar visitas), um **Catálogo de serviços** (a lista de procedimentos odontológicos e seus preços), **Provider Schedules** (qual dentista está disponível quando), e uma **Notification Queue** automática que cuida dos lembretes sem que você precise enviá-los manualmente. O restante deste capítulo cobre as duas ferramentas específicas de odontologia do Sarang: o odontograma e a agenda de retorno.

## Odontograma

Cada paciente odontológico tem uma aba **Tooth Chart** mostrando um odontograma completo em notação FDI — tanto o arco permanente (adulto) quanto o arco decíduo (dentes de leite/primários), superior e inferior. Clique em qualquer dente para registrar ou atualizar sua condição:

- Condições: Saudável, Cárie, Restaurado, Ausente, Coroa, Ponte (pilar), Implante, Canal, Local de Extração, Fratura — cada uma exibida com sua própria cor no odontograma.
- Para qualquer condição além de Saudável ou Ausente, marque quais **superfícies** estão afetadas (Vestibular, Lingual, Mesial, Distal, Oclusal).
- Adicione notas clínicas em texto livre por dente.

Uma legenda acima do odontograma mostra o que cada cor significa, e você pode **Print Chart** a qualquer momento para uma impressão tabular de cada dente com uma condição registrada (diferente de Saudável) — útil para encaminhamentos ou registros de pacientes.

Clique em **History** em qualquer dente para ver sua linha do tempo cronológica completa — não apenas suas mudanças de condição, mas também todo procedimento de plano de tratamento que já mencionou esse dente, mesclados em uma única linha do tempo, o mais recente primeiro. Uma entrada de condição mostra a condição e quaisquer notas; uma entrada de tratamento mostra o procedimento e de qual plano ele veio, marcada **Treatment Planned** ou **Treatment Done** conforme o próprio status daquele procedimento. Salvar um dente novamente (digamos, de Cárie para Restaurado após o tratamento) nunca apaga a entrada anterior; ambas permanecem na linha do tempo para que você tenha a história completa daquele dente — o que foi encontrado, o que foi proposto para ele, e o que realmente foi feito.

## Planos de Tratamento

A aba **Treatment Plans** da mesma tela do paciente permite construir planos de tratamento detalhados: um título, um status (Proposto / Aceito / Em Andamento / Concluído / Recusado), e uma lista de procedimentos, cada um opcionalmente vinculado a um número de dente específico, com seu próprio custo estimado e um indicador de Pendente/Feito. O custo total estimado do plano é calculado automaticamente a partir de seus itens. Assim que um plano existir, anexe arquivos de apoio a ele — uma radiografia, um formulário de consentimento digitalizado — diretamente da sua visualização de edição.

Assim que um plano avança além de Proposed (Accepted, In Progress, ou Completed) e ainda não foi faturado, uma ação **Generate Invoice** aparece nele — um clique transforma os procedimentos precificados do plano em uma fatura real para aquele paciente, uma linha por procedimento (marcada por dente onde definido), e o plano então mostra um selo **Billed**. Um plano só pode ser faturado uma vez; um plano ainda em Proposed não pode ser faturado de forma alguma, já que isso assumiria silenciosamente que o paciente já deu seu consentimento.

## Agenda de Retorno

A aba **Recall** (e a tela independente **Agenda de retorno**, listando o retorno de cada paciente em toda a clínica) é o sistema de lembretes de retorno odontológico do Sarang — o fluxo cotidiano de "volte para sua limpeza de 6 meses". Para cada paciente, você define:

- **Recall Type** — Higiene 6 Meses, Higiene 12 Meses, Revisão de Coroa, ou Personalizado.
- **Last Visit Date** e **Next Recall Date**.
- Notas opcionais.

A tela Recall Schedule classifica cada paciente em **Atrasado**, **Due Soon** (dentro de 7 dias), **Este Mês** (dentro de 30 dias), ou **Upcoming**, com contagens e selos codificados por cor para cada faixa, para que você sempre saiba a quem ligar em seguida. Um selo "Reminded" aparece assim que um lembrete foi enviado para o retorno daquele paciente.

Toda vez que você atualiza o retorno de um paciente que já tinha um registrado, o Sarang registra silenciosamente se aquele período de retorno encerrado foi cumprido no prazo — a nova Last Visit Date comparada com a data de retorno que estava vencida antes da sua atualização. Você nunca vê isso diretamente; isso alimenta o relatório de Conformidade de Retorno abaixo.

## Relatórios

Abra **Reports → Treatment Acceptance Rate** para ver quantos dos planos de tratamento que você propôs em um intervalo de datas realmente se tornaram receita faturada — um funil de três estágios (Proposed → Accepted → Billed) como gráfico de barras, além da taxa de aceitação (aceitos ÷ propostos) e a taxa de faturamento (faturados ÷ propostos) em porcentagens. Estes são os mesmos dados reais de planos da aba Treatment Plans, agregados em vez de lidos paciente por paciente — uma leitura rápida de se suas apresentações de caso estão convertendo, e se os planos aceitos estão realmente chegando ao pagamento.

Abra **Reports → Recall Compliance** para ver, dos períodos de retorno encerrados em um intervalo de datas, qual porcentagem de pacientes realmente voltou na data de vencimento ou antes — um único indicador para a porcentagem geral, além de uma divisão por Tipo de Retorno (Higiene 6 Meses, Higiene 12 Meses, Revisão de Coroa, Personalizado). Somente os períodos de retorno genuinamente encerrados (um paciente com um retorno existente recebendo um novo) contam para isso — o primeiríssimo retorno de um paciente não tem uma data de vencimento anterior para comparar, então não é contado de nenhuma forma.
