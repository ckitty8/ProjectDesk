/* ============================================================
   Écran « Choix de l'équipe » (maquette complements/choix-equipe.png)
   Invitations reçues, équipes de l'utilisateur. Compte sans équipe : message « compte créé, en
   attente d'accès » et bouton Actualiser (maquette docs/maquettes/comptes-en-attente/) — l'accès
   est donné par un administrateur dans Administration › Comptes en attente.
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
      const nbPers = ressourcesActives().filter(r => r.equipeId === e.id).length;
      const nbProj = etat.d.projets.filter(p => p.equipeId === e.id).length;
      const courante = e.id === etat.equipeCourante;
      return `
      <div class="carte-choix" ${courante ? 'style="border-color:#B7C8F5;background:#F3F6FF"' : ''}>${C.pastille(e.couleur)}
        <div style="flex:1"><b>${esc(e.nom)}</b> ${e.actif === false ? C.badgeActif(false) : ''}<div class="discret" style="font-size:12px">
          ${nbPers} personnes · ${nbProj} projets · rôle ${esc(etat.rolesEquipe[e.id] || 'member')}</div></div>
        <button class="btn ${courante ? 'primaire' : ''}" data-action="ouvrirEquipe" data-id="${e.id}">Ouvrir</button>
      </div>`;
    }).join('');
    if (!equipes && !invitations && !etat.estAdmin) return this.enAttente(prenom);
    return `
    <div class="plein-ecran"><div class="carte boite large">
      <div class="ligne-flex" style="justify-content:space-between"><h1>Bonjour ${esc(prenom)}</h1><a data-action="deconnexion">Déconnexion</a></div>
      <div class="sous-titre" style="margin-bottom:20px">Choisissez l’équipe dans laquelle vous travaillez. Vous pourrez en changer à tout moment.</div>
      ${invitations ? `<div class="libelle">Invitations reçues</div><div class="pile" style="margin-bottom:20px">${invitations}</div>` : ''}
      <div class="libelle">Mes équipes</div>
      <div class="pile" style="margin-bottom:20px">${equipes || C.vide('Vous n’êtes membre d’aucune équipe pour le moment.')}</div>
      ${etat.estAdmin && !mesEquipes().length ? `<div class="discret" style="font-size:12.5px">Les équipes sont créées dans l’Administration.
        <a data-action="aller" data-ecran="monAdmin">Ouvrir l’administration</a></div>` : ''}
    </div></div>`;
  },

  // Compte créé mais pas encore d'équipe : l'administrateur voit la demande (Comptes en attente)
  enAttente(prenom) {
    const esc = C.esc;
    return `
    <div class="plein-ecran"><div class="carte boite large">
      <div class="ligne-flex" style="justify-content:space-between"><h1>Bonjour ${esc(prenom)}</h1><a data-action="deconnexion">Déconnexion</a></div>
      <div class="carte" style="padding:14px 16px;margin:14px 0;background:#F3F6FF;border-color:#B7C8F5">
        <b>Votre compte est créé.</b> Il reste une étape : un administrateur doit vous donner accès à votre équipe.
        <div class="discret" style="margin-top:6px">Votre demande apparaît déjà dans son Administration (compte <b>${esc(etat.session.user.email)}</b>).
          Vous n’avez rien d’autre à faire.</div></div>
      <div class="ligne-flex"><button class="btn primaire" data-action="reessayer">Actualiser</button>
        <span class="discret" style="font-size:12.5px">dès que l’accès est donné, cliquez ici ou reconnectez-vous</span></div>
      <div style="border-top:1px solid var(--bordure-fine);padding-top:14px;margin-top:18px;font-size:12.5px" class="discret">
        Ce n’est pas le bon compte ? Si vous en avez créé plusieurs (email personnel et professionnel), connectez-vous avec
        celui donné à votre responsable.</div>
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
