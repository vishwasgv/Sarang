# Guia: Impostos fora da Índia (IVA, imposto sobre vendas e outros)

O Sarang funciona para negócios em qualquer país. Este guia explica como o imposto funciona quando o seu negócio não está no GST da Índia, e como configurá-lo. As regras fiscais diferem por país e mudam, por isso confirme as suas taxas, o formato do seu número fiscal e as suas declarações com o seu contabilista local ou autoridade fiscal. O Sarang guarda as taxas que usa; não as decide por si.

## As regras do país aplicam-se apenas ao seu país

O Sarang carrega taxas de imposto e etiquetas **apenas para o país que escolher como país do seu negócio**. Se o seu negócio estiver na Alemanha, vê as taxas e termos da Alemanha e nada de nenhum outro país. A Índia funciona exatamente como sempre, a menos que escolha outro país. Escolhe o país na configuração inicial, ou mais tarde em **Settings → Business Profile**.

**Idioma.** Os ecrãs do Sarang estão disponíveis em 13 idiomas (inglês, hindi, marata, guzerate, canarês, tâmil, telugu, malaiala, espanhol, francês, português, árabe e indonésio). Para um país cujo idioma não é um destes, os nomes e notas fiscais do país são mostrados em **inglês**, seja qual for o idioma do resto do ecrã.

## Passo 1: escolha o seu país

Na configuração, escolha o seu país da lista (ainda pode digitar um que não esteja listado). O Sarang reconhece cerca de 50 países e, para cada um, sugere o modelo de imposto, a moeda, a etiqueta do número fiscal, as taxas padrão, se os preços de prateleira habitualmente incluem imposto, e o arredondamento em dinheiro habitual lá. Confirma cada sugestão; nada é aplicado silenciosamente.

Países com taxas incorporadas (a 25 de setembro de 2026): Índia, Reino Unido, Irlanda, Alemanha, França, Itália, Espanha, Países Baixos, Portugal, Bélgica, Áustria, Polónia, Suécia, Dinamarca, Suíça, Emirados Árabes Unidos, Arábia Saudita, Omã, Barém, Catar, Kuwait, Egito, Turquia, Israel, Austrália, Nova Zelândia, Singapura, Malásia, Tailândia, Indonésia, Filipinas, Vietname, Japão, Coreia do Sul, China, Hong Kong, Paquistão, Bangladeche, Sri Lanka, Nepal, África do Sul, Quénia, Nigéria, Gana, Canadá, Estados Unidos, México, Argentina, Chile e Colômbia. Catar, Kuwait e Hong Kong não têm IVA nem imposto sobre vendas, por isso começam sem imposto. Os Estados Unidos não têm imposto nacional sobre vendas e as suas taxas estaduais variam, por isso acrescenta as suas próprias. O Brasil tem vários impostos numa única venda e não está incluído: acrescente as suas taxas à mão. **As taxas mudam**, e a lista mostra a data em que foi verificada pela última vez; confirme sempre com a sua autoridade fiscal.

Se o seu país não estiver na lista, a lista de taxas de imposto começa com uma única linha "No tax" e uma nota a pedir para acrescentar as suas taxas à mão.

## Passo 2: verifique o seu modelo de imposto e taxas

| Modelo de imposto | Usado para | O que é impresso |
|---|---|---|
| **GST** | Índia | CGST e SGST, ou IGST, ou uma linha de GST, com o seu GSTIN |
| **VAT** | Países com um imposto sobre o valor acrescentado ou um imposto tipo GST (Reino Unido, UE, Golfo, Austrália, Nova Zelândia, Singapura, Canadá e outros). A linha usa o nome próprio do seu país para o imposto, por exemplo GST na Austrália | Uma linha com o nome do seu imposto |
| **Sales Tax** | Estados Unidos e outros países com imposto sobre vendas | Uma linha chamada **Sales Tax** |
| **Custom** | Qualquer outro imposto com nome próprio | Uma linha chamada **Tax** |
| **None** | Nenhum imposto cobrado | Sem linha de imposto |

Abra **Settings → Tax Configuration**. Isto lista as taxas que cobra. Se o país do seu negócio tiver taxas incorporadas, um botão **Load tax rates for {your country}** adiciona as que faltam (nunca elimina ou altera as que já tem, nem altera documentos passados). O ecrã mostra a data em que as taxas foram verificadas pela última vez e quaisquer notas, por exemplo onde um país tem taxas provinciais ou estaduais adicionais. Marque a sua taxa habitual como predefinida, e acrescente a que faltar. Depois defina a taxa correta em cada produto (Products → Tax Rate %) ou escolha-a das suas taxas guardadas. O Sarang avisa-o suavemente se uma taxa que digita não for uma das suas taxas guardadas.

Escolha também a **Tax category** de cada produto: standard, reduced, zero-rated, exempt, nil-rated ou out of scope. Um artigo **zero-rated** (cobrado a 0 por cento mas ainda reportável) é diferente de um **exempt**. Um cliente isento pode ser marcado como isento de imposto na sua página, com o número do certificado de isenção ou revenda e a data até à qual é válido; as suas faturas não têm imposto enquanto o certificado for válido, e o imposto é cobrado novamente após essa data (o formulário do cliente avisa-o).

### Dividir uma taxa em partes

Onde uma venda leva dois impostos (o GST federal do Canadá mais o PST provincial, ou o imposto estadual sobre vendas mais o do condado nos EUA), introduza a **taxa combinada** como uma única taxa, depois no formulário da taxa use **Add part** para nomear as suas partes, por exemplo GST 5 e PST 7 para uma taxa de 12 por cento. As partes devem somar a taxa. O valor cobrado não muda; faturas, orçamentos, faturas de fornecedor e ordens de compra mostram então cada parte na sua própria linha, e **Reports → Tax by Part** soma o imposto nas vendas e compras para cada parte, para que cada uma possa ser declarada junto da sua própria autoridade. Um imposto cobrado sobre outro imposto (imposto sobre imposto) não é modelado: introduza em vez disso a taxa combinada efetiva.

## Passo 3: preços com ou sem imposto

Lojas em muitos países mostram preços de prateleira que já incluem imposto. Na configuração, o Sarang sugere se os preços no seu país habitualmente incluem imposto, e você confirma. Pode alterar isto a qualquer momento em **Settings → Currency & Locale → Prices include tax**, e em cada documento existe um interruptor **Prices include tax** com a coluna de preço com a etiqueta **(incl. tax)** ou **(excl. tax)**.

Antes de imposto, o imposto é acrescentado por cima:

```
valor tributável = quantidade x preço - desconto
imposto           = valor tributável x taxa
total             = valor tributável + imposto
```

Exemplo: 3 artigos a 10,00, desconto 10 por cento, IVA 20 por cento. Linha 30,00, tributável 27,00, IVA 5,40, total 32,40.

Com imposto incluído, o imposto é retirado do preço que digitou: um preço de 12,00 incluindo 20 por cento de IVA dá tributável 10,00, IVA 2,00, total 12,00. O total é sempre o preço que o cliente vê.

Os valores mantêm as casas decimais exatas da sua moeda (duas para dólares, libras, euros e dirhams; três para dinar; nenhuma para iene).

## Passo 4: arredondamento em dinheiro

**Settings → Currency & Locale → Invoice rounding** oferece None, nearest 0.05, 0.10, 0.50 ou 1. Muitos países arredondam os totais em dinheiro (por exemplo para 0,05 na Suíça, Austrália e Nova Zelândia). Na configuração, o Sarang sugere a regra habitual do seu país e você confirma-a. O arredondamento aparece como a sua própria linha na fatura.

## Passo 5: números fiscais

Introduza o seu **número fiscal** em **Settings → Business Profile**; imprime-se nas faturas. O campo assume o nome que o seu país usa (VAT number, TRN, ABN, EIN, GST number, etc.). Clientes e fornecedores têm o mesmo campo. Onde o Sarang tem a certeza do formato do número de um país, mostra uma dica suave se o número parecer errado; nunca o impede de guardar. O Sarang verifica o formato estrito apenas do GSTIN, PAN e IFSC indianos.

## Vender a outros países

- **Moeda estrangeira:** num documento de venda marque a opção de moeda estrangeira e introduza o código da moeda. Se mantiver uma tabela de taxas em **Settings → Business Features → Exchange rates** (digite-as ou importe um CSV com as colunas moeda, taxa, data), a taxa mais recente é preenchida para si; pode sempre alterá-la. O Sarang mostra o valor convertido e mantém os seus livros na sua própria moeda. Quando o cliente paga, **Settle in {currency}** regista qualquer ganho ou perda cambial.
- **Imposto sobre exportações:** muitos países colocam as exportações em zero-rate. Quando o país do cliente é diferente do seu, o ecrã de Faturação mostra **Export sale?**: marque-o e a venda fica zero-rated, com a nota "Export supply, zero-rated" na fatura. O Sarang nunca faz isto por si só. Pergunte ao seu contabilista quais as vendas elegíveis e guarde a sua prova de exportação.
- **Fornecedores no estrangeiro:** registe uma **Supplier Bill** em moeda estrangeira da mesma forma. Se tiver de contabilizar você mesmo o imposto numa importação ou serviço do estrangeiro (reverse charge), marque **Reverse Charge** na fatura.

## Notas de crédito e débito

Cada uma tem **Add tax to this note**: omita-o e o total da nota é apenas o valor; adicione-o e o imposto é calculado na nota como em qualquer documento. Veja *Guia: Impostos e GST, como o Sarang calcula* para os detalhes.

## Relatórios que pode usar para a sua declaração

- **Reports → VAT / Sales Tax Return:** um documento de trabalho organizado segundo as caixas da declaração do seu país para o Reino Unido, Austrália, Nova Zelândia, Canadá, Singapura, Emirados Árabes Unidos, Arábia Saudita e África do Sul, e um resumo genérico (vendas e compras por tratamento fiscal) para qualquer outro país. As caixas que o Sarang não consegue preencher a partir dos seus registos ficam a zero e etiquetadas em inglês. Verifique cada caixa em relação ao formulário da sua autoridade fiscal antes de submeter.
- **Reports → Tax Report:** imposto cobrado nas vendas, por taxa e por categoria de imposto, para qualquer intervalo de datas. Funciona para qualquer modelo de imposto.
- **Reports → Tax by Part:** imposto nas vendas e compras para cada parte nomeada de uma taxa.
- **Reports → Purchase Register:** o que comprou, com o imposto de cada fatura, para que o seu contabilista possa calcular o imposto que pode reclamar.
- **Reports → TDS Deducted** e **TDS Receivable:** imposto que reteve a fornecedores, e imposto que os seus clientes lhe retiveram. Os ecrãs chamam-lhe TDS; use-o também para retenção na fonte no seu país, e confirme as regras com o seu consultor fiscal.
- **Reports → Profit and Loss**, **Balance Sheet**, **Trial Balance** e **Cash Book** para o período.

## Limites a conhecer hoje

- Uma taxa de imposto por linha. Dois impostos numa venda são geridos dividindo a taxa combinada em partes (acima); o valor cobrado é sempre a taxa combinada.
- O Sarang não escolhe uma taxa pelo estado, condado ou cidade do cliente. Acrescente as taxas combinadas de que precisa (por exemplo uma por cada estado onde vende) e escolha a correta no produto ou na linha.
- Itens exclusivos da Índia (GST return files, e-way bill, HSN, PF e ESI) ficam ocultos para outros países.
- Submissões de faturação eletrónica governamental e entrega online não estão incluídas; o Sarang funciona offline e nunca envia nada a uma autoridade fiscal.
