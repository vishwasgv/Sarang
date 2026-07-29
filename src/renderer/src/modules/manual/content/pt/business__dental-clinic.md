# Clínica Odontológica

As telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

## A base de serviço compartilhada

Todo tipo de negócio baseado em serviço no Sarang — incluindo Clínica Odontológica — parte dos mesmos quatro blocos de construção: **Appointments** (agendar e programar visitas), um **Service Catalog** (a lista de procedimentos odontológicos e seus preços), **Provider Schedules** (qual dentista está disponível quando), e uma **Notification Queue** automática que cuida dos lembretes sem que você precise enviá-los manualmente. O restante deste capítulo cobre as duas ferramentas específicas de odontologia do Sarang: o odontograma e a agenda de retorno.

## Odontograma

Cada paciente odontológico tem uma aba **Tooth Chart** mostrando um odontograma completo em notação FDI — tanto o arco permanente (adulto) quanto o arco decíduo (dentes de leite/primários), superior e inferior. Clique em qualquer dente para registrar ou atualizar sua condição:

- Condições: Saudável, Cárie, Restaurado, Ausente, Coroa, Ponte (pilar), Implante, Canal, Local de Extração, Fratura — cada uma exibida com sua própria cor no odontograma.
- Para qualquer condição além de Saudável ou Ausente, marque quais **superfícies** estão afetadas (Vestibular, Lingual, Mesial, Distal, Oclusal).
- Adicione notas clínicas em texto livre por dente.

Uma legenda acima do odontograma mostra o que cada cor significa, e você pode **Print Chart** a qualquer momento para uma impressão tabular de cada dente com uma condição registrada (diferente de Saudável) — útil para encaminhamentos ou registros de pacientes.

Clique em **History** em qualquer dente para ver seu registro cronológico completo — cada condição já atribuída a ele, em ordem, não apenas o estado atual. Salvar um dente novamente (digamos, de Cárie para Restaurado após o tratamento) nunca apaga a entrada anterior; ambas permanecem no histórico do dente para que você tenha uma linha do tempo genuína do tratamento daquele dente.

## Planos de Tratamento

A aba **Treatment Plans** da mesma tela do paciente permite construir planos de tratamento detalhados: um título, um status (Proposto / Aceito / Em Andamento / Concluído / Recusado), e uma lista de procedimentos, cada um opcionalmente vinculado a um número de dente específico, com seu próprio custo estimado e um indicador de Pendente/Feito. O custo total estimado do plano é calculado automaticamente a partir de seus itens. Assim que um plano existir, anexe arquivos de apoio a ele — uma radiografia, um formulário de consentimento digitalizado — diretamente da sua visualização de edição.

## Agenda de Retorno

A aba **Recall** (e a tela independente **Recall Schedule**, listando o retorno de cada paciente em toda a clínica) é o sistema de lembretes de retorno odontológico do Sarang — o fluxo cotidiano de "volte para sua limpeza de 6 meses". Para cada paciente, você define:

- **Recall Type** — Higiene 6 Meses, Higiene 12 Meses, Revisão de Coroa, ou Personalizado.
- **Last Visit Date** e **Next Recall Date**.
- Notas opcionais.

A tela Recall Schedule classifica cada paciente em **Overdue**, **Due Soon** (dentro de 7 dias), **This Month** (dentro de 30 dias), ou **Upcoming**, com contagens e selos codificados por cor para cada faixa, para que você sempre saiba a quem ligar em seguida. Um selo "Reminded" aparece assim que um lembrete foi enviado para o retorno daquele paciente.
