# Guide : Taxes et GST, comment Sarang les calcule

Sarang calcule la taxe de la même façon sur chaque document, et vous montre les mêmes chiffres à l'écran, sur le document enregistré, à l'impression, dans le grand livre et dans les rapports. Ce guide explique les règles, comment les configurer, et où voir les totaux. C'est un guide de travail pour vos propres registres. Le droit fiscal change et dépend de votre situation, confirmez donc vos taux et déclarations avec votre comptable ou expert-comptable.

## Deux façons de saisir les prix

Chaque prix dans Sarang (prix de revient, prix de vente, coût unitaire) est soit **hors taxe** soit **taxe incluse**, et chaque document indique lequel.

- **Hors taxe (par défaut pour l'Inde) :** Sarang ajoute la taxe en plus.
- **Taxe incluse :** le prix que vous saisissez contient déjà la taxe, comme sur une étiquette de rayon ou un MRP. Sarang calcule la taxe à l'envers.

Choisissez votre façon habituelle de fixer les prix dans **Settings → Currency & Locale → Prices include tax**. Cela devient le choix de départ pour chaque nouveau document. Sur chaque document (facture, devis, commande de vente, bon de commande, facture fournisseur, note de crédit, note de débit) se trouve un interrupteur **Prices include tax**, et la colonne de prix est étiquetée **(excl. tax)** ou **(incl. tax)**, donc jamais ambigu. Basculer l'interrupteur convertit les prix que vous avez saisis pour que le client paie la même chose. Sur l'écran de Facturation, l'interrupteur est verrouillé tant que le panier contient des articles, ainsi une facture ne mélange jamais les deux façons.

### L'arithmétique

Hors taxe :

```
montant de ligne  = quantité x prix
valeur imposable   = montant de ligne - remise
taxe               = valeur imposable x taux de taxe
total de ligne     = valeur imposable + taxe
```

Exemple : 2 unités à 500, remise 100, taxe 18 pour cent. Montant de ligne 1 000. Valeur imposable 900. Taxe 162. Total 1 062.

Taxe incluse :

```
montant de ligne  = quantité x prix          (contient déjà la taxe)
après remise        = montant de ligne - remise
valeur imposable    = après remise / (1 + taux)
taxe                = après remise - valeur imposable
```

Exemple : 1 unité au prix de 118 avec 18 pour cent de taxe incluse. Valeur imposable 100. Taxe 18. Total 118.

Dans les deux façons, la taxe est calculée sur la valeur **après remise**, une remise au niveau du document est répartie équitablement entre les lignes, et la dernière ligne prend le reste pour que les lignes s'additionnent toujours au total. Le sous-total, la remise, la taxe et le total sont des unités entières de votre devise (paise, centimes, fils) sans décimales égarées.

### Arrondir le total

**Settings → Currency & Locale → Invoice rounding** choisit comment le total à payer est arrondi : **None**, **nearest 0.05**, **0.10**, **0.50** ou **1**. Les entreprises en roupie indienne démarrent sur « nearest 1 » ; toute autre devise démarre sur « None ». L'arrondi apparaît comme sa propre ligne sur la facture. Les notes de crédit et de débit ne sont jamais arrondies de cette façon.

## Fixez le taux de taxe une fois, sur le produit

**Inventory → Produits →** ce produit **→ Tax Rate %**. Saisissez un taux ou cliquez sur l'un de vos taux enregistrés. Il se complète ensuite sur les factures, devis, commandes de vente, bons de commande, factures fournisseur et notes de débit lorsque vous choisissez le produit. Vous pouvez toujours modifier le taux sur une seule ligne. Si un taux que vous saisissez n'est pas l'un de vos taux enregistrés, Sarang affiche un avertissement discret pour repérer une faute de frappe comme 81 au lieu de 18.

Choisissez aussi la **Tax category** du produit : **Standard**, **Reduced**, **Zero-rated**, **Exempt**, **Nil-rated** ou **Out of scope**. La catégorie est mémorisée sur chaque ligne de document et détermine le Tax Report et les lignes GSTR-1 pour les fournitures nil-rated, exempt et non-GST. Une ligne qui facture réellement une taxe ne peut jamais être déclarée comme exempt ou nil-rated.

## Taux de GST en Inde

Les taux de GST ont changé le 22 septembre 2025. Les taux en vigueur sont maintenant **5 pour cent**, **18 pour cent** et **40 pour cent** (une courte liste de biens de luxe et de péché), plus **nil**, avec des taux spéciaux de **3 pour cent** (or, argent, bijouterie) et **0,25 pour cent** (diamants bruts). Les taux de 12 et 28 pour cent ont été retirés. Sarang les propose comme taux enregistrés et garde vos anciens taux de 12 et 28 pour cent visibles sous **Older rates (before 22 Sep 2025)** dans **Settings → Tax Configuration**, pour que les anciens registres restent cohérents. Le taux applicable à un article dépend de son code HSN : demandez à votre expert-comptable et fixez-le sur le produit. Les anciens documents gardent le taux avec lequel ils ont été créés ; changer le taux d'un produit ne modifie jamais les documents passés.

## Comment la taxe est affichée : CGST + SGST, IGST, ou GST

Pour une entreprise assujettie à la GST, chaque document fiscal a un choix **Tax shown as** :

| Choix | À utiliser quand | Ce qui s'imprime |
|---|---|---|
| **CGST + SGST** | L'acheteur est dans le même état | Deux lignes égales (pour 18 pour cent, 9 plus 9) |
| **IGST** | L'acheteur est dans un autre état | Une ligne IGST |
| **GST** | Vous voulez une seule ligne combinée | Une ligne nommée GST |

Sarang choisit pour vous en comparant l'état de votre entreprise avec celui du client (ou, pour les achats, celui du fournisseur), et vous pouvez le changer sur le document. Si le client n'a pas d'état enregistré mais a un GSTIN, les deux premiers chiffres du GSTIN (le code d'état) sont utilisés. Si aucun n'est connu, Sarang utilise CGST + SGST.

**Le montant de la taxe et le total sont exactement les mêmes dans les trois choix.** Seule la façon dont le même montant est affiché change. Quand un montant ne se divise pas exactement, les deux moitiés diffèrent d'au plus un paisa et s'additionnent toujours pour retrouver la taxe entière. Dans les rapports, un document affiché comme une seule ligne GST est classé comme CGST + SGST ou IGST selon son lieu de fourniture, et le rapport indique combien de documents n'avaient pas d'état.

## Notes de crédit et de débit : ajouter la taxe ou l'omettre

Chaque note de crédit et de débit a **Add tax to this note**. Elle démarre activée quand la facture, le bon de commande ou la facture liée portait une taxe, et désactivée sinon ; vous pouvez la changer.

- **Omettre la taxe :** le total de la note est égal au montant ; aucune ligne de taxe n'est imprimée ; le solde du client ou du fournisseur bouge seulement de ce montant.
- **Ajouter la taxe :** une note construite à partir d'articles utilise le taux de taxe de chaque ligne ; une note à montant simple demande un taux de taxe et traite le montant comme hors taxe ou taxe incluse selon le propre réglage de prix de la note. La taxe est affichée comme CGST + SGST, IGST ou GST comme tout autre document.

Si vous omettez la taxe sur une note liée à un document qui portait une taxe, Sarang vous avertit que la taxe facturée plus tôt ne sera pas annulée ; vous pouvez tout de même continuer. Le Tax Report, GSTR-1 et GSTR-3B incluent la taxe d'une note seulement quand elle a été ajoutée.

## Cas particuliers

| Situation | Que faire |
|---|---|
| Le client est exonéré de taxe | Marquez le client comme exonéré de taxe sur sa page et saisissez le numéro du certificat d'exonération et la date jusqu'à laquelle il est valide. Ses factures ne portent pas de taxe tant que le certificat est valide ; après cette date, Sarang facture à nouveau la taxe et le formulaire client affiche un avertissement |
| Vente à un client dans un autre pays (exportation) | Sur l'écran de Facturation, cochez **Export sale?** (apparaît quand le pays du client diffère du vôtre). La vente est alors zero-rated. Sarang ne le fait jamais de lui-même ; vérifiez les règles d'exportation et conservez la preuve d'exportation |
| Votre entreprise relève du Composition Scheme | **Settings → Business Profile → GST Scheme → Composition Scheme.** Les ventes sont alors émises comme Bill of Supply sans taxe séparée |
| Un achat où **vous** payez la taxe (reverse charge) | Cochez **Reverse Charge** sur la facture fournisseur ou la dépense. La taxe est enregistrée comme votre propre obligation plutôt que comme une part de ce que vous devez au fournisseur |
| Client ou fournisseur à l'étranger | Utilisez l'option devise étrangère sur le document ; les montants gardent les propres décimales de votre devise |
| Un échantillon gratuit ou un article promotionnel | Utilisez **Give free** sur la ligne, ou laissez un barème tarifaire ajouter des lignes comme « achetez 2, obtenez 1 gratuit ». Le stock sort ; prix et taxe sont à zéro |
| Livraison, emballage ou autres frais | **Add Charge** sur l'écran de Facturation, avec le taux de taxe applicable à ce frais |
| Le client a retenu l'impôt sur le revenu (TDS) en payant | Enregistrez-le dans la fenêtre de paiement de la facture comme **TDS deducted**. Ce n'est pas de l'argent reçu ; c'est une taxe pour laquelle vous réclamerez un crédit (**Reports → TDS Receivable**) |

## Où voir les totaux de taxe

- **Reports → Tax Report :** taxe facturée sur les ventes, par taux et par catégorie de taxe.
- **Reports → GSTR-1 :** ventes pour la déclaration, business-to-business par facture et taux, business-to-consumer par taux et état, lignes nil-rated, exempt et non-GST, et lignes de notes de crédit et de débit.
- **Reports → GSTR-3B Preview :** fournitures sortantes (y compris zero-rated) et achats en reverse-charge du mois. C'est un aperçu pour comparer avec ce que montre le portail ; le dépôt se fait sur le portail du gouvernement.
- **Reports → HSN Summary :** ventes par code HSN (les lignes de devis portent le code HSN jusqu'à la facture).
- **Reports → Purchase GST Register** et **Purchase HSN Summary :** la même chose pour les achats (factures, bons de commande reçus et notes de débit).
- **Reports → GST Net Payable & Input Credit :** la taxe que vous avez facturée, le crédit de taxe d'amont de vos achats, et ce qui reste à payer ou à reporter, par CGST, SGST et IGST.
- **Reports → GSTR-9 Annual Data :** un document de travail des chiffres de l'année pour votre déclaration annuelle.
- **Reports → TDS Deducted :** taxe que vous avez retenue aux fournisseurs, par section, et combien reste à déposer.
- **Reports → TDS Receivable :** taxe que vos clients ont retenue.
- Sur chaque facture imprimée : les lignes de taxe pour la présentation choisie et, le cas échéant, la mention « Prices include tax ».

## Taxe sur les achats et crédit de taxe d'amont

Les factures fournisseur, bons de commande et notes de débit calculent la taxe de la même façon. Le coût du stock n'inclut jamais la taxe d'achat : pour une facture ou un bon de commande au prix taxe incluse, Sarang utilise le coût hors taxe pour la valeur d'inventaire et le coût moyen.

Pour une entreprise GST sous le régime normal, la taxe sur chaque facture fournisseur, bon de commande reçu et note de débit est enregistrée comme **input tax credit** dans son propre compte. **GST Net Payable & Input Credit** montre ce que vous avez facturé, le crédit dont vous disposez, et la différence. Le crédit n'est enregistré que pour les documents créés à partir de maintenant ; les achats antérieurs ne sont pas comptés, et le rapport le précise. Il ne décide pas non plus dans quel ordre le crédit est imputé sur chaque rubrique : c'est votre comptable qui en décide.

**Accounting → GST Payments** (Inde) enregistre le paiement que vous faites au gouvernement : il réduit ce que vous devez en taxe et le crédit que vous avez utilisé, et réduit votre banque ou votre caisse. Vérifiez les montants avec votre comptable avant de payer.

**Accounting → GST Return Files** (Inde) prépare **GSTR-1** et **GSTR-3B** sous forme de fichiers JSON que vous pouvez téléverser vous-même sur le portail du gouvernement ou ouvrir dans son outil hors ligne : choisissez le mois, préparez le fichier et enregistrez-le. Sur la propre page d'une facture, les cartes **e-invoice** et **e-way bill** préparent le fichier de demande pour cette facture, et après l'avoir téléversé à la main, vous saisissez l'IRN qu'il retourne pour qu'il s'imprime avec son code QR (**Reports → E-invoice IRN Register** les liste). Tout cela ce sont des brouillons faits à partir de vos registres. La structure de ces fichiers suit le format hors ligne du portail tel que nous le comprenons, alors ouvrez chacun dans l'outil propre du gouvernement et corrigez ce qu'il signale avant de vous y fier. Rien n'est envoyé au gouvernement depuis Sarang.

**Rapprocher vos achats avec le portail :** téléchargez votre GSTR-2B (ou 2A) en JSON depuis le portail et choisissez-le dans **GST Return Files**. Sarang le rapproche de vos factures fournisseur par GSTIN du fournisseur, numéro et date de facture, et liste ce qui correspond, ce qui diffère, ce qui manque dans vos registres et ce qui manque sur le portail. Saisissez le propre numéro et la date de facture de chaque fournisseur sur la facture pour que le rapprochement fonctionne.

## Erreurs courantes

| Erreur | Résultat | Correction |
|---|---|---|
| Saisir un prix taxe incluse sur un document hors taxe | La taxe s'ajoute sur un prix qui la contenait déjà | Activez **Prices include tax** pour ce document, ou saisissez le prix hors taxe |
| Oublier de fixer le taux de taxe sur un nouveau produit | Les documents n'affichent aucune taxe | Fixez-le sur le produit |
| Utiliser le mauvais taux pour un article | Taxe incorrecte sur chaque vente | Confirmez le HSN et le taux avec votre expert-comptable et corrigez le produit |
| Choisir IGST pour une vente dans le même état | Une ligne IGST au lieu de CGST et SGST | Changez **Tax shown as** sur le document avant d'enregistrer, ou annulez et réémettez, ou utilisez une Note de crédit |
| Omettre la taxe sur une note de crédit d'une facture taxée | La taxe que vous avez facturée reste dans les livres | Réactivez **Add tax to this note** |
