# Eletrônicos

Escolher **Electronics** como seu tipo de negócio ativa o **rastreamento de número de série**, o **rastreamento de IMEI**, o **rastreamento de garantia** e o conjunto de módulos compartilhado de **Logística**. Tudo o mais — Faturamento, Produtos, Clientes, Estoque, Relatórios — funciona exatamente como descrito nesses capítulos; este capítulo cobre o que é específico de uma loja de eletrônicos.

## Rastreamento de Série / Dispositivos

Abra **Rastreamento de Série** (chamado de "Rastreamento de Dispositivos e Série" para Eletrônicos) na barra lateral para registrar unidades de estoque individuais e identificadas de forma única — não apenas "quantas", mas exatamente qual unidade. Adicione um dispositivo por vez com seu produto, número de série, duração da garantia em meses, data de compra e custo, ou use **Importação em Lote** para colar um lote inteiro de números de série de uma vez (um por linha, com colunas de IMEI se aplicável). Cada dispositivo carrega um status — **Disponível**, **Vendido**, **Devolvido** ou **Defeituoso** — que você pode alterar a qualquer momento na lista.

Como um produto rastreado por série representa uma única unidade física, adicioná-lo a um carrinho no Faturamento trava sua quantidade em 1 — você não pode "vender 3" de um número de série específico, apenas vender aquela unidade em si.

## Rastreamento de IMEI

Para celulares e outros dispositivos que carregam IMEI, cada registro de dispositivo também pode ter dois números de IMEI (dual-SIM). Uma caixa dedicada de **Busca por IMEI** na tela de Rastreamento de Série permite buscar instantaneamente um dispositivo pelo IMEI e ver seu status e garantia rapidamente — útil para atendimento pós-venda ou consultas no balcão de reparo.

Se o módulo de Reparo/RMA estiver ativado, a tela de Rastreamento de Série também ganha uma caixa de **Consulta de Serviço** logo abaixo da Busca por IMEI — busque ou escaneie um número de série OU um IMEI e veja tudo sobre aquela unidade em um só lugar: qual produto é, quando e para quem foi vendido (com a fatura e o preço), e seu histórico completo de tickets de reparo. Foi criado exatamente para o momento em que um cliente chega com um dispositivo quebrado e sem nenhum papel — uma única busca lhe diz se ele realmente comprou aqui, quando, e o que já foi feito para consertá-lo. Ask Sarang (se habilitado) também pode responder uma pergunta direta como "buscar o número de série [número]" da mesma forma.

## Rastreamento de garantia

A garantia de cada dispositivo é armazenada como uma duração em meses a partir da sua data de compra/início de garantia, e o Sarang calcula e exibe a data real de vencimento diretamente ao lado dela — mostrada como ainda válida ou claramente marcada como **Vencida** depois que ela passa. O Ask Sarang (se ativado) também pode responder "Quais itens ainda estão na garantia?" diretamente a partir desses dados.

## Ordens de reparo / RMA

Um dispositivo vendido e rastreado por número de série ganha um botão **Reparo** em Rastreamento de Série — abra-o para ver o histórico de atendimento completo daquela unidade, ou iniciar uma nova ordem de reparo para ela. Uma ordem carrega um número de reclamação e avança pelos estágios **Recebido → Diagnosticado → Enviado ao Fornecedor → Aguardando Peças → Reparado/Substituído → Devolvido ao Cliente** (ou Cancelado, somente antes de uma substituição já ter sido de fato enviada). Registre para qual fornecedor você enviou o item e o número de RMA dele próprio, caso esteja saindo para reparo em garantia.

Se a solução for uma troca direta, escolha **Substituído** e selecione uma unidade em estoque do mesmo produto como substituta — o Sarang marca a unidade original como Defeituosa, a substituta como Vendida (herdando a nota fiscal da venda original) e deduz do estoque automaticamente, da mesma forma que qualquer outra venda. Um reparo só pode ser aberto contra uma unidade que tenha realmente sido vendida — um dispositivo em estoque, nunca vendido, ainda não tem histórico de atendimento para rastrear.

No momento em que um ticket passa para **Enviado ao Fornecedor**, o Sarang inicia automaticamente uma contagem de 30 dias — sem nenhum passo extra. Se uma unidade continuar com o fornecedor além desse prazo, é marcada como **Atrasada** diretamente na lista de Tickets de Reparação (com quantos dias realmente já passou), o próprio cabeçalho do ecrã mostra uma contagem contínua de atrasos, e também surge um alerta no Painel — para que uma unidade presa num fornecedor há mais de um mês nunca escape silenciosamente à sua atenção.

Para ter a imagem completa de todas as RMA em aberto, não apenas as atrasadas, abra **Relatórios → Relatório de Antiguidade de RMA**: cada unidade atualmente com um fornecedor, classificada da mais antiga à mais recente, com um gráfico que mostra exatamente há quantos dias cada uma está fora — as que ultrapassam a marca dos 30 dias destacam-se a vermelho.

Quando um ticket de reparo sai para reparo em garantia com um fornecedor, você também pode rastrear o que o fornecedor lhe deve de volta. Dentro da visualização detalhada do ticket, clique em **Registrar Reivindicação** e insira o valor que está reivindicando do fornecedor — o Sarang mantém um total contínuo de Reivindicado / Recuperado / Pendente bem ali. À medida que o fornecedor reembolsa você, seja de uma vez ou em partes, registre cada pagamento com **Registrar Recuperação**; a reivindicação fecha automaticamente assim que o valor recuperado atingir o reivindicado. Se um fornecedor nunca for pagar (por exemplo, rejeitar a reivindicação), use **Baixar** para fechá-la sem recuperação. Cada reivindicação aberta e fechada em todos os tickets é resumida em **Relatórios → Livro de Recuperação de Fornecedores**, com o total pendente entre todos os fornecedores e um gráfico de suas maiores reivindicações não pagas.

Você também pode atribuir um técnico a um ticket de reparo — na entrada quando o cria, ou a qualquer momento depois a partir da visualização detalhada do ticket. Assim que um ticket tem tanto um técnico quanto uma data de entrega concluída, ele entra em **Relatórios → Tempo de Reparo por Técnico**: tempo de reparo médio, mais rápido e mais lento por técnico, com um gráfico classificando-os do mais rápido ao mais lento. É um número real de qualidade de serviço — o tipo que lhe diz em quem confiar para um trabalho urgente, e quem pode precisar de uma ajuda.

## Logística e Cadeia de Suprimentos

Como o modelo padrão de Eletrônicos inclui os módulos de Logística, você também tem **Frota**, **Transportadoras**, **Remessas**, **Nota de Recebimento (GRN)**, **Guia de Remessa**, **Livro de Fretes** e **Análise de Logística** para rastrear seus próprios veículos de entrega e as remessas de fornecedores — veja as telas de Logística sob esses nomes na barra lateral.

## O que é compartilhado com todo negócio

Faturamento, emissão de notas, pagamentos, Clientes, Produtos, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos.
