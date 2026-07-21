# Pharmacie

Choisir **Pharmacie** comme type d'entreprise active le **suivi des lots**, le **suivi des péremptions**, et l'ensemble partagé des modules **Logistique**. Tout le reste — Facturation, Produits, Clients, Stock, Rapports — fonctionne exactement comme décrit dans ces chapitres ; ce chapitre couvre ce qui est spécifique à une pharmacie.

## Gestion des lots

Ouvrez **Gestion des lots** depuis la barre latérale pour enregistrer chaque lot de stock que vous recevez : produit, numéro de lot, quantité reçue, date de péremption, une date de fabrication facultative, coût unitaire, et de quel fournisseur il provient. Chaque lot suit sa propre **quantité restante** séparément de ce qui a été initialement reçu, et la liste peut être filtrée sur **Tous**, **Bientôt expirés**, ou **Expirés**. Des pastilles d'alerte en haut de l'écran signalent combien de lots expirent dans les 30 jours ou sont déjà expirés, afin qu'une vérification de stock ne soit jamais une surprise. Vous pouvez modifier ultérieurement la date de péremption, la date de fabrication, la quantité restante, ou le coût d'un lot, ou désactiver un lot une fois entièrement utilisé ou passé en perte.

## Comment la vente puise dans les lots

Vous ne choisissez pas un lot manuellement au moment de la vente — Facturation puise automatiquement dans votre stock par lots, en commençant par le lot qui expire le plus tôt (FIFO par date de péremption), pour tout produit ayant des lots enregistrés. Si le seul stock de lot disponible pour couvrir une vente est déjà expiré, Sarang bloque la vente par défaut plutôt que de laisser silencieusement sortir du stock expiré — vous devrez enregistrer un nouveau lot valide, ou (uniquement si c'est réellement voulu) activer « Autoriser la vente de lots expirés » dans Paramètres pour outrepasser cela. Les retours sur un produit suivi par lot restituent la quantité au bon lot de la même façon, afin que les chiffres de quantité restante restent exacts après un retour.

## Médicaments sur ordonnance (Liste H/H1)

Marquez un produit **Ordonnance Requise** dans sa fiche Produit, et Facturation exigera le nom du patient et le nom du médecin prescripteur avant de vous laisser l'ajouter à un panier — la vente ne peut tout simplement pas être finalisée sans les deux, ce qui vous garde conforme aux exigences de tenue de registre de la Liste H/H1. Un rapport dédié **Ventes de Médicaments sur Ordonnance** (Pharmacie uniquement) liste chaque vente de ce type avec les détails patient/médecin capturés.

## Numéro de licence de pharmacie

Saisissez le **Numéro de Licence de Pharmacie** de votre officine sous Paramètres → Profil de l'entreprise — il est spécifique à ce type d'entreprise et ne s'affiche que lorsque Pharmacie est votre type d'entreprise actif.

## Réapprovisionnement automatique depuis le stock faible

Définissez un **Fournisseur par Défaut** sur un produit (à côté de son Seuil/Quantité de Réapprovisionnement dans la fiche Produit), et lorsque ce produit vient à manquer, utilisez **Générer des Commandes de Réapprovisionnement** sur la barre d'alerte de stock faible dans Stock. Sarang rédige un bon de commande par fournisseur, regroupant chaque produit dû ayant un fournisseur par défaut configuré, et ignore tout ce qui est déjà sur un bon de commande ouvert afin qu'exécuter l'opération à nouveau ne crée jamais de doublons — les produits sans fournisseur par défaut défini sont également ignorés, avec un compte affiché afin que vous sachiez ce qui nécessite encore une attention manuelle.

## Logistique & Chaîne d'approvisionnement

Comme le modèle par défaut de Pharmacie inclut les modules Logistique, vous obtenez aussi **Flotte**, **Transporteurs**, **Expéditions**, **Bon de Réception**, **Bon de Livraison**, **Registre de Fret**, et **Analyses Logistiques** pour suivre vos propres véhicules de livraison et les expéditions fournisseurs — voir les écrans Logistique sous ces noms dans la barre latérale.

## Ce qui est partagé avec toute entreprise

Facturation, facturation, paiements, Clients, Produits, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres.
