# Vêtements

Choisir **Vêtements** comme type d'entreprise active le **suivi des variantes de taille/couleur**, **Retours**, et l'ensemble partagé des modules **Logistique**. Tout le reste — Facturation, Produits, Clients, Stock, Rapports — fonctionne exactement comme décrit dans ces chapitres ; ce chapitre couvre ce qui est spécifique à une boutique de vêtements.

## Suivi des variantes (taille & couleur)

Un article de vêtement n'est généralement pas une seule référence de stock — « T-shirt homme » peut exister en cinq tailles et quatre couleurs, chacune avec son propre compte de stock. Depuis **Produits**, appuyez sur l'icône de couches sur n'importe quel produit pour ouvrir **Gérer les variantes**. Ajoutez une ligne par combinaison taille/couleur que vous stockez réellement (les champs taille et couleur suggèrent des tailles de vêtements courantes au fur et à mesure que vous tapez — de XS à 3XL — mais vous pouvez taper n'importe quoi), chacune avec son propre SKU facultatif, un prix supplémentaire par rapport au prix de base du produit si cette variante coûte plus cher (par ex. une grande taille), et sa propre quantité de stock. L'écran affiche un total courant des variantes et du stock combiné pour toutes.

Les fiches produit pour une entreprise Vêtements obtiennent aussi un champ **Genre** facultatif (Homme/Femme/Unisexe) et un champ de texte libre **Saison / Collection** (par ex. « Été 2026 », « Collection Diwali ») pour vous aider à organiser votre catalogue.

Vous stockez beaucoup de combinaisons à la fois ? Utilisez **Générer une Matrice Taille × Couleur** en bas de Gérer les variantes — saisissez vos tailles et couleurs sous forme de listes séparées par des virgules (par ex. « S, M, L » et « Noir, Blanc ») et Sarang crée chaque combinaison comme une nouvelle ligne en une seule fois, en ignorant toute paire que vous avez déjà ajoutée manuellement.

Chaque ligne de variante a son propre **code-barres** — générez-en un par ligne, ou utilisez **Générer les Codes-barres Manquants** pour compléter chaque variante qui n'en a pas encore. Lors de l'impression des étiquettes, un produit à variantes ouvre un sélecteur afin que l'étiquette porte le code-barres et le prix propres à cette variante exacte, et non ceux du produit parent.

Prêt à réapprovisionner un produit mais vous ne savez pas comment le répartir entre les tailles ? Ouvrez **Répartition de Réapprovisionnement Suggérée** en bas de Gérer les variantes, saisissez une quantité totale (ou laissez vide pour utiliser la quantité de réapprovisionnement déjà configurée du produit), et Sarang pondère la répartition vers les tailles et couleurs qui se sont réellement vendues au cours des 90 derniers jours — au lieu de répartir également. C'est la solution au problème classique « rupture de stock en M et L trois semaines avant S et XL, mais tout réapprovisionné également quand même ». Il s'agit uniquement d'une suggestion, pas d'une commande réelle — vous passez toujours la véritable Commande d'Achat vous-même, éclairé par cette répartition.

## Vendre une variante

Dans **Facturation**, ajouter un produit ayant des variantes configurées ne l'ajoute pas directement au panier — cela ouvre un sélecteur pour choisir la combinaison exacte taille/couleur vendue, et c'est le stock et le prix de cette variante spécifique (prix de base + son prix supplémentaire, le cas échéant) qui entre réellement dans le panier. Cela garde vos comptes de stock par taille/couleur exacts plutôt que de simplement décrémenter un seul chiffre partagé pour tout le produit.

## Rapport de Taux d'Écoulement par Saison/Collection

Si vous étiquetez vos produits avec une **Saison / Collection**, ouvrez **Rapports → Taux d'Écoulement par Saison/Collection** pour voir, mois par mois, quelle part des unités vendues-plus-en-stock de chaque collection s'est réellement vendue — un moyen rapide de repérer quelle collection se vend et laquelle s'accumule discrètement en rayon. Le graphique montre chaque collection comme sa propre barre par mois, avec une ligne de tendance de moyenne globale superposée ; le chiffre est comparé à votre stock actuel disponible pour chaque mois affiché, donc lisez-le comme une tendance continue, pas comme un instantané historique exact de chaque mois. Les produits sans saison définie sont entièrement exclus de ce rapport — étiquetez ceux que vous voulez suivre.

## Rapport de Carte Thermique Taille × Style

Ouvrez **Rapports → Carte Thermique Taille × Style** pour voir une grille montrant exactement quelles combinaisons taille/produit (« style ») se vendent réellement — chaque produit sur le côté, chaque taille en haut, chaque cellule ombrée selon le nombre d'unités de cette combinaison exacte vendues dans la plage de dates que vous choisissez. Les cellules plus foncées signifient plus d'unités vendues ; une cellule vide signifie que cette paire taille/style ne s'est pas vendue du tout. C'est conçu pour repérer des tendances qu'une simple liste de ventes enterrerait — un style qui ne se vend qu'en M et L, ou une taille qui ne se vend jamais quel que soit le style. La grille affiche vos 15 styles les plus vendus en volume, pour rester lisible même sur un grand catalogue.

## Rapport de Marge par Marque/Fournisseur

Attribuez un **Fournisseur** à vos produits (écran Produits — le même champ utilisé pour les achats) et ouvrez **Rapports → Marge par Marque/Fournisseur** pour voir le chiffre d'affaires, le coût et la marge répartis selon le fournisseur d'origine de chaque produit vendu. Cela répond à une question différente de la propre vue valeur-de-stock-par-produit du Rapport d'Inventaire — il s'agit de savoir quelles marques/quels fournisseurs sont réellement rentables à conserver, pas seulement lesquels se vendent le plus. Un fournisseur dont la marge s'avère négative est présenté honnêtement comme une perte, sans être masqué ni plafonné à zéro — c'est exactement le cas qu'il faut repérer. Les produits sans fournisseur attribué sont entièrement exclus de ce rapport — attribuez-en un à ceux que vous voulez suivre.

## Retours

Vêtements obtient aussi l'écran standard **Retours** — recherchez une facture passée par son numéro, sélectionnez quels articles et quantités retourner (plafonnés à ce qui est réellement encore retournable, en tenant compte de ce qui a déjà été retourné auparavant), donnez un motif, et validez. Voir la section *Retours* du chapitre Détail pour le comportement complet — il fonctionne ici de façon identique.

Pour une ligne avec variante (tout produit vendu avec taille/couleur), l'écran Retours propose aussi un bouton **Échange** à côté du sélecteur de quantité à retourner — pour quand le client veut une taille ou une couleur différente, pas un remboursement. Choisissez une quantité, sélectionnez la taille/couleur de remplacement parmi ce qui est actuellement en stock, indiquez un motif, et confirmez. En coulisses, cela crée en une seule étape deux transactions liées et entièrement réelles : une facture de retour pour l'article rendu (le remettant en stock et créditant le client exactement comme le ferait un retour ordinaire) et une nouvelle facture de vente pour l'article de remplacement, au prix actuel propre à cet article — pas au prix de l'ancien article, afin qu'un prix ayant changé entretemps soit reflété honnêtement. Sarang affiche immédiatement l'écart exact : si le remplacement coûte plus cher, combien percevoir en plus ; s'il coûte moins cher, combien rembourser ; et si les prix correspondent exactement, aucun solde n'est dû.

## Logistique & Chaîne d'approvisionnement

Comme le modèle par défaut de Vêtements inclut les modules Logistique, vous obtenez aussi **Flotte**, **Transporteurs**, **Expéditions**, **Bon de Réception**, **Bon de Livraison**, **Registre de Fret**, et **Analyses Logistiques** pour suivre vos propres véhicules de livraison et les expéditions fournisseurs — voir les écrans Logistique sous ces noms dans la barre latérale.

## Ce qui est partagé avec toute entreprise

Facturation, facturation, paiements, Clients, Produits, Rapports, Sauvegarde, et Utilisateurs & Permissions fonctionnent tous exactement comme décrit dans leurs propres chapitres.
