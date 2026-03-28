// Food Recognition — Clarifai API + local food matching
// Supports proxy URL (production) or direct PAT (dev)

const PROXY_URL = import.meta.env.VITE_CLARIFAI_PROXY || '';
const CLARIFAI_PAT = import.meta.env.VITE_CLARIFAI_PAT || '';
const DIRECT_URL = 'https://api.clarifai.com/v2/models/food-item-recognition/versions/1d5fd481e0cf4826aa72ec3ff049e044/outputs';

/** Compress image to JPEG, max 800px */
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

/** Check if Clarifai API is configured */
export function isApiConfigured() {
  return !!(PROXY_URL || CLARIFAI_PAT);
}

/** Recognize food via Clarifai proxy or direct API */
export async function recognizeFood(imageFile) {
  if (!PROXY_URL && !CLARIFAI_PAT) {
    throw new Error('CLARIFAI_NOT_CONFIGURED');
  }

  const compressed = await compressImage(imageFile);
  const base64 = await blobToBase64(compressed);

  const requestBody = JSON.stringify({
    user_app_id: { user_id: 'clarifai', app_id: 'main' },
    inputs: [{ data: { image: { base64 } } }]
  });

  let response;
  if (PROXY_URL) {
    response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });
  } else {
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
    throw new Error(`API_ERROR_${response.status}`);
  }

  const data = await response.json();
  if (data.status && data.status.code !== 10000) {
    throw new Error(data.status.description || 'CLARIFAI_ERROR');
  }

  const concepts = data.outputs?.[0]?.data?.concepts || [];
  return concepts
    .filter(c => c.value > 0.1)
    .slice(0, 10)
    .map(c => ({ name: c.name, confidence: Math.round(c.value * 100), id: c.id }));
}

// English → French food name mapping for Clarifai results
const EN_FR_FOOD = {
  banana: 'banane', apple: 'pomme', orange: 'orange', grape: 'raisin', strawberry: 'fraise',
  pear: 'poire', peach: 'pêche', watermelon: 'pastèque', melon: 'melon', lemon: 'citron',
  pineapple: 'ananas', mango: 'mangue', cherry: 'cerise', fig: 'figue', date: 'datte',
  apricot: 'abricot', plum: 'prune', avocado: 'avocat', coconut: 'noix de coco',
  pomegranate: 'grenade', kiwi: 'kiwi', clementine: 'clémentine', grapefruit: 'pamplemousse',
  bread: 'pain', rice: 'riz', pasta: 'pâtes', couscous: 'couscous', noodle: 'nouilles',
  chicken: 'poulet', beef: 'bœuf', lamb: 'agneau', fish: 'poisson', egg: 'œuf',
  cheese: 'fromage', milk: 'lait', yogurt: 'yaourt', butter: 'beurre', cream: 'crème',
  potato: 'pomme de terre', tomato: 'tomate', onion: 'oignon', carrot: 'carotte',
  cucumber: 'concombre', pepper: 'poivron', lettuce: 'laitue', cabbage: 'chou',
  broccoli: 'brocoli', spinach: 'épinard', corn: 'maïs', pea: 'petit pois',
  bean: 'haricot', lentil: 'lentille', chickpea: 'pois chiche',
  cake: 'gâteau', cookie: 'biscuit', chocolate: 'chocolat', candy: 'bonbon',
  pizza: 'pizza', hamburger: 'hamburger', sandwich: 'sandwich', fries: 'frites',
  salad: 'salade', soup: 'soupe', stew: 'ragoût', sauce: 'sauce',
  coffee: 'café', tea: 'thé', juice: 'jus', soda: 'soda', water: 'eau',
  almond: 'amande', walnut: 'noix', peanut: 'cacahuète', olive: 'olive',
  honey: 'miel', sugar: 'sucre', salt: 'sel', oil: 'huile',
  croissant: 'croissant', baguette: 'baguette', pancake: 'pancake', waffle: 'gaufre',
  sushi: 'sushi', ramen: 'ramen', kebab: 'kefta', taco: 'taco',
  steak: 'steak', salmon: 'saumon', shrimp: 'crevette', tuna: 'thon',
  mushroom: 'champignon', garlic: 'ail', ginger: 'gingembre',
  'ice cream': 'glace', dessert: 'dessert', pastry: 'pâtisserie',
  omelette: 'omelette', bacon: 'bacon', sausage: 'saucisse', ham: 'jambon',
  radish: 'radis', kale: 'chou frisé', zucchini: 'courgette', eggplant: 'aubergine',
  'sweet potato': 'patate douce', 'french fries': 'frites', turkey: 'dinde',
  sardine: 'sardine', shrimp: 'crevette', squid: 'calamar',
  tagine: 'tajine', harira: 'harira', msemen: 'msemen', harcha: 'harcha',
  baghrir: 'baghrir', pastilla: 'pastilla', rfissa: 'rfissa',
  dates: 'dattes', figs: 'figues', olives: 'olives', almonds: 'amandes',
  walnuts: 'noix', pistachios: 'pistaches', cashews: 'noix de cajou',
  hummus: 'houmous', falafel: 'falafel', shawarma: 'shawarma',
  naan: 'pain naan', curry: 'curry', biryani: 'riz biryani',
  crepe: 'crêpe', brioche: 'brioche', muffin: 'muffin', donut: 'beignet',
};

function translateFoodName(enName) {
  const lower = enName.toLowerCase();
  if (EN_FR_FOOD[lower]) return EN_FR_FOOD[lower];
  for (const [en, fr] of Object.entries(EN_FR_FOOD)) {
    if (lower.includes(en) || en.includes(lower)) return fr;
  }
  return enName;
}

/** Map Clarifai results to local food DB */
export function mapToLocalFoods(clarifaiResults, allFoods) {
  const foods = Object.values(allFoods);

  return clarifaiResults.map(result => {
    const enName = result.name.toLowerCase();
    const frName = translateFoodName(enName).toLowerCase();

    let best = null, bestScore = 0;

    for (const f of foods) {
      const fn = f.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const frNorm = frName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      let score = 0;
      if (fn.includes(frNorm) || frNorm.includes(fn)) score = frNorm.length + fn.length;
      else if (fn.includes(enName) || enName.includes(fn)) score = enName.length + fn.length;

      if (score > bestScore) { bestScore = score; best = f; }
    }

    return {
      ...result,
      nameFr: translateFoodName(result.name),
      localFood: best,
      mapped: best != null,
    };
  });
}
