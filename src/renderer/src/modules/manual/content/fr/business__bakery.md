# Boulangerie / Confiserie / Traiteur

## Ce qui est différent dans ce type d'entreprise

Une boulangerie vend des produits à rotation rapide et à courte durée de conservation fabriqués à partir de recettes (farine, sucre, beurre déduits par gâteau vendu), prend des commandes personnalisées de gâteaux réservés à l'avance, et gère souvent des commandes traiteur pour des événements — 50 samoussas et 20 cupcakes pour une fête, rapprochés du catalogue et facturés en une seule fois. Boulangerie combine le suivi des recettes/ingrédients de Restaurant (sans le flux table/KOT de salle — une vente au comptoir n'est pas un ticket), le suivi des lots/péremption de Pharmacie pour la courte durée de conservation, et le mécanisme de commandes par liste groupée de Papeterie repris tel quel pour le traiteur.

## Déduction d'Ingrédients Basée sur les Recettes

Configurez une Recette sur n'importe quel Produit de boulangerie (Produit → Recette) de la même façon qu'un plat de Restaurant — listez chaque ingrédient et la quantité utilisée par unité. Comme une vente au comptoir de boulangerie n'a pas de flux de ticket de cuisine, le stock d'ingrédients est déduit automatiquement au moment où la vente est facturée, pas lors d'une étape séparée de « commande terminée ».

## Commandes Personnalisées

Ouvrez **Custom Orders** dans la barre latérale pour réserver un gâteau personnalisé ou une création sur mesure : choisissez le client, ajoutez chaque article avec sa quantité et son prix, et capturez éventuellement la personnalisation d'une ligne — saveur, taille, message ou design. Définissez un montant d'acompte et son mode de paiement ; l'acompte ne peut pas dépasser le total de la commande.

Quand la commande est prête, utilisez **Generate Invoice** sur la commande — cela crée la vraie facture à partir des articles propres de la commande et enregistre automatiquement l'acompte déjà perçu comme un vrai paiement contre celle-ci.

## Commandes Traiteur par Liste Groupée

Ouvrez **Bulk-List Orders** (le même écran que Papeterie utilise pour les listes de fournitures scolaires) pour gérer une commande traiteur : saisissez chaque ligne en texte libre (« 50 samoussas », « 20 cupcakes »), associez chacune à un produit réel du catalogue, et facturez toute la commande en une seule fois une fois que chaque ligne est associée.

## Événements Traiteur

Ouvrez **Événements Traiteur** dans la barre latérale pour une réservation d'événement complète — un mariage ou un grand événement, pas une commande groupée du jour même. Choisissez le client, la date de début (et de fin, pour les événements sur plusieurs jours) de l'événement, l'adresse du lieu, et le nombre d'invités, puis définissez un **prix par assiette** comme devis initial. Ajoutez le menu de l'événement (produits réels du catalogue avec quantité et prix), un décompte de repas et collations pour chaque jour de service, et le personnel avec son propre coût par rôle — cuisinier, serveur, agent d'entretien ou autre, chacun avec son propre nombre de travailleurs et tarif par travailleur.

Une fois le prix réellement négocié, utilisez **Enregistrer le Prix Final** pour capturer le total convenu — gardé séparé du devis initial par assiette, afin que la remise négociée reste toujours visible plutôt que d'être silencieusement écrasée. **Générer la Facture** sur l'événement facture au prix final négocié si un a été enregistré, ou au devis initial sinon, comme une seule ligne de Service Traiteur, et enregistre l'acompte déjà perçu comme un vrai paiement contre celle-ci.

## Rapports

En plus des rapports standards de Ventes, Inventaire et Finances, Boulangerie obtient :

- **Durée de Conservation / Pertes** — stock radié pour péremption (utilisez le motif **Péremption** lors de l'ajustement de stock pour des produits périmés), par produit et valeur — le même rapport qu'utilise Épicerie pour les périssables.
- **Marge par Recette** — les rapports Coût des Aliments et Marge de Contribution par Plat (du suivi d'ingrédients de Restaurant) fonctionnent ici sans changement, puisque les déductions d'ingrédients d'une boulangerie sont enregistrées exactement de la même façon.
- **Feuille de Production sur Précommande** — choisissez une date, et voyez chaque commande personnalisée due ce jour-là plus la demande habituelle des clients sans rendez-vous pour ce jour de la semaine, consolidées en ce qu'il faut cuire et exactement combien de chaque ingrédient il vous faudra.

## Langue

Boulangerie n'est pas l'un des modèles d'entreprise de services de Sarang — c'est un type d'entreprise par catégorie de produit, donc elle n'est **pas** verrouillée par langue. L'interface principale, y compris l'écran des Commandes Personnalisées, est disponible dans les 13 langues prises en charge.
