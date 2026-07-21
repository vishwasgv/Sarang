# Negócio de Aluguel

## O que é diferente neste tipo de negócio

Negócio de Aluguel é deliberadamente genérico — foi construído para cobrir qualquer aluguel de curto prazo baseado em retirada e devolução, seja tendas e utensílios para um casamento, roupas, carros ou motos, uma casa para estadia curta, joias por um dia, estações de jogos, eletrônicos ou móveis. O que todos esses têm em comum é o mesmo ciclo de reserva → retirada → devolução, faturado por uma taxa baseada em tempo, em vez de um preço de venda único. Isso é diferente do módulo de Imóveis do Real Estate, que serve para locações de longo prazo, sem nenhum ciclo de retirada/devolução.

## Rastreamento UNIT vs. BULK

Cada produto alugável é rastreado de uma de duas formas:

- **UNIT** — para ativos individualmente distintos, como um carro específico, um vestido de noiva em particular ou um console de jogos numerado. Cada item físico recebe sua própria entrada em **Unidades de Aluguel**, com um rótulo de unidade e notas de condição, e uma reserva reivindica uma unidade específica para seu período de datas.
- **BULK** — para quantidade agrupada e intercambiável, como "50 cadeiras plásticas" ou "20 pratos de jantar". Não há identidade por item, apenas uma quantidade total possuída e quanto dela já está comprometido com reservas sobrepostas.

## Definindo taxas de aluguel

Um produto alugável pode ter uma taxa para qualquer combinação de **HORA, DIA, SEMANA, MÊS ou ANO** — defina as que se aplicarem quando marcar um produto como alugável. Uma reserva escolhe uma base de taxa por item; a duração é calculada nessa unidade e arredondada para cima (uma reserva de pouco mais de um dia ainda é faturada como um dia inteiro, nunca uma fração).

## O ciclo de vida da reserva

Abra **Reservas de Aluguel** na barra lateral. Uma reserva passa por:

1. **Reservado** — criada para um cliente, um intervalo de data/hora e um ou mais itens, com uma caução opcional coletada antecipadamente.
2. **Retirado** — o(s) item(ns) saem fisicamente com o cliente. Para itens UNIT, o status da unidade específica se torna Alugado.
3. **Devolvido** — o(s) item(ns) retornam. Você registra qualquer cobrança por dano e quanto da caução é reembolsado (por padrão, a caução menos qualquer cobrança por dano). Se a devolução for atrasada, uma taxa de atraso é calculada automaticamente a partir da própria taxa de cada item, normalizada para uma cifra diária, multiplicada por um multiplicador de taxa de atraso configurável (1,5× por padrão).

Uma reserva Reservada também pode ser **Cancelada** (antes da retirada) ou **Estendida** para uma data/hora de término posterior (desde que o item permaneça disponível durante o novo intervalo).

Uma reserva pode incluir vários itens de uma vez — cada um recebe sua própria **cobrança por dano** na devolução, de modo que a nota fiscal de uma reserva com múltiplos itens detalha exatamente qual unidade foi danificada, em vez de uma única linha de reparo genérica. Anexe **fotos de condição** reais tanto na retirada quanto na devolução de cada item, dando a você um registro documentado de antes/depois caso surja alguma disputa.

## Manutenção e aluguéis recorrentes

Defina um **intervalo de manutenção** em um item rastreado por UNIT — seja um número de aluguéis ou um número de dias — e o Sarang o encaminha automaticamente para o status Em Manutenção na devolução assim que o intervalo é atingido, bloqueando-o de ser alugado novamente até que você o marque como revisado. Abra **Unidades de Aluguel** para ver quais itens estão pendentes e para registrar uma manutenção concluída.

Para um cliente que aluga a mesma coisa em uma programação regular, defina um **intervalo de recorrência** na reserva e use **Criar Próximo Ciclo** assim que o período atual terminar, para gerar a próxima reserva com um único clique em vez de reinserir tudo do zero.

## A disponibilidade é sempre ao vivo, nunca um decremento de estoque

O Sarang nunca decrementa uma quantidade de estoque quando um aluguel é retirado. Em vez disso, a disponibilidade — tanto para itens UNIT quanto BULK — é calculada ao vivo a partir de toda reserva atualmente Reservada ou Retirada que se sobrepõe ao intervalo de datas solicitado. Isso importa porque uma reserva precisa bloquear a disponibilidade *antes* da retirada — dois clientes tentando reservar a mesma última tenda para datas sobrepostas não podem ambos ter sucesso, o que um modelo de "decrementar apenas na retirada" deixaria passar.

## Faturamento

Gerar uma nota a partir de uma reserva concluída cria itens de linha para a cobrança de cada item alugado, mais linhas separadas para qualquer taxa de atraso e cobrança por dano. A caução deliberadamente **não** faz parte da nota — ela é rastreada apenas como um valor coletado/reembolsado na própria reserva, já que é uma retenção, não receita.

## Relatórios

**Relatórios** inclui um relatório de Status de Aluguel (o que está atualmente retirado e o que está atrasado) e um relatório de Receita de Aluguel por produto, incluindo uma porcentagem de utilização para ativos rastreados por UNIT.

## Idioma

Negócio de Aluguel não é um dos modelos de negócio de serviço do Sarang — é um tipo de negócio por categoria de produto, portanto **não** tem bloqueio de idioma. A interface completa está disponível em todos os 13 idiomas suportados.
