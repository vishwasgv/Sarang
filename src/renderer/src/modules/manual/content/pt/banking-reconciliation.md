# Bancos e Conciliação

## Contas bancárias e de caixa

Abra **Bank Accounts** na barra lateral e clique em **New Account** para adicionar uma conta nomeada — uma conta bancária real (com nome do banco, número de conta mascarado e IFSC) ou um caixa/gaveta de dinheiro, escolhido através do campo **Account Type**. Isso substitui um único fundo indiferenciado de "dinheiro" por quantas contas reais e distintas o seu negócio realmente tiver — uma conta corrente principal, uma gaveta de troco, o caixa de uma segunda filial — cada uma rastreada separadamente.

Se a conta já tiver dinheiro real no dia em que você a adiciona, insira-o como **Opening Balance**. O Sarang lança um único lançamento de equilíbrio (Débito na conta, Crédito em Owner's Capital) para que o saldo da conta — e os seus livros — estejam corretos desde o primeiro dia, sem começar silenciosamente do zero.

O **Current Balance** de uma conta bancária sempre reflete o saldo real e corrente formado por cada transação lançada nela — pagamentos de faturas creditados nela, faturas de fornecedores pagas a partir dela, cheques compensados através dela, e assim por diante — nunca é um número editado diretamente.

## Importar e conciliar um extrato bancário

Abra uma conta bancária e vá para **Reconciliation**. Clique em **Import Statement** para trazer as linhas do extrato do seu banco — data, descrição, valor de débito ou crédito — as mesmas linhas que o seu extrato bancário (PDF ou CSV) já mostra, inseridas uma única vez, em vez de conferidas a olho contra cada transação no Sarang.

Após importar, clique em **Auto-Match** — o Sarang procura uma transação do Sarang (um Payment, uma Expense, um Supplier Payment, ou uma linha de Journal Entry vinculada ao banco) com o mesmo valor, datada dentro de alguns dias da linha do extrato. Quando existe exatamente uma dessas transações, ela é conciliada automaticamente. Quando mais de uma pode corresponder, ou nenhuma corresponde, a linha é deliberadamente deixada para a sua revisão — um palpite que pode estar errado é pior do que um honesto "precisa de verificação".

Para o que o Auto-Match não resolve, abra a linha e concilie-a manualmente com a transação a que ela realmente pertence, ou deixe-a não conciliada se ela genuinamente não corresponder ainda a nada no Sarang (uma taxa bancária, um crédito de juros). Linhas já conciliadas sempre podem ser desfeitas com **Unreconcile** se foram associadas à linha errada.

O **Reconciliation Summary** no topo da tela mostra o saldo do seu livro ao lado do movimento líquido próprio do extrato, além de quantas linhas estão conciliadas e quantas ainda estão pendentes — a mesma verificação de "o meu livro corresponde ao banco?" que um contador faria manualmente, feita para você.

## Anexar o arquivo real do extrato

O arquivo original do extrato — o PDF ou CSV enviado pelo seu banco — pode ser anexado diretamente à conta através do painel **Documents** na tela de Reconciliation, para que o documento fonte permaneça junto às linhas processadas pelo tempo que você precisar — o mesmo comportamento de anexar/abrir/excluir que qualquer outro documento no Sarang já tem.

## Cheques pré-datados

Abra **Post-Dated Cheques** na barra lateral para acompanhar um registro de cheques — número do cheque, conta bancária vinculada, data de vencimento, valor e direção (Received de um cliente, ou Issued a um fornecedor). Um cheque que você registra começa como **Pending** e ainda não afeta os seus livros — exatamente como funciona um cheque pré-datado real: ainda é uma promessa, não uma transação.

Quando a data do cheque chega e ele realmente é compensado no banco, marque-o como **Cleared** — só então o Sarang lança o pagamento real (Débito ou Crédito em Cash, contra o saldo do cliente ou fornecedor que ele quita). Se voltar sem ser honrado, marque-o como **Bounced**; se for cancelado antes de qualquer um desses resultados, marque-o como **Cancelled**. Ambos são apenas mudanças de status, sem nenhum lançamento financeiro, já que nenhum dos dois chegou a se tornar dinheiro real.
