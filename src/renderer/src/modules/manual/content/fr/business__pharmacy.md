# Pharmacie

Choisir **Pharmacie** comme type d'entreprise active le **suivi des lots**, le **suivi des péremptions**, et l'ensemble partagé des modules **Logistique**. Tout le reste — Facturation, Produits, Clients, Stock, Rapports — fonctionne exactement comme décrit dans ces chapitres ; ce chapitre couvre ce qui est spécifique à une pharmacie.

## Gestion des lots

Ouvrez **Gestion des lots** depuis la barre latérale pour enregistrer chaque lot de stock que vous recevez : produit, numéro de lot, quantité reçue, date de péremption, une date de fabrication facultative, coût unitaire, et de quel fournisseur il provient. Chaque lot suit sa propre **quantité restante** séparément de ce qui a été initialement reçu, et la liste peut être filtrée sur **Tous**, **Bientôt expirés**, ou **Expirés**. Des pastilles d'alerte en haut de l'écran signalent combien de lots expirent dans les 30 jours ou sont déjà expirés, afin qu'une vérification de stock ne soit jamais une surprise. Vous pouvez modifier ultérieurement la date de péremption, la date de fabrication, la quantité restante, ou le coût d'un lot, ou désactiver un lot une fois entièrement utilisé ou passé en perte.

Le rapport **Péremption des Lots** (Rapports → Batch Expiry) convertit ces mêmes données en valeur monétaire : en plus du nombre de lots dans chaque fenêtre de péremption, il affiche désormais la **valeur à risque réelle** dans chaque catégorie, afin que vous puissiez voir d'un coup d'œil non seulement « 12 lots expirent bientôt », mais exactement quelle valeur de stock cela représente — et un chiffre distinct « Valeur à Risque » totalise ce qui est encore récupérable (le stock déjà expiré est une perte définitive, pas quelque chose qu'un réapprovisionnement ou un retour peut corriger, il est donc exclu de ce total).

## Comment la vente puise dans les lots

Vous ne choisissez pas un lot manuellement au moment de la vente — Facturation puise automatiquement dans votre stock par lots, en commençant par le lot qui expire le plus tôt (FIFO par date de péremption), pour tout produit ayant des lots enregistrés. Si le seul stock de lot disponible pour couvrir une vente est déjà expiré, Sarang bloque la vente par défaut plutôt que de laisser silencieusement sortir du stock expiré — vous devrez enregistrer un nouveau lot valide, ou (uniquement si c'est réellement voulu) activer « Autoriser la vente de lots expirés » dans Paramètres pour outrepasser cela. Les retours sur un produit suivi par lot restituent la quantité au bon lot de la même façon, afin que les chiffres de quantité restante restent exacts après un retour.

## Médicaments sur ordonnance (Liste H/H1)

Marquez un produit **Ordonnance Requise** dans sa fiche Produit, et Facturation exigera le nom du patient et le nom du médecin prescripteur avant de vous laisser l'ajouter à un panier — la vente ne peut tout simplement pas être finalisée sans les deux, ce qui vous garde conforme aux exigences de tenue de registre de la Liste H/H1. Un rapport dédié **Ventes de Médicaments sur Ordonnance** (Pharmacie uniquement) liste chaque vente de ce type avec les détails patient/médecin capturés, et s'ouvre désormais avec un graphique **Par Médecin Prescripteur** au-dessus du registre — quels médecins vous envoient le plus d'affaires sur ordonnance cette période, d'un coup d'œil plutôt qu'en faisant défiler tout le registre.

Pour les médicaments narcotiques ou psychotropes (Liste H1/X — une catégorie plus stricte que le simple besoin d'ordonnance), cochez également **Schedule H1/X** dans le formulaire produit (affiché uniquement une fois Prescription Required déjà coché). Chaque vente d'un produit de la Liste H1/X est enregistrée avec les mêmes détails patient/médecin/date que ci-dessus, et un rapport **Registre Liste H1/X** distinct et plus restreint (Rapports → Registre Liste H1/X) répertorie uniquement ces ventes — exactement le sous-ensemble qu'un inspecteur voudrait voir, sans avoir à le filtrer vous-même à partir du registre complet des ordonnances. Cela montre exactement ce que Sarang enregistre (date, produit, quantité, patient, médecin, facture) — ce n'est pas une prétention à un format de registre légal complet.

## Numéro de licence de pharmacie

Saisissez le **Numéro de Licence de Pharmacie** de votre officine sous Paramètres → Profil de l'entreprise — il est spécifique à ce type d'entreprise et ne s'affiche que lorsque Pharmacie est votre type d'entreprise actif.

## Réapprovisionnement automatique depuis le stock faible

Définissez un **Fournisseur par Défaut** sur un produit (à côté de son Seuil/Quantité de Réapprovisionnement dans la fiche Produit), et lorsque ce produit vient à manquer, utilisez **Générer des Commandes de Réapprovisionnement** sur la barre d'alerte de stock faible dans Stock. Sarang rédige un bon de commande par fournisseur, regroupant chaque produit dû ayant un fournisseur par défaut configuré, et ignore tout ce qui est déjà sur un bon de commande ouvert afin qu'exécuter l'opération à nouveau ne crée jamais de doublons — les produits sans fournisseur par défaut défini sont également ignorés, avec un compte affiché afin que vous sachiez ce qui nécessite encore une attention manuelle.

Un produit dont le stock est faible est également vérifié par rapport à son propre **stock de lots proches de la péremption** avant d'être réapprovisionné : si une quantité importante est sur le point d'expirer et que la vitesse de vente récente n'est pas assez rapide pour l'écouler avant cela, le réapprovisionnement est supprimé plutôt que rédigé — commander davantage d'un produit qui ne se vend pas revient simplement à acheter un second lot qui sera lui aussi gaspillé. Les produits supprimés sont comptabilisés dans le même message récapitulatif déjà affiché par l'écran, afin que rien ne soit ignoré silencieusement à votre insu.

## Logistique & Chaîne d'approvisionnement

Comme le modèle par défaut de Pharmacie inclut les modules Logistique, vous obtenez aussi **Flotte**, **Transporteurs**, **Expéditions**, **Bon de Réception**, **Bon de Livraison**, **Registre de Fret**, et **Analyses Logistiques** pour suivre vos propres véhicules de livraison et les expéditions fournisseurs — voir les écrans Logistique sous ces noms dans la barre latérale.

## Ce qui est partagé avec toute entreprise

Facturation, facturation, paiements, Clients, Produits, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres.
