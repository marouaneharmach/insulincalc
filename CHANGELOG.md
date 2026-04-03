# Changelog

Toutes les modifications notables de InsulinCalc sont documentées ici.

## [6.0.0] - 2026-04-03

### Ajoutés

#### Moteur de sécurité clinique (`src/utils/clinicalEngine.js`)
- 9 règles de sécurité en cascade par priorité :
  1. **Anti-hypo** : blocage total si glycémie < 0.70 g/L
  2. **Hypo-proche** : réduction 50% + correction annulée si 0.70-0.90 g/L (retour anticipé)
  3. **IOB dynamique** : réduction proportionnelle de la correction si IOB > 50% de la dose
  4. **Mode nuit** (21h-05h) : blocage correction < 1.50 g/L, réduction 50% >= 1.50 g/L, alerte collation < 1.50 g/L
  5. **Cap injection récente** : correction plafonnée à 1 UI si dernière injection < 180 min
  6. **Cumul journalier** : alerte si corrections > 15% de la DTQ
  7. **Surdosage** : plafonnement de la dose au maximum configuré (pas seulement un avertissement)
- Validation des entrées : blocage si glycémie invalide (NaN, null, négative)
- Alertes prédictives : prévision glycémie à 1h et 2h basée sur vélocité + décroissance IOB

#### Vélocité glycémique (`src/utils/velocity.js`)
- Calcul du taux de variation en g/L/h
- Classification 5 niveaux : ↓↓ chute rapide, ↓ baisse, → stable, ↑ hausse, ↑↑ hausse rapide
- Ajustement de dose basé sur la tendance (facteurs multiplicatifs)
- Composant `VelocityIndicator.jsx` : badge coloré avec flèche directionnelle

#### Score de risque hypoglycémique (`src/utils/hypoRisk.js`)
- Algorithme 6 facteurs : glycémie actuelle, IOB résiduel, tendance, hypo récente (24h), activité physique, heure nocturne
- Classification : faible (0-2), modéré (3-5), élevé (6-8), critique (9+)
- Définition nocturne unifiée avec le moteur clinique (21h-05h)
- Composant `HypoRiskBadge.jsx` : badge avec code couleur et score

#### Détection de patterns (`src/utils/patternDetector.js`)
- 6 patterns cliniques détectés automatiquement :
  1. Phénomène de l'aube (hyperglycémie matinale récurrente)
  2. Rebond de Somogyi (hypo suivie d'hyperglycémie)
  3. Hypo matinale récurrente
  4. Sur-correction systématique
  5. Créneau horaire problématique
  6. Stacking récurrent
- Sévérité par pattern (info/warning/danger) avec compteur d'occurrences
- Composant `PatternAlerts.jsx` : cartes d'alerte colorées

#### Profils ICR/ISF variables (`src/utils/timeProfiles.js`)
- 5 périodes configurables : matin (6h-11h), midi (11h-14h), goûter (14h-17h), soir (17h-22h), nuit (22h-6h)
- Gestion du passage minuit pour la période nuit
- Toggle entre ratio unique et par période dans les réglages
- Panneau de configuration avec mise en évidence de la période active

#### Plan de dosage fractionné (`src/components/DosagePlan.jsx`)
- Support bolus dual : Phase 1 (60%) et Phase 2 (40%)
- Cases à cocher interactives avec horodatage de prise
- Dose éditable par phase (pas de 0.5 UI)
- Points de contrôle glycémique affichés comme jalons
- Plan persisté dans l'entrée du journal

#### Tableau de bord (`src/components/Dashboard.jsx`)
- Onglet "Accueil" comme vue par défaut
- Affichage IOB restant avec barre de décroissance visuelle
- Badge de risque hypo en temps réel
- Dernière glycémie + temps écoulé depuis la mesure
- 3 dernières entrées du journal en résumé
- Actions rapides (Nouveau repas, Correction seule)

#### Rapport médical PDF enrichi (`src/utils/exportPdf.js`)
- Rapport 5 pages pour revue médicale :
  - Page 1 : Résumé exécutif (TIR, HbA1c, CV%, hypos/hypers)
  - Page 2 : Profil glycémique par créneau horaire
  - Page 3 : Patterns et alertes détectés
  - Page 4 : Données insuline (DTQ, ratios par période)
  - Page 5 : Recommandations auto-générées
- Protection XSS via `escapeHtml()` sur toutes les données utilisateur

#### Indicateur mode nuit (`src/components/NightModeIndicator.jsx`)
- Badge lune ambrée dans le header entre 21h et 06h
- Effet de lueur subtil

#### Système de migration (`src/utils/migration.js`)
- Migrations versionnées et idempotentes pour les schémas localStorage
- V0→V1 : migration journal App.jsx vers format journalStore (avec déduplication par ID)
- V1→V2 : migration ratio/ISF unique vers profils par période
- Gestion du versioning via clé `insulincalc_v1_dataVersion`

#### i18n
- 82 nouvelles clés de traduction en français et arabe
- Couverture complète de toutes les fonctionnalités v6.0

### Corrigés

#### Système de journal unifié
- **Problème** : deux systèmes de journal incompatibles (clé `journal` dans App.jsx vs `insulincalc_v1_journal` dans journalStore)
- **Solution** : App.jsx utilise exclusivement journalStore ; migration automatique des anciennes entrées

#### Notifications
- **Problème** : `setTimeout` mourait à la fermeture de page, les rappels post-repas ne fonctionnaient jamais
- **Solution** : planification via `postMessage` au Service Worker + persistance localStorage pour récupération au rechargement
- Gestionnaire de clic sur notification (focus/ouverture de l'app)

#### Édition des repas dans le journal
- Recherche d'aliments inline avec ajout/suppression
- Multiplicateur de quantité éditable par aliment
- Recalcul automatique des glucides totaux

### Sécurité
- Protection XSS : `escapeHtml()` appliqué au nom du patient, noms d'aliments, messages de patterns dans les exports PDF
- Validation des entrées du moteur de sécurité : blocage sur glycémie invalide
- Plafonnement de dose obligatoire (pas seulement avertissement) en cas de surdosage

### Qualité
- **389 tests** répartis sur 22 fichiers de tests
- Tests d'intégration couvrant 5 flux critiques (sécurité, vélocité, patterns, profils, IOB)
- Build de production : 434 KB
- Constante `INSULIN_DURATION_MIN` centralisée (plus de valeurs 240 dispersées)

### Architecture

#### Nouveaux fichiers
| Fichier | Rôle |
|---------|------|
| `src/utils/clinicalEngine.js` | Moteur de sécurité clinique (9 règles + prédictions) |
| `src/utils/velocity.js` | Calcul et classification de la vélocité glycémique |
| `src/utils/hypoRisk.js` | Score de risque hypoglycémique 6 facteurs |
| `src/utils/patternDetector.js` | Détection de 6 patterns cliniques |
| `src/utils/timeProfiles.js` | Profils ICR/ISF par période |
| `src/utils/migration.js` | Migrations de schéma localStorage |
| `src/components/Dashboard.jsx` | Onglet tableau de bord |
| `src/components/DosagePlan.jsx` | Plan de dosage fractionné |
| `src/components/NightModeIndicator.jsx` | Indicateur mode nuit |
| `src/components/VelocityIndicator.jsx` | Badge vélocité |
| `src/components/HypoRiskBadge.jsx` | Badge risque hypo |
| `src/components/PatternAlerts.jsx` | Cartes d'alertes patterns |

#### Fichiers modifiés
| Fichier | Modifications |
|---------|--------------|
| `src/App.jsx` | Pipeline sécurité, IOB, vélocité, profils variables, migration au démarrage |
| `src/components/ResultCard.jsx` | Intégration DosagePlan |
| `src/components/JournalTab.jsx` | PatternAlerts, VelocityIndicator, HypoRiskBadge, export PDF médecin |
| `src/components/JournalEntryForm.jsx` | Édition aliments, champs contexte (stress, sommeil, activité) |
| `src/components/ReglagesPanel.jsx` | Toggle ratio unique/par période, tableau 5 périodes |
| `src/components/TabNav.jsx` | Onglet Accueil ajouté |
| `src/utils/exportPdf.js` | Rapport médical 5 pages + escapeHtml |
| `src/utils/notifications.js` | Persistance + messagerie SW |
| `src/utils/calculations.js` | Constante INSULIN_DURATION_MIN |
| `sw.js` | Handlers message + notificationclick |
| `src/i18n/fr.js` | 82 nouvelles clés |
| `src/i18n/ar.js` | 82 nouvelles clés |
