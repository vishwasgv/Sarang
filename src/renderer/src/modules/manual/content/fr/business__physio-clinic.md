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
