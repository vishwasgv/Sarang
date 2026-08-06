# Hôtel / Auberge

## Ce qui est différent dans ce type d'entreprise

Hôtel/Auberge est délibérément son propre secteur plutôt qu'une extension du modèle générique d'Entreprise de Location ou du modèle standard de rendez-vous à visite unique que chaque autre entreprise de service dans Sarang utilise. Un séjour à l'hôtel nécessite trois choses qu'aucun des deux ne couvre : la capture d'identité du client légalement requise à l'enregistrement, la facturation par nuit sur un séjour de plusieurs nuits, et les frais supplémentaires en cours de séjour ajoutés à un folio courant avant le départ final. Ainsi, Hôtel/Auberge obtient un module dédié, **Réservations d'hôtel**, couvrant l'ensemble du cycle de vie de la réservation de manière autonome.

## Registre des chambres

Ouvrez **Chambres** dans la barre latérale pour maintenir votre liste de chambres — numéro de chambre, type de chambre, étage, occupation maximale, et un tarif de base par nuit. Le statut d'une chambre (Disponible, Occupée, Nettoyage, Maintenance, ou Hors service) change principalement de lui-même à mesure que les réservations progressent à travers l'enregistrement et le départ ; vous ne pouvez pas changer manuellement le statut d'une chambre qui a actuellement un client à l'intérieur.

## Réserver un séjour

Ouvrez **Réservations d'hôtel** pour créer une nouvelle réservation — choisissez une chambre, les dates d'arrivée et de départ, le nom du client et ses coordonnées, le nombre de clients (plafonné à l'occupation maximale de la chambre), un acompte optionnel, et d'où vient la réservation (**source/canal de réservation** — Visite Spontanée, Téléphone, MakeMyTrip, Booking.com, ou tout autre canal que vous saisissez). Sarang vérifie que la chambre est véritablement libre pour cette plage de dates exacte avant de confirmer — la même vérification de disponibilité en temps réel utilisée ailleurs dans Sarang, afin que deux membres du personnel ne puissent jamais réserver deux fois la même chambre pour des dates qui se chevauchent. Les nuits sont facturées sur des dates calendaires, pas des heures écoulées — un séjour d'un enregistrement en soirée à un départ le lendemain matin est toujours une nuit, comme dans la pratique hôtelière normale.

Si le client a déjà séjourné auparavant, le choisir dans la recherche de clients affiche son **nombre de séjours précédents** directement dans le formulaire New Booking, afin que le personnel de la réception puisse reconnaître et accueillir un client fidèle.

Pour un séjour plus court le même jour, choisissez **Day Use** au lieu d'une réservation nocturne normale — elle est facturée au tarif d'utilisation de jour configuré de la chambre (ou la moitié du tarif nocturne si aucun n'est défini) et réserve quand même la chambre pour la journée complète.

### Tarifs saisonniers

Configurez une tarification par plage de dates sous **Manage Seasonal Rates** sur l'écran Rooms — un tarif général pour toutes les chambres pendant une période (par ex. une majoration de saison de festival), ou un tarif spécifique à un type de chambre. Un séjour qui chevauche une limite de saison est tarifé correctement nuit par nuit, pas à un tarif fixe pour tout le séjour.

### Réservations de groupe

Vous réservez plusieurs chambres pour le même client pour un groupe ou une famille ? Cochez les réservations liées dans la liste Hotel Bookings et utilisez **Generate Combined Bill** pour produire une seule facture les couvrant toutes, au lieu d'une facture séparée par chambre.

## Conformité d'identité du client à l'enregistrement

Enregistrer une réservation nécessite d'enregistrer au moins une identité de client — nom, type d'identité (Aadhaar, Passeport, Permis de conduire, Carte d'électeur, ou PAN en Inde ; Passeport, Identité nationale, Permis de conduire, ou Autre identité gouvernementale ailleurs), numéro d'identité, et nationalité. Ce n'est pas une friction supplémentaire en soi — de nombreuses juridictions exigent légalement qu'un établissement d'hébergement tienne un registre exhibable de l'identité de chaque client pour vérification policière ou d'immigration, et c'est exactement ce registre.

## Frais supplémentaires en cours de séjour

Pendant qu'un client est enregistré, ajoutez des frais supplémentaires à son séjour depuis l'écran de détail de la réservation — service en chambre, blanchisserie, minibar, tout ce qui est facturé en plus du tarif de la chambre. Ceux-ci s'accumulent dans un folio courant qui est ajouté à la facture finale ; les frais ne peuvent être ajoutés ou retirés que tant que le client est encore enregistré.

## Départ et facturation

Le départ met fin au séjour et libère la chambre pour le nettoyage. Générer la facture facture les frais de chambre (tarif nocturne × nuits) plus chaque frais supplémentaire comme sa propre ligne, afin que la facture imprimée détaille le séjour comme le ferait un véritable folio d'hôtel. Tout acompte perçu au moment de la réservation est automatiquement enregistré comme un paiement contre la nouvelle facture. Comme toute autre facture dans Sarang, elle peut être imprimée en format A4 ou en largeur de reçu thermique.

## Ménage

Chaque départ met automatiquement en file d'attente une **tâche de ménage** pour cette chambre. Ouvrez **Ménage** pour voir chaque tâche en attente, l'assigner à un membre du personnel, et la marquer comme faite — une fois que chaque tâche ouverte pour une chambre est terminée, la chambre repasse à Disponible d'elle-même, plutôt que de dépendre de quelqu'un qui se souvient de changer manuellement son statut.

## Annulation ou non-présentation

Une réservation Confirmed qui n'a pas encore été enregistrée peut être annulée (avec un motif optionnel) ou marquée comme non-présentation. Une fois qu'un client s'est enregistré, la seule voie possible est le départ — une réservation déjà enregistrée ne peut plus être annulée, car le client est physiquement dans la chambre.

## Rapports

**Rapports** inclut un rapport Occupancy (chambres occupées/disponibles/en nettoyage/en maintenance en ce moment, avec un pourcentage d'occupation) et un rapport Guest Register — le registre de conformité que ce secteur existe pour soutenir, listant les détails d'identité de chaque client pour les séjours chevauchant une plage de dates que vous choisissez, prêt à être produit à la demande.

## Langue

Hôtel/Auberge est l'un des modèles d'entreprise de service de Sarang, et — contrairement à Tailleur/Boutique, l'unique exception nommée — il conserve la règle standard pour ce groupe : l'interface est verrouillée à **uniquement l'anglais**, quelle que soit la langue que vous avez définie ailleurs dans Sarang.
