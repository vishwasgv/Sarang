# Tableau de bord

## Ce que vous voyez à la connexion

Le **Tableau de bord** est l'écran d'accueil de Sarang. En haut se trouvent le nom de votre entreprise, la date du jour, et un bouton **Actualiser** qui force une lecture fraîche de chaque chiffre de la page (les chiffres sont sinon mis en cache brièvement pour la rapidité).

Si **Demander à Sarang** (l'Assistant IA) a été activé dans **Paramètres → Fonctionnalités supplémentaires**, une zone de question rapide apparaît juste sous l'en-tête — tapez une question en anglais simple sur vos ventes, votre stock, vos clients, ou votre bénéfice et cela ouvre l'écran **Demander à Sarang** avec la réponse.

Les nouvelles entreprises voient ici une courte liste de contrôle **Premiers pas** (ajoutez votre premier produit, ajoutez un client, créez votre première facture) jusqu'à ce que les trois soient faits ou que vous la fermiez.

## Alertes

Au-dessus des tuiles d'indicateurs clés, Sarang fait apparaître un petit nombre d'alertes exploitables lorsqu'elles s'appliquent à vous, chacune colorée en avertissement (jaune) ou danger (rouge) selon la gravité :

- **Stock faible** — un ou plusieurs produits au niveau ou en dessous de leur seuil de réapprovisionnement.
- **Aucune sauvegarde / sauvegarde en retard** — aucune sauvegarde n'a jamais été effectuée, ou il s'est écoulé plus de temps que votre intervalle de rappel depuis la dernière.
- **Solde en cours important** — le total en cours des clients a dépassé un seuil.
- **Rappels en attente** — rappels de service/rendez-vous mis en file d'attente mais pas encore envoyés (avec un lien en un clic pour les consulter).
- **Échec du journal d'audit** — une action récente n'a pas pu être écrite dans le journal d'audit, à vérifier au niveau de l'espace disque/des permissions.
- **Location en retard** — un ou plusieurs articles loués sont en retard de retour (entreprises de Location).

## Tuiles d'indicateurs clés

La grille principale de tuiles couvre : **Ventes du jour**, **Ventes de la semaine**, **Ventes du mois** (chacune avec un pourcentage de tendance par rapport à la période précédente), **Solde en cours**, **Stock** (valeur du stock), **Dépenses totales** ce mois-ci, **Estimation du bénéfice** ce mois-ci, **Articles en stock faible** (un décompte), **Clients** (un décompte), et **Fournisseurs** (un décompte). Les tuiles pour le chiffre d'affaires, la valeur du stock, les dépenses, et le bénéfice sont masquées selon votre niveau de permission — si vous n'avez pas la permission d'analyse correspondante, la tuile affiche « — » au lieu d'un chiffre plutôt que d'être entièrement retirée.

Les entreprises de type Restaurant avec les KOT activés voient en plus deux tuiles au-dessus de la grille pour les KOT en attente et les KOT en cours, chacune renvoyant directement à l'écran des commandes de cuisine.

## Graphiques et répartitions

Sous les tuiles : un graphique de tendance chiffre d'affaires vs dépenses que vous pouvez basculer entre Aujourd'hui/Semaine/Mois/Trimestre/Année ou une plage de dates personnalisée, et un graphique en barres des Meilleurs produits. En dessous, une répartition du Solde en cours (vos meilleurs clients par montant dû) se trouve à côté d'une barre de Santé du stock montrant la répartition entre produits actifs, faibles, et en rupture de stock.

## Activité récente et Actions rapides

Le panneau en bas à gauche liste vos actions enregistrées les plus récentes à travers le système (qui a fait quoi, et quand). Le panneau en bas à droite propose des raccourcis en un clic vers les actions les plus utilisées par les propriétaires : Nouvelle facture, Ajouter un produit, Ajouter un client, Rapports, Stock, et Sauvegarde.

## Coup de projecteur sectoriel

Une petite carte sous Actions rapides s'adapte à votre type d'entreprise, montrant deux à quatre chiffres réellement consultés chaque jour dans ce métier — pas un ensemble générique de tuiles. Chaque type d'entreprise a désormais sa propre carte réelle ; aucun ne revient à une vue par défaut façon Détail. Quelques exemples :

- **Salle de sport/Studio** — abonnements expirant cette semaine et ce mois-ci, et votre nombre d'abonnements actifs, avec un lien direct vers l'écran Abonnements.
- **Avocat** — dossiers ouverts et audiences programmées dans les 7 prochains jours.
- **Studio photo** — séances à venir, séances programmées ce mois-ci, et livraisons en attente de montage.
- **Auto-école** — élèves ayant un examen dans les 14 prochains jours, et combien ont peu de séances restantes sur leur forfait.
- **Clinique médicale/dentaire/kinésithérapie/vétérinaire, Salon de beauté, Gestion d'événements, Couture/Boutique, Lutte antiparasitaire** — rendez-vous de ce mois-ci, taux de complétion, et absences/annulations.
- **Service, Consultant, Architecte, Ingénieur civil, Agence marketing, Agence logicielle, Immobilier** — projets actifs, terminés ce mois-ci, et valeur totale des contrats.
- **Hôtel/Auberge** — chambres occupées, taux d'occupation, et chambres disponibles.
- **Laboratoire d'analyses** — commandes d'analyses ce mois-ci, en attente, et livrées.
- **Institut de formation** — frais dus, élèves avec frais en attente, et montant reçu ce mois-ci.
- **Cabinet d'expertise comptable / Secrétariat d'entreprise** — tâches de conformité ouvertes, combien sont en retard, et combien sont dues cette semaine.
- **Réparation / Centre de service automobile** — fiches de travail ce mois-ci, en attente, et livrées.
- **Agence de placement** — candidats actifs, offres d'emploi ouvertes, et placements ce mois-ci.
- **Restaurant, Bijouterie, Quincaillerie/Verre/Contreplaqué, Distributeur/Grossiste** — conservent leurs cartes déjà existantes (chiffre d'affaires du jour et occupation des tables ; cours des métaux ; créances clients et valeur du stock ; créances en cours et nombre de fournisseurs).
- **Une entreprise générale sans correspondance plus proche** — nombre de factures du jour et solde total en attente : toujours des chiffres réels issus de vos propres données, pas un espace réservé.

Le premier élément de chaque carte renvoie directement à l'écran qu'il résume.
