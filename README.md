# InsulinCalc v7

Application web progressive (PWA) d'aide au calcul des doses d'insuline rapide et de suivi glycémique pour le diabète de type 1, pensée pour l'alimentation marocaine, bilingue français / arabe. **Outil personnel d'aide à la décision : il ne remplace ni un dispositif médical certifié ni l'avis de l'équipe soignante.**

## Fonctionnalités

- **Calcul de dose** : bolus repas (ratio), correction (ISF en mg/dL), bonus lipides, activité, profils horaires, fractionnement (repas gras, plan étendu 3 phases sur 4 h).
- **Garde-fous cliniques** : blocage sous 0,70 g/L, demi-dose 0,70 à 0,90, mode nuit (correction bloquée sous le seuil, réduite de moitié au-dessus), anti-empilement (plafond de correction après injection récente, cumul 24 h, IOB), score de risque hypoglycémique à six facteurs, vitesse glycémique mesurée, plafond de dose avec confirmation, jours de maladie, jeûne du Ramadan (IDF-DAR 2021).
- **Insuline active (IOB)** selon le profil du produit (NovoRapid, Humalog, Apidra, Fiasp, Lyumjev, humaine) avec DIA ajustable.
- **Journal** illimité sur IndexedDB : repas, corrections, basale, hypoglycémies traitées, mesures, lectures capteur ; journées en heure locale ; glycémie post-repas et verdict ; modification des doses ; sauvegarde complète et restauration validées.
- **Rapports** : temps en cible selon le consensus international (0,70 à 1,80 g/L), TBR/TAR par niveau, moyenne, variabilité (CV), GMI, profil glycémique ambulatoire (AGP), tendances détectées (aube, hypo matinale, Somogyi, créneaux problématiques, empilement), pistes d'ajustement ratio / ISF / basale à discuter avec le médecin, export CSV et impression.
- **Import CSV** des capteurs LibreView et Dexcom Clarity.
- **Rappels persistés** (2e injection, phases, contrôle post-repas, recontrôle hypo, basale quotidienne) affichés même après fermeture de l'application.
- **Reconnaissance photo** des repas via un fournisseur OpenAI-compatible (OpenRouter par défaut, Groq en alternative, modèle Llama 4 Scout). La clé vient de l'environnement de build (secret GitHub Actions) ou, à défaut, d'une saisie dans Réglages stockée uniquement sur l'appareil.
- **Accessibilité** : zoom autorisé, textes ≥ 12 px, contrastes AA, étiquettes et rôles ARIA, thème clair / sombre / système, arabe avec RTL.

## Architecture

```
src/
  domain/      moteur clinique et analyses en TypeScript strict (fonctions pures, codes i18n, aucune dépendance React)
    engine/    calculateDose, applySafetyRules, determineSplit, analyzeAndRecommend, hypoRisk, velocity, prediction, dosePlan
    insulin/   profils d'action, IOB (modèle de Walsh)
    analytics/ métriques consensus, AGP, journée, patterns, analyse de traitement (F8)
    import/    CSV capteurs (LibreView, Dexcom, générique)
    ramadan.ts, time.ts (heure locale), units.ts, journal.ts (accesseurs), ids.ts, validation.js
  data/        schémas zod, migrations idempotentes v4 → v5 → v7, dépôt Dexie (IndexedDB), rappels persistés
  app/         service de rappels (service worker / Notification / in-app)
  hooks/       useJournal (IndexedDB), useLocalStorage, useTheme (système), useNow, useAppVersioning
  components/  écrans React (JSX) : Consultation, Journal, Rapports, Réglages, Onboarding, primitives ui/
  i18n/        dictionnaires fr.js / ar.js (clés identiques aux codes du moteur)
e2e/           scénarios Playwright
docs/          audits, changelogs, spécifications, matrice de non-régression
```

Conventions : glycémies en g/L dans le domaine (1,20 g/L = 120 mg/dL), ISF en mg/dL par unité, ratio en g de glucides par unité, dates ISO avec décalage local, identifiants chaîne.

## Développement

```bash
npm ci
npm run dev            # serveur de développement
npm run lint           # ESLint (JS/JSX + TypeScript)
npm run typecheck      # tsc --noEmit
npm test               # vitest (unitaires + composants)
npm run test:coverage  # couverture (seuil 85 % sur domain/ et data/)
npm run test:e2e       # Playwright (construit puis sert l'application)
npm run build          # build de production dans build/
```

Node 22 recommandé. Le fichier `.npmrc` active `legacy-peer-deps`.

## Déploiement

- `ci.yml` : lint, typage, régression, tests avec couverture, build et E2E sur chaque pull request et branche.
- `deploy.yml` : mêmes contrôles puis publication sur GitHub Pages à chaque push sur `main`.
- Le service worker, `version.json` et le manifeste sont générés au build ; la mise à jour peut être forcée depuis Réglages → Diagnostic.

### Clé d'IA fournie par l'environnement (reconnaissance photo)

La clé n'est jamais écrite dans le dépôt : elle est lue au build depuis les secrets et variables du dépôt GitHub (Settings → Secrets and variables → Actions) et injectée par `deploy.yml` dans les variables `VITE_*` lues par `src/app/aiConfig.ts`.

| Nom GitHub | Type | Variable de build | Rôle |
|---|---|---|---|
| `OPENROUTER_API_KEY` | secret | `VITE_OPENROUTER_API_KEY` | Clé OpenRouter (préfixe `sk-or-`) |
| `OPENROUTER_MODEL` | variable, optionnel | `VITE_OPENROUTER_MODEL` | Modèle vision OpenRouter (défaut `meta-llama/llama-4-scout`) |
| `GROQ_API_KEY` | secret, optionnel | `VITE_GROQ_API_KEY` | Clé Groq (préfixe `gsk_`), alternative |
| `AI_PROVIDER` | variable, optionnel | `VITE_AI_PROVIDER` | `openrouter` ou `groq` quand les deux clés existent |

Ordre de priorité à l'exécution : clé saisie dans Réglages (appareil) > clé de l'environnement de build > aucune (la reconnaissance photo est alors désactivée et Réglages l'indique). En développement local, copiez `.env.example` en `.env.local` (ignoré par git).

**Vérifier la reconnaissance photo avec la vraie clé** : Actions → « AI smoke (reconnaissance photo réelle) » → Run workflow. Le workflow `ai-smoke.yml` construit l'application avec les secrets du dépôt, charge une photo de test (`e2e/fixtures/pizza.jpg`) dans l'interface et vérifie que le fournisseur renvoie bien une pizza (une requête vision facturée). Le même parcours tourne dans la CI normale avec un fournisseur simulé (`e2e/ai-photo.spec.ts`).

**Avertissement** : toute variable `VITE_*` est incluse dans le bundle publié, donc lisible par quiconque ouvre le site. Usage personnel assumé : fixez un plafond de dépense chez le fournisseur, limitez la clé au modèle utilisé et régénérez-la si elle a transité par un canal non sûr. Pour un site partagé, passez par un proxy côté serveur.

## Données et confidentialité

Toutes les données restent sur l'appareil (IndexedDB et localStorage). Aucune donnée n'est envoyée à un serveur, à l'exception des photos de repas transmises au fournisseur d'IA configuré (OpenRouter ou Groq) lorsqu'une clé est disponible. Une clé saisie dans Réglages reste sur l'appareil et n'est jamais incluse dans les sauvegardes ; une clé fournie par l'environnement de build est, elle, présente dans le bundle publié (voir l'avertissement ci-dessus).

## Références cliniques

Consensus international Time in Range (Battelino 2019), ADA Standards of Care 2025, ISPAD 2022, IDF-DAR 2021, GMI (Bergenstal 2018), modèle d'IOB de Walsh. Voir `docs/audit/2026-10-11-analyse-strategique-v7.md` pour l'analyse complète et la feuille de route.

## Licence

Open source, usage personnel ou médical sous votre responsabilité.
