/* ============================================================
   Administration › Menus par équipe (porteur, 2026-11-04) — ÉTAPE 1 du choix des écrans : pour chaque équipe, quels écrans sont accessibles.
   L'étape 2 (quels écrans pour chaque rôle) est la matrice des droits. Un utilisateur voit un écran si son équipe active l'autorise ET si son rôle
   l'ouvre. Exemple du porteur : équipe 1 → Mon dashboard : Sprints + Mises en production ; équipe 2 → Mon dashboard : Roadmap.
   Sans ligne en base (table droits_equipes, migration 059), un écran est accessible : cocher / décocher écrit une ligne aussitôt.
   Administrateurs seulement ; les directions n'ont pas de colonne (leurs équipes ont chacune la leur).
   ============================================================ */
import { Carte, Vide } from '../../composants/Carte';
import { creer } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { ECRANS_PAR_EQUIPE } from '../../domaine/config';

const SECTIONS = [{ cle: 'vue', libelle: 'Vue d’ensemble' }, { cle: 'equipes', libelle: 'Suivi de mes équipes' }, { cle: 'moi', libelle: 'Mon dashboard' }] as const;

export function MenusEquipes() {
  const { ctx, donnees, executer } = useSession();
  if (!ctx || !donnees) return null;
  const equipes = donnees.equipes.filter(e => e.type !== 'direction' && e.actif !== false);
  const autorise = (equipeId: string, ecran: string) => donnees.droitsEquipes.find(l => l.equipeId === equipeId && l.ecran === ecran)?.acces ?? true;
  // Une ligne par (équipe, écran) : écrite à chaque changement (upsert sur la clé équipe + écran)
  const changer = (equipeId: string, ecran: string, acces: boolean) =>
    executer(() => creer('droits_equipes', { equipeId, ecran, acces }, 'equipe_id,ecran'), 'droitsEquipes');
  return (
    <Carte>
      <div className="carte-titre">
        <h2>Menus par équipe</h2>
        <span className="discret">Étape 1 : les écrans accessibles à chaque équipe · étape 2 : les écrans de chaque rôle (Matrice des droits)</span>
      </div>
      {equipes.length === 0 ? <Vide texte="Aucune équipe : créez d’abord les équipes (onglet Équipes)." /> : (
        <div className="defilement-x">
          <table className="tableau tableau-menus-equipes">
            <thead><tr><th>Écran</th>{equipes.map(e => <th key={e.id} className="centre">{e.nom}</th>)}</tr></thead>
            <tbody>
              {SECTIONS.map(section => (
                <FragmentSection key={section.cle} libelle={section.libelle} colonnes={equipes.length + 1}>
                  {ECRANS_PAR_EQUIPE.filter(x => x.section === section.cle).map(x => (
                    <tr key={x.id}>
                      <td>{x.libelle}</td>
                      {equipes.map(e => (
                        <td key={e.id} className="centre">
                          <input type="checkbox" aria-label={`${x.libelle} · ${e.nom}`} checked={autorise(e.id, x.id)} disabled={!ctx.estAdmin}
                            onChange={ev => void changer(e.id, x.id, ev.target.checked)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </FragmentSection>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="discret texte-12">
        Administration, Trucs et astuces et Mon profil restent accessibles à toutes les équipes. Un écran décoché disparaît du menu des membres de l’équipe,
        quel que soit leur rôle ; l’administrateur en mode administrateur voit tout.
      </div>
    </Carte>
  );
}

const FragmentSection = ({ libelle, colonnes, children }: { libelle: string; colonnes: number; children: React.ReactNode }) => (
  <>
    <tr className="groupe"><td colSpan={colonnes}><b>{libelle}</b></td></tr>
    {children}
  </>
);
