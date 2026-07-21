# Joalheria

## O que é diferente neste tipo de negócio

O preço de venda real de uma peça de joalheria não é um número fixo que você define uma vez — ele é calculado na hora da venda, a partir do peso líquido da própria peça, da cotação de mercado de hoje para seu metal e pureza exatos, e de uma taxa de fabricação. Nenhum outro mecanismo de precificação no Sarang cobre isso, incluindo o faturamento por peso/a granel — esse recurso (usado para coisas como arroz ou especiarias vendidas por peso) precifica por uma taxa fixa por unidade de peso que *você* define e que permanece a mesma até que você a altere. A precificação de joalheria é diferente especificamente porque a cotação genuinamente flutua dia a dia com o mercado de metais, e precisa ser consultada de novo a cada vez.

## Configurando um produto de joalheria

Ao criar ou editar um produto, defina seu **Tipo de Metal** (Ouro, Prata ou Platina) e **Pureza** (por exemplo, "22K", "18K", "999"). Informe o peso bruto e, se tiver pedras ou outro material não metálico, um peso de pedra a deduzir — o Sarang sempre calcula o peso líquido como o peso bruto menos o peso da pedra por conta própria; ele nunca é confiado como um valor digitado diretamente no produto, da mesma forma que o preço de uma etiqueta de código de barras nunca é confiado a partir de uma entrada externa.

Depois, escolha como a taxa de fabricação é calculada:

- **Valor fixo** — uma taxa de fabricação fixa, independente do peso.
- **Por grama (do peso líquido)** — uma taxa multiplicada pelo peso líquido da peça.
- **Porcentagem do valor do metal** — uma porcentagem de (peso líquido × cotação de hoje).

## Cotações de Metais

Abra **Cotações de Metais** na barra lateral para definir a cotação de hoje por grama para cada combinação de tipo de metal e pureza que você estoca (ouro 22K e ouro 18K genuinamente têm cotações diferentes, então cada combinação recebe sua própria linha). Não há alimentação automática de cotação pela internet — consistente com o design offline-first do Sarang, você consulta a cotação de hoje onde normalmente faz isso e a digita. Atualize isso sempre que a cotação mudar; toda venda a partir desse momento usa o valor atual.

## Como uma venda é precificada

No momento do faturamento, adicionar um item de joalheria ao carrinho busca a cotação atual do seu tipo de metal e pureza, calcula o valor do metal (peso líquido × cotação), soma a taxa de fabricação e usa isso como o preço unitário da linha. Se nenhuma cotação ainda tiver sido definida para a combinação de metal/pureza daquele item, o Sarang não permitirá que você o fature a zero — você será solicitado a definir a cotação de hoje primeiro.

Precisa negociar a taxa de fabricação para uma venda específica sem alterar a taxa configurada do próprio produto? Edite-a diretamente na linha do carrinho — o preço da linha é recalculado imediatamente, e uma linha com valor sobrescrito é sinalizada visualmente, para que fique óbvio à primeira vista que ela não está usando a taxa padrão.

Se o item tiver um **número de marca/HUID** registrado no produto, ele é capturado na venda e impresso automaticamente na nota fiscal.

## Troca de Metal Usado

Abra **Troca de Metal Usado** para registrar um cliente trocando ouro ou prata usados por uma nova compra. Informe o peso bruto, um peso de dedução (para qualquer conteúdo não metálico), o tipo de metal e a pureza — o Sarang consulta a cotação de hoje para essa combinação e calcula o valor a dar ao cliente (peso líquido × cotação).

Para usá-lo, clique em **Aplicar Troca de Metal Usado** durante o faturamento daquele cliente — o Sarang mostra o crédito e o incorpora diretamente ao desconto da nota fiscal assim que a venda é criada, e marca a troca como utilizada para que ela nunca possa ser aplicada acidentalmente uma segunda vez a uma nota diferente.

## Devoluções

Joalheria tem o módulo de Devoluções ativado, o mesmo fluxo de processamento de devolução usado por Varejo, Vestuário e Calçados.

## Relatórios

**Relatórios** inclui um relatório de estoque de joalheria mostrando peso líquido, cotação atual e avaliação total, agrupados por tipo de metal e pureza.

## Idioma

Joalheria não é um dos modelos de negócio de serviço do Sarang — é um tipo de negócio por categoria de produto, portanto **não** tem bloqueio de idioma. A interface completa está disponível em todos os 13 idiomas suportados.
