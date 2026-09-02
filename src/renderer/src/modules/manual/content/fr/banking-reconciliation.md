# Banque et Rapprochement

## Comptes bancaires et de caisse

Ouvrez **Bank Accounts** depuis la barre latérale et cliquez sur **New Account** pour ajouter un compte nommé — un vrai compte bancaire (avec nom de la banque, numéro de compte masqué et IFSC) ou une caisse/tiroir-caisse, choisi via le champ **Account Type**. Cela remplace un seul fonds « espèces » indifférencié par autant de comptes réels et distincts que votre entreprise en a réellement — un compte courant principal, un tiroir de petite caisse, la caisse d'une deuxième succursale — chacun suivi séparément.

Si le compte contient déjà de l'argent réel le jour où vous l'ajoutez, saisissez-le comme **Opening Balance**. Sarang enregistre une écriture d'équilibrage unique (Débit du compte, Crédit à Owner's Capital) afin que le solde du compte — et vos livres — soient corrects dès le premier jour, sans partir silencieusement de zéro.

Le **Current Balance** d'un compte bancaire reflète toujours le solde réel et courant issu de chaque transaction qui y a été enregistrée — les paiements de factures qui y sont crédités, les factures fournisseurs payées à partir de lui, les chèques compensés via lui, etc. — ce n'est jamais un chiffre modifié directement.

## Importer et rapprocher un relevé bancaire

Ouvrez un compte bancaire et allez dans **Reconciliation**. Cliquez sur **Import Statement** pour importer les lignes du relevé de votre banque — date, description, montant débit ou crédit — les mêmes lignes que votre relevé bancaire (PDF ou CSV) affiche déjà, saisies une seule fois, plutôt que comparées à l'œil à chaque transaction dans Sarang.

Une fois importé, cliquez sur **Auto-Match** — Sarang recherche une transaction Sarang (un Payment, une Expense, un Supplier Payment, ou une ligne de Journal Entry liée à la banque) ayant le même montant et une date proche à quelques jours près de la ligne du relevé. Lorsqu'exactement une telle transaction existe, elle est rapprochée automatiquement. Lorsque plusieurs pourraient correspondre, ou aucune, la ligne est délibérément laissée pour votre révision — une supposition qui pourrait être fausse est pire qu'un honnête « nécessite une vérification ».

Pour ce qu'Auto-Match ne résout pas, ouvrez la ligne et rapprochez-la manuellement avec la transaction à laquelle elle correspond réellement, ou laissez-la non rapprochée si elle ne correspond vraiment à rien dans Sarang pour l'instant (des frais bancaires, un crédit d'intérêts). Les lignes déjà rapprochées peuvent toujours être annulées avec **Unreconcile** si elles ont été associées à la mauvaise ligne.

Le **Reconciliation Summary** en haut de l'écran affiche le solde de votre livre à côté du mouvement net propre du relevé, ainsi que le nombre de lignes rapprochées et celles encore en attente — la même vérification « mon livre correspond-il à la banque ? » qu'un comptable ferait à la main, faite pour vous.

## Joindre le fichier de relevé réel

Le fichier de relevé original — le PDF ou CSV envoyé par votre banque — peut être joint directement au compte via le panneau **Documents** sur l'écran Reconciliation, afin que le document source reste avec les lignes analysées aussi longtemps que nécessaire — le même comportement joindre/ouvrir/supprimer que tout autre document dans Sarang.

## Chèques post-datés

Ouvrez **Post-Dated Cheques** depuis la barre latérale pour suivre un registre de chèques — numéro de chèque, compte bancaire lié, date d'échéance, montant et direction (Received d'un client, ou Issued à un fournisseur). Un chèque que vous enregistrez commence en **Pending** et ne touche pas encore vos livres — exactement comme fonctionne un vrai chèque post-daté : c'est encore une promesse, pas une transaction.

Lorsque la date du chèque arrive et qu'il est réellement compensé à la banque, marquez-le **Cleared** — c'est seulement à ce moment-là que Sarang enregistre le paiement réel (Débit ou Crédit de Cash, contre le solde client ou fournisseur qu'il règle). S'il revient impayé, marquez-le **Bounced** ; s'il est annulé avant l'un ou l'autre résultat, marquez-le **Cancelled**. Les deux ne sont que de simples changements de statut, sans aucune écriture financière, puisqu'aucun des deux n'est jamais devenu de l'argent réel.

## Bordereaux de Dépôt Bancaire

Ouvrez **Bank Deposits** pour enregistrer un vrai passage à la banque — espèces et chèques remis au guichet. Choisissez le compte de destination et la date, puis indiquez combien de billets de chaque coupure (de 500 ₹ à 1 ₹) vous apportez réellement ; Sarang totalise les espèces au fur et à mesure que vous saisissez. Si le compte a des chèques **Received** en attente de dépôt, cochez ceux qui partent avec ce même passage — leur total s'ajoute au bordereau, et chacun passe de Pending à Deposited.

Seule la partie en espèces est traitée comme de l'argent réel dès l'enregistrement du bordereau — elle s'ajoute directement au solde du compte de destination, comme le ferait une vente en espèces. Les chèques que vous avez inclus ne sont pas encore comptés comme de l'argent — chacun n'affecte vos comptes que lorsque vous le marquez séparément **Cleared** sur l'écran Post-Dated Cheques (un chèque déposé peut encore être rejeté), donc rien n'est jamais compté deux fois. Cliquez sur n'importe quel dépôt passé de la liste pour revoir son détail complet de coupures et de chèques.

## Carnets de Chèques

Si vous émettez des chèques à des fournisseurs, cliquez sur **Cheque Books** sur l'écran Post-Dated Cheques pour enregistrer un carnet de chèques physique pour un compte bancaire — juste son numéro de chèque de début et de fin. Lorsque vous enregistrez ensuite un chèque **Issued** sur ce compte, une case **Use next cheque book number (#...)** apparaît ; la cocher renseigne automatiquement le prochain numéro séquentiel de ce carnet au lieu de le saisir à la main, et le compteur « suivant » propre au carnet avance pour que le même numéro ne soit jamais suggéré deux fois. Un carnet entièrement utilisé s'affiche comme **Exhausted** ; désactivez un carnet que vous n'utilisez plus pour qu'il ne soit plus proposé.
