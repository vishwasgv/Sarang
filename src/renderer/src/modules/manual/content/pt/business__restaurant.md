# Restaurante

Escolher **Restaurante** como seu tipo de negócio durante a configuração ativa quatro coisas além dos recursos universais que todo negócio recebe: **Mesas**, **Comandas de Cozinha (KOT)**, **Receitas** e o rastreamento de estoque de ingredientes. Faturamento, Clientes, Estoque e Relatórios funcionam todos da mesma forma descrita em seus próprios capítulos — este capítulo cobre apenas o que é específico de administrar um restaurante.

## Mesas

Abra **Mesas do Restaurante** na barra lateral para ver todas as mesas configuradas, cada uma exibida como um cartão com seu status atual: **Livre**, **Ocupada** ou **Rsv** (Reservada). Adicione uma mesa com um número de mesa (por exemplo, "T1") e um nome de exibição opcional. Toque em um botão de status no cartão de uma mesa para alterá-lo — uma mesa não pode ser excluída enquanto tiver uma comanda de cozinha ativa. Atribua um **garçom** a uma mesa a partir do seu cartão para sempre saber quem está atendendo; remova a atribuição a qualquer momento.

**End of Day** é um botão nesta tela: ele marca toda mesa ocupada como disponível novamente e mostra um resumo de fechamento em uma linha (KOTs atendidos e a receita do dia), para que você possa encerrar o salão ao final de um turno.

## Gorjeta / taxa de serviço e itens "86"

Na tela de Faturamento, use **Adicionar gorjeta / taxa de serviço** para adicionar uma linha de gorjeta a uma conta sem que ela fique vinculada a nenhum item específico do cardápio nem seja tributada como um produto.

Na tela de Produtos, marque qualquer item do cardápio como **86** (gíria de cozinha para "esgotado por hoje") para ocultá-lo instantaneamente do carrinho de faturamento e do cardápio QR voltado ao cliente, sem desativar o produto em si — perfeito para um prato que esgotou por hoje mas voltará ao cardápio amanhã.

## Comandas de Cozinha (KOT)

Uma KOT é a cópia do pedido que fica com a cozinha. Depois de lançar um pedido em **Faturamento**, abra a nota e toque em **Send to Kitchen** para criar uma KOT para ela. Em **Comandas de Cozinha** na barra lateral, a equipe da cozinha vê todas as comandas agrupadas por status — Pendente, Em Andamento, Pronta, Cancelada — com seus itens e quantidades, e avança cada uma com um único toque (**Iniciar Preparo** → **Marcar como Pronta**), ou **Cancela** a comanda. Cada comanda também pode ser impressa diretamente na impressora da cozinha.

Marcar uma KOT como **Pronta** é o que dispara a dedução do estoque de ingredientes (veja abaixo) e libera a mesa à qual ela pertencia, uma vez que nenhuma outra comanda ativa esteja usando aquela mesa.

## Opções de hardware para a cozinha

Além da tela de Comandas de Cozinha dentro do app, o Sarang oferece três formas de levar as comandas até a equipe da cozinha — as três podem funcionar ao mesmo tempo (imprimir uma comanda em papel, exibir em um monitor de parede e deixar um celular ou tablet controlar não se excluem entre si). Configure-as em **Settings → Appearance**, apenas para negócios do tipo restaurante.

**Kitchen Printer.** Por padrão, a impressão de uma KOT vai para a impressora padrão do Windows. Se sua impressora de cozinha for um dispositivo físico diferente da impressora de recibos do seu balcão de faturamento, selecione-a no menu suspenso **Kitchen Printer** — a partir daí, todo trabalho de impressão de KOT vai direto para lá, sem caixa de diálogo de impressão, sem seleção manual. Deixe em "Use Windows default printer" se você só tiver uma impressora.

**Kitchen Display — second monitor.** Transforma qualquer segundo monitor conectado ao PC de faturamento em um painel de KOT ao vivo, com texto grande (Pending / In Progress / Recently Done), operado com um mouse comum — não é necessária tela sensível ao toque. Em **Kitchen Display — second monitor**, escolha um monitor detectado e toque em **Open Kitchen Display**; ele abre em tela cheia ali e se atualiza automaticamente. Algumas observações sobre a instalação física:
- O mouse só precisa alcançar o PC, não a tela — se a cozinha estiver a mais de alguns metros do PC de faturamento, use um **mouse sem fio** (cujo receptor USB é conectado ao PC de faturamento) em vez de um com fio, já que o cabo de um mouse com fio não vai alcançar.
- O cabo de vídeo do monitor tem o mesmo problema de distância, geralmente pior — um cabo HDMI comum começa a perder sinal depois de cerca de 10-15 metros. Se sua cozinha fica em um cômodo separado ou do outro lado do restaurante (digamos, 10-30m, possivelmente atravessando uma parede), use um **kit extensor HDMI via Ethernet** (um par emissor/receptor barato conectado por um cabo de rede comum) em vez de um único cabo HDMI longo.
- Nas configurações de Vídeo do Windows, certifique-se de que o segundo monitor esteja definido como **Extend these displays**, não Duplicate — é isso que permite que o cursor do seu único mouse se mova até ele.
- Se passar um cabo até essa distância for inviável, use a opção de celular/tablet/laptop abaixo — ela não precisa de nenhum cabeamento.

**Kitchen Display — phone / laptop.** Permite que qualquer celular, tablet ou laptop conectado ao WiFi do seu estabelecimento abra um painel de KOT ao vivo em seu próprio navegador — sem precisar instalar nenhum app; um tablet apoiado na cozinha funciona exatamente como um celular ou laptop aqui. Ative-o em **Kitchen Display — phone / laptop**, depois leia em voz alta o(s) endereço(s) de rede local exibido(s) ou toque em **Show QR code** e peça para o dispositivo escaneá-lo. Isso funciona inteiramente pelo seu próprio WiFi, sem necessidade de internet, e é completamente separado do recurso de pedidos por QR code na mesa voltado ao cliente descrito abaixo (servidor diferente, porta diferente, e um código de acesso aleatório que só é exibido aqui, em Settings — um cliente que escaneia o QR code de pedidos da própria mesa não tem como chegar ao painel da cozinha). Se o acesso precisar ser revogado em algum momento (por exemplo, um celular com o link for perdido), toque em **Regenerate access code** — todo link/QR code compartilhado anteriormente para de funcionar imediatamente.

## Receitas e rastreamento de ingredientes

Abra **Receitas** para vincular um item do cardápio (por exemplo, "Chá Masala") aos ingredientes crus que ele consome e em qual quantidade — busque o produto do cardápio, dê um nome à receita e depois adicione linhas de ingredientes (cada ingrediente só pode aparecer uma vez por receita; combine as quantidades em vez de adicionar uma linha duplicada). A lista de ingredientes de cada receita é exibida expandida na visualização em lista.

Uma vez que uma receita exista para um item do cardápio, concluir sua KOT (marcá-la como Pronta) deduz automaticamente as quantidades de ingredientes da receita × a quantidade pedida do seu estoque normal de produtos — não há um inventário de ingredientes separado para manter. Se o estoque de um ingrediente não puder ser ajustado por algum motivo, o Sarang não deixa a discrepância passar em silêncio: ele emite uma notificação informando qual ingrediente precisa de uma recontagem manual, de modo que os números do seu estoque nunca se desviem sem que você perceba.

Itens do cardápio sem receita configurada simplesmente não deduzem nenhum estoque de ingrediente quando vendidos — as receitas são totalmente opcionais por item.

## Pedidos por QR code na mesa (opcional)

Mesas do Restaurante também tem um alternador **QR Table Ordering**, desativado por padrão. Ative-o e o Sarang inicia um pequeno servidor local na sua própria rede WiFi (sem necessidade de internet), para que os clientes possam escanear o QR code impresso de uma mesa, navegar pelo cardápio e enviar um pedido pelo celular. Nada se torna uma nota real automaticamente — todo pedido recebido aparece em **Incoming Orders** na tela de Comandas de Cozinha, onde a equipe explicitamente **Aceita** (escolhendo uma forma de pagamento, o que cria a nota e a KOT juntas) ou **Rejeita** o pedido. O QR code de cada mesa pode ser gerado e impresso a partir do seu cartão na tela Mesas do Restaurante.

## O que é compartilhado com todo negócio

Faturamento, emissão de notas, pagamentos, Clientes, Produtos, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos. Se você também ativar Logística e Cadeia de Suprimentos em **Configurações → Additional Business Features**, você também obtém Frota, Transportadoras, Remessas, Nota de Recebimento (GRN), Guia de Remessa, Livro de Fretes e Análise de Logística — mas isso não vem ativado por padrão para um restaurante, já que a maioria dos restaurantes não opera sua própria frota de entrega nem recebe remessas formais de fornecedores.
