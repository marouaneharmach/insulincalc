# UX : Suggestion vs Saisie libre — Analyse pratique

## La question

Quand une application calcule une valeur pour l'utilisateur (ex. : dose d'insuline recommandée), doit-elle **imposer cette valeur** ou laisser l'utilisateur **saisir librement** ?

---

## Deux patterns analysés

### Pattern 1 : Suggestion pure (champ en lecture seule)
Le résultat est affiché mais non modifiable. L'utilisateur ne peut qu'accepter ou annuler.

**Avantages :** Simple, sans ambiguïté, réduit les erreurs de saisie.
**Inconvénients :** Paternaliste, ne reflète pas la réalité (l'utilisateur peut injecter une dose différente), bloque la capture de la dose réelle.

### Pattern 2 : Saisie libre (champ vide)
L'utilisateur tape lui-même la dose, sans suggestion initiale.

**Avantages :** Pleine autonomie, capture fidèle de la décision réelle.
**Inconvénients :** Charge cognitive élevée (le calcul vient d'être fait, pourquoi le retaper ?), risque d'erreur de saisie.

---

## Pattern retenu : "Saisie éclairée" (Informed Input)

**Principe :** Pré-remplir le champ avec la valeur calculée, tout en laissant l'utilisateur la modifier.

- La suggestion est visible et immédiatement utilisable (un seul tap pour confirmer).
- L'utilisateur peut corriger si son jugement clinique diffère (glycémie qui monte, repas plus copieux que prévu, etc.).
- La valeur finale saisie est celle réellement injectée — et non une estimation.

**Pourquoi ce choix ?**
- Réduit la charge cognitive : pas besoin de mémoriser le résultat pour le retaper.
- Préserve l'autonomie : le patient reste décisionnaire.
- Capture la dose réelle : indispensable pour un journal de bord fiable.

---

## Application dans InsulinCalc

### Écran principal — champ dose réelle
Le champ "Dose injectée" est pré-rempli avec la dose calculée par l'algorithme. L'utilisateur peut :
- Confirmer d'un tap (valeur inchangée).
- Modifier la valeur avant confirmation (ex. : arrondir à 4u au lieu de 3,7u).

### Journal de glycémie
Chaque entrée stocke les deux valeurs :
- `doseSuggeree` : sortie de l'algorithme.
- `doseReelle` : valeur confirmée/modifiée par l'utilisateur.

Cet écart peut être analysé ultérieurement pour affiner les ratios ou détecter des comportements récurrents (sous-dosage systématique le soir, par exemple).

---

*Rédigé le 2026-03-28 — InsulinCalc v5.5.x*
