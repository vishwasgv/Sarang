# Utilisateurs & Permissions

Si plusieurs personnes utilisent Sarang — un propriétaire ainsi que des caissiers, du personnel de cuisine, ou des managers — ajoutez chacun d'eux comme son propre **Utilisateur** avec un **Rôle** qui contrôle exactement ce qu'il peut voir et faire. Ceci se gère depuis **Paramètres → Utilisateurs & Rôles**.

## Ajouter un utilisateur

Cliquez sur **Ajouter un utilisateur** et remplissez :

- **Nom complet** (requis)
- **Nom d'utilisateur** (requis — utilisé pour se connecter)
- **Mot de passe** (requis, longueur minimale définie par votre politique de mot de passe, au moins 6 caractères)
- **Rôle** (requis — voir ci-dessous)
- **E-mail** et **Téléphone** (facultatifs)

Enregistrez, et le nouveau compte peut se connecter immédiatement avec le nom d'utilisateur et le mot de passe que vous avez définis.

## Rôles

Chaque utilisateur se voit attribuer un rôle, et chaque rôle est assorti d'un ensemble fixe de permissions intégrées à Sarang — il n'existe aucun écran pour créer des rôles personnalisés ou choisir des permissions individuelles. Les rôles intégrés sont :

- **Administrateur** — accès complet au système, y compris chaque paramètre, chaque rapport, et la gestion des utilisateurs elle-même.
- **Manager** — large contrôle opérationnel (facturation, stock, achats, rapports, la plupart des paramètres) sans accès complet de niveau administrateur.
- **Caissier** — centré sur la facturation : création de factures, enregistrement des paiements, et les opérations quotidiennes de comptoir pertinentes pour votre type d'entreprise.
- **Personnel** — support opérationnel général avec un accès plus restreint que Caissier/Manager.
- **Personnel de cuisine** — limité aux opérations de cuisine du restaurant (consultation/mise à jour des KOT), pour les entreprises utilisant le modèle Restaurant.

Chaque écran et action dans Sarang vérifie les permissions du rôle de l'utilisateur actuel avant de l'autoriser — par exemple, la section Utilisateurs & Rôles elle-même n'est visible que pour un utilisateur dont le rôle inclut la permission `users.view`, et créer, modifier, ou désactiver d'autres utilisateurs nécessitent chacun leur propre permission distincte. Si votre rôle n'a pas accès à quelque chose, l'option est soit masquée, soit affichée désactivée.

## Modifier un utilisateur ou changer son rôle

Cliquez sur l'icône de modification (crayon) à côté d'un utilisateur pour changer son nom complet, son rôle, son e-mail, ou son téléphone. Le nom d'utilisateur et le mot de passe ne se modifient pas depuis ce formulaire — voir la réinitialisation du mot de passe ci-dessous.

## Désactiver un utilisateur

Cliquez sur l'icône de suppression à côté d'un utilisateur actif pour le désactiver (nécessite la permission de désactivation). Un compte désactivé ne peut plus se connecter, mais ses enregistrements historiques (factures créées, actions enregistrées, etc.) sont conservés. Vous ne pouvez pas désactiver votre propre compte depuis cet écran.

## Réinitialiser le mot de passe d'un autre utilisateur

Cliquez sur l'icône de bouclier à côté d'un utilisateur (non disponible pour votre propre compte) pour lui définir directement un nouveau mot de passe — utile s'il a oublié le sien. Cela invalide immédiatement toutes ses sessions actuellement connectées.

## Changer votre propre mot de passe

Allez dans **Paramètres → Sécurité**, saisissez votre mot de passe actuel, puis votre nouveau mot de passe deux fois. Votre nouveau mot de passe doit respecter la longueur minimale configurée (10 caractères par défaut). Après un changement réussi, vous devrez vous reconnecter.

## Politique de mot de passe

Également sous **Paramètres → Sécurité**, un administrateur peut définir la **longueur minimale de mot de passe** requise pour chaque compte à l'avenir (entre 4 et 64 caractères). Cela ne s'applique que la prochaine fois qu'un mot de passe est créé ou modifié — les mots de passe existants ne sont pas affectés rétroactivement.

## Expiration de session

Pour la sécurité, Sarang déconnecte automatiquement une session inactive après une période d'inactivité (30 minutes par défaut) — tout clic de souris, appui sur une touche, défilement, ou toucher réinitialise le minuteur. Cela protège contre le cas où quelqu'un s'éloigne d'une caisse ou d'un ordinateur de bureau déverrouillé. Se reconnecter nécessite simplement à nouveau votre nom d'utilisateur et votre mot de passe ; aucun travail en cours n'est perdu au-delà de ce qui n'était pas encore enregistré.

## Protection de connexion

Après 5 tentatives de connexion échouées pour le même nom d'utilisateur en 15 minutes, Sarang bloque temporairement toute nouvelle tentative et vous indique combien de minutes attendre — cela s'applique à la fois à la connexion et au changement de votre propre mot de passe, afin de ralentir quiconque essaierait de deviner un mot de passe.
