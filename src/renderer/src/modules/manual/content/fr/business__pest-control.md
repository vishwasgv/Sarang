# Lutte Antiparasitaire

## Ce qui est inclus

Lutte Antiparasitaire est construite sur la fondation partagée des entreprises de service de Sarang — rendez-vous, un catalogue de services, plannings des prestataires, et la file d'attente de notifications — plus un module dédié unique : **Pest Control**, couvrant à la fois les contrats de service récurrents et les fiches de travail individuelles.

## Contrats de Service

Un contrat enregistre le client, l'adresse et le type de propriété (Résidentiel, Commercial, Industriel), les types de nuisibles couverts (Cafards, Rongeurs, Termites, Fourmis, Moustiques, Punaises de lit, Autre — choisissez-en autant que nécessaire), la fréquence de service (Mensuelle, Trimestrielle, Semestrielle, Annuelle, Ponctuelle), une valeur de contrat, des dates de début/fin, et un statut (Actif, En attente, Expiré, Annulé).

Un contrat actif avec une valeur peut être facturé pour ses frais récurrents avec **Generate Invoice** — ce n'est pas une action unique : Sarang suit pour quelle période le contrat a été facturé en dernier, afin que vous puissiez refacturer le même contrat à chaque période où il se répète, au rythme correspondant à sa propre fréquence. Les factures de contrat utilisent le SAC 998534 à 18 % de GST.

## Fiches de Travail

Une fiche de travail est une visite unique — optionnellement liée à un contrat, ou créée comme une visite ponctuelle/ad hoc — enregistrant la date/heure de la visite, les techniciens assignés, le pesticide utilisé, les zones traitées (une liste de sélection rapide : Cuisine, Salles de bain, Chambre, Local de stockage, Terrasse, Jardin, Sous-sol, Bureau, Entrepôt, Cuisine de restaurant, Zones communes), le type de traitement (Pulvérisation, Gel, Fumigation, Piège, Appât, Combiné), le montant du travail, et si la signature du client a été obtenue. Une fiche de travail progresse à travers **Scheduled → In Progress → Completed** (avec Cancelled comme résultat séparé) ; une fois Completed, **Generate Invoice** facture cette visite (même SAC 998534, 18 % de GST).

Pour un enregistrement réel et détaillé des produits chimiques réellement utilisés lors d'une visite, ajoutez des lignes à **Pesticides Used** — nom, quantité, unité, nuisible ciblé, et une note de dosage optionnelle. Liez une ligne à un produit d'inventaire réel pour qu'elle déduise le stock automatiquement lors de l'utilisation, ou laissez-la non liée pour une entreprise qui ne suit pas le stock de produits chimiques dans Sarang.

La barre KPI affiche les contrats actifs, les fiches de travail en attente, et les fiches de travail programmées cette semaine.

## Langue

Lutte Antiparasitaire est l'un des 24 modèles d'entreprise de service dédiés de Sarang, et comme presque tous, son interface est **uniquement en anglais**, quelle que soit la langue que vous avez définie ailleurs dans Sarang.
