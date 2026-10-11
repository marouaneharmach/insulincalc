/**
 * Configuration des fournisseurs d'IA (reconnaissance photo, futures fonctions).
 * Priorité : clé saisie dans Réglages (appareil) > clé fournie par l'environnement de build
 * (secrets GitHub Actions → VITE_*) > aucune.
 *
 * Attention : toute variable VITE_* finit dans le bundle publié. Pour un site public,
 * limitez la clé (plafond de dépense, modèle restreint) ou passez par un proxy.
 */
export type AiProvider = 'openrouter' | 'groq';
export type AiKeySource = 'settings' | 'environment' | 'none';

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  url: string;
  source: AiKeySource;
}

export const AI_PROVIDERS: Record<AiProvider, { url: string; defaultModel: string; label: string; keyPrefix: string }> = {
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'meta-llama/llama-4-scout',
    label: 'OpenRouter',
    keyPrefix: 'sk-or-',
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    label: 'Groq',
    keyPrefix: 'gsk_',
  },
};

export interface AiEnv {
  VITE_AI_PROVIDER?: string;
  VITE_OPENROUTER_API_KEY?: string;
  VITE_OPENROUTER_MODEL?: string;
  VITE_GROQ_API_KEY?: string;
  VITE_GROQ_MODEL?: string;
}

function readEnv(): AiEnv {
  try {
    return import.meta.env as unknown as AiEnv;
  } catch {
    return {};
  }
}

/** Déduit le fournisseur du préfixe de la clé. */
export function detectProvider(key: string | null | undefined): AiProvider | null {
  const k = (key ?? '').trim();
  if (k.startsWith(AI_PROVIDERS.openrouter.keyPrefix)) return 'openrouter';
  if (k.startsWith(AI_PROVIDERS.groq.keyPrefix)) return 'groq';
  return null;
}

function normalizeProvider(value: string | undefined): AiProvider | null {
  return value === 'openrouter' || value === 'groq' ? value : null;
}

function modelFor(provider: AiProvider, env: AiEnv): string {
  const fromEnv = provider === 'openrouter' ? env.VITE_OPENROUTER_MODEL : env.VITE_GROQ_MODEL;
  return (fromEnv ?? '').trim() || AI_PROVIDERS[provider].defaultModel;
}

export function resolveAiConfig(userKey: string | null | undefined, env: AiEnv = readEnv()): AiConfig {
  const settingsKey = (userKey ?? '').trim();
  const envProvider = normalizeProvider((env.VITE_AI_PROVIDER ?? '').trim());

  if (settingsKey) {
    const provider = detectProvider(settingsKey) ?? envProvider ?? 'groq';
    return { provider, apiKey: settingsKey, model: modelFor(provider, env), url: AI_PROVIDERS[provider].url, source: 'settings' };
  }

  const openrouterKey = (env.VITE_OPENROUTER_API_KEY ?? '').trim();
  const groqKey = (env.VITE_GROQ_API_KEY ?? '').trim();
  const candidates: AiProvider[] = envProvider ? [envProvider, 'openrouter', 'groq'] : ['openrouter', 'groq'];
  for (const provider of candidates) {
    const key = provider === 'openrouter' ? openrouterKey : groqKey;
    if (key) return { provider, apiKey: key, model: modelFor(provider, env), url: AI_PROVIDERS[provider].url, source: 'environment' };
  }

  const provider = envProvider ?? 'openrouter';
  return { provider, apiKey: '', model: modelFor(provider, env), url: AI_PROVIDERS[provider].url, source: 'none' };
}

/** En-têtes HTTP du fournisseur (OpenRouter recommande l'attribution de l'application). */
export function providerHeaders(config: AiConfig, origin = ''): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === 'openrouter') {
    if (origin) headers['HTTP-Referer'] = origin;
    headers['X-Title'] = 'InsulinCalc';
  }
  return headers;
}
