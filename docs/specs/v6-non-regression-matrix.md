# Matrice de non-régression v6.x

## Couverture minimale obligatoire

- Calcul dose standard sans alerte
- Dose élevée confirmée par l’utilisateur
- Repas riche glucides/lipides avec fractionné ou étendu
- Persistance `doseReelle` après reload
- Migration des anciennes entrées `doseCalculated` / `doseInjected`
- Détection d’une version distante plus récente
- Affichage cohérent version/build/cache/service worker
- Activation de la mise à jour forcée depuis le diagnostic

## Portes de CI

- `npm run lint`
- `npm run test:regression`
- `npm test`
- `npm run build`

## Vérifications manuelles recommandées avant release

- Onglet déjà ouvert au moment d’un nouveau déploiement
- PWA installée puis retour en ligne
- Cache assets ancien avec HTML neuf
- Ancien service worker encore actif avant refresh forcé
