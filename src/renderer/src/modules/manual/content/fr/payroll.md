# Paie

Ouvrez **Paie** depuis la barre latérale pour générer, consulter et payer le salaire mensuel de chaque employé — construit sur les mêmes fiches Employé et l'historique de Présence couverts dans le chapitre RH de ce Manuel. Consulter la liste de paie et imprimer un bulletin de paie nécessitent seulement la permission **View HR** ; générer la paie, modifier les retenues et marquer un bulletin de paie comme payé nécessitent tous la permission **Manage HR**.

## Choisir une période

Utilisez les flèches **◀** / **▶** à côté du nom du mois pour naviguer entre les périodes. La paie est générée et suivie un mois calendaire à la fois, pour chaque employé actif.

## Générer la paie

Appuyez sur **Générer la Paie pour Cette Période** pour créer un bulletin de paie brouillon pour chaque employé actif qui n'en a pas déjà un pour le mois sélectionné — relancer l'opération pour le même mois ne fait que combler les manques, elle ne crée jamais de doublon pour quelqu'un déjà généré. Le **Salaire Brut** de chaque bulletin de paie est le Salaire de Base de l'employé plus ses Indemnités configurées (les deux définis sur la fiche de l'employé), et la part de ce brut réellement gagnée par un employé pour le mois dépend de son Type de Salaire :

- **Mensuel** — le salaire brut complet, non affecté par les repos hebdomadaires, jours fériés ou congés approuvés. Il n'est réduit qu'en cas d'absence réelle non justifiée : chaque jour **Absent** déduit une part proportionnelle du brut mensuel, et chaque **Demi-journée** en déduit la moitié.
- **Journalier** — le Salaire de Base est traité comme un taux journalier, payé uniquement pour les jours effectivement marqués **Présent** (une Demi-journée compte pour une demi-journée) ce mois-là, plus les Indemnités mensuelles fixes en supplément.
- **Horaire** — le Salaire de Base est traité comme un taux horaire, calculé de la même façon que Journalier mais en supposant une journée de 8 heures pour chaque jour présent.

Tout ceci est déterminé directement par les enregistrements de Présence de cet employé pour le mois — voir la section Présence du chapitre RH pour savoir comment ils sont marqués jour par jour.

## Consulter et ajuster un bulletin de paie

Appuyez sur la ligne d'un employé pour ouvrir son bulletin de paie. Il affiche le Salaire de Base et chaque ligne d'Indemnité menant au Salaire Brut. Tant qu'un bulletin de paie est encore au statut **Brouillon**, vous pouvez ajouter des **Retenues** — un nom et un montant (PF, ESI, Taxe Professionnelle et TDS apparaissent comme des boutons d'ajout rapide en un clic dès que le modèle fiscal de votre entreprise est défini sur GST) — et retirer toute retenue que vous avez ajoutée, avec le total **Salaire Net** en bas qui se recalcule en direct au fur et à mesure. Appuyez sur **Enregistrer** pour enregistrer vos modifications à la liste des retenues.

L'avertissement affiché sous la liste des retenues mérite d'être lu : Sarang calcule le salaire brut et additionne les retenues que vous saisissez, mais ne calcule pas pour vous les montants statutaires PF/ESI/TDS — ces chiffres doivent provenir de votre propre comptable ou des règles de paie applicables, saisis ici comme de simples lignes de retenue.

## Marquer un bulletin de paie comme payé

Une fois satisfait des retenues, choisissez un **Mode de Paiement** (Espèces, Virement Bancaire, Chèque ou UPI) et appuyez sur **Marquer comme Payé**, puis confirmez. Cela verrouille le bulletin de paie — les retenues d'un bulletin de paie payé ne peuvent plus être modifiées, et il affiche désormais la date de paiement et le mode utilisé à la place de l'éditeur de retenues.

## Imprimer un bulletin de paie

Appuyez sur l'icône d'imprimante sur n'importe quelle ligne de la liste, ou sur **Imprimer le Bulletin de Paie** dans un bulletin de paie ouvert, pour générer un bulletin de paie imprimable pour cet employé et cette période — disponible que le bulletin de paie soit encore un brouillon ou déjà marqué comme payé.
