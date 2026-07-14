# Configurações e Perfil da Empresa

Tudo o que molda o funcionamento do Sarang para o seu negócio fica em **Configurações**, acessada pela barra lateral. A tela de Configurações tem seu próprio menu à esquerda com seções — clique em qualquer uma para abri-la.

## Business Profile

**Configurações → Business Profile** guarda os detalhes impressos em toda nota fiscal e recibo: nome da empresa, nome do proprietário, telefone, e-mail, número de GST/IVA, ID UPI, site e endereço completo (endereço, cidade, estado, CEP). Você também pode enviar um logotipo da empresa (JPG, PNG ou WebP, até 2MB) e escolher se ele aparece no Painel e/ou como uma marca d'água discreta nos documentos impressos.

Se o seu tipo de negócio for **Specialist Clinic**, um campo extra de **Especialidade** aparece (por exemplo, Pediatria, Ortopedia, Otorrino). Clique em **Editar** para alterar qualquer um desses campos, depois em **Salvar Alterações**. País, moeda e modelo de imposto são mostrados aqui apenas como referência, mas são alterados nas seções **Currency & Locale** e **Tax Configuration**, respectivamente.

## Tax Configuration

**Configurações → Tax Configuration** gerencia as alíquotas de GST/IVA/imposto sobre vendas disponíveis no faturamento. Adicione um imposto com um nome (por exemplo, "GST 18%"), um tipo (GST, IVA, Imposto sobre Vendas, Personalizado ou Nenhum), uma alíquota entre 0–100%, e opcionalmente um país e uma marcação de "padrão para este tipo de imposto". Notas fiscais já existentes nunca são afetadas quando você edita ou exclui uma alíquota — excluir apenas a desativa dali em diante.

## Currency & Locale

**Configurações → Currency & Locale** define sua moeda (o Sarang suporta cerca de 150 moedas mundiais), seu formato de número (agrupamento indiano como 1,00,000.00, EUA/Internacional, Europeu, Britânico, Árabe ou Indonésio) e as casas decimais (0, 2 ou 3). Uma pré-visualização em tempo real mostra exatamente como um valor será formatado antes de você salvar.

## Industry Template

**Configurações → Industry Template** é onde você escolhe seu tipo de negócio — Restaurante, Varejo, Farmácia, Ferragens, Distribuidor, Hotel/Pousada, Joalheria, Fabricação, um dos tipos de serviço profissional (Advogado, Arquiteto, Escritório Contábil e muitos outros), e assim por diante. Cada modelo ativa um conjunto específico de módulos de recursos — por exemplo, Restaurante ativa a Gestão de Mesas, a impressão de KOT e o rastreamento de receitas/ingredientes, enquanto Farmácia ativa o rastreamento de lote e validade. A tela mostra a lista exata de módulos em cada opção, para que você saiba exatamente o que está ativando.

Trocar de modelo muda a navegação da barra lateral e o conjunto de recursos imediatamente — sem necessidade de reiniciar — e **todos os dados existentes são preservados**, apenas quais recursos ficam visíveis muda. Como esta é uma escolha única, mudar para um novo modelo substitui o conjunto de módulos atual em vez de somar a ele (uma loja de Varejo que muda para Distribuidor perde o módulo de Devoluções específico do Varejo, a menos que ele também seja ativado separadamente — veja abaixo).

## Additional Business Features

**Configurações → Additional Business Features** permite adicionar módulos de recursos de outros tipos de negócio, além do que o seu Industry Template já oferece — útil se o seu negócio realmente abrange mais de um tipo (por exemplo, uma loja de varejo que também faz comércio atacadista/revenda). Essas opções são independentes do seu Industry Template e podem ser ativadas ou desativadas a qualquer momento:

- **Returns Workflow** — aceite devoluções de produtos com reversão automática de estoque e do razão.
- **Area Pricing Calculator** — precifique por área (m²/pés²), útil para vidro, compensado ou azulejos.
- **Credit Limit Enforcement** — bloqueia uma venda a crédito assim que o saldo pendente de um cliente ultrapassaria o limite de crédito definido para ele. Afeta apenas clientes que realmente têm um limite de crédito definido; clientes avulsos, por padrão, não têm limite e nunca são bloqueados.
- **Bulk Order Workflow** — uma tela separada de pedido em atacado com faixas de desconto por volume para clientes atacadistas/revendedores.
- **Outstanding Analytics** — relatórios extras sobre saldos pendentes de clientes e sua antiguidade.
- **Logistics & Supply Chain** — um pacote que cobre frota, transportadoras, remessas, recebimento de mercadorias (GRN), guias de remessa e controle de frete, para qualquer negócio que transporte mercadorias com veículos próprios ou queira rastrear formalmente as entregas de fornecedores.

Mais dois recursos transversais têm suas próprias seções dedicadas em Configurações, em vez de ficarem nesta lista: **Barcode & Loose Billing** e **AI Assistant** (veja abaixo, e seus próprios capítulos do manual). Desativar qualquer um desses recursos não exclui dados existentes — apenas oculta as telas e fluxos de trabalho relacionados.

## Barcode & Loose Billing

**Configurações → Barcode & Loose Billing** é onde você ativa a geração de código de barras, a impressão de etiquetas de código de barras e o faturamento por peso/a granel. Os três vêm desativados por padrão para todo tipo de negócio. Veja o capítulo *Código de Barras e Faturamento por Peso/a Granel* para todos os detalhes de uso depois de ativados.

## AI Assistant

**Configurações → AI Assistant** ativa o **Ask Sarang**, um assistente de perguntas e respostas offline sobre os dados do seu próprio negócio. Desativado por padrão. Veja o capítulo *Ask Sarang (Assistente de IA)* para saber o que ele pode responder.

## Language

**Configurações → Language** suporta 13 idiomas: Inglês, Hindi, Canarês, Tâmil, Telugo, Malaiala, Marati, Guzerate, Espanhol, Francês, Árabe, Português e Indonésio. Os idiomas são agrupados nas listas **Global** e **Indian Languages**. Selecionar um idioma muda a interface imediatamente — sem necessidade de reiniciar. Escolher Árabe também muda toda a interface automaticamente para o layout da direita para a esquerda.

## Appearance

**Configurações → Appearance** tem dois controles:

- **Dark Mode** — um alternador para um esquema de cores escuro.
- **Print Type** — escolha entre **A4 Invoice** (página inteira, colorido), **Thermal 80mm** (largura padrão de recibo de PDV) ou **Thermal 58mm** (largura estreita de recibo de PDV). Isso determina o formato usado sempre que você imprime uma nota ou recibo.

Ambas as preferências são salvas automaticamente e lembradas na próxima vez que você abrir o Sarang.

## Users & Roles, Security e Backup

Mais três seções ficam neste mesmo menu de Configurações, mas são cobertas em seus próprios capítulos: **Users & Roles** (veja *Usuários e Permissões*), **Security** — onde você altera sua própria senha (veja *Usuários e Permissões*) — e **Backup & Recovery**, que abre a tela dedicada de Backup (veja *Backup e Restauração*).

## About

**Configurações → About** mostra o número da versão instalada e a declaração de transparência do Sarang (quais dados são e não são coletados — nenhum, já que o Sarang é totalmente offline).
