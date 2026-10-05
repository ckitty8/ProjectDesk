# Spécifications — Roadmap (intégration du fichier `CDO-ROADMAP-NEW.xlsm`)

> **Statut : fonctionnalité non encore développée.** Ce document consigne les décisions du
> porteur du projet pour la future roadmap. Elles s'imposent à tout développement de cette
> fonctionnalité. Une fois livrée, ses règles passent dans `docs/DAT.md` (§ 3, § 4, § 6).

| Date       | Décision |
|------------|----------|
| 2026-10-05 | Règle de classement des demandes (rang de traitement DSI) — § 1 |
| 2026-10-05 | Sprint : liste déroulante alimentée par Administration — § 2 |

## 1. Rang de traitement DSI (règle reprise du fichier Excel)

**Objet :** classer automatiquement les demandes dans l'ordre où la DSI doit les traiter
(rang 1 = en premier). L'utilisateur ne saisit que les informations métier ; le score et le
rang sont **calculés** par l'application (fonctions pures dans `app/js/calculs.js`, règle n°4)
et la liste se réordonne dès qu'une valeur change.

**Score** — « est-ce que ça vaut le coup ? » = ce que la demande rapporte ÷ ce qu'elle coûte :

```
Score = (0,5 × impact client + 0,3 × impact collaborateur) ÷ (0,2 × complexité)
```

- impacts client et collaborateur : 1, 2 ou 3 ; complexité : 1 à 5 ;
- l'impact client pèse plus que l'impact collaborateur (0,5 contre 0,3).

**Ordre de tri**, critère par critère :

1. **Stratégique d'abord** : une demande « Stratégique = Oui » passe devant toutes les autres ;
2. **puis la priorité du demandeur** : 1, puis 2, puis 3 ;
3. **puis le score** : à égalité, le score le plus élevé passe devant.

Dans l'Excel, ce tri passe par deux colonnes techniques (`Fixe` = 1 si stratégique ;
`Clé` = (1 − Fixe) × 100 000 + priorité × 1 000 + (1 000 − score), rang = clé croissante).
L'application applique directement les trois critères ; ces colonnes ne sont **pas** reprises.

**Exemples (fichier du porteur)**

| Demande | Stratégique | Priorité | Impacts client / collab. | Complexité | Score | Rang |
|---------|-------------|----------|--------------------------|------------|-------|------|
| Fiscalité « Bailleur privé » | Oui | 1 | 3 / 1 | 1 | 9   | 1er |
| API filtrée sur la BU URBAT  | Oui | 1 | 1 / 2 | 1 | 5,5 | 2e  |

**Complexité non saisie** : l'Excel donne alors un score de 0 (la demande tombe en bas de sa
catégorie). L'application affiche à la place **« complexité à saisir »** et place ces demandes
après celles de même priorité ayant un score (20 des 70 demandes ouvertes du fichier sont
concernées).

## 2. Sprint d'une demande

- Le champ **Sprint** est une **liste déroulante** (pas de saisie libre).
- Ses valeurs sont **celles configurées dans Administration** : un seul endroit pour la liste
  des sprints, qu'utilisent la roadmap et les autres écrans (règle n°4).
- **Existant à compléter** : aujourd'hui Administration ne contient pas de liste de sprints ;
  l'application les calcule (`SPRINT_REFERENCE` et `DUREE_SPRINT_JOURS` dans `app/js/config.js`,
  `Calculs.sprintDe`). La liste administrable est donc à créer avec la roadmap.
- À l'import, chaque nom de sprint du fichier (Acrux, Alcor, 1.15.0, « Sprint 64 - 2025 »…)
  doit correspondre à une valeur de cette liste ; une valeur inconnue est signalée, pas créée
  en silence.
