# Clinique Dentaire

Les écrans de ce type d'entreprise sont uniquement en anglais, quelle que soit la langue que vous avez définie ailleurs dans Sarang.

## La fondation de service partagée

Chaque type d'entreprise basé sur le service dans Sarang — y compris Clinique Dentaire — part des quatre mêmes blocs de construction : **Rendez-vous** (réserver et planifier des visites), un **Catalogue de services** (la liste des procédures dentaires et leurs prix), **Provider Schedules** (quel dentiste est disponible quand), et une **Notification Queue** automatique qui gère les rappels sans que vous ayez à les envoyer à la main. Le reste de ce chapitre couvre les deux outils spécifiques à la dentisterie de Sarang : le schéma dentaire et le calendrier de rappel.

## Schéma Dentaire

Chaque patient dentaire a un onglet **Tooth Chart** montrant un schéma dentaire complet en notation FDI — à la fois l'arcade permanente (adulte) et l'arcade déciduale (dents de lait/primaires), supérieure et inférieure. Cliquez sur n'importe quelle dent pour enregistrer ou mettre à jour son état :

- États : Saine, Carie, Obturée, Absente, Couronne, Bridge (pilier), Implant, Traitement de canal, Site d'extraction, Fracture — chacun affiché avec sa propre couleur sur le schéma.
- Pour tout état autre que Saine ou Absente, marquez quelles **surfaces** sont affectées (Buccale, Linguale, Mésiale, Distale, Occlusale).
- Ajoutez des notes cliniques en texte libre par dent.

Une légende au-dessus du schéma montre ce que signifie chaque couleur, et vous pouvez **Print Chart** à tout moment pour une impression tabulaire de chaque dent avec un état enregistré (autre que Saine) — utile pour les références ou les dossiers patients.

Cliquez sur **History** sur n'importe quelle dent pour voir sa chronologie complète — pas seulement ses changements d'état, mais aussi chaque procédure de plan de traitement ayant jamais mentionné cette dent, fusionnées en une seule chronologie, la plus récente en premier. Une entrée d'état affiche l'état et les notes éventuelles ; une entrée de traitement affiche la procédure et de quel plan elle provient, étiquetée **Treatment Planned** ou **Treatment Done** selon le statut propre de cette procédure. Réenregistrer une dent (disons, de Carie à Obturée après traitement) n'efface jamais l'entrée précédente ; les deux restent dans la chronologie afin que vous ayez l'histoire complète de cette dent — ce qui a été constaté, ce qui a été proposé, et ce qui a réellement été fait.

## Plans de Traitement

L'onglet **Treatment Plans** du même écran patient vous permet de construire des plans de traitement détaillés : un titre, un statut (Proposé / Accepté / En cours / Terminé / Refusé), et une liste de procédures, chacune optionnellement liée à un numéro de dent spécifique, avec son propre coût estimé et un indicateur En attente/Fait. Le coût total estimé du plan est calculé automatiquement à partir de ses lignes. Une fois qu'un plan existe, joignez-y des fichiers justificatifs — une radiographie, un formulaire de consentement scanné — directement depuis sa vue de modification.

Une fois qu'un plan dépasse Proposed (Accepted, In Progress, ou Completed) et n'a pas encore été facturé, une action **Generate Invoice** apparaît dessus — un clic transforme les procédures chiffrées du plan en une véritable facture pour ce patient, une ligne par procédure (étiquetée par dent le cas échéant), et le plan affiche alors un badge **Billed**. Un plan ne peut être facturé qu'une seule fois ; un plan toujours au statut Proposed ne peut pas du tout être facturé, car cela supposerait silencieusement que le patient a déjà donné son accord.

## Calendrier de Rappel

L'onglet **Recall** (et l'écran autonome **Calendrier de rappel**, listant le rappel de chaque patient dans toute la clinique) est le système de rappels de recall dentaire de Sarang — le flux quotidien « revenez pour votre nettoyage de 6 mois ». Pour chaque patient, vous définissez :

- **Recall Type** — Hygiène 6 mois, Hygiène 12 mois, Révision de couronne, ou Personnalisé.
- **Last Visit Date** et **Next Recall Date**.
- Notes optionnelles.

L'écran Recall Schedule classe chaque patient en **En Retard**, **Due Soon** (dans les 7 jours), **Ce mois** (dans les 30 jours), ou **Upcoming**, avec des comptes et des badges codés par couleur pour chaque catégorie, afin que vous sachiez toujours qui appeler ensuite. Un badge « Reminded » apparaît une fois qu'un rappel a été envoyé pour le recall de ce patient.

Chaque fois que vous mettez à jour le recall d'un patient qui en avait déjà un, Sarang enregistre silencieusement si cette période de recall clôturée a été respectée à temps — la nouvelle Last Visit Date comparée à la date de recall qui était due avant votre mise à jour. Vous ne voyez jamais cela directement ; cela alimente le rapport de Conformité de Rappel ci-dessous.

## Rapports

Ouvrez **Reports → Treatment Acceptance Rate** pour voir combien de plans de traitement que vous avez proposés sur une plage de dates sont réellement devenus des revenus facturés — un entonnoir en trois étapes (Proposed → Accepted → Billed) sous forme de graphique en barres, plus le taux d'acceptation (acceptés ÷ proposés) et le taux de facturation (facturés ÷ proposés) en pourcentages. Ce sont les mêmes données réelles de plans que celles de l'onglet Treatment Plans, agrégées au lieu d'être lues patient par patient — un aperçu rapide pour savoir si vos présentations de cas convertissent, et si les plans acceptés aboutissent réellement au paiement.

Ouvrez **Reports → Recall Compliance** pour voir, parmi les périodes de recall clôturées sur une plage de dates, quel pourcentage de patients est réellement revenu à sa date d'échéance ou avant — une seule jauge pour le pourcentage global, plus une répartition par Type de Rappel (Hygiène 6 mois, Hygiène 12 mois, Révision de couronne, Personnalisé). Seules les périodes de recall réellement clôturées comptent (un patient ayant déjà un recall qui en reçoit un nouveau) — le tout premier recall d'un patient n'a pas de date d'échéance antérieure à laquelle se comparer, donc il n'est compté ni dans un sens ni dans l'autre.
