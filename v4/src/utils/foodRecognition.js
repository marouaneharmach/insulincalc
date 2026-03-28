// V5.4 — Google Gemini Vision Food Recognition
// Replaces Clarifai with Gemini 2.0 Flash for better food identification
// Especially for Moroccan/Mediterranean cuisine

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

const FOOD_RECOGNITION_PROMPT = `Tu es un expert en nutrition. Analyse cette photo de repas et identifie tous les aliments visibles.

Retourne UNIQUEMENT un JSON valide (pas de markdown, pas d'explication) avec cette structure :
{
  "foods": [
    {
      "name": "nom anglais de l'aliment",
      "nameFr": "nom français de l'aliment",
      "confidence": 85,
      "estimatedCarbs": 30
    }
  ]
}

Règles :
- Identifie chaque aliment séparément (ex: riz + poulet + légumes = 3 entrées)
- Le champ "confidence" est un pourcentage de 0 à 100 de ta certitude
- Le champ "estimatedCarbs" est une estimation des glucides en grammes pour la portion visible
- Inclus les plats marocains et méditerranéens (tagine, couscous, harira, msemen, baghrir, pastilla, rfissa, etc.)
- Si tu ne reconnais aucun aliment, retourne {"foods": []}
- Maximum 10 aliments`;

/**
 * Recognize food via Google Gemini Vision API
 * Returns same interface as the old Clarifai module: [{name, confidence, id}]
 */
export async function recognizeFood(imageFile) {
  if (!GEMINI_API_KEY) {
    throw new Error('Clé API Gemini manquante. Configurez VITE_GEMINI_API_KEY.');
  }

  const compressed = await compressImage(imageFile);
  const base64 = await blobToBase64(compressed);

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: FOOD_RECOGNITION_PROMPT }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Erreur Gemini API: ${response.status} ${err}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Extract JSON from response (Gemini may wrap it in markdown code blocks)
  let parsed;
  try {
    const jsonStr = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    console.warn('[FoodRecognition] Failed to parse Gemini response:', textContent);
    return [];
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
