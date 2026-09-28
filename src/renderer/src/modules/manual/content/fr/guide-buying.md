# Guide : Acheter auprès des fournisseurs, de la commande au paiement

Le cycle d'achat complet, avec l'effet de chaque étape sur votre stock et votre argent. Lisez d'abord le tableau : il évite la confusion la plus courante.

```
Bon de commande  ->  Réception / GRN  ->  Facture fournisseur  ->  Paiement fournisseur  ->  (Note de débit)
 ce que vous avez commandé  la marchandise arrive  ce que vous devez  ce que vous avez payé  marchandise renvoyée
 ni stock, ni argent   LE STOCK monte      LE DÛ monte             le dû baisse
```

| Étape | Change votre stock ? | Change ce que vous devez ? |
|---|---|---|
| Bon de commande | Non | Non |
| Réception (sur le BC) ou GRN lié | **Oui** | Oui (à la réception) |
| Facture fournisseur | **Non** | **Oui** |
| Paiement fournisseur | Non | Oui (baisse) |
| Note de débit | Seulement si la marchandise est renvoyée | Oui (baisse) |

**Une Facture fournisseur ne change jamais le stock.** Elle enregistre seulement l'argent. Le stock n'augmente qu'à la réception de la marchandise.

## 1. Ajouter le fournisseur (une fois)

**Achats → Fournisseurs → Add Supplier.** Saisissez le nom, le téléphone, l'adresse, le GSTIN et le PAN si vous les avez, les coordonnées bancaires pour le payer et un **solde d'ouverture** si vous lui devez déjà de l'argent.

Sarang vous empêche de créer deux fois le même fournisseur. Il n'enregistre pas un fournisseur si l'un de ces éléments existe déjà (actif ou archivé) :

- le même **numéro de téléphone**,
- le même **GSTIN**,
- le même **e-mail**,
- le même **nom dans la même ville** (si vous laissez la ville vide, tout nom identique compte).

Si la correspondance est un fournisseur archivé, Sarang vous demande de le restaurer au lieu d'en créer un autre. Le format du GSTIN, du PAN et de l'IFSC est vérifié (par exemple un GSTIN compte 15 caractères comme *29ABCDE1234F1Z5*) et ils sont enregistrés en majuscules. Si deux vrais fournisseurs portent le même nom, ajoutez la ville de chacun pour les distinguer. **Find duplicates** dans l'écran Fournisseurs liste les fiches qui semblent être le même fournisseur et permet de les **fusionner** (une fusion transfère toutes les factures et tous les paiements vers la fiche conservée et ne peut pas être annulée).

Utile aussi sur la fiche fournisseur : une **personne de contact**, une **catégorie** et une **note** pour votre usage, des **conditions de paiement** en jours (une nouvelle facture reçoit alors sa date d'échéance automatiquement) et une **limite de crédit** (un rappel de ce que vous acceptez de devoir ; elle s'affiche, elle ne bloque pas une facture). Un **solde d'ouverture** peut être négatif si vous avez payé le fournisseur d'avance. Comme un client, un fournisseur peut avoir **d'autres adresses** sur sa page.

## 2. Vérifier que le produit existe

Chaque article acheté pour la revente doit d'abord être un **Produit** (**Stock → Produits**), avec son **prix de revient** et son **taux de taxe**. S'il s'agit d'un nouvel article, créez-le maintenant. Vous pouvez aussi le créer depuis l'écran de marchandise reçue (étape 4). La taxe d'un achat ne fait jamais partie du coût de votre stock : le coût du stock est toujours le prix hors taxe.

Vous achetez autre chose que du stock de revente (loyer, réparations, honoraires, matériel) ? Ignorez les produits : saisissez-le comme ligne de **Service** sur une Facture fournisseur ou comme **Dépense**.

## 3. Commander : Bon de commande (facultatif mais recommandé)

**Achats → Bons de commande → New PO.** Choisissez le fournisseur (ou **+ Add New Supplier**), ajoutez les articles avec quantité et coût, et une date prévue. Quand vous choisissez un produit, son prix de revient **et son taux de taxe** se remplissent seuls ; vous pouvez modifier l'un ou l'autre.

Le BC passe de **Draft → Approved → Received**. Si une règle d'approbation existe, il va d'abord à un approbateur. Vous pouvez imprimer le BC ou l'envoyer au fournisseur par WhatsApp ou Email. Stock bas ? Dans l'écran **Stock**, **Generate Reorder POs** crée des bons de commande brouillons pour tout ce qui est sous son seuil de réapprovisionnement, avec le fournisseur par défaut de chaque produit.

## 4. La marchandise arrive : la réceptionner

Deux façons. Utilisez celle qui correspond à votre activité.

**A. Receive Stock sur le Bon de commande** (le plus simple). Ouvrez le BC approuvé et cliquez sur **Receive Stock**. Le stock monte, le coût moyen est mis à jour et vos livres enregistrent l'achat.

**B. GRN (Goods Received Note, bon de réception)** (quand une livraison arrive en plusieurs parties, ou que vous voulez noter une quantité abîmée ou refusée). **Achats → GRN → New GRN** : choisissez le fournisseur, liez éventuellement le BC, et saisissez chaque article avec les quantités reçues et refusées et le coût.

**Important sur un GRN : liez chaque ligne à un produit.** Chaque ligne a une liste déroulante de produits.

- Choisi dans la liste : la ligne s'ajoute au stock de ce produit quand le GRN est **Posted**.
- Laissé sur **Not in catalog** : la ligne n'est qu'une trace papier. Elle affiche une petite étiquette *unlinked* et ne modifie **pas** le Stock ni les Produits.
- L'article n'est pas encore dans votre liste ? Tapez son nom et cliquez sur **+ Create product "…" and link**. Sarang crée le produit à votre prix de revient et lie la ligne. Définissez son vrai **prix de vente** dans Produits avant de le vendre.
- Quand vous cliquez sur **Post** sur un GRN contenant des lignes non liées, Sarang vous avertit du nombre de lignes qui ne mettront pas le stock à jour. Annulez et liez-les, ou validez quand même.
- Un GRN validé ne peut pas être modifié. Si une ligne a été validée non liée par erreur, faites **Reverse** sur le GRN et resaisissez-le avec le produit lié.

Un GRN est enregistré en Draft, puis Verified, puis **Posted** (le stock ne change qu'à Posted).

**Une ligne a été validée non liée et vous ne pouvez pas annuler le GRN ?** Sur le GRN validé, une ligne non liée a **Link to an item**. Choisissez le produit et sa quantité est ajoutée au stock. Cela ne lie que la réception ; cela ne change ni la quantité reçue du bon de commande ni les données de lot, vérifiez-les vous-même.

**Lequel utiliser ?** Les écrans Bon de commande et GRN affichent une courte aide qui indique de quelle façon vous réceptionnez. Utilisez une seule façon par livraison, jamais les deux : réceptionner sur le BC puis valider un GRN pour la même marchandise ajoute le stock deux fois.

## 5. Enregistrer ce que le fournisseur a facturé : Facture fournisseur

**Achats → Factures fournisseurs → Record Bill.**

1. Choisissez le fournisseur (ou ajoutez-en un).
2. Définissez la **date de facture** et la **date d'échéance**. L'échéance alimente la liste des retards. Si le fournisseur a des conditions de paiement, l'échéance se remplit seule. Saisissez le **numéro et la date de la facture du fournisseur** tels qu'imprimés sur sa facture papier : Sarang vous avertit quand le même numéro de facture fournisseur est saisi deux fois, et les entreprises soumises à la GST en ont besoin pour rapprocher les achats du portail de l'administration.
3. Ajoutez des lignes. Une ligne est un **Produit** (coût et taxe viennent du produit) ou un **Service** (texte libre, avec une catégorie, pour ce qui n'est pas du stock).
4. Saisissez la **remise** et le **taux de taxe** de chaque ligne pour que les totaux correspondent à la facture papier du fournisseur. Comparez le total avec le papier.
5. Cochez **Reverse Charge** seulement si votre comptable vous dit que la taxe de cet achat est payée par vous et non par le fournisseur.
6. Ajoutez éventuellement des **frais d'approche (landed costs)** (fret, droits, manutention) ; ils sont répartis sur les articles et augmentent leur coût réel.
7. **Enregistrer.** La facture reçoit un numéro (par exemple BILL-00012) et le statut **Open**. Ce que vous devez à ce fournisseur augmente. Pour une entreprise GST, la taxe de la facture est enregistrée comme **crédit de taxe en amont** (sauf si vous êtes au régime Composition), et une note de débit la réduit à nouveau.

**Une erreur ?** Tant que la facture est **Open** et sans **aucun paiement** enregistré, ouvrez-la et cliquez sur **Edit bill**. Modifiez ce qu'il faut et enregistrez. Sarang remplace la facture sous le même numéro, annule les anciennes écritures et passe les corrigées en une seule opération, et conserve l'ancienne copie sous le nom *BILL-00012-R1 (Void)* pour que l'historique soit complet. Si un paiement est enregistré, annulez d'abord le paiement. Pour annuler entièrement une facture, utilisez **Void** (motif obligatoire).

**Statuts de facture :** Open, Partially Paid, Paid, Void. La liste a aussi un filtre **Overdue** et un badge **OVERDUE** sur toute facture ouverte ou partiellement payée dont l'échéance est dépassée.

## 6. Payer le fournisseur : Paiement fournisseur

Ouvrez la facture et cliquez sur **Record Payment** : montant (partiel ou total), mode (Cash, UPI, Card, Bank Transfer, Cheque), référence. La facture passe à **Partially Paid** ou **Paid** et votre solde à payer diminue. **Achats → Paiements fournisseurs** liste tous les paiements effectués et permet d'annuler un paiement erroné. Vous payez plusieurs factures d'un même fournisseur d'un coup ? Utilisez l'option de paiement groupé.

Si vous retenez du **TDS** en payant un professionnel ou un sous-traitant, Sarang suggère un montant pour la section choisie. Considérez-le seulement comme une suggestion : confirmez la section et le taux avec votre comptable, car les règles ont changé en 2026. **Reports → TDS Deducted** liste ce que vous avez retenu, par section, et ce qui reste à verser. Dans le formulaire de paiement, **Ctrl + Entrée** enregistre.

## 7. Renvoyer la marchandise ou corriger une facture : Note de débit

**Achats → Notes de débit → New.** Liez-la au fournisseur (et au BC ou à la facture). Elle réduit ce que vous devez. Cochez **Itemize** pour lister les articles renvoyés avec leur taxe. Une note de débit est votre retour d'achat : c'est le jumeau côté fournisseur d'un Retour de vente et d'une Note de crédit.

## 8. Voir où vous en êtes

- **Achats → Vue d'ensemble des achats** : ce que vous devez, ce qui est dû dans les 7 prochains jours, les factures ouvertes et la liste des factures à payer cette semaine.
- **Fournisseurs** : la page de chaque fournisseur affiche le solde à payer, chaque facture et chaque paiement ; le bouton **Statement** ouvre son compte à imprimer ou envoyer.
- **Reports → Purchase Register, Purchases by Vendor, Purchases by Item, AP Aging Summary** : ce que vous avez acheté et ce que vous devez, selon le retard.
- **Reports → Payables / Supplier Ledger** : le compte complet d'un fournisseur.
- **Reports → Purchase GST Register, Purchase HSN Summary, GST Net Payable & Input Credit** (entreprises GST) : achats avec leur taxe, achats par code HSN, et la taxe récupérable face à la taxe facturée. Voir *Guide: Tax and GST*.
- Ask Sarang : « À qui dois-je de l'argent ? », « Quelles factures fournisseurs sont en retard ? », « Factures à payer cette semaine ».

## Un exemple concret

Vous achetez 50 ampoules LED à 40 roupies, plus 18 pour cent de taxe, avec 30 jours de crédit, et vous payez en deux fois.

1. **Produits** : créez *LED Bulb 9W*, coût 40, taxe 18.
2. **Bon de commande** : fournisseur *Amba Agencies*, 50 unités. Approuvez.
3. **Receive Stock** : 50 ampoules arrivent ; le Stock affiche maintenant 50.
4. **Facture fournisseur** : date d'aujourd'hui, échéance à 30 jours ; la ligne se remplit en 50 x 40 avec 18 pour cent de taxe ; total 2,360. Statut Open, vous devez 2,360.
5. **Paiement fournisseur** : 1,000 par UPI (Partially Paid, il reste 1,360), puis 1,360 par virement bancaire (Paid).
6. Dix ampoules sont défectueuses : **Note de débit** pour 10 x 40 plus taxe, et vous les renvoyez.
