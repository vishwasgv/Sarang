# Service / Consultant / Réparation

Ce sont trois des types d'entreprise originaux et généralistes de Sarang — pour toute entreprise qui ne correspond pas à un modèle sectoriel spécifique mais qui effectue un travail de type projet, ticket, ou réparation : un entrepreneur général, un consultant indépendant, un petit atelier de réparation, une société de support informatique, et similaires. Tous les trois exécutent l'interface de Sarang dans votre langue normalement choisie (ces trois ne font pas partie des 24 modèles sectoriels de service spécifiques, il n'y a donc pas de verrouillage à l'anglais ici).

Ils partagent un modèle générique sous-jacent — Projets, Fiches de travail, Tickets de service, Suivi du travail, et Historique client — mais chaque type d'entreprise active une combinaison différente de celui-ci :

- **Service** obtient Projets, Tickets de service, et Suivi du travail — une entreprise qui fait à la fois du travail de type projet et des demandes de support ponctuelles.
- **Consultant** obtient uniquement Projets et Suivi du travail, sans Fiches de travail ni Tickets de service — une pratique pure de projet/heures facturables.
- **Réparation** obtient Fiches de travail et Tickets de service, sans Projets — une entreprise construite autour d'articles individuels que les clients apportent, pas d'engagements multi-tâches.

Tous les trois obtiennent aussi **Historique client**, une vue unifiée de tout ce qui est lié à un client quel que soit celui de ces modèles qui l'a produit.

## Projets (Service, Consultant)

Un projet a un titre, une priorité (Basse/Moyenne/Haute/Urgente), un client et un assigné facultatifs, des heures/montant estimés, et une date d'échéance. Il traverse cinq statuts — Ouvert, En cours, En attente, Terminé, Annulé — que vous changez librement depuis la vue de détail du projet.

Ouvrir l'écran de détail d'un projet vous donne deux choses supplémentaires :

- **Tâches** — une simple liste de contrôle que vous cochez ; la liste de projets affiche une barre de progression « fait / total » calculée à partir de cela.
- **Journaux de travail** — heures enregistrées contre le projet, chacune marquée facturable ou non facturable, avec un total cumulé affiché à la fois sur les vues liste et détail.

## Fiches de travail (Réparation, Service via le modèle générique)

Une fiche de travail est construite pour un article physique qu'un client dépose : un titre, une description d'article, une priorité, un coût estimé, et des dates de réception/attendue/livraison. Elle a son propre cycle de vie en sept étapes — **Reçu → Diagnostic → En réparation → (éventuellement En attente de pièces) → Prêt → Livré**, ou **Annulé** à tout moment avant la livraison. La vue de détail affiche cela comme un suivi visuel d'étapes et fait toujours ressortir le bouton d'action suivante unique (par ex. « Marquer en réparation »), plus une action dédiée « En attente de pièces » pendant qu'une fiche est en réparation. Livrer une fiche de travail est le moment où vous saisissez le coût final réel, séparé de l'estimation d'origine.

## Tickets de service (Service, Réparation)

Un ticket est une demande de support plus légère : titre, description, priorité, une étiquette de catégorie facultative, et un client/assigné facultatifs. Il traverse **Ouvert → En cours → Résolu → Fermé**, et résoudre un ticket permet d'y attacher une note de résolution. Les tickets urgents et non résolus sont signalés par un indicateur de drapeau rouge sur la liste afin qu'ils ne soient pas enterrés.

## Suivi du travail

Une feuille de temps combinée unique à travers tout ce que ce type d'entreprise a activé — un Projet, une Fiche de travail, ou un Ticket — montrant les heures totales, les heures facturables, et les heures non facturables en un coup d'œil. Chaque heure enregistrée ici est facturable ou non selon votre choix au moment de la saisie, et chaque entrée renvoie à la fiche contre laquelle elle a été enregistrée.

## Historique client

Pour tout client, une vue déployable liste chaque facture, projet, ticket de service, et fiche de travail qui lui est lié en un seul endroit, chacun affiché avec son propre statut et sa date — un moyen rapide de répondre à « qu'est-ce que ce client a déjà fait faire chez nous » sans devoir chercher dans des écrans séparés.
