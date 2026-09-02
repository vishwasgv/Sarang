# Turismo e Viagens

## O que é diferente neste tipo de negócio

Turismo e Viagens abrange a locação de táxis/vans/ônibus fretados, pacotes turísticos com assentos compartilhados, e tudo o que envolve operar uma pequena frota de veículos: acerto de turnos de motoristas (diária, pernoite, adicional de condução noturna, e cobrança de km/hora excedente), rastreamento de serviço/manutenção de veículos, e comissão de agentes indicadores. Pesquisa de mercado real confirma que tarifas de táxi interurbano são cotadas por km conforme a classe do veículo com um mínimo de km diário — uma **tarifa de pacote**, não um taxímetro ao vivo — então cada reserva aqui registra uma tarifa de pacote antecipadamente, com cobranças excedentes acertadas somente quando o registro de turno de uma viagem é encerrado.

## Frota de Veículos

Abra **Frota de Veículos** na barra lateral para cadastrar cada veículo (número de placa, tipo, capacidade de assentos) e rastrear seu odômetro. A mesma tela mostra o **Calendário de Disponibilidade de Frota e Assentos** — o status reservado/livre de cada veículo e os assentos restantes de cada próxima partida de tour, para os próximos 30 dias — e permite registrar visitas de **Serviço / Reparo / Manutenção** com custo e leitura do odômetro, construindo o histórico que o relatório de Manutenção de Veículo Devida lê.

## Pacotes Turísticos e Reserva de Assentos

Abra **Pacotes Turísticos** para definir um pacote reutilizável (nome, itinerário, duração, assentos padrão, tarifa por assento), depois agende **partidas** reais contra ele em datas específicas. Um cliente reserva **assentos** individuais em uma partida — a contagem de assentos é reivindicada atomicamente para que dois funcionários nunca possam vender em excesso a mesma partida — e a tarifa do pacote é calculada automaticamente como assentos × tarifa por assento.

## Reservas de Viagem e Turno de Motorista

Abra **Reservas de Viagem** para criar uma reserva fretada exclusiva: escolha o cliente e o veículo, defina as datas da viagem, embarque/desembarque/rota, uma tarifa de pacote, e os **km/dia incluídos** e **horas/dia incluídas** que o pacote cobre. Registre um sinal se um foi cobrado, e opcionalmente o nome de um agente indicador e sua comissão.

Assim que a viagem estiver em andamento, use **Start Duty** na reserva: atribua um motorista, registre o odômetro e horário iniciais, e a diária (subsídio diário) do motorista, a taxa de pernoite, e o adicional de condução noturna se aplicável. Quando a viagem termina, use **Close Duty** com o odômetro e horário finais — o Sarang calcula os km percorridos e as horas em serviço, e se algum exceder a franquia incluída do pacote, o excedente é cobrado a uma tarifa por km que varia conforme a classe do veículo (sedã/SUV/van/micro-ônibus/ônibus) mais uma tarifa fixa de hora excedente. Essa cobrança excedente é receita faturável ao cliente; a diária/pernoite/condução noturna do motorista permanece um custo separado, nunca faturado como margem.

Assim que uma reserva estiver pronta para faturar, use **Gerar Fatura** — ela fatura a tarifa do pacote mais quaisquer cobranças de km/hora excedente acertadas de registros de turno encerrados, e registra o sinal já cobrado como um pagamento real contra a nova fatura.

## Relatórios

Junto com os relatórios padrão de Vendas, Estoque e Financeiro, Turismo e Viagens recebe:

- **Manutenção de Veículo Devida** — total de km rodados por veículo desde sua última manutenção, com veículos devidos ou atrasados sinalizados contra seu próprio km de próxima manutenção registrado ou um intervalo padrão genérico.
- **Comissão por Agente** — comissão de indicação ganha por agente, somada em cada reserva de viagem no período selecionado.
- **Rentabilidade de Viagem** (recurso destaque) — por viagem concluída: receita (tarifa de pacote mais cobranças excedentes) menos custo do motorista, um custo de combustível estimado a partir dos km rodados, uma parcela rateada do custo de manutenção do veículo, e comissão — o único número que mostra a margem real por viagem, não apenas a receita.

## Idioma

Turismo e Viagens não é um dos modelos de negócio de serviços do Sarang — é um tipo de negócio por categoria de produto/frota, então **não** é bloqueado por idioma. A interface principal, incluindo Frota de Veículos, Pacotes Turísticos, e Reservas de Viagem, está disponível nos 13 idiomas suportados.
