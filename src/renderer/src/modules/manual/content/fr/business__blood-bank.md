# Banque du sang

## Ce qui est différent dans ce type d'entreprise

Une Banque du sang suit les donneurs, les dons, le dépistage, le stock, et la délivrance — un flux de travail sans réel équivalent ailleurs dans Sarang. Elle n'utilise délibérément **pas** l'écran générique de Gestion des lots que Pharmacie et Intrants agricoles utilisent, même si chaque unité de sang utilisable devient sous le capot un enregistrement de lot. L'écran générique a une fenêtre fixe de 30 jours pour « bientôt expiré » et aucune notion de groupe sanguin — les deux inadaptés au sang, où une unité de plaquettes n'est utilisable que pendant environ 5 jours et une unité de sang total pendant environ 35. Banque du sang obtient donc son propre écran dédié **Stock de sang** avec des règles de péremption conçues spécifiquement pour le sang, tout en réutilisant le même grand livre de stock sous-jacent que tout le reste.

## Registre des donneurs

Ouvrez **Donneurs** dans la barre latérale pour enregistrer un nouveau donneur — nom, téléphone, date de naissance, **sexe**, groupe sanguin, et poids. Chaque donneur obtient un code donneur séquentiel (par ex. `DNR-202607-0001`). Un donneur peut être marqué **ajourné** (temporairement ou indéfiniment inéligible pour donner, avec un motif), ce qui bloque l'enregistrement d'un nouveau don de sa part jusqu'à ce que la période d'ajournement soit réellement passée. Vous pouvez envoyer un rappel WhatsApp à un donneur une fois qu'il redevient éligible — Sarang estime sa prochaine date d'éligibilité à partir du type de son dernier don et de son sexe (90 jours pour le sang total/culot globulaire pour un donneur de sexe masculin, 120 pour un donneur de sexe féminin, 14 pour les plaquettes, 28 pour le plasma) comme valeur par défaut prudente ; suivez toujours vos propres directives médicales/réglementaires locales pour la véritable fenêtre d'éligibilité.

Plutôt que de vérifier chaque donneur un par un, appuyez sur **Recall Due** en haut du Registre des Donneurs pour filtrer la liste aux seuls donneurs dont le délai est déjà écoulé — cela transforme le registre en une véritable liste de travail de sensibilisation que vous pouvez parcourir, en envoyant un rappel de rappel à chacun directement depuis là.

## Dons & Collectes

Enregistrez chaque don sous **Dons & Dépistage** — donneur, groupe sanguin, type de composant (Sang total, Culot globulaire, Plaquettes, Plasma, ou Cryoprécipité), et volume. Vous pouvez éventuellement organiser les dons sous une collecte de dons (nom, lieu, date, organisateur) pour les collectes menées en dehors de vos propres locaux.

Planifiez et suivez vos propres collectes sous **Donation Camps** dans la barre latérale — nom, date, lieu et organisateur. Chaque don enregistré dans le cadre d'une collecte compte pour la fréquentation propre de cette collecte, affichée directement sur sa fiche, afin que vous puissiez voir en un coup d'œil quelles collectes attirent réellement des donneurs et lesquelles ne valent pas la peine d'être répétées.

## Dépistage

Chaque don commence par un dépistage **En attente**. Seul un résultat **Réussi** crée un stock réel et utilisable — c'est à ce moment qu'un enregistrement de lot est créé avec une date de péremption calculée à partir de la durée de conservation réelle du type de composant (35 jours pour le Sang total, 42 pour le Culot globulaire, 5 pour les Plaquettes, 365 pour le Plasma et le Cryoprécipité). Un résultat **Échoué** n'entre jamais du tout en stock. Cette barrière est délibérée : une unité non dépistée ou ayant échoué ne devrait jamais être délivrable.

## Stock de sang

Ouvrez **Stock de sang** pour voir chaque unité disponible regroupée par groupe sanguin et type de composant, avec les jours avant péremption et un indicateur « bientôt expiré » utilisant une fenêtre d'alerte par composant (aussi peu que 2 jours pour les plaquettes, jusqu'à 30 pour le plasma) plutôt qu'un seul seuil générique.

## Délai Don-à-Émission

Ouvrez le rapport **Donation-to-Issue Cycle Time** pour voir à quelle vitesse les unités données sont réellement utilisées, par type de composant. Il s'agit d'un véritable indicateur de risque de gaspillage, pas seulement un instantané du stock — le même délai de cycle moyen de 10 jours est normal pour le plasma (durée de conservation de 365 jours) mais un signal d'alerte sérieux pour les plaquettes (durée de conservation de 5 jours), le rapport classe donc les composants selon leur propre délai de cycle moyen plutôt que de tout mélanger en un seul chiffre.

## Délivrance — sensible à la compatibilité

Lors de la délivrance d'unités à un receveur, Sarang vérifie la compatibilité ABO/Rh entre le groupe sanguin du receveur et le groupe de chaque unité de donneur, en utilisant les règles standards pour le sang total / le culot globulaire (et la règle inverse pour le plasma, où AB est le donneur universel). **Une unité incompatible ne peut pas être délivrée** — le bouton Délivrer les Unités reste désactivé jusqu'à ce que vous choisissiez soit une unité compatible, soit, pour une véritable délivrance d'urgence, cochiez **Dérogation — délivrance d'urgence** et saisissiez un motif documenté (les deux sont exigés ensemble ; le motif est enregistré sur la fiche de délivrance et journalisé). Les plaquettes et le cryoprécipité n'ont aucune règle de compatibilité stricte appliquée, conformément à la pratique courante des banques de sang pour ces composants. Cette vérification ne remplace jamais la véritable procédure de compatibilité croisée de votre laboratoire. Délivrer une unité la marque définitivement comme utilisée et réduit le grand livre de stock ; annuler une délivrance non facturée restitue les unités.

En cas d'urgence, utilisez **Fast Match** dans le formulaire de délivrance des unités au lieu de faire défiler vous-même toute la liste des unités — saisissez le groupe sanguin du receveur, le type de composant nécessaire et le nombre d'unités, puis appuyez sur **Find & Select** pour sélectionner instantanément chaque unité compatible en stock, celle qui expire le plus tôt en premier, jusqu'à la quantité demandée. Si moins d'unités compatibles sont disponibles que demandé, Sarang vous indique exactement de combien il en manque afin que vous sachiez immédiatement si vous devez chercher ailleurs.

## Facturation

Générez une facture à partir d'une délivrance de sang une fois que chaque unité délivrée a un prix défini et que la délivrance est liée à un client.

## Langue

Banque du sang n'est pas l'un des modèles d'entreprise de service de Sarang — c'est un type d'entreprise par catégorie de produit, il n'est donc **pas** verrouillé à une langue. L'interface complète est disponible dans les 13 langues prises en charge.
