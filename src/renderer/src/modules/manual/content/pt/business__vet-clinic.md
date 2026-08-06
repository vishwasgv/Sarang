# Clínica Veterinária

As telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

## A base de serviço compartilhada

Todo tipo de negócio baseado em serviço no Sarang — incluindo Clínica Veterinária — parte dos mesmos quatro blocos de construção: **Agendamentos** (agendar e programar visitas), um **Catálogo de serviços** (a lista de consultas, procedimentos e seus preços), **Provider Schedules** (qual veterinário está disponível quando), e uma **Notification Queue** automática que cuida dos lembretes (como os lembretes de vacinação abaixo) sem que você precise enviá-los manualmente. O restante deste capítulo cobre o que é específico de uma clínica veterinária.

## Pacientes

Abra **Patients** na barra lateral para ver cada animal registrado na sua clínica, não os donos humanos. Cada cartão de paciente mostra a espécie (com um marcador de emoji para Cachorro/Gato/Ave/Coelho/Réptil/Outro), raça, gênero, peso, e um selo de status de vacinação (Em Dia / Vence em Breve / Atrasada / Sem Registros). Filtre por espécie, pesquise por nome do paciente ou do dono, ou mude para a visualização **Arquivado** para pacientes que não estão mais ativos.

Clique em **Add Patient** para registrar um novo — nome, espécie, raça, data de nascimento, gênero, cor/marcas, ID do microchip, um dono vinculado opcional (buscado entre seus Clientes existentes, ou deixado como cliente avulso), e notas em texto livre para alergias ou condições crônicas.

Um banner no topo da lista de Patients mostra as **Upcoming Vaccinations** que vencem nos próximos 30 dias entre todos os pacientes, para que nada seja esquecido.

## Perfil do paciente

Abrir um paciente leva você a três abas:

- **Overview** — os detalhes do paciente, o cartão do dono vinculado, e um registro de **Weight History**. Adicione uma nova pesagem a qualquer momento; assim que houver duas ou mais entradas, um pequeno gráfico de tendência plota o peso ao longo do tempo.
- **Vaccinations** — cada registro de vacinação (nome da vacina, tipo, número do lote, fabricante, data de administração, próxima data de vencimento, veterinário que administrou). Cada registro mostra um selo de status (Atrasada / Vence em Xd / Em dia). A partir daqui você pode **colocar na fila um lembrete de WhatsApp** para uma próxima data de vencimento (ignorado automaticamente se o dono não tiver número de telefone cadastrado), ou **imprimir um certificado de vacinação**.
- **Agendamentos** — o histórico completo de visitas do paciente com status (Agendado, Confirmado, Em Andamento, Concluído, Cancelado, Não Compareceu).

Editar um paciente também permite **arquivá-lo** (oculta-o da lista ativa sem apagar o histórico) e restaurá-lo depois.

## Certificados de vacinação

Imprimir um certificado de vacinação produz um documento formal de uma página com o timbre da clínica, os detalhes do paciente e da vacina, e uma isenção de responsabilidade informando que é um documento de conveniência gerado pelo Sarang, não um registro veterinário validado — sempre verifique os detalhes antes de confiar clinicamente nele.

## Notas de consulta

Ao agendar um compromisso, escolha o **paciente (animal)** específico a que ele se refere. Assim que a visita acontece, abra **Notas clínicas** para registrar uma consulta real — sinais vitais, achados e plano — a mesma tomada de notas estruturada que todo setor clínico do Sarang compartilha. A nota vem pré-preenchida com o nome e a idade do próprio animal (não os do dono), e mostra a espécie, raça, sexo e dono do animal logo ao lado para contexto rápido.

Os sinais vitais são conferidos contra **faixas normais** que levam em conta a espécie do paciente — a faixa normal de temperatura e pulso de um cachorro genuinamente difere da de um gato ou de um humano, e o Sarang avalia cada leitura automaticamente contra a faixa correta.
