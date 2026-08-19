# Clinique de Spécialiste

Les écrans de ce type d'entreprise sont uniquement en anglais, quelle que soit la langue que vous avez définie ailleurs dans Sarang.

## La fondation de service partagée

Chaque type d'entreprise basé sur le service dans Sarang — y compris Clinique de Spécialiste — part des quatre mêmes blocs de construction : **Rendez-vous** (réserver et planifier des visites), un **Catalogue de services** (la liste des consultations et procédures que propose votre cabinet), **Provider Schedules** (quel spécialiste est disponible quand), et une **Notification Queue** automatique qui gère les rappels sans que vous ayez à les envoyer à la main. Le reste de ce chapitre couvre ce qui est spécifique à un cabinet de spécialiste.

Sarang n'a délibérément pas de type d'entreprise séparé par spécialité médicale (ORL, ophtalmologie, dermatologie, cardiologie, etc.). À la place, « Clinique de Spécialiste » est construit pour couvrir **n'importe quelle spécialité** via le même Service Catalog générique — vous définissez vos propres types de consultation et de procédure avec vos propres tarifs, et la note clinique ci-dessous s'adapte pour porter des champs spécifiques au spécialiste quelle que soit votre spécialité.

## Notes de Consultation avec Détails de Référence

Ouvrir la **Consultation Note** d'un rendez-vous vous donne la même note SOAP structurée utilisée dans tous les types d'entreprise cliniques de Sarang (Patient Information, Subjective, Vitals avec signalement automatique, Objective, Assessment, Plan, Follow-up) — voir le chapitre *Clinique de Médecine Générale* pour le parcours complet champ par champ — plus une section **Referral Details** unique à Clinique de Spécialiste :

- **Referred By** et **Referral Date** — enregistre qui vous a envoyé ce patient (un médecin extérieur ou une autre clinique) et quand.
- **Referral Reason** — texte libre.
- **Referring Doctor's Phone** et **Referring Doctor's Email** — coordonnées optionnelles du médecin référent. Ce sont elles qui vous permettent de boucler la boucle : une fois la note finalisée, un bouton **Share** apparaît à côté de Print Summary et envoie au médecin référent un résumé de la visite par WhatsApp ou Email (au format PDF), pour qu'il sache ce qu'il est advenu du patient qu'il vous a envoyé. Ce bouton n'apparaît que lorsqu'un médecin référent est enregistré sur la note et que la note est finalisée — un brouillon n'est pas encore un résultat réel à envoyer. Si vous laissez le téléphone ou l'e-mail vide, l'option de partage correspondante reste simplement désactivée, elle n'échoue pas.

Ceci est distinct de **Refer to Another Provider**, une véritable action dans l'application plus bas sur le même écran : une fois la note enregistrée, vous pouvez réserver un véritable rendez-vous sortant avec un autre prestataire de votre propre clinique (choisissez le prestataire, la date, l'heure, et un motif optionnel) — c'est un véritable rendez-vous réservé, pas juste une note. Chaque référence que vous envoyez affiche son propre statut (Programmée / Terminée / Annulée / Absence) directement sur la note de visite, avec un bouton **Print Referral Letter** produisant une lettre formelle adressée au prestataire destinataire.

Une case à cocher séparée **"This is a second-opinion consultation"** dans la même section signale une visite où le patient a déjà été diagnostiqué ou traité ailleurs et est venu spécifiquement pour un autre avis — distinct d'une référence, puisqu'une visite de deuxième avis ne nécessite pas que quelqu'un l'ait envoyé, et un patient référé ne cherche pas nécessairement un deuxième avis. Une note cochée affiche un badge **Second Opinion** à côté du titre de la note, et alimente le rapport de Conversion de Deuxième Avis ci-dessous.

Un menu déroulant **Case Complexity** juste après la section Assessment vous permet d'étiqueter une visite comme **Routine** ou **Complex** — laissez-le non défini si vous préférez ne pas classer une visite en particulier ; les notes non définies sont simplement exclues du rapport de Mix de Complexité des Cas ci-dessous, plutôt que d'être comptées comme Routinier par défaut.

La note porte également le même tableau **Prescription** détaillé et le graphique **Vitals Trend** décrits dans le chapitre *Clinique de Médecine Générale* — les deux fonctionnent de manière identique ici.

## File d'Attente de Tickets

Clinique de Spécialiste inclut également l'écran **File de tickets** pour les patients sans rendez-vous du jour même, exactement comme décrit dans le chapitre *Clinique de Médecine Générale* — émettez des tickets pour les patients sans rendez-vous, appelez le prochain patient, et suivez les comptes En attente / Appelé / Vu / Ignoré. Les files d'attente sans rendez-vous sont tout aussi courantes dans les cabinets de spécialistes en consultation externe (campagnes ORL, campagnes ophtalmologiques, cliniques dermatologiques) que dans la médecine générale.

Un ajout ici propre à Clinique de Spécialiste : le formulaire **Add Walk-in** comporte une case **"Mark as urgent (referring doctor flagged this as urgent)"**. Un ticket marqué urgent affiche un badge rouge **Urgent** dans la file et est appelé avant les patients arrivés plus tôt — **Call Next** choisit toujours le ticket en attente le plus prioritaire, d'abord les patients urgents, puis par ordre d'arrivée. Utilisez ceci pour un patient sans rendez-vous dont le médecin référent a signalé que le cas devait être vu plus rapidement, pas comme un outil de priorité générale — la plupart des patients sans rendez-vous doivent suivre l'ordre d'arrivée normal.

## Impression

**Print Summary** produit un résumé de visite formaté incluant la section de référence lorsqu'elle est remplie, avec la même clause de non-responsabilité clinique utilisée dans tous les documents médicaux de Sarang : c'est un document de commodité généré par Sarang, pas un dossier médical validé — vérifiez toujours avant un usage clinique.

## Rapports

Ouvrez **Reports → Referral Leaderboard** pour voir quels médecins référents vous envoient le plus de patients sur une plage de dates — une liste classée avec des comptages, plus un graphique en barres des dix premiers. C'est le même champ réel « Referred By » saisi sur la Note de Consultation, enfin agrégé au lieu de rester inutilisé note par note.

Ouvrez **Reports → Second-Opinion Conversion** pour voir, parmi les visites que vous avez marquées comme deuxième avis sur une plage de dates, combien de ces patients sont revenus pour un rendez-vous ultérieur terminé et sont devenus des patients réguliers — un décompte total, un décompte de convertis, et un taux de conversion, plus une ligne par patient avec sa date de visite et (s'il est revenu) sa prochaine date de visite. Seuls les patients liés à une fiche client réelle peuvent être suivis ainsi ; un client de passage sans fiche client n'est compté ni dans un sens ni dans l'autre.

Ouvrez **Reports → Case-Complexity Mix** pour voir la répartition entre cas Routiniers et Complexes sur une plage de dates — un graphique en barres empilées mois par mois, plus le total des cas étiquetés, les décomptes Routinier et Complexe, et le pourcentage global de Complexe. Seules les visites où vous avez défini le menu Case Complexity sont comptées ; une visite non étiquetée n'est pas supposée Routinière, elle est simplement laissée de côté du mix.

Si vous utilisez **Refer to Another Provider** pour envoyer un patient au sein de votre propre clinique, une fois que ce praticien finalise sa propre note sur le rendez-vous de référence, son résultat apparaît automatiquement sur votre note d'origine — sans recherche séparée nécessaire pour savoir ce qui est arrivé à un patient que vous avez référé.
