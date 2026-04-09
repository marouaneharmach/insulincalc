# InsulinCalc v5 — Recadrage clinique

**Date** : 2026-03-28
**Approche** : Refonte progressive de v4
**Statut** : Design approuvé

---

## 1. Vision

Transformer InsulinCalc d'un calculateur de dose en un **coach diabétologique intelligent** pour patients diabétiques de type 1. L'app agit comme un endocrinologue prudent : elle analyse la situation glycémique, recommande une dose avec justification, signale les risques, et guide le suivi.

**Principes directeurs** :
- Sécurité d'abord : jamais de correction agressive, anti-stacking systématique
- Algorithmes déterministes (pas d'IA/LLM) : prédictible, auditable, offline
- Interface simplifiée : 3 écrans, flux "consultation" central
- Profil patient unique, usage personnel

---

## 2. Architecture des écrans

### 2.1 Navigation — 3 tabs (bottom bar)

| Tab | Nom | Rôle |
|-----|-----|------|
| 1 | **Consultation** | Saisie glycémie + repas → analyse clinique structurée |
| 2 | **Journal** | Historique, tendances, stats 30j, export PDF |
| 3 | **Réglages** | Profil patient, paramètres insuline, préférences app |

### 2.2 Écran Consultation — flux utilisateur

1. **Saisie glycémie** — champ numérique avec auto-conversion mg/dL→g/L, sélecteur de tendance (↑ ↗ → ↘ ↓ + option "?" = inconnue, défaut), heure auto-remplie. Si tendance = inconnue, le moteur clinique ignore les règles liées à la tendance.
2. **Saisie repas** — deux modes basculables :
   - **Mode expert** (défaut) : saisie directe glucides (g) + sélecteur niveau de gras (aucun/faible/moyen/élevé)
   - **Mode assisté** : recherche alimentaire par autocomplétion + reconnaissance photo (Clarifai)
3. **Contexte** — activité physique prévue (aucune/légère/modérée/intense), affichage IOB en temps réel
4. **Bouton "Analyser"** → affiche la réponse clinique structurée

### 2.3 Réponse clinique (4 blocs)

- **Analyse** — situation glycémique, insuline active restante, contexte repas
- **Recommandation** — dose (fourchette si incertitude) + timing (immédiat/différé/fractionné) + raisonnement
- **Vigilance** — risques identifiés (hypo, stacking, pic retardé gras/protéines)
- **Prochaine étape** — quand recontrôler la glycémie

### 2.4 Composants supprimés

HomeScreen, MealBuilder, FoodCategory, FoodList, QtyStepper, QuickAddSheet, TabNav/BottomNav (remplacé), InjectionTracker, PostMealCorrector, ResultCard, TrendChart (fusionné avec GlycEvolutionChart).

---

## 3. Moteur clinique (Clinical Engine)

Nouveau module `src/utils/clinicalEngine.js` — logique médicale déterministe.

### 3.1 Insuline Active (IOB)

- **Modèle Walsh triangulaire** (référence : Walsh et al., "Guidelines for Optimal Bolus Calculator Settings in Adults") pour insuline rapide (NovoRapid)
- Courbe : activité triangulaire avec intégrale en forme fermée. Formule :
  ```
  si T >= DIA : IOB = 0
  si T <= 0   : IOB = dose
  si T <= peak :
    IOB = dose * (1 - T² / (peak * DIA))
  sinon :
    IOB = dose * (DIA - T)² / (DIA * (DIA - peak))
  IOB = dose * max(0, min(1, iobFraction))
  ```
  Paramètres par défaut : peak = 75 min, DIA = 270 min (4h30)
- Durée d'action (DIA) configurable (défaut 270 min = 4h30)
- `iob(dose, minutesEcoulees, dureeAction)` → unités restantes
- IOB totale = somme des IOB de toutes les injections des dernières `DIA` minutes (depuis le journal)

### 3.2 Détection anti-stacking

L'IOB est soustraite **uniquement de la correction**, pas du bolus repas (un repas nécessite sa propre couverture indépendamment de l'insuline active) :

```
correctionNette = max(0, correction - iobTotale)
doseSuggeree = bolusRepas + correctionNette + bonusGras
```

Alertes supplémentaires :
- Dernière injection < 2h → alerte "correction trop rapprochée"
- IOB > 2u ET correction demandée → avertissement stacking avec explication

### 3.3 Bolus fractionné

Déclenché si gras "moyen"/"élevé" OU flag profil "digestion lente habituelle" activé :

| Condition | Schéma |
|-----------|--------|
| Gras moyen | 60% immédiat + 40% à +45min |
| Gras élevé | 50% immédiat + 50% à +60min |
| Digestion lente (flag profil, sans gras élevé) | 70% immédiat + 30% à +60min |
| Digestion lente + gras moyen/élevé | Utiliser le schéma gras (prioritaire, plus conservateur) |

Le flag "digestion lente habituelle" dans le profil est un booléen on/off. Il n'y a pas de sélecteur par repas — si activé, il s'applique à tous les repas. La patiente peut le désactiver dans les réglages si sa digestion se normalise.

Notifications programmées pour rappel de la 2e dose.

### 3.4 Calcul de dose

```
bolusRepas     = totalGlucides / ratio
correction     = (glycemie - cibleHaute) / ISF    // seulement si glycémie > cibleHaute (1.20)
bonusGras      = bolusRepas × FAT_FACTOR[niveauGras]
correctionNette = max(0, correction - iobTotale)   // IOB soustrait de la correction uniquement
doseSuggeree   = bolusRepas + correctionNette + bonusGras
```

**FAT_FACTOR** (bonus gras appliqué au bolus repas) :

| Niveau | Facteur | Exemple |
|--------|---------|---------|
| aucun  | 0.00    | Fruits, légumes |
| faible | 0.04    | Tajine léger |
| moyen  | 0.14    | Couscous avec viande |
| élevé  | 0.27    | Fritures, pâtisseries |

**Réduction activité physique** (appliquée sur doseSuggeree finale) :

| Activité | Réduction |
|----------|-----------|
| aucune   | 0% |
| légère   | 0% |
| modérée  | -20% |
| intense  | -30% |

Arrondi au 0.5u le plus proche.

**Profils horaires** : ratio/ISF peuvent varier par tranche horaire. Tranches par défaut :

| Tranche | Heures |
|---------|--------|
| Matin   | 06:00–11:59 |
| Midi    | 12:00–17:59 |
| Soir    | 18:00–22:59 |
| Nuit    | 23:00–05:59 |

Le moteur sélectionne le ratio/ISF en fonction de l'heure de la consultation.

### 3.5 Règles de sécurité

| Règle | Condition | Action |
|-------|-----------|--------|
| Anti-hypo | glycémie < 0.70 g/L | Bloquer toute injection, recommander resucrage 15g |
| Hypo proche | 0.70–0.90 g/L | Réduire dose de 50%, avertissement |
| Anti-stacking | IOB > 2u ET correction demandée | IOB déjà soustraite (§3.2), afficher avertissement explicatif |
| Alerte timing | dernière injection < 2h | Avertissement "correction trop rapprochée" |
| Surdosage | dose > maxDose | Bloquer, demander confirmation |
| Sur-correction | tendance ↓/↘ ET correction demandée (tendance ≠ inconnue) | Réduire correction de 50% ou abstenir |
| Post-keto | flag activé dans profil | Messages spécifiques hausses retardées |
| Activité modérée | activité = "moderee" | Réduire dose de 20%, alerter hypo retardée |
| Activité intense | activité = "intense" | Réduire dose de 30%, alerter hypo retardée |

### 3.6 Fonction principale

```js
analyzeAndRecommend(inputs) → {
  analysis:       { text, glycemiaStatus, iob, trend },
  recommendation: { dose, timing, split, reasoning },
  vigilance:      { risks: [], warnings: [] },
  nextStep:       { checkTime, instruction }
}
```

Tous les textes générés par templates FR/AR selon conditions. Purement déterministe.

---

## 4. Profil patient et réglages

### 4.1 Profil médical

- Nom/prénom (optionnel, pour export PDF)
- Âge, sexe, poids (kg)
- Type d'insuline basale + dose quotidienne
- Type d'insuline rapide
- Flag "profil post-keto"
- Flag "digestion lente habituelle"

### 4.2 Paramètres insuline

| Paramètre | Défaut |
|-----------|--------|
| Ratio glucides (g/u) | 15 |
| ISF | 60 mg/dL (= 0.60 g/L) |
| Glycémie cible min | 1.00 g/L |
| Glycémie cible max | 1.20 g/L |
| Dose max sécurité (u) | 10 |
| Durée d'action rapide (h) | 4.5 (270 min) |

Profils horaires conservés : override ratio/ISF par tranche horaire.

### 4.3 Préférences app

- Langue (FR/AR avec RTL)
- Thème (clair/sombre)
- Notifications (on/off)
- Unité glycémie (g/L ou mg/dL)

### 4.4 Onboarding simplifié (3 étapes)

1. **Profil** : âge, poids, sexe, type insuline
2. **Paramètres** : ratio, ISF, cible (valeurs par défaut pré-remplies)
3. **Disclaimer** : acceptation obligatoire

---

## 5. Journal et suivi

### 5.1 Format d'entrée

```js
{
  id, date, heure,
  glycPre, glycPost, tendance,
  totalGlucides, niveauGras,
  aliments,          // liste si mode assisté, null si mode expert
  iobAuMoment,
  doseSuggeree, doseReelle,
  bolusType,         // "unique" | "fractionne"
  activitePhysique,  // "aucune" | "legere" | "moderee" | "intense"
  alertes,           // risques identifiés par le moteur clinique
  notes              // texte libre optionnel (contexte : stress, maladie, etc.)
}
```

### 5.2 Vue Journal (tab 2)

- **Vue par jour** : liste chronologique, code couleur glycémie (vert/orange/rouge)
- **Stats 30 jours** : glycémie moyenne, temps dans la cible (%), nb consultations, HbA1c estimée
- **Tendances** : graphique GlycEvolutionChart (conservé)
- **Export PDF** : rapport médecin (PdfExport adapté)

### 5.3 Glycémie post-prandiale

Ajout glycPost sur entrée existante depuis le journal. Feedback automatique :
- "Bonne correction" / "Sous-corrigé" / "Sur-corrigé"
- Suggestion informative d'ajustement ratio

---

## 6. Composants — créer, adapter, supprimer

### 6.1 Nouveaux composants

| Composant | Rôle |
|-----------|------|
| `ConsultationScreen.jsx` | Écran principal : orchestrateur du flux consultation |
| `ClinicalResponse.jsx` | Affichage 4 blocs réponse clinique |
| `GlycemiaInput.jsx` | Champ glycémie + sélecteur tendance |
| `MealInput.jsx` | Bascule expert/assisté, intègre PhotoMeal |
| `ContextInput.jsx` | Activité physique + IOB |
| `IOBDisplay.jsx` | Badge IOB temps réel |

### 6.2 Composants conservés et adaptés

| Composant | Adaptation |
|-----------|------------|
| `PhotoMeal.jsx` | Intégré dans MealInput |
| `DayTimeline.jsx` | Adapté nouveau format entrée |
| `PdfExport.jsx` | Adapté nouveau format données |
| `GlycEvolutionChart.jsx` | Conservé tel quel |
| `Settings.jsx` | Restructuré 3 sections |
| `Onboarding.jsx` | Simplifié 3 étapes |
| `ErrorBoundary.jsx` | Conservé |
| `OverdoseDialog.jsx` | Conservé |

### 6.3 Composants supprimés

HomeScreen, MealBuilder, FoodCategory, FoodList, QtyStepper, QuickAddSheet, TabNav/BottomNav, InjectionTracker, PostMealCorrector, ResultCard, TrendChart.

### 6.4 Nouveaux modules utilitaires

| Module | Rôle |
|--------|------|
| `src/utils/clinicalEngine.js` | Logique clinique complète |
| `src/utils/iobCurve.js` | Courbe décroissance insuline (séparé pour testabilité) |

Modules existants conservés et adaptés : `calculations.js`, `colors.js`, `notifications.js`, `exportPdf.js`.

---

## 7. Migration des données

### 7.1 localStorage

- Clé `app_version` dans localStorage. Format semver : v4 actuel = "4.4.3", v5 = "5.0.0"
- Si `app_version` absente ou < "5.0.0" → migration automatique
- Migration entrées existantes : ajout champs manquants avec valeurs par défaut (`tendance: null`, `iobAuMoment: null`, `activitePhysique: "aucune"`, `alertes: []`, `notes: ""`)
- Paramètres existants (ratio, ISF, cible, poids) conservés — mêmes clés
- Nouveaux champs profil → valeurs par défaut

### 7.2 Base alimentaire

`foods.js` inchangé. 200+ aliments marocains conservés.

---

## 8. Tests

### 8.1 Tests existants conservés

`calculations.test.js`, `foods.test.js`, `validation.test.js`, `i18n.test.js` — adaptés si changement d'API.

### 8.2 Nouveaux tests

| Fichier | Couverture |
|---------|-----------|
| `clinicalEngine.test.js` | IOB, anti-stacking, bolus fractionné, règles sécurité, scénarios cliniques complets |
| `iobCurve.test.js` | Courbe décroissance, cas limites (T=0, T>durée, dose=0) |
| `migration.test.js` | Migration ancien format → nouveau |

---

## 9. Stack technique

Inchangée : React 19 + Vite 8 + Tailwind CSS 4 + Vitest. Pas de nouvelle dépendance.

---

## 10. Notes d'implémentation

1. **Hypo proche (0.70–0.90 g/L)** : la réduction de 50% s'applique à la `doseSuggeree` totale (repas + correction + bonus), pas uniquement à la correction.
2. **Tendance inconnue** : le moteur clinique doit traiter `null` ET `"?"` comme tendance inconnue (compatibilité migration v4 → v5).
3. **Arrondi bolus fractionné** : arrondir la dose totale au 0.5u d'abord, puis appliquer le split, puis arrondir chaque fraction au 0.5u. La somme des fractions peut différer de ±0.5u du total — acceptable.
4. **Schema aliment dans journal** : chaque item de `aliments[]` = `{ id, name, carbs, qty, fat, gi }` (mêmes champs que `foods.js` + quantité choisie).
