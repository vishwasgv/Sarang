# Pedidos de Venda e Precificação

## Pedidos de Venda

Um **Pedido de Venda** (`/sales-orders`) é um compromisso de vender — o reflexo do lado de venda de um pedido de compra. Use-o quando um cliente confirmou que quer algo, mas você ainda não vai faturar: as mercadorias não estão prontas para envio, o serviço ainda não começou, ou você está esperando um depósito. Um pedido de venda nunca toca suas contas como uma nota fiscal faz — nada é faturado e nenhum lançamento contábil é feito até você realmente criar uma nota a partir dele.

Crie um com **Novo Pedido de Venda**: escolha um cliente (ou adicione um sem sair do formulário), uma data esperada opcional e itens de linha — cada um um produto real ou um serviço de texto livre, o mesmo seletor de produto-ou-serviço que Faturamento e pedidos de compra já usam.

O pedido de venda se move por **Rascunho → Confirmado → Parcialmente Faturado → Faturado**, ou pode ser **Cancelado** (com um motivo) em qualquer estágio antes de ser totalmente faturado. Clique em **Confirmar Pedido** para travá-lo. A partir de um pedido confirmado, clique em **Criar Nota** — você não precisa faturar o pedido inteiro de uma vez: uma tela de faturamento parcial permite escolher exatamente quanto faturar de cada linha agora, deixando o restante para depois. A tela de detalhes do pedido mantém uma lista atualizada de cada nota criada a partir dele, para que você sempre possa ver quanto do pedido original foi realmente faturado.

## Listas de Preços

**Listas de Preços** (`/pricing/price-lists`) permitem configurar precificação por faixa de quantidade para um cliente ou fornecedor — por exemplo, um cliente atacadista paga menos por unidade ao comprar 50 ou mais unidades de um item. Crie uma lista de preços, escolha se ela se aplica a clientes ou fornecedores, e depois use **Gerenciar Faixas** para configurar a grade de linhas {produto, quantidade mínima, preço}. Atribua uma lista de preços a um cliente ou fornecedor específico a partir do próprio cadastro dele.

Ao determinar o preço de uma linha para um cliente ou fornecedor com uma lista de preços atribuída, o Sarang determina o preço automaticamente: a faixa de melhor correspondência da própria lista de preços vence primeiro, depois recorre ao preço por classe de cliente (a abordagem mais restrita e antiga que alguns negócios já usam) se nenhuma se aplicar, e por fim ao preço de venda ou custo normal do produto se nenhum dos dois se aplicar. Você nunca precisa pensar em qual está "ativo" — o mais específico para aquele cliente ou fornecedor vence.

## Esquemas de Preços

**Esquemas de Preços** (`/pricing/schemes`) são ofertas promocionais avaliadas automaticamente no checkout: **Compre X Leve Y Grátis** (ex.: compre 2, leve 1 grátis), **Desconto por Volume** (ex.: 10% de desconto em 5+ unidades, 15% em 10+, com quantos pontos de corte você quiser), e **Happy Hour / % de Desconto Fixo** (um percentual de desconto fixo sem limite de quantidade — a clássica oferta "16h–18h, 20% de desconto"). Crie um esquema, restrinja-o a um produto ou a uma categoria inteira, defina sua regra, e opcionalmente forneça uma data de início e fim para uma oferta por tempo limitado, um horário de início e fim diário para uma janela estilo happy hour (ex.: 16h00–18h00 — isso não pode atravessar a meia-noite), ou ambos juntos.

No checkout, adicionar um produto ou quantidade elegível ao carrinho mostra uma barra de oferta dispensável com um botão **Aplicar** — aplicar uma oferta Compre-X-Leve-Y-Grátis adiciona a linha grátis para você; aplicar uma oferta de desconto define automaticamente o desconto dessa linha. Estas são sempre apenas sugestões: nada é aplicado até você clicar em Aplicar, e é verificado de forma independente contra as regras reais e atuais do esquema ao criar a nota final — nunca é possível enganar um esquema para reduzir o preço de uma nota.

## Perfis Recorrentes

**Perfis Recorrentes** (`/recurring-profiles`) geram uma nota, uma conta a pagar ou uma despesa em uma programação recorrente — semanal, mensal, trimestral ou anual — para que você não precise recriar manualmente o mesmo documento a cada período. Crie um escolhendo o tipo de documento, preenchendo os mesmos detalhes que você preencheria uma vez em uma nota/conta a pagar/despesa, e definindo a recorrência, a data de início e uma data de término opcional.

O Sarang verifica automaticamente os perfis pendentes enquanto o aplicativo está aberto (aproximadamente uma vez por hora) e cria o documento silenciosamente — você nunca receberá um duplicado para nenhum período, mesmo que o aplicativo estivesse fechado quando o período chegou, porque a próxima verificação vai capturá-lo. Clique em **Pausar** para parar de gerar um perfil sem excluí-lo, ou **Retomar** para reativá-lo. Excluir um perfil só interrompe a geração *futura* — os documentos que já foram criados permanecem exatamente como estão.

## Fluxos de Aprovação

**Fluxos de Aprovação** (`/approval-workflows`, normalmente configurados por um Administrador) exigem aprovação quando o valor total de um pedido de venda ou de compra ultrapassa um limite que você define — útil quando mais de uma pessoa em um negócio pode se comprometer com uma venda ou compra. Um fluxo de trabalho contém uma ou mais **etapas**, cada uma especificando um aprovador (por função, ex. "Gerente", ou por pessoa específica) e o valor mínimo do pedido que aciona essa etapa; uma etapa é silenciosamente ignorada se o valor do pedido não atingir seu limite.

Quando nenhum fluxo de trabalho está configurado — o padrão para cada instalação — pedidos de venda e de compra são confirmados imediatamente como antes; esse recurso é totalmente opcional. Depois que um fluxo de trabalho está ativo, confirmar um pedido elegível o move para **Aprovação Pendente** em vez de confirmá-lo imediatamente, e um painel de aprovação aparece na própria tela de detalhes do pedido, listando cada etapa e quem deve agir. A aprovação ou rejeição acontece a partir desse mesmo painel — rejeitar qualquer etapa rejeita o pedido inteiro, mas um pedido totalmente aprovado completa a confirmação automaticamente. Um fluxo de trabalho sem histórico de aprovação ainda pode ser excluído diretamente; um que já foi usado deve ser desativado, o que preserva seu histórico mas para de se aplicar a novos pedidos.
