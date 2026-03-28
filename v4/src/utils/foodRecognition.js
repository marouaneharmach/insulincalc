// V5.4.2 — Google Gemini Vision Food Recognition
// Uses Gemini 2.0 Flash (stable) with fallback, errors propagated to UI

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const API_BASE = 'https://generativelanguage.googleapis.com';

/**
 * Discover which vision-capable model is available for this API key
 */
async function findAvailableModel() {
  // Try listing models to find one that supports vision
  for (const apiVersion of ['v1beta', 'v1']) {
    try {
      const res = await fetch(`${API_BASE}/${apiVersion}/models?key=${GEMINI_API_KEY}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.models) continue;

      // Find a model that supports generateContent and vision
      const visionModels = data.models
        .filter(m =>
          m.supportedGenerationMethods?.includes('generateContent') &&
          m.name
        )
        .map(m => ({ name: m.name.replace('models/', ''), displayName: m.displayName, version: apiVersion }));

      // Prefer flash models (faster), then pro
      const preferred = ['gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro-vision'];
      for (const pref of preferred) {
        const found = visionModels.find(m => m.name.includes(pref));
        if (found) return { model: found.name, apiVersion: found.version };
      }

      // Fallback: first available model with generateContent
      if (visionModels.length > 0) return { model: visionModels[0].name, apiVersion };
    } catch {
      continue;
    }
  }
  return null;
}

// Cache discovered model
let cachedModel = null;

/**
 * Compress image to JPEG, max 800px
 */
export function compressImage(file, maxSize = 800) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(resolve, 'image/jpeg', 0.75);
    };
    img.src = URL.createObjectURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

const FOOD_RECOGNITION_PROMPT = `You are a food identification expert for a diabetes app. Analyze this meal photo.

Return ONLY valid JSON (no markdown, no explanation):
{
  "foods": [
    {
      "name": "english name",
      "nameFr": "nom français précis",
      "confidence": 85,
      "estimatedCarbs": 30
    }
  ]
}

Rules:
- Identify each food item separately (burger bun + patty + fries = separate entries)
- "confidence" is 0-100 certainty percentage
- "estimatedCarbs" = estimated carbs in grams for the visible portion
- Be specific: "cheeseburger" not "food", "french fries" not "side dish"
- Recognize ALL cuisines: Moroccan (tagine, couscous, harira, msemen, pastilla), Mediterranean, Asian, fast-food, etc.
- If no food visible, return {"foods": []}
- Max 10 items`;

/**
 * Recognize food via Google Gemini Vision API
 * Auto-discovers the best available model for this API key
 */
export async function recognizeFood(imageFile) {
  if (!GEMINI_API_KEY) {
    throw new Error('Clé API Gemini manquante (VITE_GEMINI_API_KEY). Vérifiez GitHub Secrets.');
  }

  // Discover available model (cached after first call)
  if (!cachedModel) {
    cachedModel = await findAvailableModel();
    if (!cachedModel) {
      throw new Error('Aucun modèle Gemini trouvé pour cette clé API. Vérifiez que la clé est valide sur aistudio.google.com/apikey');
    }
  }

  const { model, apiVersion } = cachedModel;
  const url = `${API_BASE}/${apiVersion}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const compressed = await compressImage(imageFile);
  const base64 = await blobToBase64(compressed);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: FOOD_RECOGNITION_PROMPT }
        ]
      }],
      generationConfig: { temperature: 0.2 }
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 429) {
      throw new Error('Quota API Gemini dépassé. Réessayez dans quelques minutes.');
    }
    // Reset cached model on 404 (model may have been deprecated)
    if (response.status === 404) {
      cachedModel = null;
    }
    throw new Error(`Erreur Gemini (${model}): ${response.status} — ${errText.slice(0, 150)}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Gemini: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!textContent) {
    const reason = data.candidates?.[0]?.finishReason;
    if (reason === 'SAFETY') throw new Error('Image bloquée par le filtre de sécurité');
    throw new Error(`Réponse vide (modèle: ${model})`);
  }

  let parsed;
  try {
    const jsonStr = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    console.warn('[FoodRecognition] Raw:', textContent);
    throw new Error('Réponse mal formatée. Réessayez.');
  }

  if (!parsed.foods || !Array.isArray(parsed.foods)) return [];

  return parsed.foods
    .filter(f => f.confidence > 20)
    .slice(0, 10)
    .map((f, i) => ({
      name: f.name || f.nameFr || 'unknown',
      nameFr: f.nameFr || f.name,
      confidence: f.confidence || 80,
      estimatedCarbs: f.estimatedCarbs || null,
      id: `gemini_${i}_${Date.now()}`
    }));
}

/**
 * Map Gemini results to local food DB
 * Gemini returns French names directly, so matching is much better
 */
export function mapToLocalFoods(geminiResults, allFoods) {
  const foods = Object.values(allFoods);

  return geminiResults.map(result => {
    const frName = (result.nameFr || result.name).toLowerCase();
    const enName = result.name.toLowerCase();

    let best = null, bestScore = 0;

    for (const f of foods) {
      const fn = f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const frNorm = frName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const enNorm = enName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      let score = 0;
      // Match against French name (primary — Gemini returns good French names)
      if (fn.includes(frNorm) || frNorm.includes(fn)) score = frNorm.length + fn.length;
      // Fallback: match against English name
      else if (fn.includes(enNorm) || enNorm.includes(fn)) score = enNorm.length + fn.length;

      if (score > bestScore) { bestScore = score; best = f; }
    }

    return {
      ...result,
      nameFr: result.nameFr || result.name,
      localFood: best,
      mapped: best != null,
    };
  });
}
