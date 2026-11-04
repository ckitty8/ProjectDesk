/* ============================================================
   Mon dashboard › Projet › Roadmap — saisie des demandes de la roadmap par les chefs de projet
   ------------------------------------------------------------
   Porteur, 2026-11-03 : « pour les chefs de projet, ils peuvent rajouter des lignes manuellement » ; maquette
   docs/maquettes/saisie-demandes-roadmap/ validée le 2026-11-04 (« Go »). Choix du projet (ceux que je gère : peutGererProjet, comme
   peut_gerer_projet en base, migration 057), demandes du projet classées par rang de traitement DSI (rang global, toutes demandes confondues),
   colonnes principales, fiche dans un panneau (FicheDemande). Les demandes sans projet ne sont proposées qu'aux administrateurs.
   ============================================================ */
import { useState } from 'react';
import { Bouton, BoutonIcone } from '../composants/Bouton';
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { CelluleDemande } from './roadmap/CelluleDemande';
import { FicheDemande } from './roadmap/FicheDemande';
import type { ChoixProjet } from './roadmap/FicheDemande';
import { supprimer } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { peutGererProjet } from '../domaine/droits';
import { CLES_RESUME_SAISIE, colonnesOrdonnees, demandesClassees, demandesDuProjet } from '../domaine/roadmap';
import type { DemandeRoadmap } from '../domaine/types';

const SANS_PROJET = '';
type Fiche = { demande?: DemandeRoadmap } | null;

export function MesDemandes() {
  const { ctx, donnees, executer } = useSession();
  const [choix, setChoix] = useState<string | null>(null);
  const [fiche, setFiche] = useState<Fiche>(null);
  if (!ctx || !donnees) return null;

  // Projets que je gère, nommés avec leur équipe (deux projets peuvent porter le même nom, ex. « CDO »)
  const nomEquipe = (id?: string | null) => donnees.equipes.find(e => e.id === id)?.nom;
  const projets: ChoixProjet[] = donnees.projets.filter(p => peutGererProjet(ctx, p))
    .map(p => ({ id: p.id, libelle: [p.nom, nomEquipe(p.equipeId)].filter(Boolean).join(' · ') }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle));
  const sansProjet = ctx.estAdmin;
  const projetId = choix ?? (sansProjet && !projets.length ? SANS_PROJET : projets[0]?.id ?? SANS_PROJET);

  const toutes = demandesClassees(donnees.demandesRoadmap, donnees.colonnesRoadmap);
  const lignes = demandesDuProjet(toutes, projetId || null);
  const ordre = colonnesOrdonnees(donnees.colonnesRoadmap);
  const colonnes = CLES_RESUME_SAISIE.map(cle => ordre.find(c => c.cle === cle)).filter(c => c !== undefined);

  function supprimerDemande(d: DemandeRoadmap) {
    if (window.confirm('Supprimer cette demande de la roadmap ?')) void executer(() => supprimer('demandes_roadmap', { id: 'eq.' + d.id }), 'demandesRoadmap');
  }

  if (!projets.length && !sansProjet) {
    return (
      <div className="ecran">
        <EnteteEcran titre="Roadmap" sousTitre="Demandes de vos projets · affichées dans Vue d’ensemble › Roadmap" />
        <Carte><Vide texte="Vous ne gérez aucun projet : pas de demande à saisir (réservé aux chefs de projet et aux responsables d’équipe)." /></Carte>
      </div>
    );
  }

  return (
    <div className="ecran ecran-large">
      <EnteteEcran titre="Roadmap" sousTitre="Demandes de vos projets · affichées dans Vue d’ensemble › Roadmap" />
      <Carte>
        <div className="carte-titre ligne-flex entre">
          <div className="ligne-flex">
            <h2>Demandes</h2>
            <select className="champ champ-compact" value={projetId} aria-label="Projet" onChange={e => setChoix(e.target.value)}>
              {sansProjet && <option value={SANS_PROJET}>Sans projet</option>}
              {projets.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
            </select>
            <span className="discret">{lignes.length} demande{lignes.length > 1 ? 's' : ''} · classées par rang de traitement DSI</span>
          </div>
          <Bouton variante="primaire" onClick={() => setFiche({})}>+ Nouvelle demande</Bouton>
        </div>
        {lignes.length === 0 ? <Vide texte="Aucune demande pour ce projet." /> : (
          <div className="defilement-x">
            <table className="tableau tableau-demandes">
              <thead><tr>{colonnes.map(c => <th key={c.id}>{c.libelle}</th>)}<th /></tr></thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l.demande.id}>
                    {colonnes.map(c => <td key={c.id} className={c.cle === 'demande' ? 'cellule-demande' : 'nowrap'}><CelluleDemande colonne={c} ligne={l} valeurs={donnees.valeurs} /></td>)}
                    <td className="nowrap">
                      <Bouton petit onClick={() => setFiche({ demande: l.demande })}>Modifier</Bouton>{' '}
                      <BoutonIcone icone="supprimer" titre="Supprimer la demande" onClick={() => supprimerDemande(l.demande)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="discret encart-compact">
          Le tableau montre les colonnes principales ; toutes les colonnes (réglées dans Administration › Roadmap) se saisissent dans la fiche.
        </div>
      </Carte>
      {fiche && (
        <FicheDemande demande={fiche.demande} projets={projets} sansProjet={sansProjet} projetInitial={projetId || null} onFermer={() => setFiche(null)} />
      )}
    </div>
  );
}
