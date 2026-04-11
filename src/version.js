export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '6.0.1';
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'local';
export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date(0).toISOString();

export const RELEASE_NOTES = {
  '6.0.1': [
    'Suivi explicite de la version installée et du build.',
    'Détection d’une version distante plus récente.',
    'Actualisation forcée depuis le diagnostic sans purge manuelle du navigateur.',
  ],
};
