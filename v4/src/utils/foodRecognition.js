// V5.5 — Groq + Llama 4 Scout Vision Food Recognition
// Free, ultra-fast inference via Groq API
// Model: meta-llama/llama-4-scout-17b-16e-instruct (current Groq vision model)

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

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
{"foods":[{"name":"english name","nameFr":"nom français simple","confidence":85,"estimatedCarbs":30,"estimatedFat":12,"estimatedWeight":200,"estimatedGI":"moyen"}]}

CRITICAL rules:
- Identify the COMPLETE DISH first (e.g. "cheeseburger", "pizza margherita", "tajine poulet"), then individual sides
- Do NOT decompose a dish into ingredients (a burger = 1 entry "cheeseburger", NOT bun + patty + cheese + lettuce separately)
- Only list sides/extras as separate items (e.g. fries, drink, salad on the side)
- "nameFr" must be a SIMPLE common name: "Cheeseburger", "Pizza", "Couscous", "Tajine", "Sushi" — NOT long descriptions
- "confidence" = 0-100 certainty
- "estimatedCarbs" = total carbs in grams for the visible portion
- "estimatedFat" = total fat/lipids in grams for the visible portion
- "estimatedWeight" = estimated total weight in grams for the visible portion
- "estimatedGI" = glycemic index category: "faible" (low GI, e.g. legumes, whole grains), "moyen" (medium, e.g. basmati rice, whole wheat), "élevé" (high GI, e.g. white bread, sugar, fries)
- Recognize ALL cuisines: Moroccan, Mediterranean, Asian, fast-food, etc.
- If no food visible, return {"foods":[]}
- Max 5 items`;

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
      estimatedCarbs: f.estimatedCarbs ?? null,
      estimatedFat: f.estimatedFat ?? null,
      estimatedWeight: f.estimatedWeight ?? null,
      estimatedGI: f.estimatedGI || null,
      id: `groq_${i}_${Date.now()}`
    }));
}

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/** Convert fat grams to qualitative level used by dose calculations */
export function deriveFatLevel(fatGrams) {
  if (fatGrams == null || fatGrams <= 5) return 'faible';
  if (fatGrams <= 15) return 'moyen';
  return 'élevé';
}

// Keyword aliases: AI name → DB search keywords
const KEYWORD_MAP = {
  'hamburger': ['burger', 'big mac', 'whopper', 'cheeseburger', 'royal cheese', 'mcchicken', 'steak hache'],
  'cheeseburger': ['burger', 'big mac', 'royal cheese', 'double cheese', 'cheeseburger'],
  'burger': ['burger', 'big mac', 'whopper', 'royal cheese', 'cheeseburger'],
  'frites': ['frites'],
  'pizza': ['pizza'],
  'sushi': ['sushi', 'maki', 'sashimi'],
  'kebab': ['kebab', 'doner'],
  'tacos': ['tacos'],
  'couscous': ['couscous'],
  'tajine': ['tajine'],
  'sandwich': ['sandwich', 'panini', 'croque'],
  'salade': ['salade'],
  'riz': ['riz'],
  'pates': ['pasta', 'carbonara', 'lasagne', 'pates'],
  'poulet': ['poulet', 'chicken', 'nuggets'],
  'croissant': ['croissant'],
  'pain': ['pain', 'baguette', 'tartine'],
};

/**
 * Map recognition results to local food DB
 * Uses keyword matching + fuzzy substring matching
 */
export function mapToLocalFoods(results, allFoods) {
  const foods = Object.values(allFoods);

  return results.map(result => {
    const frName = normalize(result.nameFr || result.name);
    const enName = normalize(result.name);

    let best = null, bestScore = 0;

    for (const f of foods) {
      const fn = normalize(f.name);
      let score = 0;

      // 1. Exact match (highest priority)
      if (fn === frName || fn === enName) {
        score = 1000;
      }
      // 2. Keyword matching: check if AI result maps to known keywords
      else {
        for (const [key, keywords] of Object.entries(KEYWORD_MAP)) {
          if (frName.includes(key) || enName.includes(key)) {
            for (const kw of keywords) {
              if (fn.includes(normalize(kw))) {
                score = Math.max(score, 500 + kw.length);
              }
            }
          }
        }
      }

      // 3. Substring match (lower priority) — but require minimum 4 char overlap
      if (score === 0) {
        // Split into words and match individual words
        const frWords = frName.split(/[\s,()/-]+/).filter(w => w.length >= 4);
        const enWords = enName.split(/[\s,()/-]+/).filter(w => w.length >= 4);
        const fnWords = fn.split(/[\s,()/-]+/).filter(w => w.length >= 3);

        for (const word of [...frWords, ...enWords]) {
          for (const fw of fnWords) {
            if (fw.includes(word) || word.includes(fw)) {
              const s = 100 + Math.min(word.length, fw.length);
              score = Math.max(score, s);
            }
          }
        }
      }

      if (score > bestScore) { bestScore = score; best = f; }
    }

    // Require minimum score to avoid false positives
    const mapped = best != null && bestScore >= 100;

    return {
      ...result,
      nameFr: result.nameFr || result.name,
      localFood: mapped ? best : null,
      mapped,
    };
  });
}
