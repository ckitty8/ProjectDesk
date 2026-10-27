/* ============================================================
   Adresses des services Neon (Neon Auth et Data API)
   (portage de CONFIG.NEON_AUTH_URL / DATA_API_URL de app/js/config.js — phase 3 de la migration)
   ------------------------------------------------------------
   Ce sont des adresses publiques (pas des secrets) : la sécurité repose sur le jeton de connexion et les règles RLS en base.
   Les tests de bout en bout les redirigent vers le serveur simulé (tests/serveur-simule.js) avec window.CONFIG_SURCHARGE,
   comme pour l'ancienne application.
   ============================================================ */

export interface Adresses {
  NEON_AUTH_URL: string;
  DATA_API_URL: string;
}

declare global {
  interface Window {
    CONFIG_SURCHARGE?: Partial<Adresses>;
  }
}

const ADRESSES_PRODUCTION: Adresses = {
  NEON_AUTH_URL: 'https://ep-lucky-mud-b1gqp3gd.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth',
  DATA_API_URL: 'https://ep-lucky-mud-b1gqp3gd.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1'
};

/** Adresses à utiliser : celles de production, sauf surcharge posée par les tests */
export const adresses = (): Adresses => ({ ...ADRESSES_PRODUCTION, ...(typeof window === 'undefined' ? {} : window.CONFIG_SURCHARGE) });
