/* ============================================================
   Liste déroulante (portage de C.liste) : options [{ valeur, libelle, desactive }] ou simples chaînes
   ============================================================ */
import type { SelectHTMLAttributes } from 'react';

export type OptionListe = string | { valeur: string; libelle: string; desactive?: boolean };

interface PropsListe extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  options: readonly OptionListe[];
  valeur: string | null | undefined;
  onChoisir: (valeur: string) => void;
}

export function Liste({ options, valeur, onChoisir, className = 'champ', ...reste }: PropsListe) {
  return (
    <select className={className} value={valeur ?? ''} onChange={e => onChoisir(e.target.value)} {...reste}>
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.valeur;
        const l = typeof o === 'string' ? o : o.libelle;
        return <option key={v} value={v} disabled={typeof o === 'object' && o.desactive}>{l}</option>;
      })}
    </select>
  );
}
