# Fabrication

Fabrication transforme Sarang d'un système d'achat-revente en un système de fabrication-vente : vous suivez les matières premières entrantes, définissez ce dont un produit fini a réellement besoin pour être fabriqué, exécutez des ordres de production qui consomment des matières et produisent du stock, puis expédiez les produits finis vers les clients. Fabrication obtient aussi par défaut l'ensemble complet des modules Logistique & Chaîne d'approvisionnement (Flotte, Transporteurs, Bon de Réception, Fret), puisque recevoir des livraisons fournisseurs formelles de matières premières fait normalement partie de la gestion d'un site de production.

## 1. Matières premières

**Matières premières** est votre inventaire d'ingrédients/composants, séparé de votre stock de produits habituel. Chaque matière a un nom, une unité (kg, litre, pièce, boîte, et similaires), un seuil de réapprovisionnement, et un coût unitaire. La liste signale tout ce qui est sous son seuil de réapprovisionnement et totalise la valeur actuelle de votre stock.

Le stock ne bouge que via **Ajuster le stock**, qui enregistre l'un de trois types de mouvement — Achat (entrée de stock), Retour (entrée de stock), ou Ajuster à (une correction manuelle) — plus un quatrième type, Consommé, que le système crée automatiquement chaque fois qu'un ordre de production démarre (voir ci-dessous). Chaque mouvement est enregistré avec un solde cumulé dans **Historique des mouvements**, afin que vous puissiez voir exactement pourquoi le stock d'une matière est ce qu'il est.

## 2. Nomenclature (BOM)

Une nomenclature définit ce dont un produit fini a réellement besoin : choisissez le produit, définissez une quantité de sortie par lot, et listez les matières premières qu'il consomme avec une quantité nécessaire et un pourcentage de déchet facultatif. Le déchet gonfle la quantité effectivement consommée (par ex. 5 % de déchet sur 10 kg nécessaires signifie que 10,5 kg sont réellement planifiés pour la consommation). Sarang totalise le coût des matières par lot à partir du coût unitaire actuel de chaque ingrédient — c'est la base de coût qu'un ordre de production utilisera ensuite.

Une seule nomenclature par produit est autorisée ; modifier une nomenclature existante permet de changer les quantités et le déchet mais pas le produit auquel elle correspond.

## 3. Ordres de production

C'est le flux de travail central de la fabrication, et il traverse quatre états :

- **Brouillon** — vous choisissez un produit avec une nomenclature et une quantité planifiée ; Sarang calcule exactement combien de chaque matière première ce plan nécessite.
- **En cours** — démarrer un ordre vérifie que chaque matière première requise a suffisamment de stock ; si quelque chose manque, il vous indique exactement quoi et de combien, et refuse de démarrer. Une fois démarrées, les matières premières sont déduites immédiatement (enregistrées comme un mouvement « Consommé » contre chaque matière) — cela se produit au démarrage, pas à l'achèvement.
- **Terminé** — vous saisissez la quantité réellement produite (elle n'a pas besoin de correspondre au plan). Sarang ajoute cette quantité au stock du produit fini et recalcule son coût moyen en utilisant la même formule de moyenne pondérée que tout autre chemin d'entrée de stock dans Sarang, afin que la base de coût d'un lot fabriqué s'intègre correctement dans votre valorisation de stock et vos rapports de bénéfice.
- **Annulé** — disponible depuis Brouillon ou En cours, avec un motif facultatif. Annuler un ordre ayant déjà consommé des matières premières les restitue au stock.

Chaque ordre de production peut aussi porter une liste de contrôle facultative d'**étapes d'ordre de travail** (par ex. « Mélange », « Cuisson », « Emballage ») que vous cochez une par une au fur et à mesure que la production se déroule réellement sur le terrain — ceci est séparé du suivi des matières/quantités et sert uniquement à suivre le processus physique.

## 4. Suivi des expéditions

Une fois un produit terminé et en stock, **Expédition** enregistre sa sortie : choisissez le produit, une quantité, et éventuellement un client et une destination. Un enregistrement d'expédition commence **Prêt**, passe à **Expédié** (c'est le moment où Sarang déduit réellement la quantité du stock de produits finis — pas à la création), et enfin **Livré**. Créer un enregistrement d'expédition vérifie qu'il y a suffisamment de stock fini avant de vous laisser continuer.

## 5. Produits finis

**Produits finis** liste chaque produit ayant une nomenclature définie — en d'autres termes, tout ce que vous fabriquez réellement plutôt que de simplement revendre. Pour chacun, vous pouvez voir le stock actuel, le prix de vente, et consulter son **historique de production** complet (chaque ordre de production qui l'a déjà produit, quantité planifiée vs. produite, et statut).

## 6. Gestion des fournisseurs

Cet écran est votre répertoire de fournisseurs de matières premières : chaque fournisseur actif ayant au moins une matière première qui lui est liée, avec ses coordonnées, son solde en cours, et une exploration détaillée de exactement quelles matières vous lui achetez (avec le stock actuel de chaque matière, l'indicateur de stock faible, et le coût unitaire). Cela réutilise les mêmes fiches Fournisseur que le reste de Sarang — il n'y a pas de liste séparée de « fournisseur de fabrication » à maintenir.

## 7. Analyses de production

Un tableau de bord de votre activité de fabrication : nombre d'ordres par statut (Brouillon / En cours / Terminé / Annulé), votre **taux de rendement** global (total produit ÷ total planifié sur les ordres terminés), coût total des matières dépensé, et un tableau des ordres récemment terminés montrant le pourcentage de rendement par ordre et le coût par unité — utile pour repérer quels produits produisent systématiquement moins que prévu ou coûtent plus que prévu.
