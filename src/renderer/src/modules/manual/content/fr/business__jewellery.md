# Bijouterie

## Ce qui est différent dans ce type d'entreprise

Le prix de vente réel d'un article de bijouterie n'est pas un chiffre fixe que vous définissez une fois — il est calculé au moment même de la vente, à partir du poids net propre de l'article, du cours du marché du jour pour son métal et sa pureté exacts, et d'un frais de façon. Aucun autre mécanisme de tarification dans Sarang ne couvre cela, y compris la facturation au poids/en vrac — cette fonctionnalité (utilisée pour des choses comme le riz ou les épices vendus au poids) tarife selon un tarif fixe par unité de poids que *vous* définissez et qui reste inchangé jusqu'à ce que vous le modifiiez. La tarification de la bijouterie est différente précisément parce que le cours fluctue réellement jour après jour avec le marché des métaux, et doit être recherché à nouveau à chaque fois.

## Configurer un produit de bijouterie

Lors de la création ou de la modification d'un produit, définissez son **Type de métal** (Or, Argent, ou Platine) et sa **Pureté** (par ex. « 22K », « 18K », « 999 »). Saisissez son poids brut et, s'il contient des pierres ou d'autre matière non métallique, un poids de pierre à déduire — Sarang calcule toujours le poids net comme le poids brut moins le poids de pierre lui-même ; il n'est jamais fait confiance à une valeur saisie directement sur le produit, de la même façon que le prix d'une étiquette code-barres n'est jamais fait confiance depuis une saisie externe.

Choisissez ensuite comment le frais de façon est calculé :

- **Montant fixe** — un frais de façon forfaitaire quel que soit le poids.
- **Par gramme (du poids net)** — un tarif multiplié par le poids net de l'article.
- **Pourcentage de la valeur du métal** — un pourcentage de (poids net × cours du jour).

## Cours des métaux

Ouvrez **Cours des métaux** dans la barre latérale pour définir le cours du jour par gramme pour chaque combinaison type de métal et pureté que vous stockez (l'or 22K et l'or 18K se négocient réellement à des cours différents, chaque combinaison obtient donc sa propre ligne). Il n'y a pas de flux de cours internet automatique — cohérent avec la conception hors ligne d'abord de Sarang, vous recherchez le cours du jour où vous le faites habituellement et le saisissez. Mettez cela à jour chaque fois que le cours change ; chaque vente à partir de ce moment utilise la valeur actuelle.

## Comment une vente est tarifée

Au moment de la facturation, ajouter un article de bijouterie au panier recherche le cours actuel de son type de métal et de sa pureté, calcule la valeur du métal (poids net × cours), ajoute le frais de façon, et utilise cela comme prix unitaire de la ligne. Si aucun cours n'a encore été défini pour cette combinaison métal/pureté, Sarang ne vous laissera pas facturer à zéro — vous serez invité à définir d'abord le cours du jour.

## Échange d'ancien métal

Ouvrez **Échange d'ancien métal** pour enregistrer un client échangeant de l'ancien or ou argent contre un nouvel achat. Saisissez le poids brut, un poids de déduction (pour tout contenu non métallique), le type de métal, et la pureté — Sarang recherche le cours du jour pour cette combinaison et calcule la valeur à donner au client (poids net × cours). Ceci est une tenue de registre autonome : la valeur calculée n'est pas automatiquement câblée dans une facture. Le personnel l'applique manuellement comme une remise sur la facture de nouvel achat du client, puis relie l'enregistrement d'échange à cette facture ensuite afin que les deux restent connectés pour vos registres.

## Retours

Bijouterie a le module Retours activé, le même flux de traitement des retours utilisé par Détail, Vêtements, et Chaussures.

## Rapports

**Rapports** inclut un rapport de stock de bijouterie montrant le poids net, le cours actuel, et la valorisation totale regroupés par type de métal et pureté.

## Langue

Bijouterie n'est pas l'un des modèles d'entreprise de service de Sarang — c'est un type d'entreprise par catégorie de produit, il n'est donc **pas** verrouillé à une langue. L'interface complète est disponible dans les 13 langues prises en charge.
