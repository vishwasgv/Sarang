# Location

## Ce qui est différent dans ce type d'entreprise

Location est délibérément générique — elle est conçue pour couvrir toute location de type retrait-et-retour à court terme, que ce soit des tentes et des ustensiles pour un mariage, des vêtements, des voitures ou des vélos, un séjour de courte durée, des bijoux pour une journée, des stations de jeu, de l'électronique, ou du mobilier. Ce que tout cela partage, c'est le même cycle de vie réservation → retrait → retour, facturé selon un tarif basé sur le temps plutôt qu'un prix de vente unique. Ceci est distinct du module Propriété d'Immobilier, qui est pour les baux à long terme sans aucun cycle de retrait/retour.

## Suivi UNITÉ vs. VRAC

Chaque produit louable est suivi de l'une des deux façons :

- **UNITÉ** — pour les actifs individuellement distincts, comme une voiture spécifique, une robe de mariée particulière, ou une console de jeu numérotée. Chaque article physique obtient sa propre entrée dans **Unités de location** avec une étiquette d'unité et des notes d'état, et une réservation revendique une unité spécifique pour sa plage de dates.
- **VRAC** — pour une quantité groupée et interchangeable, comme « 50 chaises en plastique » ou « 20 assiettes ». Il n'y a pas d'identité par article, juste une quantité totale possédée et combien en est déjà engagé dans des réservations qui se chevauchent.

## Définir les tarifs de location

Un produit louable peut avoir un tarif pour n'importe quelle combinaison de **HEURE, JOUR, SEMAINE, MOIS, ou ANNÉE** — définissez celles qui s'appliquent lorsque vous marquez un produit louable. Une réservation choisit une base tarifaire par article ; la durée est calculée dans cette unité et arrondie au supérieur (une réservation d'un peu plus d'un jour se facture toujours comme un jour complet, jamais une fraction).

## Le cycle de vie d'une réservation

Ouvrez **Réservations de location** dans la barre latérale. Une réservation traverse :

1. **Réservée** — créée pour un client, une plage de date/heure, et un ou plusieurs articles, avec une caution de sécurité facultative perçue en amont.
2. **Retirée** — le ou les articles quittent physiquement les lieux avec le client. Pour les articles UNITÉ, le statut de l'unité spécifique devient Loué.
3. **Retournée** — le ou les articles reviennent. Vous enregistrez tout frais de dommage et combien de la caution de sécurité est remboursé (par défaut, la caution moins tout frais de dommage). Si le retour est en retard, des frais de retard sont calculés automatiquement à partir du propre tarif de chaque article, normalisé en un chiffre par jour, multiplié par un multiplicateur de frais de retard configurable (1,5× par défaut).

Une réservation Réservée peut aussi être **Annulée** (avant le retrait) ou **Prolongée** à une date/heure de fin ultérieure (tant que l'article reste disponible pendant la nouvelle plage).

Une réservation peut inclure plusieurs articles en une seule fois — chacun obtient son propre **frais de dommage** au retour, afin que la facture d'une réservation à plusieurs articles détaille exactement quelle unité a été endommagée plutôt qu'une seule ligne de réparation globale. Attachez de vraies **photos d'état** à la fois au retrait et au retour pour chaque article, ce qui vous donne un dossier avant/après documenté en cas de litige.

## Entretien et locations récurrentes

Définissez un **intervalle d'entretien** sur un article suivi en UNITÉ — soit un nombre de locations, soit un nombre de jours — et Sarang le fait automatiquement passer au statut Entretien au retour une fois l'intervalle atteint, ce qui bloque sa relocation jusqu'à ce que vous le marquiez comme entretenu. Ouvrez **Unités de Location** pour voir quels articles sont dus et pour enregistrer un entretien terminé.

Pour un client qui loue régulièrement la même chose selon un calendrier récurrent, définissez un **intervalle de récurrence** sur la réservation et utilisez **Créer le Prochain Cycle** une fois la période actuelle terminée pour générer la réservation suivante en un clic au lieu de tout ressaisir depuis le début.

## La disponibilité est toujours en direct, jamais une décrémentation de stock

Sarang ne décrémente jamais une quantité de stock lorsqu'une location est retirée. Au lieu de cela, la disponibilité — pour les articles UNITÉ comme VRAC — est calculée en direct à partir de chaque réservation actuellement Réservée ou Retirée qui chevauche la plage de dates demandée. Cela compte parce qu'une réservation doit bloquer la disponibilité *avant* le retrait — deux clients essayant de réserver la même dernière tente pour des dates qui se chevauchent ne doivent pas réussir tous les deux, ce qu'un modèle « décrémenter seulement au retrait » manquerait.

## Facturation

Générer une facture à partir d'une réservation terminée crée des lignes pour les frais de chaque article loué, plus des lignes séparées pour tout frais de retard et frais de dommage. La caution de sécurité n'est délibérément **pas** incluse dans la facture — elle n'est suivie que comme un montant perçu/remboursé sur la réservation elle-même, puisque c'est une consignation, pas un revenu.

## Rapports

**Rapports** inclut un rapport de Statut de location (ce qui est actuellement retiré, et ce qui est en retard) et un rapport de Revenu de location par produit, incluant un pourcentage d'utilisation pour les actifs suivis en UNITÉ.

## Langue

Location n'est pas l'un des modèles d'entreprise de service de Sarang — c'est un type d'entreprise par catégorie de produit, il n'est donc **pas** verrouillé à une langue. L'interface complète est disponible dans les 13 langues prises en charge.
