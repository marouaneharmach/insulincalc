# InsulinCalc v6.0 — Architecture Technique

## Vue d'ensemble

InsulinCalc v6.0 est un calculateur d'insuline prandiale avec moteur de sécurité clinique intégré. L'application est une PWA React 19 + Vite 8 avec persistance localStorage.

```
src/
├── App.jsx                    # Composant racine, pipeline de calcul
├── components/
│   ├── Dashboard.jsx          # Onglet accueil (IOB, risque, actions rapides)
│   ├── DosagePlan.jsx         # Plan de dosage fractionné interactif
│   ├── HypoRiskBadge.jsx      # Badge score risque hypo
│   ├── JournalEntryForm.jsx   # Formulaire édition entrée journal
│   ├── JournalTab.jsx         # Onglet journal + patterns + export
│   ├── NightModeIndicator.jsx # Badge mode nuit (21h-05h)
│   ├── PatternAlerts.jsx      # Cartes d'alertes patterns
│   ├── ReglagesPanel.jsx      # Réglages (ratio, ISF, profils)
│   ├── ResultCard.jsx         # Résultat calcul + plan dosage
│   ├── TabNav.jsx             # Navigation par onglets
│   └── VelocityIndicator.jsx  # Badge vélocité glycémique
├── data/
│   ├── constants.js           # Constantes métier (FAT_SCORE, etc.)
│   ├── foods.js               # Base de données aliments
│   └── journalStore.js        # CRUD journal (localStorage)
├── hooks/
│   ├── useLocalStorage.js     # Hook persistance localStorage
│   └── useTheme.js            # Hook thème dark/light
├── i18n/
│   ├── ar.js                  # Traductions arabe (RTL)
│   ├── fr.js                  # Traductions français
│   └── useI18n.js             # Hook i18n
└── utils/
    ├── calculations.js        # Fonctions de calcul (HbA1c, IOB, IMC, etc.)
    ├── clinicalEngine.js      # Moteur de sécurité (9 règles + prédictions)
    ├── colors.js              # Palette et helpers couleurs
    ├── exportPdf.js           # Export PDF journal + rapport médical
    ├── hypoRisk.js            # Score risque hypoglycémique
    ├── migration.js           # Migrations schéma localStorage
    ├── notifications.js       # Notifications post-repas (SW + fallback)
    ├── patternDetector.js     # Détection 6 patterns cliniques
    ├── timeProfiles.js        # Profils ICR/ISF par période
    └── velocity.js            # Vélocité glycémique
```

## Pipeline de calcul (App.jsx)

```
Saisie utilisateur (glycémie, aliments, ratio, ISF)
  │
  ├── Profil actif ? → getActiveProfile(profiles, hour)
  │
  ├── Dose prandiale = totalCarbs / ratio
  │
  ├── Correction = (glycémie - cible) * 100 / ISF
  │
  ├── Vélocité → calcVelocity() → adjustDoseForVelocity()
  │
  ├── IOB → calcIOB() sur entrées récentes
  │
  └── applySafetyRules({glycémie, dose, IOB, heure, ...})
        │
        ├── Anti-hypo (< 0.70) → BLOCAGE TOTAL
        ├── Hypo-proche (0.70-0.90) → -50%, correction 0 → RETURN
        ├── IOB dynamique → réduction correction
        ├── Mode nuit → block/reduce/alert
        ├── Cap injection récente → max 1 UI
        ├── Cumul journalier → avertissement
        ├── Recalcul dose ajustée
        └── Surdosage → plafonnement à maxDose
```

## Modèle de données

### Entrée journal (journalStore)

```javascript
{
  id: "uuid",
  date: "2026-04-03T14:30:00.000Z",
  mealType: "déjeuner",           // petit-déjeuner | déjeuner | collation | dîner
  preMealGlycemia: 1.45,          // g/L
  postMealGlycemia: 1.80,         // g/L (nullable)
  postMealTime: null,             // ISO string (nullable)
  foods: [
    { foodId: "riz_blanc", name: "Riz blanc", mult: 1.5, carbs: 42 }
  ],
  totalCarbs: 42,
  doseCalculated: 4.5,            // UI
  doseInjected: 4.0,              // UI (modifiable)
  correction: 0.5,                // UI
  velocity: -0.15,                // g/L/h (nullable)
  velocityTrend: "stable",        // falling_fast|falling|stable|rising|rising_fast
  iobAtTime: 1.2,                 // UI
  hypoRiskScore: 3,
  period: "midi",                 // matin|midi|gouter|soir|nuit
  context: {
    stress: null,                 // 1-5 (nullable)
    sommeil: null,                // 1-5 (nullable)
    activite: null                // null|legere|moderee|intense
  },
  dosagePlan: [                   // nullable — plan fractionné
    { label: "Phase 1", units: 2.5, taken: true, takenAt: "14:30" },
    { label: "Contrôle", units: null, taken: false },
    { label: "Phase 2", units: 2.0, taken: false }
  ],
  notes: ""
}
```

### Profils par période (localStorage)

```javascript
// Clé: insulincalc_v1_timeProfiles
{
  matin:  { ratio: 8,  isf: 40 },
  midi:   { ratio: 10, isf: 50 },
  gouter: { ratio: 12, isf: 50 },
  soir:   { ratio: 10, isf: 45 },
  nuit:   { ratio: 10, isf: 50 }
}
```

### Clés localStorage

| Clé | Type | Description |
|-----|------|-------------|
| `insulincalc_v1_journal` | JSON array | Entrées du journal |
| `insulincalc_v1_ratio` | number | Ratio ICR unique |
| `insulincalc_v1_isf` | number | ISF unique |
| `insulincalc_v1_timeProfiles` | JSON object | Profils ICR/ISF par période |
| `insulincalc_v1_useTimeProfiles` | boolean | Toggle profils variables |
| `insulincalc_v1_dataVersion` | number | Version schéma (actuelle: 2) |
| `insulincalc_v1_pendingNotif` | number | Timestamp rappel en attente |
| `insulincalc_v1_theme` | string | dark/light |
| `insulincalc_v1_lang` | string | fr/ar |

## Algorithmes cliniques

### IOB (Insulin On Board)

Modèle de décroissance exponentielle : `IOB = dose × (1 - t/duration)^1.5`

- `INSULIN_DURATION_MIN = 240` (4h, constante centralisée dans `calculations.js`)
- Décroissance estimée : 40% à 1h, 70% à 2h

### Vélocité glycémique

```
velocity = (currentG - previousG) / (intervalMinutes / 60)  // g/L/h
```

| Vélocité | Classification | Facteur dose |
|----------|---------------|-------------|
| < -0.15 | falling_fast (↓↓) | ×0 |
| -0.15 à -0.05 | falling (↓) | ×0.5 |
| -0.05 à +0.05 | stable (→) | ×1.0 |
| +0.05 à +0.15 | rising (↑) | ×1.0 |
| > +0.15 | rising_fast (↑↑) | ×1.2 |

### Score risque hypo (0-14)

| Facteur | Points max | Seuils |
|---------|-----------|--------|
| Glycémie | 3 | < 1.00: 3, < 1.20: 2, < 1.50: 1 |
| IOB | 3 | > 3 UI: 3, > 2: 2, > 1: 1 |
| Tendance | 3 | falling_fast: 3, falling: 2 |
| Hypo 24h | 2 | oui: 2 |
| Activité | 2 | intense: 2, modérée: 1 |
| Nuit (21h-05h) | 1 | nuit: 1 |

Classification : faible (0-2), modéré (3-5), élevé (6-8), critique (9+)

### Prédiction glycémique

```
glyc1h = currentG + velocity - (IOB × 0.4 × ISF/100)
glyc2h = currentG + (velocity × 2) - (IOB × 0.7 × ISF/100)
```

## Migrations

Les migrations sont versionnées et idempotentes. Elles s'exécutent au démarrage avant le rendu.

| Version | Migration | Description |
|---------|-----------|-------------|
| 0 → 1 | `migrateV0ToV1()` | Journal App.jsx → journalStore (déduplication par ID) |
| 1 → 2 | `migrateV1ToV2()` | Ratio/ISF unique → profils par période |

## Tests

389 tests sur 22 fichiers. Environnement : Vitest + jsdom.

| Fichier | Tests | Couverture |
|---------|-------|-----------|
| `clinicalEngine.test.js` | 21 | 9 règles + prédictions + validation entrées |
| `integration.test.js` | 16 | 5 flux critiques end-to-end |
| `patternDetector.test.js` | 14 | 6 patterns + cas positifs/négatifs |
| `migration.test.js` | 12 | V0→V1, V1→V2, déduplication, idempotence |
| `velocity.test.js` | 8 | Calcul, classification, ajustement dose |
| `journalStore.test.js` | 7 | CRUD + filtrage + stats |
| `timeProfiles.test.js` | 6 | Périodes, minuit, profils par défaut |
| `hypoRisk.test.js` | 5 | 6 facteurs + classification |
| `dosagePlan.test.js` | 3 | Persistance, précision, rétrocompatibilité |
| `notifications.test.js` | 4 | Persistance, nettoyage, écrasement |

Commande : `npx vitest run`
