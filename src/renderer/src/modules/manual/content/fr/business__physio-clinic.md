# Clinique de Physiothérapie

Les écrans de ce type d'entreprise sont uniquement en anglais, quelle que soit la langue que vous avez définie ailleurs dans Sarang.

## La fondation de service partagée

Chaque type d'entreprise basé sur le service dans Sarang — y compris Clinique de Physiothérapie — part des quatre mêmes blocs de construction : **Rendez-vous** (réserver et planifier des visites), un **Catalogue de services** (la liste des séances de thérapie et leurs prix), **Provider Schedules** (quel physiothérapeute est disponible quand), et une **Notification Queue** automatique qui gère les rappels sans que vous ayez à les envoyer à la main. Le reste de ce chapitre couvre ce qui est spécifique à la physiothérapie : notes de consultation avec évaluation de la douleur, phases de traitement, programmes d'exercices à domicile, et forfaits de séances.

## Notes de Consultation

Ouvrir la **Consultation Note** d'un rendez-vous vous donne la même note SOAP structurée utilisée dans tous les types d'entreprise cliniques de Sarang (voir le chapitre *Clinique de Médecine Générale* pour les champs de base), plus deux ajouts spécifiques à la physiothérapie :

- **Pain Score** — une échelle de 0 (aucune) à 10 (la pire), saisie soit comme un nombre, soit en appuyant sur un bouton de sélection rapide.
- **Functional Score** — une échelle de 0 à 100 (plus élevé = meilleure fonction), suivant à quel point le patient peut réellement bouger et effectuer des tâches, aux côtés de la douleur.
- **Treatment Given This Session** — texte libre décrivant ce qui a réellement été fait lors de la séance (par ex. thérapie par ultrasons, TENS, thérapie manuelle, bandage).

Une fois qu'un patient a deux séances enregistrées ou plus, un graphique **Vitals Trend** apparaît sur sa note — basculez entre les puces Pain Score et Functional Score pour voir l'un ou l'autre tracé dans le temps, afin que vous et le patient puissiez voir les progrès réels (ou leur absence) d'un coup d'œil plutôt que de feuilleter les notes passées.

## Phases de Traitement

Le profil de chaque patient de physiothérapie a un onglet **Treatment** qui suit son parcours de rééducation à travers des phases nommées : Évaluation initiale, Phase aiguë, Sub-aiguë, Rééducation active, Maintien, et Sortie. Chaque phase enregistre un titre, une date de début, des objectifs, et — une fois que vous la fermez — une note de résultat. Une seule phase est ouverte (« active ») à la fois ; fermer l'une permet d'en commencer une nouvelle, construisant une chronologie claire de la progression du patient.

## Programme d'Exercices à Domicile (PED)

L'onglet **Exercise Program** vous permet de construire un Programme d'Exercices à Domicile imprimable pour le patient : une liste numérotée d'exercices, chacun avec un nom, une description de la façon de l'exécuter, et séries/répétitions/temps de maintien/fréquence. **Print HEP** produit un document formaté avec l'en-tête de la clinique et une ligne de signature, et enregistre la date de sa dernière impression.

## Forfaits de Séances

L'onglet **Forfaits de séances** suit les forfaits prépayés de séances (par ex. « Forfait Physio 10 séances ») : nom du forfait, séances totales, prix, taux de GST, dates d'achat et d'expiration. Un forfait actif affiche une barre de progression des séances restantes, et chaque rendez-vous terminé sur ce forfait déduit automatiquement une séance. Une fois qu'un forfait a un prix, vous pouvez **Générer une Facture** pour lui directement depuis cet écran — il ne le propose qu'une seule fois, et marque le forfait « Invoiced » ensuite, afin qu'il ne soit jamais facturé deux fois.

La ligne de filtres en haut de la liste des Forfaits de Séances (**Tous / Actifs / Faibles / Expirés**, chacun avec un compteur en direct) est votre vue d'alerte : un forfait passe à **Faibles** dès qu'il reste 2 séances ou moins, et à **Expirés** une fois sa date d'expiration dépassée — les deux sont également signalés par une couleur sur la carte du forfait elle-même, afin de ne jamais avoir à ouvrir un forfait pour remarquer qu'il nécessite une attention.

Pour voir comment vos forfaits de séances sont utilisés parmi tous les patients, ouvrez **Reports → Pack Utilization** et choisissez une plage de dates. Cela affiche le total des forfaits vendus, les séances utilisées par rapport aux séances achetées, et un pourcentage d'utilisation global, plus un graphique en barres et un tableau complet le détaillant forfait par forfait — pour repérer d'un coup d'œil les forfaits largement inutilisés (un signal pour faire un suivi avec ce patient).

## Références

Si un patient vient chez vous référé par un médecin extérieur, la section **Détails de Référence** de la Note de Consultation enregistre qui l'a référé, la date, et pourquoi — des champs en texte libre, puisque le médecin référent est généralement entièrement extérieur à Sarang. Si à l'inverse vous orientez un patient vers un autre praticien au sein de votre propre clinique, utilisez **Référer à un Autre Praticien** sur sa note pour réserver un vrai rendez-vous lié, le même mécanisme de référence intégré à l'application utilisé dans tous les types d'activité cliniques de Sarang.

Une fois que ce praticien finalise sa propre note sur le rendez-vous référé, son résultat apparaît automatiquement sur votre note d'origine. Si cette note suit le Score de Douleur et le Score Fonctionnel au fil des séances, le résultat affiché n'est pas juste sa remarque finale — c'est un avant-après quantifié sur tout le parcours de traitement depuis la référence (par exemple, « Douleur 7→3, Fonction 40→75 sur 3 séances »), pour que vous puissiez voir d'un coup d'œil si la référence a réellement aidé, pas seulement qu'elle a eu lieu.
