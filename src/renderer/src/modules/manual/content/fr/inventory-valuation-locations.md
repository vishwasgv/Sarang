# Valorisation des Stocks et Stock Multi-Emplacement

## Méthode de Valorisation

Chaque produit possède désormais une **Méthode de Valorisation**, définie sur la fiche produit : **Moyenne Pondérée** (par défaut — le coût que vous voyez est une moyenne courante calculée sur chaque achat), **FIFO** (Premier Entré, Premier Sorti — le coût reflète vos couches d'achat les plus anciennes encore en stock), ou **Coût Standard** (un coût fixe que vous définissez vous-même, qui ne varie pas avec les prix d'achat). Quelle que soit la méthode utilisée par un produit, c'est ce chiffre de coût que Sarang utilise partout où le coût compte pour ce produit — la marge sur le Tableau de Bord, le rapport de Compte de Résultat, le rapport de Coût Alimentaire, et les suggestions de brouillon de réapprovisionnement lisent tous le même coût résolu, ils ne sont donc jamais en désaccord entre eux.

Changer la méthode de valorisation d'un produit ne réécrit pas son historique d'achats — cela change uniquement le chiffre que Sarang lit à partir de ce moment.

## Emplacements et Transfert de Stock

**Emplacements** (`/locations`) s'adresse aux entreprises qui stockent des marchandises à plus d'un endroit — un entrepôt plus un comptoir de vente, ou deux succursales. Chaque entreprise démarre avec un seul emplacement par défaut « Principal » auquel appartient déjà tout le stock existant, donc rien ne change tant que vous n'ajoutez pas réellement un deuxième emplacement. Ajoutez-en un avec **Nouvel Emplacement** (nom et adresse facultative) ; le premier emplacement créé est toujours celui par défaut, et un emplacement par défaut ne peut pas être désactivé puisque tout mouvement de stock qui ne précise pas d'emplacement spécifique y est dirigé.

Dès qu'un deuxième emplacement existe, une action **Transférer le Stock** apparaît : choisissez un produit, une quantité, un emplacement source et destination, et un motif facultatif. Un transfert ne fait que déplacer le stock entre emplacements — il ne modifie jamais la quantité totale que vous possédez, il ne crée donc pas de nouveau mouvement d'inventaire du type « stock ajouté » ou « stock retiré », juste un changement d'emplacement à emplacement.

## Coûts d'Approche

Les **Coûts d'Approche** vous permettent d'incorporer les coûts supplémentaires liés à l'achat — fret, droits de douane, manutention, ou autre — dans le coût réel d'un produit, plutôt que de les laisser comme une dépense distincte et non attribuée.

Sur une **Commande d'Achat**, ajoutez un coût d'approche depuis son écran de détail : choisissez un type (Fret, Droits de douane, Manutention, ou Autre), un montant, et la façon de le répartir sur les lignes de la commande — **par valeur de ligne** (une ligne de plus grande valeur de la commande absorbe une part plus importante du coût) ou **par quantité** (réparti également par unité, indépendamment du prix). Vous pouvez ajouter ou retirer librement des coûts d'approche jusqu'à la première réception de la commande ; une fois la réception commencée, ils sont verrouillés, car l'historique de coûts qu'ils alimentent n'est jamais réécrit par la suite. Sur une **Facture Fournisseur**, les coûts d'approche sont saisis en ligne uniquement à la création, dans une section facultative — une Facture Fournisseur publie son historique de coûts immédiatement, sans étape de « réception » distincte pour ajouter des coûts plus tard.

Dans les deux cas, le coût d'approche est incorporé dans le coût unitaire enregistré pour cet achat, ce qui est exactement ce que votre méthode de valorisation (ci-dessus) lit ensuite.

## Articles Composites (Kits)

Un **Kit** est un produit composé d'autres produits, vendu et stocké comme un seul article mais dont le prix et l'inventaire sont déterminés via ses composants réels. Transformez un produit en kit depuis sa propre fiche : cochez **Ceci est un Kit** et choisissez ses composants (chacun doit être un produit Standard réel, en stock — les services et les autres kits ne peuvent pas être ajoutés comme composant, car le stock d'un kit doit pouvoir se retracer jusqu'à quelque chose qui se trouve réellement sur une étagère).

Lorsque vous vendez un kit, la facture affiche toujours une seule ligne au prix propre du kit — rien ne change pour le client ou le caissier. En coulisses, Sarang vérifie que chaque composant dispose d'un stock suffisant avant d'autoriser la vente, puis déduit la quantité réelle de chaque composant, de sorte que vos comptages de stock au niveau des composants restent toujours exacts même si c'est le kit qui a été vendu.

## Réapprovisionnement Automatique (Auto-PO)

Le **Seuil de Réapprovisionnement** de chaque produit existe déjà pour déclencher des alertes de stock bas (voir le chapitre *Inventaire*) ; ce même seuil pilote désormais aussi la **génération de brouillons de Commande d'Achat**. Depuis l'écran Inventaire, générer des brouillons de réapprovisionnement regroupe chaque produit sous le seuil selon son fournisseur habituel et crée une Commande d'Achat en Brouillon par fournisseur, prérempli avec une quantité de réapprovisionnement suggérée et le coût résolu actuel du produit — vous examinez et approuvez néanmoins chacune avant qu'elle ne devienne réelle, rien n'est envoyé automatiquement à un fournisseur.

## Conversion d'Unité Flottante (BR)

Certaines marchandises achetées ne se convertissent pas dans votre unité de vente selon un ratio parfaitement fixe — un « sac de riz » peut peser nominalement 25 kg, mais le sac que vous recevez réellement peut peser 24,6 kg. Activez la **Conversion d'Unité Flottante** sur un produit (en plus de sa configuration existante de vente par paquet/poids) pour capturer cela au moment de la réception : sur un **BR** (Bon de Réception), un champ **Qté Unité d'Achat** apparaît à côté de cette ligne — indiquez combien de sacs vous avez reçus, tandis que le champ existant **Reçu** reste la quantité réelle et mesurée effectivement prise en stock. Les deux sont autorisés à différer ; Sarang déduit le facteur de conversion réel pour cette réception spécifique à partir des deux nombres que vous avez saisis, plutôt que de supposer que chaque sac pesait exactement 25 kg.
