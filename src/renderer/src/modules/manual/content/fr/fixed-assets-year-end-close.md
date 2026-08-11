# Immobilisations et Clôture de Fin d'Année

## Le registre des Immobilisations

Ouvrez **Fixed Assets** depuis la barre latérale et cliquez sur **New Asset** pour enregistrer quelque chose que votre entreprise possède et utilise dans la durée — un véhicule, un équipement, du mobilier, un ordinateur portable — plutôt que quelque chose acheté pour être revendu. Saisissez sa date d'achat, son coût, sa durée de vie utile (en mois), sa méthode d'amortissement et sa valeur résiduelle (ce qu'il vaudra probablement une fois totalement amorti, souvent zéro).

Ajouter un actif ici n'enregistre pas d'écriture d'achat propre — l'achat lui-même a déjà été enregistré via une Facture Fournisseur ou une Dépense lorsque vous l'avez réellement acheté. Ce registre existe pour suivre ce que vous possédez et l'amortir correctement dans le temps, pas pour enregistrer l'achat une seconde fois.

## Exécuter l'amortissement

Ouvrez l'écran de détail propre d'un actif et cliquez sur **Run Depreciation** pour une période. Sarang prend en charge deux méthodes :

- **Straight-Line** (linéaire) — le même montant chaque période : (coût − valeur résiduelle) ÷ durée de vie utile.
- **WDV (Written-Down Value, valeur dégressive)** — un pourcentage décroissant de la valeur comptable actuelle de l'actif à chaque période, de sorte que le montant d'amortissement est le plus important au début et diminue avec le temps.

Chaque exécution enregistre une véritable Journal Entry (Débit à Depreciation Expense, Crédit à Fixed Assets) et met à jour l'amortissement cumulé de l'actif. Exécuter l'amortissement deux fois pour la même période est totalement bloqué — Sarang ne vous laissera pas l'enregistrer deux fois par accident.

## Céder un actif (Dispose)

Lorsque vous vendez, mettez au rebut ou passez en perte un actif, ouvrez-le et cliquez sur **Dispose**. Saisissez la date de cession et (s'il a été vendu) le montant reçu. Sarang le compare à la valeur comptable actuelle de l'actif et enregistre la différence comme un véritable gain ou une perte — une vente au-dessus de la valeur comptable est un gain, en dessous une perte — afin que la cession soit correctement reflétée dans vos livres, pas simplement marquée comme inactive.

## Clôturer votre exercice fiscal

En fin d'année, ouvrez **Ledger Settings** et utilisez **Year-End Close**. Il s'agit d'une action réelle et permanente : elle calcule le solde de chaque compte à la date de clôture, intègre le résultat net de l'année (bénéfice ou perte) dans Owner's Capital (la pratique comptable standard consistant à remettre à zéro chaque année les comptes de produits et de charges tout en reportant ce qui a été réellement gagné ou dépensé vers les capitaux propres), et enregistre une seule écriture d'ouverture qui reporte chaque solde vers la nouvelle année.

La date de clôture est ensuite verrouillée automatiquement via le même mécanisme de Transaction Locking décrit dans le chapitre Grand Livre et Écritures de Journal — rien dans l'année clôturée ne peut être modifié par la suite, tandis que les données de chaque année clôturée restent entièrement intactes et consultables, jamais supprimées ni archivées hors d'atteinte.

Year-End Close refuse de s'exécuter à nouveau sur une période déjà clôturée, et refuse de s'exécuter sur une période sans activité réelle à reporter — elle ne s'exécute donc jamais deux fois par accident, et n'enregistre jamais une écriture vide ou dénuée de sens.
