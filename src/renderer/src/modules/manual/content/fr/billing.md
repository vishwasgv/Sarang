# Facturation et documents

## Créer une facture

Ouvrez **Facturation** depuis la barre latérale (`/billing`) pour accéder à l'écran de point de vente. C'est ici que commence chaque facture :

1. **Recherchez des produits** dans la zone de gauche — par nom, SKU ou code-barres. Sélectionner un résultat (ou scanner un code-barres) l'ajoute au panier. Si le produit a des variantes (taille/couleur) ou des numéros de série suivis (IMEI), un sélecteur s'affiche pour que vous choisissiez l'exemplaire exact avant qu'il soit ajouté.
2. **Ajustez la quantité et la remise** sur chaque ligne du panier. La quantité s'incrémente par unités entières, ou par pas de 0,1 pour un article facturé au poids. La remise peut être saisie soit en montant, soit en pourcentage — le petit bouton à bascule à côté du champ de remise permet de passer de l'un à l'autre.
3. **Choisissez le client**, sur la droite. Tapez un nom ou un numéro de téléphone pour rechercher un client existant ; s'il est nouveau, cliquez sur **+ Add Customer** pour l'ajouter rapidement avec juste un nom et un téléphone, sans quitter la facture. Laisser le champ client vide facture un client de passage.
4. **Choisissez un mode de paiement** : Espèces, UPI, Carte, Wallet, Crédit (Payer plus tard), ou Partagé. **Crédit** exige qu'un client soit sélectionné — la facture est créée IMPAYÉE et le montant est ajouté au grand livre de ce client. **Partagé** vous permet de saisir des montants Espèces et UPI séparés qui doivent correspondre au total de la facture.
5. **Appliquez une remise globale** (en plus des remises par ligne) si nécessaire, à l'aide de la zone de remise dans le panneau récapitulatif.
6. Si votre modèle fiscal est la GST, cochez **Inter-State Sale (IGST)** lorsque la vente franchit une frontière d'État — cela remplace les lignes de taxe imprimées CGST+SGST par une seule ligne IGST.
7. Cliquez sur **Confirmer la Vente** (ou appuyez sur **F10** / **Ctrl+Entrée**) pour créer la facture. Vous êtes redirigé directement vers l'écran de détail de la nouvelle facture.

Le panier affiche un sous-total, une remise, une taxe, un ajustement d'arrondi et un total mis à jour au fur et à mesure. **Tout effacer** en bas réinitialise tout sans enregistrer.

Une grille de vignettes de vos produits **souvent vendus** apparaît au-dessus de la zone de recherche — un tap l'ajoute directement au panier, sans avoir besoin de taper quoi que ce soit, classée selon ce qui se vend réellement le plus.

Vous préférez cliquer plutôt que taper ? Cliquez sur l'icône de grille à côté de la zone de recherche pour passer en mode **Parcourir les Produits** — chaque produit actif s'affiche sous forme de vignette, organisé en puces de catégorie (Tous, plus une par catégorie) pour que vous puissiez accéder à ce dont vous avez besoin d'un simple tap, sans toucher le clavier. Sarang choisit pour vous un mode de départ sensé : Parcourir par défaut pour un petit catalogue (environ moins de 100 produits actifs — un menu de restaurant typique ou une petite boutique), Recherche par défaut pour un grand catalogue (pour qu'un catalogue Distributeur ou Électronique avec des centaines d'articles ne devienne pas un défilement sans fin) — mais le bouton de bascule vous permet toujours de passer de l'un à l'autre, quelle que soit la taille du catalogue. Si votre catalogue est assez grand pour que Parcourir n'affiche que le premier lot de produits, une note au-dessus de la grille l'indique et vous renvoie vers la recherche pour le reste.

En pleine vente, besoin d'aider un autre client sans perdre le panier en cours ? Cliquez sur **Mettre la vente en attente** pour le mettre de côté et repartir de zéro ; **Reprendre la vente** affiche vos paniers en attente pour reprendre exactement là où vous vous étiez arrêté. Le **MRP** d'un produit, lorsqu'il est défini plus haut que son prix de vente, s'affiche comme un prix de référence barré à côté du prix réel dans les résultats de recherche.

## Historique et détail des factures

La **liste des factures** (`/billing`, via la vue liste des factures) affiche chaque facture avec son client, le nombre d'articles, le total, le solde dû et le statut de paiement (IMPAYÉ / PARTIEL / PAYÉ / ANNULÉ). Recherchez par numéro de facture ou par client, filtrez par plage de dates ou par statut Actif/Annulé.

Ouvrir une facture affiche ses lignes complètes, la répartition des taxes et l'historique des paiements. Depuis cet écran, vous pouvez :

- **Enregistrer un paiement** — saisissez un montant (total ou partiel), choisissez un mode (Espèces, UPI, Carte ou Wallet — le Crédit n'est pas proposé ici puisqu'enregistrer un paiement signifie qu'un montant réel a été reçu), et un numéro de référence et des remarques facultatifs. L'enregistrement d'un paiement met à jour immédiatement le solde et le statut de paiement ; enregistrer moins que le solde total laisse la facture au statut PARTIEL.
- **Annuler un paiement** — si un paiement a été enregistré par erreur, annulez-le avec un motif. Le paiement annulé reste visible (barré) pour la piste d'audit.
- **Imprimer** ou **Imprimer le reçu** — prévisualisez la mise en page de la facture A4 ou du reçu thermique avant l'envoi à l'imprimante.
- **Annuler la facture** — nécessite un motif et ne peut pas être annulé (irréversible).
- **Send to Kitchen** — apparaît uniquement pour les entreprises de type Restaurant avec le KOT activé, et seulement avant qu'un KOT n'existe déjà pour cette facture.

L'**historique des paiements** est un écran séparé qui liste tous les paiements jamais enregistrés, toutes factures confondues — consultable par facture, client ou numéro de référence, et filtrable par mode de paiement ou plage de dates. L'annulation d'un paiement peut également se faire depuis cet écran.

## Quotations

Les **Quotations** (`/billing/quotations`) sont des estimations de prix non contractuelles que vous pouvez remettre à un client avant qu'il ne s'engage. Créez-en une avec **New Quotation** : choisissez ou tapez un nom de client, ajoutez des lignes d'articles (recherchés de la même façon que dans Facturation), une date de validité facultative, et des notes.

Une Quotation démarre au statut **Brouillon** et peut passer à **Envoyée**, **Acceptée**, ou **Expirée**. Une fois que le client l'accepte, cliquez sur **Convert to Invoice** — cela crée une véritable facture à partir des articles de la Quotation et marque la Quotation comme Acceptée. Une Quotation déjà convertie affiche un lien vers la facture résultante à la place du bouton de conversion. Les Quotations peuvent être imprimées au format A4 ou largeur reçu, et supprimées tant qu'elles n'ont pas été converties.

## Credit Notes et Debit Notes

Les **Credit Notes** (`/billing/credit-notes`) enregistrent une somme due *en retour* à un client — typiquement pour un retour, un trop-perçu, ou un geste commercial. Créez-en une avec un motif et un montant, optionnellement liée à un client et/ou à la facture d'origine. La lier à un client crédite automatiquement son grand livre, réduisant ce qu'il vous doit.

Les **Debit Notes** (`/billing/debit-notes`) sont l'équivalent côté fournisseur : une somme qu'un fournisseur vous doit en retour, par exemple un retour de stock acheté ou une correction de facturation. Lier une Debit Note à un fournisseur débite son grand livre, réduisant ce que vous lui devez. Les Credit Notes et Debit Notes peuvent toutes deux référencer facultativement la facture ou le bon de commande auquel elles se rapportent, peuvent être modifiées ou supprimées, et s'impriment au format A4 ou largeur reçu.

## Partager des documents par WhatsApp et E-mail

Les factures, Quotations, Credit Notes et Debit Notes disposent chacune de boutons de partage **WhatsApp** et **E-mail** (une icône de bulle de discussion et une icône d'enveloppe) à côté de leurs contrôles Print/Export existants. Cliquer sur l'un d'eux :

1. Vous invite à enregistrer le document au format PDF — la même boîte de dialogue d'enregistrement déjà utilisée par Print/Export.
2. Ouvre le dossier contenant ce PDF, avec le fichier mis en surbrillance.
3. Ouvre votre propre WhatsApp (ou application e-mail), pré-rempli avec le numéro de téléphone ou l'e-mail du client ou du fournisseur (à partir de ses coordonnées enregistrées) et un court message indiquant le numéro et le montant du document.

**Vous devez joindre le fichier vous-même** — glissez-le depuis le dossier mis en surbrillance vers la fenêtre WhatsApp ou e-mail qui vient de s'ouvrir, puis cliquez sur Envoyer. Sarang ne peut pas joindre le fichier automatiquement : ni les liens de discussion instantanée de WhatsApp ni les liens `mailto:` ne prennent en charge les pièces jointes, donc cette unique étape de glisser-déposer est une véritable limitation des deux, et non une fonctionnalité manquante. Rien n'est jamais envoyé automatiquement — Sarang se contente d'ouvrir votre propre WhatsApp/application e-mail pré-rempli ; c'est toujours vous qui cliquez sur Envoyer.

Si un client ou un fournisseur n'a aucun numéro de téléphone enregistré, le bouton WhatsApp est désactivé. S'il n'a aucun e-mail enregistré, le bouton E-mail ouvre quand même votre application e-mail avec le champ « À » laissé vide pour que vous le complétiez.

Ouvrir WhatsApp de cette façon lance WhatsApp Desktop s'il est installé, ou WhatsApp Web dans votre navigateur sinon. Ouvrir E-mail lance l'application définie comme messagerie par défaut sur votre ordinateur — si aucune n'est définie, Windows vous demandera d'en choisir une ; c'est normal.

## Notes sur la taxe et l'arrondi

Chaque total de facture est arrondi à l'unité monétaire entière la plus proche, la différence d'arrondi étant affichée sur sa propre ligne afin que le calcul reste toujours visiblement cohérent. Sous le modèle fiscal GST, la taxe s'imprime en CGST+SGST pour une vente intra-État ou en une seule ligne IGST pour une vente inter-États, selon la case cochée lors de la création de la facture.
