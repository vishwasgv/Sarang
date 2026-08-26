# Intrants agricoles & Équipement

## Ce qui est différent dans ce type d'entreprise

Intrants agricoles & Équipement couvre les commerces qui vendent à la fois des intrants agricoles consommables (engrais, pesticides, semences) et des équipements agricoles durables (tracteurs, pulvérisateurs, pompes) côte à côte. Plutôt que d'inventer un nouvel écran pour cela, Sarang lui donne exactement le suivi dont chaque moitié de l'entreprise a réellement besoin, emprunté aux deux secteurs qui résolvent déjà correctement chaque moitié : le suivi des lots et péremptions (la même approche critique pour la sécurité que Pharmacie utilise pour les médicaments) pour les consommables, et le suivi des numéros de série et garanties (la même approche qu'Électronique utilise pour les téléphones) pour l'équipement — moins l'IMEI, qui est spécifique aux téléphones et n'a pas d'équivalent sur un tracteur ou un pulvérisateur.

## Engrais & Pesticides — suivi des lots et péremptions

Chaque produit d'engrais, pesticide, ou semence que vous stockez en lot obtient un numéro de lot, une date de fabrication, et une date de péremption, exactement comme une pharmacie stockant des médicaments. Ouvrez **Suivi des lots** dans la barre latérale pour enregistrer les lots entrants et voir ce qui approche de la péremption. Cela compte pour la même raison que cela compte dans une pharmacie : les produits agrochimiques se dégradent réellement et peuvent devenir dangereux ou inefficaces après leur date de péremption, et un commerçant doit pouvoir répondre à « lequel de mon stock expire le plus tôt » en un coup d'œil plutôt que de deviner de mémoire.

## Équipement agricole — numéros de série et garantie

Les tracteurs, pulvérisateurs motorisés, pompes à eau, et autres équipements durables sont suivis individuellement par numéro de série plutôt que comme une quantité indifférenciée, avec une période de garantie enregistrée pour chaque unité. Ouvrez **Suivi série** dans la barre latérale pour cela. Contrairement à Électronique (qui suit aussi l'IMEI pour les téléphones mobiles), Intrants agricoles n'active délibérément pas le suivi IMEI — c'est un identifiant spécifique aux téléphones qui n'a aucun sens pour un tracteur ou un pulvérisateur, ce champ ne s'applique donc simplement pas ici.

## Entretien d'équipement — Fiches de travail

Lorsqu'un client apporte un équipement pour réparation ou entretien planifié, ouvrez une fiche de travail depuis **Fiches de travail** dans la barre latérale — le même flux de travail générique de fiche de travail que le type d'entreprise Réparation de Sarang utilise. Enregistrez ce qui a été apporté, le travail à effectuer, les pièces utilisées, et les frais de main-d'œuvre, et la fiche de travail peut être facturée une fois le travail terminé.

## Conditions de crédit liées à la récolte

Un client agriculteur a souvent besoin de payer après la récolte, et non au moment de l'achat. Lors de la facturation d'une vente à Crédit, définissez une vraie **date d'échéance** — Sarang affiche un badge de retard sur la facture une fois cette date dépassée (et non la date de vente), et le rapport d'ancienneté des Analyses des Impayés la classe elle aussi par la date d'échéance réelle, afin qu'un paiement différé jusqu'à la récolte ne soit pas signalé comme en retard simplement parce que du temps s'est écoulé depuis la vente.

Saisir une date fixe n'est qu'une supposition — les véritables conditions de crédit d'un agriculteur suivent le calendrier de récolte, pas un nombre de jours fixe. Lors d'une vente à Crédit, au lieu de (ou en plus de) la date d'échéance manuelle, vous pouvez lier la facture à une **Saison de Récolte (Crop Season)** — un événement de récolte réel que vous définissez une fois (p. ex. "Récolte de Blé" le 15 avril) et réutilisez à chaque vente à crédit de cette culture. Sélectionnez-la dans le menu déroulant qui apparaît sous le champ de date d'échéance, ou ajoutez-en une nouvelle directement via **Manage Seasons**. Sarang calcule la véritable date d'échéance de la facture à partir de la prochaine occurrence de récolte de cette saison — celle de cette année si elle n'est pas encore passée, sinon celle de l'année prochaine — de sorte que la date d'échéance soit toujours liée à un événement agricole réel, pas à un nombre de jours arbitraire.

## Conseils Produits Liés à la Culture

Si vous étiquetez un produit avec la culture à laquelle il est destiné via le champ Recommended Crop de sa fiche produit (p. ex. "Blé", "Coton", "Riz" — n'importe quel nom utilisé dans votre région, pas une liste fixe), ce produit devient consultable par culture au point de vente. Dans Facturation, une rangée de puces **Browse by Crop** apparaît au-dessus de la recherche de produits dès qu'un produit est étiqueté — appuyez sur une culture pour voir chaque engrais, pesticide ou semence recommandé pour elle, avec le stock et le prix en direct, et ajoutez-le directement au panier. Cela transforme "quel engrais convient à cette culture ?" d'une chose que le caissier doit mémoriser en une chose consultable en deux appuis.

## Alertes de péremption spécifiques par catégorie

Différentes catégories d'intrants agricoles ont besoin d'un préavis différent — les semences et engrais ont souvent besoin d'un délai plus long qu'un article à rotation rapide. Définissez un **délai d'alerte de péremption** (en jours) par produit pour remplacer la fenêtre d'avertissement standard de 30 jours ; les lots de ce produit affichent alors leur badge d'avertissement selon son propre délai configuré.

## Tableau de bord combiné

Ouvrez **Tableau de bord Agri** pour une vue sur un seul écran des deux moitiés de l'entreprise à la fois — consommables en stock faible, lots expirant/expirés, nombre total d'équipements, et équipements dont la garantie expire bientôt — au lieu de vérifier deux écrans séparés.

Le même tableau de bord suit également les **dates d'entretien dues des équipements** — le prochain entretien programmé d'un tracteur ou d'un pulvérisateur, distinct de l'expiration de sa garantie. Définissez une date d'entretien pour tout équipement enregistré directement depuis le panneau Equipment Service Due du tableau de bord, et Sarang le signale dès qu'il approche de l'échéance ou est en retard. Appuyez sur **Remind** sur une unité signalée pour envoyer au client un rappel WhatsApp avec la date d'échéance.

## Rapports d'Exposition au Crédit Saisonnier et de Remboursement des Agriculteurs

Deux rapports de l'écran Rapports sont spécifiques à ce type d'entreprise. **Exposition au Crédit Saisonnier (Seasonal Credit Exposure)** affiche chaque facture de crédit actuellement impayée répartie par mois d'échéance sur toute l'année civile, ainsi qu'une répartition distincte par Saison de Récolte liée — afin que vous puissiez voir d'un coup d'œil quand votre exposition au crédit atteint son pic dans l'année, ce qui pour la plupart des magasins d'intrants agricoles se concentre autour des mois de récolte. **Historique des Achats et Remboursements par Agriculteur (Farmer-Wise Purchase & Repayment History)** classe chaque client à crédit selon la fiabilité réelle de ses remboursements, les comptes les plus à risque en premier — contrairement au Customer Ledger d'un seul client, il s'agit d'une comparaison entre plusieurs agriculteurs qui vous indique à qui accorder un crédit facile la saison prochaine et de qui recouvrer en premier.

## Logistique & Chaîne d'approvisionnement

Comme les détaillants d'intrants agricoles reçoivent régulièrement des livraisons fournisseurs formelles (sacs d'engrais et équipements arrivant par camion), l'ensemble complet des modules Logistique & Chaîne d'approvisionnement est activé par défaut — Flotte, Transporteurs, Expéditions, Bon de Réception (réception de marchandises), Bon de Livraison, Registre de Fret, et Analyses Logistiques apparaissent tous dans la barre latérale sans avoir besoin de les activer séparément.

## Tout le reste

Facturation, Clients & Fournisseurs, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres — rien dans ce type d'entreprise ne change la façon dont vous facturez une vente ou encaissez un paiement.

## Langue

Intrants agricoles & Équipement n'est pas l'un des secteurs de service professionnel de Sarang, il n'est donc pas verrouillé à une langue — l'interface complète est disponible dans les 13 langues prises en charge par Sarang, tout comme Détail, Pharmacie, ou tout autre type d'entreprise par catégorie de produit.
