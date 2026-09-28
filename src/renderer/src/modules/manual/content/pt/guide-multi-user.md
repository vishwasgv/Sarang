# Guia: usar o Sarang em mais de um computador

Algumas lojas precisam que duas ou três pessoas trabalhem ao mesmo tempo: uma no balcão, outra nas compras, outra a conferir as contas. O Sarang consegue fazer isso na rede da sua própria loja. Nada sai pela internet.

## Como funciona

- Um computador guarda todos os dados. Chama-se **servidor**. Mantenha-o ligado, com o Sarang aberto, durante o horário da loja.
- Os outros computadores são **clientes**. Não guardam dados do negócio. Mostram e alteram os dados guardados no servidor.
- Tudo o que viaja entre os computadores é cifrado com um **segredo partilhado** que você escolhe. Está desativado até o ativar.

## O que precisa

- Todos os computadores na mesma rede da loja (o mesmo Wi-Fi ou a mesma rede por cabo).
- Uma licença com **lugares** suficientes. O computador da loja conta como um lugar, e cada outro computador com sessão iniciada ao mesmo tempo usa mais um. A avaliação gratuita permite dois computadores para que possa experimentar. Para acrescentar lugares, escreva para o endereço indicado no ecrã de Licença.

## Configurar o servidor (o computador que guarda os dados)

1. Inicie sessão como proprietário. Vá a **Settings → Business features → Multi-user**.
2. Escolha **Este computador guarda os dados (servidor)**.
3. Anote o **endereço** mostrado (por exemplo 192.168.1.10:47821) e o **segredo partilhado**. Pode mudar o segredo quando quiser com **Criar um segredo novo**.
4. Prima **Guardar e reiniciar o Sarang**.
5. Se outro computador não conseguir ligar-se, permita o Sarang na firewall do Windows deste computador para redes privadas.

## Configurar cada computador cliente

1. Instale o Sarang no computador e abra-o.
2. Na página de início de sessão, prima **Ligação entre computadores (vários computadores)**.
3. Escolha **Este computador liga-se a outro computador (cliente)**. Escreva o endereço do servidor e o segredo partilhado, prima **Testar ligação** e depois **Guardar e reiniciar o Sarang**.
4. Inicie sessão com o seu próprio utilizador e palavra-passe. Crie um utilizador para cada pessoa em **Settings → Users**, para que cada venda e cada alteração mostre quem a fez.

## Trabalhar em conjunto

- Cada pessoa tem o seu próprio início de sessão e as suas próprias permissões.
- Se duas pessoas guardarem no mesmo instante, uma espera um momento pela outra. Números como os das faturas nunca se repetem. Se duas pessoas venderem a última unidade, só uma venda avança.
- Quando alguém abre um cliente, fornecedor ou produto para editar, os outros que abrirem o mesmo registo veem **"… tem isto aberto noutro computador"** e não podem guardar até que ele o feche.
- Quando outro computador altera dados, aparece uma pequena nota: **"… alterou alguns dados noutro computador. Atualizar."** Prima Atualizar para ver o mais recente.
- **Settings → Business features → Multi-user** no servidor mostra quem está ligado e permite desligar um computador.

## O que só funciona no computador servidor

Backups e restauro, importação de ficheiros, o tutorial, a ativação da licença, abrir documentos do disco e a impressão de talões de cozinha fazem-se no computador servidor. Um computador cliente imprime faturas e guarda relatórios (Excel, PDF, CSV) na sua própria impressora e disco.

## Bons hábitos

- Mantenha o servidor com energia estável e faça um backup por dia no servidor. Os clientes não conseguem trabalhar se o servidor estiver desligado.
- Não copie o ficheiro de dados para outros computadores nem abra o mesmo ficheiro a partir de dois computadores pela rede. Use esta funcionalidade. Abrir o mesmo ficheiro a partir de dois computadores pode danificá-lo.
- Mantenha o segredo partilhado privado. Se alguém sair da loja, prima **Criar um segredo novo** e escreva o novo nos outros computadores.
