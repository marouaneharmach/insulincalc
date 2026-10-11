# Matrice de non-régression v7.x

## Couverture obligatoire (automatisée)

| Exigence | Test |
|----------|------|
| Calcul dose standard, correction, IOB sur la correction seule, gras, activité | `src/domain/engine/__tests__/clinicalEngine.v7.test.ts`, `src/__tests__/spec-compliance.test.js` |
| Blocage < 0,70, demi-dose 0,70 à 0,90, sur-correction sur correction nette | idem + `src/utils/__tests__/clinicalEngine.test.js` |
| Mode nuit (blocage, réduction, collation, fenêtre configurable, désactivable) | `clinicalEngine.v7.test.ts` |
| Anti-empilement (plafond 1 U < 180 min, cumul 24 h, ratio IOB) | idem |
| Score de risque hypo et vitesse mesurée | idem |
| Plafond de dose → confirmation | idem + `ConsultationScreen.test.jsx` |
| Jeûne : suhoor réduit, rupture du jeûne | idem + `foundation.test.ts` |
| Fractionnement et plan étendu, redistribution après modification de dose | `extendedPlan.test.js`, `dosePlan.test.js`, `DayTimeline.test.jsx` |
| Journée en heure locale (saisie 00 h 30), identifiants chaîne | `foundation.test.ts`, `journalRepo.test.ts` |
| Journal sans plafond, synchronisation différentielle, import legacy unique | `journalRepo.test.ts` |
| Migration v4 → v7 idempotente, sauvegarde validée | `schemaMigrations.test.ts`, `DataExport.test.jsx` |
| Rappels persistés : échéance, déclenchement, manqués, acquittement, purge | `schemaMigrations.test.ts` |
| Métriques consensus, AGP, patterns, analyse de traitement | `foundation.test.ts`, `agp.test.ts`, `patterns.test.ts`, `treatmentAnalyzer.test.ts` |
| Import CSV LibreView / Dexcom / générique | `cgmCsv.test.ts`, `CgmImport.test.jsx` |
| Profils d'insuline et IOB | `insulin.test.ts` |
| Parité FR / AR des clés i18n | `i18n.test.js`, `v57-enhancements.test.js` |
| Détection de version distante, diagnostic | `updateManager.test.js`, `VersionPanel.test.jsx` |
| Parcours complet (onboarding → consultation → journal), hypo, rapports, arabe, persistance après rechargement | `e2e/app.spec.ts` |

## Portes de CI

`npm run lint` · `npm run typecheck` · `npm run test:regression` · `npm run test:coverage` (seuils domain/data) · `npm run build` · `npm run test:e2e`

## Vérifications manuelles avant release

- Onglet ouvert pendant un déploiement, PWA installée puis retour en ligne.
- Rappel de 2e injection après verrouillage du téléphone puis réouverture.
- Mode nuit entre 21 h et 6 h avec glycémie 1,6 puis 2,4 g/L.
- Import d'une sauvegarde v6 et d'un CSV LibreView réel.
- Lecture complète en arabe (RTL) et au zoom 200 %.
