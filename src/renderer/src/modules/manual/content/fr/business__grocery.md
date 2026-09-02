# Épicerie / Magasin Kirana

## Ce qui est différent dans ce type d'entreprise

Un magasin d'Épicerie/Kirana vend un volume élevé de produits à courte durée de conservation (suivi des lots/péremption activé par défaut), accorde un crédit courant « khata » aux clients réguliers, et vend souvent des produits de base comme les céréales, légumineuses et huile en vrac au poids plutôt que préemballés. Épicerie combine le suivi des lots/péremption de Pharmacie avec les modules de limite de crédit et d'analyse des impayés de Distributeur — une combinaison éprouvée, pas une nouveauté.

## Rappel Automatique du Khata (Crédit)

Ouvrez le rapport **Outstanding** — tout client ayant un solde khata en retard obtient son propre rapport de **Niveau de Risque Khata** (voir ci-dessous) avec un bouton **Send Reminder** en un clic à côté de son nom. L'appuyer ouvre WhatsApp avec un message prérempli indiquant son solde impayé, et enregistre quand le rappel a été envoyé afin que le même client ne soit pas rappelé à nouveau pendant au moins 7 jours. Comme pour tout partage WhatsApp dans Sarang, l'application se transfère vers WhatsApp et ne peut pas confirmer que le message a réellement été envoyé — c'est à vous d'appuyer sur envoyer.

## Facturation en Vrac (au Poids)

La facturation en vrac n'est pas exclusive à Épicerie — c'est un interrupteur par produit disponible pour tout type d'entreprise (voir **Produit → Vendre au Poids**). Pour un magasin Kirana, c'est ainsi que les céréales, légumineuses et huile sont généralement tarifées : définissez un prix par kilogramme/litre sur le produit, et l'écran de facturation facture selon le poids saisi au comptoir plutôt qu'un prix fixe par unité.

## Rapports

En plus des rapports standards de Ventes, Inventaire et Finances, Épicerie obtient :

- **Conformité MRP** — chaque ligne de vente passée où le prix unitaire a dépassé le MRP imprimé du produit, avec l'excédent collecté — une vraie vérification de conformité, pas juste un numéro de référence.
- **Pertes de Périssables** — stock radié pour péremption (utilisez le motif **Péremption** lors de l'ajustement de stock pour des produits périmés), par produit et valeur.
- **Alerte de Réapprovisionnement Quotidien** — produits à rotation rapide en rupture de stock imminente, classés par le nombre de jours de stock restants au rythme de vente actuel.
- **Mix Ventes en Vrac vs. Emballées** — quelle part de vos revenus provient des produits en vrac (facturés au poids) par rapport aux SKU préemballés.
- **Niveau de Risque Khata** — chaque client à crédit classé par risque, combinant l'ancienneté de sa dette la plus ancienne avec la tendance (hausse ou baisse) de son solde sur les 30 derniers jours — signale un client régulier glissant vers une créance douteuse avant qu'il ne fasse réellement défaut, pas juste une liste statique de soldes.

## Langue

Épicerie n'est pas l'un des modèles d'entreprise de services de Sarang — c'est un type d'entreprise par catégorie de produit, donc elle n'est **pas** verrouillée par langue. L'interface principale est disponible dans les 13 langues prises en charge.
