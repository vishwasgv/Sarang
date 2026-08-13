# Centros de Custo, Orçamentos e Fluxo de Caixa

## Centros de Custo

Um **Centro de Custo** (`/cost-centres`) é uma marcação — um departamento, filial ou projeto — que você pode associar a uma fatura, uma conta a pagar, uma despesa ou um funcionário para ver o lucro e o gasto detalhados por essa marcação em vez de apenas em nível de toda a empresa. Todo negócio começa com zero centros de custo, então nada disso aparece em nenhum outro lugar até você criar seu primeiro centro de custo com **Novo Centro de Custo** (um nome e um código curto opcional).

Assim que existir pelo menos um centro de custo, um seletor opcional de **Centro de Custo** aparece na tela de finalização da fatura, no formulário de Conta a Pagar, no formulário de Despesa e no formulário de Funcionário — deixe em branco e nada muda; escolha um e cada lançamento contábil criado por aquela transação carrega a mesma marcação. O centro de custo do próprio funcionário também marca automaticamente sua despesa salarial quando a folha de pagamento o marca como pago, de modo que o custo de pessoal se acumula por departamento sem precisar remarcar cada contracheque manualmente.

## Orçamentos

**Orçamentos** (`/budgets`) permite planejar um valor mensal — para um centro de custo específico, uma conta específica ou a empresa inteira — e depois ver como o gasto real se comparou depois que o mês está em andamento. Escolha o mês com as setas no topo, depois **Novo Orçamento** para definir um valor para um escopo: deixe tanto Centro de Custo quanto Conta em branco para um valor de toda a empresa, defina apenas um Centro de Custo para um orçamento de departamento inteiro, ou defina ambos para um escopo mais restrito. A lista mostra Orçado, Real e Variação lado a lado para o mês que você está visualizando — Real é sempre dado real de transação, nunca estimado, então um orçamento contra um centro de custo que ainda não teve nenhum gasto mostra honestamente zero em vez de um vazio.

Você não pode criar dois orçamentos para exatamente o mesmo escopo e período — em vez disso, edite o existente, para que "quanto orçamos para Marketing este mês" sempre tenha uma única resposta.

## Relatório de DRE por Centro de Custo

Em Relatórios, **DRE por Centro de Custo** mostra receita, despesa e margem reais por centro de custo para qualquer intervalo de datas que você escolher, extraídos das mesmas transações marcadas que a tela de Orçamentos lê. Receita e despesa que nunca foram marcadas a nenhum centro de custo são mostradas separadamente como um total "não marcado", em vez de serem omitidas silenciosamente — assim os totais do relatório sempre contabilizam tudo, marcado ou não.

## Resumo de Conformidade Estatutária

O Sarang nunca aplica automaticamente as regras oficiais do governo para PF/ESI/Imposto Profissional — elas mudam a cada notificação governamental, e um número confiantemente errado é pior do que um campo vazio. Em vez disso, se você informar seu próprio % de PF, % de ESI (com um teto salarial opcional) e o valor do Imposto Profissional em **Configurações → Business Profile**, a tela de Folha de Pagamento ganha um link **Sugerir a partir de taxas estatutárias** ao lado da seção de Deduções de cada contracheque. Ele preenche previamente linhas de dedução sugeridas a partir das suas próprias taxas configuradas — você ainda revisa, edita ou remove qualquer linha, e ainda precisa apertar Salvar para que conte. Nada é sugerido para uma taxa que você não configurou.

O relatório **Resumo de Conformidade Estatutária** (em Relatórios) totaliza o que você realmente registrou — cada linha de dedução em cada contracheque do mês, agrupada por nome — como um valor real de responsabilidade do empregador para PF, ESI, Imposto Profissional ou qualquer outra coisa que você tenha nomeado como dedução, seja vinda de uma sugestão ou digitada manualmente.

## Projeção de Fluxo de Caixa

O relatório **Projeção de Fluxo de Caixa** (em Relatórios) mostra um gráfico dia a dia dividido em duas metades que se encontram hoje: uma linha sólida de movimento de caixa **real** do mês passado (dinheiro efetivamente recebido menos despesas e pagamentos a fornecedores efetivamente pagos), e uma linha tracejada de caixa **projetado** para o próximo mês — construída a partir de faturas e contas a pagar em aberto conforme suas próprias datas de vencimento, mais qualquer despesa recorrente programada para vencer nessa janela. É uma visão de planejamento, não uma garantia: apenas documentos com uma data de vencimento real são projetados, e apenas perfis de *despesa* recorrentes são previstos (o valor total futuro exato de uma fatura ou conta a pagar recorrente não é estimado, para evitar um número confiantemente errado).

## Desempenho de Pagamento

O relatório **Desempenho de Pagamento** (em Relatórios) mostra, por cliente, quantos dias levaram de fato para cobrar uma fatura integralmente — medido da data da fatura até a data do seu *último* pagamento, de modo que um cliente que paga em três parcelas só é contado quando realmente terminou de pagar. Faturas que ainda têm saldo aparecem como em aberto em vez de distorcer a média com um pagamento ainda não concluído. Use-o para ver quais clientes pagam rápido de forma confiável e quais consistentemente demoram mais, tanto por cliente quanto como uma média geral.
