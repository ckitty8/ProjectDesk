/* ============================================================
   Suivi de mes équipes › Projet (maquette 02-gProjets.png ; portage de app/js/ecrans/projets.js — phase 5, vague B) — lecture
   Deux onglets (porteur 2026-11-02, maquette menu-projet-gantt/) : Gantt (sprints et mises en production, composant projets/Gantt) et Liste (projets
   groupés par équipe, notion de ticket retirée le 2026-09-27). Le filtre par équipe est commun aux deux onglets ; un clic sur un projet ouvre
   son panneau de détail (lecture). Le menu Roadmap n'existe plus : le Gantt en a repris le contenu.
   ============================================================ */
import { useState } from 'react';
import { Aide } from '../composants/Aide';
import { Avatar, BadgeRef, Pastille } from '../composants/Badge';
import { Barre } from '../composants/Barre';
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { Onglets } from '../composants/Onglets';
import { PanneauProjet } from '../composants/PanneauProjet';
import { PucesEquipes } from '../composants/PucesEquipes';
import { Gantt } from './projets/Gantt';
import { useSession } from '../donnees/SessionProvider';
import { avancementMoyen } from '../domaine/calculs';
import { COULEURS } from '../domaine/config';
import { couleurStatutProjet } from '../domaine/couleurs';
import { formatCourt, pourcent } from '../domaine/dates';
import { AIDES } from '../domaine/textes';
import type { Projet } from '../domaine/types';

export function Projets() {
  const { donnees } = useSession();
  const [equipeId, setEquipeId] = useState('toutes');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [onglet, setOnglet] = useState('gantt');
  if (!donnees) return null;
  const { equipes, projets, ressources, valeurs } = donnees;

  const ligneProjet = (p: Projet) => {
    const chef = ressources.find(r => r.id === p.chefId);
    return (
      <tr key={p.id} className="cliquable" tabIndex={0} onClick={() => setOuvert(p.id)}
        onKeyDown={e => { if (e.key === 'Enter') setOuvert(p.id); }}>
        <td>{p.nom}</td>
        <td>{chef ? <span className="ligne-flex"><Avatar nom={chef.nom} />{chef.nom}</span> : <span className="pale">—</span>}</td>
        <td style={{ minWidth: 150 }}>
          <span className="ligne-flex">
            <Barre pct={p.avancement ?? 0} couleur={couleurStatutProjet(p.statut)} /><span className="num" style={{ width: 36 }}>{p.avancement ?? 0}%</span>
          </span>
        </td>
        <td>{formatCourt(p.fin)}</td>
        <td><BadgeRef valeurs={valeurs} referentielId="stp" libelle={p.statut} /></td>
      </tr>
    );
  };

  const groupes = equipes.filter(e => equipeId === 'toutes' || e.id === equipeId)
    .map(e => ({ e, siens: projets.filter(p => p.equipeId === e.id) })).filter(g => g.siens.length);

  return (
    <div className="ecran">
      <EnteteEcran titre="Projet" sousTitre={`${projets.length} projets · sprints, mises en production et avancement par équipe`}
        actions={<PucesEquipes equipes={equipes} choisie={equipeId} onChoisir={setEquipeId} />}
      />
      <Onglets liste={[{ id: 'gantt', libelle: 'Gantt' }, { id: 'liste', libelle: 'Liste' }]} actif={onglet} onChoisir={setOnglet} />
      {onglet === 'gantt' && (
        <Gantt projets={projets.filter(p => equipeId === 'toutes' || p.equipeId === equipeId)} equipes={equipes.filter(e => equipeId === 'toutes' || e.id === equipeId)}
          onOuvrir={setOuvert} />
      )}
      {onglet === 'liste' && <Carte>
        <table className="tableau">
          <thead>
            <tr><th>Projet</th><th>Chef de projet</th><th>Avancement <Aide texte={AIDES.avancementProjet} /></th><th>Échéance</th><th>Statut</th></tr>
          </thead>
          <tbody>
            {groupes.length === 0 && <tr><td colSpan={5}><Vide texte="Aucun projet." /></td></tr>}
            {groupes.map(({ e, siens }) => (
              <GroupeProjets key={e.id} nom={e.nom} couleur={e.couleur ?? COULEURS.pale} nb={siens.length} moyenne={avancementMoyen(siens)}>
                {siens.map(ligneProjet)}
              </GroupeProjets>
            ))}
          </tbody>
        </table>
      </Carte>}
      {ouvert && <PanneauProjet projetId={ouvert} onFermer={() => setOuvert(null)} />}
    </div>
  );
}

/** Ligne de titre d'une équipe, suivie de ses projets */
function GroupeProjets({ nom, couleur, nb, moyenne, children }: { nom: string; couleur: string; nb: number; moyenne: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="groupe">
        <td colSpan={5}>
          <span className="ligne-flex">
            <Pastille couleur={couleur} />{nom}<span className="discret poids-normal">{nb} projets · {pourcent(moyenne)} d’avancement moyen</span>
          </span>
        </td>
      </tr>
      {children}
    </>
  );
}
