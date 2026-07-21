# Quincaillerie

Choisir **Quincaillerie** comme type d'entreprise active la **tarification par surface**, l'**application de la limite de crédit**, et l'ensemble partagé des modules **Logistique**. Tout le reste — Facturation, Produits, Clients, Stock, Rapports — fonctionne exactement comme décrit dans ces chapitres ; ce chapitre couvre ce qui est spécifique à une quincaillerie.

## Tarification par surface (calculateur L × l)

Les quincailleries vendent souvent des produits tarifés au pied carré/mètre carré — carreaux, plaques, verre, contreplaqué — où le client ne connaît pas la surface de tête. Dans **Facturation**, toute ligne de panier pour une entreprise Quincaillerie affiche un petit bouton **Surface** à côté de son sélecteur de quantité. L'appuyer ouvre un calculateur longueur × largeur : saisissez les deux dimensions, et Sarang calcule la surface et la définit directement comme quantité de la ligne, dans l'unité de vente du produit. Cela ne change pas la façon dont le produit est tarifé — c'est un calculateur pratique qui remplit la bonne quantité afin que vous n'ayez pas besoin d'une application de calcul séparée au comptoir. Le même calculateur est disponible lors de la création d'un **Devis**, afin qu'une estimation tarifée à la surface soit tout aussi facile à préparer qu'une vente en direct.

## Conversion d'unité carton/boîte

Si vous achetez par cartons mais vendez à l'unité, activez la **facturation par lot (pack)** pour un produit et indiquez combien de pièces contient un lot. Lorsque vous recevez du stock, l'Ajustement de Stock propose un mode de saisie « lots reçus » — indiquez le nombre de lots/cartons et Sarang calcule pour vous le nombre de pièces équivalent. Tout le reste (facturation, alertes de stock faible, valorisation) continue de fonctionner en pièces comme d'habitude ; cela ne change que la façon dont vous *saisissez* le stock nouvellement reçu.

## Mise au rebut pour dommage / casse

Lorsque vous diminuez le stock pour un dommage ou une casse réels plutôt que pour une correction de routine, choisissez **Dommage** comme catégorie de motif sur le formulaire d'Ajustement de Stock. Cela l'enregistre distinctement d'un ajustement générique, afin que votre historique des Mouvements de Stock et vos rapports puissent distinguer les pertes par casse des corrections de stock ordinaires.

## Application de la limite de crédit

Les quincailleries vendent fréquemment à des entrepreneurs réguliers et à des entreprises à crédit (paiement différé). Attribuez une **limite de crédit** à un client depuis sa fiche dans **Clients**, et Sarang bloquera toute nouvelle vente à *crédit* qui pousserait son solde en cours au-delà de cette limite — la facture est rejetée d'emblée à l'enregistrement avec un message montrant son solde en cours actuel, le montant de la nouvelle facture, et sa limite, plutôt que d'être silencieusement autorisée et remarquée seulement plus tard. Cette vérification ne s'applique qu'aux ventes de mode Crédit ; les ventes en Espèces, UPI, Carte, et Paiement fractionné (payées intégralement immédiatement) ne sont jamais affectées. Une limite de crédit de 0 signifie qu'aucune limite n'est appliquée pour ce client.

## Logistique & Chaîne d'approvisionnement

Comme le modèle par défaut de Quincaillerie inclut les modules Logistique, vous obtenez aussi **Flotte**, **Transporteurs**, **Expéditions**, **Bon de Réception**, **Bon de Livraison**, **Registre de Fret**, et **Analyses Logistiques** pour suivre vos propres véhicules de livraison et les expéditions fournisseurs — voir les écrans Logistique sous ces noms dans la barre latérale.

## Ce qui est partagé avec toute entreprise

Facturation, facturation, paiements, Clients, Produits, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres.
