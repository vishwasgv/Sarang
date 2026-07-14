# Distributeur / Vente en gros

Choisir **Distributeur** comme type d'entreprise active l'**application de la limite de crédit**, la **saisie de commande en gros**, les **analyses des créances en cours**, et l'ensemble partagé des modules **Logistique**. Tout le reste — Facturation, Produits, Clients, Stock, Rapports — fonctionne exactement comme décrit dans ces chapitres ; ce chapitre couvre ce qui est spécifique à une entreprise de distribution/vente en gros.

## Saisie de commande en gros

Ouvrez **Saisie de commande en gros** depuis la barre latérale pour construire rapidement une grande commande de gros — recherchez et ajoutez des produits un par un (chaque nouvelle ligne est par défaut à quantité 1 et à son prix de vente normal), puis ajustez les quantités directement. La tarification par volume s'applique automatiquement par ligne selon la quantité commandée :

- 10+ unités → 5 % de remise
- 50+ unités → 10 % de remise
- 100+ unités → 15 % de remise

Le palier le plus élevé auquel la ligne est éligible s'applique ; les petites quantités ordinaires n'obtiennent aucune remise. Recherchez et rattachez un client grossiste à la commande (requis si vous choisissez Crédit comme mode de paiement — les commandes en Espèces, UPI, et Carte n'ont pas besoin de client), notez éventuellement une référence de commande et des notes de livraison, et validez — cela crée une facture normale que vous retrouverez ensuite dans Factures, marquée avec la référence de commande en gros dans ses notes.

## Analyses des créances en cours

Ouvrez **Analyses des créances en cours** pour voir votre exposition totale au crédit à travers tous les clients grossistes ayant un solde impayé : total en cours, combien de clients dépassent actuellement leur limite de crédit, et le solde en cours moyen par client. Une répartition par **ancienneté** montre depuis combien de temps chaque montant est en cours — Courant, 1 à 30 jours, 31 à 60 jours, 61 à 90 jours, 90+ jours — afin que vous puissiez voir non seulement combien est dû mais aussi à quel point c'est en retard. La liste de clients ci-dessous affiche la limite de crédit de chacun, son solde en cours actuel (avec une barre de progression vers sa limite), et son chiffre à 90+ jours, et est triée de sorte que quiconque dépasse sa limite se distingue en rouge. Appuyez sur n'importe quel client pour accéder à sa fiche complète.

## Application de la limite de crédit

Attribuez une **limite de crédit** à un client depuis sa fiche dans **Clients**, et Sarang bloque toute nouvelle vente à *crédit* (depuis Facturation ou Saisie de commande en gros) qui pousserait son solde en cours au-delà de cette limite — rejetée d'emblée à l'enregistrement avec un message montrant son solde en cours, le montant de la nouvelle facture, et sa limite. Cela ne s'applique qu'aux ventes de mode Crédit ; les ventes en Espèces, UPI, Carte, et Paiement fractionné ne sont pas affectées. Une limite de crédit de 0 signifie qu'aucune limite n'est appliquée.

## Logistique & Chaîne d'approvisionnement

Comme le modèle par défaut de Distributeur inclut les modules Logistique, vous obtenez aussi **Flotte**, **Transporteurs**, **Expéditions**, **Bon de Réception**, **Bon de Livraison**, **Registre de Fret**, et **Analyses Logistiques** pour suivre vos propres véhicules de livraison et les expéditions fournisseurs — voir les écrans Logistique sous ces noms dans la barre latérale.

## Ce qui est partagé avec toute entreprise

Facturation, facturation, paiements, Clients, Produits, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres.
