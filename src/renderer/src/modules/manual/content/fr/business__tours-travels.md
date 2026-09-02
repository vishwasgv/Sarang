# Tourisme et Voyages

## Ce qui est différent dans ce type d'entreprise

Tourisme et Voyages couvre la location de taxis/minibus/autocars charter, les forfaits touristiques à sièges partagés, et tout ce qui accompagne la gestion d'une petite flotte de véhicules : le règlement des services des chauffeurs (indemnité journalière, nuitée, allocation de conduite de nuit, et facturation du km/heure excédentaire), le suivi de l'entretien/maintenance des véhicules, et la commission des agents référents. Une étude de marché réelle confirme que les tarifs de taxi interurbain sont cotés au km selon la classe de véhicule avec un minimum de km quotidien — un **tarif forfaitaire**, pas un compteur en direct — donc chaque réservation ici capture un tarif forfaitaire à l'avance, avec les frais excédentaires réglés uniquement une fois le journal de service d'un trajet clôturé.

## Flotte de Véhicules

Ouvrez **Flotte de Véhicules** dans la barre latérale pour enregistrer chaque véhicule (numéro d'immatriculation, type, capacité de sièges) et suivre son compteur kilométrique. Le même écran affiche le **Calendrier de Disponibilité de la Flotte et des Sièges** — le statut réservé/libre de chaque véhicule et les sièges restants de chaque prochain départ de tour, pour les 30 prochains jours — et vous permet d'enregistrer les visites de **Service / Réparation / Maintenance** avec coût et relevé du compteur, constituant l'historique que lit le rapport d'Entretien de Véhicule Dû.

## Forfaits Touristiques et Réservation de Sièges

Ouvrez **Forfaits Touristiques** pour définir un forfait réutilisable (nom, itinéraire, durée, sièges par défaut, tarif par siège), puis programmez de vrais **départs** contre lui à des dates précises. Un client réserve des **sièges** individuels sur un départ — le nombre de sièges est réclamé atomiquement afin que deux employés ne puissent jamais survendre le même départ — et le tarif du forfait est calculé automatiquement comme sièges × tarif par siège.

## Réservations de Voyage et Service des Chauffeurs

Ouvrez **Réservations de Voyage** pour créer une réservation charter exclusive : choisissez le client et le véhicule, définissez les dates du trajet, la prise en charge/dépose/itinéraire, un tarif forfaitaire, et les **km/jour inclus** et **heures/jour incluses** que couvre le forfait. Enregistrez un acompte s'il en a été perçu un, et éventuellement le nom d'un agent référent et sa commission.

Une fois le trajet en cours, utilisez **Start Duty** sur la réservation : assignez un chauffeur, enregistrez le compteur et l'heure de départ, et l'indemnité journalière du chauffeur, les frais de nuitée, et l'allocation de conduite de nuit le cas échéant. Quand le trajet se termine, utilisez **Close Duty** avec le compteur et l'heure de fin — Sarang calcule les km parcourus et les heures de service, et si l'un ou l'autre dépasse l'allocation incluse du forfait, l'excédent est facturé à un tarif au km qui varie selon la classe de véhicule (berline/SUV/minibus/minicar/autocar) plus un tarif fixe d'heure excédentaire. Ces frais excédentaires sont des revenus facturables au client ; l'indemnité/nuitée/conduite de nuit du chauffeur reste un coût séparé, jamais facturé comme marge.

Une fois une réservation prête à facturer, utilisez **Générer la Facture** — elle facture le tarif forfaitaire plus tous les frais de km/heure excédentaires réglés des journaux de service clôturés, et enregistre l'acompte déjà perçu comme un vrai paiement contre la nouvelle facture.

## Rapports

En plus des rapports standards de Ventes, Inventaire et Finances, Tourisme et Voyages obtient :

- **Entretien de Véhicule Dû** — total des km parcourus par véhicule depuis son dernier entretien, avec les véhicules dus ou en retard signalés par rapport à leur propre km d'entretien dû enregistré ou un intervalle par défaut générique.
- **Commission par Agent** — commission de référence gagnée par agent, cumulée sur chaque réservation de voyage dans la période sélectionnée.
- **Rentabilité de Voyage** (fonctionnalité vedette) — par trajet terminé : revenus (tarif forfaitaire plus frais excédentaires) moins coût du chauffeur, un coût de carburant estimé à partir des km parcourus, une part proratisée du coût de maintenance du véhicule, et commission — le seul chiffre qui montre la vraie marge par trajet, pas seulement le revenu.

## Langue

Tourisme et Voyages n'est pas l'un des modèles d'entreprise de services de Sarang — c'est un type d'entreprise par catégorie de produit/flotte, donc il n'est **pas** verrouillé par langue. L'interface principale, y compris Flotte de Véhicules, Forfaits Touristiques, et Réservations de Voyage, est disponible dans les 13 langues prises en charge.
