# Sauvegarde & Restauration

Sarang stocke toutes les données de votre entreprise dans un unique fichier de base de données local sur cet ordinateur. L'écran **Sauvegarde** (barre latérale, ou **Paramètres → Sauvegarde & Restauration**) est l'endroit où vous protégez ces données contre une panne de disque, une suppression accidentelle, ou une machine perdue/volée.

## Créer une sauvegarde manuelle

Cliquez sur **Créer une sauvegarde**. Sarang effectue d'abord une vérification d'intégrité de la base de données, vide les écritures en attente, puis produit une copie propre et défragmentée de votre base de données, la contrôle par somme de contrôle, et l'empaquette (avec un petit fichier de métadonnées) dans un unique fichier `.sarang-backup`. Si la vérification d'intégrité échoue, la sauvegarde est refusée plutôt que d'enregistrer une copie potentiellement corrompue — un message d'erreur vous expliquera pourquoi.

Chaque sauvegarde apparaît dans la liste **Historique des sauvegardes** avec son nom de fichier, sa date, sa taille, et un badge de statut valide/invalide.

## Où les sauvegardes sont stockées

Par défaut, les sauvegardes sont enregistrées dans le propre dossier de données de l'application, sur le même disque que votre base de données active (indiqué en bas de l'écran Sauvegarde, et typiquement sous `AppData\Sarang Business OS Lite\backups\` sous Windows). Comme il s'agit du même disque que celui où résident vos données actives, une panne de disque emporterait aussi les sauvegardes avec elle.

Lors de votre première connexion, Sarang affiche une invite unique **« Protégez vos sauvegardes »** vous encourageant à choisir immédiatement un emplacement de sauvegarde différent — une clé USB externe, un second disque, ou un dossier réseau. Vous pouvez l'ignorer, et modifier cela à tout moment plus tard depuis le bouton **Choisir un dossier de sauvegarde** de l'écran Sauvegarde (un réglage réservé au propriétaire/administrateur). Si le dossier configuré devient inaccessible (par ex. une clé USB n'est pas branchée), Sarang revient automatiquement au dossier local par défaut pour cette sauvegarde plutôt que d'échouer silencieusement, et le signale à l'écran. Les sauvegardes sont toujours enregistrées sur un disque local ou un dossier réseau de votre choix — jamais sur un service cloud.

## Sauvegardes automatiques

Un administrateur peut activer la **sauvegarde automatique** depuis l'écran Sauvegarde : activez-la, puis réglez le nombre de jours entre les sauvegardes automatiques, le nombre de sauvegardes à conserver (les plus anciennes au-delà de ce nombre sont supprimées automatiquement), et le nombre de jours sans sauvegarde devant déclencher un rappel. Une fois activée, Sarang vérifie au démarrage de l'application si suffisamment de jours se sont écoulés depuis la dernière sauvegarde et en crée une automatiquement le cas échéant, avec une notification confirmant que cela a eu lieu.

Sarang crée également une **sauvegarde de sécurité** automatique de votre base de données actuelle immédiatement avant toute restauration (voir ci-dessous), afin qu'une restauration puisse elle-même être annulée si nécessaire.

## Vérifier l'intégrité de la sauvegarde et de la base de données

L'écran Sauvegarde affiche deux indicateurs en direct :
- **Santé de la sauvegarde** — si vous êtes protégé (sauvegardé aujourd'hui), en retard (sauvegardé au cours de la dernière semaine mais pas aujourd'hui), ou non protégé (aucune sauvegarde, ou datant de plus d'une semaine).
- **Intégrité de la base de données** — une vérification que votre fichier de base de données actif n'est pas corrompu.

Vous pouvez aussi cliquer sur l'icône de bouclier à côté de n'importe quelle sauvegarde individuelle pour la **Vérifier** à la demande — Sarang recontrôle la somme de contrôle du fichier et confirme qu'il peut toujours être ouvert et lu correctement, et met à jour son statut valide/invalide en conséquence. Chaque sauvegarde est contrôlée par somme de contrôle (SHA-256) au moment de sa création, spécifiquement pour qu'une altération ou corruption ultérieure du fichier puisse être détectée.

## Restaurer à partir d'une sauvegarde

Cliquez sur l'icône de restauration sur n'importe quelle sauvegarde de la liste. Sarang valide d'abord le fichier et vous montre un aperçu — nom de l'entreprise, date de la sauvegarde, version de l'application, et taille de la base de données — afin que vous puissiez confirmer que vous restaurez la bonne. Confirmer déclenche :

1. Une sauvegarde de sécurité de votre base de données *actuelle* (afin que les données du jour ne soient pas perdues si vous changez d'avis).
2. Le remplacement de la base de données active par le contenu de la sauvegarde.
3. Un redémarrage automatique de l'application pour se reconnecter aux données restaurées.

La restauration n'est disponible que pour les utilisateurs disposant de la permission appropriée (généralement un administrateur). Si une restauration échoue en cours de route, Sarang tente de se reconnecter à votre base de données d'origine et signale l'erreur — la sauvegarde de sécurité créée à l'étape 1 est là spécifiquement pour vous permettre de récupérer aussi de cette situation.

## Supprimer d'anciennes sauvegardes

Les sauvegardes peuvent être supprimées individuellement depuis la liste (soumis à autorisation d'administrateur/permission). La suppression retire à la fois le fichier et son enregistrement ; elle n'affecte pas vos données actives.
