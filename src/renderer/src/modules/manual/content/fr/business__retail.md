# Détail

Choisir **Détail** comme type d'entreprise active **Retours** ainsi que l'ensemble partagé des modules **Logistique**. Tout le reste — Facturation, Produits, Clients, Stock, Rapports — fonctionne exactement comme décrit dans ces chapitres ; ce chapitre couvre ce qui est spécifique à un commerce de détail.

## Retours

Ouvrez **Retours** depuis la barre latérale pour traiter un retour ou un échange client par rapport à une vente passée. Recherchez la facture d'origine par son numéro, et Sarang charge ses articles avec une quantité **Retour maximum** pour chacun — il s'agit de la quantité d'origine moins tout ce qui a déjà été retourné contre cette même facture lors d'une visite antérieure, afin que vous ne puissiez jamais retourner accidentellement plus d'un article que le client n'en a réellement acheté (Sarang vérifie et bloque aussi cela à l'enregistrement, pas seulement dans le sélecteur de quantité).

Choisissez la quantité à retourner pour chaque article à l'aide des boutons +/−, saisissez un motif (requis), et validez. Cela crée une véritable **facture de retour** (avec son propre numéro de facture, préfixé `RET-`) qui inverse proportionnellement le chiffre d'affaires, la remise, et la taxe de la vente d'origine — ce n'est pas un ajustement de stock silencieux, c'est une véritable transaction liée que vous pouvez retrouver ensuite depuis l'une ou l'autre des factures.

## Logistique & Chaîne d'approvisionnement

Comme le modèle par défaut de Détail inclut les modules Logistique, vous obtenez aussi **Flotte**, **Transporteurs**, **Expéditions**, **Bon de Réception**, **Bon de Livraison**, **Registre de Fret**, et **Analyses Logistiques** pour suivre vos propres véhicules de livraison et les expéditions fournisseurs — voir les écrans Logistique sous ces noms dans la barre latérale.

## Ce qui est partagé avec toute entreprise

Facturation, facturation, paiements, Clients, Produits, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres. Un commerce de détail peut aussi activer des extras transversaux indépendamment depuis **Paramètres → Fonctionnalités supplémentaires** — la génération/impression de codes-barres et la facturation au poids/en vrac sont des choix courants pour un commerce de détail, mais sont désactivées par défaut et ne sont pas spécifiques au type d'entreprise Détail.
