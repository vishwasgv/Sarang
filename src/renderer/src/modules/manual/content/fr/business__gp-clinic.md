# Clinique de Médecine Générale

Les écrans de ce type d'entreprise sont uniquement en anglais, quelle que soit la langue que vous avez définie ailleurs dans Sarang.

## La fondation de service partagée

Chaque type d'entreprise basé sur le service dans Sarang — y compris Clinique de Médecine Générale — part des quatre mêmes blocs de construction : **Appointments** (réserver et planifier des visites), un **Service Catalog** (la liste des consultations et leurs prix), **Provider Schedules** (quel médecin est disponible quand), et une **Notification Queue** automatique qui gère les rappels sans que vous ayez à les envoyer à la main. Le reste de ce chapitre couvre ce qui est spécifique à une clinique de médecine générale : notes de consultation et une file d'attente de tickets pour les patients sans rendez-vous.

## Notes de Consultation (Notes de Visite)

Ouvrir la **Consultation Note** d'un rendez-vous vous donne une note clinique structurée, au format SOAP :

- **Patient Information** — nom, âge, motif principal de consultation.
- **S — Subjective** : ce que le patient rapporte (antécédents, symptômes, apparition).
- **Vitals** : tension artérielle (systolique/diastolique), pouls, température, taille, poids — chaque champ est automatiquement signalé (Normal / Bas / Élevé) par rapport à une référence de plage normale enregistrée dès que vous sauvegardez, afin que les mesures hors plage ressortent immédiatement.
- **O — Objective** : constatations de l'examen.
- **A — Assessment** : diagnostic / impression clinique.
- **P — Plan** : plan de traitement, médicaments, examens prescrits.
- **Follow-up** : une date de suivi optionnelle et des instructions.

Cliquez sur **Save Note** au fur et à mesure, puis sur **Finalize** lorsque la consultation est terminée. Une note finalisée devient en lecture seule (affichée avec un badge de cadenas) — cela protège le dossier clinique contre toute modification après coup. Vous pouvez **Print Summary** à tout moment pour remettre au patient (ou conserver dans vos dossiers) un résumé de visite formaté, qui porte une clause de non-responsabilité claire indiquant qu'il s'agit d'un document de commodité généré par Sarang, pas un dossier médical validé — vérifiez toujours avant un usage clinique.

**Prescription.** Ajoutez une véritable ordonnance comme sa propre liste détaillée — nom du médicament, dosage, fréquence, durée, et instructions, une ligne par médicament — séparée du champ de texte libre Plan ci-dessus. **Print Prescription** produit un véritable document d'ordonnance (℞) avec le tableau détaillé des médicaments (contrairement au résumé de visite général, celui-ci est conçu pour servir d'ordonnance réelle, il ne porte donc pas la clause « pas un dossier validé » — il a juste besoin de votre signature/cachet pour être valide).

**Vitals Trend.** Une fois qu'un patient a deux visites ou plus avec des signes vitaux enregistrés, un graphique de tendance apparaît montrant comment une métrique choisie (tension, pouls, température, ou poids) a évolué dans le temps — choisissez quelle métrique tracer depuis la rangée de puces au-dessus du graphique.

**Lettres de référence.** Utiliser l'action existante « Refer to Another Provider » crée une véritable référence ; une fois qu'elle existe, **Print Referral Letter** produit une lettre formelle adressée au médecin destinataire avec le motif de la référence — un document véritablement différent du résumé complet de consultation, conçu pour être remis au patient afin qu'il l'apporte au spécialiste.

## File d'Attente de Tickets

L'écran **Token Queue** gère les patients sans rendez-vous du jour même sans nécessiter de rendez-vous préréservé. Il affiche :

- Un grand affichage **Now Serving** du numéro de ticket actuel et du nom du patient.
- Des puces de comptage pour En attente / Appelé / Vu / Ignoré.
- **Add Walk-in** pour émettre un nouveau ticket (nom du patient, âge, genre, téléphone, notes).
- **Call Next** pour appeler le prochain ticket en attente.

Chaque ticket de la liste peut être appelé, marqué comme vu, ignoré, ou remis en attente — la file se retrie automatiquement en sections « Actuellement Appelé », « En attente », et « Terminé ». Ceci est entièrement séparé de la liste Appointments préréservée — c'est conçu pour la réalité des patients qui arrivent simplement et attendent leur tour.
