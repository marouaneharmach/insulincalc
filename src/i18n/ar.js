const ar = {
  // App
  appName: "InsulinCalc",
  appSubtitle: "حاسبة الأنسولين",
  glucides: "الكربوهيدرات",
  aliment: "مكوّن",
  aliments: "مكوّنات",

  // Tabs
  tabRepas: "🍽 الوجبة",
  tabSaisie: "🩸 الإدخال",
  tabResultat: "⚡ النتيجة",
  tabJournal: "📋 السجل",
  tabParams: "⚙ الإعدادات",

  // Glycémie
  glycemie: "نسبة السكر",
  glycemieGL: "نسبة السكر (غ/ل)",
  poids: "الوزن (كغ)",
  poidsKg: "الوزن",
  uniteGL: "غ/ل",
  uniteKg: "كغ",
  min: "أدنى",
  max: "أقصى",
  unite: "وحدة",
  glycemieHorsBornes: "نسبة السكر خارج النطاق (0.3 — 6.0 غ/ل)",
  glycemieBasse: "نسبة السكر منخفضة ← عدّل التوقيت",
  glycemieElevee: "نسبة السكر مرتفعة ← راقب بعد ساعتين",
  hypoglycemie: "نقص السكر — خذ سكر فوراً",
  urgenceMedicale: "حالة طوارئ طبية",
  correctionNecessaire: "تصحيح ضروري",
  hyperglycemie: "ارتفاع السكر",
  hyperSevere: "ارتفاع حاد في السكر. تصحيح عاجل + مراقبة بعد ساعة.",
  urgenceMsg: "حالة طوارئ طبية. تصحيح فوري + استشر طبيبك / الطوارئ إذا استمر.",
  hypoMsg: "نسبة السكر < 0.8 غ/ل — نقص السكر. خذ سكر فوراً.",

  // Glyc labels
  hypoSevere: "⚠ نقص حاد في السكر",
  limiteBasse: "الحد الأدنى",
  zoneCible: "✓ المنطقة المستهدفة",
  elevee: "مرتفعة",
  hyperglycemieLabel: "⚠ ارتفاع السكر",
  hyperSevereLabel: "🚨 ارتفاع حاد",
  urgenceLabel: "🚨 حالة طوارئ طبية",

  // Food / meal
  monRepas: "وجبتي",
  totalGlucides: "مجموع الكربوهيدرات",
  indexGlycemique: "مؤشر السكر",
  graisses: "الدهون",
  vitesseDigestion: "سرعة الهضم المقدّرة",
  ajouterAlimentPerso: "+ أضف مكوّن مخصص",
  mesAliments: "⭐ مكوّناتي",
  recents: "🕐 الأخيرة",
  suggestions: "💡 اقتراحات",
  nouveauRepas: "🔄 وجبة جديدة",
  nouveauRepasBtn: "وجبة جديدة",

  // Digestion
  picMin: "ذروة",
  finAction: "نهاية",

  // Calculate
  calculer: "احسب",
  calculerMsg: "احسب — {carbs}غ كربوهيدرات · سكر {glyc} غ/ل",
  saisissezGlycemie: "أدخل نسبة السكر",
  selectionnezAliments: "اختر المكوّنات",
  saisissezEtSelectionnez: "أدخل نسبة السكر + اختر المكوّنات",

  // Result
  doseTotale: "الجرعة الإجمالية المحسوبة",
  unitesTotales: "وحدات إجمالية",
  doseInhabituelle: "جرعة مرتفعة بشكل غير عادي ({dose} و > حد {max} و) — تحقق من إعداداتك أو استشر طبيبك.",
  bolusStandard: "💉 بولس عادي — حقنة واحدة",
  bolusDual: "⚡ بولس مزدوج — حقنتان",
  repas: "الوجبة",
  correction: "التصحيح",
  calendrierInjections: "📅 جدول الحقن",
  digestionLabel: "الهضم",
  avertissements: "التحذيرات",
  recapitulatif: "ملخص الوجبة",
  total: "المجموع",
  glucidesUnit: "كربوهيدرات",
  disclaimerMedical: "⚕️ هذه الحسابات إرشادية. لا تغيّر علاجك بدون موافقة طبيب الغدد.",
  imprimerExporter: "🖨 طباعة / تصدير",

  // Bolus types
  repasGras: "وجبة دسمة ← بولس على مرحلتين",
  igEleve: "مؤشر سكر مرتفع ← ذروة سريعة (30–45 دقيقة)",
  doseElevee: "جرعة مرتفعة ← استشر طبيبك",

  // Quantity
  quantite: "الكمية",

  // Journal
  journal: "السجل",
  entree: "إدخال",
  entrees: "إدخالات",
  aucuneEntree: "لا توجد إدخالات في السجل",
  calculsAutoSave: "الحسابات تُسجّل تلقائياً هنا",
  exporterPdf: "📄 تصدير PDF",
  glycPre: "سكر قبل",
  glycPost: "بعد",
  pasAliments: "لا توجد مكوّنات مسجّلة",
  doseSuggeree: "الجرعة المقترحة",
  doseEffective: "الجرعة الفعلية",
  modifierDose: "تعديل",

  // Saisie
  glycemieActuelle: "🩸 نسبة السكر الحالية",
  poidsCorporel: "⚖ وزن الجسم",
  dosesSuggerees: "الجرعات المقترحة لوزن {weight} كغ",
  tddTotal: "الجرعة اليومية",
  basaleJour: "القاعدية / يوم",
  ratioICR: "نسبة ICR",
  isfCorrection: "تصحيح ISF",
  appliquerRatio: "✓ تطبيق النسبة",
  appliquerISF: "✓ تطبيق ISF",
  valeursEstimatives: "⚕️ قيم تقديرية — يجب التحقق منها مع طبيب الغدد.",
  zonesGlycemiques: "مناطق السكر (غ/ل)",
  hypo: "نقص",
  bas: "منخفض",
  cible: "✓ هدف",
  eleve: "مرتفع",
  hyper: "فرط",
  severe: "حاد",
  urgence: "طوارئ",
  statut: "الحالة",
  ecartCible: "الفرق / الهدف",

  // Settings
  profil: "الملف الشخصي",
  nomPatient: "اسم المريض",
  pourExportPdf: "للتصدير PDF",
  afficheDansEntete: "يظهر في رأس السجل PDF المُصدّر",
  apparence: "المظهر",
  modeSombre: "🌙 الوضع الداكن",
  modeClair: "☀️ الوضع الفاتح",
  basculerTheme: "التبديل بين الوضع الفاتح والداكن",
  notifications: "الإشعارات",
  rappelPostRepas: "تذكير بعد الوجبة",
  rappelMesurer: "تذكير لقياس السكر بعد الوجبة",
  notifBloquees: "⚠ الإشعارات محظورة من المتصفح. فعّلها من الإعدادات.",
  autoriserNotifications: "السماح بالإشعارات",
  notifActivees: "الإشعارات مفعّلة",
  delaiRappel: "مهلة التذكير",
  parametresManuels: "الإعدادات اليدوية",
  ratioInsulineGlucides: "كم غرام من الكربوهيدرات لوحدة أنسولين واحدة؟",
  facteurCorrection: "بكم ينخفض السكر مع وحدة أنسولين واحدة؟",
  glycemieCible: "نسبة السكر المستهدفة",
  glycemieCiblePlage: "نطاق السكر المستهدف",
  cibleMin: "الحد الأدنى (غ/ل)",
  cibleMax: "الحد الأقصى (غ/ل)",
  correctionVers: "تصحيح نحو",
  digestionDefaut: "سرعة الهضم الافتراضية",
  securite: "الأمان",
  seuilAlerte: "حد التنبيه للجرعة القصوى",
  afficheAvertissement: "يعرض تحذيراً إذا تجاوزت الجرعة هذا الحد",
  langue: "اللغة",
  francais: "Français",
  arabe: "العربية",

  // BMI / Body
  taille: "الطول (سم)",
  age: "العمر",
  sexe: "الجنس",
  homme: "ذكر",
  femme: "أنثى",
  imc: "مؤشر كتلة الجسم",
  surfaceCorporelle: "مساحة الجسم",
  metabolismeBase: "التمثيل الغذائي الأساسي",
  corpulence: "البنية الجسدية",

  // Onboarding
  choixLangue: "اختر لغتك",
  choixLangueDesc: "يمكنك تغييرها في أي وقت من الإعدادات.",
  votreProfil: "ملفك الشخصي",
  votreProfilDesc: "هذه المعلومات اختيارية لكنها تحسّن دقة الحسابات.",
  nomPlaceholder: "اسمك أو لقبك",
  optionnelPourPdf: "اختياري · يظهر في تصدير PDF",
  ans: "سنة",
  bienvenue: "وزنك",
  bienvenueDesc: "يُستخدم الوزن لتقدير جرعات الأنسولين. لنبدأ من هنا.",
  votrePoids: "⚖ وزنك (كغ)",
  continuer: "← متابعة",
  ajustezParams: "اضبط إعداداتك",
  modifierDansReglages: "يمكنك تعديلها في أي وقت من الإعدادات",
  vousPret: "أنت مستعد!",
  resumeParams: "ملخص إعداداتك الأولية",
  retour: "رجوع →",
  commencer: "🚀 ابدأ",
  valeursEstim: "⚕️ هذه القيم تقديرية بناءً على وزنك. تحقق منها مع طبيب الغدد واضبطها في الإعدادات.",

  // New onboarding keys
  onb_bienvenue: "مرحبا",
  onb_tagline: "حساب ذكي للأنسولين لمرضى السكري النوع 1",
  onb_disclaimer: "هذه الأداة لا تغني عن الاستشارة الطبية. استشر طبيبك دائماً.",
  onb_commencer: "ابدأ",
  onb_profil: "ملفك الشخصي",
  onb_prenom: "اسمك الأول",
  onb_age: "العمر",
  onb_sexe: "الجنس",
  onb_taille: "الطول (سم)",
  onb_poids: "الوزن (كغ)",
  onb_suivant: "التالي",
  onb_precedent: "السابق",
  onb_params: "إعدادات الأنسولين",
  onb_ratio: "نسبة الكربوهيدرات",
  onb_ratio_desc: "وحدة واحدة لكل X غرام من الكربوهيدرات",
  onb_isf: "عامل الحساسية",
  onb_isf_desc: "انخفاض السكر (ملغ/دل) لكل وحدة",
  onb_cible: "السكر المستهدف (غ/ل)",
  onb_profil_desc: "المعلومات الأساسية ونوع الأنسولين",
  onb_params_desc: "قيم مسبقة — يمكن تعديلها لاحقاً",
  onb_disclaimer_title: "تحذير طبي",
  onb_disclaimer_head: "هذه الأداة لا تغني عن المتابعة الطبية",
  onb_disc_1: "الجرعات المحسوبة هي اقتراحات مبنية على إعداداتك.",
  onb_disc_2: "تحقق دائماً من الجرعات مع طبيب السكري أو طبيبك المعالج.",
  onb_disc_3: "في حالة الشك أو ظهور أعراض غير عادية، استشر مختصاً صحياً.",
  onb_disc_4: "لا تغيّر علاجك أبداً بدون استشارة طبية.",
  onb_accept: "أفهم أن هذه الأداة هي مساعد حسابي وليست جهازاً طبياً معتمداً. أستخدم هذه البيانات تحت مسؤوليتي الشخصية.",
  onb_terminer: "إنهاء الإعداد",
  onb_step: "خطوة",

  // Custom food form
  nomAliment: "اسم المكوّن",
  glucidesParPortion: "كربوهيدرات لكل حصة (غ)",
  portionde: "الحصة (مثال: 1 قطعة · 100غ)",
  matieresGrasses: "الدهون",
  indexGI: "مؤشر السكر",
  note: "ملاحظة (اختياري)",
  enregistrer: "حفظ",
  nouvelAliment: "مكوّن مخصص جديد",

  // Favorites
  repasAEnregistrer: "وجبة للحفظ",
  enregistrerRepas: "💾 حفظ هذه الوجبة",
  nomDuRepas: "اسم الوجبة",
  repasFavoris: "⭐ الوجبات المفضلة",
  charger: "تحميل",
  supprimer: "حذف",

  // GI labels
  igBas: "IG منخفض",
  igMoy: "IG متوسط",
  igHaut: "IG مرتفع",
  faible: "منخفض",
  moyen: "متوسط",
  eleve_gi: "مرتفع",

  // Fat labels
  aucun: "بدون",

  // Timeline / Schedule
  auDebutRepas: "في بداية الوجبة",
  minAvantRepas: "دقيقة قبل الوجبة",
  minApresRepas: "دقيقة بعد الوجبة",
  hApresRepas: "ساعة بعد الوجبة",
  pendantRepas: "أثناء الوجبة",
  bolusRepasCorrection: "بولس الوجبة + التصحيح",
  phase1: "المرحلة 1 — كربوهيدرات سريعة (60%)",
  phase2: "المرحلة 2 — دهون (40%)",
  controlePic: "مراقبة — الذروة المتوقعة",
  controleGraisses: "مراقبة — هضم الدهون",
  controleFin: "مراقبة — نهاية المفعول",
  unites: "وحدات",
  correctionSuggeree: "التصحيح المقترح",

  // Stats
  toutesEntrees: "كل الإدخالات",
  moyenne: "المتوسط",
  tirLabel: "الوقت في النطاق",
  hba1cEstimee: "HbA1c المقدّرة",

  // Journal stats
  enCible: "في النطاق",
  doseMoyenne: "متوسط الجرعة",
  dosesChart: "الجرعات",
  cibleChart: "النطاق المستهدف",

  // Enregistrement explicite
  enregistre: "تم الحفظ",
  enregistrerDonnees: "حفظ البيانات",
  doseReellePrise: "الجرعة المأخوذة فعلياً",
  doseSuggereePar: "الجرعة المقترحة",
  modifierSiBesoin: "عدّل إذا لزم الأمر",
  donneesSauvegardees: "تم حفظ البيانات في السجل",
  glycPostRappel: "تذكّر قياس السكر بعد ~ساعتين من الوجبة",
  saisirGlycPost: "سكر الدم بعد الوجبة",
  ajouter: "إضافة",
  saisirDoseReelle: "إدخال الجرعة الفعلية",

  // Greeting
  bonjour: "مرحباً",

  // Legal disclaimer
  disclaimerBanner: "أداة إرشادية فقط. لا تغني عن الاستشارة الطبية. استشر طبيب الغدد قبل أي تعديل في العلاج.",
  disclaimerFull: "الجرعات والقياسات المعروضة هي لأغراض إرشادية فقط ولا تشكل بأي حال استشارة طبية. المستخدم هو المسؤول الوحيد عن استخدام هذه المعلومات. في حالة الشك، اتصل فوراً بطبيبك أو فريقك الطبي. لا تغيّر علاجك أبداً بدون موافقة طبيب الغدد.",
  contactMedecin: "في حالة الشك، استشر طبيبك",

  // V4 new keys
  tabHome: "الرئيسية",
  tabTimeline: "اليوم",
  derniereMesure: "آخر قياس",
  ilYA: "منذ",
  heures: "ساعات",
  minutes: "دقائق",
  ajouterGlycemie: "نسبة السكر",
  ajouterRepas: "الوجبة",
  ajouterInsuline: "الأنسولين",
  ajouterActivite: "النشاط",
  moyenneGL: "المتوسط",
  mesures: "قياسات",
  aujourdhui: "اليوم",
  hier: "أمس",
  pasDeRepasAujourdhui: "لم يتم تسجيل أي وجبة اليوم",
  ajouterPremierRepas: "أضف وجبتك الأولى",
  notifScheduled: "إشعارات مجدولة",
  rappelControle: "قياس السكر المقرر",
  rappelInjection: "تذكير الحقن",
  insulineActive: "الأنسولين النشط",
  mesurerMaintenant: "قياس الآن",
  voirPlanning: "عرض الجدول",

  // V4.2 — Injection tracking & correction
  correctionLabel: "تصحيح",
  basalLabel: "قاعدية",
  manualLabel: "أخرى",
  injecterCorrection: "تسجيل السكر + حقنة تصحيح",
  correctionConfirmee: "سيتم تسجيل التصحيح في الجدول الزمني",
  resumeInsulineJour: "ملخص الأنسولين اليومي",
  enCours: "جارٍ",
  restant: "متبقي",
  etapes: "خطوات",

  // V4.2 — Keto
  ketoCategory: "كيتو ومنخفض الكربوهيدرات",
  saladeMarocaineCategory: "سلطات مغربية",

  // V4.3 — Validation
  glycTropBasse: "سكر الدم منخفض جداً (الحد الأدنى 0.3)",
  glycTropHaute: "سكر الدم مرتفع جداً (الحد الأقصى 6.0)",
  poidsHorsBornes: "الوزن خارج الحدود (15-300 كغ)",
  ratioHorsBornes: "النسبة خارج الحدود (1-50)",
  isfHorsBornes: "عامل الحساسية خارج الحدود (5-200)",
  doseNegative: "الجرعة لا يمكن أن تكون سلبية",
  doseAbsurde: "جرعة مرتفعة بشكل غير طبيعي (> 100)",
  doseDepasseSeuil: "الجرعة تتجاوز حد الأمان",
  ageHorsBornes: "العمر خارج الحدود (1-120)",
  tailleHorsBornes: "الطول خارج الحدود (50-250 سم)",

  // V4.3 — Export/Import
  sauvegardeRestauration: "النسخ الاحتياطي والاستعادة",
  exporter: "تصدير",
  importer: "استيراد",
  formatInvalide: "تنسيق ملف غير صالح",
  importReussi: "تم الاستيراد بنجاح",
  fichierCorrompu: "ملف تالف",

  // V4.3 — Tendances
  tendances: "الاتجاهات",
  hypos: "نقص السكر",
  tendance: "الاتجاه",
  tempsDansCible: "الوقت في النطاق المستهدف",

  // V4.3 — Profils horaires
  profilsHoraires: "ملفات النسب حسب الوقت",
  profilsHorairesDesc: "نسب مختلفة حسب وقت اليوم",
  creneau: "الفترة",
  matin: "صباح",
  midi: "ظهر",
  soir: "مساء",
  nuit: "ليل",

  // V4.3 — Sécurité dose
  doseEleveeDetectee: "تم اكتشاف جرعة عالية",
  annulerVerifier: "إلغاء والتحقق",
  verifierParametres: "تحقق من إعداداتك",

  // V4.3 — Error boundary
  erreurInattendue: "خطأ غير متوقع",
  reessayer: "إعادة المحاولة",
  redemarrer: "إعادة تشغيل التطبيق",

  // V4.3.1
  saisieRapide: "إدخال سريع للسكر / الحقنة",

  // V4.3.2
  correcteurPostRepas: "مصحح ما بعد الوجبة",
  tempsEcoule: "الوقت المنقضي منذ الوجبة",
  glycemiePostRepas: "سكر ما بعد الوجبة",
  insulineRestante: "الأنسولين المتبقي",
  votreCible: "الهدف",
  aucuneCorrection: "لا حاجة للتصحيح",
  enregistrerCorrection: "تسجيل التصحيح في الجدول الزمني",
  resumeEvolution: "تطور السكر",

  // V4.4
  prendrePhoto: "التقاط صورة للوجبة",
  iaReconnaitraAliments: "الذكاء الاصطناعي سيتعرف على الأطعمة",
  rechercherAliment: "البحث عن طعام...",
  vider: "إفراغ",
  digestionHabituelle: "الهضم المعتاد",

  // Clinical response
  cl_analyse: 'التحليل',
  cl_recommandation: 'التوصية',
  cl_vigilance: 'الحذر',
  cl_prochaineEtape: 'الخطوة التالية',
  cl_analyser: 'تحليل',

  // Glycemia status
  cl_hypoSevere: 'انخفاض حاد في السكر',
  cl_hypo: 'انخفاض السكر',
  cl_hypoProche: 'سكر منخفض',
  cl_cible: 'في النطاق المستهدف',
  cl_elevee: 'سكر مرتفع',
  cl_haute: 'سكر مرتفع جداً',
  cl_hyperSevere: 'ارتفاع حاد في السكر',
  cl_sousCible: 'تحت المستهدف',

  // Recommendation
  cl_doseUnique: 'حقنة واحدة',
  cl_doseFractionnee: 'حقنة مجزأة',
  cl_immediat: 'فوري',
  cl_differe: 'مؤجل',
  cl_fractionne: 'مجزأ',
  cl_bolusRepas: 'جرعة الوجبة',
  cl_correction: 'التصحيح',
  cl_bonusGras: 'إضافة الدهون',
  cl_iobSoustraite: 'الأنسولين النشط المخصوم',

  // Safety
  cl_antiHypo: 'لا تحقن. تناول 15غ من السكر السريع.',
  cl_hypoProcheDose: 'الجرعة مخفضة 50% (سكر منخفض).',
  cl_antiStacking: 'أنسولين نشط. تم خصمه من التصحيح.',
  cl_alerteTiming: 'آخر حقنة منذ أقل من ساعتين. توخ الحذر.',
  cl_surdosage: 'الجرعة تتجاوز حد الأمان.',
  cl_surCorrection: 'اتجاه نحو الانخفاض. تصحيح مخفض.',
  cl_postKeto: 'نظام كيتو سابق: انتبه للارتفاعات المتأخرة.',
  cl_activiteModere: 'نشاط معتدل: جرعة مخفضة 20%.',
  cl_activiteIntense: 'نشاط مكثف: جرعة مخفضة 30%.',

  // Next step
  cl_recontrole: 'أعد قياس السكر خلال',
  cl_recontroleResucrage: 'أعد القياس بعد {min} دقيقة من تناول السكر',
  cl_minutes: 'د',

  // IOB
  cl_iobActive: 'الأنسولين النشط',
  cl_unites: 'و',

  // Context
  cl_activite: 'النشاط البدني',
  cl_aucune: 'لا شيء',
  cl_legere: 'خفيف',
  cl_moderee: 'معتدل',
  cl_intense: 'مكثف',

  // Trend
  cl_tendance: 'الاتجاه',
  cl_tendanceInconnue: 'غير معروف',

  // Meal input
  cl_modeExpert: 'كربوهيدرات مباشرة',
  cl_modeAssiste: 'قاعدة الأغذية',
  cl_glucidesTotal: 'إجمالي الكربوهيدرات (غ)',
  cl_niveauGras: 'مستوى الدهون',

  // Settings - new fields
  cl_insulineBasale: 'الأنسولين القاعدي',
  cl_insulineRapide: 'الأنسولين السريع',
  cl_doseBasale: 'الجرعة القاعدية اليومية',
  cl_profilPostKeto: 'نظام كيتو سابق',
  cl_digestionLente: 'هضم بطيء معتاد',
  cl_dureeAction: 'مدة تأثير الأنسولين السريع',

  // Consultation
  cl_accueil: 'الصفحة الرئيسية',
  cl_journal: 'السجل',
  cl_reglages: 'الإعدادات',

  // Post-prandial
  cl_postPrandialGood: 'تصحيح جيد',
  cl_postPrandialUnder: 'تصحيح ناقص',
  cl_postPrandialOver: 'تصحيح زائد',

  // Hardcoded strings fix
  cl_glucides: 'كربوهيدرات',
  cl_gras: 'دهون',
  enregistrerInjecter: '💉 تسجيل والحقن',
  prendreUnePhoto: 'التقاط صورة',
  choisirDepuisAlbum: 'اختيار من الألبوم',
  nonTrouveDansBase: 'غير موجود في القاعدة',
  fatAucun: 'لا شيء',
  fatFaible: 'منخفض',
  fatMoyen: 'متوسط',
  fatEleve: 'مرتفع',
  aucunAlimentReconnu: 'لم يتم التعرف على أي طعام',
  essayerAutrePhoto: 'جرب صورة أخرى أو أضف يدويًا',
  alimentsDetectes: 'أطعمة تم اكتشافها',
  totalLipides: 'إجمالي الدهون',

  // V5.7 — AI recognition enhancements
  tapPourAjouter: 'انقر للإضافة إلى الوجبة',
  analyseEnCours: 'جاري التحليل...',
  estimationIA: 'تقدير الذكاء الاصطناعي',
  valeurImplausible: 'قيم غير معتادة — تحقق من التقديرات',
  ajouterAuRepas: 'إضافة إلى الوجبة',
  sauvegarderAlimentPerso: 'حفظ كطعام مخصص',
  poidsEstime: 'الوزن المقدر',
  annuler: 'إلغاء',

  // V5.7 — Extended injection plan
  planInjection: 'خطة الحقن',
  nouvelleConsultation: 'استشارة جديدة',
  phaseTerminee: 'المرحلة مكتملة',
  marquerFait: 'وضع علامة مكتمل',
  phasesCompletees: 'مراحل مكتملة',
  doseTotal: 'الجرعة الإجمالية',
  dansXmin: 'في {0} دقيقة',
  controleGlycemie: 'فحص السكر',

  // V5.7 — Fat calculation
  bonusGrasContinu: 'مكافأة الدهون المستمرة',
  fatGramsLabel: 'غ دهون',

  // V5.7 — Journal & timeline
  estimationIAMarker: '(تقدير ذكاء اصطناعي)',
  photoRepas: 'صورة الوجبة',
  etendu3Phases: '(ممتد 3 مراحل)',
  doseReelle: 'الجرعة الفعلية المحقونة',
  notes: 'ملاحظات',
  optionnel: 'اختياري',
  notesPlaceholder: 'توتر، مرض، سياق...',
  confirmerEnregistrer: '💉 تأكيد',

  // V5.7 — Glycemic prediction
  predictionPostRepas: 'توقع ما بعد الوجبة',
  glycemiePrevue: 'السكر المتوقع بعد ساعتين',
  bilanJournalier: 'الحصيلة اليومية',
  tempsEnCible: 'الوقت في النطاق',
  moyenneGlycemie: 'متوسط السكر',
  nbInjections: 'الحقن',
  totalGlucidesJour: 'كربوهيدرات اليوم',
};

export default ar;
