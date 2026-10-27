/* ============================================================
   Calendrier mensuel personnes × jours (portage de Calendrier de app/js/ecrans/ressources.js — phase 4 de la migration)
   ------------------------------------------------------------
   Partagé par Mon dashboard › Congés (éditable) et Gestion des ressources (lecture). Les règles d'affichage sont dans
   domaine/calendrier.ts ; ce composant dessine le résultat. Il ne lit aucune donnée : l'écran lui passe le mois, les lignes
   (titres de groupe et personnes) et le contexte du mois.
   ============================================================ */
import type { ReactNode } from 'react';
import { Avatar } from './Badge';
import { Bouton } from './Bouton';
import { abregeAbsence, caseJour, totalAbsences } from '../domaine/calendrier';
import type { CaseJour, ContexteMois } from '../domaine/calendrier';
import { aujourdhui, depuisIso, JOURS_INITIALES, libelleMois, nombre } from '../domaine/dates';
import { teinte } from '../domaine/couleurs';
import type { Ressource } from '../domaine/types';

/** Ligne du calendrier : titre de groupe (unité, projet) ou personne ; « niveau » = retrait */
export type LigneCalendrier =
  | { genre: 'groupe'; id: string; contenu: ReactNode; niveau: number; secondaire?: boolean }
  | { genre: 'personne'; ressource: Pick<Ressource, 'id' | 'nom' | 'dateNaissance'>; niveau: number; complement?: ReactNode;
      /** Case modifiable par la personne connectée (droit de la matrice) */
      modifiable?: boolean };

/* ---------- Navigation de mois : [Aujourd'hui] ‹ octobre 2026 › ---------- */
export function NavigationMois({ annee, mois, onChanger }: { annee: number; mois: number; onChanger: (annee: number, mois: number) => void }) {
  const aller = (decalage: number) => { const d = new Date(annee, mois + decalage, 1); onChanger(d.getFullYear(), d.getMonth()); };
  const maintenant = depuisIso(aujourdhui());
  return (
    <div className="ligne-flex">
      <Bouton onClick={() => onChanger(maintenant.getFullYear(), maintenant.getMonth())}>Aujourd’hui</Bouton>
      <Bouton aria-label="Mois précédent" onClick={() => aller(-1)}>‹</Bouton>
      <b style={{ minWidth: 130, textAlign: 'center' }}>{libelleMois(annee, mois)}</b>
      <Bouton aria-label="Mois suivant" onClick={() => aller(1)}>›</Bouton>
    </div>
  );
}

/* ---------- Contenu d'une case ---------- */

/** Pastille colorée d'une absence ou d'un jour férié ; « F » gris si le type « Jours férié » est désactivé */
function ContenuCase({ c }: { c: CaseJour }) {
  if (c.ferie) {
    const t = c.ferie.type;
    return t
      ? <span className="case-absence" title={c.ferie.libelle} style={{ color: t.couleur, background: teinte(t.couleur, 0.16) }}>{t.abrege || 'JF'}</span>
      : <span title={c.ferie.libelle}>F</span>;
  }
  if (c.absence) {
    const { type, demi } = c.absence;
    return (
      <span className="case-absence" title={type.libelle + (demi ? ' (demi-journée)' : '')} style={{ color: type.couleur, background: teinte(type.couleur, 0.16) }}>
        {abregeAbsence(type, demi)}
      </span>
    );
  }
  return c.anniversaire ? <span className="anniversaire" title="Anniversaire">🎂</span> : null;
}

interface PropsCalendrier {
  ctx: ContexteMois;
  lignes: readonly LigneCalendrier[];
  /** Clic sur la case d'un jour ouvré modifiable (poser / retirer une absence) */
  onBasculer?: (ressourceId: string, jour: string) => void;
}

export function Calendrier({ ctx, lignes, onBasculer }: PropsCalendrier) {
  const aujourd = aujourdhui();
  return (
    <div className="calendrier">
      <table>
        <thead>
          <tr>
            <th className="nom" scope="col">Personne</th>
            {ctx.jours.map(j => {
              const ferme = caseJour(ctx, { id: '', dateNaissance: null }, j).ferme;
              return (
                <th key={j} scope="col" className={`${ferme ? 'ferme' : ''} ${j === aujourd ? 'aujourdhui' : ''}`.trim()}>
                  {JOURS_INITIALES[depuisIso(j).getDay()]}<br />{depuisIso(j).getDate()}
                </th>
              );
            })}
            {ctx.editable && <th scope="col">Total</th>}
          </tr>
        </thead>
        <tbody>
          {lignes.map(ligne => ligne.genre === 'groupe'
            ? (
              <tr key={ligne.id} className="groupe">
                <td colSpan={ctx.jours.length + (ctx.editable ? 2 : 1)}>
                  <span className="ligne-flex" style={{ paddingLeft: ligne.niveau * 16, ...(ligne.secondaire ? { fontWeight: 500, color: 'var(--discret)' } : {}) }}>
                    {ligne.contenu}
                  </span>
                </td>
              </tr>
            )
            : (
              <tr key={ligne.ressource.id} data-personne={ligne.ressource.id}>
                <td className="nom">
                  <span className="ligne-flex" style={{ paddingLeft: ligne.niveau * 16 }}>
                    <Avatar nom={ligne.ressource.nom} />
                    <span><span>{ligne.ressource.nom}</span>{ligne.complement && <span className="nom-complement">{ligne.complement}</span>}</span>
                  </span>
                </td>
                {ctx.jours.map(j => {
                  const c = caseJour(ctx, ligne.ressource, j);
                  if (c.ferme) return <td key={j} className="ferme"><ContenuCase c={c} /></td>;
                  if (ctx.editable && ligne.modifiable && onBasculer) {
                    return (
                      <td key={j} className="cliquable" tabIndex={0} onClick={() => onBasculer(ligne.ressource.id, j)}
                        onKeyDown={e => { if (e.key === 'Enter') onBasculer(ligne.ressource.id, j); }}>
                        <ContenuCase c={c} />
                      </td>
                    );
                  }
                  return <td key={j}><ContenuCase c={c} /></td>;
                })}
                {ctx.editable && <td className="num" style={{ padding: '0 10px', whiteSpace: 'nowrap' }}>{nombre(totalAbsences(ctx, ligne.ressource))} j</td>}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
