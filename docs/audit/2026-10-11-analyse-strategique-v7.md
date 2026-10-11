# InsulinCalc — Analyse approfondie et feuille de route v7

**Date** : 11 octobre 2026
**Version auditée** : 6.0.2 (branche `main`, commit `6d35eb8`)
**Périmètre** : code source, moteur clinique, données, sécurité, UX/accessibilité, i18n, PWA, chaîne de build/CI, documentation
**Référentiels** : consensus international Time in Range (Battelino 2019), ADA Standards of Care 2025, ISPAD 2022, IDF-DAR 2021 (Ramadan), AGP/GMI (Bergenstal), IEC 62304, ISO 14971, IEC 62366-1, EU MDR 2017/745, OWASP ASVS/MASVS, WCAG 2.2 AA, ISO/IEC 25010, loi marocaine 09-08 (CNDP), RGPD art. 9

---

## 0. Résumé exécutif

InsulinCalc est une PWA React/Vite solide dans ses fondations : moteur clinique isolé en fonctions pures, 450 tests verts, lint propre, build reproductible avec versionnement du service worker, bilingue FR/AR, base de 445 aliments marocains. Le niveau est nettement supérieur à la moyenne des calculateurs amateurs.

Cinq constats structurants ressortent de l'audit :

| # | Constat | Gravité | Effet patient |
|---|---------|---------|---------------|
| 1 | **Régression fonctionnelle massive lors de la migration v6.0.0** : score de risque hypo, mode nocturne, vitesse glycémique, détection de 6 patterns, tableau de bord, rapport médical 5 pages et ~100 tests ont été supprimés du dépôt (commit `5dd472f`). Seule la fonctionnalité F6 (profils horaires) de la spec endocrinologique du 3 avril a survécu. | Critique | Perte des garde-fous nocturnes et anti-empilement conçus pour éviter les hypoglycémies matinales |
| 2 | **Clé API Groq embarquée dans le bundle livré** et photos de repas envoyées à un tiers américain sans consentement explicite ni politique de confidentialité. | Critique | Exposition de données de santé, abus de la clé, non-conformité 09-08 / RGPD |
| 3 | **Incohérences de données silencieuses** : journées calculées en UTC (décalage à Casablanca), identifiants mixtes nombre/chaîne qui excluent des entrées du PDF, journal plafonné à 200 entrées (environ 6 semaines), migration v4→v5 jamais exécutée en production. | Haute | Statistiques fausses, rapport médecin incomplet, perte d'historique |
| 4 | **Rappels d'injection différée non fiables** : basés sur `setTimeout` en page, ils meurent dès que le téléphone se verrouille. C'est pourtant le rappel le plus critique de l'application (2e partie du bolus fractionné). | Haute | Oubli de la 2e injection → hyperglycémie post-prandiale |
| 5 | **Dette d'architecture** qui freine toute évolution : composant racine à 25 états et 40 props transmises, deux schémas de journal (v4/v5) cohabitant, deux modèles d'IOB, 5 composants et un store entiers morts, zéro TypeScript, zéro attribut d'accessibilité. | Moyenne | Vélocité en baisse, risque de bug à chaque ajout |

**Recommandation** : geler les nouvelles fonctionnalités pendant un lot « sécurisation » de 2 à 3 semaines (constats 1 à 4), puis engager une refonte des fondations (TypeScript, store, IndexedDB, i18n, accessibilité, E2E) avant d'aborder l'excellence clinique (AGP, GMI, mode Ramadan, profils d'insuline, import CGM). Le détail est en section 6.

---

## 1. État des lieux mesuré

### 1.1 Chiffres clés

| Indicateur | Valeur | Commentaire |
|------------|--------|-------------|
| Lignes source + tests (src/) | ≈ 11 500 | 24 composants, 11 utilitaires, 3 hooks |
| Fichiers de tests / cas | 18 / 450 | Tous verts (vitest 4.1) |
| Lint | 0 erreur, 0 warning | ESLint 9 flat config |
| Bundle JS / CSS (gzip) | 121 kB / 10 kB | Un seul chunk, pas de code splitting |
| Dépendances runtime | 3 | dont `clarifai-nodejs-grpc` **inutilisée** (lib Node/gRPC dans une app navigateur) |
| Vulnérabilités `npm audit` | 21 (1 critique, 13 hautes) | 8 en prod, toutes via `clarifai-nodejs-grpc` ; 13 dev via `vite` (correctif disponible) |
| Clés i18n FR / AR | 456 / 456 | Synchronisées, mais ≈ 30 chaînes et 13 messages cliniques codés en dur en français |
| Attributs ARIA | 0 | Aucun `aria-*`, aucun `role` |
| Base aliments | 445 | Spécifique Maroc, qualité correcte |
| Commits / PR fusionnées | 119 / 15 | Vélocité élevée, 0 issue ouverte, 0 PR ouverte |

### 1.2 Architecture actuelle

```
index.html → main.jsx (migration légère) → <ErrorBoundary><App/>
App.jsx (25 useLocalStorage, orchestration, journal, notifications)
 ├─ Onboarding (3 étapes)
 ├─ ConsultationScreen ── GlycemiaInput / MealInput / ContextInput / ClinicalResponse
 │     └─ utils/clinicalEngine.analyzeAndRecommend (pur)  ← iobCurve, timeProfileDefaults, dosePlan
 ├─ DayTimeline (journal du jour, stats 30 j, GlycEvolutionChart, saisie rapide, FAB injection)
 ├─ PdfExport (vue imprimable)
 ├─ Settings ── TimeProfiles / VersionPanel / DataExport
 └─ BottomNav3
Persistance : localStorage (préfixe insulincalc_v4_), 25 clés indépendantes
Build : Vite 8 + Tailwind 4 ; SW généré par plugin maison ; version.json ; GitHub Pages
```

Points forts à préserver : le moteur `clinicalEngine.js` est pur, documenté, testé ; le mécanisme de versionnement/mise à jour forcée (v6.0.1) est de bonne facture ; la matrice de non-régression et les changelogs existent.

---

## 2. Constat majeur : la régression de la migration v6.0.0

Le commit `5dd472f` (« audit complet v6.0.0 — migration racine », 10 avril 2026) a remplacé l'arborescence racine par celle du dossier `v4/`. Or la racine contenait, depuis le 3 avril, l'implémentation des phases 1 à 5 de la spec `docs/specs/2026-04-03-analyse-endocrinologique-profil.md`. Ces fichiers ont été supprimés et ne sont référencés nulle part dans la v6 :

| Fonctionnalité spec | Fichiers supprimés | Tests perdus | Présent en 6.0.2 ? |
|---------------------|-------------------|--------------|--------------------|
| F1 Anti-empilement (cumul 24 h, règle IOB dynamique) | `clinicalEngine.js` (règle `cumul_high`, `tddEstimated`) | oui | **Non** (seul un warning IOB > 2 U subsiste) |
| F2 Mode nocturne (blocage correction < 1,50 g/L, demi-dose, collation) | `isNightMode`, `NightModeIndicator.jsx` | oui | **Non** |
| F3 Vitesse glycémique | `utils/velocity.js`, `VelocityIndicator.jsx` | 8 cas | **Non** (tendance saisie à la main) |
| F4 Score de risque hypo | `utils/hypoRisk.js`, `HypoRiskBadge.jsx` | 5 cas | **Non** |
| F5 Patterns avancés (aube, hypo matinale, Somogyi, sur-correction, créneau, empilement) | `utils/patternDetector.js`, `PatternAlerts.jsx` | 14 cas | **Non** (`calculations.detectPatterns` legacy, non branché) |
| F7 Journal enrichi | `JournalEntryForm.jsx`, `JournalTab.jsx` | 7 cas | Partiel |
| F9 Alertes prédictives (vélocité + IOB) | `predictGlycemia` | oui | Remplacé par un modèle qui ignore IOB, graisses et tendance |
| F10 Rapport médecin 5 pages | `utils/exportPdf.js` (600 lignes, `generateMedicalReport`) | — | Remplacé par une vue imprimable 1 page |
| Tableau de bord accueil, Time in Range, jauge | `Dashboard.jsx`, `TimeInRange.jsx`, `GlycemiaGauge.jsx` | 16 cas d'intégration | **Non** |

Le changelog v6.0.2 note honnêtement que « F8 n'est pas implémentée » mais ne mentionne pas la perte de F1 à F5, F9 et F10. Les changelogs v5.5 à v5.6 et le `git log` (« feat: add Hypo Risk Score », « feat: add Night Mode ») laissent croire que ces fonctions sont livrées.

**Bonne nouvelle** : tout est récupérable dans l'historique git (`git show 5dd472f^:src/utils/hypoRisk.js`, etc.). La logique est en fonctions pures, donc réintégrable dans le moteur v6 avec ses tests, moyennant l'adaptation aux noms de champs v5 (`glycPre`, `doseReelle`).

---

## 3. Analyse par domaine face aux standards

### 3.1 Sécurité clinique et pertinence médicale

Ce qui est conforme aux bonnes pratiques :
- Blocage anti-hypo < 0,70 g/L, demi-dose entre 0,70 et 0,90, règle sur-correction basée sur la correction nette (corrigé en 6.0.2).
- Seuil 0,54 g/L = hypoglycémie de niveau 2 (consensus ADA).
- IOB selon courbe triangulaire de Walsh, DIA paramétrable, déduction de l'IOB uniquement sur la correction (pas sur le bolus repas) : correct.
- Fractionnement du bolus selon lipides et glucides, plan étendu 3 phases pour les repas riches (couscous, tajines) : pertinent pour le contexte marocain.
- Disclaimer à l'onboarding avec acceptation obligatoire.

Écarts par rapport aux standards :

| Écart | Référence | Fichier |
|-------|-----------|---------|
| Garde-fous nocturnes, cumul de corrections et score de risque absents (cf. §2) | ADA 2025 §6 hypoglycémie, ISPAD 2022 | `clinicalEngine.js` |
| Aucun plafond de dose absolu ni seuil personnalisé : `OverdoseDialog` existe mais n'est branché nulle part ; `maxDose` n'existe plus dans les réglages. Seul un avertissement > 25 U subsiste. La matrice de non-régression cite pourtant « Dose élevée confirmée par l'utilisateur ». | IEC 62304 (mitigation des risques), pratique des pompes (max bolus) | `OverdoseDialog.jsx`, `ConsultationScreen.jsx` |
| Time in Range calculé sur 4 définitions différentes : 1,0–1,8 g/L figé (`journalStore.getStats`, `glycColor`), cible patient 1,0–1,2 (`computeDailySummary`, stats 30 j, `PdfExport`). Le consensus international définit TIR = 0,70–1,80 g/L, TBR < 0,70 (< 4 %) et < 0,54 (< 1 %), TAR > 1,80 (< 25 %) et > 2,50 (< 5 %), CV ≤ 36 %. La cible de correction (1,0–1,2) est confondue avec la plage TIR. | Battelino et al., Diabetes Care 2019 | `journalStore.js:91`, `clinicalEngine.js:565`, `DayTimeline.jsx:322`, `PdfExport.jsx:40` |
| HbA1c « estimée » via formule ADAG sur des glycémies capillaires ponctuelles pré/post-repas : biais systématique. Le standard actuel est le GMI (3,31 + 0,02392 × glycémie moyenne mg/dL), valide seulement avec un CGM ≥ 14 jours. À défaut, afficher « indicatif » et exiger une couverture minimale. | Bergenstal 2018, ADA 2025 §6 | `DayTimeline.jsx:355`, `PdfExport.jsx:66` |
| Prédiction post-repas à +2 h présentée avec 2 décimales alors que le modèle ignore IOB, lipides, activité, tendance. Fausse précision. | Principe d'honnêteté des aides à la décision (IEC 62366-1) | `clinicalEngine.js:predictPostMealGlycemia` |
| IOB et « dernière injection » calculés à partir de `mountTime` et jamais rafraîchis : sur une PWA laissée ouverte, l'IOB affiché est surestimé et l'alerte timing fausse. | — | `ConsultationScreen.jsx:22-101` |
| Un seul profil d'insuline rapide (pic 75 min) quel que soit le produit saisi (NovoRapid, Humalog, Fiasp, Lyumjev, Apidra ont des cinétiques différentes). Le champ « insuline rapide » est purement déclaratif. | Notices produit, ISPAD 2022 | `iobCurve.js`, `Settings.jsx` |
| Pas de parcours de traitement de l'hypoglycémie (règle des 15), pas de règles « jours de maladie », pas de gestion de l'activité planifiée, pas de suivi de la basale (dose saisie mais jamais rappelée ni journalisée). | ADA 2025, ISPAD 2022 | — |
| Aucun mode Ramadan alors que l'application cible le Maroc : stratification du risque, ajustement des doses (réduction basale, bolus iftar/suhoor), heures décalées. | IDF-DAR Practical Guidelines 2021 | — |
| Messages de sécurité du moteur uniquement en français : un patient arabophone voit « Glycémie < 0.70 g/L — Ne pas injecter » en français. | IEC 62366-1 (compréhension des alertes) | `clinicalEngine.js` (13 messages) |

### 3.2 Exactitude des données et persistance

| Problème | Détail | Impact |
|----------|--------|--------|
| Jours en UTC | `selectedDate` et `computeDailySummary` utilisent `toISOString()` (UTC). À Casablanca (UTC+1, UTC+0 pendant le Ramadan), une saisie entre 00 h 00 et 01 h 00 est rangée la veille. | Bilan journalier et timeline faux en bordure de nuit, précisément là où le risque est maximal |
| Identifiants hétérogènes | `App.jsx` → `Date.now()` (nombre) ; `DayTimeline` saisie rapide → `Date.now()+1` ; FAB → `` `manual-${Date.now()}` `` (chaîne) ; `journalStore` → base36. `PdfExport` filtre `e.id >= thirtyDaysAgo` et `DataExport` trie `b.id - a.id`. | Injections manuelles exclues du PDF médecin ; tri d'import instable |
| Plafond 200 entrées | `slice(0, 200)` dans 4 endroits. À 5 saisies/jour, l'historique couvre ≈ 40 jours. | Impossible de produire un AGP 90 jours ; perte silencieuse de données de santé |
| Migration v4→v5 inopérante | `main.jsx` écrit `insulincalc_v4_app_version = 6.0.2` **avant** le rendu ; l'effet de `App.jsx` lit cette valeur et `needsMigration('6.0.2')` renvoie toujours `false`. `migrateAllEntries` ne s'exécute jamais en production (les tests unitaires passent car ils l'appellent directement). | Les anciennes entrées gardent leurs champs v4, chaque composant doit maintenir des `??` de repli |
| Deux schémas de journal | Champs v4 (`preMealGlycemia`, `doseCalculated`, `totalCarbs`, `doseSuggested`, `doseActual`) et v5 (`glycPre`, `doseSuggeree`, `totalGlucides`, `doseReelle`) coexistent dans le même tableau ; `glycPre` est tantôt nombre, tantôt chaîne `"1.20"`. | Bugs de comparaison, code défensif partout |
| Sauvegarde incomplète | `DataExport` exporte une liste de clés figée (`version: '4.3.0'`), sans `dia`, `basalDose`, `insulinBasal/Rapid`, `postKeto`, `slowDigestion`, `onboarded`, et importe n'importe quel JSON sans validation de schéma directement dans localStorage. | Restauration partielle ; corruption possible |
| Pas de versionnement de schéma, pas de synchronisation multi-onglets, pas de chiffrement au repos | Données de santé en clair, lisibles par toute extension ou XSS. | Confidentialité |
| Onboarding vs réglages incohérents | Ratio 3–30 et ISF 10–100 à l'onboarding, 5–25 et 20–100 dans les réglages ; poids/taille stockés en nombre par l'un, en chaîne par l'autre. | Valeur affichée différente de la valeur stockée |

### 3.3 Sécurité applicative et confidentialité

| Point | État | Standard |
|-------|------|----------|
| Clé Groq | `VITE_GROQ_API_KEY` injectée au build, donc lisible dans `index-*.js` par quiconque ouvre les outils de développement. Déjà signalé dans le changelog 6.0.2, non traité. | OWASP ASVS V2/V6 : aucun secret côté client |
| Photos de repas | Envoyées à api.groq.com (États-Unis) sans écran de consentement, sans politique de confidentialité, sans mention dans le disclaimer. | Loi 09-08 (CNDP, transfert hors Maroc), RGPD art. 9 et 44 |
| Dépendance morte vulnérable | `clarifai-nodejs-grpc` (1 critique) inutilisée depuis le passage à Groq. | OpenSSF Scorecard |
| CSP | Aucune `Content-Security-Policy`, même en `<meta>`. Scripts et polices externes (Google Fonts) chargés à chaque visite, ce qui casse aussi le premier rendu hors ligne. | OWASP, PWA checklist |
| Verrouillage | Aucun code PIN / biométrie (WebAuthn) alors que le journal contient nom, âge, glycémies, doses. | MASVS-STORAGE |
| CI | Les tests ne tournent que sur `push main` (job de déploiement) : une PR cassée est fusionnée avant d'être testée. Pas de Dependabot, pas de tags de release, pas de CODEOWNERS. | SLSA niveau 1, GitHub best practices |

### 3.4 Architecture et qualité du code

- **God component** : `App.jsx` porte 25 états persistés et transmet jusqu'à 40 props à `Settings` et 20 à `ConsultationScreen`. Aucun contexte ni store. Toute nouvelle préférence impose 4 modifications.
- **Code mort** (≈ 1 200 lignes) : `GlycemiaChart`, `DoseAnimation`, `PhotoMeal`, `OverdoseDialog`, `ExtendedPlan` ne sont importés nulle part ; `data/journalStore.js` entier (le journal passe par `useLocalStorage`) ; `calculations.js` conserve `detectPatterns`, `estimateHbA1c`, `buildSchedule`, `calcPostMealCorrection`, `calcWeightSuggestions` et un **second modèle d'IOB** (puissance 1,5) contradictoire avec Walsh ; `notifications.scheduleFromPlan` ; état `favorites` ; `App.css` est le template Vite (hero, counter).
- **Doubles chemins de migration** : `main.jsx` et `App.jsx` (cf. §3.2).
- **Pas de typage** : unités (g/L vs mg/dL, minutes vs heures) portées par convention. L'ISF est stocké en mg/dL et divisé par 100 à un seul endroit (`ConsultationScreen.jsx:132`) ; les profils horaires et la prédiction supposent chacun une unité. Un bug de facteur 100 a déjà eu lieu (audit du 7 avril).
- **Tests** : bonne couverture du moteur, mais plusieurs tests de « conformité spec » sont tautologiques (`expect(15).toBe(15)`), aucun test E2E, 2 composants testés sur 24, pas de seuil de couverture, et ≈ 100 cas perdus (§2). Pas de tests de la timeline UTC, des identifiants, de la migration réelle.
- **Build** : avertissement `INEFFECTIVE_DYNAMIC_IMPORT` sur `foodRecognition.js` ; `foods.js` (445 entrées) et les deux dictionnaires i18n sont dans le chunk principal.
- **Documentation** : le `README.md` décrit encore l'architecture v1 (index.html + CDN + Babel, « pas de données stockées »), ce qui est faux depuis la v4. `CLAUDE.md` exige une documentation à chaque mise à jour : la régression v6 n'est pas documentée.

### 3.5 UX, accessibilité, internationalisation

| Thème | Constat | Standard |
|-------|---------|----------|
| Zoom bloqué | `maximum-scale=1.0, user-scalable=no` | WCAG 2.2 critère 1.4.4 (échec) |
| Tailles de police | Usage massif de `text-[8px]` à `text-[11px]` ; population cible incluant des seniors et des patients avec rétinopathie. | WCAG 1.4.4, bonnes pratiques santé (min 14–16 px) |
| Contraste | `text-slate-400` (#94A3B8) sur blanc = 2,9:1 pour des libellés de champ. | WCAG 1.4.3 (min 4,5:1) |
| Sémantique | 0 `aria-*`, interrupteurs faits de `<button>` sans `role="switch"`/`aria-checked`, listes déroulantes non navigables au clavier, icônes emoji sans texte alternatif, statut glycémique porté par la couleur seule. | WCAG 1.3.1, 1.4.1, 4.1.2 |
| Parcours | Pas d'annulation après enregistrement, pas de confirmation à la modification d'une dose, pas d'état vide guidé, pas de recherche dans le journal, pas de filtre par type, pas de vue semaine. | Heuristiques Nielsen 3 et 5 |
| Arabe | Onboarding forcé en `dir="ltr"` ; dates et heures en `fr-FR` dans `PdfExport`, `VersionPanel`, `ExtendedPlan`, `GlycEvolutionChart` ; ≈ 30 chaînes codées en dur (« Heure », « Total », « Repas », « Glyc. pré », « Profil médical », « Sauvegarde & Restauration », « Exporter/Importer », « Maintenant »...) ; chiffres arabes/latins non gérés. | i18n : ICU MessageFormat, `Intl.DateTimeFormat` avec locale courante |
| Notifications | Rappels via `setTimeout` : perdus à la fermeture de l'onglet ou au verrouillage ; icône `/icon-192.png` supprimée en v6 ; le réglage affiche « fonctionnalité en cours de développement ». | Service Worker + Notification Triggers / Push, persistance du planning |
| Mode nuit | Thème sombre géré, mais pas de `prefers-color-scheme` ni de rendu système. | — |

---

## 4. Ce que font les références mondiales

Pour calibrer les propositions, voici les traits communs des solutions reconnues (mySugr, Glooko, Dexcom Clarity, Nightscout/AndroidAPS, Diabeo, Omnipod/Tandem bolus calculators) :

1. **Vocabulaire et rapports standardisés** : AGP (profil ambulatoire médian + percentiles 10/25/75/90 sur 14 à 90 jours), TIR/TBR/TAR avec codes couleur normalisés, GMI, CV %, jours de données et % de port.
2. **Calculateur de bolus régulé** : plafonds de dose, IOB visible en permanence, courbes d'action par insuline, cibles par plage horaire, cibles exercice/sommeil, prise en compte de la tendance CGM, journal d'audit des recommandations et des doses réellement prises.
3. **Sécurité des données** : chiffrement, verrouillage, consentement granulaire, hébergement de santé, export interopérable (FHIR, CSV), partage sécurisé avec le soignant.
4. **Qualité logicielle** : TypeScript strict, tests E2E, CI sur chaque PR, releases taguées, journal des modifications, matrice de traçabilité exigences → tests (IEC 62304).
5. **Accessibilité et inclusion** : WCAG AA, tailles de police dynamiques, modes daltoniens, langues locales.
6. **Contexte local** : modules Ramadan (IDF-DAR), bases alimentaires régionales (ce que fait déjà InsulinCalc, et c'est son avantage différenciant).

---

## 5. Vision cible v7

### 5.1 Principes

1. **Safety first** : aucune suggestion de dose sans garde-fous nocturnes, plafond, IOB fraîche et message de sécurité dans la langue de l'utilisateur.
2. **Une seule source de vérité** : schéma de journal unique, typé, versionné, migré de manière testée ; unités explicites.
3. **Moteur clinique = bibliothèque pure** : réutilisable, publiable, testable sans DOM, avec traçabilité exigence → test.
4. **Local-first, confidentialité par défaut** : IndexedDB chiffrable, aucun secret client, consentement explicite pour tout envoi externe.
5. **Standards cliniques internationaux + spécificités marocaines** (aliments, Ramadan, arabe).

### 5.2 Architecture cible

```
src/
  domain/            ← TypeScript strict, zéro dépendance React
    units/           Glycemia (g/L|mg/dL), Insulin (U), Carbs (g) : types nominaux + conversions
    engine/          calculateDose, safetyRules (jour/nuit/cumul/max), split, prediction, hypoRisk, velocity
    insulin/         profils d'action (NovoRapid, Humalog, Fiasp, Lyumjev, Apidra) → IOB
    analytics/       TIR/TBR/TAR, CV, GMI, AGP (percentiles horaires), patterns, suggestions ratio/ISF (F8)
    i18n-codes/      le moteur émet des codes (ex. SAFETY_ANTI_HYPO) + paramètres, jamais du texte
  data/
    schema/          Zod : JournalEntry v7, Profile v7, Settings v7 (schemaVersion)
    repo/            Dexie (IndexedDB) : journal illimité, index par date locale, export/import validé
    migrations/      v4→v5→v7, exécutées au démarrage, idempotentes, testées
  app/
    store/           Zustand (profile, settings, session) + persistance
    services/        notifications (SW + planning persisté), vision (via proxy), update
  ui/
    design-system/   tokens (couleurs sémantiques, tailles ≥ 14 px), composants accessibles (Switch, Dialog, Combobox)
    screens/         Accueil (dashboard), Consultation, Journal, Rapports, Réglages
  i18n/              i18next + ICU, fr / ar (+ darija option), Intl pour dates/nombres
functions/
  vision-proxy/      Cloudflare Worker ou Vercel Edge : clé Groq côté serveur, quota, journalisation anonymisée
e2e/                 Playwright : onboarding → consultation → journal → rapport, FR et AR
```

### 5.3 Modèle de données journal v7 (extrait)

```ts
type JournalEntry = {
  id: string;                 // ULID
  schemaVersion: 7;
  kind: 'meal' | 'correction' | 'basal' | 'glucose' | 'hypoTreatment' | 'note';
  at: string;                 // ISO 8601 avec offset local (+01:00)
  glucose?: { value: number; unit: 'g/L'; trend?: Trend; source: 'manual' | 'cgm' };
  meal?: { carbsG: number; fatG?: number; proteinG?: number; items: FoodRef[]; photoRef?: string };
  dose?: { suggestedU: number; takenU: number; plan: DosePlan; insulin: InsulinProfileId; iobAtTimeU: number };
  context?: { activity: Activity; period: 'matin'|'midi'|'soir'|'nuit'; fasting?: boolean; illness?: boolean };
  safety?: { codes: SafetyCode[]; hypoRiskScore: number; nightMode: boolean };
  followUp?: { glucosePost?: number; postAt?: string; verdict?: 'good'|'under'|'over' };
};
```

---

## 6. Feuille de route priorisée

Effort indicatif pour un développeur confirmé à temps plein. Chaque lot se termine par : tests unitaires + E2E verts, changelog, mise à jour de la matrice de non-régression, bump SemVer.

### Lot 0 — Sécurisation immédiate (v6.1, 1 à 2 semaines) — **P0**

| # | Action | Fichiers | Critère d'acceptation |
|---|--------|----------|-----------------------|
| 0.1 | Révoquer la clé Groq exposée ; déployer un proxy serverless (`functions/vision-proxy`) avec quota et CORS restreint ; supprimer `VITE_GROQ_API_KEY` du build et du workflow | `foodRecognition.js`, `.github/workflows/deploy.yml` | Aucun secret dans `build/` ; reconnaissance photo fonctionnelle via proxy |
| 0.2 | Écran de consentement avant le premier envoi de photo + politique de confidentialité (FR/AR) accessible depuis Réglages | `MealInput.jsx`, nouveau `PrivacyNotice.jsx` | Consentement persisté, révocable |
| 0.3 | Supprimer `clarifai-nodejs-grpc` ; `npm audit fix` pour Vite | `package.json` | `npm audit --omit=dev` = 0 |
| 0.4 | Dates locales : utilitaire `localDateKey(date)` ; remplacer les 5 usages de `toISOString().split('T')` | `DayTimeline.jsx`, `clinicalEngine.js` | Test : saisie à 00 h 30 Africa/Casablanca rangée le bon jour |
| 0.5 | Identifiants : filtrer et trier par `date`, jamais par `id` ; générer des ULID partout | `PdfExport.jsx`, `DataExport.jsx`, `DayTimeline.jsx`, `App.jsx` | Injection manuelle visible dans le PDF |
| 0.6 | Corriger la migration : supprimer le doublon de `main.jsx`, exécuter `migrateAllEntries` avant d'écrire la version | `main.jsx`, `App.jsx` | Test d'intégration avec un localStorage v4 réel |
| 0.7 | Rafraîchir IOB / dernière injection / heure sur `visibilitychange` et toutes les 60 s | `ConsultationScreen.jsx` | IOB décroît sans rechargement |
| 0.8 | Brancher un plafond de dose : `maxDoseU` dans Réglages (défaut 0,3 U/kg ou 25 U), `OverdoseDialog` obligatoire au-delà, journalisation de la confirmation | `Settings.jsx`, `ConsultationScreen.jsx`, `OverdoseDialog.jsx` | Entrée de la matrice de non-régression réellement couverte |
| 0.9 | Rappels fiables : persister le planning (`insulincalc_reminders`), le re-planifier au retour en avant-plan, afficher les rappels manqués ; corriger l'icône | `notifications.js`, `App.jsx` | 2e injection rappelée après verrouillage puis réouverture |
| 0.10 | Supprimer le code mort (5 composants, `journalStore.js`, legacy `calculations.js`, `App.css` template) et dédupliquer l'IOB | — | Un seul `calcIOB` |
| 0.11 | Réécrire le `README.md` (architecture v6, stockage local, limites) et documenter la régression v6 dans `docs/changelog/` | `README.md` | — |

### Lot 1 — Restauration clinique (v6.2, 2 à 3 semaines) — **P0**

Réintégrer depuis `git show 5dd472f^:...` et adapter au schéma v5/v7, avec codes i18n et tests :

| # | Module | Règles à restaurer |
|---|--------|--------------------|
| 1.1 | Mode nocturne (`isNightMode`, fenêtre configurable 21 h–6 h) | Blocage correction < 1,50 g/L la nuit ; correction × 0,5 ; alerte collation < 1,50 ; cible nuit élargie ; indicateur lune dans l'en-tête |
| 1.2 | Anti-empilement | Cumul corrections 24 h > 15 % TDD → alerte ; correction plafonnée à 1 U si dernière injection < 180 min ; ratio IOB/dose > 50 % → alerte |
| 1.3 | Score de risque hypo (`hypoRisk.js`) | 6 facteurs, badge permanent à côté de la dose, réduction 50 % si score ≥ 6, blocage correction si ≥ 9 |
| 1.4 | Vitesse glycémique (`velocity.js`) | Calcul automatique depuis les 2 dernières mesures, remplace la tendance manuelle quand disponible, ajuste correction (×0, ×0,5, ×1,2) et timing |
| 1.5 | Patterns avancés (`patternDetector.js`) | Aube, hypo matinale, Somogyi, sur-correction, créneau problématique, empilement récurrent ; carte « Alertes » sur l'accueil et dans le rapport |
| 1.6 | Prédiction (`predictGlycemia`) | Vélocité + IOB résiduel + ISF ; affichage en plage (ex. « 1,4 à 1,8 g/L ») avec mention « estimation » |
| 1.7 | i18n du moteur | Le moteur émet `{ code, params }` ; `ClinicalResponse` traduit ; test : aucune chaîne française dans `domain/` |
| 1.8 | TIR unifié | Une fonction `computeGlycemicMetrics(entries, range)` conforme au consensus (TIR/TBR niv.1-2/TAR niv.1-2/CV/moyenne/GMI) utilisée par la timeline, les stats 30 j et le PDF ; cible patient réservée à la correction |

### Lot 2 — Fondations v7 (v7.0, 4 à 6 semaines) — **P1**

| # | Chantier | Contenu |
|---|----------|---------|
| 2.1 | TypeScript strict | Migration progressive `domain/` → `data/` → `app/` → `ui/` ; types nominaux pour les unités ; `tsc --noEmit` en CI |
| 2.2 | Schéma et stockage | Zod + Dexie ; journal illimité ; migrations v4/v5 → v7 testées sur fixtures réelles ; export/import validé (JSON + CSV) ; sauvegarde chiffrée optionnelle (WebCrypto, mot de passe) |
| 2.3 | Store applicatif | Zustand : fin du prop drilling ; sélecteurs mémoïsés ; synchronisation multi-onglets |
| 2.4 | Design system accessible | Tokens sémantiques (statut glycémique = couleur + icône + texte), tailles ≥ 14 px, composants `Switch`, `Dialog`, `Combobox`, `Tabs` avec ARIA ; suppression de `user-scalable=no` ; `prefers-color-scheme` ; audit axe-core en CI |
| 2.5 | i18n | i18next + ICU ; `Intl.DateTimeFormat`/`NumberFormat` selon locale ; RTL complet (onboarding, graphiques) ; option darija ; extraction automatique des chaînes manquantes en CI |
| 2.6 | Tests | Playwright (parcours FR/AR, hors ligne, mise à jour SW) ; tests de composants pour chaque écran ; couverture ≥ 85 % sur `domain/` ; suppression des tests tautologiques ; matrice exigences → tests (IEC 62304 §5.7) |
| 2.7 | CI/CD | Workflow `ci.yml` sur PR (lint, typecheck, tests, build, Lighthouse CI ≥ 90 PWA/a11y) ; `deploy.yml` sur tag ; Dependabot ; Conventional Commits + changelog automatique ; environnement de préversion par PR |
| 2.8 | Performance | Code splitting (aliments, i18n AR, PDF, vision) ; polices auto-hébergées ; budget 100 kB gzip pour le chunk initial |

### Lot 3 — Excellence clinique (v7.1 à v7.3, 6 à 8 semaines) — **P1/P2**

| # | Fonctionnalité | Référence |
|---|----------------|-----------|
| 3.1 | Rapport AGP 14/30/90 jours : médiane + percentiles par heure, TIR en barres normalisées, GMI, CV, jours de données, patterns, suggestions ; export PDF vectoriel (pdf-lib) et CSV | Consensus TIR 2019, Bergenstal |
| 3.2 | Profils d'insuline (courbes d'action par produit, DIA et pic préremplis) ; choix du modèle d'IOB (bilinéaire / exponentiel) | ISPAD 2022, notices |
| 3.3 | Mode Ramadan : stratification du risque IDF-DAR, cibles et ratios iftar/suhoor, rappels adaptés, alerte rupture du jeûne < 0,70 g/L | IDF-DAR 2021 |
| 3.4 | Parcours hypoglycémie (règle des 15 : 15 g, recontrôle 15 min, journalisation `hypoTreatment`) et règles jours de maladie (cétones, hydratation, contact médecin) | ADA 2025 |
| 3.5 | Suivi de la basale : rappel quotidien, journalisation, détection d'oubli | — |
| 3.6 | F8 : analyse rétrospective ratio/ISF effectifs par période après 14 jours, suggestions « à discuter avec votre médecin » | Spec du 3 avril |
| 3.7 | Import CGM (CSV LibreView / Dexcom Clarity) et Nightscout ; tendance automatique | Interopérabilité |
| 3.8 | Mode pédiatrique / aidant (profils multiples, verrouillage parental des réglages) | ISPAD |
| 3.9 | Base aliments : valeurs lipides/protéines réelles en grammes (remplace l'approximation `FAT_GRAMS_APPROX`), portions photo, favoris et repas composés | — |

### Lot 4 — Produit, conformité, distribution (continu) — **P2/P3**

- **Posture réglementaire** : décider explicitement entre (a) outil personnel/éducatif open source avec disclaimer renforcé, ou (b) produit distribué aux patients. En (b), un calculateur de bolus est un dispositif médical logiciel (EU MDR règle 11, classe IIa/IIb ; FDA « device software function »). Prévoir alors dossier IEC 62304, ISO 14971, IEC 62366-1, revue clinique par un diabétologue, et déclaration auprès de la DMP au Maroc.
- **Conformité données** : registre des traitements, politique de confidentialité, déclaration CNDP (loi 09-08) si collecte, hébergement de santé si synchronisation cloud.
- **Synchronisation optionnelle** chiffrée de bout en bout (Supabase/Cloudflare D1 + WebCrypto), partage sécurisé d'un rapport avec le médecin (lien expirant).
- **Distribution** : Capacitor pour App Store/Play Store (notifications push natives fiables), ou maintien PWA avec Push API.
- **Observabilité** : rapport d'erreurs anonymisé opt-in (Sentry self-hosted), métriques d'usage agrégées.
- **Validation clinique** : protocole d'évaluation en vie réelle (TIR avant/après, taux d'hypos) avec un service de diabétologie partenaire.

---

## 7. Gouvernance et définition de « terminé »

1. **Branches** : `main` protégée, PR obligatoire avec CI verte et revue ; tags `vX.Y.Z` déclenchent le déploiement.
2. **Definition of Done** : tests unitaires + E2E, typecheck, lint, a11y (axe) sans violation sérieuse, i18n FR/AR complet (test automatique), changelog, matrice de non-régression mise à jour, capture d'écran avant/après pour tout changement d'UI.
3. **Matrice de non-régression v7** (à étendre) : journée en bordure de minuit (Casablanca), mode nuit, cumul corrections, plafond de dose, rappel différé après verrouillage, migration v4/v5/v7, import de sauvegarde invalide, parcours complet en arabe, fonctionnement hors ligne, mise à jour SW avec onglet ouvert.
4. **Traçabilité** : chaque règle de sécurité du moteur référence un identifiant d'exigence (`REQ-SAFE-xx`) cité dans son test.
5. **Revue clinique** : toute modification de `domain/engine` ou `domain/analytics` requiert une relecture par un référent médical avant fusion.

---

## 8. Décisions attendues

| Décision | Options | Recommandation |
|----------|---------|----------------|
| Hébergement du proxy vision | Cloudflare Workers (gratuit, edge) / Vercel / GitHub Pages impossible | Cloudflare Workers, déjà esquissé dans l'historique (`worker/wrangler.toml`) |
| Posture produit | Personnel / public | Clarifier maintenant : conditionne les lots 4 et la profondeur du dossier qualité |
| TypeScript | Migration complète / partielle (`domain/` seulement) | Complète, par couches, sur le lot 2 |
| Stockage | Rester localStorage / IndexedDB | IndexedDB (Dexie) dès le lot 2 ; prérequis AGP 90 jours |
| Notifications | PWA Push / Capacitor natif | PWA + planning persisté au lot 0 ; Capacitor si distribution store |

---

## Annexe A — Inventaire des anomalies vérifiées (6.0.2)

| Réf | Sévérité | Description | Localisation |
|-----|----------|-------------|--------------|
| A1 | Critique | Fonctions cliniques F1–F5, F9, F10 supprimées lors de la migration racine | commit `5dd472f` |
| A2 | Critique | Clé API Groq dans le bundle client ; photos envoyées sans consentement | `src/utils/foodRecognition.js:5`, `.github/workflows/deploy.yml` |
| A3 | Haute | Rappels d'injection différée perdus à la fermeture ; icône inexistante | `src/utils/notifications.js:23,96` |
| A4 | Haute | Jour calculé en UTC | `src/components/DayTimeline.jsx:18,78,81,84`, `src/utils/clinicalEngine.js:573` |
| A5 | Haute | Identifiants mixtes ; filtre PDF et tri import par `id` | `src/components/PdfExport.jsx:38`, `src/components/DataExport.jsx:64`, `src/components/DayTimeline.jsx:885` |
| A6 | Haute | Journal plafonné à 200 entrées | `src/App.jsx:184`, `src/components/DayTimeline.jsx:186,203`, `src/components/DataExport.jsx:64` |
| A7 | Haute | Migration v4→v5 jamais exécutée (ordre `main.jsx` / `App.jsx`) | `src/main.jsx:34`, `src/App.jsx:66-73` |
| A8 | Haute | Aucun plafond de dose ; `OverdoseDialog` non branché | `src/components/OverdoseDialog.jsx`, `src/components/ConsultationScreen.jsx` |
| A9 | Haute | Messages de sécurité non traduits en arabe | `src/utils/clinicalEngine.js` (13 messages) |
| A10 | Moyenne | IOB et timing calculés sur `mountTime` figé | `src/components/ConsultationScreen.jsx:22,87,97` |
| A11 | Moyenne | 4 définitions divergentes du TIR ; HbA1c par ADAG sur SMBG | `src/data/journalStore.js:91`, `src/utils/clinicalEngine.js:565`, `src/components/DayTimeline.jsx:322-357`, `src/components/PdfExport.jsx:40-66` |
| A12 | Moyenne | Prédiction +2 h ignore IOB/lipides/tendance, affichée à 0,01 près | `src/utils/clinicalEngine.js:predictPostMealGlycemia` |
| A13 | Moyenne | Export de sauvegarde incomplet (`4.3.0`, clés obsolètes, profil médical absent) ; import sans validation | `src/components/DataExport.jsx:9-16,46-66` |
| A14 | Moyenne | Plages onboarding ≠ réglages (ratio 3–30 vs 5–25 ; ISF 10–100 vs 20–100) | `src/components/Onboarding.jsx:233,261`, `src/components/Settings.jsx:196,207` |
| A15 | Moyenne | `clarifai-nodejs-grpc` inutilisée, 1 vulnérabilité critique | `package.json:17` |
| A16 | Moyenne | Zoom désactivé, polices 8–11 px, contrastes < 4,5:1, 0 ARIA | `index.html:6`, composants |
| A17 | Faible | Code mort : 5 composants, `journalStore.js`, legacy `calculations.js`, `scheduleFromPlan`, `favorites`, `App.css` | — |
| A18 | Faible | Dates/heures figées `fr-FR` ; onboarding forcé LTR ; ≈ 30 chaînes non traduites | `PdfExport.jsx`, `VersionPanel.jsx`, `ExtendedPlan.jsx`, `GlycEvolutionChart.jsx`, `Onboarding.jsx:71` |
| A19 | Faible | README obsolète (architecture v1) | `README.md` |
| A20 | Faible | Google Fonts externe (hors ligne, vie privée), pas de CSP | `index.html:15-17` |
| A21 | Faible | Avertissement build `INEFFECTIVE_DYNAMIC_IMPORT` | `src/App.jsx:133` |

## Annexe B — Fichiers à récupérer depuis l'historique

```bash
git show 5dd472f^:src/utils/hypoRisk.js
git show 5dd472f^:src/utils/velocity.js
git show 5dd472f^:src/utils/patternDetector.js
git show 5dd472f^:src/utils/clinicalEngine.js      # isNightMode, règles night_*, cumul_high, predictGlycemia
git show 5dd472f^:src/utils/exportPdf.js           # generateMedicalReport (5 pages)
git show 5dd472f^:src/components/{HypoRiskBadge,NightModeIndicator,VelocityIndicator,PatternAlerts,Dashboard,TimeInRange,GlycemiaGauge}.jsx
git show 5dd472f^:src/utils/__tests__/{hypoRisk,velocity,patternDetector,integration}.test.js
```

## Annexe C — Références

- Battelino T. et al., *Clinical Targets for CGM Data Interpretation: Recommendations From the International Consensus on Time in Range*, Diabetes Care 2019.
- American Diabetes Association, *Standards of Care in Diabetes 2025*, sections 6 (objectifs glycémiques) et 7 (technologie).
- ISPAD Clinical Practice Consensus Guidelines 2022 (insulinothérapie, hypoglycémie, exercice, jours de maladie).
- Bergenstal R. et al., *Glucose Management Indicator (GMI)*, Diabetes Care 2018.
- IDF-DAR, *Diabetes and Ramadan: Practical Guidelines 2021*.
- IEC 62304:2006/A1:2015, ISO 14971:2019, IEC 62366-1:2015, Règlement (UE) 2017/745 (règle 11).
- OWASP ASVS 4.0, OWASP MASVS 2.0, OpenSSF Scorecard.
- WCAG 2.2 (W3C 2023), RGAA 4.1.
- Loi 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel (Maroc, CNDP) ; RGPD art. 9 et 44.
