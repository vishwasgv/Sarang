# Électronique

Choisir **Électronique** comme type d'entreprise active le **suivi des numéros de série**, le **suivi IMEI**, le **suivi des garanties**, et l'ensemble partagé des modules **Logistique**. Tout le reste — Facturation, Produits, Clients, Stock, Rapports — fonctionne exactement comme décrit dans ces chapitres ; ce chapitre couvre ce qui est spécifique à un magasin d'électronique.

## Suivi série / appareils

Ouvrez **Suivi série** (intitulé « Suivi des appareils et numéros de série » pour Électronique) depuis la barre latérale pour enregistrer des unités de stock individuelles et identifiées de façon unique — pas seulement « combien », mais quelle unité exacte. Ajoutez un appareil un par un avec son produit, numéro de série, durée de garantie en mois, date d'achat, et coût, ou utilisez **Import en masse** pour coller un lot entier de numéros de série d'un coup (un par ligne, avec des colonnes IMEI si pertinent). Chaque appareil porte un statut — **Disponible**, **Vendu**, **Retourné**, ou **Défectueux** — que vous pouvez modifier à tout moment depuis la liste.

Comme un produit suivi par numéro de série représente une seule unité physique, l'ajouter à un panier dans Facturation verrouille sa quantité à 1 — vous ne pouvez pas « vendre 3 » d'un numéro de série spécifique, seulement vendre l'unité elle-même.

## Suivi IMEI

Pour les téléphones et autres appareils porteurs d'IMEI, chaque fiche d'appareil peut aussi porter deux numéros IMEI (double SIM). Un champ dédié **Recherche IMEI** sur l'écran Suivi série vous permet de rechercher instantanément un appareil par IMEI et de voir son statut et sa garantie en un coup d'œil — utile pour les recherches après-vente ou au comptoir de réparation.

## Suivi des garanties

La garantie de chaque appareil est stockée sous forme de durée en mois à partir de sa date d'achat/début de garantie, et Sarang calcule et affiche la date d'expiration réelle directement à côté — affichée comme toujours valide ou clairement marquée **Expirée** une fois passée. Demander à Sarang (si activé) peut aussi répondre à « Quels articles sont encore sous garantie ? » directement à partir de ces données.

## Tickets de réparation / RMA

Un appareil vendu et suivi par numéro de série obtient un bouton **Réparation** sur Suivi série — ouvrez-le pour voir l'historique complet d'entretien de cette unité, ou démarrez un nouveau ticket de réparation pour elle. Un ticket porte un numéro de réclamation et progresse à travers **Reçu → Diagnostiqué → Envoyé au Fournisseur → En Attente de Pièces → Réparé/Remplacé → Retourné au Client** (ou Annulé, seulement avant qu'un remplacement n'ait réellement été expédié). Notez à quel fournisseur vous l'avez envoyé et son propre numéro de RMA s'il part pour une réparation sous garantie.

Si la solution est un simple échange, choisissez **Remplacé** et sélectionnez une unité en stock du même produit comme remplacement — Sarang marque l'unité d'origine Défectueuse, le remplacement Vendu (héritant de la facture de la vente d'origine), et la déduit automatiquement du stock, comme pour toute autre vente. Une réparation ne peut être ouverte que pour une unité réellement vendue — un appareil en stock, jamais vendu, n'a pas encore d'historique d'entretien à suivre.

## Logistique & Chaîne d'approvisionnement

Comme le modèle par défaut d'Électronique inclut les modules Logistique, vous obtenez aussi **Flotte**, **Transporteurs**, **Expéditions**, **Bon de Réception**, **Bon de Livraison**, **Registre de Fret**, et **Analyses Logistiques** pour suivre vos propres véhicules de livraison et les expéditions fournisseurs — voir les écrans Logistique sous ces noms dans la barre latérale.

## Ce qui est partagé avec toute entreprise

Facturation, facturation, paiements, Clients, Produits, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres.
