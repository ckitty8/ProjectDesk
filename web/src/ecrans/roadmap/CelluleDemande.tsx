/* ============================================================
   Cellule du tableau des demandes de la Roadmap, selon le type de sa colonne (colonnes_roadmap, migration 056)
   Partagée par Vue d’ensemble › Roadmap (tableau complet) et Mon dashboard › Projet › Roadmap (liste de saisie).
   ============================================================ */
import { BadgeRef } from '../../composants/Badge';
import { formatAvecAnnee } from '../../domaine/dates';
import { scoreAffiche } from '../../domaine/roadmap';
import type { DemandeClassee } from '../../domaine/roadmap';
import type { ColonneRoadmap, ValeurReferentiel } from '../../domaine/types';

/** Contenu d'une cellule selon le type de sa colonne : rang et score calculés, libellé de liste en pastille, date, nombre ou texte */
export function CelluleDemande({ colonne, ligne, valeurs }: { colonne: ColonneRoadmap; ligne: DemandeClassee; valeurs: readonly ValeurReferentiel[] }) {
  if (colonne.type === 'calcul') {
    if (colonne.cle === 'rang') return <b>{ligne.rang}</b>;
    return ligne.score === null ? <span className="pale" title="Impacts ou complexité non saisis">complexité à saisir</span> : <>{scoreAffiche(ligne.score)}</>;
  }
  const valeur = ligne.demande.valeurs[colonne.id];
  if (valeur === null || valeur === undefined || valeur === '') return <span className="pale">—</span>;
  if (colonne.type === 'liste' && colonne.referentielId) return <BadgeRef valeurs={valeurs} referentielId={colonne.referentielId} libelle={valeur} />;
  if (colonne.format === 'date') return <>{formatAvecAnnee(valeur)}</>;
  if (colonne.format === 'nombre') return <>{valeur.replace('.', ',')}</>;
  return <>{valeur}</>;
}
