# Guide : utiliser Sarang sur plusieurs postes

Certains commerces ont besoin que deux ou trois personnes travaillent en même temps : l'une à la caisse, l'autre aux achats, une troisième à la comptabilité. Sarang peut le faire sur le réseau de votre propre boutique. Rien ne passe par Internet.

## Comment ça marche

- Un poste garde toutes les données. On l'appelle le **serveur**. Laissez-le allumé, Sarang ouvert, pendant les heures d'ouverture.
- Les autres postes sont des **clients**. Ils ne gardent aucune donnée de l'entreprise. Ils affichent et modifient les données gardées sur le serveur.
- Tout ce qui circule entre les postes est chiffré avec un **secret partagé** que vous choisissez. C'est désactivé tant que vous ne l'activez pas.

## Ce qu'il vous faut

- Tous les postes sur le même réseau de la boutique (le même Wi-Fi ou le même réseau filaire).
- Une licence avec assez de **places**. Le poste de la boutique compte pour une place, et chaque autre poste connecté en même temps en utilise une de plus. L'essai gratuit permet deux postes pour que vous puissiez essayer. Pour ajouter des places, écrivez à l'adresse indiquée sur l'écran Licence.

## Configurer le serveur (le poste qui garde les données)

1. Connectez-vous en tant que propriétaire. Allez dans **Settings → Business features → Multi-user**.
2. Choisissez **Ce poste garde les données (serveur)**.
3. Notez l'**adresse** affichée (par exemple 192.168.1.10:47821) et le **secret partagé**. Vous pouvez changer le secret à tout moment avec **Créer un nouveau secret**.
4. Appuyez sur **Enregistrer et redémarrer Sarang**.
5. Si un autre poste ne peut pas se connecter, autorisez Sarang dans le pare-feu Windows de ce poste pour les réseaux privés.

## Configurer chaque poste client

1. Installez Sarang sur le poste et ouvrez-le.
2. Sur la page de connexion, appuyez sur **Connexion entre postes (plusieurs postes)**.
3. Choisissez **Ce poste se connecte à un autre poste (client)**. Saisissez l'adresse du serveur et le secret partagé, appuyez sur **Tester la connexion**, puis sur **Enregistrer et redémarrer Sarang**.
4. Connectez-vous avec votre propre identifiant et mot de passe. Créez un identifiant pour chaque personne dans **Settings → Users** afin que chaque vente et chaque modification indique qui l'a faite.

## Travailler ensemble

- Chaque personne a sa propre connexion et ses propres autorisations.
- Si deux personnes enregistrent au même instant, l'une attend un court moment l'autre. Les numéros, comme ceux des factures, ne se répètent jamais. Si deux personnes vendent la dernière unité, une seule vente aboutit.
- Quand quelqu'un ouvre un client, un fournisseur ou un produit pour le modifier, les autres qui ouvrent la même fiche voient **« … a ceci ouvert sur un autre poste »** et ne peuvent pas enregistrer tant qu'il n'est pas fermé.
- Quand un autre poste modifie des données, une petite note apparaît : **« … a modifié des données sur un autre poste. Actualiser. »** Appuyez sur Actualiser pour voir le plus récent.
- **Settings → Business features → Multi-user** sur le serveur liste les postes connectés et permet d'en déconnecter un.

## Ce qui ne fonctionne que sur le poste serveur

Les sauvegardes et leur restauration, l'import de fichiers, le tutoriel, l'activation de la licence, l'ouverture de documents depuis le disque et l'impression des tickets de cuisine se font sur le poste serveur. Un poste client imprime les factures et enregistre les rapports (Excel, PDF, CSV) sur sa propre imprimante et son propre disque.

## Bonnes habitudes

- Gardez le serveur sur une alimentation stable et faites une sauvegarde chaque jour sur le serveur. Les clients ne peuvent pas travailler si le serveur est éteint.
- Ne copiez pas le fichier de données sur d'autres postes et n'ouvrez pas le même fichier depuis deux postes à travers le réseau. Utilisez cette fonction. Ouvrir un même fichier depuis deux postes peut l'endommager.
- Gardez le secret partagé confidentiel. Si quelqu'un quitte la boutique, appuyez sur **Créer un nouveau secret** et saisissez le nouveau sur les autres postes.
