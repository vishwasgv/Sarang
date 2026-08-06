# Assistant d'Importation de Données

Ouvrez **Importer** depuis la barre latérale pour charger en masse des Produits, Clients, Fournisseurs, du Stock (stock d'ouverture) ou des Soldes d'Ouverture depuis un fichier CSV ou Excel (.xlsx) — utile lorsque vous passez à Sarang depuis un autre système ou un tableur, plutôt que de saisir des centaines d'enregistrements un par un.

## Étape 1 — Choisir un module

Choisissez exactement un des cinq types d'importation : **Produits**, **Clients**, **Fournisseurs**, **Stock** ou **Soldes d'Ouverture**. Chacun a sa propre liste de colonnes attendues, affichée une fois que vous continuez.

## Étape 2 — Téléverser votre fichier

Glissez-déposez un fichier `.csv` ou `.xlsx` sur la zone de dépôt, ou appuyez sur **Parcourir** pour en choisir un depuis une boîte de dialogue. Si vous n'avez pas encore de fichier prêt, appuyez d'abord sur **Télécharger le Modèle** — cela génère un tableur de départ avec les en-têtes de colonnes corrects pour le module choisi.

Le panneau **Colonnes attendues** liste chaque colonne comprise par l'import pour ce module, récupérée en direct afin qu'elle ne puisse jamais devenir obsolète par rapport à ce que l'application accepte réellement. Un point rouge et un astérisque marquent une colonne comme requise ; tout le reste est facultatif.

**Avertissement sur les zéros non significatifs** : si l'une de vos valeurs SKU, Code-barres ou Téléphone comporte des zéros non significatifs (comme `0012`), formatez cette colonne en **Texte** dans Excel avant d'enregistrer. Excel supprime silencieusement les zéros non significatifs de toute colonne laissée au format Standard ou Nombre, et une fois cela fait, la valeur d'origine ne peut plus être récupérée — Sarang ne voit jamais le zéro.

## Étape 3 — Associer les colonnes

Pour chaque champ attendu par Sarang, choisissez quelle colonne de votre fichier le fournit, à l'aide du menu déroulant à côté de chaque nom de champ. Sarang préremplit automatiquement une correspondance la plus probable en associant les noms d'en-tête de votre fichier, donc la plupart des imports ne nécessitent qu'une vérification rapide plutôt que d'associer chaque champ manuellement. Un champ ne peut être associé qu'à une seule colonne à la fois — choisir une nouvelle colonne pour un champ efface automatiquement la colonne qui lui était associée auparavant.

## Étape 4 — Aperçu

Sarang valide les 20 premières lignes de votre fichier et affiche chacune comme **Valide**, **Doublon** (sera ignorée — un enregistrement correspondant existe déjà) ou **Erreur** (sera ignorée, avec la raison précise affichée, comme un champ requis manquant ou une valeur mal formatée). Il s'agit d'un échantillon, pas d'une validation complète — le résumé indique explicitement que seules les 20 premières lignes ont été vérifiées, et les lignes restantes sont validées au fur et à mesure qu'elles sont réellement traitées lors de l'importation, donc les totaux finaux peuvent légèrement différer de ce qu'affichait l'aperçu.

## Étape 5 — Confirmer et lancer

Avant que l'importation ne s'exécute réellement, Sarang s'assure toujours qu'une sauvegarde de sécurité existe — soit en réutilisant une sauvegarde des 15 dernières minutes, soit en en créant une nouvelle si aucune n'existe. Aucune importation ne se poursuit sans cette sauvegarde en place.

Le mode d'importation est toujours **Création Uniquement** : une ligne dont la clé (SKU, téléphone, nom — selon le module) correspond déjà à un enregistrement existant est ignorée, jamais écrasée. Cela rend une importation sûre à relancer sur le même fichier sans risque de dupliquer ou de corrompre les données existantes, mais cela signifie aussi que corriger une faute de frappe dans une ligne déjà importée nécessite de modifier cet enregistrement directement par la suite, et non de le réimporter.

Appuyez sur **Lancer l'Importation** pour commencer. Une barre de progression suit les lignes traitées par rapport au total du fichier pendant l'exécution.

## Étape 6 — Résultats

Une fois l'importation terminée, vous voyez exactement combien de lignes ont été **Importés**, **Ignorés** (doublons), **Échecs** (erreurs), et combien d'**Avertissements** ont été soulevés en cours de route, ainsi qu'une liste défilante de chaque erreur de ligne précise le cas échéant. À partir de là, **Importer un Autre Fichier** vous ramène à l'Étape 1 pour une nouvelle importation, ou **Terminé** ferme l'assistant.

## En cas de problème

Comme une sauvegarde de sécurité est toujours effectuée en premier, une importation qui se passe mal peut être annulée en restaurant cette sauvegarde depuis **Paramètres → Sauvegarde et restauration** — voir le chapitre Sauvegarde et Restauration de ce Manuel.
