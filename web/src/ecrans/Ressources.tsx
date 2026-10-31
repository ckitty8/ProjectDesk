/* ============================================================
   Suivi de mes équipes › Gestion des ressources (maquette 03-gRess.png ; portage de app/js/ecrans/ressources.js — phase 5, vague B) — lecture
   Deux onglets (maquette ressources-onglets-naissance, porteur 2026-10-16) : « Calendrier » des absences (composant Calendrier partagé avec
   Mon dashboard › Congés) et « Liste des ressources » (annuaire filtrable).
   Calendrier : vue « Par équipe » (chaque personne une fois, étiquettes de projets, synthèse des absents par projet) ou « Par projet ».
   ============================================================ */
import { useState } from 'react';
import { Aide } from '../composants/Aide';
import { Avatar, BadgeActif, BadgeTon, Pastille } from '../composants/Badge';
import { Calendrier, NavigationMois } from '../composants/Calendrier';
import type { LigneCalendrier } from '../composants/Calendrier';
import { AucunOnglet, Carte, EnteteEcran, Vide } from '../composants/Carte';
import { Icone } from '../composants/Icone';
import { Liste } from '../composants/Liste';
import { Onglets } from '../composants/Onglets';
import { useSession } from '../donnees/SessionProvider';
import type { Donnees } from '../donnees/tables';
import { anniversairesDuMois } from '../domaine/calculs';
import { contexteMois } from '../domaine/calendrier';
import { COULEURS } from '../domaine/config';
import { teinte } from '../domaine/couleurs';
import { aujourdhui, depuisIso, formatAvecAnnee, formatCourt, nomMois } from '../domaine/dates';
import { ongletPermis } from '../domaine/droits';
import type { ContexteDroits } from '../domaine/droits';
import { valeursDe } from '../domaine/referentiels';
import { AIDES } from '../domaine/textes';
import type { Ressource } from '../domaine/types';
import { estInactive, modeleParEquipe, modeleParProjet, projetsAvecMembres, projetsPourAnnuaire, unitesRacines } from '../domaine/vues';
import type { ElementCalendrier } from '../domaine/vues';

const MAX_ETIQUETTES = 3;

/** Projets d'une personne en étiquettes (vue « Par équipe ») : 3 au plus, puis « +N » ; liste complète en infobulle */
function Etiquettes({ noms }: { noms: readonly string[] }) {
  return (
    <>
      {noms.slice(0, MAX_ETIQUETTES).map(n => <span key={n} className="etiquette" title={n}>{n}</span>)}
      {noms.length > MAX_ETIQUETTES && <span className="etiquette" title={noms.slice(MAX_ETIQUETTES).join(', ')}>+{noms.length - MAX_ETIQUETTES}</span>}
    </>
  );
}

/** Éléments du modèle (domaine/vues.ts) → lignes du composant Calendrier */
function lignesCalendrier(elements: readonly ElementCalendrier[]): LigneCalendrier[] {
  return elements.map((el, i): LigneCalendrier => {
    switch (el.genre) {
      case 'unite':
        return { genre: 'groupe', id: 'u' + el.equipe.id, niveau: el.niveau, contenu: (
          <><Icone nom={el.equipe.type === 'direction' ? 'direction' : 'equipe'} taille={14} /><Pastille couleur={el.equipe.couleur ?? COULEURS.pale} />{el.equipe.nom}</>
        ) };
      case 'intertitre':
        return { genre: 'groupe', id: 'i' + i, niveau: el.niveau, secondaire: true, contenu: <>Projets — absents / membres par jour <Aide texte={AIDES.syntheseProjets} /></> };
      case 'projet':
        return { genre: 'groupe', id: 'p' + el.projet.id, niveau: el.niveau, contenu: (
          <><Icone nom="projet" taille={14} />{el.projet.nom} <span className="discret poids-normal">{el.nbMembres} membres</span></>
        ) };
      case 'synthese':
        return { genre: 'synthese', id: 's' + el.projet.id, niveau: el.niveau, ids: el.ids, contenu: <><Icone nom="projet" taille={14} />{el.projet.nom}</> };
      case 'personne':
        return { genre: 'personne', ressource: el.ressource, niveau: el.niveau, complement: (
          <>{el.responsable && <span className="discret texte-11">responsable</span>}<Etiquettes noms={el.projets} /></>
        ) };
    }
  });
}

/** Onglet Calendrier : le composant Calendrier partagé, en lecture */
function OngletCalendrier({ ctx, donnees }: { ctx: ContexteDroits; donnees: Donnees }) {
  const j = depuisIso(aujourdhui());
  const [mois, setMois] = useState({ annee: j.getFullYear(), mois: j.getMonth() });
  const [vue, setVue] = useState<'equipe' | 'projet'>('equipe');
  const [projetId, setProjetId] = useState<string | null>(null);
  const types = valeursDe(donnees.valeurs, 'abs', true);
  const mc = contexteMois(mois.annee, mois.mois, donnees.joursFeries, types, donnees.absences, false);
  const debut = mc.jours[0] ?? aujourdhui(), fin = mc.jours[mc.jours.length - 1] ?? debut;
  const proposes = projetsAvecMembres(donnees);
  const projet = proposes.find(p => p.id === projetId) ?? proposes[0];
  const elements = vue === 'projet'
    ? (projet ? modeleParProjet(donnees, debut, fin, projet) : [])
    : unitesRacines(donnees.equipes).flatMap(e => modeleParEquipe(ctx, donnees, debut, fin, e));
  const naissance = donnees.ressources.some(r => 'dateNaissance' in r);
  return (
    <Carte>
      <div className="carte-titre">
        <div className="ligne-flex">
          <NavigationMois annee={mois.annee} mois={mois.mois} onChanger={(annee, m) => setMois({ annee, mois: m })} />
          <div className="ligne-flex" style={{ marginLeft: 14 }}>
            <div className="puces">
              <button type="button" className={'puce' + (vue === 'equipe' ? ' active' : '')} onClick={() => setVue('equipe')}>Par équipe</button>
              <button type="button" className={'puce' + (vue === 'projet' ? ' active' : '')} onClick={() => setVue('projet')}>Par projet</button>
            </div>
            {vue === 'projet' && (
              <Liste className="champ champ-compact" aria-label="Projet" valeur={projet?.id} onChoisir={setProjetId} options={proposes.map(p => ({ valeur: p.id, libelle: p.nom }))} />
            )}
          </div>
        </div>
        <div className="ligne-flex discret legende-calendrier">
          {valeursDe(donnees.valeurs, 'abs').map(t => (
            <span key={t.libelle} className="ligne-flex">
              <span className="pastille" style={{ background: teinte(t.couleur, 0.2), border: `1px solid ${t.couleur}` }} />{t.libelle}
            </span>
          ))}
          <span className="ligne-flex"><span className="pastille pastille-ferie" />Férié / week-end</span>
          {naissance && <span className="ligne-flex">🎂 Anniversaire</span>}
        </div>
      </div>
      {elements.length === 0 ? <Vide texte="Aucune ressource." /> : <Calendrier ctx={mc} lignes={lignesCalendrier(elements)} />}
    </Carte>
  );
}

/** Rappel « Anniversaires d'<mois> » : personnes nées le mois en cours (jour et mois seulement) */
function RappelAnniversaires({ ressources }: { ressources: readonly Ressource[] }) {
  const mois = depuisIso(aujourdhui()).getMonth();
  const liste = anniversairesDuMois(ressources.filter(r => !estInactive(r)), mois);
  const libelle = nomMois(mois), elision = ['a', 'o'].includes(libelle.charAt(0));   // « d’avril, d’août, d’octobre »
  return (
    <span className="discret">
      🎂 Anniversaires {elision ? 'd’' : 'de '}{libelle} : {liste.length === 0 ? 'aucun' : liste.map((r, i) => (
        <span key={r.id}>{i > 0 && ', '}<b>{r.nom}</b> ({formatCourt(r.dateNaissance)})</span>
      ))}
    </span>
  );
}

/** Onglet Liste des ressources : filtres + annuaire de toutes les fiches (les autres écrans suivent la présence) */
function OngletListe({ ctx, donnees }: { ctx: ContexteDroits; donnees: Donnees }) {
  const [equipeId, setEquipeId] = useState('');
  const [statut, setStatut] = useState('');
  const [q, setQ] = useState('');
  const naissance = donnees.ressources.some(r => 'dateNaissance' in r);
  const mois = depuisIso(aujourdhui()).getMonth();
  // Les filtres Équipe et Statut retirent des fiches ; la recherche par nom filtre ensuite les lignes affichées
  const fiches = donnees.ressources.filter(r => (!equipeId || r.equipeId === equipeId) && (!statut || (statut === 'inactif') === estInactive(r)))
    .sort((a, b) => Number(estInactive(a)) - Number(estInactive(b)) || a.nom.localeCompare(b.nom));
  const recherche = q.trim().toLowerCase();
  const affichees = fiches.filter(r => !recherche || r.nom.toLowerCase().includes(recherche));
  const colonnes = naissance ? 6 : 5;
  return (
    <>
      <Carte>
        <div className="ligne-flex" style={{ gap: 10, flexWrap: 'wrap' }}>
          <label className="recherche-champ" style={{ width: 260 }}>
            <Icone nom="recherche" /><input placeholder="Rechercher une personne" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <Liste className="champ champ-compact" aria-label="Équipe" valeur={equipeId} onChoisir={setEquipeId}
            options={[{ valeur: '', libelle: 'Toutes les équipes' }, ...donnees.equipes.map(e => ({ valeur: e.id, libelle: e.nom }))]} />
          <Liste className="champ champ-compact" aria-label="Statut" valeur={statut} onChoisir={setStatut}
            options={[{ valeur: '', libelle: 'Actifs et inactifs' }, { valeur: 'actif', libelle: 'Actifs' }, { valeur: 'inactif', libelle: 'Inactifs' }]} />
          <span className="extensible" />
          {naissance && <RappelAnniversaires ressources={donnees.ressources} />}
        </div>
      </Carte>
      <Carte>
        <div className="carte-titre">
          <h2>Liste des ressources</h2>
          <span className="discret">{fiches.length} personnes · {fiches.filter(estInactive).length} inactive(s)</span>
        </div>
        <table className="tableau" id="annuaire-ressources">
          <thead>
            <tr><th>Nom</th><th>Équipe</th><th>Poste</th><th>Projets</th><th>Statut</th>{naissance && <th>Anniversaire</th>}</tr>
          </thead>
          <tbody>
            {affichees.length === 0 && <tr><td colSpan={colonnes}><Vide texte="Aucune ressource." /></td></tr>}
            {affichees.map(r => {
              const equipe = donnees.equipes.find(e => e.id === r.equipeId), inactif = estInactive(r);
              const projets = projetsPourAnnuaire(ctx, donnees, r);
              return (
                <tr key={r.id} style={inactif ? { color: 'var(--discret)' } : undefined}>
                  <td><span className="ligne-flex"><Avatar nom={r.nom} />{r.nom}</span></td>
                  <td><span className="ligne-flex"><Pastille couleur={equipe?.couleur ?? COULEURS.pale} />{equipe?.nom ?? '—'}</span></td>
                  <td>{r.poste || '—'}</td>
                  <td className="projets-personne">
                    {projets.genre === 'projets' && projets.lignes.map(l => <div key={l}>{l}</div>)}
                    {projets.genre === 'responsable' && <BadgeTon texte="Responsable d’équipe" ton="violet" />}
                    {projets.genre === 'aucun' && <span className="pale">hors projet</span>}
                  </td>
                  <td>
                    <BadgeActif actif={!inactif} libelles={['Actif', 'Inactif']} />
                    {inactif && <> <span className="discret texte-11">fin le {formatAvecAnnee(r.dateDepart)}</span></>}
                  </td>
                  {naissance && (
                    <td>
                      {r.dateNaissance
                        ? <>{formatCourt(r.dateNaissance)}{depuisIso(r.dateNaissance).getMonth() === mois ? ' 🎂' : ''}</>
                        : <span className="pale">—</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Carte>
    </>
  );
}

export function Ressources() {
  const { ctx, donnees } = useSession();
  const [choix, setChoix] = useState('calendrier');
  if (!ctx || !donnees) return null;
  // Onglets selon leur droit (matrice, migration 038)
  const liste = [{ id: 'calendrier', libelle: 'Calendrier' }, { id: 'liste', libelle: 'Liste des ressources' }].filter(o => ongletPermis(ctx, 'ressources', o.id));
  const onglet = (liste.find(o => o.id === choix) ?? liste[0])?.id;
  return (
    <div className="ecran">
      <EnteteEcran titre="Gestion des ressources" sousTitre="Calendrier des absences et annuaire des ressources · lecture seule" />
      {!onglet
        ? <AucunOnglet />
        : (
          <>
            <Onglets liste={liste} actif={onglet} onChoisir={setChoix} />
            {onglet === 'liste' ? <OngletListe ctx={ctx} donnees={donnees} /> : <OngletCalendrier ctx={ctx} donnees={donnees} />}
          </>
        )}
    </div>
  );
}
