# Blueprints: Rastreamento de Etapas do Documento

## O que é

Os **Blueprints** permitem definir uma sequência de etapas nomeadas pelas quais um documento passa visivelmente — por exemplo, **Rascunho → Aprovado → Enviado ao fornecedor → Recebido** para um Pedido de Compra, ou suas próprias palavras para um Pedido de Venda. É uma forma simples e visual de ver *onde o documento realmente está* no seu próprio processo, além do status do sistema (Rascunho, Confirmado, Faturado, etc.).

Os Blueprints atualmente se aplicam a dois tipos de documento: **Pedidos de Compra** e **Pedidos de Venda**. Cada tipo de documento tem seu próprio conjunto independente de etapas — o pipeline que você configura para Pedidos de Compra não afeta os Pedidos de Venda, e vice-versa.

Assim como os Fluxos de Aprovação, os Blueprints vêm **desativados por padrão** e são totalmente **opcionais**. Se você nunca configurar nenhuma etapa para um tipo de documento, nada muda em lugar nenhum — nenhum widget aparece, e o documento funciona exatamente como sempre funcionou.

## Configurando as etapas (Configurações)

Um proprietário ou administrador configura as etapas em **Configurações**, na seção Blueprints. Escolha o tipo de documento (Pedido de Venda ou Pedido de Compra) e depois adicione as etapas uma a uma, digitando um nome e confirmando — cada nova etapa é adicionada ao final do pipeline.

Alguns limites reais a saber:

- **Até 20 etapas** por tipo de documento. Se você atingiu o limite, aposente uma etapa que não precisa mais antes de adicionar uma nova.
- **Não são permitidos nomes duplicados** dentro do mesmo tipo de documento — essa verificação ignora maiúsculas e minúsculas.
- O nome de uma etapa pode ter até **80 caracteres**.
- Use os controles de subir/descer ao lado de cada etapa para **reordenar** o pipeline a qualquer momento — isso só muda a ordem em que as etapas são exibidas; não afeta nenhum documento que já esteja em uma delas.
- Remover uma etapa da lista não a apaga permanentemente, mas sim a **aposenta**. Isso importa porque um documento real pode já estar naquela etapa; aposentá-la mantém esse histórico intacto enquanto a retira de qualquer novo uso. Uma etapa aposentada não aparece mais no pipeline nem como opção para avançar um documento.

Configurar etapas (adicionar, reordenar, aposentar) exige a mesma permissão necessária para alterar as demais configurações do negócio. Quem só pode visualizar as Configurações consegue ver as etapas configuradas, mas não alterá-las.

## Visualizando e avançando a etapa de um documento

Assim que um tipo de documento tem pelo menos uma etapa configurada, todo documento desse tipo passa a mostrar um rastreador de etapas diretamente na própria tela de detalhes — nas telas de detalhes tanto de **Pedidos de Compra** quanto de **Pedidos de Venda**, ao lado do painel de aprovação daquele documento (se houver um configurado). O rastreador mostra o pipeline inteiro como uma fileira de etapas; a etapa atual do documento fica destacada, e as etapas anteriores a ela são marcadas como concluídas.

Um documento que ainda não foi movido é automaticamente considerado como estando na **primeira etapa** — ao ativar os Blueprints para um tipo de documento, você não precisa voltar aos documentos já existentes para definir uma etapa inicial; até que alguém os avance, eles simplesmente são considerados como estando na primeira etapa.

Para avançar um documento, clique diretamente na etapa para a qual deseja movê-lo — você **não** precisa passar pelas etapas uma a uma em ordem; qualquer etapa configurada pode ser selecionada diretamente. Clicar na etapa em que o documento já está não faz nada.

## Isso não é um controle de aprovação

Os Blueprints são um pipeline de status que você define livremente para seu próprio acompanhamento — **não** são um controle de assinatura ou permissão. Mover um documento de uma etapa para a próxima exige apenas a mesma permissão que já permite criar ou editar aquele tipo de documento; não existe uma configuração separada de "quem pode avançar uma etapa", e nenhuma etapa pode bloquear ou exigir aprovação antes de um documento avançar. Se você precisa que um documento exija assinatura de aprovação acima de determinado valor antes de ser confirmado, é para isso que servem os **Fluxos de Aprovação** — Blueprints e Fluxos de Aprovação podem ser usados juntos no mesmo documento, mas cumprem funções diferentes: os Fluxos de Aprovação controlam se um documento *pode* ser confirmado; os Blueprints apenas mostram *onde ele está* depois disso, no pipeline que você desenhou.

## Se um tipo de documento não tiver etapas configuradas

Se você não configurou nenhuma etapa para Pedidos de Compra ou Pedidos de Venda, o rastreador de etapas simplesmente não aparece nas telas desses documentos — não há nada para desativar ou ocultar separadamente. Configurar a primeira etapa de um tipo de documento já é suficiente para que o rastreador apareça em todo documento seguinte daquele tipo.
