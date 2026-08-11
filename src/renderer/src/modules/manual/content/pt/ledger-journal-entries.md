# Livro Razão e Lançamentos Contábeis

## O que é lançado automaticamente no livro razão

Toda ação real de movimentação de dinheiro que você já realiza no Sarang — criar uma Fatura, registrar uma Fatura de Fornecedor, receber um Pagamento, pagar um Fornecedor, registrar uma Despesa, compensar um Cheque Pré-Datado, executar a depreciação de Ativos Fixos — agora também lança automaticamente um verdadeiro lançamento contábil equilibrado em partidas dobradas, nos bastidores. Você não precisa fazer nada diferente no dia a dia; é isso que faz o Trial Balance, o Chart of Accounts e os saldos das contas bancárias realmente concordarem entre si, em vez de serem números rastreados separadamente que poderiam silenciosamente divergir.

Cancelar, anular (void) ou reverter qualquer uma dessas mesmas ações lança um verdadeiro lançamento de reversão espelhado, não apenas uma exclusão — assim o livro razão sempre mostra o que realmente aconteceu, incluindo correções, sem reescrever o histórico.

## Chart of Accounts

Abra **Chart of Accounts** na barra lateral para ver as contas com as quais seus livros são construídos — Cash & Bank, Accounts Receivable, Inventory, Fixed Assets, Accounts Payable, Tax Payable, Owner's Capital, Sales Revenue, Cost of Goods Sold, Operating Expenses, e mais algumas — já configuradas para você assim que você usa qualquer coisa desta fase pela primeira vez. Cada uma tem um tipo (Asset, Liability, Equity, Income ou Expense), que determina de que lado do livro razão ela normalmente se posiciona.

Clique em **New Account** para adicionar a sua própria — útil se você quiser uma categoria de despesa ou receita mais específica do que as padrão (por exemplo, dividir "Operating Expenses" em "Rent" e "Utilities" para o seu próprio rastreamento). Suas próprias contas se comportam exatamente como as contas integradas em qualquer outro lugar do livro razão.

## Lançar um lançamento contábil manual

A maioria dos lançamentos é registrada automaticamente conforme descrito acima, mas às vezes você precisa registrar algo manualmente — corrigir uma despesa classificada incorretamente, registrar um ajuste sem movimentação de caixa, ou qualquer lançamento que não corresponda a um dos tipos de transação próprios do Sarang. Abra **Journal Entries** e clique em **New Entry**.

Adicione duas ou mais linhas, cada uma em relação a uma conta, como débito ou crédito — nunca ambos na mesma linha. O Sarang soma as duas colunas enquanto você digita e recusa lançar até que correspondam exatamente — um lançamento que não está equilibrado é rejeitado imediatamente, a mesma disciplina que todo outro registro financeiro no Sarang já segue.

Lançamentos já registrados podem ser revertidos (com um motivo obrigatório) se um deles foi inserido por engano — isso lança um verdadeiro lançamento espelhado em vez de excluir o original, para que a correção em si faça parte do registro permanente.

## Bloqueio de transações (Transaction Locking)

Abra **Ledger Settings** para definir uma **Lock Date** — uma vez definida, nenhuma transação financeira com data nessa data ou anterior (uma Fatura, Fatura de Fornecedor, Pagamento, Pagamento a Fornecedor, Despesa, Lançamento Contábil ou Pedido de Compra) pode ser criada, editada ou anulada em nenhuma parte do aplicativo. Isso é o que mantém um período contábil fechado realmente fechado — depois que você e o seu contador concordam que um mês ou ano é definitivo, a data de bloqueio impede que qualquer pessoa (inclusive você) a altere silenciosamente depois.

## Juros sobre clientes em atraso

Se você cobra juros sobre saldos de clientes vencidos, ative **Credit Interest** em Settings com uma taxa e um tipo Simple ou Compound. Depois, a partir do próprio registro de um cliente, você pode ver os juros realmente acumulados nas faturas vencidas dele — calculados por fatura a partir da data em que ela realmente venceu, não uma estimativa uniforme sobre todo o saldo — e lançá-los como uma cobrança real na conta dele quando estiver pronto para faturar.

## Reverse Charge, Composition Scheme e TDS

- **Reverse Charge (RCM)** — marque uma Fatura de Fornecedor ou Despesa como reverse-charge quando o fornecedor não cobrou GST de você e você está autoavaliando esse imposto no lugar dele. O Sarang mantém o que você realmente deve ao fornecedor separado do imposto que você deve ao governo, e mostra o total do imposto de reverse-charge no relatório de prévia do GSTR-3B.
- **Composition Scheme** — se o seu negócio estiver registrado sob o Composition Scheme (configure em Settings), toda Fatura que você criar automaticamente não terá nenhum GST, e será impressa como um **Bill of Supply** em vez de uma fatura fiscal — de acordo com o que a lei exige, sem que você precise lembrar de zerar o imposto manualmente em cada venda.
- **TDS sobre pagamentos a fornecedores** — ao registrar um pagamento a um fornecedor, marque **Deduct TDS** e o Sarang sugere um valor com base no seu limite e taxa configurados, sempre revisável e ajustável antes de confirmar. O valor retido é rastreado como seu próprio passivo, separado do que foi realmente pago.

## Trial Balance

O relatório **Trial Balance** (em Reports) lê diretamente do verdadeiro livro razão descrito acima — o saldo corrente de cada conta até a data que você escolher, débitos e créditos sempre somando o mesmo total, já que todo lançamento que já foi registrado nele precisou estar equilibrado por si só.
