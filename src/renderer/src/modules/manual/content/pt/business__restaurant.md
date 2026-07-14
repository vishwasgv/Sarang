# Restaurante

Escolher **Restaurante** como seu tipo de negócio durante a configuração ativa quatro coisas além dos recursos universais que todo negócio recebe: **Mesas**, **Comandas de Cozinha (KOT)**, **Receitas** e o rastreamento de estoque de ingredientes. Faturamento, Clientes, Estoque e Relatórios funcionam todos da mesma forma descrita em seus próprios capítulos — este capítulo cobre apenas o que é específico de administrar um restaurante.

## Mesas

Abra **Mesas do Restaurante** na barra lateral para ver todas as mesas configuradas, cada uma exibida como um cartão com seu status atual: **Livre**, **Ocupada** ou **Rsv** (Reservada). Adicione uma mesa com um número de mesa (por exemplo, "T1") e um nome de exibição opcional. Toque em um botão de status no cartão de uma mesa para alterá-lo — uma mesa não pode ser excluída enquanto tiver uma comanda de cozinha ativa.

**End of Day** é um botão nesta tela: ele marca toda mesa ocupada como disponível novamente e mostra um resumo de fechamento em uma linha (KOTs atendidos e a receita do dia), para que você possa encerrar o salão ao final de um turno.

## Comandas de Cozinha (KOT)

Uma KOT é a cópia do pedido que fica com a cozinha. Depois de lançar um pedido em **Faturamento**, abra a nota e toque em **Send to Kitchen** para criar uma KOT para ela. Em **Comandas de Cozinha** na barra lateral, a equipe da cozinha vê todas as comandas agrupadas por status — Pendente, Em Andamento, Pronta, Cancelada — com seus itens e quantidades, e avança cada uma com um único toque (**Iniciar Preparo** → **Marcar como Pronta**), ou **Cancela** a comanda. Cada comanda também pode ser impressa diretamente na impressora da cozinha.

Marcar uma KOT como **Pronta** é o que dispara a dedução do estoque de ingredientes (veja abaixo) e libera a mesa à qual ela pertencia, uma vez que nenhuma outra comanda ativa esteja usando aquela mesa.

## Receitas e rastreamento de ingredientes

Abra **Receitas** para vincular um item do cardápio (por exemplo, "Chá Masala") aos ingredientes crus que ele consome e em qual quantidade — busque o produto do cardápio, dê um nome à receita e depois adicione linhas de ingredientes (cada ingrediente só pode aparecer uma vez por receita; combine as quantidades em vez de adicionar uma linha duplicada). A lista de ingredientes de cada receita é exibida expandida na visualização em lista.

Uma vez que uma receita exista para um item do cardápio, concluir sua KOT (marcá-la como Pronta) deduz automaticamente as quantidades de ingredientes da receita × a quantidade pedida do seu estoque normal de produtos — não há um inventário de ingredientes separado para manter. Se o estoque de um ingrediente não puder ser ajustado por algum motivo, o Sarang não deixa a discrepância passar em silêncio: ele emite uma notificação informando qual ingrediente precisa de uma recontagem manual, de modo que os números do seu estoque nunca se desviem sem que você perceba.

Itens do cardápio sem receita configurada simplesmente não deduzem nenhum estoque de ingrediente quando vendidos — as receitas são totalmente opcionais por item.

## Pedidos por QR code na mesa (opcional)

Mesas do Restaurante também tem um alternador **QR Table Ordering**, desativado por padrão. Ative-o e o Sarang inicia um pequeno servidor local na sua própria rede WiFi (sem necessidade de internet), para que os clientes possam escanear o QR code impresso de uma mesa, navegar pelo cardápio e enviar um pedido pelo celular. Nada se torna uma nota real automaticamente — todo pedido recebido aparece em **Incoming Orders** na tela de Comandas de Cozinha, onde a equipe explicitamente **Aceita** (escolhendo uma forma de pagamento, o que cria a nota e a KOT juntas) ou **Rejeita** o pedido. O QR code de cada mesa pode ser gerado e impresso a partir do seu cartão na tela Mesas do Restaurante.

## O que é compartilhado com todo negócio

Faturamento, emissão de notas, pagamentos, Clientes, Produtos, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos. Se você também ativar Logística e Cadeia de Suprimentos em **Configurações → Additional Business Features**, você também obtém Frota, Transportadoras, Remessas, Nota de Recebimento (GRN), Guia de Remessa, Livro de Fretes e Análise de Logística — mas isso não vem ativado por padrão para um restaurante, já que a maioria dos restaurantes não opera sua própria frota de entrega nem recebe remessas formais de fornecedores.
