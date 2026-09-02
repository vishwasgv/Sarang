# Mercearia / Loja Kirana

## O que é diferente neste tipo de negócio

Uma loja de Mercearia/Kirana vende alto volume de produtos de curta validade (rastreamento de lote/validade ativado por padrão), estende crédito corrente "khata" para clientes regulares, e frequentemente vende itens básicos como grãos, leguminosas e óleo soltos por peso em vez de pré-embalados. Mercearia combina o rastreamento de lote/validade da Farmácia com os módulos de limite de crédito e análise de pendências do Distribuidor — uma combinação comprovada, não uma novidade.

## Lembrete Automático de Khata (Crédito)

Abra o relatório **Outstanding** — qualquer cliente com saldo khata vencido recebe seu próprio relatório de **Nível de Risco Khata** (veja abaixo) com um botão **Send Reminder** de um toque ao lado do nome. Pressioná-lo abre o WhatsApp com uma mensagem pré-preenchida informando o saldo pendente, e registra quando o lembrete foi enviado para que o mesmo cliente não seja lembrado novamente por pelo menos 7 dias. Como em todo compartilhamento via WhatsApp no Sarang, o aplicativo repassa para o WhatsApp e não pode confirmar que a mensagem foi realmente enviada — cabe a você pressionar enviar.

## Faturamento a Granel (Por Peso)

O faturamento a granel não é exclusivo da Mercearia — é uma opção por produto disponível para qualquer tipo de negócio (veja **Produto → Vender por Peso**). Para uma loja Kirana, é assim que grãos, leguminosas e óleo costumam ser precificados: defina um preço por quilograma/litro no produto, e a tela de faturamento cobra pelo peso inserido no balcão em vez de um preço fixo por unidade.

## Relatórios

Junto com os relatórios padrão de Vendas, Estoque e Financeiro, Mercearia recebe:

- **Conformidade de MRP** — cada linha de venda passada em que o preço unitário excedeu o MRP impresso do produto, com o excedente cobrado — uma verificação de conformidade real, não apenas um número de referência.
- **Perdas de Perecíveis** — estoque baixado por vencimento (use o motivo **Vencimento** ao ajustar estoque de produtos vencidos), por produto e valor.
- **Alerta de Reposição Diária** — produtos de venda rápida com estoque baixo, classificados por quantos dias de estoque restam no ritmo de vendas atual.
- **Mix de Vendas a Granel vs. Embaladas** — quanto da sua receita vem de produtos a granel (faturados por peso) versus SKUs pré-embalados.
- **Nível de Risco Khata** — cada cliente de crédito classificado por risco, combinando o quão vencida está sua dívida mais antiga com se seu saldo está subindo ou caindo nos últimos 30 dias — sinaliza um cliente regular deslizando para dívida incobrável antes que ele realmente entre em default, não apenas uma lista estática de saldos.

## Idioma

Mercearia não é um dos modelos de negócio de serviços do Sarang — é um tipo de negócio por categoria de produto, então **não** é bloqueada por idioma. A interface principal está disponível nos 13 idiomas suportados.
