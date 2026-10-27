/* ============================================================
   Mon dashboard › Trucs et astuces (portage de app/js/ecrans/astuces.js — phase 5, vague A)
   Menu à part (demande du porteur 2026-10-05). Trois thèmes (maquettes docs/maquettes/astuces-agile-roadmap/, 2026-10-12) :
   - Agile : KPI Scrum et Kanban (textes KPI_AGILE), avec un exemple chiffré par KPI calculé sur un projet choisi (CDO par défaut) ;
     Rôles Scrum : organigramme et « qui fait quoi » (maquette docs/maquettes/organigramme-scrum/) ;
   - Roadmap : fiche pratique (vision → sprint, formats, méthode du projet, bonnes pratiques) ;
   - Test & Learn : méthode des projets IA (2026-10-15).
   Lecture seule : aucune donnée n'est modifiée sur cet écran. Un droit par thème (matrice, migration 038).
   ============================================================ */
import { useState } from 'react';
import { FicheRoadmap, FicheTestLearn } from './astuces/Fiches';
import { Organigramme } from './astuces/Organigramme';
import { Carte, AucunOnglet, EnteteEcran, Vide } from '../composants/Carte';
import { Liste } from '../composants/Liste';
import { TexteGras } from '../composants/TexteGras';
import { useSession } from '../donnees/SessionProvider';
import { COULEURS } from '../domaine/config';
import { ongletPermis } from '../domaine/droits';
import { exemplesKpi } from '../domaine/exemplesKpi';
import { aujourdhui } from '../domaine/dates';
import { KPI_AGILE } from '../domaine/textes';

// Thèmes (gros boutons du haut) : clé, libellé, ce qu'il contient, couleur et symbole de l'icône
const THEMES = [
  { cle: 'agile', libelle: 'Agile', detail: 'KPI Scrum et Kanban · Rôles Scrum', couleur: COULEURS.succes, symbole: '↻' },
  { cle: 'roadmap', libelle: 'Roadmap', detail: 'Construire et faire vivre une roadmap', couleur: COULEURS.violet, symbole: '➜' },
  { cle: 'testLearn', libelle: 'Test & Learn', detail: 'La méthode des projets IA', couleur: COULEURS.orange, symbole: '⚗' }
] as const;

/** KPI Agile (Scrum, Kanban) avec exemples chiffrés sur le projet choisi */
function KpiAgile() {
  const { donnees } = useSession();
  const [projetId, setProjetId] = useState<string | null>(null);
  if (!donnees) return null;
  const projets = donnees.projets.filter(p => donnees.affectations.some(a => a.projetId === p.id));
  const choisi = projets.find(p => p.id === projetId) ?? projets.find(p => p.nom === 'CDO') ?? projets[0];
  if (!choisi) return <Carte><Vide texte="Aucun projet avec des membres : les exemples ont besoin d’un projet." /></Carte>;
  const feries = new Set(donnees.joursFeries.map(j => j.jour));
  const exemples = exemplesKpi(choisi, donnees.ressources, donnees.affectations, donnees.absences, feries, aujourdhui());
  return (
    <>
      <Carte classe="encart-moyen">
        <div className="ligne-flex entre">
          <div>
            <b>KPI Agile — Scrum et Kanban</b>
            <div className="discret texte-12-5">
              Les exemples sont calculés sur le projet choisi. <span className="badge-reel">réel</span> = données du projet ;{' '}
              <span className="badge-illustratif">illustratif</span> = exemple à défaut de données suivies dans l’application.
            </div>
          </div>
          <div className="ligne-flex">
            <span className="discret">Projet d’exemple</span>
            <Liste className="champ largeur-auto" aria-label="Projet d’exemple" valeur={choisi.id} onChoisir={setProjetId}
              options={projets.map(p => ({ valeur: p.id, libelle: p.nom }))} />
          </div>
        </div>
      </Carte>
      {KPI_AGILE.map(section => (
        <Carte key={section.titre}>
          <div className="carte-titre"><h2>{section.titre}</h2></div>
          <table className="tableau tableau-kpi">
            <thead><tr><th>Indicateur</th><th>Définition / formule</th><th>Comment le lire</th><th>Exemple · {choisi.nom}</th></tr></thead>
            <tbody>
              {section.kpi.map(([cle, nom, definition, lecture]) => (
                <tr key={cle}>
                  <td><b>{nom}</b></td><td>{definition}</td><td className="discret">{lecture}</td>
                  <td>
                    {(exemples[cle] ?? []).map((e, i) => (
                      <div key={i}>
                        <span className={e.nature === 'reel' ? 'badge-reel' : 'badge-illustratif'}>{e.nature === 'reel' ? 'réel' : 'illustratif'}</span>{' '}
                        <TexteGras texte={e.texte} />
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Carte>
      ))}
    </>
  );
}

export function Astuces() {
  const { ctx } = useSession();
  const [choix, setChoix] = useState<string>('agile');
  const [onglet, setOnglet] = useState<'kpi' | 'roles'>('kpi');
  if (!ctx) return null;
  // Thèmes selon leur droit : le thème choisi s'il est permis, sinon le premier permis
  const permis = THEMES.filter(t => ongletPermis(ctx, 'astuces', t.cle));
  const theme = (permis.find(t => t.cle === choix) ?? permis[0])?.cle;
  const puce = (cle: 'kpi' | 'roles', libelle: string) => (
    <button type="button" className={'puce' + (onglet === cle ? ' active' : '')} onClick={() => setOnglet(cle)}>{libelle}</button>
  );
  return (
    <div className="ecran ecran-large">
      <EnteteEcran titre="Trucs et astuces" sousTitre="Fiches pratiques : agilité (KPI, rôles Scrum), roadmap et Test & Learn (projets IA)" />
      <div className="themes">
        {permis.map(t => (
          <button key={t.cle} type="button" className={'theme' + (theme === t.cle ? ' actif' : '')} onClick={() => setChoix(t.cle)}>
            <span className="theme-icone" style={{ background: t.couleur }}>{t.symbole}</span>
            <span><b>{t.libelle}</b><div className="discret">{t.detail}</div></span>
          </button>
        ))}
      </div>
      {!theme && <AucunOnglet />}
      {theme === 'roadmap' && <FicheRoadmap />}
      {theme === 'testLearn' && <FicheTestLearn />}
      {theme === 'agile' && (
        <>
          <div className="puces">{puce('kpi', 'KPI Agile')}{puce('roles', 'Rôles Scrum (organigramme)')}</div>
          {onglet === 'roles' ? <Organigramme /> : <KpiAgile />}
        </>
      )}
    </div>
  );
}
