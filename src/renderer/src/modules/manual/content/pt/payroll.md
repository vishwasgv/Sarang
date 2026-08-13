# Folha de Pagamento

Abra **Folha de Pagamento** na barra lateral para gerar, revisar e pagar o salário mensal de cada funcionário — construído sobre os mesmos registros de Funcionários e o histórico de Frequência abordados no capítulo RH deste Manual. Visualizar a lista de folha de pagamento e imprimir um contracheque exigem apenas a permissão **View HR**; gerar a folha de pagamento, editar deduções e marcar um contracheque como pago exigem todos a permissão **Manage HR**.

## Escolhendo um período

Use as setas **◀** / **▶** ao lado do nome do mês para navegar entre os períodos. A folha de pagamento é gerada e acompanhada um mês calendário de cada vez, para cada funcionário ativo.

## Gerando a folha de pagamento

Toque em **Gerar Folha de Pagamento para Este Período** para criar um contracheque em rascunho para cada funcionário ativo que ainda não tenha um para o mês selecionado — executar a operação novamente para o mesmo mês apenas preenche as lacunas, nunca cria um duplicado para alguém que já foi gerado. O **Salário Bruto** de cada contracheque é o Salário Base do funcionário mais seus Adicionais configurados (ambos definidos no próprio registro do funcionário), e quanto desse bruto um funcionário realmente ganha no mês depende do seu Tipo de Salário:

- **Mensal** — o salário bruto completo, não afetado por folgas semanais, feriados ou licenças aprovadas. Só é reduzido por ausência genuína e não justificada: cada dia **Ausente** desconta uma parte proporcional do bruto do mês, e cada **Meio Período** desconta metade disso.
- **Diário** — o Salário Base é tratado como uma taxa diária, pago apenas pelos dias realmente marcados como **Presente** (um Meio Período conta como meio dia) naquele mês, mais os Adicionais mensais fixos.
- **Por Hora** — o Salário Base é tratado como uma taxa por hora, calculada da mesma forma que Diário, mas presumindo um dia de 8 horas para cada dia presente.

Tudo isso é determinado diretamente pelos registros de Frequência daquele funcionário no mês — veja a seção Frequência do capítulo RH para saber como eles são marcados dia a dia.

## Revisando e ajustando um contracheque

Toque na linha de qualquer funcionário para abrir seu contracheque. Ele mostra o Salário Base e cada linha de Adicional somando até o Salário Bruto. Enquanto um contracheque ainda estiver com status **Rascunho**, você pode adicionar **Deduções** — um nome e um valor (PF, ESI, Imposto Profissional e TDS aparecem como botões de adição rápida em um toque sempre que o modelo de imposto do seu negócio estiver definido como GST) — e remover qualquer dedução que você tenha adicionado, com o total de **Salário Líquido** na parte inferior recalculando ao vivo conforme você avança. Toque em **Salvar** para registrar suas alterações na lista de deduções.

O aviso mostrado abaixo da lista de deduções vale a pena ler: o Sarang nunca aplica automaticamente as regras oficiais do governo para PF/ESI/Imposto Profissional — esses valores precisam vir do seu próprio contador ou das regras de folha de pagamento aplicáveis, informados aqui como simples linhas de dedução.

Se você informou seu próprio % de PF, % de ESI (com um teto salarial opcional) e o valor do Imposto Profissional em **Configurações → Business Profile**, um link **Sugerir a partir de taxas estatutárias** aparece ao lado do cabeçalho de Deduções. Tocar nele preenche previamente linhas de dedução calculadas a partir das suas próprias taxas configuradas sobre o Salário Base daquele funcionário — ele substitui qualquer linha existente com o mesmo nome, então executá-lo novamente depois de alterar uma taxa não deixa um duplicado para trás — mas ele nunca salva sozinho; você ainda precisa revisar cada linha sugerida e tocar em **Salvar** você mesmo. Deixe uma taxa em branco nas Configurações e aquele tributo estatutário simplesmente nunca é sugerido.

## Marcando um contracheque como pago

Depois de estar satisfeito com as deduções, escolha um **Método de Pagamento** (Dinheiro, Transferência Bancária, Cheque ou UPI) e toque em **Marcar como Pago**, depois confirme. Isso trava o contracheque — as deduções de um contracheque pago não podem mais ser editadas, e ele agora mostra a data em que foi pago e a forma usada, em vez do editor de deduções.

## Imprimindo um contracheque

Toque no ícone de impressora em qualquer linha da lista, ou em **Imprimir Contracheque** dentro de um contracheque aberto, para gerar um contracheque imprimível para esse funcionário e período — disponível seja o contracheque ainda um rascunho ou já marcado como pago.
