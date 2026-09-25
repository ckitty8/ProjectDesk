/* ============================================================
   Mon dashboard › Projets et Roadmap (maquette 07-mProjets.png)
   Diagramme de Gantt des projets où l'utilisateur est affecté.
   Barre claire = durée planifiée, barre pleine = avancement.
   Clic sur une barre : panneau projet (statut, avancement...).
   ============================================================ */
'use strict';

Ecrans.mesProjets = {
  titre: 'Projets et Roadmap',
  section: 'moi',
  rendre() {
    const esc = C.esc, moi = maRessource(), jour = Calculs.aujourdhui();
    const mesAffectations = moi ? etat.d.affectations.filter(a => a.ressourceId === moi.id) : [];
    const lignes = mesAffectations.map(a => ({ p: projet(a.projetId), role: a.role })).filter(x => x.p && x.p.debut && x.p.fin)
      .sort((x, y) => x.p.debut.localeCompare(y.p.debut));
    const nbChef = lignes.filter(x => x.role === ROLES_PROJET.CHEF).length;

    const actions = `<button class="btn" data-action="ouvrirObjectifs">Objectifs de l’équipe</button>
      <button class="btn primaire" data-action="nouveauProjet">+ Nouveau projet</button>`;
    const avertissement = !moi ? `<div class="carte" style="padding:14px 16px">Votre compte n’est lié à aucune fiche ressource.
      Demandez à votre équipe de créer votre fiche (Liste des ressources) avec votre email : le lien se fait à la connexion.</div>` : '';

    // Échelle de temps : du 1er du mois du début le plus tôt à la fin du mois de l'échéance la plus tardive
    let frise = '';
    if (lignes.length) {
      const debut = lignes.reduce((m, x) => x.p.debut < m ? x.p.debut : m, jour).slice(0, 8) + '01';
      const finMax = lignes.reduce((m, x) => x.p.fin > m ? x.p.fin : m, jour);
      const dFin = Calculs.depuisIso(finMax); const fin = Calculs.versIso(new Date(dFin.getFullYear(), dFin.getMonth() + 1, 0));
      const total = Calculs.ecartJours(debut, fin) + 1;
      const position = iso => Math.max(0, Math.min(100, Calculs.ecartJours(debut, iso) / total * 100));
      const mois = []; for (let d = Calculs.depuisIso(debut); Calculs.versIso(d) <= fin; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const nbJours = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        mois.push(`<div style="width:${nbJours / total * 100}%">${Calculs.MOIS_COURTS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}</div>`);
      }
      frise = `<div class="gantt-mois"><div class="libelle" style="padding:9px 16px;margin:0">Projet</div><div class="mois">${mois.join('')}</div></div>` +
        lignes.map(({ p, role }) => {
          const eq = equipe(p.equipeId), g = position(p.debut), l = position(p.fin) - g;
          return `<div class="gantt-ligne"><div><div>${C.code(p.code)} ${esc(p.nom)}</div>
              <div class="ligne-flex discret">${C.pastille(eq.couleur)}${esc(eq.nom)} ${C.badgeRef('role', role)}</div></div>
            <div class="gantt-piste"><div class="gantt-jour" style="left:${position(jour)}%"></div>
              <div class="gantt-barre" style="left:${g}%;width:${l}%;background:${C.teinte(eq.couleur, .12)}" data-action="ouvrirProjet" data-id="${p.id}"
                title="${Calculs.formatCourt(p.debut)} → ${Calculs.formatCourt(p.fin)}">
                <div class="gantt-plein" style="width:${Math.max(p.avancement, 8)}%;background:${eq.couleur}">${p.avancement}%</div></div></div></div>`;
        }).join('');
    }

    return `
    <div class="ecran">
      ${C.entete('Mes projets et Roadmap', `${lignes.length} projets dont ${nbChef} en tant que chef de projet · cliquez sur une barre pour mettre à jour l’avancement`, actions)}
      ${avertissement}
      <div class="carte">${frise || C.vide('Aucun projet daté où vous êtes affecté(e).')}</div>
      <div class="discret"><span style="color:var(--primaire)">—</span> Aujourd’hui, ${Calculs.formatCourt(jour)} &nbsp; Barre claire : durée planifiée · barre pleine : avancement</div>
    </div>`;
  }
};

Object.assign(Actions, {
  nouveauProjet: () => majEtat({ panneau: { type: 'nouveauProjet' } }),
  ouvrirObjectifs: () => majEtat({ modale: { type: 'objectifs' } })
});
