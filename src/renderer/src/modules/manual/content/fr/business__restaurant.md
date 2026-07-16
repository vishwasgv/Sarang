# Restaurant

Choisir **Restaurant** comme type d'entreprise lors de la configuration active quatre éléments en plus des fonctionnalités universelles offertes à toute entreprise : **Tables**, **Tickets de commande de cuisine (KOT)**, **Recettes**, et le suivi du stock d'ingrédients. Facturation, Clients, Stock, et Rapports fonctionnent tous de la même façon que décrit dans leurs propres chapitres — ce chapitre ne couvre que ce qui est spécifique à la gestion d'un restaurant.

## Tables

Ouvrez **Tables du restaurant** depuis la barre latérale pour voir chaque table configurée, chacune affichée sous forme de carte avec son statut actuel : **Libre**, **Occupée**, ou **Rsv** (Réservée). Ajoutez une table avec un numéro de table (par ex. « T1 ») et un nom d'affichage facultatif. Appuyez sur un bouton de statut sur la carte d'une table pour le modifier — une table ne peut pas être supprimée tant qu'elle a un ticket de cuisine actif.

**Fin de journée** est un bouton sur cet écran : il marque toutes les tables occupées comme à nouveau disponibles et affiche un résumé de clôture en une ligne (KOT servis et chiffre d'affaires du jour) afin que vous puissiez clôturer la salle à la fin d'un service.

## Tickets de commande de cuisine (KOT)

Un KOT est la copie de cuisine d'une commande. Après avoir enregistré une commande dans **Facturation**, ouvrez la facture et appuyez sur **Envoyer en cuisine** pour créer un KOT correspondant. Depuis **Tickets de commande de cuisine** dans la barre latérale, le personnel de cuisine voit chaque ticket regroupé par statut — En attente, En cours, Terminé, Annulé — avec ses articles et quantités, et fait avancer chacun d'un simple geste (**Commencer la cuisson** → **Marquer terminé**), ou l'**Annule**. Chaque ticket peut aussi être imprimé directement sur votre imprimante de cuisine.

Marquer un KOT **Terminé** est ce qui déclenche la déduction du stock d'ingrédients (voir ci-dessous) et libère la table à laquelle il appartenait, une fois qu'aucun autre ticket actif n'utilise cette table.

## Options matérielles pour la cuisine

Au-delà de l'écran des Tickets de commande de cuisine dans l'application, Sarang propose trois façons de faire parvenir les tickets au personnel de cuisine — les trois peuvent fonctionner en même temps (imprimer un ticket papier, afficher un moniteur mural, et laisser un téléphone ou une tablette le contrôler ne s'excluent pas mutuellement). Configurez-les depuis **Settings → Appearance**, uniquement pour les commerces de type restaurant.

**Kitchen Printer.** Par défaut, l'impression d'un KOT est envoyée à votre imprimante Windows par défaut. Si votre imprimante de cuisine est un appareil physique différent de l'imprimante de reçus de votre comptoir de facturation, sélectionnez-la dans le menu déroulant **Kitchen Printer** — dès lors, chaque tâche d'impression de KOT y est envoyée directement, sans boîte de dialogue d'impression, sans sélection manuelle. Laissez sur « Use Windows default printer » si vous n'avez qu'une seule imprimante.

**Kitchen Display — second monitor.** Transforme n'importe quel second moniteur branché sur le PC de facturation en un tableau de KOT en direct, en gros texte (Pending / In Progress / Recently Done), utilisable avec une simple souris — aucun écran tactile requis. Sous **Kitchen Display — second monitor**, choisissez un écran détecté et appuyez sur **Open Kitchen Display** ; il s'ouvre alors en plein écran et se rafraîchit automatiquement. Quelques notes d'installation physique :
- La souris doit seulement atteindre le PC, pas l'écran — si la cuisine se trouve à plus de quelques mètres du PC de facturation, utilisez une **souris sans fil** (son récepteur USB se branche sur le PC de facturation) plutôt qu'une souris filaire, car le câble d'une souris filaire n'atteindra pas la distance.
- Le câble vidéo du moniteur pose le même problème de distance, généralement pire — un câble HDMI classique commence à perdre le signal au-delà d'environ 10-15 mètres. Si votre cuisine est une pièce séparée ou se trouve à l'autre bout du restaurant (disons 10-30 m, éventuellement à travers un mur), utilisez un **kit d'extension HDMI sur Ethernet** (une paire émetteur/récepteur bon marché reliée par un câble réseau standard) plutôt qu'un long câble HDMI unique.
- Dans les paramètres d'affichage Windows, assurez-vous que le second moniteur est réglé sur **Extend these displays**, pas Duplicate — c'est ce qui permet à votre curseur de souris unique de se déplacer dessus.
- Si faire passer un câble sur une telle distance s'avère peu pratique, utilisez plutôt l'option téléphone/tablette/ordinateur portable ci-dessous — elle ne nécessite aucun câblage.

**Kitchen Display — phone / laptop.** Permet à n'importe quel téléphone, tablette ou ordinateur portable connecté au WiFi de votre commerce d'ouvrir un tableau de KOT en direct dans son propre navigateur — aucune application à installer, une tablette posée en cuisine fonctionne exactement comme un téléphone ou un ordinateur portable ici. Activez-le sous **Kitchen Display — phone / laptop**, puis lisez à voix haute la ou les adresses LAN affichées, ou appuyez sur **Show QR code** et faites-la scanner par l'appareil. Cela fonctionne entièrement sur votre propre WiFi, sans connexion internet nécessaire, et est complètement indépendant de la fonctionnalité de commande par table via QR code destinée aux clients décrite ci-dessous (serveur différent, port différent, et un code d'accès aléatoire qui n'est jamais affiché qu'ici, dans Settings — un client qui scanne le code QR de commande de sa table n'a aucun moyen d'atteindre le tableau de cuisine). Si l'accès doit un jour être révoqué (par ex. un téléphone contenant le lien est perdu), appuyez sur **Regenerate access code** — tout lien/code QR précédemment partagé cesse immédiatement de fonctionner.

## Recettes et suivi des ingrédients

Ouvrez **Recettes** pour lier un article du menu (par ex. « Chai masala ») aux ingrédients bruts qu'il consomme et en quelle quantité — recherchez le produit du menu, nommez la recette, puis ajoutez des lignes d'ingrédients (chaque ingrédient ne peut apparaître qu'une seule fois par recette ; combinez les quantités plutôt que d'ajouter une ligne en double). La liste d'ingrédients de chaque recette est affichée déployée dans la vue liste.

Une fois qu'une recette existe pour un article du menu, terminer son KOT (le marquer Terminé) déduit automatiquement les quantités d'ingrédients de la recette × la quantité commandée de votre stock de produits habituel — aucun inventaire d'ingrédients séparé à maintenir. Si le stock d'un ingrédient ne peut être ajusté pour une raison quelconque, Sarang ne perd pas silencieusement l'écart : il déclenche une notification vous indiquant quel ingrédient nécessite un recomptage manuel, afin que vos chiffres de stock ne dérivent jamais discrètement.

Les articles du menu sans recette configurée ne déduisent tout simplement aucun stock d'ingrédient lorsqu'ils sont vendus — les recettes sont entièrement facultatives par article.

## Commande par table via QR code (facultatif)

Tables du restaurant dispose aussi d'un bouton **Commande par table via QR**, désactivé par défaut. Activez-le et Sarang démarre un petit serveur local sur votre propre réseau WiFi (aucun internet nécessaire) afin que les clients puissent scanner le code QR imprimé d'une table, parcourir le menu, et soumettre une demande de commande depuis leur téléphone. Rien ne devient automatiquement une véritable facture — chaque commande entrante apparaît sous **Commandes entrantes** sur l'écran des Tickets de commande de cuisine, où le personnel doit explicitement **Accepter** (en choisissant un mode de paiement, ce qui crée la facture et le KOT ensemble) ou **Rejeter**. Le code QR de chaque table peut être généré et imprimé depuis sa carte sur l'écran Tables du restaurant.

## Ce qui est partagé avec toute entreprise

Facturation, facturation, paiements, Clients, Produits, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres. Si vous activez aussi Logistique & Chaîne d'approvisionnement dans **Paramètres → Fonctionnalités supplémentaires**, vous obtenez aussi Flotte, Transporteurs, Expéditions, Bon de Réception, Bon de Livraison, Registre de Fret, et Analyses Logistiques — mais ce n'est pas activé par défaut pour un restaurant, puisque la plupart des restaurants ne gèrent pas leur propre flotte de livraison ni ne reçoivent d'expéditions fournisseurs formelles.
