/* ============================================================
   Mon dashboard › Projets et Roadmap › Mises en production (maquette menu-projets-roadmap/, porteur 2026-10-23 ; portage de
   app/js/ecrans/mes-projets.js — phase 5, vague C)
   Saisie des MEP des projets que l'utilisateur peut modifier (table mises_en_production, migration 039), affichées dans Suivi de mes équipes ›
   Projets et Roadmap › Planning projet. Chaque champ s'enregistre dès qu'il change. Bouton « + Nouveau projet » (panneau de création).
   ============================================================ */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Bouton, BoutonIcone } from '../composants/Bouton';
import { Carte, EnteteEcran } from '../composants/Carte';
import { Liste } from '../composants/Liste';
import { ModaleAffectation } from '../composants/modales/ModaleAffectation';
import { NouveauProjet } from '../composants/NouveauProjet';
import { PanneauProjet } from '../composants/PanneauProjet';
import { creer, modifier, supprimer } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { STATUTS_MEP } from '../domaine/config';
import { peutEditerProjet } from '../domaine/droits';
import { COMPTEURS_MEP, nombreEntier } from '../domaine/saisies';
import type { MiseEnProduction } from '../domaine/types';
import { misesEnProductionDe } from '../domaine/vues';

type Panneau = { genre: 'nouveau' } | { genre: 'projet'; id: string } | { genre: 'affectation'; projetId: string } | null;

export function MesProjets() {
  const { ctx, donnees, executer, notifier } = useSession();
  const [panneau, setPanneau] = useState<Panneau>(null);
  if (!ctx || !donnees) return null;
  // Projets que je peux modifier (miroir de la règle RLS de mises_en_production), triés par code
  const projets = donnees.projets.filter(p => peutEditerProjet(ctx, p)).sort((a, b) => a.code.localeCompare(b.code));
  const meps = misesEnProductionDe(donnees.misesEnProduction, projets);

  async function ajouter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await executer(() => creer('mises_en_production', { projetId: f.projet, jour: f.jour, version: (f.version ?? '').trim() || null,
      ...Object.fromEntries(COMPTEURS_MEP.map(c => [c.champ, nombreEntier(f[c.cle] ?? '')])), statut: f.statut }), 'misesEnProduction');
  }
  // Modification d'un champ ; la date est obligatoire (on remet l'ancienne valeur si elle est vidée)
  async function majMep(m: MiseEnProduction, champ: string, brut: string, restaurer?: (ancienne: string) => void) {
    const compteur = COMPTEURS_MEP.some(c => c.champ === champ);
    const valeur = compteur ? nombreEntier(brut) : brut.trim() || null;
    if (champ === 'jour' && !valeur) { restaurer?.(m.jour ?? ''); return notifier('La date de la MEP est obligatoire', 'erreur'); }
    await executer(() => modifier('mises_en_production', { id: 'eq.' + m.id }, { [champ]: valeur }), 'misesEnProduction');
  }
  async function supprimerMep(m: MiseEnProduction) {
    if (!window.confirm('Supprimer cette mise en production ?')) return;
    await executer(() => supprimer('mises_en_production', { id: 'eq.' + m.id }), 'misesEnProduction');
  }

  return (
    <div className="ecran">
      <EnteteEcran titre="Mises en production"
        sousTitre="MEP des projets que vous pouvez modifier (date, version, tickets livrés) · affichées dans Suivi de mes équipes › Projets et Roadmap › Planning projet"
        actions={<Bouton variante="primaire" onClick={() => setPanneau({ genre: 'nouveau' })}>+ Nouveau projet</Bouton>} />
      {projets.length === 0
        ? <Carte><div className="vide">Vous ne pouvez modifier aucun projet : pas de mise en production à saisir.</div></Carte>
        : (
          <>
            <Carte>
              <div className="carte-titre"><h2>Mises en production de mes projets</h2></div>
              <form className="ligne-flex formulaire-mep" onSubmit={e => void ajouter(e)}>
                <select className="champ champ-compact" name="projet" aria-label="Projet">{projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}</select>
                <input className="champ champ-date" type="date" name="jour" required aria-label="Date" />
                <input className="champ champ-version" name="version" placeholder="Version" maxLength={40} aria-label="Version" />
                {COMPTEURS_MEP.map(c => <input key={c.cle} className="champ champ-nombre" type="number" min={0} name={c.cle} defaultValue={0} title={c.titre} aria-label={c.titre} />)}
                <select className="champ champ-compact" name="statut" defaultValue="prevue" aria-label="Statut">{STATUTS_MEP.map(s => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}</select>
                <Bouton variante="primaire" type="submit">Ajouter</Bouton>
              </form>
              <table className="tableau tableau-sprints">
                <thead>
                  <tr>
                    <th>Date</th><th>Projet</th><th>Version</th>
                    {COMPTEURS_MEP.map(c => <th key={c.cle} className="num" title={c.titre}>{c.libelle}</th>)}
                    <th>Statut</th><th />
                  </tr>
                </thead>
                <tbody>
                  {meps.length === 0 && <tr><td colSpan={8} className="pale">Aucune mise en production saisie.</td></tr>}
                  {meps.map(m => (
                    <tr key={m.id}>
                      <td><input key={m.jour} className="champ champ-date" type="date" defaultValue={m.jour} aria-label="Date" onBlur={e => { if (e.target.value !== m.jour) void majMep(m, 'jour', e.target.value, v => { e.target.value = v; }); }} /></td>
                      <td>{projets.find(p => p.id === m.projetId)?.nom}</td>
                      <td><input key={m.version} className="champ champ-version" defaultValue={m.version ?? ''} maxLength={40} aria-label="Version" onBlur={e => { if (e.target.value.trim() !== (m.version ?? '')) void majMep(m, 'version', e.target.value); }} /></td>
                      {COMPTEURS_MEP.map(c => (
                        <td key={c.cle}>
                          <input key={m[c.champ] ?? 0} className="champ champ-nombre" type="number" min={0} defaultValue={m[c.champ] ?? 0} aria-label={c.titre}
                            onBlur={e => { if (nombreEntier(e.target.value) !== (m[c.champ] ?? 0)) void majMep(m, c.champ, e.target.value); }} />
                        </td>
                      ))}
                      <td>
                        <Liste className="champ champ-compact" aria-label="Statut" valeur={m.statut} onChoisir={v => void majMep(m, 'statut', v)}
                          options={STATUTS_MEP.map(s => ({ valeur: s.valeur, libelle: s.libelle }))} />
                      </td>
                      <td><BoutonIcone icone="supprimer" titre="Supprimer cette mise en production" onClick={() => void supprimerMep(m)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Carte>
            <div className="discret texte-12">
              Chaque chef de projet saisit les MEP de ses projets ; tout le monde les consulte dans Suivi de mes équipes › Projets et Roadmap › Planning projet.
            </div>
          </>
        )}
      {panneau?.genre === 'nouveau' && <NouveauProjet equipeId={null} onFermer={() => setPanneau(null)} onCree={id => setPanneau({ genre: 'projet', id })} />}
      {panneau?.genre === 'projet' && (
        <PanneauProjet projetId={panneau.id} section="moi" onFermer={() => setPanneau(null)}
          onAssigner={id => setPanneau({ genre: 'affectation', projetId: id })} />
      )}
      {panneau?.genre === 'affectation' && (
        <ModaleAffectation ressourceId={null} projetId={panneau.projetId} role={null} onFermer={() => setPanneau(null)} />
      )}
    </div>
  );
}
