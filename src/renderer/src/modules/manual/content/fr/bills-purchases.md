# Factures et Paiements Effectués

## Qu'est-ce qu'une Facture, et en quoi diffère-t-elle d'un Bon de Commande

Un **Bon de Commande** est ce que vous avez *commandé* à un fournisseur. Une **Facture** est ce qu'il vous a réellement *facturé* — les deux documents sont liés mais ne sont pas identiques. Vous pouvez enregistrer une facture sans jamais avoir émis de bon de commande (le cas courant de la facture d'un sous-traitant, d'une facture de loyer, ou de tout achat ponctuel), ou vous pouvez lier une facture à un bon de commande existant à titre de référence.

Chaque facture augmente ce que vous devez à ce fournisseur. Le statut d'une facture évolue de **Ouverte → Partiellement Payée → Payée** au fur et à mesure que vous enregistrez des paiements contre elle, ou elle peut être **Annulée** si elle a été saisie par erreur (uniquement tant qu'aucun paiement n'y est encore enregistré — annulez d'abord les paiements).

## Enregistrer une Facture

Ouvrez **Factures** dans la barre latérale et cliquez sur **Enregistrer une Facture**. Choisissez le fournisseur (ou ajoutez-en un nouveau sans quitter l'écran — le même raccourci **+ Ajouter un Nouveau Fournisseur** est aussi disponible sur le formulaire du Bon de Commande), puis ajoutez une ou plusieurs lignes.

Chaque ligne est soit :

- **Produit** — un article réel de votre catalogue de produits, choisi dans une liste déroulante avec recherche. Son coût se remplit automatiquement à partir du coût propre du produit, et vous pouvez l'ajuster si cet achat particulier a été facturé à un prix différent.
- **Service** — texte libre (p. ex. « Contrat de maintenance — trimestriel », « Honoraires de conseil juridique »), éventuellement associé à une catégorie. C'est ce qui comble le manque de longue date où chaque achat professionnel non destiné à la revente — équipement de bureau, consommables, honoraires professionnels — n'avait aucune place structurée. Mélangez librement des lignes de produits et de services sur la même facture.

Chaque ligne comporte également son propre montant de remise et son propre taux de taxe, de sorte que les totaux de la facture sont calculés correctement ligne par ligne avant d'être additionnés — le même ordre remise-puis-taxe que suit déjà tout autre document dans Sarang.

## Enregistrer un Paiement contre une Facture

Ouvrez une facture et cliquez sur **Enregistrer un Paiement**. Les paiements aux fournisseurs acceptent les espèces, l'UPI, la carte, le virement bancaire ou le chèque — un ensemble plus large que les paiements destinés aux clients, car les paiements B2B se font régulièrement par virement bancaire ou par chèque. Un paiement peut être partiel ; le solde et le statut de la facture sont mis à jour immédiatement, et le montant est déduit de ce que vous devez à ce fournisseur.

Chaque paiement que vous avez effectué sur toutes les factures apparaît aussi à un seul endroit sous **Paiements Effectués** dans la barre latérale — consultable par numéro de facture, fournisseur ou numéro de référence, avec le même support d'annulation (avec motif obligatoire) que possèdent déjà les Paiements Reçus, au cas où l'un d'eux aurait été saisi par erreur.

## Rapports côté achats

Quatre rapports, tous sous **Rapports**, couvrent ce que vous avez acheté et ce que vous devez :

- **Registre des Achats** — chaque facture sur une période donnée, avec un graphique des dépenses par fournisseur et le détail complet ligne par ligne. C'est l'équivalent côté achats du Rapport des Ventes.
- **Achats par Fournisseur** — dépenses totales et nombre de factures, classés par fournisseur, pour savoir chez qui vous achetez réellement le plus.
- **Achats par Article** — dépenses totales et quantité achetée, classées par produit ou service, séparant les articles d'inventaire réels des lignes de service en texte libre.
- **Résumé de l'Ancienneté des Comptes Fournisseurs** — ce que vous devez actuellement à chaque fournisseur, réparti selon le degré de retard (Courant / 1-30 / 31-60 / 61-90 / 90+ jours), la même logique d'ancienneté déjà utilisée par le Rapport des Soldes en Attente côté fournisseurs, désormais dans sa propre vue dédiée.

## Une profondeur accrue dans la fiche fournisseur

La propre fiche d'un fournisseur (ouvrez-la depuis **Fournisseurs**) peut désormais aussi contenir un compte bancaire/code IFSC/nom de banque (pour effectuer des paiements) et un numéro PAN (pour les démarches de conformité), ainsi qu'un **Solde d'Ouverture** lorsque vous ajoutez pour la première fois un fournisseur qui a déjà des dettes réelles en cours — cela enregistre une écriture unique dans son grand livre afin que son solde soit correct dès le premier jour.

## Clients Particuliers vs. Professionnels

Une fiche client (ouvrez-la depuis **Clients**) commence désormais par un interrupteur **Particulier / Professionnel**. Professionnel active les champs de numéro d'immatriculation de l'entreprise et de personne de contact nommée ; Particulier active à la place un type et un numéro de pièce d'identité — ce qui correspond à ce qu'un distributeur ou un vendeur B2B doit réellement enregistrer sur la personne à qui il vend, contrairement à un client de détail occasionnel.

## Dépenses : Fournisseur, Kilométrage et Facturable au Client

Le formulaire **Dépenses** accepte désormais aussi un fournisseur facultatif (pour une dépense qui a un fournisseur réel mais ne nécessite pas de facture complète), une ventilation du kilométrage (distance × tarif par km, qui calcule le montant pour vous afin que les deux chiffres ne puissent jamais diverger), et un champ **Facturer ceci à un client** pour une dépense remboursable que vous prévoyez de refacturer — par exemple, un déplacement qu'un consultant refacture ensuite au client.
