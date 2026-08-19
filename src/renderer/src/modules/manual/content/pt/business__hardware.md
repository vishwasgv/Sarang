# Ferragens

Escolher **Ferragens** como seu tipo de negócio ativa a **precificação por área**, a **imposição de limite de crédito** e o conjunto de módulos compartilhado de **Logística**. Tudo o mais — Faturamento, Produtos, Clientes, Estoque, Relatórios — funciona exatamente como descrito nesses capítulos; este capítulo cobre o que é específico de uma loja de ferragens.

## Precificação por área (calculadora comprimento x largura)

Lojas de ferragens frequentemente vendem produtos precificados por pé/metro quadrado — azulejos, chapas, vidro, compensado — em que o cliente não sabe a área de cabeça. Em **Faturamento**, toda linha do carrinho de um negócio de Ferragens mostra um pequeno botão **Área** ao lado do seu controle de quantidade. Ao tocá-lo, abre-se uma calculadora de comprimento por largura: informe as duas dimensões, e o Sarang calcula a área e define isso diretamente como a quantidade da linha, na unidade em que o produto é vendido. Isso não muda como o produto é precificado — é uma calculadora de conveniência que preenche a quantidade correta, para que você não precise de uma calculadora separada no balcão. A mesma calculadora está disponível ao montar uma **Cotação**, de modo que um orçamento precificado por área fica tão fácil de montar quanto uma venda ao vivo.

Se você tiver permissão para ver os números de lucro, a calculadora também mostra uma **prévia de margem** ao vivo assim que ambas as dimensões forem preenchidas — o percentual de margem exato que esta linha vai gerar na área calculada e no preço atual da linha, codificado por cor (verde/âmbar/vermelho) para que você identifique uma margem baixa ou negativa antes de confirmar a venda. Um caixa sem permissão para ver lucros nunca vê essa linha, da mesma forma que os números de margem são ocultados dele em qualquer outro lugar do Sarang.

## Conversão de unidade caixa/pacote

Se você compra em caixas mas vende por peça, ative o **faturamento por pacote** para um produto e defina quantas peças há em um pacote. Ao receber estoque, o Ajuste de Estoque oferece um modo de entrada "pacotes recebidos" — informe o número de pacotes/caixas e o Sarang calcula a quantidade equivalente de peças para você. Tudo o mais (faturamento, alertas de estoque baixo, avaliação) continua funcionando em peças como de costume; isso só muda a forma como você *registra a entrada* de estoque recém-recebido.

Dois lugares leem esse mesmo tamanho de caixa para lhe dar um número mais inteligente, ciente da caixa, em vez de uma simples contagem de peças. Em **Relatórios → Relatório de Estoque**, o estoque de um produto faturado por pacote mostra as duas formas juntas — ex. "100 (4 caixas + 4 unidades)" — para que você veja rapidamente se está reduzido a unidades soltas de uma caixa aberta, sem fazer a divisão você mesmo. E quando você usa **Estoque → Gerar Pedidos de Reposição** para um produto faturado por pacote que caiu abaixo do seu nível de reposição, a quantidade sugerida é automaticamente arredondada para cima até um número inteiro de caixas — um fornecedor vende caixas inteiras, não uma contagem fracionária de peças, então um rascunho pedindo "37 unidades" nunca foi realmente pedível como estava escrito.

## Baixa por dano / quebra

Ao ajustar o estoque para baixo por dano real ou quebra, em vez de uma correção de rotina, escolha **Dano** como a categoria de motivo no formulário de Ajuste de Estoque. Isso registra o caso de forma distinta de um ajuste genérico, para que o histórico de Movimentações de Estoque e os relatórios consigam diferenciar perdas por quebra de correções de estoque comuns.

## Imposição de limite de crédito

Lojas de ferragens frequentemente vendem para empreiteiros e empresas regulares em condições de crédito (pagamento posterior). Defina um **limite de crédito** para um cliente a partir do seu registro em **Clientes**, e o Sarang bloqueará qualquer nova venda a *crédito* que faça o saldo pendente dele ultrapassar esse limite — a nota é rejeitada diretamente no momento de salvar, com uma mensagem mostrando o saldo pendente atual, o valor da nova nota e o limite dele, em vez de ser permitida silenciosamente e só percebida depois. Essa verificação se aplica apenas a vendas pelo método Crédito; vendas em Dinheiro, UPI, Cartão e Divididas (pagas integralmente de imediato) nunca são afetadas. Um limite de crédito de 0 significa que nenhum limite é imposto para aquele cliente.

É exatamente assim que funciona a **conta corrente** de um empreiteiro no dia a dia: cada venda a crédito soma ao saldo dele assim que acontece — sem necessidade de configurar uma "conta corrente" separada. Quando chegar a hora de acertar as contas, abra **Relatórios → Extrato do Cliente**, procure o empreiteiro, e escolha o intervalo de datas que deseja faturar (um mês, ou qualquer outro período) — isso gera um extrato completo com saldo inicial, cada transação em ordem, saldo final, e um gráfico de tendência do saldo, já detalhado por item e totalizado, pronto para entregar ou exportar como PDF.

## Matriz de giro rápido vs. lento

Em **Relatórios → Matriz de Produtos de Giro Rápido vs. Lento**, cada produto vendido no período escolhido é plotado como um ponto — quão rápido está vendendo (unidades por dia) em um eixo, e sua porcentagem de margem no outro. As linhas tracejadas marcam a velocidade mediana e a margem mediana desse período, dividindo o gráfico em quatro quadrantes: giro rápido com boa margem, giro rápido mas margem baixa, giro lento mas que vale a pena manter pela margem, e giro lento com margem baixa também — geralmente os candidatos mais claros para descontinuar ou liquidar. A tabela abaixo do gráfico lista cada produto com sua velocidade, margem e quadrante exatos, para que você nunca precise apenas adivinhar olhando os pontos.

## Logística e Cadeia de Suprimentos

Como o modelo padrão de Ferragens inclui os módulos de Logística, você também tem **Frota**, **Transportadoras**, **Remessas**, **Nota de Recebimento (GRN)**, **Guia de Remessa**, **Livro de Fretes** e **Análise de Logística** para rastrear seus próprios veículos de entrega e as remessas de fornecedores — veja as telas de Logística sob esses nomes na barra lateral.

## O que é compartilhado com todo negócio

Faturamento, emissão de notas, pagamentos, Clientes, Produtos, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos.
