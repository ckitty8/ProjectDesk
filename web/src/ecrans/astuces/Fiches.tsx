/* ============================================================
   Trucs et astuces › fiches Roadmap et Test & Learn (portage de app/js/ecrans/astuces.js — phase 5, vague A)
   Textes : domaine/textes.ts (ROADMAP_ASTUCES, TEST_AND_LEARN). Lecture seule.
   ============================================================ */
import type { ReactNode } from 'react';
import { Carte } from '../../composants/Carte';
import { CONFIG, TONS } from '../../domaine/config';
import { ROADMAP_ASTUCES as R, TEST_AND_LEARN as T } from '../../domaine/textes';

const TitreCarte = ({ titre, detail }: { titre: string; detail?: string }) => (
  <div className="carte-titre"><h2>{titre}</h2>{detail && <span className="discret">{detail}</span>}</div>
);

/** Étapes reliées par des flèches : [étape, explication, couleur] (fiches Roadmap et Test & Learn) */
function Chaine({ etapes }: { etapes: readonly (readonly [string, string, string])[] }) {
  return (
    <div className="chaine">
      {etapes.map(([etape, detail, couleur], i) => (
        <span key={etape} style={{ display: 'contents' }}>
          {i > 0 && <div className="chaine-fleche">→</div>}
          <div className="chaine-etape" style={{ borderTopColor: couleur }}><b>{etape}</b><div className="discret">{detail}</div></div>
        </span>
      ))}
    </div>
  );
}

/** Carte de conseils : titre coloré et liste à puces (bonnes pratiques, pièges, rituels) */
function ListeConseils({ titre, couleur, lignes }: { titre: string; couleur: string; lignes: readonly string[] }) {
  return (
    <Carte>
      <div className="carte-titre"><h2 style={{ color: couleur }}>{titre}</h2></div>
      <ul className="liste-conseils">{lignes.map(l => <li key={l}>{l}</li>)}</ul>
    </Carte>
  );
}

function Tableau({ entetes, lignes }: { entetes: readonly string[]; lignes: readonly (readonly string[])[] }) {
  return (
    <div className="defilement-x">
      <table className="tableau">
        <thead><tr>{entetes.map(e => <th key={e}>{e}</th>)}</tr></thead>
        <tbody>
          {lignes.map(([premiere, ...autres]) => (
            <tr key={premiere}><td><b>{premiere}</b></td>{autres.map((c, i) => <td key={i}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Definition = ({ definition, precision }: { definition: string; precision: string }) => (
  <Carte classe="encart-moyen"><b>{definition}</b><div className="discret texte-12-5">{precision}</div></Carte>
);

const DansLApplication = ({ children }: { children: ReactNode }) => (
  <Carte classe="encart-compact"><b>Dans {CONFIG.NOM_APPLICATION}</b> : {children}</Carte>
);

/** Roadmap : fiche pratique (vision → sprint, formats, méthode du projet, bonnes pratiques) */
export function FicheRoadmap() {
  return (
    <>
      <Definition definition={R.definition} precision={R.precision} />
      <Carte><TitreCarte titre="De la vision au sprint" /><Chaine etapes={R.chaine} /></Carte>
      <div className="grille-formats">
        {R.formats.map(f => (
          <Carte key={f.titre}>
            <b style={{ color: f.couleur }}>{f.titre}</b><div className="discret">{f.sousTitre}</div>
            <div className="format-exemples">
              {f.exemples.map(([titre, detail], i) => <div key={titre} style={{ background: f.fond[i] }}><b>{titre}</b><br />{detail}</div>)}
            </div>
            <div><b>Quand :</b> {f.quand}</div>
          </Carte>
        ))}
      </div>
      <Carte>
        <TitreCarte titre="Selon la méthode du projet" detail="méthode choisie à la création du projet" />
        <Tableau entetes={['Méthode', 'Format conseillé', 'Unité de planification', 'Revue de la roadmap']} lignes={R.methodes} />
      </Carte>
      <div className="grille-conseils">
        <ListeConseils titre="✔ Bonnes pratiques" couleur={TONS.succes.texte} lignes={R.bonnesPratiques} />
        <ListeConseils titre="✕ Pièges à éviter" couleur="var(--danger)" lignes={R.pieges} />
      </div>
      <DansLApplication>la roadmap se construit dans <b>Projets et Roadmap</b> (Gantt), la méthode du projet se choisit à sa création.</DansLApplication>
    </>
  );
}

/** Test & Learn : méthode des projets IA (boucle hypothèse → décision, carte d'expérience, phases, indicateurs) */
export function FicheTestLearn() {
  return (
    <>
      <Definition definition={T.definition} precision={T.precision} />
      <Carte><TitreCarte titre="La boucle Test & Learn" detail="on recommence avec l’hypothèse suivante ↺" /><Chaine etapes={T.boucle} /></Carte>
      <Carte>
        <TitreCarte titre="Carte d’expérience" detail="à remplir pour chaque test · exemple : Chatbot CDO" />
        <Tableau entetes={['Rubrique', 'À remplir', 'Exemple']} lignes={T.carte} />
      </Carte>
      <Carte>
        <TitreCarte titre="Les phases d’un projet IA" detail="on ne passe à la suivante que si le critère est atteint" />
        <Tableau entetes={['Phase', 'Objectif', 'Durée indicative', 'Critère de passage (go / no-go)']} lignes={T.phases} />
      </Carte>
      <Carte><TitreCarte titre="Ce que l’on mesure sur un projet IA" /><Tableau entetes={['Indicateur', 'Définition', 'Exemple']} lignes={T.indicateurs} /></Carte>
      <div className="grille-conseils">
        <ListeConseils titre="↻ Rituels" couleur="var(--primaire)" lignes={T.rituels} />
        <ListeConseils titre="✔ Bonnes pratiques" couleur={TONS.succes.texte} lignes={T.bonnesPratiques} />
      </div>
      <div className="grille-conseils">
        <ListeConseils titre="✕ Pièges à éviter" couleur="var(--danger)" lignes={T.pieges} />
        <DansLApplication>
          notez chaque expérience et sa décision dans le <b>Daily</b> du projet IA (les blocages remontent dans Daily des équipes),
          planifiez les phases dans <b>Projets et Roadmap</b> (format Now / Next / Later) et fixez une boîte de temps pour chaque expérience.
        </DansLApplication>
      </div>
    </>
  );
}
