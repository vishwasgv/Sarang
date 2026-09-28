# Guide : Taxes hors de l'Inde (TVA, taxe de vente et autres)

Sarang fonctionne pour des entreprises dans n'importe quel pays. Ce guide explique comment la taxe fonctionne quand votre entreprise n'est pas sur la GST indienne, et comment la configurer. Les règles fiscales diffèrent selon le pays et changent, confirmez donc vos taux, le format de votre numéro fiscal et vos déclarations avec votre comptable local ou l'autorité fiscale. Sarang enregistre les taux que vous utilisez ; il ne les décide pas pour vous.

## Les règles du pays s'appliquent uniquement à votre pays

Sarang charge les taux de taxe et les libellés **uniquement pour le pays que vous choisissez comme pays de votre entreprise**. Si votre entreprise est en Allemagne, vous voyez les taux et termes de l'Allemagne et rien d'aucun autre pays. L'Inde fonctionne exactement comme toujours, sauf si vous choisissez un autre pays. Vous choisissez le pays lors de la configuration initiale, ou plus tard dans **Settings → Business Profile**.

**Langue.** Les écrans de Sarang sont disponibles en 13 langues (anglais, hindi, marathi, gujarati, kannada, tamoul, télougou, malayalam, espagnol, français, portugais, arabe et indonésien). Pour un pays dont la langue n'en fait pas partie, les noms et notes fiscaux du pays s'affichent en **anglais**, quelle que soit la langue du reste de l'écran.

## Étape 1 : choisissez votre pays

Lors de la configuration, choisissez votre pays dans la liste (vous pouvez toujours en saisir un qui n'y figure pas). Sarang reconnaît environ 50 pays et, pour chacun, suggère le modèle de taxe, la devise, le libellé du numéro fiscal, les taux standard, si les prix en rayon incluent habituellement la taxe, et l'arrondi en espèces habituel là-bas. Vous confirmez chaque suggestion ; rien n'est appliqué silencieusement.

Pays avec taux intégrés (au 25 septembre 2026) : l'Inde, le Royaume-Uni, l'Irlande, l'Allemagne, la France, l'Italie, l'Espagne, les Pays-Bas, le Portugal, la Belgique, l'Autriche, la Pologne, la Suède, le Danemark, la Suisse, les Émirats arabes unis, l'Arabie saoudite, Oman, Bahreïn, le Qatar, le Koweït, l'Égypte, la Turquie, Israël, l'Australie, la Nouvelle-Zélande, Singapour, la Malaisie, la Thaïlande, l'Indonésie, les Philippines, le Vietnam, le Japon, la Corée du Sud, la Chine, Hong Kong, le Pakistan, le Bangladesh, le Sri Lanka, le Népal, l'Afrique du Sud, le Kenya, le Nigeria, le Ghana, le Canada, les États-Unis, le Mexique, l'Argentine, le Chili et la Colombie. Le Qatar, le Koweït et Hong Kong n'ont pas de TVA ni de taxe de vente, donc ils démarrent sans taxe. Les États-Unis n'ont pas de taxe de vente nationale et leurs taux d'État varient, donc vous ajoutez les vôtres. Le Brésil a plusieurs taxes sur une même vente et n'est pas inclus : ajoutez vos taux à la main. **Les taux changent**, et la liste montre la date de dernière vérification ; confirmez toujours avec votre autorité fiscale.

Si votre pays n'est pas dans la liste, la liste des taux de taxe commence par une seule ligne « No tax » et une note vous demandant d'ajouter vos taux à la main.

## Étape 2 : vérifiez votre modèle de taxe et vos taux

| Modèle de taxe | Utilisé pour | Ce qui s'imprime |
|---|---|---|
| **GST** | Inde | CGST et SGST, ou IGST, ou une ligne GST, avec votre GSTIN |
| **VAT** | Pays avec une taxe sur la valeur ajoutée ou une taxe de type GST (le Royaume-Uni, l'UE, le Golfe, l'Australie, la Nouvelle-Zélande, Singapour, le Canada et d'autres). La ligne utilise le propre nom de votre pays pour la taxe, par exemple GST en Australie | Une ligne portant le nom de votre taxe |
| **Sales Tax** | Les États-Unis et d'autres pays à taxe de vente | Une ligne nommée **Sales Tax** |
| **Custom** | Toute autre taxe avec son propre nom | Une ligne nommée **Tax** |
| **None** | Aucune taxe facturée | Aucune ligne de taxe |

Ouvrez **Settings → Tax Configuration**. Cela liste les taux que vous facturez. Si le pays de votre entreprise a des taux intégrés, un bouton **Load tax rates for {your country}** ajoute ceux qui manquent (il ne supprime ni ne modifie jamais ceux que vous avez, ni ne modifie les documents passés). L'écran affiche la date de dernière vérification des taux et toute note, par exemple là où un pays a des taux provinciaux ou d'État en plus. Marquez votre taux habituel comme celui par défaut, et ajoutez celui qui manque. Fixez ensuite le bon taux sur chaque produit (Products → Tax Rate %) ou choisissez-le parmi vos taux enregistrés. Sarang vous avertit doucement si un taux que vous saisissez n'est pas l'un de vos taux enregistrés.

Choisissez la **Tax category** de chaque produit : standard, reduced, zero-rated, exempt, nil-rated ou out of scope. Un article **zero-rated** (facturé à 0 pour cent mais encore déclarable) est différent d'un article **exempt**. Un client exonéré peut être marqué comme exonéré de taxe sur sa page, avec le numéro de certificat d'exonération ou de revente et la date jusqu'à laquelle il est valide ; ses factures ne portent pas de taxe tant que le certificat est valide, et la taxe est facturée à nouveau après cette date (le formulaire client vous avertit).

### Diviser un taux en parties

Là où une vente porte deux taxes (la GST fédérale du Canada plus la PST provinciale, ou la taxe de vente d'État plus celle du comté aux États-Unis), saisissez le **taux combiné** comme un seul taux, puis dans le formulaire du taux utilisez **Add part** pour nommer ses parties, par exemple GST 5 et PST 7 pour un taux de 12 pour cent. Les parties doivent totaliser le taux. Le montant facturé ne change pas ; les factures, devis, factures fournisseur et bons de commande affichent alors chaque partie sur sa propre ligne, et **Reports → Tax by Part** additionne la taxe sur les ventes et les achats pour chaque partie, afin que chacune puisse être déclarée auprès de sa propre autorité. Une taxe facturée sur une autre taxe (taxe sur taxe) n'est pas modélisée : saisissez plutôt le taux combiné effectif.

## Étape 3 : prix avec ou sans taxe

Les magasins de nombreux pays affichent des prix en rayon qui incluent déjà la taxe. Lors de la configuration, Sarang suggère si les prix dans votre pays incluent habituellement la taxe, et vous confirmez. Vous pouvez le changer à tout moment dans **Settings → Currency & Locale → Prices include tax**, et sur chaque document se trouve un interrupteur **Prices include tax** avec la colonne de prix étiquetée **(incl. tax)** ou **(excl. tax)**.

Hors taxe, la taxe est ajoutée en plus :

```
valeur imposable = quantité x prix - remise
taxe             = valeur imposable x taux
total            = valeur imposable + taxe
```

Exemple : 3 articles à 10,00, remise 10 pour cent, TVA 20 pour cent. Ligne 30,00, imposable 27,00, TVA 5,40, total 32,40.

Taxe incluse, la taxe est extraite du prix que vous avez saisi : un prix de 12,00 incluant 20 pour cent de TVA donne imposable 10,00, TVA 2,00, total 12,00. Le total est toujours le prix que voit le client.

Les montants gardent les décimales exactes qu'utilise votre devise (deux pour dollars, livres, euros et dirhams ; trois pour dinar ; aucune pour yen).

## Étape 4 : arrondi en espèces

**Settings → Currency & Locale → Invoice rounding** propose None, nearest 0.05, 0.10, 0.50 ou 1. De nombreux pays arrondissent les totaux en espèces (par exemple à 0,05 en Suisse, en Australie et en Nouvelle-Zélande). Lors de la configuration, Sarang suggère la règle habituelle de votre pays et vous la confirmez. L'arrondi apparaît comme sa propre ligne sur la facture.

## Étape 5 : numéros fiscaux

Saisissez votre **numéro fiscal** dans **Settings → Business Profile** ; il s'imprime sur les factures. Le champ prend le nom qu'utilise votre pays (VAT number, TRN, ABN, EIN, GST number, etc.). Clients et fournisseurs ont le même champ. Là où Sarang est certain du format du numéro d'un pays, il affiche un indice discret si le numéro semble incorrect ; il ne vous empêche jamais d'enregistrer. Sarang vérifie le format strict uniquement du GSTIN, PAN et IFSC indiens.

## Vendre à d'autres pays

- **Devise étrangère :** sur un document de vente, cochez l'option devise étrangère et saisissez le code de devise. Si vous tenez un tableau de taux dans **Settings → Business Features → Exchange rates** (saisissez-les ou importez un CSV avec les colonnes devise, taux, date), le taux le plus récent se complète pour vous ; vous pouvez toujours le changer. Sarang affiche le montant converti et tient vos livres dans votre propre devise. Quand le client paie, **Settle in {currency}** enregistre tout gain ou perte de change.
- **Taxe sur les exportations :** de nombreux pays mettent les exportations en zero-rate. Quand le pays du client diffère du vôtre, l'écran de Facturation affiche **Export sale?** : cochez-le et la vente devient zero-rated, avec la mention « Export supply, zero-rated » sur la facture. Sarang ne le fait jamais de lui-même. Demandez à votre comptable quelles ventes sont éligibles et conservez votre preuve d'exportation.
- **Fournisseurs à l'étranger :** enregistrez une **Supplier Bill** en devise étrangère de la même façon. Si vous devez comptabiliser vous-même la taxe sur une importation ou un service de l'étranger (reverse charge), cochez **Reverse Charge** sur la facture.

## Notes de crédit et de débit

Chacune a **Add tax to this note** : omettez-le et le total de la note est seulement le montant ; ajoutez-le et la taxe est calculée sur la note comme sur tout document. Voir *Guide : Taxes et GST, comment Sarang les calcule* pour les détails.

## Rapports utilisables pour votre déclaration

- **Reports → VAT / Sales Tax Return :** un document de travail organisé selon les cases de la déclaration de votre pays pour le Royaume-Uni, l'Australie, la Nouvelle-Zélande, le Canada, Singapour, les Émirats arabes unis, l'Arabie saoudite et l'Afrique du Sud, et un résumé générique (ventes et achats par traitement fiscal) pour tout autre pays. Les cases que Sarang ne peut pas remplir à partir de vos registres restent à zéro et sont étiquetées en anglais. Vérifiez chaque case par rapport au formulaire de votre autorité fiscale avant de déposer.
- **Reports → Tax Report :** taxe facturée sur les ventes, par taux et par catégorie de taxe, pour toute plage de dates. Fonctionne pour chaque modèle de taxe.
- **Reports → Tax by Part :** taxe sur les ventes et les achats pour chaque partie nommée d'un taux.
- **Reports → Purchase Register :** ce que vous avez acheté, avec la taxe de chaque facture, pour que votre comptable puisse calculer la taxe que vous pouvez récupérer.
- **Reports → TDS Deducted** et **TDS Receivable :** taxe que vous avez retenue aux fournisseurs, et taxe que vos clients vous ont retenue. Les écrans appellent cela TDS ; utilisez-le aussi pour la retenue à la source dans votre pays, et confirmez les règles avec votre conseiller fiscal.
- **Reports → Profit and Loss**, **Balance Sheet**, **Trial Balance** et **Cash Book** pour la période.

## Limites à connaître aujourd'hui

- Un taux de taxe par ligne. Deux taxes sur une vente sont gérées en divisant le taux combiné en parties (ci-dessus) ; le montant facturé est toujours le taux combiné.
- Sarang ne choisit pas un taux selon l'état, le comté ou la ville du client. Ajoutez les taux combinés dont vous avez besoin (par exemple un par état où vous vendez) et choisissez le bon sur le produit ou la ligne.
- Les éléments propres à l'Inde (GST return files, e-way bill, HSN, PF et ESI) sont masqués pour les autres pays.
- Les soumissions de facturation électronique gouvernementale et le dépôt en ligne ne sont pas inclus ; Sarang fonctionne hors ligne et n'envoie jamais rien à une autorité fiscale.
