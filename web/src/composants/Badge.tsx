/* ============================================================
   Badges, pastilles, avatars (portage de C.badge, C.badgeTon, C.badgeFeuille, C.badgeActif, C.pastille, C.avatar, C.code)
   (phase 4 de la migration). Tout texte passe par React : l'échappement HTML est automatique.
   ============================================================ */
import { STATUTS_FEUILLE, TONS } from '../domaine/config';
import type { StatutFeuille, Ton } from '../domaine/config';
import { teinte } from '../domaine/couleurs';
import { initiales } from '../domaine/calculs';
import { couleurDe } from '../domaine/referentiels';
import type { ValeurReferentiel } from '../domaine/types';

/** Badge (statut, rôle…) : couleur du texte et fond teinté (par défaut, mélange de la couleur avec du blanc) */
export function Badge({ texte, couleur, fond }: { texte: string; couleur: string; fond?: string }) {
  return <span className="badge" style={{ color: couleur, background: fond ?? teinte(couleur) }}>{texte}</span>;
}

/** Badge d'un ton de la palette : neutre, succes, info, attention, violet */
export function BadgeTon({ texte, ton }: { texte: string; ton: Ton }) {
  return <Badge texte={texte} couleur={TONS[ton].texte} fond={TONS[ton].fond} />;
}

/** Statut d'une feuille de temps (« En saisie » si le statut est inconnu) */
export function BadgeFeuille({ statut }: { statut: string }) {
  const s = STATUTS_FEUILLE[statut as StatutFeuille] ?? STATUTS_FEUILLE.en_saisie;
  return <Badge texte={s.libelle} couleur={s.texte} fond={s.fond} />;
}

/** Actif / inactif ; libellés au féminin par défaut (unités), ['Actif', 'Inactif'] pour une personne */
export function BadgeActif({ actif, libelles = ['Active', 'Inactive'] }: { actif: boolean; libelles?: readonly [string, string] }) {
  return actif ? <BadgeTon texte={libelles[0]} ton="succes" /> : <BadgeTon texte={libelles[1]} ton="neutre" />;
}

export const Pastille = ({ couleur }: { couleur: string }) => <span className="pastille" style={{ background: couleur }} />;

/** Rond avec les initiales d'une personne */
export const Avatar = ({ nom, grand = false }: { nom: string; grand?: boolean }) =>
  <span className={'avatar' + (grand ? ' grand' : '')}>{initiales(nom)}</span>;

export const Code = ({ texte }: { texte: string }) => <span className="code">{texte}</span>;

/** Badge d'une valeur de liste métier (référentiel) : sa couleur est celle administrée en base ; rien si le libellé est vide */
export function BadgeRef({ valeurs, referentielId, libelle }: { valeurs: readonly ValeurReferentiel[]; referentielId: string; libelle?: string | null }) {
  return libelle ? <Badge texte={libelle} couleur={couleurDe(valeurs, referentielId, libelle)} /> : null;
}
