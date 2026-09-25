/* ============================================================
   « Espace demandeur » (maquette complements/espace-demandeur.png)
   Formulaire de demande (champs administrés) + suivi « Mes demandes ».
   FormulaireDemande est aussi utilisé par l'aperçu de Mon admin.
   ============================================================ */
'use strict';

const FormulaireDemande = {
  // Options d'un champ Liste : valeurs d'un référentiel, ou la liste des équipes
  options(champ) {
    if (champ.referentielId === 'equipes') return etat.d.equipes.map(e => ({ valeur: e.id, libelle: e.nom }));
    return valeursDe(champ.referentielId).map(v => v.libelle);
  },

  // HTML d'un champ ; nom du champ = son id (converti à l'envoi)
  champ(c, desactive = false) {
    const nom = `name="${c.id}"${c.obligatoire ? ' required' : ''}${desactive ? ' disabled' : ''}`;
    let saisie;
    switch (c.type) {
      case 'Texte long': saisie = `<textarea class="champ" rows="4" ${nom}></textarea>`; break;
      case 'Liste': saisie = C.liste([{ valeur: '', libelle: '—' }, ...this.options(c)], '', `class="champ" ${nom}`); break;
      case 'Date': saisie = `<input class="champ" type="date" ${nom}>`; break;
      case 'Nombre': saisie = `<input class="champ" type="number" step="0.1" min="0" ${nom}>`; break;
      case 'Fichier': saisie = `<div class="champ" style="height:auto;padding:12px;text-align:center;border-style:dashed;color:var(--discret)">
        Pièces jointes : stockage de fichiers prévu dans une prochaine version</div>`; break;
      default: saisie = `<input class="champ" ${nom}>`;
    }
    return `<div><label class="libelle">${C.esc(c.libelle)}${c.obligatoire ? ' *' : ''}</label>${saisie}</div>`;
  },

  rendre(desactive = false) {
    return etat.d.champs.map(c => this.champ(c, desactive)).join('');
  },

  // Données du formulaire -> ligne « demandes » (colonnes connues + jsonb « valeurs »)
  versDemande(form) {
    const f = new FormData(form); const demande = { valeurs: {} };
    etat.d.champs.forEach(c => {
      if (c.type === 'Fichier') return;
      let v = f.get(c.id); if (v === null) return;
      if (c.type === 'Nombre' && v !== '') v = Number(v);
      if (c.cle) demande[c.cle.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] = v;   // ex. date_souhaitee -> dateSouhaitee
      else if (v !== '') demande.valeurs[c.id] = v;
    });
    return demande;
  }
};

Ecrans.demandeur = {
  titre: 'Espace demandeur',
  rendre() {
    const esc = C.esc, moi = etat.session.user;
    const miennes = etat.d.demandes.filter(dm => dm.demandeurId === moi.id);
    return `
    <div style="min-height:100vh;background:var(--fond)">
      <header class="entete" style="background:var(--laterale);color:#fff;border:0">
        <b>${esc(CONFIG.NOM_APPLICATION)} · Espace demandeur</b>
        <span style="color:var(--laterale-texte)">${esc(moi.name || moi.email)} &nbsp;
          ${mesEquipes().length ? `<a data-action="aller" data-ecran="${etat.equipeCourante ? 'dashboard' : 'choixEquipe'}" style="color:#9DB6FF">Retour à l’application</a> &nbsp;` : ''}
          <a data-action="deconnexion" style="color:#9DB6FF">Déconnexion</a></span>
      </header>
      <div style="padding:24px;display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:16px;max-width:1280px;margin:0 auto">
        <form class="carte pile" style="padding:20px 22px" data-action-envoi="deposerDemande">
          <div><h1 style="font-size:18px">Nouvelle demande</h1><div class="sous-titre">Champs définis par l’administration · * obligatoire</div></div>
          <div><label class="libelle">Votre service</label><input class="champ" name="service" placeholder="ex. RH, Finance…"></div>
          ${FormulaireDemande.rendre()}
          <div style="text-align:right"><button class="btn primaire">Envoyer la demande</button></div>
        </form>
        <div class="carte" style="align-self:start">
          <div class="carte-titre"><b>Mes demandes</b><span class="discret">${miennes.length}</span></div>
          ${miennes.map(dm => `
            <div style="padding:12px 16px;border-bottom:1px solid var(--bordure-fine)">
              <div class="ligne-flex" style="justify-content:space-between">${C.code(Calculs.numeroDemande(dm.numero))}${C.badgeDemande(dm.statut)}</div>
              <div style="margin-top:4px">${esc(dm.titre)}</div>
              <div class="discret" style="font-size:12px">${esc(equipe(dm.equipeId).nom)} · envoyée le ${Calculs.formatCourt(dm.creeLe.slice(0, 10))}
                ${dm.commentaire && ['acceptee', 'refusee'].includes(dm.statut) ? ` · « ${esc(dm.commentaire)} »` : ''}</div>
            </div>`).join('') || C.vide('Aucune demande pour le moment.')}
        </div>
      </div>
    </div>`;
  }
};

Object.assign(Actions, {
  async deposerDemande(_, form) {
    const demande = FormulaireDemande.versDemande(form);
    demande.service = new FormData(form).get('service');
    demande.demandeurNom = etat.session.user.name || etat.session.user.email;
    if (await executer(() => Api.creer('demandes', demande), 'demandes')) notifier('Demande envoyée');
  }
});
