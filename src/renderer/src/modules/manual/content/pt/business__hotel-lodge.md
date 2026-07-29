# Hotel / Pousada

## O que é diferente neste tipo de negócio

Hotel/Pousada é deliberadamente seu próprio setor, em vez de uma extensão do modelo genérico de Negócio de Aluguel ou do modelo padrão de agendamento de visita única que todo outro negócio de serviço no Sarang usa. Uma estadia em hotel precisa de três coisas que nenhum dos dois cobre: captura de identificação do hóspede legalmente exigida no check-in, faturamento por diária ao longo de uma estadia de várias noites, e cobranças extras durante a estadia adicionadas a um folio corrente antes do check-out final. Assim, Hotel/Pousada recebe um módulo dedicado, **Hotel Bookings**, cobrindo todo o ciclo de vida da reserva de forma independente.

## Cadastro de quartos

Abra **Rooms** na barra lateral para manter sua lista de quartos — número do quarto, tipo de quarto, andar, ocupação máxima, e uma diária base. O status de um quarto (Disponível, Ocupado, Limpeza, Manutenção, ou Fora de Serviço) muda principalmente sozinho conforme as reservas avançam pelo check-in e check-out; você não pode alterar manualmente o status de um quarto que atualmente tem um hóspede dentro.

## Reservando uma estadia

Abra **Hotel Bookings** para criar uma nova reserva — escolha um quarto, datas de check-in e check-out, nome do hóspede e dados de contato, número de hóspedes (limitado à ocupação máxima do quarto), um adiantamento opcional, e de onde veio a reserva (**origem/canal de reserva** — Visita Espontânea, Telefone, MakeMyTrip, Booking.com, ou qualquer outro canal que você digitar). O Sarang verifica se o quarto está genuinamente livre para aquele intervalo exato de datas antes de confirmar — a mesma verificação de disponibilidade em tempo real usada em outras partes do Sarang, para que dois membros da equipe nunca possam reservar duas vezes o mesmo quarto para datas sobrepostas. As noites são cobradas por datas do calendário, não por horas decorridas — uma estadia de check-in à noite até check-out na manhã seguinte é sempre uma diária, como na prática hoteleira normal.

Se o hóspede já se hospedou antes, escolhê-lo na busca de clientes mostra sua **contagem de estadias anteriores** diretamente no formulário de New Booking, para que a recepção possa reconhecer e receber de volta um hóspede recorrente.

Para uma estadia mais curta no mesmo dia, escolha **Day Use** em vez de uma reserva noturna normal — ela é cobrada pela tarifa de uso diurno configurada do quarto (ou metade da diária se nenhuma estiver definida) e ainda assim reserva o quarto pelo dia inteiro.

### Tarifas sazonais

Configure precificação por intervalo de datas em **Manage Seasonal Rates** na tela Rooms — uma tarifa geral para todos os quartos durante um período (por exemplo, uma sobretaxa de temporada de festival), ou uma tarifa específica para um tipo de quarto. Uma estadia que abrange um limite de temporada é precificada corretamente noite a noite, não a uma tarifa fixa para toda a estadia.

### Reservas em grupo

Reservando vários quartos para o mesmo hóspede para um grupo ou família? Marque as reservas relacionadas na lista Hotel Bookings e use **Generate Combined Bill** para produzir uma única nota fiscal cobrindo todas elas, em vez de uma fatura separada por quarto.

## Conformidade de identificação do hóspede no check-in

Fazer o check-in de uma reserva exige registrar pelo menos a identificação de um hóspede — nome, tipo de identificação (Aadhaar, Passaporte, Carteira de Motorista, Título de Eleitor, ou PAN na Índia; Passaporte, Identidade Nacional, Carteira de Motorista, ou Outro Documento Governamental em outros lugares), número do documento, e nacionalidade. Isso não é atrito adicional por si só — muitas jurisdições exigem legalmente que um estabelecimento de hospedagem mantenha um registro apresentável da identidade de cada hóspede para verificação policial ou de imigração, e este é exatamente esse registro.

## Cobranças extras durante a estadia

Enquanto um hóspede está com check-in feito, adicione cobranças extras à sua estadia na tela de detalhe da reserva — serviço de quarto, lavanderia, frigobar, qualquer coisa cobrada além da diária do quarto. Elas se acumulam em um folio corrente que é adicionado à conta final; as cobranças só podem ser adicionadas ou removidas enquanto o hóspede ainda estiver com check-in feito.

## Check-out e faturamento

O check-out encerra a estadia e libera o quarto para limpeza. Gerar a nota fiscal cobra a diária do quarto (tarifa noturna × noites) mais cada cobrança extra como sua própria linha, para que a nota fiscal impressa detalhe a estadia da forma como um folio de hotel real faria. Qualquer adiantamento recebido no momento da reserva é registrado automaticamente como um pagamento contra a nova nota fiscal. Como qualquer outra nota fiscal no Sarang, ela pode ser impressa em A4 ou em largura de recibo térmico.

## Governança

Todo check-out coloca automaticamente em fila uma **tarefa de governança** para aquele quarto. Abra **Housekeeping** para ver todas as tarefas pendentes, atribuí-las a um membro da equipe, e marcá-las como concluídas — assim que toda tarefa aberta para um quarto está concluída, o quarto volta para Disponível por conta própria, em vez de depender de alguém se lembrar de mudar seu status manualmente.

## Cancelamento ou não comparecimento

Uma reserva Confirmed que ainda não fez check-in pode ser cancelada (com um motivo opcional) ou marcada como não comparecimento. Assim que um hóspede fez check-in, o único caminho a seguir é o check-out — uma reserva já com check-in feito não pode mais ser cancelada, já que o hóspede está fisicamente no quarto.

## Relatórios

**Reports** inclui um relatório de Occupancy (quartos ocupados/disponíveis/em limpeza/em manutenção neste momento, com uma porcentagem de ocupação) e um relatório de Guest Register — o registro de conformidade que este setor existe para sustentar, listando os detalhes de identificação de cada hóspede para estadias que se sobrepõem a um intervalo de datas que você escolhe, pronto para ser produzido sob demanda.

## Idioma

Hotel/Pousada é um dos modelos de negócio de serviço do Sarang, e — diferente de Alfaiataria/Boutique, a única exceção nomeada — mantém a regra padrão para esse grupo: a interface é bloqueada em **apenas inglês**, independentemente do idioma que você configurou no restante do Sarang.
