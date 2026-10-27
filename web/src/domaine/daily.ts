/* ============================================================
   Notes de daily : découpe et composition du texte (portage de la fin de app/js/calculs.js)
   ------------------------------------------------------------
   Daily en trois champs (demande du porteur, 2026-10-05) : « Hier » (la veille), « Aujourd'hui », « Blocages ».
   La note reste un seul texte en base (notes_daily.texte), au format des rubriques : titre de rubrique puis une ligne
   « - … » par point. Un texte hors rubrique (ancienne note) est rangé dans « Aujourd'hui » : rien n'est perdu.
   ============================================================ */

export interface Rubrique {
  titre: string;
  lignes: string[];
}

export interface ChampsDaily {
  hier: string;
  aujourdhui: string;
  blocages: string;
}

/** Découpe une note en rubriques (Hier / Aujourd'hui / Blocages / autre) : un titre est une ligne qui ne commence pas par « - » */
export function rubriquesDaily(texte?: string | null): Rubrique[] {
  const rubriques: Rubrique[] = [];
  let courante: Rubrique | null = null;
  (texte || '').split('\n').forEach(l => {
    const ligne = l.trim();
    if (!ligne) return;
    if (!ligne.startsWith('-')) {
      courante = { titre: ligne, lignes: [] };
      rubriques.push(courante);
      return;
    }
    if (!courante) {
      courante = { titre: '', lignes: [] };
      rubriques.push(courante);
    }
    courante.lignes.push(ligne.replace(/^-\s*/, ''));
  });
  return rubriques;
}

export const estRubriqueBlocages = (titre: string): boolean => /^blocages?\b/i.test(titre);

/** Blocages réels d'une note : lignes de la rubrique « Blocages », hors « Aucun », « RAS », « néant » */
export const blocagesDaily = (texte?: string | null): string[] => rubriquesDaily(texte)
  .filter(r => estRubriqueBlocages(r.titre)).flatMap(r => r.lignes)
  .filter(l => l && !/^(aucun|aucune|ras|néant|rien)\.?$/i.test(l));

const RUBRIQUES_DAILY: readonly (readonly [keyof ChampsDaily, string])[] = [['hier', 'Hier'], ['aujourdhui', 'Aujourd’hui'], ['blocages', 'Blocages']];

const cleRubriqueDaily = (ligne: string): keyof ChampsDaily | null => {
  const t = ligne.trim().toLowerCase().replace(/[’']/g, '').replace(/\s*:$/, '');
  return t === 'hier' ? 'hier' : t === 'aujourdhui' ? 'aujourdhui' : /^blocages?$/.test(t) ? 'blocages' : null;
};

/** Texte d'une note → les trois champs de saisie */
export function decouperDaily(texte?: string | null): ChampsDaily {
  const champs: Record<keyof ChampsDaily, string[]> = { hier: [], aujourdhui: [], blocages: [] };
  let courante: keyof ChampsDaily = 'aujourdhui';
  (texte || '').split('\n').forEach(l => {
    const cle = cleRubriqueDaily(l);
    if (cle) {
      courante = cle;
      return;
    }
    const point = l.replace(/^\s*-\s?/, '');
    if (point.trim()) champs[courante].push(point);
  });
  return { hier: champs.hier.join('\n'), aujourdhui: champs.aujourdhui.join('\n'), blocages: champs.blocages.join('\n') };
}

/** Les trois champs de saisie → texte de la note (une rubrique par champ renseigné, un point « - … » par ligne) */
export function composerDaily(champs: Partial<ChampsDaily>): string {
  return RUBRIQUES_DAILY.map(([cle, titre]) => {
    const points = (champs[cle] || '').split('\n').filter(l => l.trim()).map(l => '- ' + l.replace(/^\s*-\s?/, ''));
    return points.length ? titre + '\n' + points.join('\n') : '';
  }).filter(Boolean).join('\n\n');
}
