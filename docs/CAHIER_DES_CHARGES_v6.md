# Cahier des Charges — InsulinCalc v6.0.0

> Calculateur clinique de dose d'insuline pour patients DT1
> Date : 2026-04-10 | Version : 6.0.0
> Plateforme : PWA (React 19 + Vite 8 + Tailwind CSS 4)
> Deploiement : GitHub Pages via GitHub Actions

---

## Table des matieres

1. [Presentation generale](#1-presentation-generale)
2. [Architecture technique](#2-architecture-technique)
3. [Ecrans et navigation](#3-ecrans-et-navigation)
4. [Moteur clinique](#4-moteur-clinique)
5. [Regles de securite](#5-regles-de-securite)
6. [Fractionnement bolus](#6-fractionnement-bolus)
7. [Courbe IOB (Insuline active)](#7-courbe-iob-insuline-active)
8. [Prediction post-repas](#8-prediction-post-repas)
9. [Journal et timeline](#9-journal-et-timeline)
10. [Statistiques et bilan](#10-statistiques-et-bilan)
11. [Reconnaissance alimentaire IA](#11-reconnaissance-alimentaire-ia)
12. [Reglages utilisateur](#12-reglages-utilisateur)
13. [Profils horaires](#13-profils-horaires)
14. [Export PDF](#14-export-pdf)
15. [Export donnees](#15-export-donnees)
16. [Internationalisation](#16-internationalisation)
17. [Gestion des versions et migration](#17-gestion-des-versions-et-migration)
18. [Notifications](#18-notifications)
19. [Base alimentaire](#19-base-alimentaire)
20. [Tests et qualite](#20-tests-et-qualite)
21. [CI/CD et deploiement](#21-cicd-et-deploiement)
22. [Securite et conformite](#22-securite-et-conformite)
23. [Historique des versions](#23-historique-des-versions)

---

## 1. Presentation generale

### 1.1 Objectif

InsulinCalc est un calculateur de dose d'insuline prandiale destine aux patients diabetiques de type 1 (DT1). Il assiste le calcul du bolus repas, de la correction glycemique et du fractionnement des doses en fonction du contenu nutritionnel du repas.

### 1.2 Utilisateurs cibles

- Patients DT1 sous schema basal-bolus (injections multiples)
- Accompagnement par un soignant pour la configuration initiale des parametres

### 1.3 Perimetre fonctionnel

| Domaine | Fonctionnalites |
|---------|----------------|
| Calcul de dose | Bolus repas, correction, bonus gras, reduction activite |
| Securite | 7 regles hierarchisees (anti-hypo, surdosage, anti-stacking...) |
| Fractionnement | Unique, fractionne 60/40 ou 50/50, etendu 3 phases |
| IOB | Modele triangulaire Walsh (DIA configurable) |
| Journal | Timeline journaliere, glycemie post-prandiale, evaluation |
| Statistiques | Bilan 30 jours, TIR, HbA1c estimee, graphiques |
| IA | Reconnaissance alimentaire par photo (Groq/Llama 4 Scout) |
| Export | PDF clinique, JSON/CSV |
| i18n | Francais, Arabe (RTL) |
| PWA | Installation mobile, cache busting, notifications |

---

## 2. Architecture technique

### 2.1 Stack

| Couche | Technologie | Version |
|--------|------------|---------|
| Framework | React | 19.2 |
| Bundler | Vite | 8.0 |
| CSS | Tailwind CSS | 4.2 |
| Tests | Vitest | 4.1 |
| Test DOM | jsdom + @testing-library/react | 29/16.3 |
| Lint | ESLint | 9.39 |
| Deploiement | GitHub Pages + Actions | - |

### 2.2 Arborescence

```
/
  index.html              # Point d'entree HTML
  package.json            # v6.0.0, name: insulincalc
  vite.config.js          # Plugins: react, tailwindcss, base: './'
  eslint.config.js
  public/
    favicon.svg
    icons.svg
  src/
    main.jsx              # Bootstrap, cache busting, migration
    App.jsx               # Orchestrateur principal, state, routing
    version.js            # APP_VERSION = '6.0.0' (source unique)
    index.css             # Tailwind entry
    components/
      ConsultationScreen.jsx   # Ecran principal de calcul
      ClinicalResponse.jsx     # Affichage 4 blocs resultats
      GlycemiaInput.jsx        # Saisie glycemie + tendance
      MealInput.jsx            # Saisie repas (assiste/expert/photo)
      ContextInput.jsx         # Activite physique
      DayTimeline.jsx          # Journal timeline
      Settings.jsx             # Reglages 5 sections
      Onboarding.jsx           # Wizard 3 etapes
      PdfExport.jsx            # Generation rapport PDF
      ExtendedPlan.jsx         # Plan etendu 3 phases
      TimeProfiles.jsx         # Profils horaires ratio/ISF
      GlycEvolutionChart.jsx   # Graphique evolution glycemie
      GlycemiaChart.jsx        # Courbe glycemique
      BottomNav3.jsx           # Navigation 3 onglets
      OverdoseDialog.jsx       # Dialogue surdosage
      DoseAnimation.jsx        # Animation dose
      ErrorBoundary.jsx        # Gestion erreurs React
      PhotoMeal.jsx            # Capture photo repas
      DataExport.jsx           # Export JSON/CSV
    data/
      constants.js             # FAT_FACTOR, ACTIVITY_REDUCTION, limites
      foods.js                 # Base alimentaire (100+ aliments)
      journalStore.js          # Persistence journal localStorage
    hooks/
      useLocalStorage.js       # Hook persistance (prefixe insulincalc_v4_)
      useTheme.js              # Theme clair/sombre
    i18n/
      fr.js                    # Traductions francais (530+ cles)
      ar.js                    # Traductions arabe RTL (530+ cles)
      useI18n.js               # Hook i18n + detection RTL
    utils/
      clinicalEngine.js        # Moteur clinique principal
      iobCurve.js              # Courbe IOB Walsh triangulaire
      calculations.js          # IMC, HbA1c, fonctions annexes
      validation.js            # Validation saisies
      migration.js             # Migration v4 -> v5/v6
      foodRecognition.js       # Reconnaissance IA (Groq API)
      notifications.js         # Notifications systeme + fallback
      clarifai.js              # Integration Clarifai (legacy)
      timeProfileDefaults.js   # Valeurs defaut profils horaires
    __tests__/                 # 14 fichiers, 434 tests
  docs/
    CAHIER_DES_CHARGES_v6.md   # Ce document
    superpowers/specs/         # Design specs
  .github/workflows/
    deploy.yml                 # CI/CD GitHub Pages
```

### 2.3 Persistence

Toutes les donnees sont stockees dans `localStorage` avec le prefixe `insulincalc_v4_`.

| Cle | Contenu |
|-----|---------|
| `insulincalc_v4_journal` | Journal des consultations (array JSON) |
| `insulincalc_v4_ratio` | Ratio insuline/glucides (defaut: 15) |
| `insulincalc_v4_isf` | Facteur de sensibilite (defaut: 60) |
| `insulincalc_v4_targetGMin` | Cible glycemique basse (defaut: 1.0 g/L) |
| `insulincalc_v4_targetGMax` | Cible glycemique haute (defaut: 1.2 g/L) |
| `insulincalc_v4_maxDose` | Dose max securite (defaut: 10 U) |
| `insulincalc_v4_dia` | Duree d'action insuline (defaut: 4.5 h) |
| `insulincalc_v4_slowDigestion` | Digestion lente (boolean) |
| `insulincalc_v4_onboarded` | Onboarding complete (boolean) |
| `insulincalc_v4_app_version` | Version app installee |

---

## 3. Ecrans et navigation

### 3.1 Navigation

3 onglets principaux via `BottomNav3` :

| Onglet | Composant | Icone |
|--------|-----------|-------|
| Accueil | ConsultationScreen | Stethoscope |
| Journal | DayTimeline | Calendrier |
| Reglages | Settings | Engrenage |

### 3.2 Ecran Accueil (ConsultationScreen)

**Flux utilisateur :**

1. **Saisie glycemie** (GlycemiaInput)
   - Glycemie en g/L (auto-conversion si >= 30 → mg/dL detecte)
   - Tendance : ↑ ↗ → ↘ ↓ ?
   - Heure du controle

2. **Saisie repas** (MealInput)
   - Mode assiste : selection dans la base alimentaire
   - Mode expert : saisie manuelle des glucides
   - Mode photo : reconnaissance IA
   - Niveau de gras : aucun / faible / moyen / eleve
   - Total glucides et grammes de gras affiches

3. **Contexte** (ContextInput)
   - Activite physique : aucune / legere / moderee / intense

4. **Bouton Analyser** → declenche le moteur clinique

5. **Resultat** (ClinicalResponse) — 4 blocs :
   - Analyse : statut glycemique, IOB, glucides, gras, tendance
   - Recommandation : dose suggeree, type de bolus, DoseBreakdown
   - Vigilance : risques (rouge) et alertes (jaune)
   - Prochaine etape : delai de controle post-prandial

6. **Notes** (optionnel) — texte libre (stress, maladie, contexte)

7. **Dose reelle** + bouton Confirmer
   - Si dose reelle != dose suggeree : recalcul proportionnel du split
   - Si dose > maxDose : dialogue OverdoseDialog
   - Apres confirmation : sauvegarde au journal + redirection vers Journal

### 3.3 Ecran Journal (DayTimeline)

- Navigation par date (fleches gauche/droite)
- Resume insuline du jour : total, repas, correction
- Bilan journalier : TIR, moyenne glycemie, injections, glucides
- Statistiques 30 jours : moyenne, TIR%, consultations, HbA1c estimee
- Timeline chronologique des entrees :
  - Repas : aliments, glycemie pre/post, dose, IOB, evaluation post-prandiale
  - Injections manuelles
  - Mesures glycemiques isolees
- Saisie glycemie post-prandiale inline
- Graphique d'evolution glycemique (GlycEvolutionChart)

### 3.4 Ecran Reglages (Settings)

5 sections tabulaires :

| Section | Contenu |
|---------|---------|
| Profil | Nom, age, sexe, taille, poids, IMC |
| Medical | Insuline basale/rapide, dose basale, post-cetose, digestion lente |
| Insuline | Ratio, ISF, cibles glycemiques, dose max, DIA, profils horaires |
| Notif | Notifications systeme |
| Affichage | Theme clair/sombre, langue FR/AR |

### 3.5 Onboarding

Wizard initial 3 etapes (affiche si `onboarded === false`) :
1. Profil patient (nom, age, sexe, taille, poids, insulines)
2. Parametres insuline (ratio, ISF, cibles)
3. Acceptation disclaimer medical

---

## 4. Moteur clinique

### 4.1 Formule de calcul de dose

**Fichier** : `src/utils/clinicalEngine.js` — fonction `calculateDose()`

```
bolusRepas = totalCarbs / ratio

correction = max(0, (glycemie - targetGMax) / isf)      si glycemie > targetGMax
           = 0                                            sinon

correctionNette = max(0, correction - iobTotal)

bonusGras = bolusRepas * FAT_FACTOR[niveauGras]
  ou FAT_FACTOR = { aucun: 0, faible: 0.04, moyen: 0.14, eleve: 0.27 }

doseAvantActivite = bolusRepas + correctionNette + bonusGras

doseSuggeree = round05(doseAvantActivite * ACTIVITY_REDUCTION[activite])
  ou ACTIVITY_REDUCTION = { aucune: 1.0, legere: 1.0, moderee: 0.80, intense: 0.70 }
```

### 4.2 Fonction round05

Arrondi au 0.5 U le plus proche :
```
round05(v) = Math.round(v * 2) / 2
```

### 4.3 Entrees

| Parametre | Source | Defaut |
|-----------|--------|--------|
| totalCarbs | Saisie repas (g) | - |
| glycemie | Saisie (g/L) | - |
| ratio | Reglages ou profil horaire | 15 |
| isf | Reglages ou profil horaire | 60 mg/dL = 0.60 g/L |
| targetGMax | Reglages | 1.2 g/L |
| iobTotal | Calcule depuis journal | 0 |
| fatLevel | Derive du repas | aucun |
| activity | Saisie contexte | aucune |
| totalFatGrams | Derive du repas (g) | 0 |

### 4.4 Sorties

| Champ | Description |
|-------|-------------|
| doseSuggeree | Dose finale arrondie (U) |
| bolusRepas | Composante repas (U) |
| correction | Correction brute (U) |
| correctionNette | Correction moins IOB (U) |
| bonusGras | Supplement gras (U) |

---

## 5. Regles de securite

### 5.1 Hierarchie

**Fichier** : `src/utils/clinicalEngine.js` — fonction `applySafetyRules()`

Les regles sont evaluees dans l'ordre. Un **blocage** arrete le processus.

| # | Regle | Condition | Action | Type |
|---|-------|-----------|--------|------|
| 1 | Anti-hypo | glycemie < 0.70 g/L | **Blocage** injection | risque |
| 2 | Hypo-proche | 0.70 <= glycemie < 0.90 g/L | Reduction 50% | risque |
| 3 | Surdosage | dose > maxDose | **Blocage** + dialogue | risque |
| 4 | Sur-correction | tendance descendante + correction | Alerte | alerte |
| 5 | Anti-stacking | IOB > 2 U | Alerte empilement | alerte |
| 6 | Alerte timing | derniere injection < 2h | Alerte rapprochement | alerte |
| 7 | Post-cetose | postKeto actif | Alerte vigilance | alerte |

### 5.2 Format des alertes

Chaque alerte/risque est un objet `{ type: string, message: string }` affiche dans la section Vigilance de ClinicalResponse.

---

## 6. Fractionnement bolus

### 6.1 Logique de determination

**Fichier** : `src/utils/clinicalEngine.js` — fonction `determineSplit(dose, fatLevel, slowDigestion, totalCarbs)`

| Condition | Type | Repartition | Delai |
|-----------|------|-------------|-------|
| Gras aucun/faible, pas de digestion lente | unique | 100% immediat | - |
| Gras moyen | fractionne | 60% immediat + 40% differe | 45 min |
| Gras eleve, carbs <= 60g | fractionne | 50% immediat + 50% differe | 60 min |
| Gras eleve, carbs > 60g | etendu | 50% + 30% + 20% | 0 / 60 / 180 min |
| Digestion lente (sans gras significatif) | fractionne | 70% immediat + 30% differe | 45 min |

### 6.2 Recalcul proportionnel

Quand la dose reelle differe de la dose suggeree, le fractionnement est recalcule proportionnellement :

```
scale = doseReelle / doseSuggeree

Si fractionne :
  immediate = round05(split.immediate * scale)
  delayed   = round05(doseReelle - immediate)

Si etendu (3 phases) :
  phase_i = round05(split.phases[i].units * scale)
  derniere_phase = doseReelle - somme(autres phases)
```

### 6.3 Affichage

- **Unique** : dose totale en grand + badge "Injection unique"
- **Fractionne** : 2 boxes cote a cote (immediat + differe) + total en petit
- **Etendu** : dose totale + 3 phases avec delais et unites

---

## 7. Courbe IOB (Insuline active)

### 7.1 Modele Walsh triangulaire

**Fichier** : `src/utils/iobCurve.js`

Parametres :
- **DIA** (Duration of Insulin Action) : defaut 270 min (4.5h), configurable
- **Peak** : 75 min (fixe)

```
Si t <= peak (75 min) :
  iob = dose * (peak - t) * t / (peak^2 / 2)

Si peak < t <= DIA :
  iob = dose * (DIA - t) / (DIA - peak)

Si t > DIA :
  iob = 0
```

### 7.2 IOB total

`calcTotalIOB(injections, dia)` : somme des IOB individuels de toutes les injections actives (dans la fenetre DIA).

### 7.3 Utilisation

- Calcul automatique a chaque consultation (IOB deduit de la correction)
- Affichage dans l'Analyse (badge bleu "IOB active X.X U")
- Calcul par entree dans le Journal (timeline)

---

## 8. Prediction post-repas

### 8.1 Formule

**Fichier** : `src/utils/clinicalEngine.js` — fonction `predictPostMealGlycemia()`

```
glycemieEstimee = glycemie + (totalCarbs / ratio * isf / 100) - (dose * isf / 100)
```

### 8.2 Affichage

Section "Prediction post-repas" dans ClinicalResponse :
- Valeur estimee a +2h (g/L)
- Variation par rapport a la glycemie actuelle
- Indicateur : "dans la cible" / "risque hypo" / "risque hyper"

---

## 9. Journal et timeline

### 9.1 Structure d'une entree journal

```json
{
  "id": "timestamp-hash",
  "date": "2026-04-10T12:30:00.000Z",
  "heure": "12:30",
  "glycPre": 1.45,
  "glycPost": 1.20,
  "totalGlucides": 66,
  "aliments": "Tajine poulet, The menthe",
  "niveauGras": "faible",
  "doseSuggeree": 8.5,
  "doseReelle": 8.5,
  "doseActual": 8.5,
  "tendance": "→",
  "activitePhysique": "aucune",
  "bolusType": "unique",
  "iobAuMoment": 0.3,
  "alertes": [],
  "notes": "Stress travail"
}
```

### 9.2 Evaluation post-prandiale

**Fichier** : `src/utils/clinicalEngine.js` — fonction `evaluatePostPrandial()`

| Resultat | Condition | Couleur |
|----------|-----------|---------|
| Bien corrige | glycPost dans cible | Vert |
| Sous-corrige | glycPost > cible haute | Orange |
| Sur-corrige | glycPost < cible basse | Rouge |
| Hypo post-prandiale | glycPost < 0.70 | Rouge vif |

### 9.3 Saisie glycemie post-prandiale

Champ inline dans chaque entree du journal. Sauvegarde en `parseFloat()` (corrige le bug string v5).

---

## 10. Statistiques et bilan

### 10.1 Bilan journalier

Affiche dans le Journal pour la date selectionnee :
- Temps en cible (TIR) : % des lectures dans [targetGMin, targetGMax]
- Moyenne glycemie
- Nombre d'injections
- Total glucides du jour
- Min / Max glycemie

### 10.2 Statistiques 30 jours

Affiche dans le Journal (section dediee) :
- Moyenne glycemie sur 30 jours
- TIR% sur 30 jours
- Nombre de consultations
- HbA1c estimee (si >= 30 lectures)

### 10.3 Formule HbA1c estimee

Formule ADAG (A1C-Derived Average Glucose) :

```
avgGL_mgdL = avgGlycemie_gL * 100
HbA1c = (avgGL_mgdL + 46.7) / 28.7
```

Affichee uniquement si >= 30 lectures glycemiques disponibles.

---

## 11. Reconnaissance alimentaire IA

### 11.1 Architecture

**Fichier** : `src/utils/foodRecognition.js`

| Etape | Detail |
|-------|--------|
| Capture | PhotoMeal.jsx — camera ou galerie |
| Compression | Max 800px largeur, JPEG |
| API | Groq API — modele Llama 4 Scout Vision |
| Prompt | Identification aliments, estimation glucides/lipides/proteines |
| Resultat | Array JSON `[{name, carbs, fat, protein, confidence}]` |
| Mapping | Correspondance avec base alimentaire locale |
| Validation | Modal de revision par l'utilisateur |

### 11.2 Cle API

- Variable d'environnement : `VITE_GROQ_API_KEY`
- Injectee au build via secret GitHub Actions
- Tier gratuit Groq : 500 requetes/jour

### 11.3 Gestion d'erreurs

- Timeout API → fallback saisie manuelle
- Rate limit → avertissement + saisie manuelle
- Erreur reseau → notification in-app

---

## 12. Reglages utilisateur

### 12.1 Section Profil

| Parametre | Type | Plage | Defaut |
|-----------|------|-------|--------|
| Nom | texte | - | - |
| Age | nombre | 2-100 | - |
| Sexe | choix | M/F | M |
| Taille | nombre | 80-220 cm | - |
| Poids | nombre | 20-250 kg | - |
| IMC | calcule | auto | - |

### 12.2 Section Medical

| Parametre | Type | Plage | Defaut |
|-----------|------|-------|--------|
| Insuline basale | texte | - | Tresiba |
| Insuline rapide | texte | - | NovoRapid |
| Dose basale | nombre | 1-100 U/jour | 12 |
| Post-cetose | toggle | on/off | off |
| Digestion lente | toggle | on/off | off |

### 12.3 Section Insuline

| Parametre | Type | Plage | Defaut |
|-----------|------|-------|--------|
| Ratio (g/U) | slider | 4-25 | 15 |
| ISF (mg/dL/U) | slider | 20-150 | 60 |
| Cible basse (g/L) | slider | 0.70-1.20 | 1.00 |
| Cible haute (g/L) | slider | 1.00-1.80 | 1.20 |
| Dose max (U) | slider | 2-30 | 10 |
| DIA (heures) | slider | 3-6 | 4.5 |

### 12.4 Section Notifications

| Parametre | Type | Defaut |
|-----------|------|--------|
| Activer notifications | toggle | off |

### 12.5 Section Affichage

| Parametre | Type | Options | Defaut |
|-----------|------|---------|--------|
| Theme | toggle | Clair / Sombre | Systeme |
| Langue | choix | Francais / Arabe | Francais |

---

## 13. Profils horaires

### 13.1 Principe

**Fichier** : `src/components/TimeProfiles.jsx`

Permettent de definir ratio et ISF differents selon la periode de la journee.

### 13.2 Periodes

| Periode | Plage horaire | Ratio defaut | ISF defaut |
|---------|--------------|--------------|------------|
| Matin | 06:00 - 11:00 | global | global |
| Midi | 11:00 - 16:00 | global | global |
| Soir | 16:00 - 22:00 | global | global |
| Nuit | 22:00 - 06:00 | global | global |

### 13.3 Utilisation

Si des profils horaires sont configures, `ConsultationScreen` selectionne automatiquement le ratio et l'ISF correspondant a l'heure de la consultation.

---

## 14. Export PDF

### 14.1 Contenu du rapport

**Fichier** : `src/components/PdfExport.jsx`

Le rapport PDF genere cote client comprend :

1. **En-tete** : nom patient, date, version app
2. **Statistiques 30 jours** :
   - Moyenne glycemie
   - Temps en cible (%)
   - HbA1c estimee
   - Nombre de consultations
3. **Tableau des entrees** :
   - Date | Heure | Glyc. pre | Aliments | Glucides | Gras | Dose | Tendance | Activite | Notes
4. **Graphique** : evolution glycemique

### 14.2 Champs v5 avec retrocompatibilite v4

L'export gere les deux schemas de champs (v4 et v5) pour les donnees historiques.

---

## 15. Export donnees

### 15.1 Formats

**Fichier** : `src/components/DataExport.jsx`

- **JSON** : export complet du journal
- **CSV** : tableau tabulaire pour tableur

### 15.2 Selection

Export du journal complet.

---

## 16. Internationalisation

### 16.1 Langues supportees

| Langue | Code | Direction | Fichier |
|--------|------|-----------|---------|
| Francais | fr | LTR | `src/i18n/fr.js` |
| Arabe | ar | RTL | `src/i18n/ar.js` |

### 16.2 Couverture

530+ cles de traduction par langue couvrant :
- Labels UI et boutons
- Messages cliniques (alertes, recommandations)
- Noms de parametres
- Messages d'erreur et validation
- Placeholders et textes d'aide

### 16.3 Implementation

- Hook `useI18n()` retourne `{ t, locale, setLocale, isRTL }`
- `t(key)` retourne la traduction ou la cle si absente
- Dates formattees selon locale (`fr-FR` ou `ar-MA`)
- Attribut `dir="rtl"` applique au conteneur racine si arabe

---

## 17. Gestion des versions et migration

### 17.1 Source de version

**Fichier** : `src/version.js`

```javascript
export const APP_VERSION = '6.0.0';
```

Importe par `main.jsx` et `App.jsx`. Affiche dans le header de l'app.

### 17.2 Cache busting

**Fichier** : `src/main.jsx` — fonction `handleVersionMigration()`

A chaque chargement, si la version stockee differe de `APP_VERSION` :
1. Migration des donnees journal
2. Desincription de tous les Service Workers
3. Suppression de tous les caches navigateur
4. Mise a jour de la version stockee

### 17.3 Migration v4 → v5/v6

**Fichier** : `src/utils/migration.js`

| Champ v4 | Champ v5 |
|----------|----------|
| preMealGlycemia | glycPre |
| postMealGlycemia | glycPost |
| totalCarbs | totalGlucides |
| foods | aliments |
| doseCalculated | doseSuggeree |
| doseInjected | doseReelle |

Nouveaux champs v5 (avec defauts) :
- tendance: null
- niveauGras: 'aucun'
- iobAuMoment: null
- bolusType: 'unique'
- activitePhysique: 'aucune'
- alertes: []
- notes: ''
- heure: extraite de la date

### 17.4 Compatibilite

- Cles localStorage identiques (`insulincalc_v4_` prefix) → donnees preservees
- Migration idempotente (peut s'executer plusieurs fois sans effet)
- `needsMigration(version)` : true si major < 5

---

## 18. Notifications

### 18.1 Systeme

**Fichier** : `src/utils/notifications.js`

- Notification navigateur native (permission requise)
- Fallback in-app si permission refusee

### 18.2 Types

| Type | Declencheur |
|------|-------------|
| Rappel post-prandial | 2h apres un repas enregistre |
| Rappel phase fractionnee | Heure de la phase suivante |

---

## 19. Base alimentaire

### 19.1 Structure

**Fichier** : `src/data/foods.js`

100+ aliments avec :
```json
{
  "id": "riz_blanc",
  "name": "Riz blanc cuit",
  "category": "feculents",
  "carbs": 28,
  "fat": 0.3,
  "protein": 2.7,
  "gi": "eleve",
  "portion": 100,
  "unit": "g"
}
```

### 19.2 Categories

Feculents, Fruits, Legumes, Produits laitiers, Proteines, Matieres grasses, Sucreries, Boissons, Plats composes

### 19.3 Aliments personnalises

L'utilisateur peut creer des aliments personnalises (nom, glucides, lipides, proteines par portion). Stockes dans `localStorage` sous la cle `insulincalc_v4_custom_foods`.

---

## 20. Tests et qualite

### 20.1 Framework

Vitest 4.1 + jsdom + @testing-library/react

### 20.2 Suites de tests

| Fichier | Tests | Couverture |
|---------|-------|-----------|
| spec-compliance.test.js | 39 | Conformite au spec : defauts, formules, securite, split, IOB |
| clinicalEngine.test.js | ~50 | Moteur clinique : dose, securite, split, evaluation |
| iobCurve.test.js | ~15 | Courbe IOB : peak, DIA, multi-injections |
| extendedPlan.test.js | ~20 | Plan etendu 3 phases |
| v57-enhancements.test.js | ~30 | Ameliorations v5.7 : prediction, IA |
| calculations.test.js | ~30 | Calculs annexes : IMC, HbA1c |
| validation.test.js | ~25 | Validation saisies |
| migration.test.js | ~15 | Migration v4→v5 |
| foods.test.js | ~20 | Base alimentaire |
| foodRecognition.test.js | ~20 | Reconnaissance IA |
| i18n.test.js | ~15 | Traductions FR/AR |
| timeProfiles.test.js | ~15 | Profils horaires |
| v43-integration.test.js | ~40 | Integration v4.3 |
| **Total** | **434** | |

### 20.3 Execution

```bash
npm test          # vitest run (CI)
npm run test:watch  # vitest watch (dev)
```

---

## 21. CI/CD et deploiement

### 21.1 Workflow

**Fichier** : `.github/workflows/deploy.yml`

| Etape | Commande |
|-------|----------|
| Checkout | actions/checkout@v5 |
| Node 22 | actions/setup-node@v5 |
| Install | npm ci |
| Tests | npx vitest run |
| Build | npm run build |
| Deploy | GitHub Pages (actions/deploy-pages@v4) |

### 21.2 Declencheur

- Push sur `main`
- Dispatch manuel

### 21.3 Secrets

| Secret | Usage |
|--------|-------|
| VITE_GROQ_API_KEY | Cle API Groq pour la reconnaissance alimentaire |

### 21.4 Artefact

Build genere dans `build/` — uploade comme artefact GitHub Pages.

---

## 22. Securite et conformite

### 22.1 Donnees patient

- **Aucune donnee n'est envoyee a un serveur** (sauf photos repas vers Groq API)
- Toutes les donnees medicales sont stockees localement (localStorage)
- Pas de compte utilisateur ni d'authentification
- Export possible en local (PDF, JSON, CSV)

### 22.2 Disclaimer medical

L'onboarding inclut un disclaimer : l'application est un outil d'aide au calcul et ne remplace pas l'avis medical. Les parametres doivent etre valides par un soignant.

### 22.3 Securite clinique

- 7 regles de securite hierarchisees
- Blocage automatique en cas d'hypoglycemie
- Dialogue de confirmation pour surdosage
- Anti-stacking pour eviter l'empilement d'insuline

---

## 23. Historique des versions

| Version | Date | Changements majeurs |
|---------|------|---------------------|
| 4.0.0 | 2026-03 | Architecture v4 : React 19, Tailwind 4, moteur clinique v5 |
| 4.3.0 | 2026-03 | Onglet Consultation renomme Accueil, affichage dose fractionnee |
| 5.4.0 | 2026-03 | Prediction post-repas, profils horaires, reconnaissance IA |
| 5.7.0 | 2026-03 | Enhanced AI food recognition, i18n arabe |
| **6.0.0** | **2026-04** | **Audit complet : securite clinique, UX, migration racine** |

### Detail v6.0.0

**Securite clinique :**
- Alignement des 5 valeurs par defaut sur le spec (ratio 15, ISF 60, cible 1.0-1.2, maxDose 10)
- Alignement onboarding
- 39 tests de conformite spec
- Spec IOB mis a jour (modele triangulaire Walsh documente)

**Corrections UX :**
- Redirection vers Journal apres confirmation (suppression ecran plan redondant)
- Recalcul proportionnel du split quand dose reelle differe
- glycPost sauvegarde en number (corrige bug string)
- Stats 30 jours + HbA1c estimee dans le Journal
- Support RTL pour les dates (locale ar-MA)
- Suppression enum digestion legacy, conservation du boolean slowDigestion

**Ameliorations :**
- Champ notes optionnel dans la consultation
- DoseBreakdown numerique (bolusRepas, correctionNette, bonusGras)
- Arrondi a 2 decimales dans DoseBreakdown (corrige floating point)
- Cles i18n notes/notesPlaceholder ajoutees (FR + AR)
- Etape test ajoutee au CI (deploy.yml)
- computeDailySummary : parseFloat sur glycPre/glycPost (corrige NaN)

**Migration :**
- Codebase deplacee de v4/ vers la racine
- Suppression v4/ et fichiers legacy (assets, fonts, logos, SW, worker)
- Version 6.0.0 dans version.js, package.json, index.html
- Cache busting corrige (main.jsx importe version.js au lieu de hardcode)
- deploy.yml pointe vers la racine

---

*Document genere le 2026-04-10 — InsulinCalc v6.0.0*
*434 tests verts | Build propre | Deploye sur GitHub Pages*
