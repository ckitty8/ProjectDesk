# ProjectDesk — application (React + TypeScript)

Application unique du dépôt (migration depuis l'ancien JavaScript natif terminée en 2.68 : voir
[`docs/specifications/migration-react.md`](../docs/specifications/migration-react.md)). Servie sur `/app/`.
Architecture, écrans, tables et droits : [`docs/DAT.md`](../docs/DAT.md).

© 2026 CIRITEC. Tous droits réservés — logiciel propriétaire, voir [`LICENSE`](../LICENSE).

| Commande (depuis `web/`) | Rôle |
|---|---|
| `npm ci` | Installe les dépendances (versions figées par `package-lock.json`) |
| `npm run dev` | Serveur de développement (http://localhost:5173/app/) — se connecte à la base Neon réelle (`localhost` est autorisé par Neon Auth) |
| `npm run verifier` | Types (`tsc`), qualité (`eslint`), tests unitaires (`vitest`), puis construction |
| `npm run build` | Construit l'application dans `../app` (dossier généré, non versionné) |

## Sans accès à Neon : serveur simulé

```bash
npm --prefix web run build
node tests/serveur-simule.js       # puis ouvrir http://localhost:8123/app/
node tests/parcours.js             # contrôles de bout en bout (Playwright) + captures docs/maquettes/etat-actuel/
```

Le serveur simulé remplace Neon Auth et la Data API (comptes `camille@test.fr`, `thomas@test.fr`, `elodie@test.fr`, mot de passe
`motdepasse`). Pour l'utiliser à la main, déclarer avant le chargement :
`window.CONFIG_SURCHARGE = { NEON_AUTH_URL: location.origin + '/auth', DATA_API_URL: location.origin + '/rest/v1' }`.

## Déploiement

Vercel publie la branche `main` sur **https://project-desk-sepia.vercel.app** : `vercel.json` lance
`npm --prefix web ci && npm --prefix web run build` ; `/` redirige vers `/app/`. Tout nouveau domaine (personnalisé,
prévisualisation) doit être ajouté aux domaines de confiance de Neon Auth (Console Neon → Auth → Domains).

## Premier démarrage (base vide)

1. Ouvrir l'application et **créer son compte** (onglet « Créer un compte »).
2. Le déclarer **créateur** (rôle unique, tous les droits sur toutes les équipes — une seule fois, dans l'éditeur SQL de la
   console Neon ; la migration 025 le fait pour le compte du porteur) :
   ```sql
   insert into public.createur (user_id, email)
   select id::text, email from neon_auth."user" where email = 'votre.email@entreprise.fr';
   ```
   Le créateur nomme ensuite les autres **administrateurs globaux** (table `administrateurs`).
3. Se reconnecter : **Mon dashboard › Administration › Équipes** permet de créer les équipes (chaque équipe est une organisation
   Neon Auth dont vous devenez propriétaire), puis d'inviter les membres par email.
4. Dans **Mon dashboard › Liste des ressources**, construire l'organisation : « + Ajouter une équipe », puis « + Projet » et
   « + Personne » (avec l'email : le lien avec le compte se fait automatiquement à la connexion) ; sur chaque projet, « + Ajouter un
   Product Owner » et « + Membre ». Ajuster si besoin **Postes** et **Types de contrat**.

## Rôles

| Qui | Peut |
|-----|------|
| Créateur (table `createur`, un seul compte) | Tous les droits d'un administrateur, sur **toutes** les équipes ; seul à nommer ou retirer un administrateur ; **simule** les autres rôles (Administration créateur, lecture seule) |
| Administrateur global (table `administrateurs`) | Créer les équipes et directions, gérer référentiels, donner l'accès aux comptes en attente |
| Responsable d'équipe (rôle `owner` / `admin` de l'organisation) | Inviter des membres, valider les feuilles de temps |
| Membre d'une équipe | Tout lire (« Suivi de mes équipes ») ; modifier son équipe et ses projets (sauf rôle projet « Lecteur ») |
| Compte sans équipe | Attendre qu'un administrateur lui donne l'accès (Administration › Comptes en attente) |

## Organisation du code

```
web/src/
├── main.tsx, App.tsx, routes.ts   # point d'entrée, routes (une par écran)
├── Coquille.tsx                   # barre latérale, en-tête, bouton Aide
├── domaine/                       # règles métier pures + tests (config, calculs, dates, droits, daily, excel…)
├── donnees/                       # clients Neon (api), session et chargement (TanStack Query)
├── composants/                    # briques communes (catalogue : /app/composants)
├── ecrans/                        # un fichier par écran
└── theme.css                      # style de la maquette ; adaptatif sous 1 100 px (Galaxy Z Fold 7)
```

Aide : le bouton **Aide** de l'en-tête ; l'entrée « Contacter l'administrateur » apparaît si `CONTACT_AIDE` (adresse email) est renseigné
dans `src/domaine/config.ts`.
