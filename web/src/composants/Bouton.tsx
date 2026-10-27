/* ============================================================
   Boutons — portage des classes .btn et C.boutonIcone de app/js (phase 4 de la migration)
   ============================================================ */
import type { ButtonHTMLAttributes } from 'react';
import { Icone } from './Icone';
import type { NomIcone } from './Icone';

export type VarianteBouton = 'normal' | 'primaire' | 'succes' | 'danger';

interface PropsBouton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton;
  petit?: boolean;
}

/** Bouton de texte. type="button" par défaut : un bouton ne soumet un formulaire que si on le demande (type="submit"). */
export function Bouton({ variante = 'normal', petit = false, className, type = 'button', ...reste }: PropsBouton) {
  const classes = ['btn', variante === 'normal' ? '' : variante, petit ? 'petit' : '', className ?? ''].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...reste} />;
}

interface PropsBoutonIcone extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  icone: NomIcone;
  /** Infobulle et nom accessible du bouton (obligatoire : le bouton n'a pas de texte) */
  titre: string;
}

/** Bouton-icône d'action ; désactivé = grisé, avec l'explication en infobulle */
export function BoutonIcone({ icone, titre, type = 'button', ...reste }: PropsBoutonIcone) {
  return <button type={type} className="btn-icone" title={titre} aria-label={titre} {...reste}><Icone nom={icone} /></button>;
}
