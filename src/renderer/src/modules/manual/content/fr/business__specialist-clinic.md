# Clinique de Spécialiste

Les écrans de ce type d'entreprise sont uniquement en anglais, quelle que soit la langue que vous avez définie ailleurs dans Sarang.

## La fondation de service partagée

Chaque type d'entreprise basé sur le service dans Sarang — y compris Clinique de Spécialiste — part des quatre mêmes blocs de construction : **Appointments** (réserver et planifier des visites), un **Service Catalog** (la liste des consultations et procédures que propose votre cabinet), **Provider Schedules** (quel spécialiste est disponible quand), et une **Notification Queue** automatique qui gère les rappels sans que vous ayez à les envoyer à la main. Le reste de ce chapitre couvre ce qui est spécifique à un cabinet de spécialiste.

Sarang n'a délibérément pas de type d'entreprise séparé par spécialité médicale (ORL, ophtalmologie, dermatologie, cardiologie, etc.). À la place, « Clinique de Spécialiste » est construit pour couvrir **n'importe quelle spécialité** via le même Service Catalog générique — vous définissez vos propres types de consultation et de procédure avec vos propres tarifs, et la note clinique ci-dessous s'adapte pour porter des champs spécifiques au spécialiste quelle que soit votre spécialité.

## Notes de Consultation avec Détails de Référence

Ouvrir la **Consultation Note** d'un rendez-vous vous donne la même note SOAP structurée utilisée dans tous les types d'entreprise cliniques de Sarang (Patient Information, Subjective, Vitals avec signalement automatique, Objective, Assessment, Plan, Follow-up) — voir le chapitre *Clinique de Médecine Générale* pour le parcours complet champ par champ — plus une section **Referral Details** unique à Clinique de Spécialiste :

- **Referred By** et **Referral Date** — enregistre qui vous a envoyé ce patient (un médecin extérieur ou une autre clinique) et quand.
- **Referral Reason** — texte libre.

Ceci est distinct de **Refer to Another Provider**, une véritable action dans l'application plus bas sur le même écran : une fois la note enregistrée, vous pouvez réserver un véritable rendez-vous sortant avec un autre prestataire de votre propre clinique (choisissez le prestataire, la date, l'heure, et un motif optionnel) — c'est un véritable rendez-vous réservé, pas juste une note. Chaque référence que vous envoyez affiche son propre statut (Programmée / Terminée / Annulée / Absence) directement sur la note de visite, avec un bouton **Print Referral Letter** produisant une lettre formelle adressée au prestataire destinataire.

La note porte également le même tableau **Prescription** détaillé et le graphique **Vitals Trend** décrits dans le chapitre *Clinique de Médecine Générale* — les deux fonctionnent de manière identique ici.

## File d'Attente de Tickets

Clinique de Spécialiste inclut également l'écran **Token Queue** pour les patients sans rendez-vous du jour même, exactement comme décrit dans le chapitre *Clinique de Médecine Générale* — émettez des tickets pour les patients sans rendez-vous, appelez le prochain patient, et suivez les comptes En attente / Appelé / Vu / Ignoré. Les files d'attente sans rendez-vous sont tout aussi courantes dans les cabinets de spécialistes en consultation externe (campagnes ORL, campagnes ophtalmologiques, cliniques dermatologiques) que dans la médecine générale.

## Impression

**Print Summary** produit un résumé de visite formaté incluant la section de référence lorsqu'elle est remplie, avec la même clause de non-responsabilité clinique utilisée dans tous les documents médicaux de Sarang : c'est un document de commodité généré par Sarang, pas un dossier médical validé — vérifiez toujours avant un usage clinique.
