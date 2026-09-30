# Modèles de flux : Suivi des Étapes de Document

## Ce que c'est

Les **Modèles de flux** vous permettent de définir une série d'étapes nommées qu'un document traverse visiblement — par exemple **Brouillon → Approuvé → Envoyé au fournisseur → Reçu** pour un Bon de commande, ou vos propres termes pour une Commande client. C'est un moyen simple et visuel de voir *où en est réellement* un document dans votre propre processus, au-delà de son statut système (Brouillon, Confirmée, Facturée, etc.).

Les Modèles de flux s'appliquent actuellement à deux types de documents : les **Bons de commande** et les **Commandes clients**. Chaque type de document a son propre jeu d'étapes, indépendant de l'autre — le pipeline que vous configurez pour les Bons de commande n'a aucun effet sur les Commandes clients, et inversement.

Comme les Flux d'approbation, les Modèles de flux sont **désactivés par défaut** et entièrement **optionnels**. Si vous ne configurez jamais d'étape pour un type de document, rien ne change nulle part — aucun widget n'apparaît, et le document fonctionne exactement comme avant.

## Configurer les étapes (Paramètres)

Un propriétaire ou un administrateur configure les étapes depuis les **Paramètres**, dans la section Modèles de flux. Choisissez le type de document (Commande client ou Bon de commande), puis ajoutez les étapes une par une en tapant un nom et en confirmant — chaque nouvelle étape s'ajoute à la fin du pipeline.

Quelques limites réelles à connaître :

- **20 étapes maximum** par type de document. Si vous atteignez la limite, retirez une étape dont vous n'avez plus besoin avant d'en ajouter une nouvelle.
- **Aucun nom en double** au sein d'un même type de document — cette vérification ignore la casse des lettres.
- Le nom d'une étape peut compter jusqu'à **80 caractères**.
- Utilisez les flèches haut/bas à côté de chaque étape pour **réorganiser** le pipeline à tout moment — cela ne change que l'ordre d'affichage des étapes ; cela n'affecte aucun document déjà positionné sur l'une d'elles.
- Retirer une étape de la liste ne la supprime pas définitivement, elle est **retirée du service**. C'est important, car un document réel peut déjà se trouver à cette étape ; la retirer préserve cet historique intact tout en la sortant de tout nouvel usage. Une étape retirée n'apparaît plus dans le pipeline, ni comme option pour faire avancer un document.

Configurer les étapes (ajouter, réorganiser, retirer) requiert la même autorisation que pour modifier les autres paramètres de l'entreprise. Quelqu'un qui ne peut que consulter les Paramètres peut voir les étapes configurées, mais pas les modifier.

## Voir et faire avancer l'étape d'un document

Dès qu'un type de document a au moins une étape configurée, chaque document de ce type affiche un suivi d'étapes directement sur son propre écran de détail — sur les écrans de détail des **Bons de commande** comme des **Commandes clients**, à côté du panneau d'approbation de ce document (s'il y en a un configuré). Le suivi affiche tout le pipeline sous forme d'une rangée d'étapes ; l'étape actuelle du document est mise en évidence, et les étapes qui la précèdent sont marquées comme terminées.

Un document qui n'a pas encore été déplacé est automatiquement considéré comme étant à la **première étape** — lorsque vous activez les Modèles de flux pour un type de document, vous n'avez pas besoin de revenir sur vos documents existants pour leur assigner une étape de départ ; tant que personne ne les fait avancer, ils sont simplement considérés comme étant à la première étape.

Pour faire avancer un document, cliquez directement sur l'étape vers laquelle vous voulez le déplacer — vous n'êtes **pas** obligé de passer par les étapes une par une dans l'ordre ; n'importe quelle étape configurée peut être sélectionnée directement. Cliquer sur l'étape où se trouve déjà le document ne fait rien.

## Ceci n'est pas un contrôle d'approbation

Les Modèles de flux sont un pipeline de statut que vous définissez librement pour votre propre suivi — ce n'est **pas** un contrôle de validation ou de permission. Faire passer un document d'une étape à la suivante ne demande rien de plus que l'autorisation qui permet déjà de créer ou de modifier ce type de document ; il n'existe pas de paramètre distinct pour définir « qui peut faire avancer une étape », et aucune étape ne peut bloquer un document ou exiger une approbation avant qu'il n'avance. Si vous avez besoin qu'un document requière une validation au-delà d'un certain montant avant d'être confirmé, c'est le rôle des **Flux d'approbation** — les Modèles de flux et les Flux d'approbation peuvent être utilisés ensemble sur le même document, mais ils remplissent deux rôles différents : les Flux d'approbation contrôlent si un document *peut* être confirmé ; les Modèles de flux montrent simplement *où il en est* ensuite, dans le pipeline que vous avez conçu.

## Si un type de document n'a aucune étape configurée

Si vous n'avez configuré aucune étape pour les Bons de commande ou les Commandes clients, le suivi d'étapes n'apparaît tout simplement pas sur les écrans de ces documents — il n'y a rien à désactiver ou à masquer séparément. Configurer la première étape d'un type de document suffit à faire apparaître le suivi sur chaque document de ce type par la suite.
