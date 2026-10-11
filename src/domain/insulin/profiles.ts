/**
 * Profils d'action des insulines. DIA (durée d'action) et pic en minutes.
 * Valeurs issues des notices produit et des réglages usuels des pompes ;
 * à ajuster avec l'équipe soignante.
 */
export type InsulinKind = 'rapid' | 'ultra-rapid' | 'regular' | 'basal';

export interface InsulinProfile {
  id: string;
  name: string;
  kind: InsulinKind;
  diaMin: number;
  peakMin: number;
  aliases: string[];
}

export const RAPID_PROFILE_IDS = ['novorapid', 'humalog', 'apidra', 'fiasp', 'lyumjev', 'actrapid', 'generic-rapid'] as const;

export const INSULIN_PROFILES: InsulinProfile[] = [
  { id: 'novorapid', name: 'NovoRapid (aspart)', kind: 'rapid', diaMin: 270, peakMin: 75, aliases: ['novorapid', 'novolog', 'aspart', 'insulin aspart'] },
  { id: 'humalog', name: 'Humalog (lispro)', kind: 'rapid', diaMin: 270, peakMin: 75, aliases: ['humalog', 'lispro', 'admelog'] },
  { id: 'apidra', name: 'Apidra (glulisine)', kind: 'rapid', diaMin: 240, peakMin: 70, aliases: ['apidra', 'glulisine'] },
  { id: 'fiasp', name: 'Fiasp (aspart ultra-rapide)', kind: 'ultra-rapid', diaMin: 240, peakMin: 55, aliases: ['fiasp'] },
  { id: 'lyumjev', name: 'Lyumjev (lispro ultra-rapide)', kind: 'ultra-rapid', diaMin: 240, peakMin: 55, aliases: ['lyumjev'] },
  { id: 'actrapid', name: 'Actrapid / Humuline R (humaine)', kind: 'regular', diaMin: 360, peakMin: 150, aliases: ['actrapid', 'humuline r', 'humulin r', 'insuman rapid', 'regular'] },
  { id: 'generic-rapid', name: 'Analogue rapide (générique)', kind: 'rapid', diaMin: 270, peakMin: 75, aliases: [] },
  { id: 'lantus', name: 'Lantus (glargine U100)', kind: 'basal', diaMin: 1440, peakMin: 0, aliases: ['lantus', 'glargine', 'abasaglar', 'basaglar'] },
  { id: 'toujeo', name: 'Toujeo (glargine U300)', kind: 'basal', diaMin: 1800, peakMin: 0, aliases: ['toujeo'] },
  { id: 'tresiba', name: 'Tresiba (degludec)', kind: 'basal', diaMin: 2520, peakMin: 0, aliases: ['tresiba', 'degludec'] },
  { id: 'levemir', name: 'Levemir (detemir)', kind: 'basal', diaMin: 1200, peakMin: 0, aliases: ['levemir', 'detemir'] },
];

export const DEFAULT_RAPID_PROFILE = INSULIN_PROFILES[0] as InsulinProfile;

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function getProfileById(id: string | null | undefined): InsulinProfile | null {
  if (!id) return null;
  return INSULIN_PROFILES.find((p) => p.id === id) ?? null;
}

/** Retrouve un profil depuis un identifiant ou un nom saisi librement (« NovoRapid », « Humalog »...). */
export function resolveInsulinProfile(idOrName: string | null | undefined): InsulinProfile | null {
  if (!idOrName) return null;
  const byId = getProfileById(idOrName);
  if (byId) return byId;
  const n = normalize(idOrName);
  if (!n) return null;
  return INSULIN_PROFILES.find((p) => p.aliases.some((a) => n.includes(normalize(a)))) ?? null;
}

/**
 * Profil rapide effectif : profil explicite, sinon déduit du nom, sinon générique.
 * `diaHoursOverride` (réglage patient) remplace la DIA du profil si fourni.
 */
export function effectiveRapidProfile(
  profileId: string | null | undefined,
  insulinName: string | null | undefined,
  diaHoursOverride?: number | null,
): InsulinProfile {
  const base = getProfileById(profileId) ?? resolveInsulinProfile(insulinName) ?? DEFAULT_RAPID_PROFILE;
  const rapid = base.kind === 'basal' ? DEFAULT_RAPID_PROFILE : base;
  if (diaHoursOverride && diaHoursOverride > 0) {
    const diaMin = Math.round(diaHoursOverride * 60);
    // conserve la position relative du pic (ex. 75/270) quand la DIA est modifiée
    const peakMin = Math.round(Math.min(diaMin * 0.6, (rapid.peakMin / rapid.diaMin) * diaMin));
    return { ...rapid, diaMin, peakMin: Math.max(20, peakMin) };
  }
  return rapid;
}
