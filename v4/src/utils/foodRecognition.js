// V5.4.1 — Google Gemini 2.5 Pro Vision Food Recognition
// Uses Gemini 2.5 Pro for superior food identification accuracy
// Especially for Moroccan/Mediterranean/international cuisine

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-06-05:generateContent';

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

const FOOD_RECOGNITION_PROMPT = `Tu es un diététicien expert spécialisé dans l'identification visuelle des aliments pour les patients diabétiques de type 1.

MISSION : Analyse cette photo et identifie PRÉCISÉMENT chaque aliment visible avec ses glucides estimés.

Retourne UNIQUEMENT un JSON valide (sans markdown, sans explication, sans commentaire) :
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

RÈGLES STRICTES :
1. Sois PRÉCIS : "Tajine de poulet aux olives" pas juste "plat"
2. Sépare chaque composant : riz + sauce + viande + légumes = entrées distinctes
3. Estime les glucides par portion VISIBLE (pas par 100g)
4. Confidence = ta certitude de 0 à 100
5. Reconnais TOUS les types de cuisine :
   - Marocaine : tajine, couscous, harira, pastilla, msemen, baghrir, rfissa, bissara, zaalouk, briouate, chebakia, sellou, méchoui, tanjia
   - Méditerranéenne : pizza, pâtes, salade, houmous, falafel, taboulé
   - Fast-food : burger, frites, nuggets, kebab, tacos, pizza
   - Asiatique : sushi, ramen, riz cantonais, nems, pad thaï
   - Petit-déjeuner : croissant, pain, céréales, pancakes, œufs
   - Fruits, légumes, boissons, desserts, snacks
6. Si la photo n'est PAS un aliment ou est floue, retourne {"foods": []}
7. Maximum 10 aliments
8. Ne confonds pas les plats : une assiette de pâtes n'est pas une pizza`;

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
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
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
