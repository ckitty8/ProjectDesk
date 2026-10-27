/* ============================================================
   Onglets (portage de C.onglets) : liste [{ id, libelle, compte }]
   ============================================================ */
export interface Onglet { id: string; libelle: string; compte?: number | string }

export function Onglets({ liste, actif, onChoisir }: { liste: readonly Onglet[]; actif: string; onChoisir: (id: string) => void }) {
  return (
    <div className="onglets" role="tablist">
      {liste.map(o => (
        <button key={o.id} type="button" role="tab" aria-selected={o.id === actif} className={'onglet' + (o.id === actif ? ' actif' : '')}
          onClick={() => onChoisir(o.id)}>
          {o.libelle}{o.compte !== undefined && <>{' '}<span className="compte">{o.compte}</span></>}
        </button>
      ))}
    </div>
  );
}
