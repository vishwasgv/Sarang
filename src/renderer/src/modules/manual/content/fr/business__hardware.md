# Quincaillerie

Choisir **Quincaillerie** comme type d'entreprise active la **tarification par surface**, l'**application de la limite de crédit**, et l'ensemble partagé des modules **Logistique**. Tout le reste — Facturation, Produits, Clients, Stock, Rapports — fonctionne exactement comme décrit dans ces chapitres ; ce chapitre couvre ce qui est spécifique à une quincaillerie.

## Tarification par surface (calculateur L × l)

Les quincailleries vendent souvent des produits tarifés au pied carré/mètre carré — carreaux, plaques, verre, contreplaqué — où le client ne connaît pas la surface de tête. Dans **Facturation**, toute ligne de panier pour une entreprise Quincaillerie affiche un petit bouton **Surface** à côté de son sélecteur de quantité. L'appuyer ouvre un calculateur longueur × largeur : saisissez les deux dimensions, et Sarang calcule la surface et la définit directement comme quantité de la ligne, dans l'unité de vente du produit. Cela ne change pas la façon dont le produit est tarifé — c'est un calculateur pratique qui remplit la bonne quantité afin que vous n'ayez pas besoin d'une application de calcul séparée au comptoir. Le même calculateur est disponible lors de la création d'un **Devis**, afin qu'une estimation tarifée à la surface soit tout aussi facile à préparer qu'une vente en direct.

Si vous avez la permission de voir les chiffres de profit, la calculatrice affiche aussi un **aperçu de marge** en direct dès que les deux dimensions sont renseignées — le pourcentage de marge exact que cette ligne rapportera à la surface calculée et au prix actuel de la ligne, codé par couleur (vert/orange/rouge) afin que vous puissiez repérer une marge faible ou négative avant de valider la vente. Un caissier sans permission de voir les profits ne voit jamais cette ligne, de la même manière que les chiffres de marge lui sont masqués partout ailleurs dans Sarang.

## Conversion d'unité carton/boîte

Si vous achetez par cartons mais vendez à l'unité, activez la **facturation par lot (pack)** pour un produit et indiquez combien de pièces contient un lot. Lorsque vous recevez du stock, l'Ajustement de Stock propose un mode de saisie « lots reçus » — indiquez le nombre de lots/cartons et Sarang calcule pour vous le nombre de pièces équivalent. Tout le reste (facturation, alertes de stock faible, valorisation) continue de fonctionner en pièces comme d'habitude ; cela ne change que la façon dont vous *saisissez* le stock nouvellement reçu.

Deux endroits lisent cette même taille de carton pour vous donner un chiffre plus intelligent, conscient du carton, plutôt qu'un simple compte de pièces. Dans **Rapports → Rapport de Stock**, le stock d'un produit facturé par lot affiche les deux formes ensemble — par ex. « 100 (4 cartons + 4 pièces) » — afin que vous puissiez voir d'un coup d'œil si vous êtes réduit aux pièces détachées d'un carton ouvert, sans faire la division vous-même. Et lorsque vous utilisez **Stock → Générer des Commandes de Réapprovisionnement** pour un produit facturé par lot tombé sous son niveau de réapprovisionnement, la quantité suggérée est automatiquement arrondie au nombre entier de cartons supérieur — un fournisseur vend des cartons entiers, pas un compte fractionnaire de pièces, donc un brouillon demandant « 37 pièces » n'aurait jamais pu être réellement commandé tel quel.

## Mise au rebut pour dommage / casse

Lorsque vous diminuez le stock pour un dommage ou une casse réels plutôt que pour une correction de routine, choisissez **Dommage** comme catégorie de motif sur le formulaire d'Ajustement de Stock. Cela l'enregistre distinctement d'un ajustement générique, afin que votre historique des Mouvements de Stock et vos rapports puissent distinguer les pertes par casse des corrections de stock ordinaires.

## Application de la limite de crédit

Les quincailleries vendent fréquemment à des entrepreneurs réguliers et à des entreprises à crédit (paiement différé). Attribuez une **limite de crédit** à un client depuis sa fiche dans **Clients**, et Sarang bloquera toute nouvelle vente à *crédit* qui pousserait son solde en cours au-delà de cette limite — la facture est rejetée d'emblée à l'enregistrement avec un message montrant son solde en cours actuel, le montant de la nouvelle facture, et sa limite, plutôt que d'être silencieusement autorisée et remarquée seulement plus tard. Cette vérification ne s'applique qu'aux ventes de mode Crédit ; les ventes en Espèces, UPI, Carte, et Paiement fractionné (payées intégralement immédiatement) ne sont jamais affectées. Une limite de crédit de 0 signifie qu'aucune limite n'est appliquée pour ce client.

C'est exactement ainsi que fonctionne le **compte courant** d'un entrepreneur au quotidien : chaque vente à crédit s'ajoute à son solde au moment où elle a lieu — aucune configuration séparée de « compte courant » n'est nécessaire. Quand vient le moment de faire les comptes, ouvrez **Rapports → Grand livre client**, recherchez l'entrepreneur, et choisissez la plage de dates pour laquelle vous voulez facturer (un mois, ou toute autre période) — cela produit un relevé complet avec solde d'ouverture, chaque transaction dans l'ordre, solde de clôture, et une courbe de tendance du solde, déjà détaillé par article et totalisé, prêt à remettre ou à exporter en PDF.

## Matrice produits à rotation rapide vs. lente

Dans **Rapports → Matrice Produits à Rotation Rapide vs. Lente**, chaque produit vendu dans la période choisie est représenté par un point — sa vitesse de vente (unités par jour) sur un axe, et son pourcentage de marge sur l'autre. Les lignes en pointillés marquent la vélocité médiane et la marge médiane de cette période, divisant le graphique en quatre quadrants : rotation rapide avec une bonne marge, rotation rapide mais marge faible, rotation lente mais qui vaut la peine d'être conservée pour sa marge, et rotation lente avec marge faible également — généralement les candidats les plus évidents à l'arrêt ou au déstockage. Le tableau sous le graphique liste chaque produit avec sa vélocité, sa marge et son quadrant exacts, pour ne jamais avoir à deviner en regardant les points.

## Logistique & Chaîne d'approvisionnement

Comme le modèle par défaut de Quincaillerie inclut les modules Logistique, vous obtenez aussi **Flotte**, **Transporteurs**, **Expéditions**, **Bon de Réception**, **Bon de Livraison**, **Registre de Fret**, et **Analyses Logistiques** pour suivre vos propres véhicules de livraison et les expéditions fournisseurs — voir les écrans Logistique sous ces noms dans la barre latérale.

## Ce qui est partagé avec toute entreprise

Facturation, facturation, paiements, Clients, Produits, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres.
