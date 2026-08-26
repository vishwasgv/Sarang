# Insumos e Equipamentos Agrícolas

## O que é diferente neste tipo de negócio

Insumos e Equipamentos Agrícolas cobre lojas que vendem tanto insumos agrícolas consumíveis (fertilizantes, pesticidas, sementes) quanto equipamentos agrícolas duráveis (tratores, pulverizadores, bombas) lado a lado. Em vez de inventar uma nova tela para isso, o Sarang oferece exatamente o rastreamento que cada metade do negócio genuinamente precisa, emprestado das duas verticais que já resolvem cada metade corretamente: rastreamento de lote e validade (o mesmo formato crítico de segurança que a Farmácia usa para medicamentos) para os consumíveis, e rastreamento de número de série e garantia (o mesmo formato que Eletrônicos usa para celulares) para os equipamentos — menos o IMEI, que é específico de celulares e não tem equivalente em um trator ou pulverizador.

## Fertilizantes e Pesticidas — rastreamento de lote e validade

Todo fertilizante, pesticida ou semente que você estoca em lote recebe um número de lote, data de fabricação e data de validade, exatamente como uma farmácia estocando medicamentos. Abra **Rastreamento de Lote** na barra lateral para registrar lotes recebidos e ver o que está próximo do vencimento. Isso importa pela mesma razão que importa em uma farmácia: agroquímicos genuinamente se degradam e podem se tornar inseguros ou ineficazes após a validade, e um lojista precisa conseguir responder "qual do meu estoque vence primeiro" rapidamente, em vez de adivinhar de memória.

## Equipamentos Agrícolas — números de série e garantia

Tratores, pulverizadores motorizados, bombas d'água e outros equipamentos duráveis são rastreados individualmente por número de série, em vez de como uma quantidade indiferenciada, com um período de garantia registrado para cada unidade. Abra **Rastreamento de Série** na barra lateral para isso. Diferente de Eletrônicos (que também rastreia IMEI para celulares), Insumos Agrícolas deliberadamente não ativa o rastreamento de IMEI — é um identificador específico de celulares que não tem significado para um trator ou pulverizador, então esse campo simplesmente não se aplica aqui.

## Manutenção de Equipamentos — Ordens de Serviço

Quando um cliente traz um equipamento para reparo ou manutenção programada, abra uma ordem de serviço em **Ordens de Serviço** na barra lateral — o mesmo fluxo genérico de ordem de serviço que o tipo de negócio Repair do Sarang usa. Registre o que foi trazido, o trabalho a ser feito, as peças usadas e os custos de mão de obra, e a ordem de serviço pode ser faturada assim que o trabalho for concluído.

## Condições de crédito atreladas à colheita

Um cliente agricultor frequentemente precisa pagar depois da colheita, não no momento da compra. Ao faturar uma venda a Crédito, defina uma **data de vencimento** real — o Sarang mostra um selo de atraso na nota fiscal somente depois que essa data passar (não a data da venda), e o relatório de antiguidade da Análise de Saldos Pendentes também os agrupa pela data de vencimento real, para que um pagamento deliberadamente adiado até a colheita não seja sinalizado como atrasado apenas porque o tempo passou desde a venda.

Digitar uma data fixa é apenas um palpite — os verdadeiros termos de crédito de um agricultor seguem o calendário da colheita, não uma contagem fixa de dias. Em uma venda a Crédito, em vez de (ou junto com) a data de vencimento manual, você pode vincular a fatura a uma **Temporada de Colheita (Crop Season)** — um evento de colheita real que você define uma vez (ex.: "Colheita de Trigo" em 15 de abril) e reutiliza em cada venda a crédito daquela cultura. Selecione-a no menu suspenso que aparece abaixo do campo de data de vencimento, ou adicione uma nova ali mesmo via **Manage Seasons**. O Sarang calcula a data de vencimento real da fatura a partir da próxima ocorrência de colheita dessa temporada — a deste ano, se ainda não tiver passado, ou a do próximo ano, caso contrário — para que a data de vencimento esteja sempre ligada a um evento agrícola real, não a uma contagem arbitrária de dias.

## Aconselhamento de Produtos Vinculado à Cultura

Se você marcar um produto com a cultura para a qual ele se destina através do campo Recommended Crop do registro do produto (ex.: "Trigo", "Algodão", "Arroz" — qualquer nome usado na sua própria região, não uma lista fixa), esse produto se torna navegável por cultura no ponto de venda. Em Faturamento, uma linha de chips **Browse by Crop** aparece acima da busca de produtos assim que qualquer produto é marcado — toque em uma cultura para ver cada fertilizante, pesticida ou semente recomendados para ela, com estoque e preço ao vivo, e adicione diretamente ao carrinho. Isso transforma "qual fertilizante serve para esta cultura?" de algo que o caixa precisa memorizar em algo pesquisável em dois toques.

## Alertas de validade específicos por categoria

Diferentes categorias de insumos agrícolas precisam de avisos antecipados diferentes — sementes e fertilizantes costumam precisar de um aviso mais longo do que um item de giro rápido. Defina um **prazo de antecedência do alerta de validade** (em dias) por produto para sobrepor a janela padrão de aviso de 30 dias; os lotes daquele produto passam então a mostrar seu selo de aviso com base no seu próprio prazo configurado.

## Painel Combinado

Abra **Painel Agrícola** para uma visão em uma única tela de ambas as metades do negócio ao mesmo tempo — consumíveis com estoque baixo, lotes vencendo/vencidos, contagem total de equipamentos e equipamentos com garantias vencendo em breve — em vez de conferir duas telas separadas.

O mesmo painel também rastreia as **datas de manutenção pendentes de equipamentos** — a próxima manutenção agendada de um trator ou pulverizador, separada do vencimento de sua garantia. Defina uma data de manutenção para qualquer equipamento registrado diretamente no painel Equipment Service Due, e o Sarang o sinaliza ali assim que estiver próximo do vencimento ou atrasado. Toque em **Remind** em uma unidade sinalizada para enviar ao cliente um lembrete por WhatsApp com a data de vencimento.

## Relatórios de Exposição de Crédito Sazonal e Reembolso de Agricultores

Dois relatórios na tela de Relatórios são específicos deste tipo de negócio. **Exposição de Crédito Sazonal (Seasonal Credit Exposure)** mostra cada fatura de crédito atualmente pendente agrupada por mês de vencimento ao longo do ano civil, além de uma divisão separada por Temporada de Colheita vinculada — para que você possa ver de relance quando sua exposição de crédito atinge o pico durante o ano, o que para a maioria das lojas de insumos agrícolas se concentra em torno dos meses de colheita. **Histórico de Compras e Pagamentos por Agricultor (Farmer-Wise Purchase & Repayment History)** classifica cada cliente de crédito conforme quão confiavelmente ele realmente reembolsa, com as contas de maior risco primeiro — diferente do Customer Ledger de um único cliente, esta é a comparação entre vários agricultores que informa a quem conceder crédito fácil na próxima temporada e de quem cobrar primeiro.

## Logística e Cadeia de Suprimentos

Como varejistas de insumos agrícolas recebem rotineiramente entregas formais de fornecedores (sacos de fertilizante e equipamentos chegando de caminhão), o conjunto completo de módulos de Logística e Cadeia de Suprimentos é ativado por padrão — Frota, Transportadoras, Remessas, GRN (recebimento de mercadorias), Guia de Remessa, Livro de Fretes e Análise de Logística aparecem todos na barra lateral sem precisar ser ativados separadamente.

## Tudo o mais

Faturamento, Clientes e Fornecedores, Relatórios, Backup e Usuários e Permissões funcionam exatamente como descrito em seus próprios capítulos — nada neste tipo de negócio muda como você fatura uma venda ou recebe um pagamento.

## Idioma

Insumos e Equipamentos Agrícolas não é uma das verticais de serviço profissional do Sarang, portanto não tem bloqueio de idioma — a interface completa está disponível em todos os 13 idiomas suportados pelo Sarang, da mesma forma que Varejo, Farmácia ou qualquer outro tipo de negócio por categoria de produto.
