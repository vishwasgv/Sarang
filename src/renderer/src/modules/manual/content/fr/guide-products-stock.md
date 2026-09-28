# Guide : Produits, catégories et stock

Comment configurer ce que vous vendez, garder un stock correct, et comprendre pourquoi un chiffre est ce qu'il est.

## 1. D'abord les catégories (2 minutes, économise des heures)

Les catégories regroupent les produits pour le filtrage et les rapports (par exemple *Ampoules*, *Interrupteurs*, *Câble*).

- **Inventory → Produits → bouton Catégorie** ouvre **Manage Categories** : ajouter, renommer, ajouter une sous-catégorie, ou archiver.
- **Ajout rapide en créant un produit** : dans le formulaire du produit, choisissez **+ Create new category…**, saisissez le nom (et une catégorie parente si c'est une sous-catégorie) et elle est créée et sélectionnée immédiatement.

## 2. Ajouter un produit

**Inventory → Produits → Add Product.**

| Champ | Que saisir |
|---|---|
| Nom du produit | Comment vous et vos clients l'appelez |
| SKU / Code-barres | Votre propre code, ou scannez le code-barres du fabricant |
| Code HSN | Le code de classification des marchandises donné par votre comptable (les services utilisent le SAC) |
| Type de produit | **Standard** (le stock est compté) ou **Service** (pas de stock, par exemple la main-d'œuvre) |
| Unité | PCS, KG, L, M, BOX, etc. |
| Prix de revient | Ce que vous payez par unité, **hors taxe** (le coût du stock n'inclut jamais la taxe d'achat) |
| Prix de vente | Ce que vous facturez par unité. Hors taxe par défaut ; taxe incluse si vous activez **Prices include tax** |
| PVC (MRP) | Le prix maximum imprimé, s'il existe (affiché barré à côté de votre prix) |
| Taux de taxe % | Le taux de GST de ce produit. Saisissez-le, ou cliquez sur un taux dans **Settings → Tax Configuration** |
| Niveau / quantité de réappro | Le niveau de stock qui déclenche une alerte de stock bas, et la quantité habituellement commandée |
| Quantité d'ouverture | Le stock que vous avez déjà en ajoutant le produit |

**Les prix sont hors taxe sauf indication contraire.** Par défaut, Sarang ajoute la taxe en plus à la vente ou à l'achat : un prix de vente de 100 avec 18 pour cent de taxe se vend 118. Si votre prix en rayon inclut déjà la taxe, activez **Prices include tax** (dans Settings, ou l'interrupteur sur chaque document) et Sarang calcule la taxe à l'envers, sans que vous ayez à diviser à la main. Voir *Guide : Taxes et GST*.

Le taux de taxe fixé ici se remplit automatiquement sur les factures, devis, commandes de vente, bons de commande, factures fournisseur et notes de débit lorsque vous choisissez le produit. Vous pouvez toujours le modifier sur une seule ligne.

Les variantes (taille et couleur), la vente au poids, les lots avec péremption, les numéros de série ou IMEI, et les kits (plusieurs produits vendus comme un seul) sont activés selon votre type d'entreprise ou dans **Settings → Additional Business Features**.

## 3. Faire entrer du stock

Le stock monte **uniquement** quand l'un de ces événements se produit :

1. **Receive Stock** sur un Bon de commande approuvé.
2. Un **GRN** dont la ligne est liée à un produit est **validé (Posted)**.
3. **Quantité d'ouverture** lors de la première création du produit.
4. Un **ajustement de stock** (ci-dessous).
5. Un **Retour de vente** qui reprend des marchandises, ou une **production** se termine (fabricants).

Une **Facture fournisseur** seule n'ajoute jamais de stock. Voir *Guide : Acheter auprès des fournisseurs*.

## 4. Faire sortir du stock

Le stock baisse lorsque vous confirmez une vente en Facturation (ou qu'une Commande de vente est facturée), lorsqu'une **Note de débit** renvoie des marchandises, lorsque des marchandises sont utilisées en production, ou lorsque vous l'ajustez à la baisse.

Sarang ne vous laissera pas vendre plus que vous n'avez. Si une vente est bloquée avec *Insufficient stock*, réceptionnez d'abord l'achat ou corrigez le comptage de stock avec un motif. Si vous devez vraiment vendre avant que les marchandises ne soient enregistrées, activez le stock négatif dans **Settings → Business Features → Stock rules** ; la quantité s'affiche alors en dessous de zéro jusqu'à la réception des marchandises.

## 5. Vérifier et corriger le stock

- **Inventory** liste chaque produit avec sa quantité actuelle, son niveau de réappro, son coût moyen et sa valeur de stock. L'onglet **Low Stock** montre ce qu'il faut commander.
- **Ajuster le stock** : cliquez sur l'icône d'ajustement d'une ligne et saisissez la **nouvelle quantité** (pas la différence). Donnez un motif (dommage, comptage, solde d'ouverture). En augmentant le stock, vous pouvez enregistrer le coût des unités ajoutées.
- **Movements** (bouton sur Inventory) est un historique en lecture seule de chaque changement : Stock Added, Sale, PO Received, Adjustment, Sale Return, et plus. Utilisez-le pour répondre à « pourquoi ce chiffre est-il ce qu'il est ? ».
- **Compter le stock** : **Inventory → Stock Counts → New count**. Sarang prend un instantané de ce qu'il pense que vous avez pour chaque article ; vous saisissez ce que vous avez réellement compté, et il affiche la différence et sa valeur. Rien ne change jusqu'à ce que vous appuyiez sur **Post**, qui transforme chaque différence en ajustement de stock (motif : comptage de stock) sur votre emplacement principal. Un seul comptage peut être ouvert à la fois. Les articles avec lots, numéros de série ou péremption sont comptés uniquement par quantité totale. Si la validation est interrompue, le comptage reste ouvert et les lignes déjà validées le restent : appuyez à nouveau sur Post pour terminer le reste. **Reports → Stock Count Variances** montre ce qui manquait ou était en trop.
- **Stock Locations** : gardez un stock séparé pour boutique, entrepôt ou camionnette, et déplacez le stock entre eux.
- **Bin Locations** : **Inventory → Bin Locations** enregistre sur quelle étagère, rayonnage ou casier (par exemple A-3-2) se trouve chaque article dans un emplacement, pour que n'importe qui puisse le trouver. C'est une étiquette saisie à la main : un casier par article et par emplacement, et cela apparaît seulement sur cet écran (pas encore dans les rapports ou listes imprimées).
- **Stock Journal** : **Inventory → Stock Journal** enregistre les marchandises qui changent de forme, comme diviser un carton en paquets : choisissez ce qui sort et ce qui entre et enregistrez-les ensemble. La valeur qui sort est répartie sur les articles entrants selon la quantité. Il ne peut être ni modifié ni annulé une fois enregistré : corrigez une erreur avec une écriture inverse.
- **Promis sur les commandes** : **Inventory** et le rapport Stock Summary montrent, à côté de chaque article, la quantité promise sur les Commandes de vente ouvertes. C'est un rappel, pas un blocage : rien ne vous empêche de vendre un stock promis.

## 6. Réapprovisionner avant la rupture

- Fixez un **Niveau de réappro** sur chaque produit.
- Surveillez les tuiles de stock bas sur le **Dashboard** et les alertes de la cloche. Une alerte de stock bas ouvre **Inventory** au clic.
- Sur l'écran **Inventory**, **Generate Reorder POs** crée des bons de commande en brouillon pour tout ce qui est en dessous de son niveau de réappro, en utilisant le fournisseur par défaut de chaque produit (fixez d'abord un fournisseur par défaut sur le produit).

## 7. Combien vaut mon stock ?

**Inventory** affiche la valeur de chaque produit (quantité x coût moyen). **Reports → Stock Summary**, **Stock Ledger** (chaque mouvement avec ouverture et clôture), **Inventory Ageing** et les rapports de stock par emplacement et de transfert montrent la valorisation, le mouvement et depuis combien de temps les articles sont immobiles. La valorisation suit la méthode utilisée (moyenne, FIFO et autres si activées) et chaque rapport indique qu'il est à la date du jour. Les coûts de fret ou de droits de douane saisis en **coût de revient logistique (landed cost)** sur un achat augmentent le coût de ces articles.

## Erreurs courantes

| Erreur | Ce qui se passe | Correction |
|---|---|---|
| Saisir un nouvel article sur un GRN sans le lier | Le stock n'augmente pas | Utilisez **+ Create product and link** sur la ligne avant de valider |
| Saisir un prix de vente taxe incluse alors que Prices include tax est désactivé | Les clients sont facturés deux fois la taxe | Activez **Prices include tax**, ou saisissez le prix hors taxe |
| Taux de taxe laissé à 0 | La taxe manque sur les documents | Fixez le taux sur le produit |
| Ajuster le stock par la différence | Quantité incorrecte | Saisissez la **nouvelle quantité totale** |
| Supprimer un produit avec historique | Non autorisé | Archivez-le à la place |

**Imprimer des étiquettes de rayon et d'expédition.** **Inventory → Print Labels** imprime des étiquettes d'article ; une expédition a **Print labels** et **Track**, qui affiche sa propre chronologie d'expéditions, de retards et de livraison que vous mettez à jour vous-même (il n'y a pas de suivi transporteur en direct).
