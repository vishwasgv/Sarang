# Grand Livre et Écritures de Journal

## Ce qui s'enregistre automatiquement dans le grand livre

Chaque action réelle de mouvement d'argent que vous effectuez déjà dans Sarang — créer une Facture, enregistrer une Facture Fournisseur, recevoir un Paiement, payer un Fournisseur, enregistrer une Dépense, compenser un Chèque Post-Daté, exécuter l'amortissement des Immobilisations — enregistre désormais aussi automatiquement une véritable écriture de journal équilibrée en partie double, en coulisses. Vous n'avez rien à faire différemment au quotidien ; c'est ce qui fait que le Trial Balance, le Chart of Accounts et les soldes des comptes bancaires concordent réellement entre eux, au lieu d'être des chiffres suivis séparément qui pourraient silencieusement diverger.

Annuler, invalider (void) ou inverser l'une de ces mêmes actions enregistre une véritable écriture de contrepassation reflétée, pas seulement une suppression — le grand livre montre donc toujours ce qui s'est réellement passé, corrections comprises, sans réécrire l'histoire.

## Chart of Accounts

Ouvrez **Chart of Accounts** depuis la barre latérale pour voir les comptes à partir desquels vos livres sont construits — Cash & Bank, Accounts Receivable, Inventory, Fixed Assets, Accounts Payable, Tax Payable, Owner's Capital, Sales Revenue, Cost of Goods Sold, Operating Expenses, et quelques autres — déjà configurés pour vous dès la première utilisation de quoi que ce soit dans cette phase. Chacun a un type (Asset, Liability, Equity, Income ou Expense), qui détermine de quel côté du grand livre il se trouve normalement.

Cliquez sur **New Account** pour ajouter le vôtre — utile si vous voulez une catégorie de dépense ou de revenu plus spécifique que les valeurs par défaut (par exemple diviser « Operating Expenses » en « Rent » et « Utilities » pour votre propre suivi). Vos propres comptes se comportent exactement comme les comptes intégrés partout ailleurs dans le grand livre.

## Enregistrer une écriture de journal manuelle

La plupart des écritures s'enregistrent automatiquement comme décrit ci-dessus, mais parfois vous devez enregistrer quelque chose à la main — corriger une dépense mal classée, enregistrer un ajustement sans espèces, ou toute écriture qui ne correspond à aucun des types de transaction propres de Sarang. Ouvrez **Journal Entries** et cliquez sur **New Entry**.

Ajoutez deux lignes ou plus, chacune sur un compte, en débit ou en crédit — jamais les deux sur la même ligne. Sarang totalise les deux colonnes au fur et à mesure que vous tapez et refuse d'enregistrer tant qu'elles ne correspondent pas exactement — une écriture qui n'est pas équilibrée est rejetée d'emblée, la même discipline que toute autre écriture financière dans Sarang applique déjà.

Les écritures déjà enregistrées peuvent être inversées (avec un motif obligatoire) si l'une a été saisie par erreur — cela enregistre une véritable écriture reflétée plutôt que de supprimer l'originale, afin que la correction elle-même fasse partie de l'enregistrement permanent.

## Verrouillage des transactions (Transaction Locking)

Ouvrez **Ledger Settings** pour définir une **Lock Date** — une fois définie, aucune transaction financière datée (une Facture, Facture Fournisseur, Paiement, Paiement Fournisseur, Dépense, Écriture de Journal, ou Bon de Commande) à cette date ou avant ne peut être créée, modifiée ou annulée nulle part dans l'application. C'est ce qui garde fermée une période comptable close — une fois que vous et votre comptable avez convenu qu'un mois ou une année est définitif, la date de verrouillage empêche quiconque (vous y compris) de la modifier silencieusement par la suite.

## Intérêts sur les clients en retard

Si vous facturez des intérêts sur les soldes clients en retard, activez **Credit Interest** dans Settings avec un taux et un type Simple ou Composé. Ensuite, depuis la fiche propre d'un client, vous pouvez voir les intérêts réellement accumulés sur ses factures en retard — calculés par facture depuis la date à laquelle elle est réellement devenue en retard, pas une estimation forfaitaire sur tout le solde — et les enregistrer comme une charge réelle sur son compte lorsque vous êtes prêt à facturer.

## Reverse Charge, Composition Scheme et TDS

- **Reverse Charge (RCM)** — marquez une Facture Fournisseur ou une Dépense comme reverse-charge lorsque le fournisseur ne vous a pas facturé de GST et que vous l'auto-évaluez à la place. Sarang garde ce que vous devez réellement au fournisseur séparé de la taxe due au gouvernement, et affiche le total de la taxe reverse-charge dans le rapport d'aperçu GSTR-3B.
- **Composition Scheme** — si votre entreprise est enregistrée sous le Composition Scheme (à définir dans Settings), chaque Facture que vous créez ne comporte automatiquement aucune GST, et s'imprime comme un **Bill of Supply** plutôt qu'une facture fiscale — conforme à ce que la loi exige, sans que vous ayez à vous souvenir de mettre la taxe à zéro manuellement à chaque vente.
- **TDS sur les paiements fournisseurs** — lors de l'enregistrement d'un paiement à un fournisseur, cochez **Deduct TDS** et Sarang suggère un montant basé sur votre seuil et taux configurés, toujours à vérifier et ajuster avant de confirmer. Le montant retenu est suivi comme son propre passif, distinct de ce qui a été réellement payé.

## Trial Balance

Le rapport **Trial Balance** (sous Reports) lit directement le vrai grand livre décrit ci-dessus — le solde courant de chaque compte à la date que vous choisissez, débits et crédits totalisant toujours le même montant, puisque chaque écriture qui y a jamais été enregistrée devait elle-même être équilibrée.
