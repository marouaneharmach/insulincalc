# Analyse Endocrinologique du Profil Glycémique — Spécifications Fonctionnelles

**Date** : 3 avril 2026
**Version** : v6.0-spec
**Auteur** : Analyse experte en diabétologie / endocrinologie
**Cible** : InsulinCalc — Application de calcul glycémique

---

## 1. Synthèse du Profil Clinique Observé

### 1.1 Courbe glycémique de la journée

| Période | Glycémie (g/L) | Statut clinique |
|---------|----------------|-----------------|
| Matin (réveil) | ~0.60 | **Hypoglycémie marquée** |
| Matinée | Remontée → 1.20 | Correction naturelle |
| Mi-journée | 1.50–1.80 | **Dans la cible** |
| Après-midi | Pic ~2.00 | Légèrement au-dessus |
| Fin de journée | Descente → 1.20 | **Dans la cible** |

### 1.2 Diagnostic expert

Le profil révèle un patient avec un **bon contrôle glycémique global** (temps dans la cible estimé > 65%) mais avec un **problème critique d'empilement insulinique** (insulin stacking) provoquant des hypoglycémies matinales.

**Mécanisme identifié** :
- Les corrections tardives de la veille (probablement après le dîner ou au coucher) créent un excès d'insuline active qui se manifeste par une hypo au réveil.
- Le corps compense naturellement mais le risque nocturne est réel et potentiellement dangereux.

### 1.3 Points forts du patient
- Capable de maintenir une glycémie entre 1.2 et 2.0 g/L sur la majeure partie de la journée
- Bon dosage des repas (pas de pics post-prandiaux majeurs)
- Redescente naturelle en fin de journée sans crash

### 1.4 Points de vigilance
- Hypoglycémies récurrentes (probablement nocturnes/matinales)
- Tendance à la sur-correction (objectif trop strict < 1.8 g/L)
- Empilement des doses de correction

---

## 2. Fonctionnalités à Intégrer — Analyse Gap

### 2.1 Ce qui EXISTE déjà et fonctionne

| Fonctionnalité | Fichier | Statut |
|---------------|---------|--------|
| IOB Walsh triangulaire | `iobCurve.js` | OK |
| Anti-stacking warning (IOB > 2U) | `clinicalEngine.js` L185-189 | Basique |
| Timing alert (< 120 min) | `clinicalEngine.js` L194-199 | Basique |
| Anti-hypo block (< 0.70) | `clinicalEngine.js` L146-152 | OK |
| Hypo-proche réduction 50% | `clinicalEngine.js` L157-162 | OK |
| Sur-correction (tendance baissière) | `clinicalEngine.js` L176-183 | OK |
| Stats time-in-range | `journalStore.js` L91-147 | Basique |

### 2.2 Ce qui MANQUE CRUCIALEMENT

---

## 3. Spécifications des Nouvelles Fonctionnalités

### FEATURE 1 : Système Anti-Empilement Intelligent (Stacking Guard)

**Priorité** : CRITIQUE
**Justification clinique** : L'empilement insulinique est la cause n°1 des hypoglycémies chez les DT1 sous schéma basal-bolus.

**Règles actuelles** (insuffisantes) :
- Warning si IOB > 2U (seuil fixe, pas personnalisé)
- Warning si dernière injection < 120 min

**Règles proposées** :

```
RÈGLE 1 — IOB dynamique
  SI (iobTotal / doseSuggeree) > 0.5
  ALORS : warning "Insuline active représente >50% de la dose suggérée"
  ACTION : réduire correction de (iobTotal / doseSuggeree × 100)%

RÈGLE 2 — Fenêtre de correction nocturne
  SI heure ∈ [21h00 – 06h00]
  ET glycémie < 2.20 g/L
  ALORS : BLOQUER toute correction
  MESSAGE : "Glycémie nocturne acceptable. Pas de correction pour éviter l'hypo matinale."

RÈGLE 3 — Correction maximale tardive
  SI dernière_injection < 180 min (pas 120)
  ET correction > 0
  ALORS : correction_max = min(correction, 1.0 U)
  MESSAGE : "Correction limitée à 1U — insuline précédente encore active"

RÈGLE 4 — Cumul journalier
  SI somme_corrections_24h > (TDD_estimée × 0.15)
  ALORS : warning "Cumul de corrections élevé — vérifier la basale"
```

**Impact sur le code** :
- Modifier `applySafetyRules()` dans `clinicalEngine.js`
- Ajouter un paramètre `currentHour` aux inputs
- Ajouter un calcul de cumul depuis `journalStore`

---

### FEATURE 2 : Mode Nocturne Sécurisé

**Priorité** : CRITIQUE
**Justification clinique** : Les hypoglycémies nocturnes sont les plus dangereuses (pas de symptômes ressentis, risque d'hypoglycémie sévère).

**Spécifications** :

```
ACTIVATION : Automatique entre 21h00 et 06h00 (configurable)

COMPORTEMENT :
  1. Seuil de correction relevé :
     - Jour : correction si glycémie > targetMax (ex: 1.80)
     - Nuit : correction UNIQUEMENT si glycémie > 2.50 g/L

  2. Dose de correction réduite :
     - Nuit : correction × 0.5 (demi-dose max)

  3. Alerte proactive :
     SI glycémie < 1.50 g/L en mode nocturne
     ALORS : "Glycémie basse pour la nuit. Collation recommandée (15-20g glucides lents)"

  4. Objectif nuit : 1.20 – 2.20 g/L (plus large que le jour)
```

**Nouveau composant UI** : `NightModeIndicator`
- Icône lune dans le header quand mode nocturne actif
- Badge couleur sur la dose suggérée
- Message contextuel différent

---

### FEATURE 3 : Vitesse de Variation Glycémique (Glucose Velocity)

**Priorité** : HAUTE
**Justification clinique** : La vitesse de changement est aussi importante que la valeur absolue. Une glycémie à 1.80 qui monte rapidement nécessite une action différente d'une glycémie à 1.80 qui descend.

**Spécifications** :

```
CALCUL :
  velocity = (glycémie_actuelle - glycémie_précédente) / intervalle_heures

CLASSIFICATION :
  ↓↓  < -0.40 g/L/h  → Chute rapide (DANGER)
  ↓   -0.40 à -0.15   → Baisse modérée
  →   -0.15 à +0.15   → Stable
  ↑   +0.15 à +0.40   → Hausse modérée
  ↑↑  > +0.40          → Montée rapide

IMPACT SUR LA DOSE :
  ↓↓ : correction = 0 (même si glycémie haute)
  ↓  : correction × 0.5
  →  : correction standard
  ↑  : correction standard
  ↑↑ : correction × 1.2 + timing avancé (-30 min avant repas)
```

**Nouveau champ journal** : `glycemiaPrecedente`, `intervalleMinutes`
**Nouveau composant** : `VelocityIndicator` (flèche colorée)

---

### FEATURE 4 : Score de Risque Hypoglycémique

**Priorité** : HAUTE
**Justification clinique** : Un score composite permet de prévenir les hypos avant qu'elles ne surviennent.

**Algorithme** :

```
hypoRiskScore = 0

// Facteur 1 : Glycémie actuelle
SI glycémie < 1.00 : score += 3
SI glycémie 1.00–1.20 : score += 2
SI glycémie 1.20–1.50 : score += 1

// Facteur 2 : IOB résiduel
SI iobTotal > 3U : score += 3
SI iobTotal > 2U : score += 2
SI iobTotal > 1U : score += 1

// Facteur 3 : Tendance
SI trend = ↓↓ : score += 3
SI trend = ↓  : score += 2
SI trend = ↘  : score += 1

// Facteur 4 : Historique récent (24h)
SI hypo_dans_les_24h : score += 2

// Facteur 5 : Activité physique
SI activité = intense : score += 2
SI activité = moderee : score += 1

// Facteur 6 : Heure
SI heure ∈ [22h–06h] : score += 1

// Évaluation
SCORE 0-2  : FAIBLE → badge vert
SCORE 3-5  : MODÉRÉ → badge orange + message préventif
SCORE 6-8  : ÉLEVÉ → badge rouge + réduction dose 50%
SCORE 9+   : CRITIQUE → blocage correction + alerte resucrage
```

**Nouveau composant** : `HypoRiskBadge`
**Position UI** : À côté de la dose suggérée, toujours visible

---

### FEATURE 5 : Analyse de Patterns Avancée

**Priorité** : HAUTE
**Justification clinique** : Les patterns récurrents (hypo matinale, hyperglycémie post-déjeuner) indiquent des ajustements de traitement nécessaires.

**Patterns à détecter** :

```
PATTERN 1 — Phénomène de l'aube (Dawn Phenomenon)
  SI glyc_réveil > glyc_coucher + 0.30 g/L
  FRÉQUENCE > 3x/semaine
  → "Phénomène de l'aube détecté. Discuter ajustement basale nocturne avec médecin."

PATTERN 2 — Hypo matinale récurrente
  SI glyc_matin < 0.70 g/L
  FRÉQUENCE > 2x/semaine
  → "Hypos matinales récurrentes. Réduire correction du soir / basale nocturne."
  → ACTIVER automatiquement le mode nocturne renforcé

PATTERN 3 — Rebond post-hypo (Somogyi)
  SI glyc_N < 0.70 ET glyc_N+1 > 2.00 (dans les 4h suivantes)
  → "Rebond post-hypoglycémie détecté. Éviter la sur-correction du rebond."

PATTERN 4 — Sur-correction systématique
  SI (doseSuggeree - doseReelle) / doseSuggeree > 0.20
  FRÉQUENCE > 50% des entrées
  → "Tendance à injecter plus que la dose suggérée. Risque d'hypo augmenté."

PATTERN 5 — Créneau problématique
  Analyser TIR par tranche horaire (4h)
  SI TIR_tranche < 50%
  → "Créneau [Xh-Yh] : contrôle insuffisant. Ajuster ratio/basale pour cette période."

PATTERN 6 — Empilement récurrent
  SI corrections_rapprochées (< 2h) > 2x/semaine
  → "Corrections rapprochées fréquentes → risque d'empilement. Patience recommandée."
```

**Intégration** : Nouveau tab ou section dans Journal avec alertes colorées

---

### FEATURE 6 : Ratio ICR Variable par Période

**Priorité** : MOYENNE-HAUTE
**Justification clinique** : La sensibilité à l'insuline varie au cours de la journée (résistance plus élevée le matin due au cortisol, meilleure sensibilité l'après-midi).

**Spécifications** :

```
PÉRIODES (configurables) :
  Matin    (06h–11h) : ratio_matin   (ex: 8 g/U)
  Midi     (11h–15h) : ratio_midi    (ex: 10 g/U)
  Goûter   (15h–18h) : ratio_gouter  (ex: 12 g/U)
  Soir     (18h–22h) : ratio_soir    (ex: 10 g/U)
  Nuit     (22h–06h) : ratio_nuit    (ex: 10 g/U)

MÊME CHOSE POUR ISF :
  ISF varie aussi par période
  Matin : ISF généralement plus bas (plus résistant)
  Après-midi : ISF plus élevé (plus sensible)
```

**Impact Settings** : Remplacer ratio/ISF uniques par tableau de 5 valeurs
**Migration** : Valeur unique → même valeur pour toutes les périodes

---

### FEATURE 7 : Journal Glycémique Enrichi

**Priorité** : MOYENNE
**Justification clinique** : Le journal actuel manque de contextes clés pour l'analyse rétrospective.

**Nouveaux champs** :

```javascript
// Champs à ajouter à l'entrée journal
{
  // Contexte temporel
  periodeJour: 'matin'|'midi'|'gouter'|'soir'|'nuit',
  heureExacte: '14:30',

  // Contexte glycémique
  glycemiaPrecedente: 1.45,    // pour calcul velocity
  intervalleMinutes: 120,       // depuis dernière mesure
  velocity: 0.15,               // g/L/h calculé
  velocityTrend: '↑',

  // Contexte insulinique
  iobAuMoment: 2.3,
  cumulCorrections24h: 4.5,
  dernièreInjectionMinAgo: 95,

  // Score de risque
  hypoRiskScore: 3,
  hypoRiskLevel: 'modéré',

  // Mode
  modeNocturne: false,
  correctionBloquee: false,
  raisonBlocage: null,

  // Émotion / bien-être (optionnel)
  stress: 'normal'|'élevé'|'très élevé',
  sommeil: 'bon'|'moyen'|'mauvais',
  maladie: false,
}
```

---

### FEATURE 8 : Recommandations d'Ajustement de Traitement

**Priorité** : MOYENNE
**Justification clinique** : Fournir des suggestions data-driven pour la consultation médicale.

**Algorithme** :

```
Après 14 jours de données minimum :

1. ANALYSE TDD (Total Daily Dose)
   TDD_moyen = somme(doseReelle) / nombre_jours
   TDD_basal_estimé = TDD_moyen × 0.45–0.50
   SI TDD varie > 20% d'un jour à l'autre → "Variabilité importante des doses"

2. ANALYSE RATIO
   Pour chaque repas avec glycPre ET glycPost :
     ratio_effectif = glucides / dose_repas_seule
     SI glycPost dans cible → ratio correct
     SI glycPost > cible → ratio trop élevé (pas assez d'insuline)
     SI glycPost < cible → ratio trop bas (trop d'insuline)
   → Suggestion de nouveau ratio par période

3. ANALYSE ISF
   Pour chaque correction isolée (sans repas) :
     isf_effectif = (glycPre - glycPost) / dose_correction
   → Suggestion de nouveau ISF

4. GÉNÉRATION RAPPORT MÉDECIN (PDF)
   - Période analysée
   - TIR, moyenne, écart-type, HbA1c estimée
   - Patterns détectés
   - Suggestions d'ajustement ratio/ISF/basale
   - Graphique de tendance
```

---

### FEATURE 9 : Alertes Prédictives

**Priorité** : MOYENNE
**Justification clinique** : Anticiper l'hypo ou l'hyper plutôt que réagir.

```
PRÉDICTION GLYCÉMIQUE SIMPLE :
  glyc_prédite_1h = glycémie_actuelle + (velocity × 1)
  glyc_prédite_2h = glycémie_actuelle + (velocity × 2) - (iob_decay × isf)

  SI glyc_prédite_1h < 0.70 :
    ALERTE IMMÉDIATE "Hypo prévue dans ~1h. Collation préventive recommandée."

  SI glyc_prédite_2h > 2.50 :
    ALERTE "Hyperglycémie probable dans 2h. Surveiller de près."
```

---

### FEATURE 10 : Export Médecin Enrichi

**Priorité** : MOYENNE
**Justification clinique** : Faciliter la communication patient-médecin avec des données structurées.

**Contenu PDF enrichi** :

```
PAGE 1 — Résumé Exécutif
  - Période, nombre de mesures
  - TIR (objectif > 70%), HbA1c estimée
  - Score de variabilité glycémique (CV%)
  - Nombre d'hypos / hypers

PAGE 2 — Profil Glycémique Ambulatoire (AGP)
  - Courbe médiane + P10/P25/P75/P90 par heure
  - Zones colorées (cible en vert)

PAGE 3 — Patterns & Alertes
  - Liste des patterns détectés
  - Fréquence et sévérité
  - Créneaux problématiques

PAGE 4 — Données Insuliniques
  - TDD moyen
  - Répartition bolus/correction/basale estimée
  - Ratio effectif par période
  - ISF effectif par période

PAGE 5 — Recommandations
  - Ajustements suggérés (ratio, ISF, basale)
  - Objectifs pour la prochaine période
```

---

## 4. Priorisation d'Implémentation

| Phase | Features | Effort | Impact Patient |
|-------|----------|--------|----------------|
| **Phase 1** (immédiat) | F1 (Anti-empilement), F2 (Mode nocturne) | 2-3 jours | CRITIQUE |
| **Phase 2** (semaine 2) | F3 (Velocity), F4 (Hypo Risk Score) | 2-3 jours | HAUT |
| **Phase 3** (semaine 3) | F5 (Patterns), F6 (Ratio variable) | 3-4 jours | HAUT |
| **Phase 4** (semaine 4) | F7 (Journal enrichi), F8 (Recommandations) | 3-4 jours | MOYEN |
| **Phase 5** (semaine 5) | F9 (Prédictions), F10 (Export médecin) | 3-4 jours | MOYEN |

---

## 5. Impact sur l'Architecture Existante

### 5.1 Fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `clinicalEngine.js` | Ajouter règles anti-empilement, mode nocturne, velocity, hypo risk score |
| `iobCurve.js` | Ajouter `calcIOBPrediction()` pour prédiction à T+1h/T+2h |
| `journalStore.js` | Enrichir schéma, ajouter `getPatterns()`, `getCumulCorrections()` |
| `Settings.jsx` | Ratio/ISF par période, config mode nocturne |
| `ConsultationScreen.jsx` | Intégrer HypoRiskBadge, VelocityIndicator, NightMode |

### 5.2 Nouveaux fichiers

| Fichier | Rôle |
|---------|------|
| `utils/nightMode.js` | Logique mode nocturne |
| `utils/velocity.js` | Calcul et classification vitesse glycémique |
| `utils/hypoRisk.js` | Algorithme de score de risque |
| `utils/patternDetector.js` | Détection de patterns sur l'historique |
| `utils/treatmentAnalyzer.js` | Suggestions d'ajustement ratio/ISF |
| `components/HypoRiskBadge.jsx` | Badge de risque |
| `components/VelocityIndicator.jsx` | Flèche de tendance |
| `components/NightModeIndicator.jsx` | Indicateur mode nuit |
| `components/PatternAlerts.jsx` | Alertes de patterns |
| `components/AGPChart.jsx` | Profil glycémique ambulatoire |

### 5.3 Données i18n à ajouter

Toutes les nouvelles fonctionnalités doivent être traduites en FR et AR dans `i18n/fr.js` et `i18n/ar.js`.

---

## 6. Références Cliniques

- **Consensus ADA/EASD 2024** : Objectif TIR > 70%, TBR < 4%, CV < 36%
- **Modèle Walsh IOB** : Validé pour insulines rapides (NovoRapid, Humalog)
- **Phénomène de l'aube** : Cortisol peak 04h-08h → résistance insulinique
- **Effet Somogyi** : Rebond hyperglycémique post-hypoglycémie (contre-régulation)
- **Guidelines ISPAD 2024** : Ratios ICR variables par période chez l'enfant et l'adulte
- **Profil AGP** : Standard international de reporting glycémique (Ambulatory Glucose Profile)

---

## 7. Notes de Sécurité

- Toutes ces fonctionnalités sont des **aides à la décision**, jamais des prescriptions médicales.
- Le disclaimer médical existant doit être renforcé.
- Les seuils par défaut doivent être validés par le médecin traitant.
- Le mode nocturne et le blocage de correction doivent être désactivables.
- Les données prédictives doivent porter la mention "estimation, non garanti".
