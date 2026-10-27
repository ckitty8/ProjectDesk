/* ============================================================
   Catalogue des composants (phase 4 de la migration) — adresse /composants
   ------------------------------------------------------------
   Page de référence pour les développeurs : chaque composant de base de src/composants/ avec ses variantes, sur des données
   d'exemple (aucune lecture en base). Elle sert aussi de contrôle visuel (capture dans docs/maquettes/catalogue-composants/).
   ============================================================ */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Aide } from '../composants/Aide';
import { Avatar, Badge, BadgeActif, BadgeFeuille, BadgeTon, Code, Pastille } from '../composants/Badge';
import { BandeauSimulation } from '../composants/BandeauSimulation';
import { Barre } from '../composants/Barre';
import { Bouton, BoutonIcone } from '../composants/Bouton';
import { Calendrier, NavigationMois } from '../composants/Calendrier';
import type { LigneCalendrier } from '../composants/Calendrier';
import { AucunOnglet, BarreOutils, Carte, EnteteEcran, Kpi, Vide } from '../composants/Carte';
import { Modale, Panneau } from '../composants/Fenetres';
import { NOMS_ICONES, Icone } from '../composants/Icone';
import { Liste } from '../composants/Liste';
import { Onglets } from '../composants/Onglets';
import { Tableau } from '../composants/Tableau';
import { contexteMois } from '../domaine/calendrier';
import { COULEURS, STATUTS_PROJET } from '../domaine/config';
import type { Ton } from '../domaine/config';
import { couleurStatutProjet } from '../domaine/couleurs';

/** Une section du catalogue : titre, exemple, et ce qu'il faut savoir pour s'en servir */
function Section({ titre, note, children }: { titre: string; note: string; children: ReactNode }) {
  return (
    <section aria-label={titre} className="section-catalogue">
      <h2>{titre}</h2>
      <p className="discret">{note}</p>
      {children}
    </section>
  );
}

const TONS_EXEMPLE: Ton[] = ['neutre', 'succes', 'info', 'attention', 'violet'];

const PERSONNES = [
  { id: '1', nom: 'Camille Laurent', poste: 'Cheffe de projet', actif: true },
  { id: '2', nom: 'Thomas Bernard', poste: 'Dév. back-end', actif: true },
  { id: '3', nom: 'Léa Moreau', poste: 'Dév. front-end', actif: false }
];

const TYPES_ABSENCE = [
  { libelle: 'Congés payés', couleur: '#0F8A6B', abrege: 'CP', actif: true },
  { libelle: 'Jours férié', couleur: '#8A93A3', abrege: 'JF', actif: true }
];

export function Catalogue() {
  const [onglet, setOnglet] = useState('a');
  const [liste, setListe] = useState('b');
  const [panneau, setPanneau] = useState(false);
  const [modale, setModale] = useState(false);
  const [mois, setMois] = useState({ annee: 2026, mois: 10 });
  const [ouverte, setOuverte] = useState<string | null>(null);

  const ctx = contexteMois(mois.annee, mois.mois, [{ jour: '2026-11-11', libelle: 'Armistice' }], TYPES_ABSENCE, [
    { ressourceId: '1', jour: '2026-11-03', type: 'Congés payés', duree: 1 },
    { ressourceId: '2', jour: '2026-11-04', type: 'Congés payés', duree: 0.5 }
  ], true);
  const lignes: LigneCalendrier[] = [
    { genre: 'groupe', id: 'g', contenu: <b>Plateforme</b>, niveau: 0 },
    ...PERSONNES.map(p => ({ genre: 'personne' as const, ressource: { id: p.id, nom: p.nom, dateNaissance: null }, niveau: 1, modifiable: true }))
  ];

  return (
    <main className="catalogue">
      <EnteteEcran titre="Catalogue des composants" sousTitre="Briques de base de la nouvelle application (phase 4 de la migration)"
        actions={<a href="/v2/session">Retour à la session</a>} />

      <Section titre="Boutons" note="Bouton (normal, primaire, succès, danger, petit) et BoutonIcone (le titre sert d'infobulle et de nom accessible).">
        <div className="ligne-flex">
          <Bouton>Normal</Bouton><Bouton variante="primaire">Primaire</Bouton><Bouton variante="succes">Succès</Bouton>
          <Bouton variante="danger">Danger</Bouton><Bouton petit>Petit</Bouton><Bouton disabled>Désactivé</Bouton>
          {NOMS_ICONES.map(nom => <BoutonIcone key={nom} icone={nom} titre={`Icône ${nom}`} />)}
          <Icone nom="projet" taille={24} />
        </div>
      </Section>

      <Section titre="Badges, pastilles, avatars" note="Badge (couleur libre), BadgeTon (palette), BadgeFeuille (statuts de feuille de temps), BadgeActif, Pastille, Avatar, Code.">
        <div className="ligne-flex">
          {TONS_EXEMPLE.map(ton => <BadgeTon key={ton} texte={ton} ton={ton} />)}
          <Badge texte="Couleur libre" couleur={COULEURS.orange} />
          {(['en_saisie', 'soumise', 'validee', 'a_completer'] as const).map(s => <BadgeFeuille key={s} statut={s} />)}
          <BadgeActif actif /><BadgeActif actif={false} />
          <Pastille couleur={COULEURS.primaire} /><Avatar nom="Camille Laurent" /><Avatar nom="Thomas Bernard" grand /><Code texte="VISTA" />
        </div>
      </Section>

      <Section titre="Barres de progression" note="Barre : pourcentage borné entre 0 et 100 ; la couleur suit le statut du projet (couleurStatutProjet).">
        {Object.values(STATUTS_PROJET).map((statut, i) => (
          <div key={statut} className="ligne-flex" style={{ maxWidth: 420 }}>
            <span style={{ width: 90 }}>{statut}</span><Barre pct={20 * (i + 1)} couleur={couleurStatutProjet(statut)} />
          </div>
        ))}
      </Section>

      <Section titre="Cartes et indicateurs" note="Carte, Kpi (avec bulle ⓘ), BarreOutils, Vide, AucunOnglet.">
        <div className="grille-kpi">
          <Kpi libelle="Projets actifs" valeur={12} complement="sur 15" aide="Projets dont le statut n’est pas « Terminé »." />
          <Kpi libelle="Avancement moyen" valeur="64%" />
        </div>
        <BarreOutils gauche={<><Liste valeur={liste} onChoisir={setListe} options={['a', { valeur: 'b', libelle: 'Option B' }, { valeur: 'c', libelle: 'Désactivée', desactive: true }]} />
          <span>Aide <Aide texte="Texte d’aide affiché au survol ou au clavier." /></span></>} droite={<Bouton variante="primaire">Action</Bouton>} />
        <Carte><Vide texte="Aucun élément à afficher." /></Carte>
        <AucunOnglet />
      </Section>

      <Section titre="Onglets" note="Onglets : liste { id, libelle, compte } ; l'écran garde l'onglet actif.">
        <Onglets liste={[{ id: 'a', libelle: 'Projets', compte: 12 }, { id: 'b', libelle: 'Équipe', compte: 4 }, { id: 'c', libelle: 'Sprints' }]}
          actif={onglet} onChoisir={setOnglet} />
        <p data-testid="onglet-actif">Onglet actif : {onglet}</p>
      </Section>

      <Section titre="Tableau" note="Tableau : colonnes décrites par { cle, titre, cellule } ; lignes cliquables (clavier compris) et grisables.">
        <Carte>
          <Tableau colonnes={[
            { cle: 'nom', titre: 'Nom', cellule: p => <span className="ligne-flex"><Avatar nom={p.nom} />{p.nom}</span> },
            { cle: 'poste', titre: 'Poste', cellule: p => p.poste },
            { cle: 'actif', titre: 'Statut', cellule: p => <BadgeActif actif={p.actif} libelles={['Actif', 'Inactif']} /> }
          ]} lignes={PERSONNES} idLigne={p => p.id} onOuvrir={p => setOuverte(p.nom)} inactive={p => !p.actif} />
        </Carte>
        <p data-testid="ligne-ouverte">{ouverte ? `Ligne ouverte : ${ouverte}` : 'Cliquez sur une ligne.'}</p>
      </Section>

      <Section titre="Panneau et fenêtre modale" note="Panneau (latéral) et Modale (centrée) : titre, croix ✕, voile cliquable, touche Échap, pied d'actions.">
        <div className="ligne-flex">
          <Bouton onClick={() => setPanneau(true)}>Ouvrir le panneau</Bouton>
          <Bouton onClick={() => setModale(true)}>Ouvrir la fenêtre</Bouton>
        </div>
        {panneau && (
          <Panneau titre="Projet VISTA" onFermer={() => setPanneau(false)} pied={<Bouton onClick={() => setPanneau(false)}>Fermer</Bouton>}>
            <p>Contenu du panneau.</p>
          </Panneau>
        )}
        {modale && (
          <Modale titre="Affectations de Thomas Bernard" onFermer={() => setModale(false)}
            pied={<><Bouton onClick={() => setModale(false)}>Annuler</Bouton><Bouton variante="primaire" onClick={() => setModale(false)}>Enregistrer</Bouton></>}>
            <p>Contenu de la fenêtre.</p>
          </Modale>
        )}
      </Section>

      <Section titre="Bandeau de simulation" note="BandeauSimulation : rôle simulé, changement de rôle, retour au rôle de créateur (affiché par l'application pendant une simulation).">
        <BandeauSimulation libelleRole="Utilisateur" nomPersonne="Thomas Bernard" onChanger={() => undefined} onArreter={() => undefined}
          choix={[{ valeur: 'projet|2', libelle: 'Projet — Thomas Bernard' }]} />
      </Section>

      <Section titre="Calendrier" note="Calendrier + NavigationMois : personnes × jours ; week-ends et jours fériés grisés, demi-journées « ½ », clic pour poser ou retirer une absence.">
        <BarreOutils gauche={<NavigationMois annee={mois.annee} mois={mois.mois} onChanger={(annee, m) => setMois({ annee, mois: m })} />} />
        <Carte><Calendrier ctx={ctx} lignes={lignes} onBasculer={(id, jour) => setOuverte(`absence ${id} ${jour}`)} /></Carte>
      </Section>
    </main>
  );
}
