# Messagerie et Rappels WhatsApp

Sarang peut préparer des messages WhatsApp pour vos clients — rappels de rendez-vous, avis de paiement en retard, renouvellements d'abonnement/contrat, et bien plus, pour tous les types d'entreprise — et les transmettre à WhatsApp prêts à envoyer. Sarang n'envoie jamais un message automatiquement : il ouvre toujours votre propre WhatsApp (Bureau ou Web) avec le message pré-rempli, et c'est vous qui cliquez sur **Send**. C'est la même approche « vous gardez toujours le contrôle » qu'utilisent les boutons Share via WhatsApp sur les Factures et autres documents (voir **Facturation & Documents**).

Trois endroits liés à cela sont couverts ci-dessous : la file d'attente **WhatsApp Reminders**, l'éditeur **Message Templates**, et l'envoi d'un message ponctuel depuis la propre page d'un **Client**.

## WhatsApp Reminders — envoyer ce que Sarang a déjà préparé

Ouvrez **WhatsApp Reminders** depuis la barre latérale. Au fil de votre utilisation quotidienne de Sarang — prendre des rendez-vous, une facture en retard, un abonnement proche de l'expiration — l'application prépare automatiquement des messages de rappel et les ajoute ici avec le statut **Pending**. Rien n'a encore été envoyé ; cette liste rassemble simplement tout ce qui est prêt à partir.

Pour chaque rappel en attente, vous pouvez :
- Cliquer sur **Send on WhatsApp** — ouvre WhatsApp avec le message et le numéro de téléphone du client pré-remplis. Vous le vérifiez puis cliquez sur Send dans WhatsApp.
- Cliquer sur la coche pour **Mark Sent** une fois réellement envoyé, afin qu'il sorte de votre liste en attente.
- Cliquer sur le X pour **Dismiss** un rappel que vous ne souhaitez pas envoyer (par ex. vous avez déjà appelé le client à la place).

Utilisez le filtre **Pending / Sent / All** en haut pour consulter l'historique. Un rappel n'apparaît ici que si le client a un numéro de téléphone enregistré — Sarang ne peut pas préparer de message WhatsApp sans cela.

## Message Templates — personnaliser le contenu de vos rappels

Chaque message de rappel ci-dessus provient d'un modèle — un par situation (rappel de rendez-vous, paiement en retard, expiration d'abonnement, etc.), couvrant tous les secteurs d'activité pris en charge par Sarang. Par défaut, ceux-ci utilisent une formulation pré-rédigée sensée, mais vous pouvez personnaliser n'importe lequel d'entre eux.

Ouvrez **Settings → Message Templates**. Les modèles sont regroupés par domaine d'activité (Salle de sport, Juridique, Vétérinaire, Logistique, etc.) — cliquez sur un groupe pour le déplier. Pour chaque modèle, vous verrez :

- Sa formulation actuelle, dans une zone de texte modifiable.
- Les **placeholders** qu'il prend en charge en dessous, affichés comme `{{customerName}}`, `{{date}}`, etc. — ceux-ci sont remplacés par les vraies informations du client lorsqu'un rappel est réellement généré. Conservez-les exactement tels quels (même orthographe, mêmes doubles accolades) si vous modifiez le texte environnant ; un placeholder supprimé ou mal orthographié apparaîtra littéralement dans le message envoyé au lieu de la vraie valeur.
- Un badge **Customized** une fois votre propre formulation enregistrée, et un bouton **Reset to Default** pour revenir à tout moment à la formulation de Sarang.
- Un badge **Internal note** sur le seul modèle (rappels de génération de facture de retainer) qui est une note à faire pour votre propre personnel, jamais envoyée à un client.

Cliquez sur **Preview** sur n'importe quel modèle pour voir à quoi il ressemblerait réellement, rempli avec des détails d'exemple réalistes — un moyen rapide de vérifier que votre formulation sonne naturellement avant d'enregistrer.

### Reminder Message Language

En haut de l'écran Message Templates, un **administrateur/manager** peut définir le **Reminder Message Language** — la langue que tout modèle non personnalisé individuellement utilisera lors de la génération d'un rappel. Ceci est distinct de votre propre langue d'affichage personnelle (celle que vous choisissez sous Settings → Language) : votre propre écran peut être en anglais tandis que les rappels WhatsApp de votre commerce partent en hindi, ou dans toute autre langue prise en charge, car ce qui compte ici, c'est ce que comprennent vos *clients*, pas ce qu'affiche l'écran d'un membre du personnel en particulier. Un modèle que vous avez personnalisé vous-même utilise toujours votre propre formulation enregistrée, quel que soit ce paramètre.

## Envoyer un message WhatsApp ponctuel depuis la page d'un Client

Tous les messages ne correspondent pas à un rappel programmé — parfois, vous voulez simplement envoyer quelque chose à un client précis, tout de suite. Ouvrez la page de n'importe quel client et cliquez sur **Send WhatsApp Message** (affiché uniquement si ce client a un numéro de téléphone enregistré).

1. Choisissez un modèle dans le menu déroulant — le même catalogue que Message Templates ci-dessus, limité à ceux destinés aux clients (la note à usage interne n'est pas proposée ici).
2. Le nom du client lui-même est rempli automatiquement partout où le modèle l'attend. Remplissez tout ce dont le modèle a besoin d'autre (un montant, une date, un numéro de dossier...) dans les champs fournis.
3. Un aperçu en direct se met à jour au fur et à mesure que vous tapez, montrant exactement ce qui sera envoyé.
4. Cliquez sur **WhatsApp** pour l'ouvrir pré-rempli, comme partout ailleurs — vérifiez et envoyez depuis là.

## Une note sur la façon dont WhatsApp s'ouvre réellement

Ouvrir WhatsApp de cette façon lance WhatsApp Desktop s'il est installé, ou WhatsApp Web dans votre navigateur sinon, exactement comme les boutons Share via WhatsApp sur les Factures et autres documents. Sarang n'a aucun moyen de confirmer qu'un message a réellement été livré une fois WhatsApp ouvert — c'est pourquoi les rappels restent en **Pending** jusqu'à ce que vous cliquiez vous-même explicitement sur **Mark Sent**.
