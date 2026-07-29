# Laboratório de Diagnóstico e Patologia

## O que é diferente neste tipo de negócio

Um Laboratório de Diagnóstico e Patologia funciona sobre a mesma base de agendamentos/catálogo de serviços que todo negócio de serviço no Sarang compartilha, mais um conjunto de telas específicas de laboratório: **Lab Test Orders**. Um catálogo de exames/painéis reutiliza o Service Catalog padrão em vez de uma lista paralela separada — um exame de sangue ou um raio-X é apenas um serviço que você vende, precificado e tributado da mesma forma que qualquer outro serviço. O que é genuinamente diferente é o ciclo de vida do pedido por baixo — um pedido de laboratório avança através da coleta de amostra, entrada de resultados por exame, e um laudo bloqueado e finalizado, antes de ser faturado ou entregue ao paciente.

## Criando um pedido de laboratório

Abra **Lab Test Orders** na barra lateral. Um novo pedido precisa de um nome de paciente (o registro de cliente vinculado é opcional — pacientes avulsos são aceitos) e pelo menos um exame ou painel selecionado do seu Service Catalog. Você pode opcionalmente registrar a idade do paciente e vincular o pedido a um agendamento existente. Cada pedido recebe um número de pedido sequencial (por exemplo, `LAB-202607-0001`, reiniciado por mês do calendário).

## Encaminhamentos de uma clínica

Se um médico em outro lugar encaminhou este paciente ao seu laboratório, registre quem o encaminhou (`referredByProviderId`) junto com quaisquer notas de encaminhamento. Este é um fluxo de trabalho real e cotidiano para um laboratório independente que recebe encaminhamentos de clínicas de clínico geral, clínicas de especialista, e hospitais dos quais não faz parte.

## Coleta de amostra

Assim que uma amostra é coletada (sangue, urina, fezes, swab, imagem, ou outro tipo), marque o pedido como **Sample Collected**. Isso registra quem a coletou e quando, e move cada item de exame pendente no pedido para o status Collected. Exames só podem ser adicionados ou removidos de um pedido antes desta etapa — assim que uma amostra é coletada, o conjunto de exames do pedido fica travado.

## Entrada de resultados

Para cada exame no pedido, informe seu resultado: um conjunto de parâmetros nomeados (valor, unidade, faixa de referência, e um indicador de Baixo / Normal / Alto / Anormal — ou **Critical**, quando um valor cai na faixa de valor crítico configurada para aquele exame). Informar o primeiro resultado em um pedido o move automaticamente de Sample Collected para In Process, para que a equipe da recepção veja rapidamente que o trabalho realmente começou sem esperar que todos os exames terminem.

Um resultado **Critical** coloca imediatamente um selo vermelho no pedido (e no item específico), e o pedido não pode ser considerado tratado até que você use **Record Doctor Notified** para registrar que você realmente ligou para o médico que fez o encaminhamento, com uma nota — este é um registro genuíno de que a escalada aconteceu, não apenas que o número foi sinalizado.

## Finalizando o laudo

Assim que todo exame no pedido tiver um resultado inserido, **Finalize Report** bloqueia todo o pedido — seu status se torna Reported e cada item é marcado como Reported. Os resultados de um laudo finalizado não podem mais ser editados; se uma correção for genuinamente necessária, isso precisa acontecer antes da finalização. Depois que o laudo é finalizado, marque-o como **Delivered** assim que o paciente ou a clínica encaminhadora realmente o receber. Anexe arquivos reais de exame/imagem a um pedido a partir da sua visualização de detalhe.

## Faturamento

Gere uma nota fiscal diretamente de um pedido de laboratório assim que todo exame tiver um preço maior que zero e o pedido estiver vinculado a um registro de cliente. Cada exame aparece como sua própria linha na nota fiscal, usando a mesma alíquota (código SAC, se definido) que sua entrada no Service Catalog.

## Relatórios

A tela **Reports** inclui um relatório de Lab Turnaround específico deste setor, mostrando os pedidos por etapa (pedido, amostra coletada, em processo, laudado) e o tempo de processamento do pedido até o laudo para cada um — útil para identificar onde as amostras estão se acumulando.

## Idioma

Laboratório de Diagnóstico e Patologia é um dos modelos de negócio de serviço do Sarang, e — diferente de Alfaiataria/Boutique, a única exceção nomeada — mantém a regra padrão para esse grupo: a interface é bloqueada em **apenas inglês**, independentemente do idioma que você configurou no restante do Sarang.
