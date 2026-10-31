/* ============================================================
   Logo, nom de l'application et mention de propriété
   (portage de C.marque et C.mentionPropriete de app/js/composants.js — phase 5, vague A)
   ============================================================ */
import { CONFIG } from '../domaine/config';

/** Logo (trois barres) et nom ; « grand » sur les écrans de connexion */
export function Marque({ grand = false }: { grand?: boolean }) {
  return (
    <div className="marque">
      <div className={'logo' + (grand ? ' grand' : '')}><i /><i /><i /></div>
      <div className="marque-nom">{CONFIG.NOM_APPLICATION}</div>
    </div>
  );
}

/* Mention de propriété (maquette docs/maquettes/mention-ciritec/) : courte en bas du menu, complète
   (« logiciel propriétaire ») sur les écrans de connexion */
export function MentionPropriete({ complete = false }: { complete?: boolean }) {
  return (
    <div className="mention-propriete">
      © {CONFIG.ANNEE_DROITS} <b>{CONFIG.PROPRIETAIRE}</b> · Tous droits réservés
      {!complete && ` · v${typeof __VERSION_APPLICATION__ === 'string' ? __VERSION_APPLICATION__ : ''}`}
      {complete && ` · ${CONFIG.NOM_APPLICATION} est un logiciel propriétaire`}
    </div>
  );
}
