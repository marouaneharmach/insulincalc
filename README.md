# InsulinCalc - Calculateur d'insuline pour diabète de type 1

Une application web progressive (PWA) pour calculer les doses d'insuline en fonction des aliments marocains et du profil glycémique du patient.

## Déploiement sur GitHub Pages

### Prérequis
- Compte GitHub avec un repository
- Git installé localement

### Étapes de déploiement

1. **Créer un repository GitHub**
   - Allez sur https://github.com/new
   - Nommez le repository `insulincalc` (ou le nom de votre choix)
   - Créez le repository

2. **Cloner le repository localement**
   ```bash
   git clone https://github.com/votre-username/insulincalc.git
   cd insulincalc
   ```

3. **Copier les fichiers du projet**
   - Copiez tous les fichiers du dossier `/mnt/calc-glycemie/` dans votre repository local :
     - `index.html`
     - `manifest.json`
     - `sw.js`
     - `icon.svg`

4. **Commiter et pusher**
   ```bash
   git add .
   git commit -m "Initial commit: InsulinCalc PWA app"
   git push origin main
   ```

5. **Activer GitHub Pages**
   - Allez dans les paramètres du repository (Settings > Pages)
   - Sélectionnez `main` comme branche source
   - Définissez le dossier racine comme `/` (root)
   - Sauvegardez

6. **Accéder à l'application**
   - L'application sera accessible à : `https://votre-username.github.io/insulincalc/`
   - Attendez quelques minutes que GitHub Pages génère le site

### Déploiement alternatif (Netlify)

1. **Créer un compte Netlify** : https://netlify.com
2. **Connecter votre repository GitHub** ou draggez-déposez le dossier
3. **Définir la branche de déploiement** : `main`
4. **L'application sera en ligne immédiatement**

## Architecture du projet

### Fichiers principaux

- **index.html** (79 KB)
  - Application React complète sans build step
  - Inclut tous les composants et la logique
  - CDN React, ReactDOM et Babel Standalone
  - Service worker registration

- **manifest.json** (2.4 KB)
  - Configuration PWA
  - Icônes en SVG data URI
  - Métadonnées d'installation

- **sw.js** (2.7 KB)
  - Service Worker pour offline-first
  - Cache des ressources critiques
  - Stratégies: network-first pour HTML, cache-first pour assets

- **icon.svg** (1.8 KB)
  - Icône de l'application avec thème syringe/insuline
  - Couleurs alignées avec le design (#0ea5e9 sur #07090f)

## Caractéristiques PWA

### Installation
- Installez sur Android via "Ajouter à l'écran d'accueil"
- Installez sur iOS via le bouton Partager > Ajouter à l'écran d'accueil
- Accès standalone sans barre d'adresse

### Offline First
- Fonctionne complètement offline après première visite
- Cache des ressources CDN
- Synchronisation automatique au retour en ligne

### Responsive Design
- Optimisée pour mobile (viewport meta)
- Desktop et tablet supportés
- Couleurs adaptées au thème dark (#07090f)

## Fonctionnalités principales

### 1. Sélection d'aliments (Repas)
- Catégories marocaines (tajines, pains, légumes, fruits, etc.)
- Index glycémique (IG) et graisses par aliment
- Multiplicateurs de quantité personnalisés
- Recherche par nom ou note

### 2. Saisie des paramètres (Saisie)
- Glycémie actuelle (g/L)
- Poids corporel (kg) avec suggestions basées sur formules
- Zones glycémiques interactives
- Calcul des paramètres insuline (TDD, ratio, ISF)

### 3. Calcul de dose (Résultat)
- Bolus standard ou dual-wave selon les graisses
- Correction de glycémie
- Bonus de graisses
- Calendrier d'injections avec timeline

### 4. Correction post-repas
- IOB (Insuline On Board) calculé
- Correction adaptée aux seuils de glycémie
- Alertes d'hypoglycémie et hyperglycémie sévère

### 5. Paramètres avancés (Params)
- Ratio insuline/glucides (ICR) 1 U / Xg
- Facteur de sensibilité (ISF) en mg/dL
- Glycémie cible (1.0-1.8 g/L)
- Vitesse de digestion (rapide/normal/lent)

## Calculs utilisés

### Bolus de repas
```
Bolus = (Glucides totaux) / (Ratio ICR)
```

### Correction de glycémie
```
Correction = (Glycémie - Cible) × 10 / (ISF)
```

### Bonus de graisses
```
Bonus = (Bolus repas) × (Facteur graisses)
```

### IOB (Insuline On Board)
```
IOB = (Insuline injectée) × (1 - minElapsed / tailDuration)
```

## Notes de sécurité

- **Discréditive** : L'application est à titre informatif uniquement
- **Consultez votre médecin** : Tous les calculs doivent être validés avec l'endocrinologue
- **Pas de données stockées** : Aucune donnée n'est envoyée à un serveur
- **Offline-safe** : Fonctionne complètement en local

## Licence

Open source - libre d'utilisation et de modification pour usage personnel ou médical.

## Support

Pour tout problème ou suggestion, consultez la documentation du code ou créez une issue sur le repository GitHub.
