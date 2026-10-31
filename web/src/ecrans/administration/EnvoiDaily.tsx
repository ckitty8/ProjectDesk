/* ============================================================
   Administration › Envoi du daily : réglage PAR PROJET (demande du porteur 2026-10-07, maquette envoi-daily-projet/ ; portage de
   app/js/ecrans/mon-admin.js et de Modale.envoiPowerAutomate — phase 5, vague D)
   Chaque projet en cours choisit son mode d'envoi (Désactivé, Power Automate, Envoi direct), l'heure, les jours, l'exclusion des fériés et les
   destinataires ; une ligne par projet dans envois_daily_projet (migration 019). Modifiable par un administrateur, le chef du projet ou un responsable
   de son unité (peutPiloterProjet). Power Automate : le flux appelle la fonction daily_projet de la Data API avec l'id et la clé du projet, sans compte.
   ============================================================ */
import { useState } from 'react';
import { Aide } from '../../composants/Aide';
import { Pastille } from '../../composants/Badge';
import { Bouton } from '../../composants/Bouton';
import { Carte, Vide } from '../../composants/Carte';
import { Cadre } from '../../composants/Fenetres';
import { creer, executer as appelerFonction } from '../../donnees/api';
import { adresses } from '../../donnees/adresses';
import { useSession } from '../../donnees/SessionProvider';
import { basculerJourEnvoi, reglageEnvoi } from '../../domaine/admin';
import { MODES_ENVOI_DAILY } from '../../domaine/config';
import { peutPiloterProjet } from '../../domaine/droits';
import { AIDES } from '../../domaine/textes';
import type { Projet } from '../../domaine/types';
import { projetEnCours } from '../../domaine/vues';

const JOURS: [number, string][] = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V']];

/** Fenêtre de mise en place du flux Power Automate d'un projet : URI, corps (avec la clé secrète), étapes, aperçu de l'e-mail du jour */
function ModalePowerAutomate({ projet, cle, apercu, onRenouveler, onFermer }: {
  projet: Projet; cle: string; apercu: { html?: string } | null; onRenouveler: () => void; onFermer: () => void;
}) {
  const { notifier } = useSession();
  const url = adresses().DATA_API_URL + '/rpc/daily_projet';
  const corps = JSON.stringify({ p_projet: projet.id, p_cle: cle });
  const copier = (texte: string) => navigator.clipboard.writeText(texte).then(() => notifier('Copié'), () => notifier('Copie impossible : sélectionnez le texte', 'erreur'));
  const champ = (libelle: string, valeur: string) => (
    <div>
      <div className="libelle">{libelle}</div>
      <div className="ligne-flex">
        <input className="champ" readOnly value={valeur} style={{ fontFamily: 'monospace', fontSize: 12 }} aria-label={libelle} />
        <Bouton petit onClick={() => void copier(valeur)}>Copier</Bouton>
      </div>
    </div>
  );
  return (
    <Cadre classe="modale" titre={'Power Automate · daily ' + projet.nom} onFermer={onFermer}>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        <li style={{ marginBottom: 6 }}>Nouveau flux <b>planifié</b> : périodicité 1 jour, à l’heure réglée dans l’onglet (fuseau Paris).</li>
        <li style={{ marginBottom: 6 }}>Action <b>HTTP</b> : méthode <b>POST</b>, l’URI et le corps ci-dessous, en-tête <span className="code">Content-Type</span> = <span className="code">application/json</span>.</li>
        <li style={{ marginBottom: 6 }}>Action <b>Condition</b> : <span className="code">body(&apos;HTTP&apos;)?[&apos;a_envoyer&apos;]</span> est égal à <span className="code">true</span> (faux le week-end, un jour non coché ou un férié).</li>
        <li style={{ marginBottom: 6 }}>
          Si oui : <b>Envoyer un e-mail (V2)</b> (Outlook pro ou perso, Gmail) — À : <span className="code">replace(body(&apos;HTTP&apos;)?[&apos;destinataires&apos;], &apos;,&apos;, &apos;;&apos;)</span>,
          Objet : <span className="code">body(&apos;HTTP&apos;)?[&apos;objet&apos;]</span>, Corps : <span className="code">body(&apos;HTTP&apos;)?[&apos;html&apos;]</span>.
        </li>
      </ol>
      {champ('URI', url)}
      {champ('Corps (contient la clé secrète du projet : ne pas la diffuser)', corps)}
      <div className="ligne-flex">
        <Bouton petit onClick={onRenouveler}>Renouveler la clé</Bouton>
        <span className="discret texte-12">l’ancienne clé cesse aussitôt de fonctionner : mettez le flux à jour</span>
      </div>
      <div>
        <div className="libelle">Aperçu de l’e-mail du jour</div>
        <Carte><div style={{ padding: '12px 14px', maxHeight: 260, overflow: 'auto' }}>
          {apercu?.html ? <div dangerouslySetInnerHTML={{ __html: apercu.html }} /> : <span className="pale">Aperçu indisponible</span>}
        </div></Carte>
      </div>
    </Cadre>
  );
}

export function EnvoiDaily() {
  const { ctx, donnees, executer, notifier } = useSession();
  const [power, setPower] = useState<{ projet: Projet; cle: string; apercu: { html?: string } | null } | null>(null);
  if (!ctx || !donnees) return null;
  const projets = donnees.projets.filter(p => projetEnCours(p) && peutPiloterProjet(ctx, p)).sort((a, b) => a.code.localeCompare(b.code));

  // Écrit le réglage complet du projet (valeurs par défaut si première saisie) ; destinataires et jours peuvent être vides : on garde ''
  const maj = (projetId: string, champ: string, valeur: string | boolean) => {
    const actuel = reglageEnvoi(donnees.envoisDaily, projetId);
    void executer(() => creer('envois_daily_projet', { projetId, ...actuel, [champ]: valeur }, 'projet_id', ['destinataires', 'jours']), 'envoisDaily');
  };

  // Lit (ou crée, ou renouvelle) la clé du projet, puis l'aperçu du daily du jour avec cette clé (fonctions de la migration 019)
  async function ouvrirPower(projet: Projet, renouveler: boolean) {
    try {
      const cle = await appelerFonction<string>('cle_envoi_daily_projet', { p_projet: projet.id, p_renouveler: renouveler });
      const apercu = await appelerFonction<{ html?: string }>('daily_projet', { p_projet: projet.id, p_cle: cle }).catch(() => null);
      setPower({ projet, cle, apercu });
      if (renouveler) notifier('Nouvelle clé créée : mettez à jour le corps de l’action HTTP du flux');
    } catch (e) { notifier((e as Error).message, 'erreur'); }
  }

  return (
    <Carte>
      <div className="carte-titre">
        <h2>Envoi du daily par e-mail <Aide texte={AIDES.envoiDaily} /></h2>
        <span className="discret">contenu : le daily du projet du jour — blocages en tête, puis Hier / Aujourd’hui / Blocages de chacun, sans note, absents</span>
      </div>
      <table className="tableau">
        <thead>
          <tr><th>Projet</th><th>Mode</th><th>Heure</th><th>Jours</th><th>Fériés</th><th style={{ width: '22%' }}>Destinataires</th><th style={{ width: '20%' }}>Mise en place</th></tr>
        </thead>
        <tbody>
          {projets.length === 0 && <tr><td colSpan={7}><Vide texte="Aucun projet en cours dont vous réglez l’envoi." /></td></tr>}
          {projets.map(p => {
            const r = reglageEnvoi(donnees.envoisDaily, p.id), actif = r.mode !== 'aucun', jours = String(r.jours ?? '').split(',');
            return (
              <tr key={p.id}>
                <td><span className="ligne-flex"><Pastille couleur={donnees.equipes.find(e => e.id === p.equipeId)?.couleur ?? '#8A93A3'} /><b>{p.nom}</b></span></td>
                <td>
                  <select className="champ" style={{ height: 30, width: 150 }} aria-label={`Mode ${p.nom}`} value={r.mode} onChange={e => maj(p.id, 'mode', e.target.value)}>
                    {MODES_ENVOI_DAILY.map(m => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
                  </select>
                </td>
                <td>
                  <input key={r.heure} className="champ" type="time" style={{ height: 30, width: 120 }} defaultValue={r.heure} disabled={!actif} aria-label={`Heure ${p.nom}`}
                    onBlur={e => { if (e.target.value && e.target.value !== r.heure) maj(p.id, 'heure', e.target.value); }} />
                </td>
                <td>
                  <div className="puces" style={{ flexWrap: 'nowrap', gap: 4 }}>
                    {JOURS.map(([n, l]) => (
                      <button key={n} type="button" className={'puce' + (jours.includes(String(n)) ? ' active' : '')} disabled={!actif} aria-label={`Jour ${n} ${p.nom}`}
                        style={{ width: 28, justifyContent: 'center', padding: 0 }} onClick={() => maj(p.id, 'jours', basculerJourEnvoi(String(r.jours ?? ''), n))}>{l}</button>
                    ))}
                  </div>
                </td>
                <td className="sans-retour">
                  <label className="ligne-flex"><input type="checkbox" checked={!!r.sansFeries} disabled={!actif} onChange={e => maj(p.id, 'sansFeries', e.target.checked)} /> sauf fériés</label>
                </td>
                <td>
                  <input key={r.destinataires} className="champ" style={{ height: 30 }} placeholder="email1@…, email2@…" defaultValue={r.destinataires} disabled={!actif} aria-label={`Destinataires ${p.nom}`}
                    onBlur={e => { if (e.target.value.trim() !== r.destinataires) maj(p.id, 'destinataires', e.target.value.trim()); }} />
                </td>
                <td>
                  {r.mode === 'power_automate' && (
                    <>
                      <Bouton petit onClick={() => void ouvrirPower(p, false)}>Configurer le flux</Bouton>
                      <div className="discret" style={{ fontSize: 12, marginTop: 4 }}>votre flux lit le daily puis l’envoie depuis votre boîte</div>
                    </>
                  )}
                  {r.mode === 'direct' && <span className="discret texte-12">L’application enverra l’e-mail à l’heure choisie — <b>à venir</b> (étape 2 : service d’envoi à créer)</span>}
                  {r.mode === 'aucun' && <span className="pale">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {power && (
        <ModalePowerAutomate projet={power.projet} cle={power.cle} apercu={power.apercu} onFermer={() => setPower(null)}
          onRenouveler={() => { if (window.confirm('Renouveler la clé ? Le flux actuel cessera de fonctionner tant qu’il n’est pas mis à jour.')) void ouvrirPower(power.projet, true); }} />
      )}
    </Carte>
  );
}
