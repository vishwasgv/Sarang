# Journal d'audit

Le **Journal d'audit** (barre latérale) est un enregistrement permanent des actions significatives effectuées dans Sarang — qui a fait quoi, et quand. Il existe pour que vous puissiez toujours répondre à « qui a modifié cela ? » ou « qui s'est connecté et quand ? », et pour aider à repérer quoi que ce soit d'inhabituel.

## Ce qui est enregistré

Sarang enregistre une entrée d'audit pour des actions à travers toute l'application, y compris (entre autres) : connexions, déconnexions, et tentatives de connexion échouées des utilisateurs ; changements de mot de passe ; création et annulation de factures ; paiements enregistrés et annulés ; stock ajouté ou ajusté ; sauvegardes créées, restaurées, ou supprimées ; et modifications des paramètres de l'entreprise. Chaque entrée affiche la date et l'heure, l'action (par ex. « FACTURE CRÉÉE », « PAIEMENT ANNULÉ »), l'entité concernée (par ex. quelle Facture ou quel Produit), et quel utilisateur l'a effectuée — ou « Système » si elle n'était liée à aucun utilisateur connecté spécifique.

## Consulter et filtrer le journal

L'écran du Journal d'audit liste les entrées de la plus récente à la plus ancienne, 50 par page, avec des contrôles de page **Précédent/Suivant**. Utilisez le menu déroulant de type d'entité en haut pour filtrer sur un type de fiche spécifique (Utilisateur, Facture, Paiement, Stock, Produit, Client, Sauvegarde, et bien d'autres types d'entités propres à l'entreprise). Cliquez sur **Voir** sur toute ligne comportant des détails enregistrés pour la déployer et voir les anciennes et nouvelles valeurs impliquées dans cette action (affichées sous forme de données lisibles, pas de code brut).

Les entrées très anciennes sont automatiquement supprimées après une période de rétention configurable (2 ans par défaut) afin que le journal ne grandisse pas indéfiniment — cela ne supprime que l'historique réellement ancien, pas quoi que ce soit de récent.

## Vérifier que votre historique d'audit n'a pas été altéré

Cliquez sur **Vérifier l'intégrité** en haut de l'écran du Journal d'audit. Sarang peut vérifier que tout votre historique d'audit n'a pas été altéré — chaque entrée est secrètement liée à celle qui la précède au moment de sa création, donc si quelqu'un parvenait un jour à modifier ou supprimer discrètement une entrée passée (par exemple, pour cacher qu'une facture annulée a réellement eu lieu, ou pour effacer un ajustement de stock suspect), ce lien se romprait et Sarang le détecterait.

Exécuter la vérification vous indique soit :
- **La chaîne est intacte** — montrant combien d'entrées ont été vérifiées, confirmant que rien dans votre historique enregistré n'a été modifié.
- **La chaîne est rompue** — indiquant approximativement où la rupture a été trouvée, afin que vous sachiez que quelque chose dans votre piste d'audit ne correspond pas à ce qu'il devrait être.

Cette vérification s'exécute à la demande (elle n'est pas automatique à chaque lancement de l'application, car vérifier un historique volumineux représente un vrai travail) — exécutez-la à tout moment où vous souhaitez avoir l'assurance que vos enregistrements sont fiables, par exemple avant de vous appuyer sur le journal d'audit pour résoudre un litige.
