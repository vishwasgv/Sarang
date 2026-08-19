# Clínica Veterinária

As telas deste tipo de negócio estão apenas em inglês, independentemente do idioma que você configurou no restante do Sarang.

## A base de serviço compartilhada

Todo tipo de negócio baseado em serviço no Sarang — incluindo Clínica Veterinária — parte dos mesmos quatro blocos de construção: **Agendamentos** (agendar e programar visitas), um **Catálogo de serviços** (a lista de consultas, procedimentos e seus preços), **Provider Schedules** (qual veterinário está disponível quando), e uma **Notification Queue** automática que cuida dos lembretes (como os lembretes de vacinação abaixo) sem que você precise enviá-los manualmente. O restante deste capítulo cobre o que é específico de uma clínica veterinária.

## Pacientes

Abra **Patients** na barra lateral para ver cada animal registrado na sua clínica, não os donos humanos. Cada cartão de paciente mostra a espécie (com um marcador de emoji para Cachorro/Gato/Ave/Coelho/Réptil/Outro), raça, gênero, peso, e um selo de status de vacinação (Em Dia / Vence em Breve / Atrasada / Sem Registros). Filtre por espécie, pesquise por nome do paciente ou do dono, ou mude para a visualização **Arquivado** para pacientes que não estão mais ativos.

Clique em **Add Patient** para registrar um novo — nome, espécie, raça, data de nascimento, gênero, cor/marcas, ID do microchip, um dono vinculado opcional (buscado entre seus Clientes existentes, ou deixado como cliente avulso), e notas em texto livre para alergias ou condições crônicas.

Um banner no topo da lista de Patients mostra as **Upcoming Vaccinations** que vencem nos próximos 30 dias entre todos os pacientes, para que nada seja esquecido.

Se você mantiver uma lista de **Breed Health Alerts** (sua própria tela na barra lateral), um alerta correspondente aparece automaticamente enquanto você digita uma raça no formulário Add Patient — e permanece visível no perfil desse paciente depois, toda vez que ele é aberto, não só no registro. Essa lista é totalmente sua para construir: o Sarang não vem com nenhum conselho veterinário pré-escrito, então adicione as notas de risco que quiser que sua própria equipe lembre para as raças que você realmente atende (ex.: "perguntar sobre sintomas de quadril/articulação em toda consulta").

## Perfil do paciente

Abrir um paciente leva você a três abas:

- **Overview** — os detalhes do paciente, o cartão do dono vinculado, e um registro de **Weight History**. Adicione uma nova pesagem a qualquer momento; assim que houver duas ou mais entradas, um pequeno gráfico de tendência plota o peso ao longo do tempo. Se o dono tiver outros pets ativos registrados, um cartão **Other Pets in This Household** os lista — um clique leva você direto ao próprio perfil de um irmão, sem precisar buscar de novo na lista de Patients.
- **Vaccinations** — cada registro de vacinação (nome da vacina, tipo, número do lote, fabricante, data de administração, próxima data de vencimento, veterinário que administrou). Cada registro mostra um selo de status (Atrasada / Vence em Xd / Em dia). A partir daqui você pode **colocar na fila um lembrete de WhatsApp** para uma próxima data de vencimento (ignorado automaticamente se o dono não tiver número de telefone cadastrado), ou **imprimir um certificado de vacinação**.
- **Agendamentos** — o histórico completo de visitas do paciente com status (Agendado, Confirmado, Em Andamento, Concluído, Cancelado, Não Compareceu).

Editar um paciente também permite **arquivá-lo** (oculta-o da lista ativa sem apagar o histórico) e restaurá-lo depois.

## Certificados de vacinação

Imprimir um certificado de vacinação produz um documento formal de uma página com o timbre da clínica, os detalhes do paciente e da vacina, e uma isenção de responsabilidade informando que é um documento de conveniência gerado pelo Sarang, não um registro veterinário validado — sempre verifique os detalhes antes de confiar clinicamente nele.

## Notas de consulta

Ao agendar um compromisso, escolha o **paciente (animal)** específico a que ele se refere. Assim que a visita acontece, abra **Notas clínicas** para registrar uma consulta real — sinais vitais, achados e plano — a mesma tomada de notas estruturada que todo setor clínico do Sarang compartilha. A nota vem pré-preenchida com o nome e a idade do próprio animal (não os do dono), e mostra a espécie, raça, sexo e dono do animal logo ao lado para contexto rápido.

Os sinais vitais são conferidos contra **faixas normais** que levam em conta a espécie do paciente — a faixa normal de temperatura e pulso de um cachorro genuinamente difere da de um gato ou de um humano, e o Sarang avalia cada leitura automaticamente contra a faixa correta.

## Relatórios

Abra **Reports → Vaccination Compliance** para ver quantas doses de reforço realmente chegaram no prazo. Isso examina cada dose aplicada no intervalo de datas escolhido que tinha uma data de vencimento anterior registrada — a primeiríssima dose de uma vacina de um paciente não tem nada contra o que ser comparada como "no prazo", então fica de fora da contagem — e mostra a porcentagem que chegou na data de vencimento ou antes dela, como um medidor geral mais uma divisão por vacina. É uma pergunta diferente do cartão de vacinação do próprio Painel (que é uma instantânea ao vivo de "o que está atrasado agora"): este relatório olha para trás em um período específico, útil para identificar se o cronograma de reforço de uma vacina específica está consistentemente atrasando.

**Case-Type Volume Trend** traça quantos casos você lida por tipo de caso, mês a mês — uma linha por tipo. Seus tipos de caso vêm diretamente das categorias que você configurou no seu próprio Catálogo de Serviços (Consulta, Tosa, Diagnóstico, ou qualquer outra que você tenha adicionado, incluindo Cirurgia se você a rastreia lá), além de uma linha dedicada de **Vaccinations** vinda de doses realmente administradas em vez de agendamentos marcados. Somente agendamentos vinculados a um paciente e não cancelados contam como um caso real.
