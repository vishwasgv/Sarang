# Avocat / Cabinet Juridique

Les écrans de ce type d'entreprise sont uniquement en anglais, quelle que soit la langue que vous avez définie ailleurs dans Sarang.

## La fondation de service partagée

Chaque type d'entreprise basé sur le service dans Sarang — y compris Avocat / Cabinet Juridique — part des quatre mêmes blocs de construction : **Appointments** (réserver des rendez-vous clients), un **Service Catalog** (la liste des services juridiques et leurs prix), **Provider Schedules** (quel avocat est disponible quand), et une **Notification Queue** automatique qui gère les rappels sans que vous ayez à les envoyer à la main. Le reste de ce chapitre couvre les outils dédiés de Sarang pour un cabinet juridique : gestion des dossiers et suivi du temps.

## Dossiers Juridiques

L'écran **Legal Cases** est un espace de travail complet de gestion de dossiers avec trois onglets :

- **Cases** — chaque dossier avec son numéro de dossier, titre, tribunal, client, prochaine date d'audience, et statut (Actif / Suspendu / Résolu / Clos / Transféré). Ajoutez un nouveau dossier avec numéro de dossier, titre, type de dossier (Civil, Pénal, Familial, Commercial, Immobilier, Arbitrage, Autre), nom/district/état du tribunal, un ID de dossier eCourt optionnel (qui ajoute un lien rapide vers le portail de statut de dossier eCourts), le client, l'avocat en charge, date de dépôt, et honoraires convenus. Les tuiles KPI en haut affichent Active Cases, Today's Hearings, Hearings in 3 Days, et les comptes Closed/Disposed.
- **Upcoming Hearings** — chaque audience programmée dans tous les dossiers, filtrable en Upcoming / Today / All, avec la possibilité de marquer une audience **Done** ou de l'**Adjourn** (en enregistrant un résultat et la prochaine date d'audience) directement depuis la liste.
- **Time Entries** — chaque heure facturable enregistrée dans tous les dossiers, filtrable en Unbilled / Billed / All, avec un total courant de la valeur non facturée.

Ouvrir un dossier affiche son détail complet : informations du dossier, une liste courante d'audiences (ajoutez-en une avec date, heure, salle de tribunal, et objet — Plaidoiries, Preuves, Formulation des Questions, Jugement, Audience de Caution, Ordonnance Provisoire, Autre), et ses entrées de temps. Depuis ici, vous pouvez aussi marquer le dossier **Closed** ou **Disposed**, joindre des documents du dossier (requêtes déposées, ordonnances du tribunal, pièces scannées), et définir une date de prescription/échéance.

## Vérification de conflit d'intérêts

Lorsque vous créez un nouveau dossier, saisissez à la fois le client et un **nom de la partie adverse**. Sarang vérifie — dans les deux sens — si la partie adverse proposée est déjà cliente ailleurs, ou si le client proposé a déjà été enregistré comme partie adverse dans un autre dossier. Si l'un ou l'autre est vrai, une bannière d'avertissement apparaît sur le formulaire New Case affichant le motif. Cette vérification est purement indicative — elle ne bloque jamais l'enregistrement du dossier — car un véritable conflit nécessite votre propre jugement professionnel, pas celui d'un ordinateur.

## Rappels de prescription / échéance

Définissez une **date de prescription** sur un dossier (à la création, ou plus tard depuis le panneau de détail du dossier) pour que Sarang suive son délai de prescription ou sa date limite de dépôt. Vous recevrez un rappel WhatsApp automatique 30 jours avant puis à nouveau 7 jours avant la date, donnant suffisamment de temps pour rassembler documents et instructions. Modifier la date annule les anciens rappels et en programme de nouveaux — vous n'avez jamais besoin de suivre cela à la main.

## Entrées de Temps

Le temps peut être enregistré soit depuis l'intérieur d'un dossier (dans l'écran Legal Cases), soit depuis l'écran autonome **Time Tracking**, qui liste chaque entrée dans tous les dossiers avec date, membre du personnel, description, heures, taux, et montant calculé. Filtrez par personnel, plage de dates, ou statut de facturation. Sélectionnez une ou plusieurs entrées non facturées et cliquez sur **Generate Invoice** pour transformer directement les heures enregistrées en une véritable facture pour le client — les entrées facturées ne peuvent plus être modifiées ni supprimées, préservant l'intégrité de la piste de facturation.
