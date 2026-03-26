// V4.4 — Clarifai Food Recognition via serverless proxy (bypasses CORS)
// The proxy URL handles auth server-side so no CORS issues

// Proxy URL (val.town, Cloudflare Worker, or Netlify Function)
const PROXY_URL = import.meta.env.VITE_CLARIFAI_PROXY || '';
// Fallback: direct API call (works in dev/localhost only, blocked by CORS in production)
const CLARIFAI_PAT = import.meta.env.VITE_CLARIFAI_PAT || '';
const DIRECT_URL = 'https://api.clarifai.com/v2/models/food-item-recognition/versions/1d5fd481e0cf4826aa72ec3ff049e044/outputs';

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

/**
 * Recognize food via proxy or direct API
 */
export async function recognizeFood(imageFile) {
  if (!PROXY_URL && !CLARIFAI_PAT) {
    throw new Error('Configuration Clarifai manquante. Configurez VITE_CLARIFAI_PROXY ou VITE_CLARIFAI_PAT.');
  }

  const compressed = await compressImage(imageFile);
  const base64 = await blobToBase64(compressed);

  const requestBody = JSON.stringify({
    user_app_id: { user_id: 'clarifai', app_id: 'main' },
    inputs: [{ data: { image: { base64 } } }]
  });

  let response;

  if (PROXY_URL) {
    // Use serverless proxy (val.town / Cloudflare Worker / Netlify)
    response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });
  } else {
    // Direct call (dev only — blocked by CORS in production)
    response = await fetch(DIRECT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${CLARIFAI_PAT}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });
  }

  if (!response.ok) {
    throw new Error(`Erreur API: ${response.status}`);
  }

  const data = await response.json();
  if (data.status && data.status.code !== 10000) {
    throw new Error(data.status.description || 'Erreur Clarifai');
  }

  const concepts = data.outputs?.[0]?.data?.concepts || [];
  return concepts
    .filter(c => c.value > 0.1)
    .slice(0, 10)
    .map(c => ({ name: c.name, confidence: Math.round(c.value * 100), id: c.id }));
}

/**
 * Map Clarifai names to local food DB
 */
export function mapToLocalFoods(clarifaiResults, allFoods) {
  const foods = Object.values(allFoods);
  return clarifaiResults.map(result => {
    const name = result.name.toLowerCase();
    let best = null, bestScore = 0;
    for (const f of foods) {
      const fn = f.name.toLowerCase();
      if (fn.includes(name) || name.includes(fn)) {
        const score = Math.max(fn.length, name.length);
        if (score > bestScore) { bestScore = score; best = f; }
      }
    }
    return { ...result, localFood: best, mapped: best != null };
  });
}
