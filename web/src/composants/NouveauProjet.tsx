/* ============================================================
   Panneau « Nouveau projet » (portage de Panneau.nouveauProjet de app/js/panneau-projet.js — phase 5, vague C)
   ------------------------------------------------------------
   Formulaire de création ; équipe pré-remplie (celle de l'écran d'origine, sinon l'équipe ouverte). Champs réduits à la demande du porteur
   (2026-09-25) : code, nom, description, chef ; + méthode obligatoire (2026-10-08 : Agile Scrum, Agile Kanban, Cascade, Cycle en V, Test & Learn).
   Dates et statut restent vides / par défaut (« Planifié », valeur SQL par défaut). Le chef est affecté au projet avec le rôle « Chef de projet ».
   ============================================================ */
import type { FormEvent } from 'react';
import { Bouton } from './Bouton';
import { Pastille } from './Badge';
import { Cadre } from './Fenetres';
import { creer } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { prochainCodeProjet } from '../domaine/calculs';
import { DESCRIPTIONS_METHODES, ROLES_PROJET } from '../domaine/config';
import { aujourdhui } from '../domaine/dates';
import { maRessource } from '../domaine/droits';
import { valeursDe } from '../domaine/referentiels';
import { personnesProposees } from '../domaine/vues';

export function NouveauProjet({ equipeId, onFermer, onCree }: { equipeId: string | null; onFermer: () => void; onCree: (projetId: string) => void }) {
  const { ctx, donnees, equipeCourante, executer, notifier } = useSession();
  if (!ctx || !donnees) return null;
  const eqId = equipeId ?? equipeCourante ?? donnees.equipes[0]?.id ?? '';
  const equipe = donnees.equipes.find(e => e.id === eqId);
  const moi = maRessource(ctx);

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    let creeId = '';
    const reussi = await executer(async () => {
      const [cree] = await creer('projets', { code: f.code, nom: f.nom, description: f.description, chefId: f.chefId, methode: f.methode, equipeId: eqId });
      creeId = String(cree?.id ?? '');
      if (f.chefId) await creer('affectations', { projetId: creeId, ressourceId: f.chefId, role: ROLES_PROJET.CHEF });
    }, 'projets', 'affectations');
    if (reussi && creeId) { notifier('Projet créé'); onCree(creeId); }
  }

  return (
    <Cadre classe="panneau" titre="Nouveau projet" onFermer={onFermer}
      surtitre={equipe && <div className="ligne-flex discret"><Pastille couleur={equipe.couleur ?? '#8A93A3'} />{equipe.nom}</div>}
      pied={<><Bouton onClick={onFermer}>Annuler</Bouton><Bouton variante="primaire" type="submit" form="nouveau-projet">Créer le projet</Bouton></>}>
      <form id="nouveau-projet" className="pile" onSubmit={e => void envoyer(e)}>
        <div><label className="libelle">Code<input className="champ" name="code" defaultValue={prochainCodeProjet(equipe?.prefixe ?? '??', donnees.projets)} required /></label></div>
        <div><label className="libelle">Nom<input className="champ" name="nom" required /></label></div>
        <div><label className="libelle">Description<textarea className="champ" name="description" rows={3} /></label></div>
        <div>
          <label className="libelle">Chef de projet
            <select className="champ" name="chefId" defaultValue={moi && moi.equipeId === eqId ? moi.id : ''}>
              {[{ valeur: '', libelle: '—' }, ...personnesProposees(donnees, eqId, aujourdhui())].map(o => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
            </select>
          </label>
        </div>
        <div>
          <div className="libelle">Méthode de gestion du projet</div>
          <div className="choix-methodes">
            {valeursDe(donnees.valeurs, 'methode').map(v => (
              <label key={v.libelle} className="choix-methode" style={{ borderLeftColor: v.couleur }}>
                <input type="radio" name="methode" value={v.libelle} required />
                <span><b>{v.libelle}</b><span className="discret">{DESCRIPTIONS_METHODES[v.cle ?? ''] ?? ''}</span></span>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Cadre>
  );
}
