# Assistente de Importação de Dados

Abra **Importar** na barra lateral para carregar em massa Produtos, Clientes, Fornecedores, Estoque (estoque inicial) ou Saldos Iniciais a partir de um arquivo CSV ou Excel (.xlsx) — útil ao migrar para o Sarang a partir de outro sistema ou de uma planilha, em vez de digitar centenas de registros um por um.

## Etapa 1 — Escolha um módulo

Escolha exatamente um dos cinco tipos de importação: **Produtos**, **Clientes**, **Fornecedores**, **Estoque** ou **Saldos Iniciais**. Cada um tem sua própria lista de colunas esperadas, exibida assim que você continuar.

## Etapa 2 — Envie seu arquivo

Arraste e solte um arquivo `.csv` ou `.xlsx` na área de soltar, ou toque em **Procurar Arquivo** para escolher um em uma caixa de diálogo. Se você ainda não tiver um arquivo pronto, toque primeiro em **Baixar Modelo** — isso gera uma planilha inicial com os cabeçalhos de coluna corretos para o módulo escolhido.

O painel **Colunas esperadas** lista cada coluna que a importação reconhece para esse módulo, obtida em tempo real para que nunca fique desatualizada em relação ao que o aplicativo realmente aceita. Um ponto vermelho e um asterisco marcam uma coluna como obrigatória; todo o resto é opcional.

**Aviso sobre zeros à esquerda**: se algum dos seus valores de SKU, Código de Barras ou Telefone tiver zeros à esquerda (como `0012`), formate essa coluna como **Texto** no Excel antes de salvar. O Excel remove silenciosamente os zeros à esquerda de qualquer coluna deixada no formato Geral ou Número, e, uma vez que isso acontece, o valor original não pode ser recuperado — o Sarang nunca chega a ver o zero.

## Etapa 3 — Mapeie as colunas

Para cada campo que o Sarang espera, escolha qual coluna do seu arquivo o fornece, usando o menu suspenso ao lado de cada nome de campo. O Sarang preenche automaticamente um mapeamento de melhor suposição, associando os nomes de cabeçalho do seu arquivo, então a maioria das importações precisa apenas de uma verificação rápida em vez de mapear cada campo manualmente. Um campo só pode ser mapeado a partir de uma coluna por vez — escolher uma nova coluna para um campo limpa automaticamente qualquer coluna mapeada a ele antes.

## Etapa 4 — Pré-visualização

O Sarang valida as primeiras 20 linhas do seu arquivo e mostra cada uma como **Válido**, **Duplicado** (será ignorada — já existe um registro correspondente) ou **Erro** (será ignorada, com o motivo específico exibido, como um campo obrigatório ausente ou um valor mal formatado). Isso é uma amostra, não uma validação completa — o resumo indica explicitamente que apenas as primeiras 20 linhas foram verificadas, e as linhas restantes são validadas conforme são realmente processadas na importação, então os totais finais podem diferir ligeiramente do que a pré-visualização mostrou.

## Etapa 5 — Confirme e execute

Antes que a importação seja realmente executada, o Sarang sempre garante que exista um backup de segurança — reutilizando um dos últimos 15 minutos, ou criando um novo se nenhum existir. Nenhuma importação prossegue sem esse backup em vigor.

O modo de importação é sempre **Somente Criar**: uma linha cuja chave (SKU, telefone, nome — dependendo do módulo) já corresponde a um registro existente é ignorada, nunca sobrescrita. Isso torna uma importação segura para ser executada novamente no mesmo arquivo, sem risco de duplicar ou corromper dados existentes, mas também significa que corrigir um erro de digitação em uma linha já importada exige editar esse registro diretamente depois, não reimportar.

Toque em **Executar Importação** para começar. Uma barra de progresso acompanha as linhas processadas em relação ao total do arquivo enquanto ele é executado.

## Etapa 6 — Resultados

Quando a importação terminar, você verá exatamente quantas linhas foram **Importados**, **Ignorados** (duplicadas), **Falharam** (erros), e quantos **Avisos** foram levantados ao longo do processo, além de uma lista rolável de cada erro de linha específico, se algum ocorrer. A partir daqui, **Importar Outro Arquivo** leva você de volta à Etapa 1 para uma nova importação, ou **Concluído** encerra o assistente.

## Se algo der errado

Como um backup de segurança é sempre feito primeiro, uma importação que dá errado pode ser desfeita restaurando esse backup em **Configurações → Backup e Restauração** — veja o capítulo Backup e Restauração deste Manual.
