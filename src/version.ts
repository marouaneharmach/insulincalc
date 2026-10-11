export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '7.0.0';
export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'local';
export const BUILD_DATE: string = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date(0).toISOString();

export const RELEASE_NOTES: Record<string, string[]> = {
  '7.0.0': [
    'Garde-fous cliniques restaurés : mode nuit, anti-empilement, score de risque hypo, vitesse glycémique, détection de tendances.',
    'Journal illimité sur IndexedDB, journées en heure locale, identifiants uniques, sauvegarde complète validée.',
    'Rapports : temps en cible (consensus international), GMI, variabilité, profil AGP, pistes d’ajustement.',
    'Profils d’insuline, mode Ramadan (IDF-DAR), parcours hypoglycémie, suivi de la basale, import CSV capteur.',
    'Rappels persistés (2e injection, contrôle post-repas), plafond de dose avec confirmation, clé API saisie dans Réglages.',
    'Accessibilité : tailles de texte, contrastes, étiquettes, interrupteurs, zoom autorisé ; arabe complété.',
  ],
  '6.0.2': [
    'Profils horaires ratio/ISF réellement appliqués au calcul de dose.',
    'Réduction « tendance baissière » basée sur la correction nette (IOB déduit).',
    'Feedback post-repas aligné sur vos cibles personnalisées.',
    'Message explicite lorsque l’injection est bloquée par une règle de sécurité.',
  ],
};
