/**
 * Identifiants triables par le temps (préfixe horodaté base36 + séquence + aléa).
 * Toujours des chaînes : ne jamais comparer des identifiants numériquement.
 */
let lastTime = 0;
let seq = 0;

function randomPart(): string {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(4);
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(16).slice(2, 10).padEnd(8, '0');
}

export function newId(prefix = ''): string {
  const now = Date.now();
  if (now === lastTime) seq += 1;
  else {
    lastTime = now;
    seq = 0;
  }
  return `${prefix}${now.toString(36)}${seq.toString(36).padStart(2, '0')}${randomPart()}`;
}
