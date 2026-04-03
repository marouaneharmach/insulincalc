import { FAT_SCORE, DIGESTION_PROFILES, AGE_PROFILES, getAgeGroup } from '../data/constants.js';

/** Standard rapid-acting insulin action duration (minutes). */
export const INSULIN_DURATION_MIN = 240;

// ─── HbA1c ESTIMÉE ───────────────────────────────────────────────────────────

export function estimateHbA1c(entries) {
  const vals = [];
  entries.forEach(e => {
    if (e.preMealGlycemia != null && !isNaN(e.preMealGlycemia)) vals.push(e.preMealGlycemia);
    if (e.postMealGlycemia != null && !isNaN(e.postMealGlycemia)) vals.push(e.postMealGlycemia);
  });
  if (vals.length < 30) return null;
  const avgGL = vals.reduce((s, v) => s + v, 0) / vals.length;
  const avgMgDL = avgGL * 100;
  const hba1c = (avgMgDL + 46.7) / 28.7;
  return Math.round(hba1c * 10) / 10;
}

// ─── DÉTECTION DE PATTERNS ───────────────────────────────────────────────────

export function detectPatterns(entries) {
  const patterns = [];
  if (!entries || entries.length < 5) return patterns;

  const hypoByHour = {};
  entries.forEach(e => {
    if (e.preMealGlycemia != null && e.preMealGlycemia < 0.7) {
      const h = new Date(e.date).getHours();
      const slot = h < 10 ? "matin" : h < 14 ? "midi" : h < 18 ? "après-midi" : "soir";
      hypoByHour[slot] = (hypoByHour[slot] || 0) + 1;
    }
  });
  Object.entries(hypoByHour).forEach(([slot, count]) => {
    if (count >= 3) {
      patterns.push({
        type: "hypo_recurrent", severity: "warning", icon: "⚠️",
        message: `${count} hypos récurrentes le ${slot} — envisagez de réduire la dose basale ou le ratio pour ce créneau.`,
      });
    }
  });

  const fastingEntries = entries.filter(e => e.mealType === "petit-déjeuner" && e.preMealGlycemia != null);
  if (fastingEntries.length >= 5) {
    const highFasting = fastingEntries.filter(e => e.preMealGlycemia > 1.5);
    const pct = (highFasting.length / fastingEntries.length) * 100;
    if (pct >= 60) {
      patterns.push({
        type: "high_fasting", severity: "info", icon: "🌅",
        message: `${Math.round(pct)}% des glycémies à jeun > 1.5 g/L — possible effet de l'aube. Discutez un ajustement de basale nocturne avec votre médecin.`,
      });
    }
  }

  const mealTypes = ["petit-déjeuner", "déjeuner", "dîner", "collation"];
  mealTypes.forEach(mt => {
    const mealEntries = entries.filter(e => e.mealType === mt && e.postMealGlycemia != null);
    if (mealEntries.length >= 3) {
      const highPost = mealEntries.filter(e => e.postMealGlycemia > 2.0);
      const pct = (highPost.length / mealEntries.length) * 100;
      if (pct >= 60) {
        patterns.push({
          type: "high_postmeal", severity: "info", icon: "📈",
          message: `${Math.round(pct)}% des glycémies post-${mt} > 2.0 g/L — envisagez d'augmenter le ratio ou d'allonger le délai d'injection pour ce repas.`,
        });
      }
    }
  });

  const withDoses = entries.filter(e => e.doseCalculated > 0 && e.doseInjected > 0);
  if (withDoses.length >= 5) {
    const underDosed = withDoses.filter(e => e.doseInjected < e.doseCalculated * 0.8);
    if (underDosed.length >= 3) {
      patterns.push({
        type: "underdosing", severity: "info", icon: "💉",
        message: `Vous injectez souvent moins que la dose calculée (${underDosed.length}/${withDoses.length} repas). Vérifiez vos paramètres ou consultez votre équipe soignante.`,
      });
    }
  }

  return patterns;
}

export function round05(v) {
  return Math.round(v * 2) / 2;
}

// ─── IMC / BSA / BMR (Fix #10) ─────────────────────────────────────────────

export function calcIMC(weightKg, heightCm) {
  if (!weightKg || !heightCm || heightCm < 50) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function calcBSA(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  // Formule DuBois
  return Math.round(0.007184 * Math.pow(weightKg, 0.425) * Math.pow(heightCm, 0.725) * 100) / 100;
}

export function calcBMR(weightKg, heightCm, age, sex) {
  if (!weightKg || !heightCm || !age) return null;
  // Mifflin-St Jeor
  if (sex === "F") {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
}

export function imcCategory(imc) {
  if (!imc) return "";
  if (imc < 18.5) return "Insuffisance pondérale";
  if (imc < 25) return "Poids normal";
  if (imc < 30) return "Surpoids";
  if (imc < 35) return "Obésité modérée";
  if (imc < 40) return "Obésité sévère";
  return "Obésité morbide";
}

// ─── WEIGHT SUGGESTIONS (updated with age/sex - Fix #11) ────────────────────

export function calcWeightSuggestions(weightKg, age, sex) {
  if (!weightKg || weightKg < 20 || weightKg > 200) return null;

  const ageGroup = getAgeGroup(age);
  const profile = AGE_PROFILES[ageGroup];

  // TDD based on age group midpoint
  const tddPerKg = (profile.tddRange[0] + profile.tddRange[1]) / 2;
  let tdd = Math.round(weightKg * tddPerKg);

  // Sex adjustment: women ~10-15% more sensitive
  if (sex === "F") {
    tdd = Math.round(tdd * 0.88);
  }

  const icr = Math.round(profile.icrRule / tdd);
  const isfMg = Math.round(profile.isfRule / tdd);
  const basal = round05(tdd * 0.5);
  const bolus = round05(tdd * 0.5);

  return { tdd, icr, isfMg, basal, bolus, ageGroup, ageLabel: profile.label };
}

export function calcIOB(initialDose, minutesElapsed, durationMin) {
  if (minutesElapsed <= 0) return round05(initialDose);
  if (minutesElapsed >= durationMin) return 0;
  const t = minutesElapsed / durationMin;
  const iobFraction = Math.pow(1 - t, 1.5);
  return round05(initialDose * iobFraction);
}

export function calcPostMealCorrection(currentG, targetG, isf, iob) {
  const ecartGL = currentG - targetG;
  const ecartMg = ecartGL * 100;
  if (ecartGL <= 0) return { units: 0, status: "ok_low", iob };
  const rawUnits = ecartMg / isf;
  const netUnits = Math.max(0, rawUnits - iob);
  const units = round05(netUnits);
  let status = "correction";
  if (currentG >= 3.0 && units === 0) status = "urgent_override";
  else if (currentG >= 2.5 && units === 0) status = "high_override";
  else if (currentG >= 2.0 && units === 0) status = "warn_override";
  let finalUnits = units;
  if (status === "urgent_override") finalUnits = round05(Math.max(rawUnits * 0.5, 0.5));
  else if (status === "high_override") finalUnits = round05(Math.max(rawUnits * 0.4, 0.5));
  else if (status === "warn_override") finalUnits = round05(Math.max(rawUnits * 0.3, 0.5));
  return { units: finalUnits, status, rawUnits: round05(rawUnits), iob, ecartGL: round05(ecartGL) };
}

export function getOverallFat(sel) {
  if (!sel.length) return "faible";
  const tq = sel.reduce((a, s) => a + s.mult, 0);
  const ts = sel.reduce((a, s) => a + FAT_SCORE[s.food.fat] * s.mult, 0);
  const avg = ts / tq;
  if (avg < 1.2) return "faible";
  if (avg < 2.2) return "moyen";
  return "élevé";
}

export function getDominantGI(sel) {
  if (!sel.length) return "moyen";
  const c = { faible: 0, moyen: 0, "élevé": 0 };
  sel.forEach(s => { c[s.food.gi] += s.food.carbs * s.mult; });
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}

export function buildSchedule(totalCarbs, bolusRepas, correction, fatBonus, gVal, targetG, digestionKey, bolusType, dominantGI) {
  const dp = DIGESTION_PROFILES[digestionKey];
  const steps = [];
  let preDelay = dominantGI === "élevé" ? 10 : dominantGI === "moyen" ? 15 : 20;
  if (gVal < 0.8) preDelay = 0;
  else if (gVal < 1.0) preDelay = 0;
  if (gVal > 2.0) preDelay += 5;
  if (gVal > 2.5) preDelay += 5;
  preDelay = Math.min(preDelay, 25);

  if (bolusType === "standard") {
    const u = round05(bolusRepas + correction);
    const tl = preDelay === 0 ? "Au début du repas" : `${preDelay} min avant le repas`;
    steps.push({ timeMin: -preDelay, time: tl, units: u, label: "Bolus repas + correction", color: "#0ea5e9", icon: "💉", note: `${totalCarbs}g glucides${correction > 0 ? " + correction glycémique" : ""}` });
  }
  if (bolusType === "dual") {
    const u1 = round05((bolusRepas + correction) * 0.6);
    const u2 = round05((bolusRepas + correction) * 0.4 + fatBonus);
    const tl = preDelay === 0 ? "Au début du repas" : `${preDelay} min avant le repas`;
    steps.push({ timeMin: -preDelay, time: tl, units: u1, label: "Phase 1 — glucides rapides (60%)", color: "#0ea5e9", icon: "💉", note: "Glucides rapides + correction" });
    steps.push({ timeMin: dp.fatDelay, time: dp.fatDelay === 0 ? "Pendant le repas" : `${dp.fatDelay} min après début du repas`, units: u2, label: "Phase 2 — graisses (40%)", color: "#f59e0b", icon: "⚡", note: "Couvre l'absorption des graisses" });
  }

  const chk1 = dp.peakMin;
  const chk2 = bolusType === "dual" ? Math.round(dp.tail * 0.6) : null;
  const chk3 = dp.tail;

  steps.push({ timeMin: chk1, time: `${chk1} min après le repas`, units: null, label: "Contrôle — pic attendu", color: "#a78bfa", icon: "🩸", note: `Cible < ${(targetG + 0.5).toFixed(1)} g/L` });
  if (chk2 && bolusType === "dual")
    steps.push({ timeMin: chk2, time: `${chk2} min après le repas`, units: null, label: "Contrôle — digestion graisses", color: "#f59e0b", icon: "🩸", note: "Graisses peuvent encore élever la glycémie" });
  steps.push({ timeMin: chk3, time: `${Math.round(chk3 / 60 * 10) / 10}h après le repas`, units: null, label: "Contrôle — fin d'action", color: "#4a6070", icon: "🩸", note: `Cible : ${targetG.toFixed(1)} g/L` });
  steps.sort((a, b) => a.timeMin - b.timeMin);
  return steps;
}
