# Cabinet d'Expert-Comptable

Les écrans de ce type d'entreprise sont uniquement en anglais, quelle que soit la langue que vous avez définie ailleurs dans Sarang.

## La fondation de service partagée

Chaque type d'entreprise basé sur le service dans Sarang — y compris Cabinet d'Expert-Comptable — part des quatre mêmes blocs de construction : **Appointments** (réserver des rendez-vous clients), un **Service Catalog** (la liste des services et leurs prix), **Provider Schedules** (quel expert-comptable/membre du personnel est disponible quand), et une **Notification Queue** automatique qui gère les rappels sans que vous ayez à les envoyer à la main. Le reste de ce chapitre couvre les outils de Sarang pour un cabinet comptable : suivi des échéances de conformité, contrats clients, et suivi du temps.

## Tâches de Conformité

L'écran **Compliance Tasks** est le suivi des échéances de votre cabinet à travers tous les clients — impôt sur le revenu, GST, TDS, dépôts ROC/MCA, audits, et tout ce que vous définissez d'autre. Les tuiles KPI affichent les comptes Overdue, Due Today, Due in 7 Days, et Filed/Done, afin que rien ne passe entre les mailles du filet.

Ajoutez une tâche en choisissant un client, un titre, une catégorie, une date d'échéance, une priorité (Faible/Normale/Haute/Urgente), et en l'assignant optionnellement à un membre du personnel — ou choisissez parmi la **Compliance Library** de votre cabinet de modèles d'événements récurrents pour préremplir automatiquement le titre et la catégorie. Utilisez **Update** sur n'importe quelle tâche pour la faire progresser à travers Pending → In Progress → Filed/Done, en enregistrant la date de dépôt et un numéro d'accusé de réception une fois réellement soumise, et joignez le document réellement déposé ou le reçu d'accusé de réception. Une note en bas de l'écran vous rappelle que les dates de conformité affichées ici sont pour votre propre commodité de suivi et doivent toujours être vérifiées par rapport au calendrier légal réel.

### Dépôts relatifs à l'AGM et listes de contrôle de documents client

Ouvrez **Clients & Checklists** depuis l'écran Compliance Tasks pour définir la **date d'AGM** d'un client. Une fois définie, Sarang génère automatiquement les tâches de dépôt MGT-7, AOC-4, et ADT-1 avec leurs dates d'échéance légales correctes (60/30/15 jours après l'AGM respectivement) — vous n'avez plus besoin de les calculer et de les saisir à la main. Le dépôt de l'AGM elle-même doit encore être ajouté manuellement, car sa propre date d'échéance dépend de la planification du conseil, pas d'un décalage fixe.

Le même modal contient aussi une **liste de contrôle de documents** par client — suivez quels documents (PAN, Aadhaar, Relevé Bancaire, Certificat GST, ou tout élément personnalisé) ont été collectés. Utilisez **Add Standard Checklist** pour amorcer les 4 éléments les plus courants en un clic, puis marquez chacun comme Collecté ou En Attente à mesure que les documents arrivent.

## Contrats

**Engagements** suit les relations client continues au-delà des tâches de conformité ponctuelles : mandats, audits, travail de conseil, et contrats fiscaux. Chaque contrat a un titre, un type, une structure d'honoraires (Fixe, Horaire, ou Mandat Mensuel avec un jour de facturation du mois choisi), des dates de début/fin, et un statut (Actif / Terminé / En pause / Résilié). Les tuiles KPI affichent Active Engagements, Monthly Retainer Revenue, et Fixed Fee Pipeline. Joignez des lettres de mission et des documents justificatifs directement depuis le formulaire de modification.

Pour tout contrat actif avec un montant d'honoraires, **Generate Invoice** crée une véritable facture pour la période de facturation en cours — un mandat mensuel peut être refacturé chaque mois calendaire (il affiche « Invoiced » pour la période en cours une fois facturé, et se rouvre automatiquement le mois suivant).

## Entrées de Temps

L'écran autonome **Time Tracking** enregistre les heures facturables sur des clients ou des projets — date, personnel, description, heures, taux, montant calculé — filtrable par personnel, projet, plage de dates, et statut de facturation, avec des tuiles KPI pour Hours This Month, Unbilled Hours, et Unbilled Amount. Sélectionnez des entrées non facturées et **Generate Invoice** pour les facturer directement ; une fois facturée, une entrée ne peut plus être modifiée ni supprimée.
