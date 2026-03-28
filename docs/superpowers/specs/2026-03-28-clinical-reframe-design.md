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

1. **Saisie glycémie** — champ numérique avec auto-conversion mg/dL→g/L, sélecteur de tendance (↑ ↗ → ↘ ↓), heure auto-remplie
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

- Modèle de décroissance curvilinéaire pour insuline rapide (NovoRapid)
- Durée d'action configurable (défaut 4h30)
- `iob(dose, minutesEcoulees, dureeAction)` → unités restantes
- Calcul automatique depuis l'historique des injections du journal

### 3.2 Détection anti-stacking

- Dernière injection < 2h → alerte "correction trop rapprochée"
- IOB > 50% de la dose recommandée → réduction automatique
- `doseEffective = max(0, doseCalculee - iobRestante)`

### 3.3 Bolus fractionné

Déclenché si gras "moyen"/"élevé" OU digestion "lent"/"très lent" :

| Condition | Schéma |
|-----------|--------|
| Gras moyen | 60% immédiat + 40% à +45min |
| Gras élevé | 50% immédiat + 50% à +60min |

Notifications programmées pour rappel de la 2e dose.

### 3.4 Calcul de dose

```
bolusRepas   = totalGlucides / ratio
correction   = (glycemie - cibleMoyenne) / ISF    // si glycémie > cible haute
bonusGras    = bolusRepas × FAT_FACTOR[niveauGras]
doseCalculee = bolusRepas + correction + bonusGras
doseSuggeree = max(0, doseCalculee - IOB)
```

Arrondi au 0.5u le plus proche. Profils horaires : ratio/ISF peuvent varier par tranche (matin, midi, soir, nuit).

### 3.5 Règles de sécurité

| Règle | Condition | Action |
|-------|-----------|--------|
| Anti-hypo | glycémie < 0.70 g/L | Bloquer injection, recommander resucrage |
| Hypo proche | 0.70–0.90 g/L | Réduire dose de 50%, avertissement |
| Anti-stacking | IOB > 2u ET correction demandée | Soustraire IOB, expliquer |
| Surdosage | dose > maxDose | Bloquer, demander confirmation |
| Sur-correction | tendance ↓/↘ ET correction demandée | Réduire ou abstenir |
| Post-keto | flag activé dans profil | Messages spécifiques hausses retardées |
| Activité physique | modérée/intense | Réduire dose 20–30%, alerter risque hypo retardée |

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
| ISF (g/L par unité) | 0.60 |
| Glycémie cible min | 1.00 |
| Glycémie cible max | 1.20 |
| Dose max sécurité (u) | 10 |
| Durée d'action rapide (h) | 4.5 |

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
  alertes            // risques identifiés par le moteur clinique
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

- Détection version (`app_version`)
- Migration entrées existantes : ajout champs manquants avec valeurs par défaut (`tendance: null`, `iobAuMoment: null`, `activitePhysique: "aucune"`, `alertes: []`)
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
