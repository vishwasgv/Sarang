# Centres de Coûts, Budgets et Trésorerie

## Centres de Coûts

Un **Centre de Coûts** (`/cost-centres`) est une étiquette — un service, une agence ou un projet — que vous pouvez associer à une facture, une note de frais, une dépense ou un employé pour voir le profit et les dépenses ventilés par cette étiquette plutôt qu'à l'échelle de toute l'entreprise. Chaque entreprise démarre sans aucun centre de coûts, donc rien de tout cela n'apparaît ailleurs tant que vous n'avez pas créé votre premier centre de coûts avec **Nouveau Centre de Coûts** (un nom et un code court facultatif).

Une fois qu'au moins un centre de coûts existe, un sélecteur **Centre de Coûts** facultatif apparaît sur l'écran de finalisation de la facture, le formulaire de note de frais, le formulaire de dépense et le formulaire d'employé — laissez-le vide et rien ne change ; choisissez-en un et chaque écriture comptable créée par cette transaction porte la même étiquette. Le centre de coûts propre à un employé étiquette également automatiquement sa charge salariale lorsque la paie le marque comme payé, de sorte que le coût du personnel se cumule par service sans avoir à réétiqueter chaque bulletin de paie à la main.

## Budgets

**Budgets** (`/budgets`) vous permet de planifier un montant mensuel — pour un centre de coûts spécifique, un compte spécifique ou toute l'entreprise — puis de voir comment les dépenses réelles se comparent une fois le mois entamé. Choisissez le mois avec les flèches en haut, puis **Nouveau Budget** pour définir un montant sur une portée : laissez à la fois Centre de Coûts et Compte vides pour un chiffre à l'échelle de l'entreprise, définissez uniquement un Centre de Coûts pour un budget de tout un service, ou définissez les deux pour une portée plus restreinte. La liste affiche Budgété, Réel et Écart côte à côte pour le mois que vous consultez — Réel correspond toujours à des données de transactions réelles, jamais estimées, donc un budget pour un centre de coûts qui n'a encore eu aucune dépense affiche honnêtement zéro plutôt qu'un vide.

Vous ne pouvez pas créer deux budgets pour exactement la même portée et la même période — modifiez plutôt le budget existant, de sorte que « combien avons-nous budgété pour Marketing ce mois-ci » ait toujours une seule réponse.

## Rapport de Résultat par Centre de Coûts

Sous Rapports, **Résultat par Centre de Coûts** affiche le revenu, les dépenses et la marge réels par centre de coûts pour toute plage de dates que vous choisissez, tirés des mêmes transactions étiquetées que lit l'écran Budgets. Les revenus et dépenses qui n'ont jamais été étiquetés à aucun centre de coûts sont affichés séparément comme un total « non étiqueté », plutôt que d'être silencieusement omis — ainsi les totaux du rapport tiennent toujours compte de tout, étiqueté ou non.

## Résumé de Conformité Statutaire

Sarang n'applique jamais automatiquement les règles officielles du gouvernement pour le PF/ESI/la Taxe Professionnelle — celles-ci changent à chaque notification gouvernementale, et un chiffre erroné mais présenté avec assurance est pire qu'un champ vide. À la place, si vous saisissez votre propre % de PF, % d'ESI (avec un plafond salarial facultatif) et le montant de la Taxe Professionnelle dans **Paramètres → Profil de l'entreprise**, l'écran Paie obtient un lien **Suggérer selon les taux statutaires** à côté de la section Retenues de chaque bulletin de paie. Il pré-remplit des lignes de retenue suggérées à partir de vos propres taux configurés — vous pouvez toujours vérifier, modifier ou supprimer chaque ligne, et vous devez tout de même appuyer sur Enregistrer pour qu'elle soit prise en compte. Rien n'est jamais suggéré pour un taux que vous n'avez pas défini.

Le rapport **Résumé de Conformité Statutaire** (sous Rapports) totalise ce que vous avez réellement enregistré — chaque ligne de retenue sur chaque bulletin de paie du mois, regroupée par nom — comme un chiffre réel de responsabilité de l'employeur pour le PF, l'ESI, la Taxe Professionnelle ou tout autre élément que vous avez nommé comme retenue, qu'il provienne d'une suggestion ou qu'il ait été saisi à la main.

## Projection de Trésorerie

Le rapport **Projection de Trésorerie** (sous Rapports) affiche un graphique jour par jour divisé en deux moitiés qui se rejoignent aujourd'hui : une ligne pleine du mouvement de trésorerie **réel** du mois écoulé (argent effectivement reçu moins les dépenses et les paiements aux fournisseurs effectivement réglés), et une ligne pointillée de trésorerie **projetée** pour le mois à venir — construite à partir des factures et notes de frais ouvertes selon leurs propres dates d'échéance, plus toute dépense récurrente dont l'échéance tombe dans cette fenêtre. C'est une vue de planification, pas une garantie : seuls les documents ayant une date d'échéance réelle sont projetés, et seuls les profils de *dépense* récurrents sont prévus (le montant futur exact d'une facture ou d'une note de frais récurrente n'est pas estimé, afin d'éviter un chiffre erroné mais présenté avec assurance).

## Performance de Paiement

Le rapport **Performance de Paiement** (sous Rapports) indique, par client, combien de jours il a réellement fallu pour encaisser intégralement une facture — mesuré de la date de la facture à la date de son *dernier* paiement, de sorte qu'un client qui paie en trois versements n'est compté qu'une fois qu'il a véritablement fini de payer. Les factures encore soldées avec un solde apparaissent comme en attente plutôt que de fausser la moyenne avec un paiement qui n'est pas encore terminé. Utilisez-le pour voir quels clients paient de manière fiable rapidement et lesquels mettent systématiquement le plus de temps, à la fois par client et sous forme de moyenne globale.
