const fr = {
  // App
  appName: "InsulinCalc",
  appSubtitle: "Calculateur d'insuline",
  glucides: "GLUCIDES",
  aliment: "aliment",
  aliments: "aliments",

  // Tabs
  tabRepas: "🍽 Repas",
  tabSaisie: "🩸 Saisie",
  tabResultat: "⚡ Résultat",
  tabJournal: "📋 Journal",
  tabParams: "⚙ Réglages",

  // Glycémie
  glycemie: "Glycémie",
  glycemieGL: "Glycémie (g/L)",
  poids: "Poids (kg)",
  poidsKg: "Poids",
  uniteGL: "g/L",
  uniteKg: "kg",
  min: "min",
  max: "max",
  unite: "unité",
  glycemieHorsBornes: "Glycémie hors bornes (0.3 — 6.0 g/L)",
  glycemieBasse: "Glycémie basse → adapter le délai",
  glycemieElevee: "Glycémie élevée → contrôler dans 2h",
  hypoglycemie: "Hypoglycémie — Prendre du sucre immédiatement",
  urgenceMedicale: "URGENCE MÉDICALE",
  correctionNecessaire: "correction nécessaire",
  hyperglycemie: "hyperglycémie",
  hyperSevere: "hyperglycémie sévère. Correction urgente + contrôle dans 1h.",
  urgenceMsg: "URGENCE MÉDICALE. Correction immédiate + consultez votre médecin / urgences si elle persiste.",
  hypoMsg: "Glycémie < 0.8 g/L — hypoglycémie. Prendre du sucre immédiatement.",

  // Glyc labels
  hypoSevere: "⚠ Hypoglycémie sévère",
  limiteBasse: "Limite basse",
  zoneCible: "✓ Zone cible",
  elevee: "Élevée",
  hyperglycemieLabel: "⚠ Hyperglycémie",
  hyperSevereLabel: "🚨 Hyper sévère",
  urgenceLabel: "🚨 URGENCE MÉDICALE",

  // Food / meal
  monRepas: "Mon repas",
  totalGlucides: "Total glucides",
  indexGlycemique: "INDEX GLYCÉMIQUE",
  graisses: "GRAISSES",
  vitesseDigestion: "Vitesse de digestion estimée",
  rechercherAliment: "🔍  Rechercher un aliment ou un plat...",
  ajouterAlimentPerso: "+ Ajouter un aliment personnalisé",
  mesAliments: "⭐ Mes aliments",
  recents: "🕐 Récents",
  suggestions: "💡 Suggestions",
  nouveauRepas: "🔄 Nouveau repas",
  nouveauRepasBtn: "Nouveau repas",

  // Digestion
  picMin: "Pic",
  finAction: "Fin",

  // Calculate
  calculer: "Calculer",
  calculerMsg: "Calculer — {carbs}g glucides · glycémie {glyc} g/L",
  saisissezGlycemie: "Saisissez votre glycémie",
  selectionnezAliments: "Sélectionnez des aliments",
  saisissezEtSelectionnez: "Saisissez glycémie + sélectionnez des aliments",

  // Result
  doseTotale: "Dose totale calculée",
  unitesTotales: "unités totales",
  doseInhabituelle: "Dose inhabituellement élevée ({dose} U > seuil {max} U) — Vérifiez vos paramètres ou consultez votre médecin.",
  bolusStandard: "💉 Bolus STANDARD — 1 injection",
  bolusDual: "⚡ Bolus DUAL — 2 injections",
  repas: "Repas",
  correction: "Correction",
  calendrierInjections: "📅 Calendrier d'injections",
  digestionLabel: "Digestion",
  avertissements: "Avertissements",
  recapitulatif: "Récapitulatif du repas",
  total: "Total",
  glucidesUnit: "glucides",
  disclaimerMedical: "⚕️ Ces calculs sont indicatifs. Ne modifiez jamais votre traitement sans l'accord de votre endocrinologue.",
  imprimerExporter: "🖨 Imprimer / Exporter",

  // Bolus types
  repasGras: "Repas gras → bolus en 2 phases",
  igEleve: "IG élevé → pic glycémique rapide (30–45 min)",
  doseElevee: "Dose élevée → consultez votre médecin",

  // Quantity
  quantite: "QUANTITÉ",

  // Journal
  journal: "Journal",
  entree: "entrée",
  entrees: "entrées",
  aucuneEntree: "Aucune entrée dans le journal",
  calculsAutoSave: "Les calculs effectués s'enregistrent automatiquement ici",
  exporterPdf: "📄 Exporter PDF",
  glycPre: "Glyc. pré",
  glycPost: "post",
  pasAliments: "Pas d'aliments enregistrés",
  doseSuggeree: "Dose suggérée",
  doseEffective: "Dose effective",
  modifierDose: "Modifier",

  // Saisie
  glycemieActuelle: "🩸 Glycémie actuelle",
  poidsCorporel: "⚖ Poids corporel",
  dosesSuggerees: "DOSES SUGGÉRÉES POUR {weight} KG",
  tddTotal: "TDD total/jour",
  basaleJour: "Basale / jour",
  ratioICR: "Ratio ICR",
  isfCorrection: "ISF correction",
  appliquerRatio: "✓ Appliquer ratio",
  appliquerISF: "✓ Appliquer ISF",
  valeursEstimatives: "⚕️ Valeurs estimatives — à valider avec votre endocrinologue.",
  zonesGlycemiques: "Zones glycémiques (g/L)",
  hypo: "Hypo",
  bas: "Bas",
  cible: "✓ Cible",
  eleve: "Élevé",
  hyper: "Hyper",
  severe: "Sévère",
  urgence: "Urgence",
  statut: "STATUT",
  ecartCible: "ÉCART / CIBLE",

  // Settings
  profil: "Profil",
  nomPatient: "Nom du patient",
  pourExportPdf: "Pour l'export PDF",
  afficheDansEntete: "Affiché dans l'en-tête du journal PDF exporté",
  apparence: "Apparence",
  modeSombre: "🌙 Mode sombre",
  modeClair: "☀️ Mode clair",
  basculerTheme: "Basculer entre thème clair et sombre",
  notifications: "Notifications",
  rappelPostRepas: "Rappel post-repas",
  rappelMesurer: "Rappel pour mesurer la glycémie après le repas",
  notifBloquees: "⚠ Notifications bloquées par le navigateur. Autorisez-les dans les paramètres.",
  delaiRappel: "Délai de rappel",
  parametresManuels: "Paramètres manuels",
  ratioInsulineGlucides: "Combien de grammes de glucides pour 1 unité d'insuline ?",
  facteurCorrection: "De combien baisse votre glycémie avec 1 unité d'insuline ?",
  glycemieCible: "Glycémie cible",
  glycemieCiblePlage: "Plage glycémique cible",
  cibleMin: "Min (g/L)",
  cibleMax: "Max (g/L)",
  correctionVers: "correction vers",
  votreCible: "Cible",
  digestionDefaut: "Vitesse de digestion par défaut",
  securite: "Sécurité",
  seuilAlerte: "Seuil d'alerte dose maximale",
  afficheAvertissement: "Affiche un avertissement si la dose dépasse ce seuil",
  langue: "Langue",
  francais: "Français",
  arabe: "العربية",

  // BMI / Body
  taille: "Taille (cm)",
  age: "Âge",
  sexe: "Sexe",
  homme: "Homme",
  femme: "Femme",
  imc: "IMC",
  surfaceCorporelle: "Surface corporelle",
  metabolismeBase: "Métabolisme de base",
  corpulence: "Corpulence",

  // Onboarding
  choixLangue: "Choisissez votre langue",
  choixLangueDesc: "Vous pourrez la modifier à tout moment dans les Réglages.",
  votreProfil: "Votre profil",
  votreProfilDesc: "Ces informations sont optionnelles mais améliorent la précision des calculs.",
  nomPlaceholder: "Votre nom ou prénom",
  optionnelPourPdf: "Optionnel · affiché dans l'export PDF",
  ans: "ans",
  bienvenue: "Votre poids",
  bienvenueDesc: "Le poids permet d'estimer vos doses d'insuline. Commençons par là.",
  votrePoids: "⚖ Votre poids (kg)",
  continuer: "Continuer →",
  ajustezParams: "Ajustez vos paramètres",
  modifierDansReglages: "Vous pouvez les modifier à tout moment dans Réglages",
  vousPret: "Vous êtes prêt !",
  resumeParams: "Voici le résumé de vos paramètres initiaux",
  retour: "← Retour",
  commencer: "🚀 Commencer",
  valeursEstim: "⚕️ Ces valeurs sont des estimations basées sur votre poids. Validez-les avec votre endocrinologue et ajustez-les dans Réglages.",

  // New onboarding keys
  onb_bienvenue: "Bienvenue",
  onb_tagline: "Calcul intelligent d'insuline pour diabète type 1",
  onb_disclaimer: "Cet outil ne remplace pas l'avis médical. Consultez toujours votre médecin.",
  onb_commencer: "Commencer",
  onb_profil: "Votre profil",
  onb_prenom: "Votre prénom",
  onb_age: "Âge",
  onb_sexe: "Sexe",
  onb_taille: "Taille (cm)",
  onb_poids: "Poids (kg)",
  onb_suivant: "Suivant",
  onb_precedent: "Précédent",
  onb_params: "Paramètres insuline",
  onb_ratio: "Ratio glucides",
  onb_ratio_desc: "1 unité pour X grammes de glucides",
  onb_isf: "Facteur de sensibilité",
  onb_isf_desc: "Baisse glycémie (mg/dL) par unité",
  onb_cible: "Glycémie cible (g/L)",
  onb_terminer: "Terminer la configuration",
  onb_step: "Étape",

  // Custom food form
  nomAliment: "Nom de l'aliment",
  glucidesParPortion: "Glucides par portion (g)",
  portionde: "Portion (ex: 1 part · 100g)",
  matieresGrasses: "Matières grasses",
  indexGI: "Index glycémique",
  note: "Note (optionnel)",
  enregistrer: "Enregistrer",
  annuler: "Annuler",
  nouvelAliment: "Nouvel aliment personnalisé",

  // Favorites
  repasAEnregistrer: "repas à enregistrer",
  enregistrerRepas: "💾 Enregistrer ce repas",
  nomDuRepas: "Nom du repas",
  repasFavoris: "⭐ Repas favoris",
  charger: "Charger",
  supprimer: "Supprimer",

  // GI labels
  igBas: "IG Bas",
  igMoy: "IG Moy",
  igHaut: "IG Haut",
  faible: "faible",
  moyen: "moyen",
  eleve_gi: "élevé",

  // Fat labels
  aucun: "aucun",

  // Timeline / Schedule
  auDebutRepas: "Au début du repas",
  minAvantRepas: "min avant le repas",
  minApresRepas: "min après le repas",
  hApresRepas: "h après le repas",
  pendantRepas: "Pendant le repas",
  bolusRepasCorrection: "Bolus repas + correction",
  phase1: "Phase 1 — glucides rapides (60%)",
  phase2: "Phase 2 — graisses (40%)",
  controlePic: "Contrôle — pic attendu",
  controleGraisses: "Contrôle — digestion graisses",
  controleFin: "Contrôle — fin d'action",
  unites: "unités",
  controleGlycemie: "Contrôler glycémie",

  // Post-meal corrector
  correcteurPostRepas: "Correcteur post-repas",
  glycemiePostRepas: "Glycémie post-repas",
  insulineRestante: "Insuline restante (IOB)",
  correctionSuggeree: "Correction suggérée",

  // Stats
  toutesEntrees: "Toutes les entrées",
  moyenne: "Moyenne",
  tirLabel: "Temps dans la cible",
  hba1cEstimee: "HbA1c estimée",

  // Journal stats
  resumeEvolution: "Évolution",
  enCible: "En cible",
  doseMoyenne: "Dose moy.",
  dosesChart: "Doses",
  cibleChart: "Cible",

  // Enregistrement explicite
  enregistre: "Enregistré",
  enregistrerDonnees: "Enregistrer les données",
  doseReellePrise: "Dose réellement prise",
  doseSuggereePar: "Dose suggérée",
  modifierSiBesoin: "modifiez si besoin",
  donneesSauvegardees: "Données sauvegardées dans le journal",
  glycPostRappel: "Pensez à mesurer votre glycémie ~2h après le repas",
  saisirGlycPost: "Glycémie post-repas",
  ajouter: "Ajouter",
  saisirDoseReelle: "Saisir dose réelle",

  // Greeting
  bonjour: "Bonjour",

  // Legal disclaimer
  disclaimerBanner: "Outil indicatif uniquement. Ne remplace pas l'avis médical. Consultez votre endocrinologue avant toute modification de traitement.",
  disclaimerFull: "Les doses et mesures affichées sont strictement à titre indicatif et ne constituent en aucun cas un avis médical. L'utilisateur est seul responsable de l'utilisation de ces informations. En cas de doute, contactez immédiatement votre médecin ou votre équipe soignante. Ne modifiez jamais votre traitement sans l'accord de votre endocrinologue.",
  contactMedecin: "En cas de doute, consultez votre médecin",

  // V4 new keys
  tabHome: "Accueil",
  tabTimeline: "Journée",
  bonjour: "Bonjour",
  derniereMesure: "Dernière mesure",
  ilYA: "il y a",
  heures: "heures",
  minutes: "minutes",
  ajouterGlycemie: "Glycémie",
  ajouterRepas: "Repas",
  ajouterInsuline: "Insuline",
  ajouterActivite: "Activité",
  tirLabel: "Temps dans la cible",
  moyenneGL: "Moyenne",
  hba1cEstimee: "HbA1c est.",
  mesures: "mesures",
  aujourdhui: "Aujourd'hui",
  hier: "Hier",
  pasDeRepasAujourdhui: "Aucun repas enregistré aujourd'hui",
  ajouterPremierRepas: "Ajouter votre premier repas",
  notifScheduled: "notifications programmées",
  rappelControle: "Contrôle glycémie prévu",
  rappelInjection: "Rappel injection",
  insulineActive: "Insuline active",
  mesurerMaintenant: "Mesurer maintenant",
  voirPlanning: "Voir le planning",

  // V4.2 — Injection tracking & correction
  correctionLabel: "Correction",
  basalLabel: "Basale",
  manualLabel: "Autre",
  injecterCorrection: "Enregistrer glycémie + injection correction",
  correctionConfirmee: "Correction sera enregistrée dans la timeline",
  resumeInsulineJour: "Résumé insuline du jour",
  enCours: "en cours",
  restant: "restant",
  etapes: "étapes",

  // V4.2 — Keto
  ketoCategory: "Keto & Low-Carb",
  saladeMarocaineCategory: "Salades marocaines",

  // V4.3 — Validation
  glycTropBasse: "Glycémie trop basse (min 0.3 g/L)",
  glycTropHaute: "Glycémie trop haute (max 6.0 g/L)",
  poidsHorsBornes: "Poids hors limites (15-300 kg)",
  ratioHorsBornes: "Ratio hors limites (1-50)",
  isfHorsBornes: "ISF hors limites (5-200 mg/dL)",
  doseNegative: "La dose ne peut pas être négative",
  doseAbsurde: "Dose anormalement élevée (> 100 U)",
  doseDepasseSeuil: "Dose dépasse le seuil de sécurité",
  ageHorsBornes: "Âge hors limites (1-120)",
  tailleHorsBornes: "Taille hors limites (50-250 cm)",

  // V4.3 — Export/Import
  sauvegardeRestauration: "Sauvegarde & Restauration",
  exporter: "Exporter",
  importer: "Importer",
  formatInvalide: "Format de fichier invalide",
  importReussi: "Import réussi",
  fichierCorrompu: "Fichier corrompu",

  // V4.3 — Tendances
  tendances: "Tendances",
  hypos: "Hypos",
  tendance: "Tendance",
  tempsDansCible: "Temps dans la cible",

  // V4.3 — Profils horaires
  profilsHoraires: "Profils horaires ICR/ISF",
  profilsHorairesDesc: "Ratios différents selon le moment de la journée",
  creneau: "Créneau",
  matin: "Matin",
  midi: "Midi",
  soir: "Soir",
  nuit: "Nuit",

  // V4.3 — Sécurité dose
  doseEleveeDetectee: "Dose élevée détectée",
  confirmerEnregistrer: "Confirmer et enregistrer",
  annulerVerifier: "Annuler et vérifier",
  verifierParametres: "Vérifiez vos paramètres",

  // V4.3 — Error boundary
  erreurInattendue: "Erreur inattendue",
  reessayer: "Réessayer",
  redemarrer: "Redémarrer l'application",

  // V4.3.1 — Timeline inline add, dose réelle, terminologie
  saisieRapide: "Saisie rapide glycémie / injection",
  doseReelle: "Dose réellement injectée",

  // V4.3.2 — PostMealCorrector, graphique évolution
  correcteurPostRepas: "Correcteur post-repas",
  tempsEcoule: "Temps écoulé depuis le repas",
  glycemiePostRepas: "Glycémie post-repas",
  insulineRestante: "Insuline restante (IOB)",
  votreCible: "Cible",
  aucuneCorrection: "Aucune correction nécessaire",
  enregistrerCorrection: "Enregistrer correction dans la timeline",
  resumeEvolution: "Évolution glycémique",

  // V4.4 — Photo repas, InjectionTracker, recherche
  photoRepas: "Photo du repas",
  prendrePhoto: "Photographier votre repas",
  iaReconnaitraAliments: "L'IA reconnaîtra les aliments",
  analyseEnCours: "Analyse en cours...",
  tapPourAjouter: "Tapez pour ajouter au repas",
  planInjection: "Plan d'injection",
  rechercherAliment: "Rechercher un aliment...",
  vider: "Vider",
  digestionHabituelle: "Digestion habituelle",

  // Clinical response
  cl_analyse: 'Analyse',
  cl_recommandation: 'Recommandation',
  cl_vigilance: 'Vigilance',
  cl_prochaineEtape: 'Prochaine étape',
  cl_analyser: 'Analyser',

  // Glycemia status
  cl_hypoSevere: 'Hypoglycémie sévère',
  cl_hypo: 'Hypoglycémie',
  cl_hypoProche: 'Glycémie basse',
  cl_cible: 'Dans la cible',
  cl_elevee: 'Glycémie élevée',
  cl_haute: 'Glycémie haute',
  cl_hyperSevere: 'Hyperglycémie sévère',
  cl_sousCible: 'Sous la cible',

  // Recommendation
  cl_doseUnique: 'Injection unique',
  cl_doseFractionnee: 'Injection fractionnée',
  cl_immediat: 'immédiat',
  cl_differe: 'différé',
  cl_fractionne: 'fractionné',
  cl_bolusRepas: 'Bolus repas',
  cl_correction: 'Correction',
  cl_bonusGras: 'Bonus gras',
  cl_iobSoustraite: 'IOB soustraite',

  // Safety
  cl_antiHypo: 'Ne pas injecter. Prendre 15g de sucre rapide.',
  cl_hypoProcheDose: 'Dose réduite de 50% (glycémie basse).',
  cl_antiStacking: 'insuline encore active. IOB déjà soustraite de la correction.',
  cl_alerteTiming: 'Dernière injection il y a moins de 2h. Prudence.',
  cl_surdosage: 'Dose dépasse le seuil de sécurité.',
  cl_surCorrection: 'Tendance à la baisse. Correction réduite.',
  cl_postKeto: 'Profil post-keto : attention aux hausses retardées.',
  cl_activiteModere: 'Activité modérée : dose réduite de 20%.',
  cl_activiteIntense: 'Activité intense : dose réduite de 30%.',

  // Next step
  cl_recontrole: 'Recontrôler la glycémie dans',
  cl_recontroleResucrage: 'Recontrôler dans {min} min après resucrage',
  cl_minutes: 'min',

  // IOB
  cl_iobActive: 'Insuline active',
  cl_unites: 'u',

  // Context
  cl_activite: 'Activité physique',
  cl_aucune: 'Aucune',
  cl_legere: 'Légère',
  cl_moderee: 'Modérée',
  cl_intense: 'Intense',

  // Trend
  cl_tendance: 'Tendance',
  cl_tendanceInconnue: 'Inconnue',

  // Meal input
  cl_modeExpert: 'Glucides directs',
  cl_modeAssiste: 'Base alimentaire',
  cl_glucidesTotal: 'Glucides totaux (g)',
  cl_niveauGras: 'Niveau de gras',

  // Settings - new fields
  cl_insulineBasale: 'Insuline basale',
  cl_insulineRapide: 'Insuline rapide',
  cl_doseBasale: 'Dose basale quotidienne',
  cl_profilPostKeto: 'Profil post-keto',
  cl_digestionLente: 'Digestion lente habituelle',
  cl_dureeAction: "Durée d'action insuline rapide",

  // Consultation
  cl_consultation: 'Consultation',
  cl_journal: 'Journal',
  cl_reglages: 'Réglages',

  // Post-prandial
  cl_postPrandialGood: 'Bonne correction',
  cl_postPrandialUnder: 'Sous-corrigé',
  cl_postPrandialOver: 'Sur-corrigé',

  // Hardcoded strings fix
  cl_glucides: 'glucides',
  cl_gras: 'Gras',
  enregistrerInjecter: '💉 Enregistrer & Injecter',
  prendreUnePhoto: 'Prendre une photo',
  choisirDepuisAlbum: "Choisir depuis l'album",
  nonTrouveDansBase: 'non trouvé dans la base',
  fatAucun: 'Aucun',
  fatFaible: 'Faible',
  fatMoyen: 'Moyen',
  fatEleve: 'Élevé',
  aucunAlimentReconnu: 'Aucun aliment reconnu',
  essayerAutrePhoto: 'Essayez avec une autre photo ou ajoutez manuellement',
  alimentsDetectes: 'aliment(s) détecté(s)',
};

export default fr;
