# Pilotage Projet — application

Application web multi-projets et multi-équipes : objectifs (OKR), projets et roadmap, tickets,
ressources, congés et capacité, timesheet, daily, demandes entrantes.
Architecture, écrans, tables et droits : [`docs/DAT.md`](../docs/DAT.md).

## Lancer en local

L'application est statique (HTML/CSS/JS, sans build). Elle doit être servie par un serveur web
(pas en ouvrant `index.html` directement : les cookies de connexion ne fonctionnent pas en `file://`).

```bash
python3 -m http.server 8080        # depuis la racine du dépôt
# puis ouvrir http://localhost:8080/app/
```

Elle se connecte alors à la base Neon réelle (Neon Auth et Data API, URL dans `js/config.js`) ;
`localhost` est autorisé par Neon Auth.

### Sans accès à Neon : serveur simulé

```bash
node tests/serveur-simule.js       # puis ouvrir http://localhost:8123/app/
```

…en déclarant dans la console du navigateur, **avant** le chargement, ou via un script de test :
`window.CONFIG_SURCHARGE = { NEON_AUTH_URL: location.origin + '/auth', DATA_API_URL: location.origin + '/rest/v1' }`.
Le plus simple est d'utiliser le parcours automatique : `node tests/parcours.js`
(comptes simulés : `camille@test.fr`, `thomas@test.fr`, `elodie@test.fr`, mot de passe `motdepasse`).

## Déploiement

Vercel publie la branche `main` ; `vercel.json` redirige `/` vers `/app/`.
Tout nouveau domaine (domaine personnalisé, prévisualisation) doit être ajouté aux domaines de
confiance de Neon Auth (Console Neon → Auth → Domains).

## Premier démarrage (base vide)

1. Ouvrir l'application et **créer son compte** (onglet « Créer un compte »).
2. Le déclarer **administrateur global** (une seule fois, dans l'éditeur SQL de la console Neon) :
   ```sql
   insert into public.administrateurs (user_id)
   select id::text from neon_auth."user" where email = 'votre.email@entreprise.fr';
   ```
3. Se reconnecter : l'écran **Administration** permet de créer les équipes (chaque équipe est une
   organisation Neon Auth dont vous devenez propriétaire), puis d'inviter les membres par email.
4. Dans **Liste des ressources**, créer les fiches des personnes (avec leur email : le lien avec
   leur compte se fait automatiquement à leur connexion), puis les projets et affectations.

## Rôles

| Qui | Peut |
|-----|------|
| Administrateur global (table `administrateurs`) | Créer les équipes, gérer référentiels et champs du formulaire |
| Responsable d'équipe (rôle `owner` / `admin` de l'organisation) | Inviter des membres, valider les feuilles de temps |
| Membre d'une équipe | Tout lire (section Général) ; modifier son équipe et ses projets (sauf rôle projet « Lecteur ») |
| Demandeur (compte sans équipe) | Déposer des demandes et suivre les siennes |

## Structure

```
app/
├── index.html          # page unique, ordre de chargement des scripts
├── css/theme.css       # style de la maquette
└── js/
    ├── config.js       # URL Neon, paramètres métier
    ├── api.js          # Neon Auth + Data API
    ├── calculs.js      # règles de calcul (seul endroit)
    ├── etat.js         # état, chargement, navigation, événements
    ├── composants.js   # badges, barres, onglets…
    ├── coquille.js     # barre latérale et en-tête
    ├── panneau-projet.js, modale.js
    └── ecrans/         # un fichier par écran
```
