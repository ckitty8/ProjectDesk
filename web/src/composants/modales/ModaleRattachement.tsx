/* ============================================================
   Fenêtre « Ajouter une personne existante à <équipe> » (maquette membres-equipe/ ; portage de Modale.rattachement de app/js/modale.js
   — phase 5, vague D)
   Toutes les personnes actives des autres équipes, sauf celles déjà rattachées. Elles gardent leur équipe d'origine : le rattachement
   (membres_equipe, migration 033) ne change ni leur fiche, ni leurs droits.
   ============================================================ */
import type { FormEvent } from 'react';
import { Bouton } from '../Bouton';
import { Cadre } from '../Fenetres';
import { creer } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { aujourdhui } from '../../domaine/dates';
import { rattachesA } from '../../domaine/annuaire';
import { personnesProposees } from '../../domaine/vues';

export function ModaleRattachement({ equipeId, onFermer }: { equipeId: string; onFermer: () => void }) {
  const { ctx, donnees, executer } = useSession();
  if (!ctx || !donnees) return null;
  const equipe = donnees.equipes.find(e => e.id === equipeId);
  const dejaLa = new Set(rattachesA(ctx, equipeId).map(x => x.r.id));
  const personnes = personnesProposees(donnees, equipeId, aujourdhui())
    .filter(p => donnees.ressources.find(r => r.id === p.valeur)?.equipeId !== equipeId && !dejaLa.has(p.valeur));

  async function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ressourceId = String(new FormData(e.currentTarget).get('ressource'));
    if (await executer(() => creer('membres_equipe', { equipeId, ressourceId }), 'rattachements')) onFermer();
  }

  return (
    <Cadre classe="modale" titre={`Ajouter une personne existante à ${equipe?.nom ?? ''}`} onFermer={onFermer}
      pied={<><Bouton onClick={onFermer}>Annuler</Bouton><Bouton variante="primaire" type="submit" form="rattachement">Ajouter à l’équipe</Bouton></>}>
      <form id="rattachement" onSubmit={e => void enregistrer(e)}>
        <label className="libelle">Personne (toutes les personnes de l’application)
          <select className="champ" name="ressource" required defaultValue="">
            <option value="">{personnes.length ? '— choisir —' : '— personne à rattacher —'}</option>
            {personnes.map(p => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}
          </select>
        </label>
        <p className="discret texte-12">
          Elle reste dans son équipe d’origine. Pour la faire travailler sur un projet de {equipe?.nom}, affectez-la ensuite depuis le projet (« + Membre »).
        </p>
      </form>
    </Cadre>
  );
}
