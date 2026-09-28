# Guide : vendre, du devis à l'encaissement

Tout ce que vous faites quand un client achète, dans l'ordre où cela se passe. Sautez les étapes inutiles : une boutique qui facture au comptoir n'a besoin que de l'étape 4.

```
Devis  ->  Commande client  ->  Facture (Facturation)  ->  Paiement  ->  (Retour / Avoir)
optionnel    optionnel           toujours                   à l'encaissement   seulement si quelque chose revient
```

## 1. Ajouter le client (une fois)

**Sales → Clients → Add Customer.** Saisissez le nom et le téléphone. Ajoutez l'adresse, l'e-mail et le numéro fiscal (GSTIN) si vous facturez des entreprises. Choisissez **Individual** ou **Business** ; une entreprise demande aussi un numéro d'immatriculation et une personne à contacter.

- **Cherchez avant d'ajouter.** Saisissez d'abord le numéro de téléphone. Sarang bloque un second client avec le même numéro, pour qu'une personne ne devienne jamais deux fiches. Il vérifie aussi le GSTIN et l'e-mail, et le bouton **Find duplicates** de l'écran Clients liste les fiches qui semblent être la même personne pour que vous puissiez les **fusionner**. Une fusion déplace toutes les factures et tous les paiements vers la fiche que vous gardez et ne peut pas être annulée.
- **Plafond de crédit** : fixez-le pour les clients qui achètent à crédit. Sarang ne laissera pas une vente leur faire dépasser le plafond.
- **Conditions de paiement** : saisissez le nombre de jours que ce client met d'ordinaire à payer (par exemple 30). Chaque nouvelle facture pour lui reçoit alors automatiquement sa date d'échéance.
- **Autres adresses** : sur la page du client, **Other addresses** garde une adresse de livraison, d'entrepôt ou de succursale à côté de l'adresse principale.
- **Exonéré de taxe** : cochez-le pour un client à qui la taxe ne doit pas être facturée. Vous pouvez noter le numéro du certificat d'exonération et sa date de validité. Après cette date, Sarang refacture la taxe, et le formulaire du client vous signale que le certificat a expiré.
- **Ne pas envoyer de messages à ce client** : cochez-le s'il a demandé à ne plus recevoir de rappels ni d'offres. Les rappels en attente qui le concernent sont supprimés et aucun nouveau n'est proposé à l'envoi.
- **Relevé** : le bouton **Statement** sur la page du client ouvre son compte (chaque facture, paiement et avoir avec un solde courant), prêt à imprimer ou à envoyer.
- **Archivez, ne supprimez pas**, un client que vous ne servez plus. Son historique reste.

Vous pouvez aussi ajouter un client à la volée en facturant (**+ Add Customer**, nom et téléphone seulement).

## 2. Donner un prix : Devis (optionnel)

**Sales → Devis → New Quotation.** Choisissez le client (ou tapez un nom), ajoutez des articles et fixez **Valid until** (le dernier jour où le prix tient). Enregistrez-le en Brouillon, imprimez-le ou partagez-le sur WhatsApp, et marquez-le **Sent**.

- Quand le client accepte, ouvrez-le et cliquez sur **Convert to Invoice** (ou **Convert to Sales Order** pour un client engagé mais pas encore facturé). Le devis passe à **Accepted**.
- **Les devis expirent tout seuls.** Le lendemain de *Valid until*, un devis Brouillon ou Envoyé passe à **Expired**. Un devis expiré ne peut pas être converti. Si vous décidez de l'honorer, remettez son statut sur **Sent** ; Sarang efface l'ancienne expiration pour qu'il ne périme pas de nouveau la même heure. Utilisez le filtre **Expired** pour voir qui n'a pas répondu.
- **Facture proforma** : choisissez *Proforma invoice* comme type de document quand vous devez demander un paiement d'avance. Elle est numérotée PF-, s'imprime « PROFORMA INVOICE, Not a tax invoice » et se convertit en vraie facture comme un devis.
- La taxe de chaque ligne vient du produit ; vous pouvez la modifier sur la ligne.

## 3. Confirmer une commande : Commande client (optionnel)

**Sales → Commandes clients → New Sales Order.** Utilisez-la quand le client a dit oui mais que vous ne pouvez pas encore facturer (marchandises pas prêtes, attente d'un acompte).

1. **New Sales Order** : client, date prévue, articles. Chaque article reprend le prix et le taux de taxe du produit.
2. **Confirm Order** pour la verrouiller. (Si une règle d'approbation existe, elle attend d'abord l'approbation.)
3. **Create Invoice** quand vous êtes prêt. Vous pouvez facturer une partie maintenant et le reste plus tard ; la commande suit ce qui est facturé (*Partially Invoiced* puis *Invoiced*).

Une Commande client ouverte **promet** du stock : **Stock** et le rapport Stock Summary montrent ce qui est promis sur commandes, et Sarang vous avertit quand vous confirmez une commande supérieure à ce que vous avez de libre. Ce n'est qu'un avertissement : rien ne vous empêche de vendre du stock promis, vérifiez donc avant de promettre les dernières unités. La commande ne touche pas vos comptes tant que vous n'avez pas facturé.

## 4. Vendre : l'écran Facturation (le travail principal)

**Sales → Facturation.** C'est l'écran de vente.

1. **Ajoutez des articles.** Cherchez par nom, SKU ou code-barres, ou touchez une vignette de produit. Les produits souvent vendus s'affichent en vignettes au-dessus de la zone de recherche. Utilisez **Browse Products** pour parcourir les catégories sans taper.
2. **Réglez la quantité et la remise** sur chaque ligne. Le petit bouton à côté de la remise bascule entre **pourcentage**, **montant** et **prix négocié/final** (tapez le prix convenu et Sarang calcule la remise).
3. **Choisissez le client** (ou laissez vide pour un client de passage).
4. **Choisissez comment il paie** : Espèces, UPI, Carte, Portefeuille, **Crédit (payer plus tard)** (nécessite un client ; la facture reste impayée et s'ajoute à ce qu'il doit) ou **Fractionné** (par exemple une partie en espèces, une partie en UPI).
5. **Taxe.** La taxe vient de chaque produit. Si vous êtes en GST, **Tax shown as** choisit CGST + SGST, IGST ou une seule ligne GST ; Sarang choisit d'après les deux États et vous pouvez modifier. Le montant de la taxe est le même quelle que soit la présentation. Voir *Guide: Tax and GST*.
6. **Suppléments sur la facture.**
   - **Add Charge** ajoute une ligne pour un pourboire, une livraison, un emballage, une manutention, une installation ou un autre frais. Indiquez le montant et, sauf pour un pourboire, le taux de taxe qui s'applique.
   - **Give free** (sous le nom d'une ligne) transforme toute la ligne en échantillon ou cadeau : le stock sort quand même, le prix et la taxe passent à zéro, et la facture l'indique comme gratuit.
   - **Export sale?** apparaît quand le client est dans un autre pays. Cochez-la pour ne facturer aucune taxe sur cette vente (une exportation à taux zéro). Sarang ne le fait jamais seul, et les notes de la facture disent « Export supply, zero-rated ». Vérifiez les règles d'exportation de votre pays et gardez votre preuve d'exportation.
7. Vérifiez les totaux. Le total est arrondi selon la règle choisie dans **Paramètres → Currency & Locale → Invoice rounding** (aucun, 0,05, 0,10, 0,50 ou 1 le plus proche). L'arrondi apparaît sur sa propre ligne.
8. **Confirm Sale** (ou appuyez sur **F10** ou **Ctrl + Entrée**). La facture s'ouvre.

**Deux clients à la fois ?** **Hold Sale** met le panier de côté ; **Resume Sale** le rétablit.

**Mauvais prix ou article ?** Corrigez avant de confirmer. Après confirmation, une facture ne peut pas être modifiée ; annulez-la (avec un motif) et refaites-en une, ou utilisez un Avoir pour une correction partielle.

**Vous envoyez des marchandises à un client en Inde ?** Pour une vente GST de 50 000 ou plus, Sarang vous rappelle l'e-way bill et vous laisse garder son numéro sur la facture. Les autres détails du bon de livraison (transporteur, numéro LR) sont dans **Create Delivery Note**.

## 5. Donner au client sa copie

Sur l'écran de la facture :

- **Print** (A4) ou **Print Receipt** (rouleau thermique).
- **Share on WhatsApp** ou **Email** : Sarang ouvre WhatsApp ou votre messagerie avec le message prêt. Joignez le PDF enregistré et appuyez vous-même sur Envoyer. Rien n'est envoyé sans vous.
- **Create Delivery Note** si vous expédiez des marchandises.

## 6. Encaisser l'argent

- **Payé au comptoir** : vous avez choisi le mode à l'étape 4 ; la facture est déjà Payée.
- **Payé plus tard** : ouvrez la facture (**Facturation → liste des factures**) et cliquez sur **Record Payment**. Saisissez le montant (partiel ou total), le mode et une référence. Un paiement partiel laisse la facture en **Partial**.
- **Le client a payé moins car il a retenu de l'impôt sur le revenu (TDS) ?** Dans la fenêtre de paiement, choisissez **TDS deducted** et saisissez l'impôt retenu. Cela règle cette part de la facture sans qu'aucun argent n'arrive, et Sarang l'enregistre comme un impôt dont vous aurez le crédit. Le rapport **TDS Receivable** le liste pour que vous le rapprochiez de leurs certificats.
- **Paiement saisi par erreur** : **Reverse** avec un motif. Il reste à l'écran, barré, pour mémoire.
- **Voir tous les paiements reçus** : **Payment History** (depuis les écrans Facturation), avec recherche par facture, client ou référence.
- **Qui me doit ?** **Clients** affiche chaque solde ; **Rapports → Outstanding** classe les dettes par ancienneté (courant, 1 à 30 jours, 31 à 60, etc.). Ask Sarang peut aussi répondre à « Qui me doit de l'argent ? ».

## 7. Quand des marchandises reviennent ou qu'un prix était faux

- **Vente retournée en totalité ou en partie** : **Sales → Sales Returns** (activez-le dans **Paramètres → Additional Business Features** si vous ne le voyez pas). Le stock retourne sur l'étagère et le solde du client ou le remboursement est ajusté.
- **Argent à rendre sans retour de stock** (surfacturation, geste commercial) : **Sales → Avoirs → New**, lié au client et à la facture. Il réduit ce que le client vous doit. Chaque avoir a **Add tax to this note** : laissez-le activé pour rendre aussi la taxe, ou désactivez-le pour un montant simple.
- **Facture faite par erreur** : ouvrez-la et **Cancel Invoice** (motif obligatoire).

## 8. Clients fidèles et mauvais payeurs

- **Profils Récurrents** (groupe Accounting) créent la même facture selon un calendrier, pour loyers, abonnements et forfaits.
- **Listes de Prix** donnent à un groupe de clients ses propres prix ; **Barèmes de Prix** gèrent des offres (2 achetés, 1 offert, 10 % sur une catégorie). Sarang affiche l'offre dans le panier ; vous décidez de l'appliquer ou non.
- **Intérêts de retard** : activez-les dans **Paramètres → Business Features → Interest on overdue balances** et fixez un taux annuel (simple ou composé mensuel). Rien n'est facturé tout seul : sur la page d'un client vous voyez l'intérêt acquis par chaque facture en retard et vous appuyez sur le bouton pour le facturer.

## 9. Vue d'ensemble des ventes et rapports

**Sales → Sales Overview** affiche les ventes et factures du jour, ce que les clients vous doivent et la part en retard, les devis ouverts et des raccourcis vers chaque écran de vente. **Rapports** propose les ventes par client, article, catégorie et vendeur (choisissez le vendeur au comptoir), le profit par article et client, un registre des ventes, les créances et plus, chacun avec un graphique.

## Questions fréquentes

**Puis-je vendre sans stock ?** Sarang bloque la vente d'un produit stocké quand il n'y en a pas assez dans Stock (« Insufficient stock »). Réceptionnez d'abord l'achat, ou ajustez le stock avec un motif. Si vous devez parfois vendre avant que les marchandises soient enregistrées, demandez à votre comptable, puis activez le stock négatif dans **Paramètres → Business Features → Stock rules**.

**Où voir les ventes du jour ?** Le **Tableau de bord**, ou **Rapports → Sales**.

**Pourquoi la taxe apparaît-elle en plus du prix ?** Par défaut, Sarang considère chaque prix comme *hors taxe* et ajoute la taxe. Si vos prix incluent déjà la taxe, activez **Prices include tax** (Paramètres, ou l'interrupteur sur le document). Voir *Guide: Tax and GST*.

**Pourquoi n'y a-t-il pas de taxe sur cette facture ?** L'article n'a pas de taux de taxe, le client est marqué exonéré, la vente a été cochée comme exportation, ou votre entreprise est sous le régime de la Composition.
