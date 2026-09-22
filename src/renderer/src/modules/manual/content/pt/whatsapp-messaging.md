# Mensagens e Lembretes do WhatsApp

O Sarang pode preparar mensagens do WhatsApp para seus clientes — lembretes de agendamento, avisos de pagamento em atraso, renovações de assinatura/contrato, e muito mais, em todo tipo de negócio — e entregá-las prontas para enviar ao WhatsApp. O Sarang nunca envia uma mensagem automaticamente: ele sempre abre seu próprio WhatsApp (Desktop ou Web) com a mensagem pré-preenchida, e você mesmo clica em **Send**. Essa é a mesma abordagem de "você sempre no controle" usada pelos botões Share via WhatsApp em Faturas e outros documentos (veja **Faturamento & Documentos**).

Há três lugares relacionados onde isso aparece, cobertos abaixo: a fila **WhatsApp Reminders**, o editor **Message Templates**, e o envio de uma mensagem avulsa a partir da própria página de um **Cliente**.

## WhatsApp Reminders — enviando o que o Sarang já preparou

Abra **WhatsApp Reminders** na barra lateral. Conforme você usa o Sarang no dia a dia — agendando compromissos, uma fatura vencendo, uma assinatura perto de expirar — o aplicativo prepara automaticamente mensagens de lembrete e as adiciona aqui com status **Pending**. Nada foi enviado ainda; esta lista é simplesmente tudo o que está pronto para sair.

Para cada lembrete pendente, você pode:
- Clicar em **Send on WhatsApp** — abre o WhatsApp com a mensagem e o número de telefone do cliente pré-preenchidos. Você revisa e clica em Send dentro do WhatsApp.
- Clicar na marca de verificação para **Mark Sent** assim que realmente enviar, para que saia da sua lista de pendentes.
- Clicar no X para **Dismiss** um lembrete que você não quer enviar (ex.: você já ligou para o cliente em vez disso).

Use o filtro **Pending / Sent / All** no topo para revisar o histórico. Um lembrete só aparece aqui se o cliente tiver um número de telefone cadastrado — o Sarang não consegue preparar uma mensagem do WhatsApp sem isso.

## Message Templates — personalizando o que seus lembretes dizem

Cada mensagem de lembrete acima vem de um modelo — um por situação (lembrete de agendamento, pagamento em atraso, expiração de assinatura, e assim por diante), cobrindo cada segmento de negócio que o Sarang suporta. Por padrão, eles usam uma redação pré-escrita sensata, mas você pode personalizar qualquer um deles.

Abra **Settings → Message Templates**. Os modelos são agrupados por área de negócio (Academia, Jurídico, Veterinária, Logística, e assim por diante) — clique em um grupo para expandi-lo. Para cada modelo você verá:

- Sua redação atual, em uma caixa de texto editável.
- Os **placeholders** que ele suporta logo abaixo, mostrados como `{{customerName}}`, `{{date}}`, etc. — estes são substituídos pelos dados reais do cliente quando um lembrete é realmente gerado. Mantenha-os exatamente como mostrado (mesma grafia, mesmas chaves duplas) se editar o texto ao redor; um placeholder removido ou digitado incorretamente aparecerá literalmente na mensagem enviada em vez do valor real.
- Um selo **Customized** assim que você salvar sua própria redação, e um botão **Reset to Default** para voltar à redação do Sarang a qualquer momento.
- Um selo **Internal note** no único modelo (lembretes de geração de fatura de retainer) que é uma nota de tarefa para sua própria equipe, nunca enviada a um cliente.

Clique em **Preview** em qualquer modelo para ver como ele realmente ficaria, preenchido com detalhes de exemplo realistas — uma forma rápida de verificar se sua redação soa natural antes de salvar.

### Reminder Message Language

No topo da tela Message Templates, um **administrador/gerente** pode definir o **Reminder Message Language** — o idioma que qualquer modelo não personalizado individualmente usará quando um lembrete for gerado. Isso é separado do seu próprio idioma de exibição pessoal (o que você escolhe em Settings → Language): sua própria tela pode estar em inglês enquanto os lembretes do WhatsApp do seu negócio saem em hindi, ou em qualquer outro idioma suportado, porque o que importa aqui é o que seus *clientes* entendem, não o que a tela de um funcionário específico mostra. Um modelo que você mesmo personalizou sempre usa sua própria redação salva, independentemente dessa configuração.

## Enviando uma mensagem avulsa do WhatsApp a partir da página de um Cliente

Nem toda mensagem se encaixa em um lembrete agendado — às vezes você só quer enviar algo a um cliente específico agora mesmo. Abra a página de qualquer cliente e clique em **Send WhatsApp Message** (só aparece se esse cliente tiver um número de telefone cadastrado).

1. Escolha um modelo no menu suspenso — o mesmo catálogo do Message Templates acima, limitado aos voltados ao cliente (a nota de uso interno não é oferecida aqui).
2. O próprio nome do cliente é preenchido automaticamente onde o modelo espera. Preencha o que mais o modelo precisar (um valor, uma data, um número de processo...) nas caixas fornecidas.
3. Uma pré-visualização ao vivo é atualizada enquanto você digita, mostrando exatamente o que será enviado.
4. Clique em **WhatsApp** para abri-lo pré-preenchido, igual em qualquer outro lugar — revise e envie por lá.

## Uma observação sobre como o WhatsApp realmente abre

Abrir o WhatsApp dessa forma inicia o WhatsApp Desktop se estiver instalado, ou o WhatsApp Web no seu navegador caso contrário — exatamente como os botões Share via WhatsApp em Faturas e outros documentos. O Sarang não tem como confirmar que uma mensagem foi realmente entregue depois que o WhatsApp abre — por isso os lembretes permanecem em **Pending** até que você mesmo clique explicitamente em **Mark Sent**.
