# Changelog — InsulinCalc

## v5.7.0 (2026-04-04)

### Phase A — Modal d'édition IA
- Ajout d'un modal d'édition pour les aliments estimés par IA (glucides, lipides, poids)
- Validation de plausibilité : alerte si glucides > 150g ou lipides > 80g
- Option "Sauvegarder comme aliment personnalisé" dans le modal
- Création d'aliments temporaires avec flag `aiEstimated: true`

### Phase B — Matching IA amélioré
- Badges source DB (base de données locale) et IA (estimation intelligence artificielle)
- Mapping par mots-clés enrichi (burger, pizza, couscous, tajine, kebab, etc.)
- Les aliments non trouvés en base mais avec estimation IA sont cliquables et éditables
- Seuil de confiance minimum à 20% pour filtrer les résultats

### Phase C — Traçabilité repas
- Thumbnail photo compressé (80px) sauvegardé dans le journal
- Marqueur ✦ sur les aliments estimés par IA dans le journal
- Affichage du plan étendu 3 phases dans la timeline
- Badge "(étendu 3 phases)" pour les bolus étendus

### Phase D — Calcul intelligent
- `computeFatFactor()` : calcul continu des lipides (courbe 0g→0%, 5g→4.5%, cap 35%)
- `calculateDose()` accepte `totalFatGrams` pour calcul précis du bonus gras
- `analyzeAndRecommend()` propage `totalFatGrams` au calcul de dose
- ConsultationScreen transmet `totalFatGrams` (mode assisté) ou `null` (mode expert)
- Plan étendu 3 phases (50%/30%/20%) pour repas gras (élevé) + glucides > 60g

### Phase E — UX globale
- 30+ nouvelles clés i18n ajoutées en français et arabe
- Traductions complètes pour : modal IA, plan d'injection, prédiction, bilan journalier
- Badge "Étendu 3 phases" dans ClinicalResponse pour plans étendus
- Affichage détaillé des 3 phases avec timing et contrôle glycémie dans ClinicalResponse

### Phase F — Suivi glycémique
- `predictPostMealGlycemia()` : prédiction de glycémie à +2h post-repas
- Classification par zone : hypo, bas, cible, haut, hyper
- Affichage de la prédiction dans ClinicalResponse (section dédiée avec code couleur)
- `computeDailySummary()` : bilan journalier (temps en cible, moyenne, min/max, injections, glucides)
- Widget "Bilan journalier" dans DayTimeline avec 4 indicateurs clés

### Tests
- 395 tests unitaires et d'intégration (13 fichiers)
- Nouveau fichier `v57-enhancements.test.js` : 50+ tests couvrant phases A-F
- Tests de computeFatFactor, predictPostMealGlycemia, computeDailySummary
- Tests i18n : vérification des 30+ nouvelles clés FR et AR
- Tests d'intégration : flux complet IA → dose → prédiction

### Fichiers modifiés
- `src/utils/clinicalEngine.js` — computeFatFactor, predictPostMealGlycemia, computeDailySummary
- `src/utils/foodRecognition.js` — estimatedFat, estimatedWeight, estimatedGI, deriveFatLevel
- `src/components/MealInput.jsx` — modal IA, badges DB/IA, edit avec plausibilité
- `src/components/ConsultationScreen.jsx` — totalFatGrams, onSaveCustomFood
- `src/components/ClinicalResponse.jsx` — prédiction, badge étendu, affichage 3 phases
- `src/components/DayTimeline.jsx` — bilan journalier, computeDailySummary
- `src/components/ExtendedPlan.jsx` — nouveau composant plan 3 phases
- `src/App.jsx` — thumbnail photo, onSaveCustomFood, phases de notification
- `src/i18n/fr.js` — 30+ nouvelles clés
- `src/i18n/ar.js` — 30+ nouvelles clés (traduction arabe)

---

## v5.6.0

Version de base avant les améliorations IA.
