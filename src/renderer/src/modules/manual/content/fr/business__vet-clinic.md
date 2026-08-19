# Clinique Vétérinaire

Les écrans de ce type d'entreprise sont uniquement en anglais, quelle que soit la langue que vous avez définie ailleurs dans Sarang.

## La fondation de service partagée

Chaque type d'entreprise basé sur le service dans Sarang — y compris Clinique Vétérinaire — part des quatre mêmes blocs de construction : **Rendez-vous** (réserver et planifier des visites), un **Catalogue de services** (la liste des consultations, procédures, et leurs prix), **Provider Schedules** (quel vétérinaire est disponible quand), et une **Notification Queue** automatique qui gère les rappels (comme les rappels de vaccination ci-dessous) sans que vous ayez à les envoyer à la main. Le reste de ce chapitre couvre ce qui est spécifique à une clinique vétérinaire.

## Patients

Ouvrez **Patients** dans la barre latérale pour voir chaque animal enregistré dans votre clinique, pas les propriétaires humains. Chaque fiche de patient affiche l'espèce (avec un marqueur emoji pour Chien/Chat/Oiseau/Lapin/Reptile/Autre), la race, le genre, le poids, et un badge de statut de vaccination (À jour / Bientôt dû / En retard / Aucun dossier). Filtrez par espèce, recherchez par nom de patient ou de propriétaire, ou passez à la vue **Archivé** pour les patients qui ne sont plus actifs.

Cliquez sur **Add Patient** pour en enregistrer un nouveau — nom, espèce, race, date de naissance, genre, couleur/marques, ID de puce électronique, un propriétaire lié optionnel (recherché parmi vos Clients existants, ou laissé comme client de passage), et des notes en texte libre pour les allergies ou conditions chroniques.

Une bannière en haut de la liste Patients affiche les **Upcoming Vaccinations** dues dans les 30 prochains jours parmi tous les patients, afin que rien ne soit oublié.

Si vous tenez une liste **Breed Health Alerts** (son propre écran dans la barre latérale), une alerte correspondante s'affiche automatiquement pendant que vous tapez une race dans le formulaire Add Patient — et reste visible sur le profil de ce patient par la suite, à chaque ouverture, pas seulement à l'enregistrement. Cette liste est entièrement à vous de construire : Sarang ne fournit aucun conseil vétérinaire préécrit, ajoutez donc les notes de risque que vous voulez que votre équipe garde en tête pour les races que vous voyez réellement (par ex. « demander les symptômes de hanche/articulation à chaque visite »).

## Fiche du patient

Ouvrir un patient vous amène à trois onglets :

- **Overview** — les détails du patient, la fiche du propriétaire lié, et un journal **Weight History**. Ajoutez une nouvelle pesée à tout moment ; une fois deux entrées ou plus, un petit graphique de tendance trace le poids au fil du temps. Si le propriétaire a d'autres animaux actifs enregistrés, une carte **Other Pets in This Household** les liste — un clic vous amène directement au profil propre d'un frère ou d'une sœur, sans avoir à rechercher à nouveau dans la liste Patients.
- **Vaccinations** — chaque dossier de vaccination (nom du vaccin, type, numéro de lot, fabricant, date d'administration, prochaine date d'échéance, vétérinaire administrant). Chaque dossier affiche un badge de statut (En retard / Dû dans Xj / À jour). Depuis ici, vous pouvez **mettre en file d'attente un rappel WhatsApp** pour une prochaine échéance (ignoré automatiquement si le propriétaire n'a pas de numéro de téléphone enregistré), ou **imprimer un certificat de vaccination**.
- **Rendez-vous** — l'historique complet des visites du patient avec son statut (Programmé, Confirmé, En cours, Terminé, Annulé, Absence).

Modifier un patient permet aussi de l'**archiver** (le masque de la liste active sans supprimer l'historique) et de le restaurer plus tard.

## Certificats de vaccination

Imprimer un certificat de vaccination produit un document formel d'une page avec l'en-tête de la clinique, les détails du patient et du vaccin, et une clause de non-responsabilité indiquant qu'il s'agit d'un document de commodité généré par Sarang, pas un dossier vétérinaire validé — vérifiez toujours les détails avant de vous y fier cliniquement.

## Notes de consultation

Lors de la réservation d'un rendez-vous, choisissez le **patient (animal)** spécifique concerné. Une fois la visite effectuée, ouvrez **Notes cliniques** pour enregistrer une consultation réelle — signes vitaux, constatations, et plan — la même prise de notes structurée que partage chaque secteur clinique de Sarang. La note est préremplie avec le nom et l'âge propres de l'animal (pas ceux du propriétaire), et affiche l'espèce, la race, le sexe, et le propriétaire de l'animal juste à côté pour un contexte rapide.

Les signes vitaux sont vérifiés par rapport à des **plages normales** qui tiennent compte de l'espèce du patient — la plage normale de température et de pouls d'un chien diffère réellement de celle d'un chat ou d'un humain, et Sarang évalue chaque mesure automatiquement par rapport à la bonne plage.

## Rapports

Ouvrez **Reports → Vaccination Compliance** pour voir combien de doses de rappel sont réellement arrivées à temps. Cela examine chaque dose administrée dans la plage de dates choisie qui avait une date d'échéance précédente enregistrée — la toute première dose d'un vaccin pour un patient n'a rien à quoi être comparée pour être « à temps », elle est donc exclue du décompte — et affiche le pourcentage arrivé à ou avant cette date d'échéance, sous forme de jauge globale plus une répartition par vaccin. C'est une question différente de la carte de vaccination du Tableau de bord (qui est un instantané en direct de « ce qui est en retard en ce moment ») : ce rapport regarde en arrière sur une période spécifique, utile pour repérer si le calendrier de rappel d'un vaccin particulier dérape constamment.

**Case-Type Volume Trend** trace combien de cas vous traitez par type de cas, mois par mois — une ligne par type. Vos types de cas proviennent directement des catégories que vous avez configurées dans votre propre Catalogue de Services (Consultation, Toilettage, Diagnostic, ou toute autre que vous avez ajoutée, y compris Chirurgie si vous la suivez là-bas), plus une ligne dédiée **Vaccinations** provenant des doses réellement administrées plutôt que des rendez-vous réservés. Seuls les rendez-vous liés à un patient et non annulés comptent comme un cas réel.
