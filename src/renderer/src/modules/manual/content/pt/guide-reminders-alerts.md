# Guia: Lembretes e alertas

O Sarang diz-lhe duas coisas diferentes, em dois lugares diferentes. Saber qual é qual resolve a maior parte da confusão.

| | **Alertas** (o sino) | **Lembretes de WhatsApp** |
|---|---|---|
| Para quem é | **Você** | **Os seus clientes, fornecedores ou pacientes** |
| Onde | Ícone de sino na barra superior | **Reminders & Messages → WhatsApp Reminders** |
| Exemplos | Stock baixo, cópia de segurança concluída, lembretes vencidos, verificação da base de dados | "A sua consulta é amanhã às 10:00", "O seu pagamento está em atraso", "A sua adesão termina em 7 dias" |
| O que faz | Clica: o Sarang abre o ecrã a que se refere | Clica em **Send on WhatsApp**, depois prime Enviar no WhatsApp |
| Enviado automaticamente? | Mostrado automaticamente | **Nunca.** O Sarang prepara a mensagem; você prime sempre Enviar |

## Alertas (o sino)

O sino mostra um número quando algo precisa da sua atenção. Abra-o e clique num alerta:

- **WhatsApp Reminders Due** abre o ecrã WhatsApp Reminders.
- **Low Stock Alert** abre Inventory.
- **Auto-Backup Complete** e **Database Integrity Issue** abrem Backup.
- **Compliance Tasks Generated** (escritórios de contabilidade e advocacia) abre Compliance.

Um alerta marcado **Open →** é clicável. Clicar também o marca como lido. **Mark all read** limpa o número.

## Lembretes de WhatsApp

O Sarang prepara lembretes a partir do que acontece no seu negócio e lista-os em **WhatsApp Reminders**, em três separadores: **Pending**, **Sent** e **All**.

Para cada lembrete pendente vê para quem é, a mensagem, e quando venceu.

1. Clique em **Send on WhatsApp**. O WhatsApp (a aplicação de computador ou o WhatsApp Web) abre com o número da pessoa e a mensagem já escrita.
2. Prima **Send** no WhatsApp. Este passo é sempre seu.
3. De volta ao Sarang, clique no visto (**Mark as sent**) para que passe a *Sent*. Use a cruz (**Dismiss**) para um que decida não enviar.

Um lembrete **sem número de telefone** mostra "No phone number, so this can't be sent". Adicione o número ao cliente ou fornecedor, ou descarte-o. Só os lembretes que realmente podem ser enviados podem ser marcados como enviados. Um lembrete cujo número de telefone é demasiado curto para ser real é marcado **Failed** e não conta como pronto a enviar: corrija o número no cliente e o próximo lembrete funcionará.

**Um cliente que pediu para não ser contactado.** Marque **Do not send this customer messages** no formulário do cliente. Os seus lembretes pendentes são removidos, deixam de aparecer como prontos a enviar, e o botão pontual **Send WhatsApp Message** recusa-os.

### O que cria lembretes

- **Consultas/Marcações** (clínicas, salões, ginásios e outros negócios baseados em marcações): um lembrete **24 horas antes** e outro **2 horas antes** da hora da marcação. São contados a partir da data e hora da marcação, pelo que uma marcação amanhã às 10:00 é lembrada hoje às 10:00 e amanhã às 08:00. Uma marcação feita com menos de 24 horas de antecedência recebe apenas o lembrete de 2 horas; uma feita com menos de 2 horas não recebe nenhum.
- **Reagendar ou cancelar** uma marcação substitui ou remove os seus lembretes pendentes, para que ninguém seja lembrado de um horário antigo. Marcações concluídas, faltas e em curso também perdem os seus lembretes pendentes.
- **Sem telefone no cliente**: não é criado nenhum lembrete, e o Sarang avisa-o ao marcar.
- **Pagamentos em atraso** (7, 14 e 30 dias), **renovações de adesão e contrato**, **datas de vacina e revisão médica**, **mensalidades em dívida**, **datas de audiência jurídica**, **envios despachados ou atrasados**, **mercadoria recebida** (um agradecimento ao fornecedor, apenas se tiver número de telefone), e muitos outros específicos do negócio.
- **Página do cliente → Send WhatsApp Message**: uma mensagem pontual que você mesmo escreve.

### Enviar muitos de uma vez

Os lembretes vencem ao longo do dia. O Sarang verifica de hora a hora enquanto está aberto e coloca um alerta **WhatsApp Reminders Due** no sino. Se o Sarang estiver fechado, os lembretes aguardam; não se perdem, mostram-se como vencidos na próxima vez que o abrir.

### Modelos de mensagem

**Reminders & Messages → Message Templates** permite-lhe alterar o texto de cada lembrete, ver uma pré-visualização em direto, e escolher o **idioma do lembrete**.

- Mantenha os marcadores como `{{name}}` e `{{date}}` exatamente como estão escritos; o Sarang preenche-os. Se digitar um marcador que essa mensagem não consiga preencher (um erro de escrita como `{{nmae}}`) ou chavetas que não fecham, o Sarang avisa-o enquanto digita e não o guardará.
- **O texto é guardado para o idioma de lembrete escolhido.** Escolha hindi no topo e escreva o seu texto em hindi; escolha inglês e escreva o seu texto em inglês. O texto guardado enquanto o inglês está escolhido também se aplica a qualquer idioma em que não tenha escrito o seu próprio. **Reset** remove o texto atualmente em vigor e traz de volta o texto incorporado.
- **Os lembretes já pendentes são atualizados** quando guarda um modelo, muda o idioma do lembrete ou muda a assinatura: o Sarang reformula-os para corresponder, e diz-lhe quantos atualizou. Um lembrete que editou à mão, ou um que já não corresponde ao seu modelo, é deixado como está.
- **Assinatura.** As mensagens incorporadas terminam com "Powered by Sarang | www.aszurex.com". Desmarque **End messages with Powered by Sarang** no topo do ecrã para a remover de todas as mensagens.
- Cada lembrete começa com o nome do seu negócio a negrito, adicionado automaticamente.

## Alertas que você define

**Settings → Business Features → Alert rules** envia-lhe uma notificação no sino quando uma venda, uma fatura de fornecedor ou uma despesa de pelo menos um valor que escolher é guardada (por exemplo "Invoice saved, at least 50,000"). Pode desativar ou eliminar uma regra. As regras só o avisam; nunca bloqueiam nem alteram um documento, e disparam para documentos feitos nos ecrãs principais.

## Bons hábitos

- Verifique **WhatsApp Reminders** uma vez de manhã e uma vez à tarde.
- Mantenha os números de telefone em formato internacional ou local de forma consistente; o Sarang acrescenta o código do seu país aos números locais (conhece os códigos de marcação de cerca de 100 países). Se o seu país não for reconhecido, digite os números com o código do país e um sinal de mais.
- Pergunte ao Sarang: "Quantos lembretes estão pendentes?" diz-lhe quantos estão prontos, quantos estão agendados para depois e quantos falharam.
