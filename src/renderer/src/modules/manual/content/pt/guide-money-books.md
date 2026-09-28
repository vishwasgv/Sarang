# Guia: o dinheiro e a sua contabilidade

Como o que você faz todos os dias (vender, comprar, pagar, gastar) se transforma na sua contabilidade, e como ler os relatórios. Isto é para os seus próprios registos e planeamento; não substitui o conselho do seu contabilista.

## 1. Como o seu trabalho diário se torna a sua contabilidade

Não precisa de fazer lançamentos contabilísticos para o trabalho normal. O Sarang regista-os por si:

| Você faz isto | O Sarang regista |
|---|---|
| Faz uma venda (fatura) | O que o cliente deve (ou caixa/banco se pago), a receita de venda, e o imposto cobrado |
| Recebe um pagamento | Caixa ou banco sobe, o que o cliente deve desce |
| Recebe stock numa Ordem de compra | O stock e o que deve ao fornecedor sobem |
| Regista uma Fatura de fornecedor | O que deve ao fornecedor sobe; o custo ou o stock é registado |
| Paga a um fornecedor | Caixa ou banco desce, o que deve desce |
| Regista uma Despesa | A despesa sobe, caixa ou banco desce (ou o que deve sobe) |
| Emite uma Nota de crédito ou Nota de débito | A venda ou compra é reduzida, e o saldo também |
| Regista a depreciação de um Ativo fixo | A despesa de depreciação sobe, o valor do ativo desce |
| Um cliente retém TDS ao pagar | A fatura fica liquidada; "TDS a receber" (imposto do qual obterá crédito) sobe em vez de caixa |
| Paga GST ao governo (Contabilidade, Pagamentos GST) | O imposto devido e o crédito de entrada usado descem, caixa ou banco desce |
| Aprova e reembolsa uma despesa de um funcionário | Uma despesa normal é registada e caixa ou banco desce |

Cada lançamento tem dois lados sempre iguais (os débitos igualam os créditos). É por isso que a contabilidade fecha.

## 2. Plano de contas

**Accounting → Chart of Accounts** é a lista de contas usada pela sua contabilidade, em grupos: Ativos (caixa, banco, contas a receber, stock, ativos fixos), Passivos (contas a pagar, imposto a pagar, empréstimos), Capital próprio (o seu capital e os lucros), Receitas e Despesas. O Sarang cria as contas padrão por si. Adicione as suas (por exemplo um novo empréstimo bancário ou uma despesa especial) com **Add Account**.

Clique em **Ledger** em qualquer conta para ver cada lançamento nela (ver secção 5).

## 3. Lançamentos de diário: ajustes que não são uma venda nem uma compra

**Accounting → Journal Entries → New.** Use um lançamento de diário para o que não é uma venda ou compra normal: um saldo de abertura, uma baixa, um proprietário a colocar ou retirar dinheiro, a correção de um lançamento anterior. Adicione linhas, cada uma com uma conta e um débito ou crédito. **O total dos débitos deve igualar o total dos créditos** ou o Sarang não o guardará. Os lançamentos confirmados podem ser estornados (com um motivo), não eliminados, pelo que há sempre um rasto.

Ajudas no formulário de lançamento:

- **Modelos (patterns)**: depois de preencher as contas e o lado de cada uma, guarde o esquema com um nome (por exemplo *Renda mensal*). Da próxima vez escolha-o e escreva apenas os valores. Guardar com um nome existente substitui-o.
- **Estornar automaticamente em**: para um acréscimo (uma despesa registada agora que pertence ao mês seguinte), escolha a data em que o lançamento se deve desfazer sozinho. O Sarang fá-lo na próxima vez que for aberto nessa data ou depois, datado do dia em que corre. Se o período estiver bloqueado, o estorno aguarda.
- **Notas memorando** (secção no fundo de Journal Entries): notas sobre coisas que ainda não são lançamentos contabilísticos, como mercadoria enviada para aprovação. Nunca alteram a sua contabilidade.
- **Teclado**: prima **Enter** no último valor para adicionar uma linha de equilíbrio e **Ctrl + Enter** para confirmar.

## 4. O dinheiro no banco

- **Contas bancárias**: adicione cada conta bancária, depois **Reconcile**: importe ou digite as linhas do extrato bancário e faça-as corresponder ao que o Sarang já registou, para que a sua contabilidade concorde com o banco.
- **Cheques pré-datados**: acompanhe os cheques que deu ou recebeu para uma data posterior.
- **Depósitos bancários**: registe um depósito de dinheiro e cheques no banco.
- **Fecho de caixa** (diário): conte o dinheiro na gaveta e registe qualquer diferença.
- **Regras bancárias** (Accounting → Bank Rules): diga ao Sarang que uma linha de extrato com certas palavras (por exemplo "eletricidade") pertence a uma determinada conta. O ecrã lista as linhas de extrato importadas que correspondem às regras; um clique regista-as nessa conta e marca-as como reconciliadas. As regras nunca correm sozinhas e uma linha confirmada pode ser desfeita a partir do ecrã de reconciliação.
- **Despesas**: registe cada custo do negócio com uma categoria, um fornecedor, e se o imposto é da sua responsabilidade (reverse charge).
- **Reembolso de despesas** (Accounting → Expense Claims): quando a equipa paga algo do próprio bolso, registe o pedido, depois **Approve** (ou **Reject**) e **Repay**. Reembolsar regista uma despesa normal com o método de pagamento que escolher.

## 5. Os relatórios, e como ler cada um

Abra **Reports** e escolha o grupo **Financial**. Escolha um intervalo de datas e execute o relatório. Cada um tem uma linha de resumo, um gráfico e uma tabela; pode imprimir, exportar para Excel ou PDF, ou partilhar.

**Demonstração de resultados (Profit and Loss Statement).** Receitas menos custos num período: faturação, custo das mercadorias vendidas, lucro bruto, despesas por categoria, lucro líquido. *Pergunta que responde:* ganhei dinheiro este mês?

**Como o stock aparece na sua contabilidade.** O Sarang mantém o stock como o Tally e o Zoho Books fazem. As mercadorias compradas numa fatura de fornecedor (ou uma Ordem de compra recebida) entram no ativo **Inventário**, não nas despesas. Ao vender, o custo do que foi vendido sai do Inventário para **Custo das mercadorias vendidas**, usando o custo à data da venda. Uma devolução repõe a mercadoria a esse custo. Serviços numa fatura (frete, renda) são despesas. Uma diferença de contagem de stock, dano ou validade é lançada contra o Custo das mercadorias vendidas. O stock digitado à mão (stock de abertura) é lançado contra o Capital do proprietário. Por isso o Balanço, a demonstração de resultados e o relatório de Vendas contam a mesma história. Se atualizou de uma versão anterior, o seu stock existente foi incorporado na contabilidade uma vez, ao custo, no primeiro arranque; as vendas feitas antes da atualização não têm lançamento de custo das mercadorias vendidas, por isso comece o seu primeiro período de resultados a partir da data da atualização.

**Balanço (Balance Sheet).** O que o negócio possui e deve **numa data**: ativos de um lado, passivos mais o seu capital próprio do outro, e uma linha de controlo que mostra que são iguais. O lucro do período atual é incluído no capital próprio para que feche. Escolha **Compare with** uma data anterior para ver o que mudou. *Pergunta que responde:* quanto vale o meu negócio no papel, e quanto se deve?

**Demonstração de fluxos de caixa (Cash Flow Statement).** De onde veio o dinheiro e para onde foi num período: da exploração do negócio (operacional), da compra ou venda de ativos (investimento), e de empréstimos e dinheiro do proprietário (financiamento), do caixa de abertura ao caixa de fecho. Um selo "reconciled" mostra que o caixa de fecho concorda com as suas contas de caixa e banco. *Pergunta que responde:* sou rentável, então porque não há dinheiro?

**Balancete (Trial Balance).** O total de débito ou crédito de cada conta no período. Se os débitos igualarem os créditos, a contabilidade está equilibrada. Clique em qualquer linha para abrir o razão dessa conta.

**Razão geral (General Ledger).** Escolha uma conta e um intervalo de datas. Obtém o saldo de abertura, cada lançamento com um saldo corrente, e o saldo de fecho, cada um com o documento de origem (uma fatura, uma compra, um pagamento, um lançamento de diário). Faturas e compras ligam diretamente ao documento. Abra-o a partir de **Chart of Accounts → Ledger**, de uma linha do **Trial Balance**, ou da lista de Reports. *Pergunta que responde:* porque é que esta conta mostra este número?

**Livro diário (Day Book).** Cada lançamento por ordem de data, filtrável por tipo (vendas, compras, recebimentos, pagamentos, diários). Totais por dia. *Pergunta que responde:* o que aconteceu neste dia?

**Livro de caixa (Cash Book).** Um registo dia a dia de cada pagamento recebido e cada pagamento ou despesa efetuado, com um saldo corrente.

**Mais relatórios para o seu contabilista e para si** (todos na lista Reports, cada um com um gráfico):

- **Análise de rácios (Ratio Analysis)** (liquidez, dívida, margens, dias de clientes, fornecedores e stock) e **Fluxo de fundos (Fund Flow)** (origens e usos dos fundos).
- **Livro do banco (Bank Book)** e **Resumo de reconciliação bancária**.
- **Resumo de contas a receber** e **Resumo de contas a pagar** (quem deve o quê e o que vence nos próximos 7 dias), **Lucro por artigo** e **Lucro por cliente**, **Ano a ano**.
- **Lucro por categoria de custo** (receitas, despesas e lucro somados pela categoria dada a cada centro de custo) e **Orçamento vs. Real (Budget vs. Actual)**.
- **Despesas por categoria** e **Despesas por fornecedor**, **Registo de ativos fixos**.
- **Registos de Nota de crédito, Nota de débito e Devolução de venda**.
- **TDS retido**, **TDS a receber** e (para negócios com GST) **GST Net Payable & Input Credit**.

Alguns relatórios também podem ser guardados automaticamente numa pasta segundo um horário (Settings → Business Features → Reports saved automatically); isto só funciona enquanto o Sarang está aberto.

## 6. Verificações que vale a pena fazer todos os meses

1. **Trial Balance**: os débitos igualam os créditos.
2. **Balanço**: os ativos igualam os passivos mais o capital próprio.
3. **Reconciliação bancária**: o saldo bancário no Sarang iguala o extrato bancário.
4. **Contas a receber e a pagar**: o relatório Outstanding e o AP Aging Summary concordam com os saldos de clientes e fornecedores.
5. **Valor do stock**: o total do Inventário é razoável face à sua última contagem.
6. Envie a **Demonstração de resultados**, o **Balanço** e o **Tax Report** do mês ao seu contabilista.

## Orçamentos, centros de custo e várias lojas

- **Centros de custo** etiquetam receitas e despesas por departamento ou projeto. Dê a cada centro de custo uma **categoria** (por exemplo Departamento ou Projeto) e **Profit by Cost Category** soma-os.
- **Orçamentos** fixam um valor planeado por mês. Ao lado do seu plano real (o **Base plan**) pode criar **planos hipotéticos**: escolha **New what-if plan**, dê-lhe um nome e suba ou desça cada valor por uma percentagem. **Budget vs. Actual** segue o plano escolhido.
- **Várias lojas ou filiais?** Cada loja mantém o seu próprio Sarang. **Accounting → Branch Summaries** exporta um ficheiro-resumo de cada loja e importa-os num único lugar para que o proprietário veja todas as lojas juntas. Nada sincroniza sozinho.

## Moeda estrangeira

Mantenha uma tabela de taxas de câmbio em **Settings → Business Features → Exchange rates** (adicione taxas à mão ou importe um CSV). Ao fazer uma venda em moeda estrangeira, a taxa mais recente é preenchida. Pagamentos recebidos nessa moeda registam o ganho ou perda cambial.

## 7. Bloquear um período terminado

**Accounting → Ledger Settings** permite-lhe definir uma **data de bloqueio**. Nada com data nela ou antes pode ser adicionado, alterado ou estornado, o que protege os números que o seu contabilista já usou para uma declaração ou auditoria. Defina-a apenas depois de o seu contabilista confirmar o período.

## 8. Fim de ano

**Fixed Assets and Year-End Close** (o seu próprio capítulo) cobre o lançamento da depreciação e o fecho do ano. Após um fecho, os saldos de abertura do novo ano são transportados automaticamente. Os relatórios que mostram um saldo numa data começam a partir do último lançamento de abertura.

## Partilhar a sua contabilidade com o seu contabilista

Crie um acesso para o seu contabilista com o cargo **Accountant**: pode ver relatórios, razões e demonstrações e exportá-los, e não pode alterar nada. Adicione-o em **Settings → Users**. Envie-lhe a Demonstração de resultados, o Balanço e o Tax Report do mês, ou exporte o Trial Balance para ele.

## Perguntas frequentes

**Porque é que o lucro não é igual ao dinheiro que tenho?** O lucro conta vendas ainda não recebidas e compras ainda não pagas. A Demonstração de fluxos de caixa mostra a diferença.

**Porque é que o meu Balanço está desequilibrado?** Nunca deveria estar. Se estiver, não o corrija à mão: verifique se há um bloqueio de período no meio do intervalo, anote a diferença e rastreie-a no Razão geral com o seu contabilista.

**Posso eliminar um lançamento?** Os lançamentos são estornados, não eliminados, para que o registo permaneça completo. Use Void, Cancel, Reverse ou uma Nota de crédito ou débito, conforme o que o ecrã oferecer.
