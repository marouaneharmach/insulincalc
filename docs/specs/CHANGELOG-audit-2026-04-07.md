# Audit qualite & corrections — 2026-04-07

## Resume

Audit complet du depot (racine + v4) avec corrections de securite, bugs cliniques critiques,
stabilite toolchain, hygiene repo et qualite code.

**Resultats validation finale :**
- Tests racine : 35/35 OK
- Tests v4 : 258/258 OK
- Lint racine : 0 erreurs (3 warnings pre-existants)
- Lint v4 : 0 erreurs (1 warning pre-existant)
- Build racine : OK
- Build v4 : OK

---

## Phase 0 — Securite

| Action | Fichier | Statut |
|--------|---------|--------|
| Secret Clarifai supprime du code source | `worker/wrangler.toml` | Fait |
| `.dev.vars` ajoute au `.gitignore` | `.gitignore` | Fait |

> **IMPORTANT** : La cle exposee (`1ec06f...`) doit etre revoquee manuellement depuis le dashboard Clarifai
> et reconfiguree via `wrangler secret put CLARIFAI_PAT`.

---

## Phase 1 — Bugs cliniques critiques (P0)

### 1a. Dose NaN sur activite legere/moderee
- **Cause** : `ContextInput.jsx` envoyait `'legere'`/`'moderee'` (avec accents) alors que `clinicalEngine.js` attendait `legere`/`moderee` (sans accents)
- **Fix** : Aligne les valeurs sans accents dans `ContextInput.jsx`
- **Impact** : La dose n'etait plus NaN pour les activites legere et moderee

### 1b. ISF sous-estime d'un facteur 100
- **Cause** : ISF stocke en mg/dL (Settings slider 20-100) mais `clinicalEngine.js` opere en g/L
- **Fix** : Division par 100 dans `ConsultationScreen.jsx` avant appel moteur (`isf: activeParams.isf / 100`)
- **Impact** : Correction glycemique desormais correcte (ex: 0.80 U au lieu de 0.008 U)

### 1c. Auto-fat toujours "faible" en mode assiste
- **Cause** : `getOverallFat(selections)` recevait un objet `{id:{mult}}` au lieu d'un tableau `[{food,mult}]`
- **Fix** : Passe `selectionsArray` (tableau) a `getOverallFat` + deplace le useMemo apres la definition du tableau
- **Impact** : Le niveau de gras reflete les aliments selectionnes

### 1d. Heure saisie ignoree dans le journal
- **Cause** : `App.jsx` utilisait `new Date().toISOString()` sans tenir compte de `entry.heure`
- **Fix** : Construction de la date a partir de `entry.heure` quand disponible
- **Impact** : L'heure choisie par l'utilisateur est visible dans la timeline

---

## Phase 2 — Stabilite toolchain

| Action | Fichier |
|--------|---------|
| ESLint ignores etendus (`.claude/**`, `v4/build/**`, `assets/**`, `worker/**`, `docs/**`) | `eslint.config.js` |
| Import i18n explicite `./ar.js` | `v4/src/i18n/useI18n.js` |
| Fichier parasite `v4/src/i18n/ar` (sans extension, 324 cles) supprime | filesystem |
| `__dirname` corrige en ESM (`fileURLToPath`) | `vite.config.js` |
| Vitest exclude `.claude/**`, `v4/**`, `worker/**` | `vite.config.js` |

---

## Phase 3 — Hygiene repo + UI

| Action | Fichier(s) |
|--------|------------|
| 4 fichiers dupliques supprimes | `DayTimeline 2.jsx`, `Onboarding 2.jsx`, `fr 2.js`, `deploy 2.yml` |
| `isDark` passe a `ContextInput` | `ConsultationScreen.jsx:157` |
| `isDark` dynamique pour `OverdoseDialog` (etait force `false`) | `ConsultationScreen.jsx:180` |
| IOB unifie : un seul modele Walsh triangulaire (`iobCurve.js`) | `DayTimeline.jsx` |
| Notification split bolus : placeholder + console.warn | `App.jsx`, `Settings.jsx` |

---

## Phase 4 — Qualite code & i18n

| Action | Detail |
|--------|--------|
| 7 cles dupliquees supprimees dans `fr.js` | `bonjour`, `tirLabel`, `rechercherAliment`, etc. |
| 6 cles dupliquees supprimees dans `ar.js` | `rechercherAliment`, `correcteurPostRepas`, etc. |
| `hba1cEstimee` dupliquee dans `fr.js` | supprimee |
| `shrimp` duplique dans `foodRecognition.js` | supprime |
| `DoseAnimation.jsx` refactorise | `useState(prevDose)` -> `useRef` + `requestAnimationFrame` |
| 8 cles onboarding ajoutees en FR et AR | `onb_profil_desc`, `onb_params_desc`, `onb_disclaimer_*`, `onb_accept` |
| ~30 erreurs lint corrigees dans v4 | Unused vars, impure functions, duplicate keys, empty blocks |
| `TimeProfiles.jsx` decouple | `getActiveProfile` extrait vers `utils/timeProfileDefaults.js` |
| `Date.now()` rendu stable | `useState(() => Date.now())` dans ConsultationScreen et PdfExport |

---

## Reste a faire (hors scope audit)

1. **Revoquer la cle Clarifai** depuis le dashboard et reconfigurer via `wrangler secret put`
2. **Implementer les notifications split bolus** (actuellement placeholder `console.warn`)
3. **Completer le RTL** pour dates/heures dans `DayTimeline` et `Onboarding`
4. **Tests e2e** du parcours complet (onboarding -> calcul -> enregistrement -> journal)
5. **Verifier l'historique git** pour le secret expose (BFG ou filter-branch si repo public)
