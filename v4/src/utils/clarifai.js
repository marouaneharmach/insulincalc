// V4.4 — Clarifai Food Recognition via gRPC-web (bypasses CORS)
import { ClarifaiStub } from 'clarifai-web-grpc';

const CLARIFAI_PAT = import.meta.env.VITE_CLARIFAI_PAT || '';

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
 * Recognize food via Clarifai gRPC-web (no CORS issues)
 */
export async function recognizeFood(imageFile) {
  if (!CLARIFAI_PAT) {
    throw new Error('Clé API Clarifai non configurée');
  }

  const compressed = await compressImage(imageFile);
  const base64 = await blobToBase64(compressed);

  const stub = ClarifaiStub.grpc();

  return new Promise((resolve, reject) => {
    stub.PostModelOutputs(
      {
        user_app_id: { user_id: 'clarifai', app_id: 'main' },
        model_id: 'food-item-recognition',
        version_id: '1d5fd481e0cf4826aa72ec3ff049e044',
        inputs: [{
          data: { image: { base64 } }
        }]
      },
      { authorization: `Key ${CLARIFAI_PAT}` },
      (err, response) => {
        if (err) {
          reject(new Error(err.message || 'Erreur Clarifai'));
          return;
        }
        if (!response || response.status?.code !== 10000) {
          reject(new Error(response?.status?.description || 'Erreur API'));
          return;
        }
        const concepts = response.outputs?.[0]?.data?.concepts || [];
        resolve(
          concepts
            .filter(c => c.value > 0.1)
            .slice(0, 10)
            .map(c => ({ name: c.name, confidence: Math.round(c.value * 100), id: c.id }))
        );
      }
    );
  });
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
