/* ============================================================
   Écran « Choix de l'équipe » (maquette complements/choix-equipe.png)
   Invitations reçues, équipes de l'utilisateur, accès demandeur.
   ============================================================ */
'use strict';

Ecrans.choixEquipe = {
  titre: 'Choix de l’équipe',
  rendre() {
    const esc = C.esc;
    const prenom = (etat.session.user.name || '').split(' ')[0];
    const invitations = etat.invitations.map(i => `
      <div class="carte-choix invitation">${C.pastille('#7A3FC2')}
        <div style="flex:1"><b>${esc(i.organizationName || 'Équipe')}</b>
          <div class="discret" style="font-size:12px">Invitation · rôle ${esc(i.role)}</div></div>
        <button class="btn" data-action="refuserInvitation" data-id="${i.id}">Refuser</button>
        <button class="btn primaire" data-action="accepterInvitation" data-id="${i.id}">Accepter</button>
      </div>`).join('');
    const equipes = mesEquipes().map(e => {
      const nbPers = etat.d.ressources.filter(r => r.equipeId === e.id).length;
      const nbProj = etat.d.projets.filter(p => p.equipeId === e.id).length;
      const courante = e.id === etat.equipeCourante;
      return `
      <div class="carte-choix" ${courante ? 'style="border-color:#B7C8F5;background:#F3F6FF"' : ''}>${C.pastille(e.couleur)}
        <div style="flex:1"><b>${esc(e.nom)}</b><div class="discret" style="font-size:12px">
          ${nbPers} personnes · ${nbProj} projets · rôle ${esc(etat.rolesEquipe[e.id] || 'member')}</div></div>
        <button class="btn ${courante ? 'primaire' : ''}" data-action="ouvrirEquipe" data-id="${e.id}">Ouvrir</button>
      </div>`;
    }).join('');
    return `
    <div class="plein-ecran"><div class="carte boite large">
      <div class="ligne-flex" style="justify-content:space-between"><h1>Bonjour ${esc(prenom)}</h1><a data-action="deconnexion">Déconnexion</a></div>
      <div class="sous-titre" style="margin-bottom:20px">Choisissez l’équipe dans laquelle vous travaillez. Vous pourrez en changer à tout moment.</div>
      ${invitations ? `<div class="libelle">Invitations reçues</div><div class="pile" style="margin-bottom:20px">${invitations}</div>` : ''}
      <div class="libelle">Mes équipes</div>
      <div class="pile" style="margin-bottom:20px">${equipes || C.vide('Vous n’êtes membre d’aucune équipe pour le moment.')}</div>
      <div style="border-top:1px solid var(--bordure-fine);padding-top:16px;font-size:12.5px" class="discret">
        <b style="color:var(--texte)">Vous n’êtes membre d’aucune équipe ?</b> Vous pouvez tout de même
        <a data-action="aller" data-ecran="demandeur">déposer une demande</a> et suivre son traitement.<br>
        Les équipes sont créées par un administrateur (menu Administration).
        ${etat.estAdmin && !mesEquipes().length ? `<br><a data-action="aller" data-ecran="monAdmin">Ouvrir l’administration</a>` : ''}
      </div>
    </div></div>`;
  }
};

Object.assign(Actions, {
  // Ouvre une équipe : mémorisée sur le poste et déclarée « active » côté Neon Auth
  async ouvrirEquipe(d) {
    ecrireMemoire('equipe', d.id);
    Api.activerOrganisation(d.id).catch(() => {});
    majEtat({ equipeCourante: d.id, ecran: 'dashboard' });
  },
  async accepterInvitation(d) {
    try { await Api.accepterInvitation(d.id); notifier('Invitation acceptée'); await demarrer(); }
    catch (e) { notifier(e.message, 'erreur'); }
  },
  async refuserInvitation(d) {
    try { await Api.refuserInvitation(d.id); await demarrer(); } catch (e) { notifier(e.message, 'erreur'); }
  }
});
