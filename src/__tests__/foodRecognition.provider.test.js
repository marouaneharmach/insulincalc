/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recognizeFood } from '../utils/foodRecognition';
import { AI_PROVIDERS, resolveAiConfig } from '../app/aiConfig';

// jsdom n'implémente ni canvas ni le chargement d'images : on simule le strict nécessaire
// pour que compressImage() produise un Blob JPEG sans toucher au réseau.
function stubImagePipeline() {
  vi.stubGlobal('Image', class {
    set src(_v) { queueMicrotask(() => this.onload?.()); }
    get width() { return 1600; }
    get height() { return 1200; }
  });
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }));
  HTMLCanvasElement.prototype.toBlob = function toBlob(cb) { cb(new Blob(['jpeg'], { type: 'image/jpeg' })); };
}

function okResponse(content) {
  return { ok: true, status: 200, json: () => Promise.resolve({ choices: [{ message: { content } }] }) };
}

const FILE = new File(['x'], 'repas.jpg', { type: 'image/jpeg' });

describe('recognizeFood — fournisseur et configuration', () => {
  beforeEach(() => {
    stubImagePipeline();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuse sans clé (AI_KEY_MISSING) sans appeler le réseau', async () => {
    await expect(recognizeFood(FILE, resolveAiConfig('', {}))).rejects.toThrow('AI_KEY_MISSING');
    await expect(recognizeFood(FILE, null)).rejects.toThrow('AI_KEY_MISSING');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('appelle OpenRouter avec la clé de l’environnement, le modèle et les en-têtes d’attribution', async () => {
    fetch.mockResolvedValueOnce(okResponse(JSON.stringify({
      foods: [{ name: 'tajine', nameFr: 'Tajine', confidence: 88, estimatedCarbs: 25, estimatedFat: 12, estimatedWeight: 300, estimatedGI: 'faible' }],
    })));
    const config = resolveAiConfig('', { VITE_OPENROUTER_API_KEY: 'sk-or-v1-secret', VITE_OPENROUTER_MODEL: 'meta-llama/llama-4-maverick' });

    const foods = await recognizeFood(FILE, config);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(AI_PROVIDERS.openrouter.url);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer sk-or-v1-secret');
    expect(init.headers['X-Title']).toBe('InsulinCalc');
    expect(init.headers['HTTP-Referer']).toBe(window.location.origin);
    const body = JSON.parse(init.body);
    expect(body.model).toBe('meta-llama/llama-4-maverick');
    expect(body.messages[0].content[0].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(body.messages[0].content[1].text).toContain('"foods"');

    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ nameFr: 'Tajine', estimatedCarbs: 25, estimatedFat: 12, estimatedWeight: 300, estimatedGI: 'faible' });
    expect(foods[0].id).toMatch(/^ai_openrouter_0_/);
  });

  it('accepte une clé brute (chaîne) et route vers Groq selon le préfixe', async () => {
    fetch.mockResolvedValueOnce(okResponse('```json\n{"foods":[{"name":"rice","nameFr":"Riz","confidence":90,"estimatedCarbs":45}]}\n```'));

    const foods = await recognizeFood(FILE, 'gsk_device');

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(AI_PROVIDERS.groq.url);
    expect(init.headers.Authorization).toBe('Bearer gsk_device');
    expect(init.headers['X-Title']).toBeUndefined();
    expect(JSON.parse(init.body).model).toBe(AI_PROVIDERS.groq.defaultModel);
    expect(foods[0]).toMatchObject({ nameFr: 'Riz', estimatedCarbs: 45, estimatedFat: null, estimatedWeight: null, estimatedGI: null });
    expect(foods[0].id).toMatch(/^ai_groq_0_/);
  });

  it('filtre les aliments peu sûrs et limite à 10 résultats', async () => {
    const foods = Array.from({ length: 12 }, (_, i) => ({ name: `f${i}`, nameFr: `F${i}`, confidence: i === 0 ? 10 : 80, estimatedCarbs: i }));
    fetch.mockResolvedValueOnce(okResponse(JSON.stringify({ foods })));
    const result = await recognizeFood(FILE, 'sk-or-v1-x');
    expect(result).toHaveLength(10);
    expect(result[0].name).toBe('f1');
  });

  it('messages d’erreur nommant le fournisseur : 401, 429, autre statut', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve('unauthorized') });
    await expect(recognizeFood(FILE, 'sk-or-v1-x')).rejects.toThrow(/Clé API OpenRouter invalide/);

    fetch.mockResolvedValueOnce({ ok: false, status: 429, text: () => Promise.resolve('') });
    await expect(recognizeFood(FILE, 'gsk_x')).rejects.toThrow(/Quota Groq dépassé/);

    fetch.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('boom') });
    await expect(recognizeFood(FILE, 'sk-or-v1-x')).rejects.toThrow(/Erreur OpenRouter 500: boom/);
  });

  it('réponse vide ou JSON invalide', async () => {
    fetch.mockResolvedValueOnce(okResponse(''));
    await expect(recognizeFood(FILE, 'sk-or-v1-x')).rejects.toThrow(/Réponse vide de OpenRouter/);

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetch.mockResolvedValueOnce(okResponse('pas du json'));
    await expect(recognizeFood(FILE, 'sk-or-v1-x')).rejects.toThrow(/Réponse mal formatée/);

    fetch.mockResolvedValueOnce(okResponse(JSON.stringify({ foods: null })));
    await expect(recognizeFood(FILE, 'sk-or-v1-x')).resolves.toEqual([]);
  });
});
