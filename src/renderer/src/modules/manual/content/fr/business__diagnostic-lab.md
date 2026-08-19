# Laboratoire de Diagnostic et de Pathologie

## Ce qui est différent dans ce type d'entreprise

Un Laboratoire de Diagnostic et de Pathologie fonctionne sur la même fondation rendez-vous/catalogue de services que partage chaque entreprise de service dans Sarang, plus un ensemble d'écrans spécifiques au laboratoire : **Ordres d'analyses de laboratoire**. Un catalogue de tests/panels réutilise le Service Catalog standard plutôt qu'une liste parallèle séparée — une analyse de sang ou une radiographie n'est qu'un service que vous vendez, tarifé et taxé de la même manière que tout autre service. Ce qui est véritablement différent, c'est le cycle de vie de la commande en dessous — une commande de laboratoire progresse à travers le prélèvement d'échantillon, la saisie de résultats par test, et un rapport verrouillé et finalisé, avant d'être facturée ou remise au patient.

## Créer une commande de laboratoire

Ouvrez **Ordres d'analyses de laboratoire** dans la barre latérale. Une nouvelle commande nécessite un nom de patient (le dossier client lié est optionnel — les patients de passage conviennent) et au moins un test ou panel sélectionné dans votre Service Catalog. Vous pouvez optionnellement enregistrer l'âge du patient et lier la commande à un rendez-vous existant. Chaque commande obtient un numéro de commande séquentiel (par ex. `LAB-202607-0001`, réinitialisé par mois calendaire).

## Références d'une clinique

Si un médecin ailleurs a référé ce patient à votre laboratoire, enregistrez qui l'a référé (`referredByProviderId`) ainsi que toute note de référence. C'est un flux de travail réel et quotidien pour un laboratoire indépendant qui accepte les références de cliniques de médecine générale, de cliniques de spécialistes, et d'hôpitaux dont il ne fait pas partie.

## Prélèvement d'échantillon

Une fois qu'un échantillon est prélevé (sang, urine, selles, écouvillon, imagerie, ou un autre type), marquez la commande **Échantillon Prélevé**. Cela enregistre qui l'a prélevé et quand, et fait passer chaque élément de test en attente de la commande au statut Collected. Les tests ne peuvent être ajoutés ou retirés d'une commande qu'avant cette étape — une fois qu'un échantillon est prélevé, l'ensemble de tests de la commande est verrouillé.

## Saisie des résultats

Pour chaque test de la commande, saisissez son résultat : un ensemble de paramètres nommés (valeur, unité, plage de référence, et un indicateur Bas / Normal / Élevé / Anormal — ou **Critique**, lorsqu'une valeur tombe dans la plage de valeur critique définie pour ce test). Saisir le premier résultat d'une commande la fait passer automatiquement de Sample Collected à In Process, afin que le personnel d'accueil puisse voir d'un coup d'œil que le travail a réellement commencé sans attendre que tous les tests soient terminés.

Un résultat **Critique** met immédiatement un badge rouge sur la commande (et sur l'élément spécifique), et la commande ne peut pas être considérée comme traitée tant que vous n'utilisez pas **Record Doctor Notified** pour enregistrer que vous avez réellement appelé le médecin référent, avec une note — c'est un enregistrement authentique que l'escalade a eu lieu, pas seulement que le chiffre a été signalé.

## Délai de traitement (TAT)

Si un test de votre Service Catalog a un **Target TAT (hours)** défini — modifiez l'entrée du test pour en ajouter un — chaque commande pour ce test suit automatiquement son délai réel : le moment où un résultat devient prêt est comparé à l'heure de prélèvement de l'échantillon, et la ligne de résultat du test affiche un badge **On Time** ou **Late** avec les heures exactes, juste à côté de son statut. Pas de cible, pas de badge — c'est optionnel par test, pas une obligation.

## Finalisation du rapport

Une fois que chaque test de la commande a un résultat saisi, **Finalize Report** verrouille toute la commande — son statut devient Reported et chaque élément est marqué Reported. Les résultats d'un rapport finalisé ne peuvent plus être modifiés ; si une correction est véritablement nécessaire, elle doit se produire avant la finalisation. Après la finalisation du rapport, marquez-le **Livrée** une fois que le patient ou la clinique référente l'a réellement reçu. Joignez de véritables fichiers de scan/image à une commande depuis sa vue de détail.

## Facturation

Générez une facture directement depuis une commande de laboratoire une fois que chaque test a un prix supérieur à zéro et que la commande est liée à un dossier client. Chaque test apparaît comme sa propre ligne sur la facture, en utilisant le même taux de taxe (code SAC, si défini) que son entrée dans le Service Catalog.

## Rapports

L'écran **Rapports** inclut un rapport Lab Test Throughput spécifique à ce secteur, montrant les commandes par étape (commandée, échantillon prélevé, en cours, rapportée) et le temps de traitement de la commande au rapport pour chacune — utile pour repérer où les échantillons s'accumulent.

Trois autres rapports spécifiques au laboratoire se trouvent à côté. **Per-Test TAT** décompose le délai de traitement par nom de test plutôt que par commande — heures réelles moyennes par rapport à la cible propre de chaque test, et combien de résultats sont arrivés à temps contre en retard, pour voir quels tests précis manquent leur SLA plutôt que juste que « quelque chose » est lent. **Test Volume by Panel** trace combien de tests vous réalisez par panel/catégorie dans le temps — une ligne par panel, mois par mois. **Referral Leaderboard** classe les médecins qui vous réfèrent le plus de tests, pour savoir d'où vient réellement votre volume.

## Langue

Laboratoire de Diagnostic et de Pathologie est l'un des modèles d'entreprise de service de Sarang, et — contrairement à Tailleur/Boutique, l'unique exception nommée — il conserve la règle standard pour ce groupe : l'interface est verrouillée à **uniquement l'anglais**, quelle que soit la langue que vous avez définie ailleurs dans Sarang.
