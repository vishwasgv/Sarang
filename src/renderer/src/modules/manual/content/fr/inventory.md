# Stock

## Ajouter et modifier des produits

Ouvrez **Produits** depuis la barre latérale pour voir votre liste complète de produits, filtrable par catégorie. Cliquez sur **Ajouter un produit** pour en créer un, ou sur l'icône de modification sur une ligne pour le modifier. Les champs principaux d'un produit sont :

- **Nom du produit**, **SKU**, **Code-barres**, **Code HSN**, et une courte **Description**.
- **Type de produit** — Standard (un article physique avec un stock suivi) ou Service (aucun stock à suivre, par exemple des frais de main-d'œuvre).
- **Unité** — à choisir dans une liste fixe (PCS, KG, G, L, ML, M, CM, SQFT, SQM, BOX, DOZEN, PACKET, PAIR, SET, BOTTLE, BAG, ROLL, HOUR, SERVICE).
- **Prix de revient**, **Prix de vente**, et **Taux de taxe** — le taux de taxe peut être saisi librement, ou appliqué en un clic depuis n'importe quel taux configuré dans **Settings → Tax Configuration**.
- **Seuil de réapprovisionnement** et **Quantité de réapprovisionnement** — le seuil de stock qui déclenche une alerte de stock faible, et la quantité que vous commanderiez habituellement.
- **Quantité d'ouverture** — le niveau de stock de départ lors de la première création du produit.
- Une **image de produit** facultative.

Les **Catégories** se gèrent depuis le bouton **Catégorie** de l'écran Produits, ce qui permet de regrouper les produits pour le filtrage et les rapports.

Certains types de produits sont optionnels et ne s'affichent que lorsque la fonctionnalité correspondante est activée pour votre entreprise (depuis **Settings → Additional Business Features** ou le modèle propre à votre type d'entreprise) : vente au poids/facturation en vrac, variantes de taille/couleur, articles à louer, et tarification des métaux pour la bijouterie. Ce sont des options par produit — activer une fonctionnalité ne force pas chaque produit dans ce mode. Le suivi des lots/péremption, le suivi des numéros de série/IMEI et les autres comportements de stock propres à un type d'entreprise sont traités dans le chapitre du type d'entreprise concerné, pas ici.

## Niveaux de stock et mouvements

**Stock** (`/inventory`) liste le stock actuel de chaque produit, son seuil de réapprovisionnement, son coût moyen et sa valeur de stock, avec un décompte en continu des articles en stock faible et en rupture affiché sous forme de badges d'alerte en haut. Basculez entre **Tous** et **Stock Faible** à l'aide des onglets.

Pour corriger manuellement un niveau de stock — après un inventaire physique, un dommage, ou un solde d'ouverture — cliquez sur l'icône d'ajustement de stock d'une ligne. Saisissez la nouvelle quantité (pas la différence) ; l'écran vous montre combien sera ajouté ou retiré avant l'enregistrement, et exige un motif. Si vous augmentez le stock, vous pouvez facultativement enregistrer le coût unitaire de cet ajout, qui alimente le coût moyen du produit utilisé pour la valorisation.

Chaque modification du stock — une vente, un ajustement manuel, un bon de commande reçu, un retour, ou une production — est enregistrée comme un **mouvement** immuable. **Inventory Movements** (`/inventory/movements`, accessible via le bouton **Movements**) est un registre en lecture seule de chacun d'eux, filtrable par type (Stock Added, Sale, PO Received, Adjustment, Sale Return, Return Received, Dispatched, Produced) et consultable par recherche, afin que vous puissiez toujours retracer précisément pourquoi le stock d'un produit est ce qu'il est.

## Bons de commande

**Bons de commande** (`/purchase-orders`) permettent de suivre ce que vous avez commandé auprès de vos fournisseurs. Créez-en un avec **New PO** : choisissez un fournisseur, ajoutez des lignes d'articles (recherchés par nom de produit ou SKU) avec quantité, coût unitaire et taux de taxe, et une date de livraison prévue facultative.

Un bon de commande suit un cycle de vie fixe :

1. **Brouillon** — encore modifiable.
2. **Approuver** pour le verrouiller contre toute modification ultérieure.
3. **Recevoir le stock** — c'est l'étape qui ajoute réellement les quantités commandées à votre stock et enregistre un mouvement PURCHASE pour chaque article. Une fois reçu, le bon de commande affiche le niveau de stock résultant de chaque article à côté de la ligne de commande.
4. Un bon de commande en Brouillon ou Approuvé peut à la place être **annulé**, avec un motif.

## Visibilité du stock faible

Les décomptes de stock faible et de rupture de stock apparaissent à trois endroits qui restent toujours synchronisés : les badges d'alerte en haut de l'écran Stock, les tuiles de stock faible et de rupture de stock sur le Tableau de bord, et le filtre de stock faible sur les écrans Produits/Stock. Définir un seuil de réapprovisionnement sensé sur chaque produit (la valeur par défaut est 5) est ce qui rend ces alertes utiles — un produit sans seuil de réapprovisionnement défini ne déclenche pratiquement jamais d'alerte de stock faible.
