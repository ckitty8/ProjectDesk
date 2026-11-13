/* ============================================================
   Mon dashboard › Projet › Mises en production (ex-menu Projets ; maquette menu-projets-roadmap/, porteur 2026-10-23 ; portage de
   app/js/ecrans/mes-projets.js — phase 5, vague C)
   Saisie des MEP des projets que l'utilisateur peut modifier (table mises_en_production, migration 039), affichées dans Vue d’ensemble ›
   Projet › Gantt. Chaque champ s'enregistre dès qu'il change. Bouton « + Nouveau projet » (panneau de création).
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
import { peutSaisirProjet } from '../domaine/droits';
import { versionsDuProjet } from '../domaine/roadmap';
import { COMPTEURS_MEP, nombreEntier } from '../domaine/saisies';
import type { MiseEnProduction } from '../domaine/types';
import { misesEnProductionDe } from '../domaine/vues';

type Panneau = { genre: 'nouveau' } | { genre: 'projet'; id: string } | { genre: 'affectation'; projetId: string } | null;

export function MesProjets() {
  const { ctx, donnees, executer, notifier } = useSession();
  const [panneau, setPanneau] = useState<Panneau>(null);
  const [projetAjout, setProjetAjout] = useState('');   // projet de la ligne d'ajout : ses sprints donnent la liste des versions
  if (!ctx || !donnees) return null;
  // Projets dont je saisis les sprints et MEP (miroir de la règle RLS de mises_en_production), triés par code
  const projets = donnees.projets.filter(p => peutSaisirProjet(ctx, p)).sort((a, b) => a.code.localeCompare(b.code));
  const meps = misesEnProductionDe(donnees.misesEnProduction, projets);
  // Versions = noms des sprints du projet (menu Sprints) ; la version déjà saisie reste proposée même si son sprint a disparu
  const versionsAjout = versionsDuProjet(donnees.sprintsProjet, projetAjout || projets[0]?.id || null);
  const versionsDe = (m: MiseEnProduction): { valeur: string; libelle: string }[] => {
    const noms = versionsDuProjet(donnees.sprintsProjet, m.projetId);
    return ['', ...(m.version && !noms.includes(m.version) ? [m.version] : []), ...noms].map(v => ({ valeur: v, libelle: v || '—' }));
  };

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
        sousTitre="MEP des projets que vous pouvez modifier (date, version, tickets livrés) · affichées dans Vue d’ensemble › Projet › Gantt"
        actions={<Bouton variante="primaire" onClick={() => setPanneau({ genre: 'nouveau' })}>+ Nouveau projet</Bouton>} />
      {projets.length === 0
        ? <Carte><div className="vide">Vous ne pouvez modifier aucun projet : pas de mise en production à saisir.</div></Carte>
        : (
          <>
            <Carte>
              <div className="carte-titre"><h2>Mises en production de mes projets</h2></div>
              {/* Formulaire d'ajout vide : ses champs sont la première ligne du tableau (attribut form), donc alignés sur les titres des colonnes */}
              <form id="ajout-mep" onSubmit={e => void ajouter(e)} />
              <table className="tableau tableau-sprints">
                <thead>
                  <tr>
                    <th>Date</th><th>Projet</th><th>Version</th>
                    {COMPTEURS_MEP.map(c => <th key={c.cle} className="num" title={c.titre}>{c.libelle}</th>)}
                    <th>Statut</th><th />
                  </tr>
                </thead>
                <tbody>
                  <tr className="ligne-ajout">
                    <td><input className="champ champ-date" type="date" name="jour" form="ajout-mep" required aria-label="Date" /></td>
                    <td><select className="champ champ-compact" name="projet" form="ajout-mep" aria-label="Projet" value={projetAjout || projets[0]?.id || ''}
                      onChange={e => setProjetAjout(e.target.value)}>{projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></td>
                    <td>
                      <select className="champ champ-version" name="version" form="ajout-mep" aria-label="Version" defaultValue="" key={projetAjout}>
                        <option value="">{versionsAjout.length ? '— version —' : '— aucune version (menu Sprints) —'}</option>
                        {versionsAjout.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </td>
                    {COMPTEURS_MEP.map(c => (
                      <td key={c.cle}><input className="champ champ-nombre" type="number" min={0} name={c.cle} form="ajout-mep" defaultValue={0} title={c.titre} aria-label={c.titre} /></td>
                    ))}
                    <td><select className="champ champ-compact" name="statut" form="ajout-mep" defaultValue="prevue" aria-label="Statut">{STATUTS_MEP.map(s => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}</select></td>
                    <td><Bouton variante="primaire" type="submit" form="ajout-mep">Ajouter</Bouton></td>
                  </tr>
                  {meps.length === 0 && <tr><td colSpan={8} className="pale">Aucune mise en production saisie.</td></tr>}
                  {meps.map(m => (
                    <tr key={m.id}>
                      <td><input key={m.jour} className="champ champ-date" type="date" defaultValue={m.jour} aria-label="Date" onBlur={e => { if (e.target.value !== m.jour) void majMep(m, 'jour', e.target.value, v => { e.target.value = v; }); }} /></td>
                      <td>{projets.find(p => p.id === m.projetId)?.nom}</td>
                      <td><Liste className="champ champ-version" aria-label="Version" valeur={m.version ?? ''} onChoisir={v => void majMep(m, 'version', v)} options={versionsDe(m)} /></td>
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
              Chaque chef de projet saisit les MEP de ses projets ; tout le monde les consulte dans Vue d’ensemble › Projet › Gantt.
            </div>
          </>
        )}
      {panneau?.genre === 'nouveau' && <NouveauProjet equipeId={null} onFermer={() => setPanneau(null)} onCree={id => setPanneau({ genre: 'projet', id })} />}
      {panneau?.genre === 'projet' && (
        <PanneauProjet projetId={panneau.id} section="moi" onFermer={() => setPanneau(null)}
          onAssigner={id => setPanneau({ genre: 'affectation', projetId: id })} />
      )}
      {panneau?.genre === 'affectation' && (
        <ModaleAffectation ressourceId={null} projetId={panneau.projetId} onFermer={() => setPanneau(null)} />
      )}
    </div>
  );
}
