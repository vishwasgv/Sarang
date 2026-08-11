# Ativos Fixos e Encerramento de Fim de Ano

## O registro de Ativos Fixos

Abra **Fixed Assets** na barra lateral e clique em **New Asset** para registrar algo que o seu negócio possui e usa ao longo do tempo — um veículo, equipamento, móveis, um laptop — em vez de algo comprado para revenda. Insira a data de compra, custo, vida útil (em meses), método de depreciação e valor residual (o quanto provavelmente valerá depois de totalmente depreciado, geralmente zero).

Adicionar um ativo aqui não lança um registro de compra próprio — a compra em si já foi registrada por meio de uma Fatura de Fornecedor ou Despesa quando você realmente a comprou. Este registro existe para rastrear o que você possui e depreciá-lo corretamente ao longo do tempo, não para registrar a compra pela segunda vez.

## Executar a depreciação

Abra a tela de detalhes própria de um ativo e clique em **Run Depreciation** para um período. O Sarang suporta dois métodos:

- **Straight-Line** (linha reta) — o mesmo valor em cada período: (custo − valor residual) ÷ vida útil.
- **WDV (Written-Down Value, valor decrescente)** — uma porcentagem decrescente do valor contábil atual do ativo em cada período, de modo que o valor da depreciação é maior no início e diminui com o tempo.

Cada execução lança um Journal Entry real (Débito em Depreciation Expense, Crédito em Fixed Assets) e atualiza a depreciação acumulada do ativo. Executar a depreciação duas vezes para o mesmo período é totalmente bloqueado — o Sarang não permitirá que você a registre duas vezes por acidente.

## Dar baixa em um ativo (Dispose)

Quando você vende, sucateia ou baixa um ativo, abra-o e clique em **Dispose**. Insira a data de baixa e (se vendido) o valor recebido. O Sarang compara isso com o valor contábil atual do ativo e lança a diferença como um ganho ou perda real — uma venda acima do valor contábil é um ganho, abaixo é uma perda — para que a baixa seja refletida corretamente nos seus livros, não apenas marcada como inativa.

## Encerrar o seu ano fiscal

No fim do ano, abra **Ledger Settings** e use **Year-End Close**. Esta é uma ação real e permanente: ela calcula o saldo de cada conta até a data de encerramento, incorpora o resultado líquido do ano (lucro ou prejuízo) em Owner's Capital (a prática contábil padrão de zerar as contas de receita e despesa a cada ano enquanto transfere o que foi realmente ganho ou gasto para o patrimônio), e lança um único lançamento de abertura que transporta cada saldo para o novo ano.

A data de encerramento é então bloqueada automaticamente pelo mesmo mecanismo de Transaction Locking descrito no capítulo Livro Razão e Lançamentos Contábeis — nada no ano encerrado pode ser editado depois, enquanto os dados de cada ano encerrado permanecem totalmente intactos e visíveis, nunca excluídos ou arquivados fora de alcance.

O Year-End Close se recusa a executar novamente em um período já encerrado, e se recusa a executar em um período sem atividade real para transportar — assim, ele nunca é executado duas vezes por acidente, e nunca lança um lançamento vazio ou sem sentido.
