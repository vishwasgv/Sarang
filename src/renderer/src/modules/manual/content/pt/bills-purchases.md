# Faturas e Pagamentos Efetuados

## O que é uma Fatura, e em que difere de uma Ordem de Compra

Uma **Ordem de Compra** é o que você *encomendou* a um fornecedor. Uma **Fatura** é o que ele realmente lhe *faturou* — os dois documentos estão relacionados, mas não são a mesma coisa. Você pode registar uma fatura sem nunca ter emitido uma ordem de compra (o caso comum de uma fatura de subcontratado, uma fatura de aluguer, ou qualquer compra pontual), ou pode associar uma fatura a uma ordem de compra existente para referência.

Cada fatura aumenta o que você deve a esse fornecedor. O estado de uma fatura avança por **Aberta → Parcialmente Paga → Paga** à medida que regista pagamentos contra ela, ou pode ser **Anulada** se tiver sido registada por engano (apenas enquanto ainda não tiver pagamentos registados — reverta primeiro os pagamentos).

## Registar uma Fatura

Abra **Faturas** na barra lateral e clique em **Registar Fatura**. Escolha o fornecedor (ou adicione um novo sem sair do ecrã — o mesmo atalho **+ Adicionar Novo Fornecedor** também está disponível no formulário da Ordem de Compra), depois adicione uma ou mais linhas.

Cada linha é uma destas duas opções:

- **Produto** — um artigo real do seu catálogo de produtos, escolhido numa lista pesquisável. O seu custo é preenchido automaticamente a partir do custo próprio do produto, e pode ajustá-lo se esta compra em particular teve um preço diferente.
- **Serviço** — texto livre (ex.: "Contrato de manutenção — trimestral", "Honorários de consultoria jurídica"), opcionalmente associado a uma categoria. É isto que fecha a lacuna de longa data em que toda compra empresarial não destinada a revenda — equipamento de escritório, consumíveis, honorários profissionais — não tinha nenhum lugar estruturado. Misture livremente linhas de produto e de serviço na mesma fatura.

Cada linha também tem o seu próprio valor de desconto e taxa de imposto, pelo que os totais da fatura são calculados corretamente linha a linha antes de serem somados — a mesma ordem desconto-depois-imposto que qualquer outro documento no Sarang já segue.

## Faturas de fornecedor em moeda estrangeira

Uma fatura de um fornecedor estrangeiro pode ser registada da mesma forma que uma fatura de venda — marque **Bill in foreign currency** ao registá-la, informe o código de moeda e a taxa de câmbio, e a fatura passará a ter um valor de referência convertido além do seu total em moeda local, exibido tanto na tela quanto na impressão. Ao liquidá-la (veja abaixo), aparece uma opção **Settle in {code}** da mesma forma que nas faturas de venda, e qualquer ganho ou perda entre a taxa em que a fatura foi registada e a taxa do dia em que você efetivamente paga é lançado automaticamente como um lançamento de Ganho/Perda Cambial Realizada — veja o capítulo Faturamento e Documentos para o passo a passo completo de como o alternador, a pré-visualização e o cálculo da liquidação funcionam; aqui funciona exatamente da mesma forma.

## Registar um Pagamento contra uma Fatura

Abra uma fatura e clique em **Registar Pagamento**. Os pagamentos a fornecedores aceitam Dinheiro, UPI, Cartão, Transferência Bancária ou Cheque — um conjunto mais amplo do que os pagamentos voltados para o cliente, já que os pagamentos B2B são feitos regularmente por transferência bancária ou cheque. Um pagamento pode ser parcial; o saldo e o estado da fatura são atualizados de imediato, e o valor é deduzido do que deve a esse fornecedor.

Todos os pagamentos que fez em todas as faturas também aparecem num só lugar em **Pagamentos Efetuados** na barra lateral — pesquisável por número de fatura, fornecedor ou número de referência, com o mesmo suporte de reversão (com motivo obrigatório) que os Pagamentos Recebidos já têm, caso um tenha sido registado por engano.

## Relatórios do lado das compras

Quatro relatórios, todos em **Relatórios**, cobrem o que comprou e o que deve:

- **Registo de Compras** — cada fatura num período, com um gráfico de gastos por fornecedor e o detalhe completo ao nível da linha. É o equivalente do lado das compras ao Relatório de Vendas.
- **Compras por Fornecedor** — gasto total e número de faturas, classificados por fornecedor, para saber a quem realmente compra mais.
- **Compras por Item** — gasto total e quantidade comprada, classificados por produto ou serviço, separando os itens de inventário reais das linhas de serviço em texto livre.
- **Resumo de Antiguidade de Contas a Pagar** — o que atualmente deve a cada fornecedor, agrupado por quanto tempo está em atraso (Atual / 1-30 / 31-60 / 61-90 / 90+ dias), a mesma lógica de antiguidade já usada pelo Relatório de Saldos em Aberto do lado dos fornecedores, agora como a sua própria vista dedicada.

## Maior profundidade no registo do fornecedor

O próprio registo de um fornecedor (abra-o a partir de **Fornecedores**) agora também pode conter conta bancária/código IFSC/nome do banco (para efetuar pagamentos) e um número de PAN (para questões de conformidade), além de um **Saldo de Abertura** quando adiciona pela primeira vez um fornecedor que já tem dívidas reais em aberto — isto regista um lançamento único no seu razão para que o saldo esteja correto desde o primeiro dia.

## Clientes Individuais vs. Empresariais

Um registo de cliente (abra-o a partir de **Clientes**) começa agora com um interruptor **Individual / Empresarial**. Empresarial ativa os campos de número de registo da empresa e pessoa de contacto designada; Individual ativa em vez disso um tipo e número de documento de identificação — isto corresponde ao que um distribuidor ou vendedor B2B realmente precisa de registar sobre a quem está a vender, ao contrário de um cliente de retalho ocasional.

## Despesas: Fornecedor, Quilometragem e Faturável ao Cliente

O formulário de **Despesas** agora também aceita um fornecedor opcional (para uma despesa que tem um fornecedor real mas não precisa de uma fatura completa), um detalhe de quilometragem (distância × taxa por km, que calcula o valor por si para que os dois números nunca possam divergir), e um campo **Faturar isto a um cliente** para uma despesa reembolsável que planeia cobrar de volta — por exemplo, uma viagem que um consultor depois fatura ao cliente.
