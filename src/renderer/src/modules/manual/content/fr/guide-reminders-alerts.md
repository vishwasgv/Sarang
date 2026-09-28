# Guide : Rappels et alertes

Sarang vous dit deux choses différentes, à deux endroits différents. Savoir laquelle est laquelle résout l'essentiel de la confusion.

| | **Alertes** (la cloche) | **Rappels WhatsApp** |
|---|---|---|
| Pour qui | **Vous** | **Vos clients, fournisseurs ou patients** |
| Où | Icône de cloche dans la barre du haut | **Reminders & Messages → WhatsApp Reminders** |
| Exemples | Stock bas, sauvegarde effectuée, rappels dus, vérification de la base de données | « Votre rendez-vous est demain à 10h00 », « Votre paiement est en retard », « Votre adhésion se termine dans 7 jours » |
| Ce que vous faites | Cliquez : Sarang ouvre l'écran concerné | Cliquez sur **Send on WhatsApp**, puis appuyez sur Envoyer dans WhatsApp |
| Envoyé automatiquement ? | Affiché automatiquement | **Jamais.** Sarang prépare le message ; vous appuyez toujours vous-même sur Envoyer |

## Alertes (la cloche)

La cloche affiche un nombre quand quelque chose nécessite votre attention. Ouvrez-la et cliquez sur une alerte :

- **WhatsApp Reminders Due** ouvre l'écran WhatsApp Reminders.
- **Low Stock Alert** ouvre Inventory.
- **Auto-Backup Complete** et **Database Integrity Issue** ouvrent Backup.
- **Compliance Tasks Generated** (cabinets CA et CS) ouvre Compliance.

Une alerte marquée **Open →** est cliquable. Cliquer la marque aussi comme lue. **Mark all read** efface le nombre.

## Rappels WhatsApp

Sarang prépare des rappels à partir de ce qui se passe dans votre entreprise et les liste dans **WhatsApp Reminders**, en trois onglets : **Pending**, **Sent** et **All**.

Pour chaque rappel en attente, vous voyez à qui il s'adresse, le message, et quand il était dû.

1. Cliquez sur **Send on WhatsApp**. WhatsApp (l'application de bureau ou WhatsApp Web) s'ouvre avec le numéro de la personne et le message déjà saisi.
2. Appuyez sur **Send** dans WhatsApp. Cette étape est toujours la vôtre.
3. De retour dans Sarang, cliquez sur le coché (**Mark as sent**) pour qu'il passe dans *Sent*. Utilisez la croix (**Dismiss**) pour un rappel que vous décidez de ne pas envoyer.

Un rappel **sans numéro de téléphone** affiche « No phone number, so this can't be sent ». Ajoutez le numéro au client ou au fournisseur, ou rejetez-le. Seuls les rappels réellement envoyables peuvent être marqués envoyés. Un rappel dont le numéro de téléphone est trop court pour être réel est marqué **Failed** et n'est pas compté comme prêt à envoyer : corrigez le numéro sur le client et le prochain rappel fonctionnera.

**Un client qui a demandé à ne pas être contacté.** Cochez **Do not send this customer messages** sur la fiche du client. Ses rappels en attente sont supprimés, ils n'apparaissent plus comme prêts à envoyer, et le bouton ponctuel **Send WhatsApp Message** les refuse.

### Ce qui crée des rappels

- **Rendez-vous** (cliniques, salons, salles de sport et autres entreprises fonctionnant sur rendez-vous) : un rappel **24 heures avant** et un autre **2 heures avant** l'heure du rendez-vous. Ils sont comptés à partir de la date et de l'heure du rendez-vous, donc un rendez-vous demain à 10h00 est rappelé aujourd'hui à 10h00 et demain à 08h00. Une réservation faite moins de 24 heures à l'avance ne reçoit que le rappel de 2 heures ; une faite moins de 2 heures à l'avance n'en reçoit aucun.
- **Reprogrammer ou annuler** un rendez-vous remplace ou supprime ses rappels en attente, pour que personne ne soit rappelé d'un ancien horaire. Les rendez-vous terminés, non présentés et en cours perdent aussi leurs rappels en attente.
- **Pas de téléphone sur le client** : aucun rappel n'est créé, et Sarang vous le signale lors de la réservation.
- **Paiements en retard** (7, 14 et 30 jours), **renouvellements d'adhésion et de contrat**, **dates de vaccin et de rappel médical**, **frais dus**, **dates d'audience juridique**, **expéditions envoyées ou retardées**, **marchandises reçues** (un remerciement au fournisseur, seulement s'il a un numéro de téléphone), et beaucoup d'autres spécifiques à votre secteur.
- **Fiche client → Send WhatsApp Message** : un message ponctuel que vous rédigez vous-même.

### Envoyer beaucoup à la fois

Les rappels arrivent à échéance tout au long de la journée. Sarang vérifie toutes les heures tant qu'il est ouvert et place une alerte **WhatsApp Reminders Due** sur la cloche. Si Sarang est fermé, les rappels attendent ; ils ne sont pas perdus, ils s'affichent comme dus à la prochaine ouverture.

### Modèles de messages

**Reminders & Messages → Message Templates** vous permet de modifier le texte de chaque rappel, de voir un aperçu en direct, et de choisir la **langue du rappel**.

- Conservez les paramètres comme `{{name}}` et `{{date}}` exactement tels qu'ils sont écrits ; Sarang les remplit. Si vous saisissez un paramètre que ce message ne peut pas remplir (une faute de frappe comme `{{nmae}}`) ou des accolades qui ne se referment pas, Sarang vous avertit pendant la saisie et ne l'enregistrera pas.
- **Le texte est conservé pour la langue de rappel que vous avez choisie.** Choisissez le hindi en haut et rédigez votre texte en hindi ; choisissez l'anglais et rédigez votre texte en anglais. Le texte enregistré alors que l'anglais est choisi s'applique aussi à toute langue pour laquelle vous n'avez pas rédigé le vôtre. **Reset** supprime le texte actuellement en vigueur et ramène le texte intégré.
- **Les rappels déjà en attente sont mis à jour** lorsque vous enregistrez un modèle, changez la langue de rappel ou changez la signature : Sarang les reformule en conséquence, et vous indique combien il en a mis à jour. Un rappel que vous avez modifié à la main, ou un qui ne correspond plus à son modèle, est laissé tel quel.
- **Signature.** Les messages intégrés se terminent par « Powered by Sarang | www.aszurex.com ». Décochez **End messages with Powered by Sarang** en haut de l'écran pour le retirer de tous les messages.
- Chaque rappel commence par le nom de votre entreprise en gras, ajouté automatiquement.

## Alertes que vous fixez vous-même

**Settings → Business Features → Alert rules** vous envoie une notification sur la cloche lorsqu'une vente, une facture fournisseur ou une dépense d'au moins un montant que vous choisissez est enregistrée (par exemple « Invoice saved, at least 50,000 »). Vous pouvez désactiver ou supprimer une règle. Les règles ne font que vous avertir ; elles ne bloquent ni ne modifient jamais un document, et se déclenchent pour les documents créés sur les écrans principaux.

## Bonnes habitudes

- Vérifiez **WhatsApp Reminders** une fois le matin et une fois l'après-midi.
- Gardez les numéros de téléphone dans un format international ou local de façon cohérente ; Sarang ajoute l'indicatif de votre pays aux numéros locaux (il connaît les indicatifs d'environ 100 pays). Si votre pays n'est pas reconnu, saisissez les numéros avec l'indicatif du pays et un signe plus.
- Demandez à Sarang : « Combien de rappels sont en attente ? » vous indique combien sont prêts, combien sont programmés pour plus tard et combien ont échoué.
