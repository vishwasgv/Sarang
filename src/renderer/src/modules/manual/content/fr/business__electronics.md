# Électronique

Choisir **Électronique** comme type d'entreprise active le **suivi des numéros de série**, le **suivi IMEI**, le **suivi des garanties**, et l'ensemble partagé des modules **Logistique**. Tout le reste — Facturation, Produits, Clients, Stock, Rapports — fonctionne exactement comme décrit dans ces chapitres ; ce chapitre couvre ce qui est spécifique à un magasin d'électronique.

## Suivi série / appareils

Ouvrez **Suivi série** (intitulé « Suivi des appareils et numéros de série » pour Électronique) depuis la barre latérale pour enregistrer des unités de stock individuelles et identifiées de façon unique — pas seulement « combien », mais quelle unité exacte. Ajoutez un appareil un par un avec son produit, numéro de série, durée de garantie en mois, date d'achat, et coût, ou utilisez **Import en masse** pour coller un lot entier de numéros de série d'un coup (un par ligne, avec des colonnes IMEI si pertinent). Chaque appareil porte un statut — **Disponible**, **Vendu**, **Retourné**, ou **Défectueux** — que vous pouvez modifier à tout moment depuis la liste.

Comme un produit suivi par numéro de série représente une seule unité physique, l'ajouter à un panier dans Facturation verrouille sa quantité à 1 — vous ne pouvez pas « vendre 3 » d'un numéro de série spécifique, seulement vendre l'unité elle-même.

## Suivi IMEI

Pour les téléphones et autres appareils porteurs d'IMEI, chaque fiche d'appareil peut aussi porter deux numéros IMEI (double SIM). Un champ dédié **Recherche IMEI** sur l'écran Suivi série vous permet de rechercher instantanément un appareil par IMEI et de voir son statut et sa garantie en un coup d'œil — utile pour les recherches après-vente ou au comptoir de réparation.

Si le module Réparation/RMA est activé, l'écran Suivi série obtient aussi un champ **Recherche de Service** juste sous Recherche IMEI — recherchez ou scannez un numéro de série OU un IMEI et voyez tout sur cette unité au même endroit : quel produit c'est, quand et à qui elle a été vendue (avec la facture et le prix), et son historique complet de tickets de réparation. C'est conçu exactement pour le moment où un client arrive avec un appareil cassé et aucun papier — une seule recherche vous dit s'il l'a vraiment acheté ici, quand, et ce qui a déjà été fait pour le réparer. Demandez à Sarang (si activé) peut aussi répondre directement à une question comme « rechercher le numéro de série [numéro] » de la même façon.

## Suivi des garanties

La garantie de chaque appareil est stockée sous forme de durée en mois à partir de sa date d'achat/début de garantie, et Sarang calcule et affiche la date d'expiration réelle directement à côté — affichée comme toujours valide ou clairement marquée **Expirée** une fois passée. Demander à Sarang (si activé) peut aussi répondre à « Quels articles sont encore sous garantie ? » directement à partir de ces données.

## Tickets de réparation / RMA

Un appareil vendu et suivi par numéro de série obtient un bouton **Réparation** sur Suivi série — ouvrez-le pour voir l'historique complet d'entretien de cette unité, ou démarrez un nouveau ticket de réparation pour elle. Un ticket porte un numéro de réclamation et progresse à travers **Reçu → Diagnostiqué → Envoyé au Fournisseur → En Attente de Pièces → Réparé/Remplacé → Retourné au Client** (ou Annulé, seulement avant qu'un remplacement n'ait réellement été expédié). Notez à quel fournisseur vous l'avez envoyé et son propre numéro de RMA s'il part pour une réparation sous garantie.

Si la solution est un simple échange, choisissez **Remplacé** et sélectionnez une unité en stock du même produit comme remplacement — Sarang marque l'unité d'origine Défectueuse, le remplacement Vendu (héritant de la facture de la vente d'origine), et la déduit automatiquement du stock, comme pour toute autre vente. Une réparation ne peut être ouverte que pour une unité réellement vendue — un appareil en stock, jamais vendu, n'a pas encore d'historique d'entretien à suivre.

Dès qu'un ticket passe à **Envoyé au Fournisseur**, Sarang démarre automatiquement un délai de 30 jours — sans étape supplémentaire. Si une unité reste chez le fournisseur au-delà de ce délai, elle est marquée **En Retard** directement dans la liste des Tickets de Réparation (avec le nombre de jours réellement écoulés), l'en-tête de l'écran affiche un compte des retards en cours, et une alerte apparaît aussi sur le Tableau de Bord — pour qu'une unité coincée chez un fournisseur pendant plus d'un mois ne passe jamais inaperçue.

Pour avoir une vue complète de toutes les RMA ouvertes, pas seulement celles en retard, ouvrez **Rapports → Rapport d'Ancienneté RMA** : chaque unité actuellement chez un fournisseur, classée de la plus ancienne à la plus récente, avec un graphique montrant exactement depuis combien de jours chacune est partie — celles qui dépassent la barre des 30 jours ressortent en rouge.

Lorsqu'un ticket de réparation part pour une réparation sous garantie chez un fournisseur, vous pouvez aussi suivre ce que le fournisseur vous doit en retour. Dans la vue détaillée du ticket, cliquez sur **Enregistrer une Réclamation** et saisissez le montant que vous réclamez au fournisseur — Sarang tient un total courant Réclamé / Récupéré / Impayé juste là. Au fur et à mesure que le fournisseur vous rembourse, en une fois ou en plusieurs fois, enregistrez chaque paiement avec **Enregistrer un Recouvrement** ; la réclamation se ferme automatiquement dès que le montant récupéré atteint le montant réclamé. Si un fournisseur ne paiera jamais (par exemple s'il rejette la réclamation), utilisez **Passer en Perte** pour la fermer sans recouvrement. Chaque réclamation ouverte et fermée sur tous les tickets est résumée dans **Rapports → Grand Livre de Recouvrement Fournisseur**, avec le total impayé sur tous les fournisseurs et un graphique de vos plus grosses réclamations impayées.

Vous pouvez aussi assigner un technicien à un ticket de réparation — à la prise en charge lors de sa création, ou à tout moment par la suite depuis la vue détaillée du ticket. Dès qu'un ticket a à la fois un technicien et une date de livraison complétée, il est intégré dans **Rapports → Délai de Réparation par Technicien** : délai de réparation moyen, le plus rapide et le plus lent par technicien, avec un graphique les classant du plus rapide au plus lent. C'est un véritable indicateur de qualité de service — le genre de chiffre qui vous dit sur qui compter pour un travail urgent, et qui pourrait avoir besoin d'un coup de main.

## Logistique & Chaîne d'approvisionnement

Comme le modèle par défaut d'Électronique inclut les modules Logistique, vous obtenez aussi **Flotte**, **Transporteurs**, **Expéditions**, **Bon de Réception**, **Bon de Livraison**, **Registre de Fret**, et **Analyses Logistiques** pour suivre vos propres véhicules de livraison et les expéditions fournisseurs — voir les écrans Logistique sous ces noms dans la barre latérale.

## Ce qui est partagé avec toute entreprise

Facturation, facturation, paiements, Clients, Produits, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres.
