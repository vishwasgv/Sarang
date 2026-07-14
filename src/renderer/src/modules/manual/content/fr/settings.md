# Paramètres & Profil de l'entreprise

Tout ce qui façonne le comportement de Sarang pour votre entreprise se trouve dans **Paramètres**, accessible depuis la barre latérale. L'écran Paramètres possède son propre menu de sections à gauche — cliquez sur l'une d'elles pour l'ouvrir.

## Profil de l'entreprise

**Paramètres → Profil de l'entreprise** contient les informations qui s'impriment sur chaque facture et reçu : nom de l'entreprise, nom du propriétaire, téléphone, e-mail, numéro GST/TVA, identifiant UPI, site web, et adresse complète (adresse, ville, état, code postal). Vous pouvez aussi téléverser un logo d'entreprise (JPG, PNG ou WebP, moins de 2 Mo) et choisir s'il apparaît sur le Tableau de bord et/ou comme filigrane léger sur les documents imprimés.

Si votre type d'entreprise est **Cabinet de spécialiste**, un champ **Spécialité** supplémentaire apparaît (par ex. Pédiatrie, Orthopédie, ORL). Cliquez sur **Modifier** pour changer l'un de ces champs, puis **Enregistrer les modifications**. Le pays, la devise et le modèle fiscal sont affichés ici à titre indicatif mais se modifient depuis les sections **Devise & Régionalisation** et **Configuration fiscale** respectivement.

## Configuration fiscale

**Paramètres → Configuration fiscale** gère les taux de GST/TVA/taxe de vente disponibles à la facturation. Ajoutez une taxe avec un nom (par ex. « GST 18% »), un type (GST, TVA, Taxe de vente, Personnalisé, ou Aucun), un taux entre 0 et 100 %, et éventuellement un pays et un indicateur « taux par défaut pour ce type de taxe ». Les factures existantes ne sont jamais affectées lorsque vous modifiez ou supprimez un taux de taxe — la suppression ne fait que le désactiver pour l'avenir.

## Devise & Régionalisation

**Paramètres → Devise & Régionalisation** définit votre devise (Sarang prend en charge environ 150 devises mondiales), votre format de nombre (regroupement indien comme 1,00,000.00, US/International, Européen, Britannique, Arabe, ou Indonésien), et le nombre de décimales (0, 2 ou 3). Un aperçu en direct montre exactement comment un montant sera formaté avant que vous n'enregistriez.

## Modèle sectoriel

**Paramètres → Modèle sectoriel** est l'endroit où vous choisissez votre type d'entreprise — Restaurant, Détail, Pharmacie, Quincaillerie, Distributeur, Hôtel/Auberge, Bijouterie, Fabrication, l'un des types de services professionnels (Avocat, Architecte, Cabinet comptable, et bien d'autres), et ainsi de suite. Chaque modèle active un ensemble spécifique de modules fonctionnels — par exemple, Restaurant active la Gestion des tables, l'impression des tickets de cuisine (KOT) et le suivi des recettes/ingrédients, tandis que Pharmacie active le suivi des lots et des péremptions. L'écran affiche la liste exacte des modules sous chaque option pour que vous sachiez ce que vous obtenez.

Changer de modèle modifie immédiatement votre navigation de barre latérale et votre ensemble de fonctionnalités — aucun redémarrage n'est requis — et **toutes les données existantes sont conservées**, seule la visibilité des fonctionnalités change. Comme il s'agit d'un choix unique, passer à un nouveau modèle remplace votre ensemble de modules actuel plutôt que de s'y ajouter (un commerce de détail qui passe à Distributeur perd le module Retours spécifique au Détail, à moins de l'activer aussi séparément — voir ci-dessous).

## Fonctionnalités supplémentaires

**Paramètres → Fonctionnalités supplémentaires** vous permet d'ajouter des modules fonctionnels d'autres types d'entreprise en plus de ce que votre Modèle sectoriel vous offre déjà — utile si votre entreprise couvre réellement plusieurs types (par ex. un commerce de détail qui fait aussi du commerce de gros/revendeur). Ces bascules sont indépendantes de votre Modèle sectoriel et peuvent être activées ou désactivées à tout moment :

- **Flux de retours** — accepter les retours de produits avec inversion automatique du stock et du grand livre.
- **Calculateur de tarification par surface** — tarifer par surface (pi² / m²), utile pour le verre, le contreplaqué ou les carreaux.
- **Application de la limite de crédit** — bloque une vente à crédit dès lors que le solde en cours d'un client dépasserait sa limite de crédit fixée. N'affecte que les clients ayant réellement une limite de crédit définie ; les clients de passage n'ont par défaut aucune limite et ne sont jamais bloqués.
- **Flux de commandes en gros** — un écran de commande en gros séparé avec des paliers de remise basés sur le volume pour les clients grossistes/revendeurs.
- **Analyses des créances en cours** — reporting supplémentaire sur les soldes en cours des clients et leur ancienneté.
- **Logistique & Chaîne d'approvisionnement** — un ensemble couvrant la flotte, les transporteurs, les expéditions, la réception de marchandises (Bon de Réception), les bons de livraison, et le suivi du fret, pour toute entreprise qui déplace des marchandises avec ses propres véhicules ou souhaite suivre formellement les livraisons fournisseurs.

Deux autres fonctionnalités transversales ont leurs propres sections dédiées dans Paramètres plutôt que de figurer dans cette liste : **Codes-barres & Vente au poids** et **Assistant IA** (voir ci-dessous, et leurs propres chapitres du manuel). Désactiver l'une de ces fonctionnalités ne supprime pas les données existantes — cela masque uniquement les écrans et flux associés.

## Codes-barres & Vente au poids

**Paramètres → Codes-barres & Vente au poids** est l'endroit où vous activez la génération de codes-barres, l'impression d'étiquettes code-barres, et la facturation au poids/en vrac. Les trois sont désactivés par défaut pour chaque type d'entreprise. Consultez le chapitre *Codes-barres & Vente au poids* pour tous les détails d'utilisation une fois activés.

## Assistant IA

**Paramètres → Assistant IA** active **Demander à Sarang**, un assistant de questions-réponses hors ligne sur vos propres données d'entreprise. Désactivé par défaut. Consultez le chapitre *Demander à Sarang (Assistant IA)* pour savoir à quoi il peut répondre.

## Langue

**Paramètres → Langue** prend en charge 13 langues : Anglais, Hindi, Kannada, Tamoul, Télougou, Malayalam, Marathi, Gujarati, Espagnol, Français, Arabe, Portugais, et Indonésien. Les langues sont regroupées en listes **Mondiales** et **Langues indiennes**. Sélectionner une langue change immédiatement l'interface — aucun redémarrage nécessaire. Choisir l'arabe bascule aussi automatiquement toute l'interface en mise en page de droite à gauche.

## Apparence

**Paramètres → Apparence** propose deux réglages :

- **Mode sombre** — un interrupteur pour un thème de couleurs sombre.
- **Type d'impression** — choisissez entre **Facture A4** (pleine page, couleur), **Thermique 80mm** (largeur de reçu POS standard), ou **Thermique 58mm** (largeur de reçu POS étroite). Ceci détermine le format utilisé chaque fois que vous imprimez une facture ou un reçu.

Les deux préférences sont enregistrées automatiquement et retenues la prochaine fois que vous ouvrez Sarang.

## Utilisateurs & Rôles, Sécurité, et Sauvegarde

Trois autres sections figurent dans ce même menu Paramètres mais sont couvertes dans leurs propres chapitres : **Utilisateurs & Rôles** (voir *Utilisateurs & Permissions*), **Sécurité** — où vous changez votre propre mot de passe (voir *Utilisateurs & Permissions*), et **Sauvegarde & Restauration**, qui ouvre l'écran dédié à la Sauvegarde (voir *Sauvegarde & Restauration*).

## À propos

**Paramètres → À propos** affiche votre numéro de version installée et la déclaration de transparence de Sarang (quelles données sont ou ne sont pas collectées — aucune, puisque Sarang est entièrement hors ligne).
