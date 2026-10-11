import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS, detectProvider, providerHeaders, resolveAiConfig } from '../aiConfig';

const EMPTY = {};

describe('aiConfig — détection du fournisseur', () => {
  it('reconnaît les préfixes OpenRouter et Groq, sinon null', () => {
    expect(detectProvider('sk-or-v1-abc')).toBe('openrouter');
    expect(detectProvider('  gsk_abc ')).toBe('groq');
    expect(detectProvider('abc')).toBeNull();
    expect(detectProvider('')).toBeNull();
    expect(detectProvider(null)).toBeNull();
    expect(detectProvider(undefined)).toBeNull();
  });
});

describe('aiConfig — résolution de la configuration', () => {
  it('sans clé ni environnement : source none, OpenRouter par défaut, modèle par défaut', () => {
    const cfg = resolveAiConfig('', EMPTY);
    expect(cfg).toEqual({
      provider: 'openrouter',
      apiKey: '',
      model: AI_PROVIDERS.openrouter.defaultModel,
      url: AI_PROVIDERS.openrouter.url,
      source: 'none',
    });
  });

  it('clé OpenRouter de l’environnement (secret GitHub → VITE_OPENROUTER_API_KEY)', () => {
    const cfg = resolveAiConfig(null, { VITE_OPENROUTER_API_KEY: 'sk-or-v1-env' });
    expect(cfg.source).toBe('environment');
    expect(cfg.provider).toBe('openrouter');
    expect(cfg.apiKey).toBe('sk-or-v1-env');
    expect(cfg.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(cfg.model).toBe('meta-llama/llama-4-scout');
  });

  it('modèle OpenRouter surchargé par VITE_OPENROUTER_MODEL', () => {
    const cfg = resolveAiConfig(null, { VITE_OPENROUTER_API_KEY: 'sk-or-v1-env', VITE_OPENROUTER_MODEL: ' google/gemma-3-27b-it ' });
    expect(cfg.model).toBe('google/gemma-3-27b-it');
  });

  it('clé Groq de l’environnement seule → Groq', () => {
    const cfg = resolveAiConfig(undefined, { VITE_GROQ_API_KEY: 'gsk_env' });
    expect(cfg.source).toBe('environment');
    expect(cfg.provider).toBe('groq');
    expect(cfg.url).toBe(AI_PROVIDERS.groq.url);
    expect(cfg.model).toBe(AI_PROVIDERS.groq.defaultModel);
  });

  it('les deux clés présentes : OpenRouter prioritaire sauf VITE_AI_PROVIDER=groq', () => {
    const env = { VITE_OPENROUTER_API_KEY: 'sk-or-v1-env', VITE_GROQ_API_KEY: 'gsk_env' };
    expect(resolveAiConfig('', env).provider).toBe('openrouter');
    expect(resolveAiConfig('', { ...env, VITE_AI_PROVIDER: 'groq' }).provider).toBe('groq');
    expect(resolveAiConfig('', { ...env, VITE_AI_PROVIDER: 'inconnu' }).provider).toBe('openrouter');
  });

  it('VITE_AI_PROVIDER=groq sans clé Groq retombe sur la clé OpenRouter disponible', () => {
    const cfg = resolveAiConfig('', { VITE_AI_PROVIDER: 'groq', VITE_OPENROUTER_API_KEY: 'sk-or-v1-env' });
    expect(cfg.provider).toBe('openrouter');
    expect(cfg.source).toBe('environment');
  });

  it('la clé saisie dans Réglages prime sur l’environnement et impose son fournisseur', () => {
    const cfg = resolveAiConfig('  gsk_device  ', { VITE_OPENROUTER_API_KEY: 'sk-or-v1-env' });
    expect(cfg.source).toBe('settings');
    expect(cfg.provider).toBe('groq');
    expect(cfg.apiKey).toBe('gsk_device');
    expect(cfg.url).toBe(AI_PROVIDERS.groq.url);
  });

  it('clé saisie sans préfixe connu : fournisseur de l’environnement, sinon Groq', () => {
    expect(resolveAiConfig('abc123', { VITE_AI_PROVIDER: 'openrouter' }).provider).toBe('openrouter');
    expect(resolveAiConfig('abc123', EMPTY).provider).toBe('groq');
  });

  it('une clé vide ou blanche dans l’environnement est ignorée', () => {
    const cfg = resolveAiConfig('', { VITE_OPENROUTER_API_KEY: '   ', VITE_GROQ_API_KEY: '' });
    expect(cfg.source).toBe('none');
    expect(cfg.apiKey).toBe('');
  });

  it('utilise import.meta.env par défaut sans lever d’erreur', () => {
    const cfg = resolveAiConfig('');
    expect(['none', 'environment']).toContain(cfg.source);
  });
});

describe('aiConfig — en-têtes HTTP', () => {
  it('OpenRouter : Authorization, HTTP-Referer et X-Title', () => {
    const cfg = resolveAiConfig('sk-or-v1-x', EMPTY);
    const h = providerHeaders(cfg, 'https://example.github.io');
    expect(h['Content-Type']).toBe('application/json');
    expect(h.Authorization).toBe('Bearer sk-or-v1-x');
    expect(h['HTTP-Referer']).toBe('https://example.github.io');
    expect(h['X-Title']).toBe('InsulinCalc');
  });

  it('OpenRouter sans origine : pas de HTTP-Referer', () => {
    const h = providerHeaders(resolveAiConfig('sk-or-v1-x', EMPTY));
    expect(h['HTTP-Referer']).toBeUndefined();
    expect(h['X-Title']).toBe('InsulinCalc');
  });

  it('Groq : uniquement Content-Type et Authorization', () => {
    const h = providerHeaders(resolveAiConfig('gsk_x', EMPTY), 'https://example.github.io');
    expect(Object.keys(h).sort()).toEqual(['Authorization', 'Content-Type']);
  });
});
