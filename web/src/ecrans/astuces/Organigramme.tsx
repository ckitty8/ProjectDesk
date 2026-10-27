/* ============================================================
   Trucs et astuces › Rôles Scrum : organigramme détaillé et tableau « qui fait quoi » (portage de astuces.js — phase 5, vague A)
   Sponsor (avec les parties prenantes à côté) → équipe Scrum : PO fonctionnel et PO technique (backlog unique co-priorisé), Scrum Master
   transverse → équipe de développement : tech lead, puis développeurs, QA et rôles d'appui. Traits : lignes CSS de .org-branches (theme.css).
   ============================================================ */
import { Pastille } from '../../composants/Badge';
import { Carte } from '../../composants/Carte';
import { FAMILLES_ROLES_SCRUM, QUI_FAIT_QUOI_SCRUM, ROLES_SCRUM } from '../../domaine/textes';
import type { RoleScrum } from '../../domaine/textes';

type CleRole = keyof typeof ROLES_SCRUM;

function CarteRole({ cle }: { cle: CleRole }) {
  const r: RoleScrum = ROLES_SCRUM[cle];
  const couleur = FAMILLES_ROLES_SCRUM[r.famille].couleur;
  return (
    <div className={'org-carte' + (r.pointille ? ' pointille' : '')} style={{ borderTopColor: couleur }}>
      <div className="org-titre" style={{ color: couleur }}>{r.titre}</div>
      {r.sousTitre && <div className="org-sous-titre">{r.sousTitre}</div>}
      <div className="org-mission">{r.mission}</div>
      <ul>{r.actions.map(a => <li key={a}>{a}</li>)}</ul>
      {r.lien && <div className="org-lien">{r.lien}</div>}
      <div className="org-ceremonies">{r.ceremonies.map(c => <span key={c}>{c}</span>)}</div>
    </div>
  );
}

export function Organigramme() {
  return (
    <>
      <Carte classe="encart-moyen">
        <div className="ligne-flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <b>Organigramme d’une équipe Scrum</b>
            <div className="discret texte-12-5">
              Le Product Ownership est partagé entre un PO fonctionnel et un PO technique, qui priorisent ensemble un backlog unique.
              Le Scrum Master sert toute l’équipe sans la diriger.
            </div>
          </div>
          <div className="ligne-flex" style={{ gap: 14, fontSize: 12.5 }}>
            {Object.entries(FAMILLES_ROLES_SCRUM).map(([cle, f]) => <span key={cle} className="ligne-flex"><Pastille couleur={f.couleur} />{f.libelle}</span>)}
            <span className="ligne-flex"><span className="org-pointille-exemple" />transverse ou si besoin</span>
          </div>
        </div>
      </Carte>
      <Carte classe="org">
        <div className="org-haut">
          <div className="org-cote"><CarteRole cle="partiesPrenantes" /><span className="org-tirets" title="besoins et retours" /></div>
          <CarteRole cle="sponsor" /><div />
        </div>
        <div className="org-trait" />
        <div className="org-cadre">
          <div className="org-cadre-titre">Équipe Scrum</div>
          <div className="org-noeud">
            <div className="org-groupe">Product Ownership <span className="discret">· backlog unique co-priorisé</span></div>
            <ul className="org-branches">
              <li><CarteRole cle="poFonctionnel" /></li><li><CarteRole cle="poTechnique" /></li><li><CarteRole cle="scrumMaster" /></li>
            </ul>
          </div>
          <div className="org-trait" />
          <div className="org-cadre org-cadre-dev">
            <div className="org-cadre-titre">Équipe de développement (Developers)</div>
            <div className="org-noeud">
              <CarteRole cle="techLead" />
              <ul className="org-branches">
                <li><CarteRole cle="developpeurs" /></li><li><CarteRole cle="qa" /></li><li><CarteRole cle="uxUi" /></li><li><CarteRole cle="devops" /></li>
              </ul>
            </div>
          </div>
        </div>
      </Carte>
      <Carte>
        <div className="carte-titre"><h2>Qui fait quoi</h2><span className="discret">● responsable · ○ contribue</span></div>
        <table className="tableau tableau-roles">
          <thead>
            <tr><th>Activité</th>{QUI_FAIT_QUOI_SCRUM.colonnes.map(c => <th key={c} className="num">{ROLES_SCRUM[c].titre}</th>)}</tr>
          </thead>
          <tbody>
            {QUI_FAIT_QUOI_SCRUM.lignes.map(([activite, ...marques]) => (
              <tr key={activite}>
                <td><b>{activite}</b></td>
                {marques.map((m, i) => <td key={i} className="num" style={{ fontSize: 16, color: m === '●' ? 'var(--primaire)' : 'var(--discret)' }}>{m}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>
    </>
  );
}
