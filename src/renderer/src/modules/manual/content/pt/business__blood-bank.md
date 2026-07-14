# Banco de Sangue

## O que é diferente neste tipo de negócio

Um Banco de Sangue rastreia doadores, doações, triagem, estoque e emissão — um fluxo de trabalho sem equivalente real em nenhum outro lugar do Sarang. Ele deliberadamente **não** usa a tela genérica de Gestão de Lotes que Farmácia e Insumos Agrícolas usam, mesmo que toda unidade de sangue utilizável se torne, por baixo, um registro de lote. A tela genérica tem uma janela fixa de "vencendo em breve" de 30 dias e nenhum conceito de grupo sanguíneo — ambos errados para sangue, onde uma unidade de plaquetas só é utilizável por cerca de 5 dias e uma unidade de sangue total por cerca de 35. Por isso, o Banco de Sangue tem sua própria tela dedicada de **Estoque de Sangue**, com regras de validade construídas especificamente para sangue, ao mesmo tempo em que reutiliza o mesmo razão de estoque subjacente que tudo o mais usa.

## Cadastro de doadores

Abra **Doadores** na barra lateral para cadastrar um novo doador — nome, telefone, data de nascimento, gênero, grupo sanguíneo e peso. Cada doador recebe um código de doador sequencial (por exemplo, `DNR-202607-0001`). Um doador pode ser marcado como **inapto** (temporária ou indefinidamente inelegível para doar, com um motivo), o que bloqueia o registro de uma nova doação dele até que o período de inaptidão tenha genuinamente passado. Você pode enviar um lembrete de recall por WhatsApp a um doador assim que ele se tornar elegível novamente — o Sarang estima um intervalo de recuperação de 90 dias após uma doação de sangue total como um padrão conservador; siga sempre as suas próprias diretrizes médicas/regulatórias locais para a janela de elegibilidade real.

## Doações e coletas externas

Registre cada doação em **Doações e Triagem** — doador, grupo sanguíneo, tipo de componente (Sangue Total, Concentrado de Hemácias, Plaquetas, Plasma ou Crioprecipitado) e volume. Você pode, opcionalmente, organizar doações sob uma coleta externa (nome, local, data, organizador) para coletas realizadas fora das suas próprias instalações.

## Triagem

Toda doação começa com triagem **Pendente**. Somente um resultado **Aprovado** cria estoque real e utilizável — é nesse momento que um registro de lote é criado, com uma data de validade calculada a partir da vida útil real do tipo de componente (35 dias para Sangue Total, 42 para Concentrado de Hemácias, 5 para Plaquetas, 365 para Plasma e Crioprecipitado). Um resultado **Reprovado** nunca entra em estoque. Essa barreira é deliberada: uma unidade não triada ou reprovada nunca deve poder ser emitida.

## Estoque de Sangue

Abra **Estoque de Sangue** para ver toda unidade disponível agrupada por grupo sanguíneo e tipo de componente, com dias até a validade e um sinalizador de "vencendo em breve" usando uma janela de alerta por componente (até apenas 2 dias para plaquetas, até 30 para plasma), em vez de um único limite genérico.

## Emissão — com verificação de compatibilidade

Ao emitir unidades para um receptor, o Sarang verifica a compatibilidade ABO/Rh entre o grupo sanguíneo do receptor e o grupo de cada unidade doadora, usando as regras padrão para sangue total/concentrado de hemácias (e a regra inversa para plasma, em que AB é o doador universal). Esta é uma verificação de segurança consultiva mostrada no momento da seleção — nunca é um substituto para o procedimento real de prova cruzada do seu laboratório. Plaquetas e crioprecipitado não têm nenhuma regra rígida de compatibilidade imposta, consistente com a prática comum de bancos de sangue para esses componentes. Emitir uma unidade a marca permanentemente como usada e reduz o razão de estoque; cancelar uma emissão ainda não faturada restaura as unidades.

## Faturamento

Gere uma nota fiscal a partir de uma emissão de sangue assim que toda unidade emitida tiver um preço definido e a emissão estiver vinculada a um cliente.

## Idioma

Banco de Sangue não é um dos modelos de negócio de serviço do Sarang — é um tipo de negócio por categoria de produto, portanto **não** tem bloqueio de idioma. A interface completa está disponível em todos os 13 idiomas suportados.
