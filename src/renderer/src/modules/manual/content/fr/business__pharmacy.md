# Pharmacie

Choisir **Pharmacie** comme type d'entreprise active le **suivi des lots**, le **suivi des péremptions**, et l'ensemble partagé des modules **Logistique**. Tout le reste — Facturation, Produits, Clients, Stock, Rapports — fonctionne exactement comme décrit dans ces chapitres ; ce chapitre couvre ce qui est spécifique à une pharmacie.

## Gestion des lots

Ouvrez **Gestion des lots** depuis la barre latérale pour enregistrer chaque lot de stock que vous recevez : produit, numéro de lot, quantité reçue, date de péremption, une date de fabrication facultative, coût unitaire, et de quel fournisseur il provient. Chaque lot suit sa propre **quantité restante** séparément de ce qui a été initialement reçu, et la liste peut être filtrée sur **Tous**, **Bientôt expirés**, ou **Expirés**. Des pastilles d'alerte en haut de l'écran signalent combien de lots expirent dans les 30 jours ou sont déjà expirés, afin qu'une vérification de stock ne soit jamais une surprise. Vous pouvez modifier ultérieurement la date de péremption, la date de fabrication, la quantité restante, ou le coût d'un lot, ou désactiver un lot une fois entièrement utilisé ou passé en perte.

## Comment la vente puise dans les lots

Vous ne choisissez pas un lot manuellement au moment de la vente — Facturation puise automatiquement dans votre stock par lots, en commençant par le lot qui expire le plus tôt (FIFO par date de péremption), pour tout produit ayant des lots enregistrés. Si le seul stock de lot disponible pour couvrir une vente est déjà expiré, Sarang bloque la vente par défaut plutôt que de laisser silencieusement sortir du stock expiré — vous devrez enregistrer un nouveau lot valide, ou (uniquement si c'est réellement voulu) activer « Autoriser la vente de lots expirés » dans Paramètres pour outrepasser cela. Les retours sur un produit suivi par lot restituent la quantité au bon lot de la même façon, afin que les chiffres de quantité restante restent exacts après un retour.

## Logistique & Chaîne d'approvisionnement

Comme le modèle par défaut de Pharmacie inclut les modules Logistique, vous obtenez aussi **Flotte**, **Transporteurs**, **Expéditions**, **Bon de Réception**, **Bon de Livraison**, **Registre de Fret**, et **Analyses Logistiques** pour suivre vos propres véhicules de livraison et les expéditions fournisseurs — voir les écrans Logistique sous ces noms dans la barre latérale.

## Ce qui est partagé avec toute entreprise

Facturation, facturation, paiements, Clients, Produits, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres.
