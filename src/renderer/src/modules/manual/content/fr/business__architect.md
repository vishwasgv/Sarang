# Architecte

Les écrans de ce type d'entreprise sont uniquement en anglais, quelle que soit la langue que vous avez définie ailleurs dans Sarang.

## La fondation de service partagée

Chaque type d'entreprise basé sur le service dans Sarang — y compris Architecte — part des quatre mêmes blocs de construction : **Appointments** (réserver des rendez-vous clients), un **Service Catalog** (la liste des services et leurs prix), **Provider Schedules** (quel membre de l'équipe est disponible quand), et une **Notification Queue** automatique qui gère les rappels sans que vous ayez à les envoyer à la main. Le reste de ce chapitre couvre ce qui est spécifique à un cabinet d'architecture : un pipeline de prospects, la gestion de projets, le suivi du temps, et le registre des plans.

## Prospects

**Leads** est un pipeline de style Kanban de clients potentiels : Ouvert → Contacté → Proposition → Gagné → Perdu. Faites glisser une carte de prospect entre les colonnes pour mettre à jour son statut, ou ajoutez un nouveau prospect avec nom, coordonnées, entreprise, source (Recommandation, Site Web, Visite Spontanée, Réseaux Sociaux, Appel à Froid, Autre), valeur estimée, et un membre de l'équipe assigné.

## Projets

**Service Projects** suit chaque contrat client du contrat à l'achèvement — nom du projet, type, étape, statut (Actif / En pause / Terminé / Annulé), valeur totale du contrat, dates de début et de fin prévue, et un membre de l'équipe assigné. Chaque projet peut porter des **jalons** — des livrables nommés avec leur propre montant et date d'échéance — et une fois qu'un jalon est terminé, générez une facture pour lui directement depuis le projet.

## Entrées de Temps

Enregistrez les heures facturables sur un projet depuis l'écran autonome **Time Tracking** — date, personnel, description, heures, taux, et montant calculé — filtrable par personnel, projet, plage de dates, et statut de facturation. Sélectionnez des entrées non facturées et **Generate Invoice** pour facturer directement le client.

## Registre des Plans

Le **Drawing Register** est le véritable différenciateur quotidien d'un cabinet d'architecture : pour chaque projet, suivez chaque plan que vous émettez — numéro de plan, titre, discipline (Architecturale, Structurelle, MEP, Paysagère, Intérieure), numéro de révision, statut (Brouillon / Émis pour Révision / Approuvé / Remplacé), et date d'émission. Changez le statut d'un plan directement depuis la liste au fur et à mesure qu'il progresse dans la révision, et joignez des fichiers (les documents réels du plan) à chaque révision de plan.

Les plans sont regroupés par numéro de plan, avec la révision actuelle affichée comme ligne principale. Cliquez sur **New Revision** pour émettre la prochaine révision d'un plan — Sarang crée un enregistrement véritablement nouveau et séparé et marque automatiquement le précédent comme Remplacé, afin que vous ayez toujours une véritable comparaison Rév A contre Rév B, pas juste un champ qui a été écrasé. Ouvrez **History** sur n'importe quel plan pour voir toutes les révisions passées.

Déplacer un plan vers **Approved** nécessite d'enregistrer qui a réellement donné son approbation — Sarang vous demandera le nom de l'approbateur s'il n'est pas déjà enregistré, et ne laissera pas le changement de statut se faire sans cela. Cela vous donne une véritable piste d'approbation client, pas juste une étiquette de statut.
