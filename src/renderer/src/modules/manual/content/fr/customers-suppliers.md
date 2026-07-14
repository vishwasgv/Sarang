# Clients & Fournisseurs

## Ajouter des clients et des fournisseurs

Ouvrez **Clients** ou **Fournisseurs** depuis la barre latérale pour voir la liste complète. Cliquez sur **Ajouter un client** / **Ajouter un fournisseur** pour en créer un. Une fiche client conserve le nom, le téléphone, l'e-mail, l'adresse (ville/état/pays), le numéro fiscal, la limite de crédit et des notes ; une fiche fournisseur conserve l'équivalent côté professionnel (nom, téléphone, e-mail, adresse, numéro fiscal, notes).

L'un comme l'autre peuvent être **archivés** plutôt que supprimés, ce qui les masque des listes du quotidien (facturation, création de bon de commande, etc.) sans perdre leur historique de transactions.

## Grand livre et solde en cours

Cliquer sur un client ou un fournisseur ouvre son écran de détail, qui affiche les informations de contact ainsi que son compte courant :

- L'écran de détail d'un **client** affiche sa limite de crédit et son **solde en cours** — combien il vous doit actuellement — ainsi qu'un grand livre de transactions de chaque débit (une facture de vente à crédit) et crédit (un paiement ou un avoir) affectant ce solde, chacun avec un total cumulé.
- L'écran de détail d'un **fournisseur** affiche le **solde à payer** — combien vous lui devez actuellement — avec le même type de grand livre (un achat augmente ce que vous devez ; un paiement ou une note de débit le réduit). Si vous devez de l'argent à un fournisseur, un bouton **Enregistrer un paiement** vous permet d'enregistrer directement un paiement le concernant (Espèces, Virement bancaire, Chèque, UPI, Carte, ou Autre), avec un numéro de référence et des notes facultatifs.

Les deux grands livres affichent les 100 dernières entrées. Le solde affiché est toujours calculé à partir de l'historique complet des transactions, et non d'un nombre cumulé mis en cache, il ne peut donc jamais se désynchroniser de ce qui s'est réellement passé.

## Le modèle de recherche rapide par téléphone

Partout où Sarang a besoin que vous rattachiez un client à quelque chose — une nouvelle facture, un devis, un rendez-vous, un enregistrement à l'hôtel, etc. — il utilise le même champ de recherche **CustomerPicker** : commencez à taper un nom ou un numéro de téléphone, et toute correspondance existante apparaît dans une liste déroulante en quelques instants. Si le client n'existe pas encore, **+ Ajouter un nouveau client** déploie un formulaire en ligne pour un simple nom et un téléphone, et sélectionne immédiatement le client nouvellement créé sans quitter l'écran où vous étiez.

C'est volontaire : rechercher par numéro de téléphone avant de créer une nouvelle fiche est ce qui empêche la même personne de se retrouver comme plusieurs fiches Client en double dans différentes parties de l'application. Recherchez toujours d'abord — si un client a été créé depuis n'importe quel autre écran de Sarang, son numéro de téléphone le retrouvera ici aussi.

## Historique d'achat d'un fournisseur

L'implication d'un fournisseur dans vos achats apparaît à plusieurs endroits liés plutôt que sur un seul écran : les **Bons de commande** filtrés ou recherchés par nom de fournisseur, le grand livre propre au fournisseur (qui reflète chaque bon de commande reçu et chaque paiement effectué à son égard), et toute **note de débit** émise contre un bon de commande avec ce fournisseur. Ensemble, ces éléments vous donnent une image complète de ce que vous avez acheté à un fournisseur et de ce que vous lui devez actuellement.
