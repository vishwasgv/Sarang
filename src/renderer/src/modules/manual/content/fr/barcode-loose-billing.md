# Codes-barres & Vente au poids/en vrac

La génération de codes-barres, l'impression d'étiquettes code-barres, et la facturation au poids/en vrac sont des fonctionnalités optionnelles pour les entreprises vendant des produits (détail, pharmacie, commerces généraux, et similaires). Les trois sont désactivées par défaut pour chaque type d'entreprise — rien ne change dans votre façon de facturer tant que vous ne les activez pas.

## Les activer

Allez dans **Paramètres → Codes-barres & Vente au poids** et activez les fonctionnalités dont vous avez besoin, indépendamment les unes des autres :

- **Génération & lecture de codes-barres** — génère automatiquement des codes-barres pour les produits et permet de scanner les codes-barres à la caisse et lors de la recherche de stock.
- **Impression d'étiquettes code-barres** — vous permet d'imprimer des étiquettes code-barres + prix, soit sur une imprimante d'étiquettes thermique, soit sur une imprimante A4/lettre ordinaire.
- **Facturation au poids/en vrac** — vous permet de vendre un produit au poids (par ex. au kg) au lieu de, ou en plus de, un prix de forfait fixe.

Désactiver l'une de ces fonctionnalités plus tard n'affecte pas les codes-barres existants ni les produits déjà configurés en vente au poids.

## Configurer un produit pour la vente au poids

Dans le formulaire de modification du produit (**Produits**), cochez **Vendre au poids**, puis choisissez une unité (kg, g, L, ou mL) et définissez le **Prix par unité** (par ex. 80 ₹ le kg). Un produit est soit vendu en forfaits fixes à son prix de vente normal, soit vendu en vrac au poids à ce prix par unité — pas les deux à la fois.

## Générer des codes-barres

Avec la Génération de codes-barres activée, modifier un produit existant sans code-barres affiche un bouton **Générer** à côté du champ Code-barres — cliquez dessus pour en attribuer un immédiatement. Les nouveaux produits reçoivent automatiquement un code-barres à l'enregistrement si vous n'en avez pas saisi un vous-même. Les codes-barres générés en interne sont des codes EAN-13 standards à 13 chiffres que tout scanner ordinaire peut lire, utilisant une plage de numéros réservée que les codes-barres de fabricants réels n'utilisent jamais, afin qu'ils ne puissent jamais entrer en collision avec un code produit scanné.

Si vous avez activé les codes-barres après avoir déjà des produits dans le système, allez dans **Paramètres → Codes-barres & Vente au poids → Générer les codes-barres manquants** pour attribuer un code-barres à chaque produit qui n'en a pas encore, en un seul clic — sûr à exécuter plusieurs fois, car cela ne touche jamais un produit qui a déjà un code-barres.

## Imprimer des étiquettes

Ouvrez **Imprimer des étiquettes** (accessible une fois l'Impression d'étiquettes code-barres activée). Recherchez ou scannez un produit pour l'ajouter au lot d'étiquettes, définissez le nombre de copies de chaque étiquette dont vous avez besoin (jusqu'à 500 par ligne), choisissez **Feuille A4/Lettre** ou **Imprimante d'étiquettes thermique** comme sortie, puis **Aperçu** ou **Imprimer** directement. Si un produit du lot n'a pas encore de code-barres, Sarang vous indique lesquels et s'arrête — générez d'abord un code-barres pour eux (depuis l'écran Produits ou le remplissage en masse ci-dessus).

La taille physique de l'étiquette thermique (largeur et hauteur en millimètres) se configure une fois pour toutes sous **Paramètres → Codes-barres & Vente au poids → Taille de l'étiquette thermique** pour correspondre aux autocollants de votre imprimante ; cela n'affecte pas l'impression A4/feuille.

## Peser et imprimer un article en vrac

Sur le même écran **Imprimer des étiquettes**, sous **Peser & imprimer un article en vrac** : recherchez un produit vendu en vrac, pesez-le sur n'importe quelle balance, saisissez le poids en grammes, et cliquez sur **Imprimer l'étiquette**. Sarang calcule le prix pour ce poids exact et imprime une étiquette unique avec un code-barres spécial qui encode à la fois le produit et le poids pesé. Scanner cette étiquette à la caisse l'ajoute à la facture en un seul scan, déjà correctement tarifée — aucune saisie manuelle du poids nécessaire à la caisse.

Si vous réimprimez une étiquette pour le même produit exactement au même poids après un changement de prix, Sarang vous avertit à l'écran afin que vous puissiez retrouver et retirer l'ancien autocollant — une ancienne étiquette physique scannée plus tard facturerait sinon l'ancien prix sans aucun moyen de la distinguer d'une nouvelle.

## Vendre des articles en vrac au comptoir

Dans **Facturation**, vous pouvez soit scanner une étiquette de poids imprimée (ajoutée instantanément au panier à son prix et poids imprimés) soit rechercher un produit vendu en vrac par son nom et l'ajouter manuellement — il est ajouté avec une quantité de départ de 1 de son unité configurée, que vous ajustez ensuite au poids réellement pesé avant le passage en caisse. Si le prix imprimé d'une étiquette scannée ne correspond plus au prix actuel du produit, Sarang facture tout de même ce qui est imprimé sur l'étiquette (puisque c'est ce que voit le client) mais affiche un avertissement pour que vous sachiez qu'il faut réimprimer les étiquettes restantes au nouveau prix.

Scanner exactement la même étiquette physique deux fois sur une même facture est signalé par un avertissement (au cas où ce serait un double scan accidentel), bien qu'elle soit tout de même ajoutée — vendre réellement deux colis pesés de façon identique du même article est un scénario réel que le système autorise.
