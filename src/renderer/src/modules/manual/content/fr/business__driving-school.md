# Auto-école

Auto-école est l'un des 24 modèles d'entreprise de service spécifiques de Sarang. Comme chaque type d'entreprise de ce groupe, les écrans de ce type d'entreprise sont uniquement en anglais, quelle que soit la langue que vous avez définie ailleurs dans Sarang.

Chaque modèle d'entreprise de service partage la même fondation : **Appointments** pour la réservation, un **Service Catalog**, **Provider Schedule** pour les heures de travail du personnel, et une **Notification Queue** en arrière-plan pour les rappels. Auto-école ajoute son propre écran dédié — avec cinq onglets — pour les aspects de la gestion d'une auto-école qui ne rentrent pas dans un rendez-vous générique : profils d'élèves, séances de conduite, véhicules, examens, et forfaits.

## Élèves

Choisissez n'importe quel client existant dans la liste de recherche à gauche pour ouvrir son **profil d'élève** à droite : catégorie de permis (LMV, HMV, deux-roues, ou une combinaison), une catégorie de véhicule préférée, numéro de demande de DL, numéro de permis d'apprenti et date d'émission, et numéro de permis définitif et date d'émission une fois obtenu. C'est le dossier de conformité dont une auto-école a besoin pour suivre la progression d'un élève du permis d'apprenti jusqu'au permis complet.

## Séances de Conduite

Chaque leçon de conduite individuelle est programmée avec un élève, un instructeur, un véhicule actif, une date/heure, une durée, et un point de prise en charge optionnel. Le statut d'une séance progresse à travers **Scheduled → Completed** (ou **No Show**). Une fois terminée, vous pouvez soit :

- saisir des **frais de séance** et générer une facture ponctuelle pour cette seule leçon, soit
- l'échanger contre un **forfait** que l'élève a déjà acheté (voir Forfaits ci-dessous), auquel cas il n'y a pas de facture séparée — elle est marquée « Via package » à la place.

L'onglet Sessions filtre par Aujourd'hui, Toutes, Programmées, ou Terminées.

## Véhicules

La flotte propre de véhicules d'instruction de l'école : numéro d'immatriculation, marque/modèle, catégorie de véhicule (LMV, deux-roues, HMV), un instructeur assigné, et un statut (Actif, Maintenance, Retiré). Seuls les véhicules marqués Actif peuvent être choisis lors de la planification d'une nouvelle séance.

Définissez un **intervalle de service** sur un véhicule — par nombre de séances ou par distance au compteur — et Sarang le signale Due for Service une fois que l'un ou l'autre des seuils est franchi, sur la base des séances réellement terminées et du relevé de compteur que vous enregistrez. Ouvrez **Maintenance** sur un véhicule pour enregistrer un service terminé (compteur, type de service, coût) et voir son historique complet de service.

## Examens

Suit les réservations d'examen réelles d'un élève — examen du permis d'apprenti ou examen de conduite — avec une date d'examen, un centre d'examen, et un résultat : En attente, Réussi, ou Échoué, avec une date de repassage optionnelle s'il ne réussit pas la première fois. Enregistrez quel **instructeur** a formé l'élève, et une carte de résumé **Pass Rate by Instructor** montre le véritable bilan de réussite/échec de chaque instructeur.

## Forfaits

Le schéma de facturation le plus courant d'une auto-école est de vendre un forfait de N leçons d'avance plutôt que de facturer leçon par leçon. **Packages** comporte deux parties :

- **Package Catalog** — définissez le nom d'un forfait, le nombre total de séances, le prix, et à quelle catégorie de véhicule il s'applique.
- **Learner Enrollments** — inscrivez un élève à un forfait, suivez les séances utilisées par rapport au total, et générez la facture du forfait une seule fois (un forfait est facturé comme un tout, pas par séance). Chaque séance programmée sur cette inscription est déduite automatiquement de son compte restant au lieu de nécessiter ses propres frais ou facture.
