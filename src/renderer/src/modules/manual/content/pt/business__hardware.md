# Ferragens

Escolher **Ferragens** como seu tipo de negócio ativa a **precificação por área**, a **imposição de limite de crédito** e o conjunto de módulos compartilhado de **Logística**. Tudo o mais — Faturamento, Produtos, Clientes, Estoque, Relatórios — funciona exatamente como descrito nesses capítulos; este capítulo cobre o que é específico de uma loja de ferragens.

## Precificação por área (calculadora comprimento x largura)

Lojas de ferragens frequentemente vendem produtos precificados por pé/metro quadrado — azulejos, chapas, vidro, compensado — em que o cliente não sabe a área de cabeça. Em **Faturamento**, toda linha do carrinho de um negócio de Ferragens mostra um pequeno botão **Área** ao lado do seu controle de quantidade. Ao tocá-lo, abre-se uma calculadora de comprimento por largura: informe as duas dimensões, e o Sarang calcula a área e define isso diretamente como a quantidade da linha, na unidade em que o produto é vendido. Isso não muda como o produto é precificado — é uma calculadora de conveniência que preenche a quantidade correta, para que você não precise de uma calculadora separada no balcão. A mesma calculadora está disponível ao montar uma **Cotação**, de modo que um orçamento precificado por área fica tão fácil de montar quanto uma venda ao vivo.

## Conversão de unidade caixa/pacote

Se você compra em caixas mas vende por peça, ative o **faturamento por pacote** para um produto e defina quantas peças há em um pacote. Ao receber estoque, o Ajuste de Estoque oferece um modo de entrada "pacotes recebidos" — informe o número de pacotes/caixas e o Sarang calcula a quantidade equivalente de peças para você. Tudo o mais (faturamento, alertas de estoque baixo, avaliação) continua funcionando em peças como de costume; isso só muda a forma como você *registra a entrada* de estoque recém-recebido.

## Baixa por dano / quebra

Ao ajustar o estoque para baixo por dano real ou quebra, em vez de uma correção de rotina, escolha **Dano** como a categoria de motivo no formulário de Ajuste de Estoque. Isso registra o caso de forma distinta de um ajuste genérico, para que o histórico de Movimentações de Estoque e os relatórios consigam diferenciar perdas por quebra de correções de estoque comuns.

## Imposição de limite de crédito

Lojas de ferragens frequentemente vendem para empreiteiros e empresas regulares em condições de crédito (pagamento posterior). Defina um **limite de crédito** para um cliente a partir do seu registro em **Clientes**, e o Sarang bloqueará qualquer nova venda a *crédito* que faça o saldo pendente dele ultrapassar esse limite — a nota é rejeitada diretamente no momento de salvar, com uma mensagem mostrando o saldo pendente atual, o valor da nova nota e o limite dele, em vez de ser permitida silenciosamente e só percebida depois. Essa verificação se aplica apenas a vendas pelo método Crédito; vendas em Dinheiro, UPI, Cartão e Divididas (pagas integralmente de imediato) nunca são afetadas. Um limite de crédito de 0 significa que nenhum limite é imposto para aquele cliente.

## Logística e Cadeia de Suprimentos

Como o modelo padrão de Ferragens inclui os módulos de Logística, você também tem **Frota**, **Transportadoras**, **Remessas**, **Nota de Recebimento (GRN)**, **Guia de Remessa**, **Livro de Fretes** e **Análise de Logística** para rastrear seus próprios veículos de entrega e as remessas de fornecedores — veja as telas de Logística sob esses nomes na barra lateral.

## O que é compartilhado com todo negócio

Faturamento, emissão de notas, pagamentos, Clientes, Produtos, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos.
