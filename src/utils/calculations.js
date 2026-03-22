import { FAT_SCORE, DIGESTION_PROFILES } from '../data/constants.js';

export function round05(v) {
  return Math.round(v * 2) / 2;
}

export function calcWeightSuggestions(weightKg) {
  if (!weightKg || weightKg < 20 || weightKg > 200) return null;
  const tdd = Math.round(weightKg * 0.5);
  const icr = Math.round(500 / tdd);
  const isfMg = Math.round(1700 / tdd);
  const basal = round05(tdd * 0.5);
  const bolus = round05(tdd * 0.5);
  return { tdd, icr, isfMg, basal, bolus };
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
    steps.push({ timeMin: -preDelay, time: tl, units: u, label: "Bolus repas + correction", color: "#0ea5e9", icon: "\u{1F489}", note: `${totalCarbs}g glucides${correction > 0 ? " + correction glycémique" : ""}` });
  }
  if (bolusType === "dual") {
    const u1 = round05((bolusRepas + correction) * 0.6);
    const u2 = round05((bolusRepas + correction) * 0.4 + fatBonus);
    const tl = preDelay === 0 ? "Au début du repas" : `${preDelay} min avant le repas`;
    steps.push({ timeMin: -preDelay, time: tl, units: u1, label: "Bolus phase 1 \u2014 glucides rapides (60%)", color: "#0ea5e9", icon: "\u{1F489}", note: "Glucides rapides + correction" });
    steps.push({ timeMin: dp.fatDelay, time: dp.fatDelay === 0 ? "Pendant le repas" : `${dp.fatDelay} min après début du repas`, units: u2, label: "Bolus phase 2 \u2014 glucides lents + graisses (40%)", color: "#f59e0b", icon: "\u26A1", note: "Couvre l'absorption des graisses" });
  }

  const chk1 = dp.peakMin;
  const chk2 = bolusType === "dual" ? Math.round(dp.tail * 0.6) : null;
  const chk3 = dp.tail;

  steps.push({ timeMin: chk1, time: `${chk1} min après le repas`, units: null, label: "Contrôle glycémie \u2014 pic attendu", color: "#a78bfa", icon: "\u{1FA78}", note: `Pic attendu. Si > ${(targetG + 0.5).toFixed(1)} g/L \u2192 correction nécessaire` });
  if (chk2 && bolusType === "dual")
    steps.push({ timeMin: chk2, time: `${chk2} min après le repas`, units: null, label: "Contrôle glycémie \u2014 digestion graisses", color: "#f59e0b", icon: "\u{1FA78}", note: "Les graisses peuvent encore élever la glycémie" });
  steps.push({ timeMin: chk3, time: `${Math.round(chk3 / 60 * 10) / 10}h après le repas`, units: null, label: "Contrôle glycémie \u2014 fin d'action", color: "#4a6070", icon: "\u{1FA78}", note: `Insuline quasi-terminée. Cible : ${targetG.toFixed(1)} g/L` });
  steps.sort((a, b) => a.timeMin - b.timeMin);
  return steps;
}
