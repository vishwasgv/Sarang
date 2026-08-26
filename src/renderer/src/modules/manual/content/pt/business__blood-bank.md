# Banco de Sangue

## O que é diferente neste tipo de negócio

Um Banco de Sangue rastreia doadores, doações, triagem, estoque e emissão — um fluxo de trabalho sem equivalente real em nenhum outro lugar do Sarang. Ele deliberadamente **não** usa a tela genérica de Gestão de Lotes que Farmácia e Insumos Agrícolas usam, mesmo que toda unidade de sangue utilizável se torne, por baixo, um registro de lote. A tela genérica tem uma janela fixa de "vencendo em breve" de 30 dias e nenhum conceito de grupo sanguíneo — ambos errados para sangue, onde uma unidade de plaquetas só é utilizável por cerca de 5 dias e uma unidade de sangue total por cerca de 35. Por isso, o Banco de Sangue tem sua própria tela dedicada de **Estoque de Sangue**, com regras de validade construídas especificamente para sangue, ao mesmo tempo em que reutiliza o mesmo razão de estoque subjacente que tudo o mais usa.

## Cadastro de doadores

Abra **Doadores** na barra lateral para cadastrar um novo doador — nome, telefone, data de nascimento, **gênero**, grupo sanguíneo e peso. Cada doador recebe um código de doador sequencial (por exemplo, `DNR-202607-0001`). Um doador pode ser marcado como **inapto** (temporária ou indefinidamente inelegível para doar, com um motivo), o que bloqueia o registro de uma nova doação dele até que o período de inaptidão tenha genuinamente passado. Você pode enviar um lembrete de recall por WhatsApp a um doador assim que ele se tornar elegível novamente — o Sarang estima a próxima data de elegibilidade a partir do tipo da última doação e do gênero do doador (90 dias para sangue total/hemácias no caso de um doador do sexo masculino, 120 para uma doadora do sexo feminino, 14 para plaquetas, 28 para plasma) como um padrão conservador; siga sempre as suas próprias diretrizes médicas/regulatórias locais para a janela de elegibilidade real.

Em vez de verificar cada doador um por um, toque em **Recall Due** no topo do Cadastro de Doadores para filtrar a lista apenas para doadores cujo período de espera já terminou — isso transforma o cadastro em uma lista de trabalho de contato real que você pode percorrer, enviando um lembrete de recuperação para cada um diretamente de lá.

## Doações e coletas externas

Registre cada doação em **Doações e Triagem** — doador, grupo sanguíneo, tipo de componente (Sangue Total, Concentrado de Hemácias, Plaquetas, Plasma ou Crioprecipitado) e volume. Você pode, opcionalmente, organizar doações sob uma coleta externa (nome, local, data, organizador) para coletas realizadas fora das suas próprias instalações.

Agende e acompanhe suas próprias campanhas em **Donation Camps** na barra lateral — nome, data, local e organizador. Cada doação registrada em uma campanha conta para o próprio comparecimento daquela campanha, mostrado diretamente em seu cartão, para que você possa ver rapidamente quais campanhas realmente trazem doadores e quais não valem a pena repetir.

## Triagem

Toda doação começa com triagem **Pendente**. Somente um resultado **Aprovado** cria estoque real e utilizável — é nesse momento que um registro de lote é criado, com uma data de validade calculada a partir da vida útil real do tipo de componente (35 dias para Sangue Total, 42 para Concentrado de Hemácias, 5 para Plaquetas, 365 para Plasma e Crioprecipitado). Um resultado **Reprovado** nunca entra em estoque. Essa barreira é deliberada: uma unidade não triada ou reprovada nunca deve poder ser emitida.

## Estoque de Sangue

Abra **Estoque de Sangue** para ver toda unidade disponível agrupada por grupo sanguíneo e tipo de componente, com dias até a validade e um sinalizador de "vencendo em breve" usando uma janela de alerta por componente (até apenas 2 dias para plaquetas, até 30 para plasma), em vez de um único limite genérico.

## Tempo de Ciclo de Doação até Emissão

Abra o relatório **Donation-to-Issue Cycle Time** para ver quão rápido as unidades doadas são realmente usadas, detalhado por tipo de componente. Este é um indicador real de risco de desperdício, não apenas um instantâneo do estoque — o mesmo tempo de ciclo médio de 10 dias é normal para o plasma (validade de 365 dias) mas um sinal de alerta sério para as plaquetas (validade de 5 dias), então o relatório classifica os componentes pelo seu próprio tempo de ciclo médio em vez de misturar tudo em um único número.

## Emissão — com verificação de compatibilidade

Ao emitir unidades para um receptor, o Sarang verifica a compatibilidade ABO/Rh entre o grupo sanguíneo do receptor e o grupo de cada unidade doadora, usando as regras padrão para sangue total/concentrado de hemácias (e a regra inversa para plasma, em que AB é o doador universal). **Uma unidade incompatível fica bloqueada para emissão** — o botão Emitir Unidades permanece desabilitado até você escolher uma unidade compatível ou, para uma liberação de emergência genuína, marcar **Anular — liberação de emergência** e digitar um motivo documentado (ambos são obrigatórios em conjunto; o motivo fica registrado na emissão e é auditado). Plaquetas e crioprecipitado não têm nenhuma regra rígida de compatibilidade imposta, consistente com a prática comum de bancos de sangue para esses componentes. Esta verificação nunca é um substituto para o procedimento real de prova cruzada do seu laboratório. Emitir uma unidade a marca permanentemente como usada e reduz o razão de estoque; cancelar uma emissão ainda não faturada restaura as unidades.

Em uma emergência, use **Fast Match** dentro do formulário de Emissão de Unidades em vez de rolar toda a lista de unidades você mesmo — insira o grupo sanguíneo do receptor, o tipo de componente necessário e quantas unidades, depois toque em **Find & Select** para selecionar instantaneamente cada unidade compatível em estoque, a que vence primeiro primeiro, até a quantidade solicitada. Se houver menos unidades compatíveis disponíveis do que o solicitado, o Sarang informa exatamente quantas faltam para que você saiba imediatamente se precisa procurar em outro lugar.

## Faturamento

Gere uma nota fiscal a partir de uma emissão de sangue assim que toda unidade emitida tiver um preço definido e a emissão estiver vinculada a um cliente.

## Idioma

Banco de Sangue não é um dos modelos de negócio de serviço do Sarang — é um tipo de negócio por categoria de produto, portanto **não** tem bloqueio de idioma. A interface completa está disponível em todos os 13 idiomas suportados.
