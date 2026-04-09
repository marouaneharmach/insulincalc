/**
 * Walsh model IOB decay curve for rapid-acting insulin (NovoRapid).
 *
 * Models insulin activity as a triangular curve peaking at `peak` minutes
 * and falling to zero at `dia` minutes. IOB(T) is the integral of remaining
 * activity from T to dia — computed in closed form for efficiency.
 *
 * @param {number} dose          - Units injected
 * @param {number} minutesElapsed - Minutes since injection
 * @param {number} dia           - Duration of insulin action in minutes (default 270 = 4h30)
 * @param {number} peak          - Peak activity time in minutes (default 75)
 * @returns {number} Remaining active insulin units
 */
export function calcIOB(dose, minutesElapsed, dia = 270, peak = 75) {
  if (dose <= 0) return 0;
  if (minutesElapsed <= 0) return dose;
  if (minutesElapsed >= dia) return 0;

  const T = minutesElapsed;

  // Piecewise closed-form integral of the triangular activity curve:
  //   Rising limb  (0 … peak): activity(t) = h·t/peak
  //   Falling limb (peak … dia): activity(t) = h·(dia−t)/(dia−peak)
  // where h = 2·dose/dia so the total area equals dose.
  let iobFraction;
  if (T <= peak) {
    // IOB = dose − integral(0→T) of rising limb = dose·(1 − T²/(peak·dia))
    iobFraction = 1 - (T * T) / (peak * dia);
  } else {
    // IOB = integral(T→dia) of falling limb = dose·(dia−T)²/(dia·(dia−peak))
    iobFraction = ((dia - T) * (dia - T)) / (dia * (dia - peak));
  }

  return dose * Math.max(0, Math.min(1, iobFraction));
}

/**
 * Calculate total IOB from multiple recent injections.
 * @param {Array<{dose: number, minutesAgo: number}>} injections
 * @param {number} dia - Duration of insulin action in minutes
 * @returns {number} Total active insulin units
 */
export function calcTotalIOB(injections, dia = 270) {
  return injections.reduce(
    (sum, inj) => sum + calcIOB(inj.dose, inj.minutesAgo, dia),
    0,
  );
}
