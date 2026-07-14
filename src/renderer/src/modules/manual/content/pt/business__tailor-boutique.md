# Alfaiataria / Boutique

## O que está incluído

Alfaiataria / Boutique é construído sobre a base compartilhada de negócios de serviço do Sarang — agendamentos, um catálogo de serviços, horários de prestadores e a fila de notificações — mais um único módulo dedicado: **Pedidos de Alfaiataria**, que cobre tanto o pedido em si quanto as medidas corporais salvas de cada cliente.

## Pedidos

Cada pedido registra o tipo de peça (Camisa, Calça, Terno, Kurta, Salwar Kameez, Blusa, Lehenga, Blusa de Saree, Jaqueta, Outro), gênero, região de estilo (Indiano ou Ocidental), quem forneceu o tecido (cliente ou loja) e sua descrição, quantidade, preço unitário e adiantamento pago — com o saldo devedor calculado automaticamente.

Um pedido pode ser vinculado a um dos registros de medidas salvos do cliente, e passa por um pipeline de status: **Recebido → Em Corte → Em Costura → Prova Agendada → (Ajustes, se necessário) → Pronto → Entregue**, com Cancelado como um resultado separado. As datas de prova e entrega são rastreadas separadamente, e entregas atrasadas são sinalizadas em vermelho. Assim que estiver Pronto, um botão **Gerar Fatura** fatura o pedido.

## Medidas

A aba **Medidas** mantém um histórico corrente das medidas corporais de um cliente — busto, cintura, quadril, ombro, pescoço, manga, entrepernas (interior), entrepernas (exterior), coxa, altura, cava, profundidade do decote frontal/traseiro, comprimento da peça e punho — junto com quem tirou a medida e quando. Um cliente pode ter mais de um registro de medidas ao longo do tempo, e qualquer um deles pode ser anexado a um novo pedido.

## Idioma

Alfaiataria / Boutique é a **única exceção deliberada** entre os modelos de negócio de serviço do Sarang: todo outro tipo de negócio desta família funciona apenas em inglês, mas as telas de Alfaiataria / Boutique são totalmente traduzidas e funcionam em **todos os 13 idiomas suportados pelo Sarang**, da mesma forma que um negócio baseado em produto como Varejo ou Farmácia. Altere o idioma da sua interface em **Configurações → Language**, normalmente — Pedidos de Alfaiataria e Medidas o seguirão.
