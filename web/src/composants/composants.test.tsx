import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Aide } from './Aide';
import { Avatar, Badge, BadgeActif, BadgeFeuille } from './Badge';
import { Barre } from './Barre';
import { BandeauSimulation } from './BandeauSimulation';
import { Bouton, BoutonIcone } from './Bouton';
import { Calendrier, NavigationMois } from './Calendrier';
import { EnteteEcran, Kpi, Vide } from './Carte';
import { Modale, Panneau } from './Fenetres';
import { Liste } from './Liste';
import { Onglets } from './Onglets';
import { Tableau } from './Tableau';
import { contexteMois } from '../domaine/calendrier';

const html = (element: React.ReactElement) => renderToStaticMarkup(element);

describe('badges et boutons', () => {
  it('échappe le texte venu de la base', () => {
    expect(html(<Badge texte={'<img src=x onerror=alert(1)>'} couleur="#003CC8" />)).toContain('&lt;img');
  });
  it('affiche le statut de feuille, « En saisie » si inconnu', () => {
    expect(html(<BadgeFeuille statut="validee" />)).toContain('Validée');
    expect(html(<BadgeFeuille statut="n_importe_quoi" />)).toContain('En saisie');
  });
  it('actif / inactif avec libellés personnalisables', () => {
    expect(html(<BadgeActif actif libelles={['Actif', 'Inactif']} />)).toContain('Actif');
    expect(html(<BadgeActif actif={false} />)).toContain('Inactive');
  });
  it('avatar : initiales', () => {
    expect(html(<Avatar nom="Camille Laurent" />)).toContain('>CL<');
  });
  it('un bouton ne soumet pas de formulaire par défaut ; le bouton-icône porte son titre', () => {
    expect(html(<Bouton>Ok</Bouton>)).toContain('type="button"');
    expect(html(<Bouton variante="primaire" petit>Ok</Bouton>)).toContain('class="btn primaire petit"');
    expect(html(<BoutonIcone icone="supprimer" titre="Supprimer" />)).toContain('aria-label="Supprimer"');
  });
});

describe('blocs de page', () => {
  it('borne la barre de progression entre 0 et 100', () => {
    expect(html(<Barre pct={150} />)).toContain('width:100%');
    expect(html(<Barre pct={-5} />)).toContain('width:0%');
  });
  it('KPI avec bulle d\'aide', () => {
    const h = html(<Kpi libelle="Projets" valeur={12} complement="actifs" aide="Projets non terminés" />);
    expect(h).toContain('12');
    expect(h).toContain('Projets non terminés');
  });
  it('en-tête d\'écran, message vide, bulle ⓘ', () => {
    expect(html(<EnteteEcran titre="Congés" sousTitre="Octobre" />)).toContain('<h1>Congés</h1>');
    expect(html(<Vide texte="Rien" />)).toContain('class="vide"');
    expect(html(<Aide texte="Aide" />)).toContain('role="note"');
  });
  it('onglets : l\'onglet actif est sélectionné, avec son compteur', () => {
    const h = html(<Onglets liste={[{ id: 'a', libelle: 'A', compte: 3 }, { id: 'b', libelle: 'B' }]} actif="a" onChoisir={() => undefined} />);
    expect(h).toContain('aria-selected="true"');
    expect(h).toContain('class="compte">3<');
  });
  it('liste déroulante : option choisie et option désactivée', () => {
    const h = html(<Liste valeur="b" onChoisir={() => undefined} options={['a', { valeur: 'b', libelle: 'B' }, { valeur: 'c', libelle: 'C', desactive: true }]} />);
    expect(h).toMatch(/<option value="b" selected/);
    expect(h).toContain('disabled');
  });
});

describe('tableau', () => {
  const colonnes = [{ cle: 'nom', titre: 'Nom', cellule: (l: { id: string; nom: string }) => l.nom }];
  it('affiche le message vide sans ligne', () => {
    expect(html(<Tableau colonnes={colonnes} lignes={[]} idLigne={l => l.id} videTexte="Aucune personne" />)).toContain('Aucune personne');
  });
  it('lignes cliquables et grisées', () => {
    const h = html(<Tableau colonnes={colonnes} lignes={[{ id: '1', nom: 'Léa' }]} idLigne={l => l.id} onOuvrir={() => undefined} inactive={() => true} />);
    expect(h).toContain('class="cliquable inactive"');
    expect(h).toContain('Léa');
  });
});

describe('fenêtres', () => {
  it('panneau et modale : dialogue titré, croix de fermeture, voile', () => {
    const p = html(<Panneau titre="Projet VISTA" onFermer={() => undefined} pied={<span>pied</span>}>corps</Panneau>);
    expect(p).toContain('role="dialog"');
    expect(p).toContain('class="panneau"');
    expect(p).toContain('aria-label="Fermer"');
    expect(p).toContain('class="voile"');
    expect(p).toContain('panneau-pied');
    expect(html(<Modale titre="Affectations" onFermer={() => undefined}>x</Modale>)).toContain('class="modale"');
    expect(html(<Modale titre="Sans pied" onFermer={() => undefined}>x</Modale>)).not.toContain('panneau-pied');
  });
  it('bandeau de simulation', () => {
    const h = html(<BandeauSimulation libelleRole="Projet" nomPersonne="Thomas" choix={[{ valeur: 'projet|1', libelle: 'Projet — Thomas' }]}
      onChanger={() => undefined} onArreter={() => undefined} />);
    expect(h).toContain('Simulation');
    expect(h).toContain('(Thomas)');
    expect(h).toContain('Revenir à mon rôle de créateur');
  });
});

describe('calendrier', () => {
  const ctx = (editable: boolean) => contexteMois(2026, 10, [{ jour: '2026-11-11', libelle: 'Armistice' }],
    [{ libelle: 'Congés payés', couleur: '#0F8A6B', abrege: 'CP', actif: true }],
    [{ ressourceId: 'r1', jour: '2026-11-03', type: 'Congés payés', duree: 0.5 }], editable);
  const lignes = [
    { genre: 'groupe' as const, id: 'g', contenu: 'Plateforme', niveau: 0 },
    { genre: 'personne' as const, ressource: { id: 'r1', nom: 'Léa Moreau', dateNaissance: null }, niveau: 1, modifiable: true }
  ];
  it('dessine un titre de groupe, une personne, les absences et le total', () => {
    const h = html(<Calendrier ctx={ctx(true)} lignes={lignes} onBasculer={() => undefined} />);
    expect(h).toContain('Plateforme');
    expect(h).toContain('Léa Moreau');
    expect(h).toContain('CP½');
    expect(h).toContain('>0,5 j<');
    expect(h).toContain('class="cliquable"');
  });
  it('en lecture : pas de total ni de case cliquable', () => {
    const h = html(<Calendrier ctx={ctx(false)} lignes={lignes} onBasculer={() => undefined} />);
    expect(h).not.toContain('class="cliquable"');
    expect(h).not.toContain(' j<');
  });
  it('navigation de mois', () => {
    const h = html(<NavigationMois annee={2026} mois={9} onChanger={() => undefined} />);
    expect(h).toContain('octobre 2026');
  });
});
