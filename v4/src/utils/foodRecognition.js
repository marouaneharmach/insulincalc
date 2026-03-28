// V5.5 — Groq + Llama 3.2 Vision Food Recognition
// Free, ultra-fast inference via Groq API
// Model: llama-3.2-90b-vision-preview (best open-source vision model)

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'llama-3.2-90b-vision-preview';

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

const FOOD_PROMPT = `You are a food identification expert for a diabetes management app. Analyze this meal photo.

Return ONLY valid JSON (no markdown, no code blocks, no explanation):
{"foods":[{"name":"english name","nameFr":"nom français précis","confidence":85,"estimatedCarbs":30}]}

Rules:
- Identify each visible food item separately
- "confidence" = 0-100 certainty percentage
- "estimatedCarbs" = estimated carbs in grams for the visible portion
- Be specific: "cheeseburger with bacon" not "food"
- Recognize ALL cuisines: Moroccan (tagine, couscous, harira, msemen, pastilla), Mediterranean, Asian, fast-food, breakfast, etc.
- If no food is visible, return {"foods":[]}
- Max 10 items`;

/**
 * Recognize food via Groq API (Llama 3.2 Vision)
 * Uses OpenAI-compatible chat completions endpoint
 */
export async function recognizeFood(imageFile) {
  if (!GROQ_API_KEY) {
    throw new Error('Clé API Groq manquante (VITE_GROQ_API_KEY). Créez-en une gratuitement sur console.groq.com');
  }

  const compressed = await compressImage(imageFile);
  const base64 = await blobToBase64(compressed);

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` }
            },
            {
              type: 'text',
              text: FOOD_PROMPT
            }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 1024,
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 429) {
      throw new Error('Quota Groq dépassé. Réessayez dans quelques secondes (30 req/min gratuit).');
    }
    if (response.status === 401) {
      throw new Error('Clé API Groq invalide. Vérifiez sur console.groq.com');
    }
    throw new Error(`Erreur Groq ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const textContent = data.choices?.[0]?.message?.content || '';

  if (!textContent) {
    throw new Error('Réponse vide de Groq');
  }

  let parsed;
  try {
    // Extract JSON — model may wrap in markdown code blocks
    const jsonStr = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    console.warn('[FoodRecognition] Raw response:', textContent);
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
      id: `groq_${i}_${Date.now()}`
    }));
}

/**
 * Map recognition results to local food DB
 */
export function mapToLocalFoods(results, allFoods) {
  const foods = Object.values(allFoods);

  return results.map(result => {
    const frName = (result.nameFr || result.name).toLowerCase();
    const enName = result.name.toLowerCase();

    let best = null, bestScore = 0;

    for (const f of foods) {
      const fn = f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const frNorm = frName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const enNorm = enName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      let score = 0;
      if (fn.includes(frNorm) || frNorm.includes(fn)) score = frNorm.length + fn.length;
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
