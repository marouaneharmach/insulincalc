// V4.4 — Clarifai Food Recognition API integration
// Uses the general food model for food photo → ingredient identification

// ⚠️ Replace with your Clarifai Personal Access Token
const CLARIFAI_PAT = import.meta.env.VITE_CLARIFAI_PAT || 'YOUR_CLARIFAI_PAT_HERE';

// Clarifai food model
const MODEL_ID = 'food-item-recognition';
const MODEL_VERSION = '1d5fd481e0cf4826aa72ec3ff049e044';
const USER_ID = 'clarifai';
const APP_ID = 'main';

/**
 * Compress image to JPEG, max 800px, for API upload
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
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Convert blob to base64 string (without data: prefix)
 */
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Recognize food in an image using Clarifai
 * @param {File|Blob} imageFile - The image to analyze
 * @returns {Promise<Array<{name: string, confidence: number}>>} Detected foods
 */
export async function recognizeFood(imageFile) {
  if (!CLARIFAI_PAT || CLARIFAI_PAT === 'YOUR_CLARIFAI_PAT_HERE') {
    throw new Error('Clé API Clarifai non configurée. Ajoutez VITE_CLARIFAI_PAT dans votre .env');
  }

  // Compress image
  const compressed = await compressImage(imageFile);
  const base64 = await blobToBase64(compressed);

  const response = await fetch(
    `https://api.clarifai.com/v2/models/${MODEL_ID}/versions/${MODEL_VERSION}/outputs`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Key ${CLARIFAI_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_app_id: { user_id: USER_ID, app_id: APP_ID },
        inputs: [{
          data: {
            image: { base64 }
          }
        }]
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Clarifai API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const concepts = data.outputs?.[0]?.data?.concepts || [];

  // Return top 10 food items with confidence > 10%
  return concepts
    .filter(c => c.value > 0.1)
    .slice(0, 10)
    .map(c => ({
      name: c.name,
      confidence: Math.round(c.value * 100),
      id: c.id,
    }));
}

/**
 * Map Clarifai food names to local food database
 * Uses fuzzy matching to find the closest match
 */
export function mapToLocalFoods(clarifaiResults, allFoods) {
  const localFoodsList = Object.values(allFoods);

  return clarifaiResults.map(result => {
    const name = result.name.toLowerCase();

    // Direct match
    let best = null;
    let bestScore = 0;

    for (const food of localFoodsList) {
      const foodName = food.name.toLowerCase();
      // Exact match
      if (foodName.includes(name) || name.includes(foodName)) {
        const score = Math.max(foodName.length, name.length);
        if (score > bestScore) {
          bestScore = score;
          best = food;
        }
      }
    }

    return {
      ...result,
      localFood: best,
      mapped: best != null,
    };
  });
}
