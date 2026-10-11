/** Traduit une alerte du moteur (code + params) ; retombe sur le message legacy. */
export function alertText(alert, t) {
  if (!alert) return '';
  if (alert.code) {
    const txt = t(alert.code, alert.params || {});
    if (txt && txt !== alert.code) return txt;
  }
  return alert.message || alert.type || '';
}
