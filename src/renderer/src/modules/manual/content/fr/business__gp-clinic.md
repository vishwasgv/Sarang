# Clinique de Médecine Générale

Les écrans de ce type d'entreprise sont uniquement en anglais, quelle que soit la langue que vous avez définie ailleurs dans Sarang.

## La fondation de service partagée

Chaque type d'entreprise basé sur le service dans Sarang — y compris Clinique de Médecine Générale — part des quatre mêmes blocs de construction : **Rendez-vous** (réserver et planifier des visites), un **Catalogue de services** (la liste des consultations et leurs prix), **Provider Schedules** (quel médecin est disponible quand), et une **Notification Queue** automatique qui gère les rappels sans que vous ayez à les envoyer à la main. Le reste de ce chapitre couvre ce qui est spécifique à une clinique de médecine générale : notes de consultation et une file d'attente de tickets pour les patients sans rendez-vous.

## Notes de Consultation (Notes de Visite)

Ouvrir la **Consultation Note** d'un rendez-vous vous donne une note clinique structurée, au format SOAP :

- **Patient Information** — nom, âge, motif principal de consultation.
- **S — Subjective** : ce que le patient rapporte (antécédents, symptômes, apparition).
- **Vitals** : tension artérielle (systolique/diastolique), pouls, température, taille, poids — chaque champ est automatiquement signalé (Normal / Bas / Élevé) par rapport à une référence de plage normale enregistrée dès que vous sauvegardez, afin que les mesures hors plage ressortent immédiatement.
- **O — Objective** : constatations de l'examen.
- **A — Assessment** : diagnostic / impression clinique.
- **Diagnosis Category** (optionnel) : une courte étiquette de catégorie — Infection, Suivi de Maladie Chronique, Blessure, et similaires — distincte du texte libre d'Assessment ci-dessus. L'étiqueter alimente **Reports → Diagnosis-Category Trend**, choisissez donc dans la liste suggérée ou saisissez la vôtre si aucune ne convient.
- **P — Plan** : plan de traitement, médicaments, examens prescrits.
- **Follow-up** : une date de suivi optionnelle et des instructions.

Cliquez sur **Save Note** au fur et à mesure, puis sur **Finaliser** lorsque la consultation est terminée. Une note finalisée devient en lecture seule (affichée avec un badge de cadenas) — cela protège le dossier clinique contre toute modification après coup. Vous pouvez **Print Summary** à tout moment pour remettre au patient (ou conserver dans vos dossiers) un résumé de visite formaté, qui porte une clause de non-responsabilité claire indiquant qu'il s'agit d'un document de commodité généré par Sarang, pas un dossier médical validé — vérifiez toujours avant un usage clinique.

**Prescription.** Ajoutez une véritable ordonnance comme sa propre liste détaillée — nom du médicament, dosage, fréquence, durée, et instructions, une ligne par médicament — séparée du champ de texte libre Plan ci-dessus. **Print Prescription** produit un véritable document d'ordonnance (℞) avec le tableau détaillé des médicaments (contrairement au résumé de visite général, celui-ci est conçu pour servir d'ordonnance réelle, il ne porte donc pas la clause « pas un dossier validé » — il a juste besoin de votre signature/cachet pour être valide).

**Vitals Trend.** Une fois qu'un patient a deux visites ou plus avec des signes vitaux enregistrés, un graphique de tendance apparaît montrant comment une métrique choisie (tension, pouls, température, ou poids) a évolué dans le temps — choisissez quelle métrique tracer depuis la rangée de puces au-dessus du graphique.

**Référer un patient.** Utilisez « Refer to Another Provider » pour réserver un véritable rendez-vous avec un autre praticien — une fois qu'il existe, **Print Referral Letter** produit une lettre formelle adressée au médecin destinataire avec le motif de la référence, un document véritablement différent du résumé complet de consultation, conçu pour être emporté par le patient. Une fois que ce rendez-vous de référence a lieu et que sa propre note est finalisée, l'évaluation du praticien destinataire apparaît ici même sous forme de ligne **Outcome** sous la référence, afin que vous n'ayez pas à aller chercher sa note séparément pour voir ce qu'il a trouvé.

**Résultat de Référence Sortante.** Toutes vos références sortantes, au même endroit — ouvrez **Reports → Referral-Out Outcome** et choisissez une plage de dates. Vous verrez combien de références vous avez faites, combien ont désormais un résultat enregistré, et combien sont encore en attente, plus un tableau de chaque référence avec son statut et son résultat (une fois disponible).

**Tendance par Catégorie de Diagnostic.** Chaque fois que vous étiquetez une Diagnosis Category sur une note de consultation, cela alimente **Reports → Diagnosis-Category Trend** — choisissez une plage de dates et vous verrez un graphique en lignes avec une ligne par catégorie, mois par mois, plus un tableau de répartition. Ceci est distinct du texte d'Assessment lui-même : Assessment est votre note clinique en texte libre, tandis que la catégorie est une courte étiquette purement destinée à repérer des tendances dans le temps (par ex. « les infections augmentent ce trimestre »). Les visites sans catégorie étiquetée comptent toujours dans votre total de visites mais n'apparaissent pas sur le graphique, puisqu'il n'y a rien pour les regrouper.

## File d'Attente de Tickets

L'écran **File de tickets** gère les patients sans rendez-vous du jour même sans nécessiter de rendez-vous préréservé. Il affiche :

- Un grand affichage **Now Serving** du numéro de ticket actuel et du nom du patient.
- Des puces de comptage pour En attente / Appelé / Vu / Ignoré.
- **Add Walk-in** pour émettre un nouveau ticket (nom du patient, âge, genre, téléphone, notes).
- **Call Next** pour appeler le prochain ticket en attente.

Chaque ticket de la liste peut être appelé, marqué comme vu, ignoré, ou remis en attente — la file se retrie automatiquement en sections « Actuellement Appelé », « En attente », et « Terminé ». Ceci est entièrement séparé de la liste Appointments préréservée — c'est conçu pour la réalité des patients qui arrivent simplement et attendent leur tour.

Pour voir quelle part de votre journée est constituée de patients sans rendez-vous par rapport aux rendez-vous préréservés, ouvrez **Reports → Walk-in vs. Appointment Ratio** et choisissez une plage de dates. Cela affiche votre répartition totale en pourcentage, plus un graphique en barres jour par jour, pour que vous sachiez en un coup d'œil si votre clinique fonctionne principalement sur rendez-vous ou principalement avec des personnes qui se présentent simplement.

## Rappel de Condition Chronique

Pour les patients ayant des affections continues — diabète, hypertension et similaires — nécessitant un suivi périodique, qu'ils réservent ou non un nouveau rendez-vous, l'écran **Chronic Recall** (dans la barre latérale) vous permet d'étiqueter un patient avec une affection et un calendrier de rappel, distinct de toute visite unique.

- **Tag Condition** — choisissez le patient, nommez l'affection (des affections courantes comme Diabetes et Hypertension sont suggérées, mais vous pouvez saisir n'importe quelle affection), enregistrez éventuellement la date du diagnostic, et définissez la date de cette visite ainsi que la prochaine date de rappel souhaitée.
- La liste classe chaque patient suivi en **Overdue**, **Due Soon** (dans les 7 jours), **This Month**, et **Upcoming** — cliquez sur un patient pour enregistrer sa visite de suivi réelle et définir la prochaine date de rappel, de la même manière que vous avez défini la première.
- Chaque fois que vous enregistrez un suivi, Sarang note discrètement s'il a eu lieu à la date de rappel prévue ou avant. Au fil du temps, cela construit un véritable **pourcentage de conformité** — affiché en haut de l'écran et sur la carte Chronic Recall de votre Dashboard — indiquant quelle part des rappels est réellement respectée, pas seulement combien sont programmés.
- Un patient peut être étiqueté avec plus d'une affection à la fois (par exemple diabète et hypertension ensemble), chacune suivie et rappelée indépendamment.

Ceci est distinct de la propre date de **Follow-up** ponctuelle de la Note de Consultation ci-dessus — celle-ci sert à « faire revenir après cette visite précise » ; Chronic Recall sert à « ce patient a une affection continue que je dois continuer à vérifier, visite après visite ».

Ce même chiffre de conformité a aussi son propre rapport dédié — ouvrez **Reports → Recall Compliance**, choisissez une plage de dates, et vous verrez une jauge indiquant le pourcentage de rappels clôturés dans cette période qui ont été respectés à temps, plus une répartition par affection (pour pouvoir constater, par exemple, que vos rappels diabète sont à 90 % mais que l'hypertension décroche).
