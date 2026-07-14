# Backup e Restauração

O Sarang armazena todos os dados do seu negócio em um único arquivo de banco de dados local neste computador. A tela **Backup** (barra lateral, ou **Configurações → Backup & Recovery**) é onde você protege esses dados contra falha de disco, exclusão acidental ou a perda/roubo de uma máquina.

## Criando um backup manual

Clique em **Criar Backup**. O Sarang executa primeiro uma verificação de integridade do banco de dados, grava quaisquer escritas pendentes, depois produz uma cópia limpa e desfragmentada do seu banco de dados, calcula seu checksum e a empacota (junto com um pequeno arquivo de metadados) em um único arquivo `.sarang-backup`. Se a verificação de integridade falhar, o backup é recusado em vez de salvar uma cópia possivelmente corrompida — você verá um erro explicando o motivo.

Cada backup aparece na lista de **Histórico de Backups** com nome do arquivo, data, tamanho e um selo de status válido/inválido.

## Onde os backups são armazenados

Por padrão, os backups são salvos na pasta de dados do próprio aplicativo, no mesmo disco onde está seu banco de dados ativo (mostrado na parte inferior da tela de Backup, e normalmente em `AppData\Sarang Business OS Lite\backups\` no Windows). Como é o mesmo disco onde seus dados ativos vivem, uma falha de disco derrubaria os backups junto.

Na primeira vez que você fizer login, o Sarang mostra um aviso único, **"Mantenha seus backups seguros"**, incentivando você a escolher um local de backup diferente — um pendrive externo, um segundo disco ou uma pasta de rede — desde já. Você pode pular isso e alterar a qualquer momento depois, pelo botão **Choose a Backup Folder** na tela de Backup (uma configuração exclusiva para proprietário/administrador). Se a pasta configurada ficar inacessível (por exemplo, um pendrive desconectado), o Sarang volta automaticamente para a pasta local padrão para aquele backup, em vez de falhar silenciosamente, e sinaliza isso na tela. Os backups são sempre salvos em um disco local ou pasta de rede escolhida por você — nunca em qualquer serviço de nuvem.

## Backups automáticos

Um administrador pode ativar o **backup automático** na tela de Backup: ative-o, depois defina de quantos em quantos dias os backups automáticos ocorrem, quantos backups manter (os mais antigos além desse número são excluídos automaticamente) e depois de quantos dias sem backup um lembrete deve ser disparado. Quando ativado, o Sarang verifica, ao iniciar o aplicativo, se já se passaram dias suficientes desde o último backup e cria um automaticamente se for o caso, com uma notificação confirmando que aconteceu.

O Sarang também cria automaticamente um **backup de segurança** do seu banco de dados atual imediatamente antes de qualquer restauração ser realizada (veja abaixo), para que uma restauração possa, ela mesma, ser desfeita se necessário.

## Verificando a integridade do backup e do banco de dados

A tela de Backup mostra dois indicadores em tempo real:
- **Saúde do backup** — se você está protegido (backup feito hoje), atrasado (backup feito na última semana, mas não hoje) ou desprotegido (sem backup, ou com mais de uma semana).
- **Integridade do banco de dados** — uma verificação de que o arquivo do seu banco de dados ativo não está corrompido.

Você também pode clicar no ícone de escudo ao lado de qualquer backup individual para **Verificar** sob demanda — o Sarang reconfere o checksum do arquivo e confirma que ele ainda pode ser aberto e lido corretamente, atualizando seu status de válido/inválido de acordo. Todo backup tem um checksum (SHA-256) calculado no momento da criação, especificamente para que uma adulteração ou corrupção posterior do arquivo possa ser detectada.

## Restaurando a partir de um backup

Clique no ícone de restauração em qualquer backup da lista. O Sarang primeiro valida o arquivo e mostra uma pré-visualização — nome da empresa, data do backup, versão do aplicativo e tamanho do banco de dados — para que você confirme que está restaurando o correto. Confirmar dispara:

1. Um backup de segurança do seu banco de dados *atual* (para que os dados de hoje não se percam se você mudar de ideia).
2. A substituição do banco de dados ativo pelo conteúdo do backup.
3. Um reinício automático do aplicativo para reconectar aos dados restaurados.

A restauração só está disponível para usuários com a permissão adequada (normalmente um administrador). Se uma restauração falhar no meio do caminho, o Sarang tenta reconectar ao seu banco de dados original e relata o erro — o backup de segurança criado na etapa 1 existe justamente para que você também possa se recuperar dessa situação.

## Excluindo backups antigos

Backups podem ser excluídos individualmente na lista (restrito a administrador/permissão específica). Excluir remove tanto o arquivo quanto seu registro; não afeta seus dados ativos.
