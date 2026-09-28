# Guide : l'argent et votre comptabilité

Comment ce que vous faites chaque jour (vendre, acheter, payer, dépenser) devient votre comptabilité, et comment lire les états. Ceci est pour vos propres registres et votre planification ; cela ne remplace pas le conseil de votre comptable ou expert-comptable.

## 1. Comment votre travail quotidien devient votre comptabilité

Vous n'avez pas à passer d'écritures comptables pour le travail normal. Sarang les enregistre pour vous :

| Vous faites ceci | Sarang enregistre |
|---|---|
| Vous faites une vente (facture) | Ce que le client doit (ou caisse ou banque si payé), le revenu de vente, et la taxe collectée |
| Vous recevez un paiement | Caisse ou banque monte, ce que le client doit baisse |
| Vous recevez du stock sur un Bon de commande | Le stock et ce que vous devez au fournisseur montent |
| Vous enregistrez une Facture fournisseur | Ce que vous devez au fournisseur monte ; le coût ou le stock est enregistré |
| Vous payez un fournisseur | Caisse ou banque baisse, ce que vous devez baisse |
| Vous enregistrez une Dépense | La dépense monte, caisse ou banque baisse (ou ce que vous devez monte) |
| Vous émettez une Note de crédit ou une Note de débit | La vente ou l'achat est réduit, et le solde aussi |
| Vous enregistrez l'amortissement d'une Immobilisation | La charge d'amortissement monte, la valeur de l'actif baisse |
| Un client retient une TDS en payant | La facture est soldée ; « TDS à recevoir » (taxe dont vous obtiendrez crédit) monte au lieu de la caisse |
| Vous payez la GST au gouvernement (Comptabilité, Paiements GST) | La taxe due et le crédit d'intrants utilisé baissent, caisse ou banque baisse |
| Vous approuvez et remboursez une note de frais d'un employé | Une dépense normale est enregistrée et caisse ou banque baisse |

Chaque écriture a deux côtés toujours égaux (les débits égalent les crédits). C'est pourquoi la comptabilité s'équilibre.

## 2. Plan comptable

**Accounting → Chart of Accounts** est la liste des comptes utilisés par votre comptabilité, en groupes : Actifs (caisse, banque, créances, stock, immobilisations), Passifs (dettes fournisseurs, taxes à payer, emprunts), Capitaux propres (votre capital et les bénéfices), Produits et Charges. Sarang crée les comptes standard pour vous. Ajoutez les vôtres (par exemple un nouvel emprunt bancaire ou une dépense particulière) avec **Add Account**.

Cliquez sur **Ledger** sur n'importe quel compte pour voir chaque écriture qui s'y trouve (voir section 5).

## 3. Écritures de journal : ajustements qui ne sont ni une vente ni un achat

**Accounting → Journal Entries → New.** Utilisez une écriture de journal pour ce qui n'est pas une vente ou un achat ordinaire : un solde d'ouverture, une passation en perte, un propriétaire qui apporte ou retire de l'argent, la correction d'une écriture antérieure. Ajoutez des lignes, chacune avec un compte et un débit ou un crédit. **Le total des débits doit égaler le total des crédits**, sinon Sarang ne l'enregistrera pas. Les écritures validées peuvent être contrepassées (avec un motif), pas supprimées, il y a donc toujours une piste.

Aides sur le formulaire d'écriture :

- **Modèles (patterns)** : une fois les comptes remplis et le sens de chacun choisi, enregistrez la disposition sous un nom (par exemple *Loyer mensuel*). La prochaine fois, choisissez-le et saisissez seulement les montants. Enregistrer sous un nom existant le remplace.
- **Contrepasser automatiquement le** : pour une charge à payer (une dépense enregistrée maintenant qui concerne le mois suivant), choisissez la date à laquelle l'écriture doit s'annuler elle-même. Sarang le fait la prochaine fois qu'il est ouvert à cette date ou après, daté du jour où cela s'exécute. Si la période est verrouillée, la contrepassation attend.
- **Notes mémorandum** (dépliant en bas des Journal Entries) : notes sur des choses qui ne sont pas encore des écritures comptables, comme des marchandises envoyées à l'essai. Elles ne modifient jamais votre comptabilité.
- **Clavier** : appuyez sur **Enter** sur le dernier montant pour ajouter une ligne d'équilibrage et **Ctrl + Enter** pour valider.

## 4. L'argent en banque

- **Comptes bancaires** : ajoutez chaque compte bancaire, puis **Reconcile** : importez ou saisissez les lignes du relevé bancaire et faites-les correspondre à ce que Sarang a déjà enregistré, pour que votre comptabilité concorde avec la banque.
- **Chèques postdatés** : suivez les chèques que vous avez donnés ou reçus pour une date ultérieure.
- **Dépôts bancaires** : enregistrez un dépôt d'espèces et de chèques à la banque.
- **Clôture de caisse** (quotidienne) : comptez les espèces dans le tiroir et enregistrez toute différence.
- **Règles bancaires** (Accounting → Bank Rules) : indiquez à Sarang qu'une ligne de relevé contenant certains mots (par exemple « électricité ») appartient à un compte donné. L'écran liste les lignes de relevé importées correspondant aux règles ; un clic les enregistre sur ce compte et les marque rapprochées. Les règles ne s'exécutent jamais toutes seules et une ligne validée peut être annulée depuis l'écran de rapprochement.
- **Dépenses** : enregistrez chaque coût de l'entreprise avec une catégorie, un fournisseur, et si la taxe est à votre charge (autoliquidation).
- **Notes de frais** (Accounting → Expense Claims) : quand le personnel paie quelque chose de sa poche, enregistrez la demande, puis **Approve** (ou **Reject**) et **Repay**. Rembourser enregistre une dépense normale avec le mode de paiement que vous choisissez.

## 5. Les états, et comment lire chacun

Ouvrez **Reports** et choisissez le groupe **Financial**. Choisissez une période et lancez le rapport. Chacun a une ligne de synthèse, un graphique et un tableau ; vous pouvez imprimer, exporter en Excel ou PDF, ou partager.

**Compte de résultat (Profit and Loss Statement).** Produits moins coûts sur une période : chiffre d'affaires, coût des marchandises vendues, marge brute, dépenses par catégorie, résultat net. *Question à laquelle il répond :* ai-je gagné de l'argent ce mois-ci ?

**Comment le stock apparaît dans votre comptabilité.** Sarang gère le stock comme Tally et Zoho Books. Les marchandises achetées sur une facture fournisseur (ou un Bon de commande reçu) entrent dans l'actif **Inventaire**, pas dans les charges. Lors d'une vente, le coût de ce qui a été vendu sort de l'Inventaire vers le **Coût des marchandises vendues**, au coût du moment de la vente. Un retour remet la marchandise à ce coût. Les services sur une facture (fret, loyer) sont des charges. Un écart d'inventaire, un dommage ou une péremption est comptabilisé contre le Coût des marchandises vendues. Le stock saisi à la main (stock d'ouverture) est comptabilisé contre le Capital du propriétaire. C'est pourquoi le Bilan, le compte de résultat et le rapport des Ventes racontent la même histoire. Si vous avez migré depuis une ancienne version, votre stock existant a été intégré une fois à la comptabilité, à son coût, au premier démarrage ; les ventes faites avant la mise à jour n'ont pas d'écriture de coût des marchandises vendues, donc commencez votre premier compte de résultat à partir de la date de mise à jour.

**Bilan (Balance Sheet).** Ce que l'entreprise possède et doit **à une date donnée** : actifs d'un côté, passifs plus vos capitaux propres de l'autre, et une ligne de contrôle qui montre qu'ils sont égaux. Le résultat de la période en cours est inclus dans les capitaux propres pour que cela s'équilibre. Choisissez **Compare with** une date antérieure pour voir ce qui a changé. *Question à laquelle il répond :* que vaut mon entreprise sur le papier, et combien est dû ?

**Tableau des flux de trésorerie (Cash Flow Statement).** D'où vient la trésorerie et où elle va sur une période : de l'exploitation de l'entreprise (opérationnel), de l'achat ou la vente d'actifs (investissement), et des emprunts et de l'argent du propriétaire (financement), de la trésorerie d'ouverture à la trésorerie de clôture. Un badge « reconciled » montre que la trésorerie de clôture concorde avec vos comptes de caisse et de banque. *Question à laquelle il répond :* je suis rentable, alors pourquoi n'y a-t-il pas de trésorerie ?

**Balance générale (Trial Balance).** Le total débit ou crédit de chaque compte pour la période. Si les débits égalent les crédits, la comptabilité est équilibrée. Cliquez sur n'importe quelle ligne pour ouvrir le grand livre de ce compte.

**Grand livre (General Ledger).** Choisissez un compte et une période. Vous obtenez le solde d'ouverture, chaque écriture avec un solde courant, et le solde de clôture, chacune avec le document dont elle provient (une facture, un achat, un paiement, une écriture de journal). Les factures et les achats renvoient directement au document. Ouvrez-le depuis **Chart of Accounts → Ledger**, depuis une ligne du **Trial Balance**, ou depuis la liste des Reports. *Question à laquelle il répond :* pourquoi ce compte affiche-t-il ce chiffre ?

**Journal des opérations (Day Book).** Chaque écriture par ordre de date, filtrable par type (ventes, achats, encaissements, paiements, journaux). Totaux par jour. *Question à laquelle il répond :* que s'est-il passé ce jour-là ?

**Livre de caisse (Cash Book).** Un registre jour par jour de chaque paiement reçu et de chaque paiement ou dépense effectué, avec un solde courant.

**Plus de rapports pour votre comptable et pour vous** (tous dans la liste Reports, chacun avec un graphique) :

- **Analyse de ratios (Ratio Analysis)** (liquidité, dette, marges, délais clients, fournisseurs et stock) et **Tableau de financement (Fund Flow)** (origines et emplois des fonds).
- **Livre bancaire (Bank Book)** et **Résumé de rapprochement bancaire**.
- **Résumé des créances** et **Résumé des dettes fournisseurs** (qui doit quoi et ce qui échoit dans les 7 prochains jours), **Marge par article** et **Marge par client**, **Comparaison annuelle**.
- **Marge par catégorie de coût** (produits, charges et marge additionnés par la catégorie donnée à chaque centre de coût) et **Budget contre réel (Budget vs. Actual)**.
- **Dépenses par catégorie** et **Dépenses par fournisseur**, **Registre des immobilisations**.
- **Registres des Notes de crédit, Notes de débit et Retours de vente**.
- **TDS retenue**, **TDS à recevoir** et (pour les entreprises assujetties à la GST) **GST Net Payable & Input Credit**.

Certains rapports peuvent aussi être enregistrés automatiquement dans un dossier selon un calendrier (Settings → Business Features → Reports saved automatically) ; cela ne fonctionne que pendant que Sarang est ouvert.

## 6. Vérifications à faire chaque mois

1. **Trial Balance** : les débits égalent les crédits.
2. **Bilan** : les actifs égalent les passifs plus les capitaux propres.
3. **Rapprochement bancaire** : le solde bancaire dans Sarang égale le relevé bancaire.
4. **Créances et dettes** : le rapport Outstanding et l'AP Aging Summary concordent avec les soldes clients et fournisseurs.
5. **Valeur du stock** : le total de l'Inventaire est cohérent avec votre dernier comptage.
6. Envoyez le **compte de résultat**, le **Bilan** et le **Tax Report** du mois à votre comptable.

## Budgets, centres de coûts et plusieurs boutiques

- Les **centres de coûts** étiquettent les produits et charges par service ou projet. Donnez à chaque centre de coût une **catégorie** (par exemple Service ou Projet) et **Profit by Cost Category** les additionne.
- Les **budgets** fixent un montant prévu par mois. À côté de votre plan réel (le **Base plan**), vous pouvez créer des **plans hypothétiques** : choisissez **New what-if plan**, nommez-le et augmentez ou baissez chaque chiffre d'un pourcentage. **Budget vs. Actual** suit le plan choisi.
- **Plusieurs boutiques ou succursales ?** Chaque boutique garde son propre Sarang. **Accounting → Branch Summaries** exporte un fichier de synthèse de chaque boutique et les importe en un seul endroit pour que le propriétaire voie toutes les boutiques ensemble. Rien ne se synchronise tout seul.

## Devises étrangères

Tenez un tableau de taux de change dans **Settings → Business Features → Exchange rates** (ajoutez les taux à la main ou importez un CSV). Lors d'une vente en devise étrangère, le taux le plus récent est renseigné. Les paiements reçus dans cette devise enregistrent le gain ou la perte de change.

## 7. Verrouiller une période terminée

**Accounting → Ledger Settings** vous permet de fixer une **date de verrouillage**. Rien à cette date ou avant ne peut être ajouté, modifié ou contrepassé, ce qui protège les chiffres déjà utilisés par votre comptable pour une déclaration ou un audit. Fixez-la seulement après confirmation de la période par votre comptable.

## 8. Fin d'exercice

**Fixed Assets and Year-End Close** (son propre chapitre) couvre la comptabilisation de l'amortissement et la clôture de l'exercice. Après une clôture, les soldes d'ouverture du nouvel exercice sont reportés automatiquement. Les rapports montrant un solde à une date commencent à partir de la dernière écriture d'ouverture.

## Partager votre comptabilité avec votre comptable

Créez un accès pour votre comptable avec le rôle **Accountant** : il peut consulter les rapports, grands livres et états et les exporter, et ne peut rien modifier. Ajoutez-le dans **Settings → Users**. Envoyez-lui le compte de résultat, le Bilan et le Tax Report du mois, ou exportez le Trial Balance pour lui.

## Questions fréquentes

**Pourquoi le bénéfice n'est-il pas égal à la trésorerie que j'ai ?** Le bénéfice compte les ventes non encore encaissées et les achats non encore payés. Le tableau des flux de trésorerie montre la différence.

**Pourquoi mon Bilan est-il déséquilibré ?** Il ne devrait jamais l'être. Si c'est le cas, ne le corrigez pas à la main : vérifiez s'il y a un verrouillage de période au milieu de la plage, notez l'écart et retracez-le dans le Grand livre avec votre comptable.

**Puis-je supprimer une écriture ?** Les écritures sont contrepassées, pas supprimées, pour que le registre reste complet. Utilisez Void, Cancel, Reverse ou une Note de crédit ou de débit, selon ce que propose l'écran.
