# Centre de Service Automobile

## Ce qui est inclus

Centre de Service Automobile est construit sur la fondation partagée des entreprises de service de Sarang — rendez-vous, un catalogue de services, plannings des prestataires, et la file d'attente de notifications — plus un module dédié unique : **Fiches d'Intervention**.

## Ordres de Réparation

Chaque ordre de réparation enregistre le client et le véhicule — numéro de véhicule, marque, modèle, année, type de véhicule (2R, 4R, Commercial, Autre), relevé de kilométrage à l'entrée (et à la sortie, une fois le véhicule restitué), le conseiller de service, et un ou plusieurs techniciens assignés.

Un ordre de réparation porte deux listes de lignes :

- **Service items** — frais de main-d'œuvre : un nom, une quantité, et un tarif, totalisés comme le total de main-d'œuvre.
- **Parts** — soit saisies en texte libre (une pièce obtenue ponctuellement, non suivie contre le stock), soit ajoutées en **recherchant dans votre inventaire réel**, ce qui lie la ligne à un Product réel. Une pièce liée est ce qui fait que la facturation la déduit réellement du stock lorsque l'ordre de réparation est facturé ; une pièce en texte libre ne touche jamais l'inventaire.

Un ordre de réparation progresse à travers un pipeline de statuts : **Received → Inspection → In Progress → (Waiting Parts, si nécessaire) → Ready → Delivered**, avec Cancelled comme résultat séparé. Une fois Ready, un bouton **Générer une Facture** facture ensemble la main-d'œuvre et les pièces comme une véritable facture.

Définissez une date de **prochain service dû** et/ou un relevé de kilométrage sur un ordre de réparation, et cliquez sur **Remind** pour programmer un véritable rappel WhatsApp au client avant celle-ci. Ouvrez l'onglet **Vehicles** pour voir chaque véhicule distinct que vous avez entretenu, groupé par numéro d'immatriculation avec un badge Due Soon/Overdue — cliquez sur **History** sur n'importe quel véhicule pour son historique de service complet groupé, du plus récent au plus ancien.

La barre KPI affiche les travaux actifs, les travaux prêts pour retrait, et les travaux livrés ce mois-ci.

## Langue

Centre de Service Automobile est l'un des 24 modèles d'entreprise de service dédiés de Sarang, et comme presque tous, son interface est **uniquement en anglais**, quelle que soit la langue que vous avez définie ailleurs dans Sarang.
