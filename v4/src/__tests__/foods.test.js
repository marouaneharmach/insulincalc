import { describe, it, expect } from 'vitest';
import FOOD_DB from '../data/foods';
import { QTY_PROFILES } from '../data/constants';

// ─── TESTS BASE DE DONNÉES ALIMENTAIRE ───────────────────────────────────────

describe('Food Database', () => {
  const allFoods = Object.values(FOOD_DB).flat();

  it('contient au moins 10 catégories', () => {
    expect(Object.keys(FOOD_DB).length).toBeGreaterThanOrEqual(10);
  });

  it('contient au moins 200 aliments', () => {
    expect(allFoods.length).toBeGreaterThan(200);
  });

  it('chaque aliment a un id unique', () => {
    const ids = allFoods.map(f => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('chaque aliment a les champs requis', () => {
    allFoods.forEach(food => {
      expect(food).toHaveProperty('id');
      expect(food).toHaveProperty('name');
      expect(food).toHaveProperty('unit');
      expect(food).toHaveProperty('carbs');
      expect(food).toHaveProperty('fat');
      expect(food).toHaveProperty('gi');
      expect(food).toHaveProperty('qty');
      expect(typeof food.carbs).toBe('number');
      expect(food.carbs).toBeGreaterThanOrEqual(0);
    });
  });

  it('fat est une valeur valide', () => {
    const validFat = ['aucun', 'faible', 'moyen', 'élevé'];
    allFoods.forEach(food => {
      expect(validFat).toContain(food.fat);
    });
  });

  it('gi est une valeur valide', () => {
    const validGI = ['faible', 'moyen', 'élevé'];
    allFoods.forEach(food => {
      expect(validGI).toContain(food.gi);
    });
  });

  it('qty référence un profil existant dans QTY_PROFILES', () => {
    const validQty = Object.keys(QTY_PROFILES);
    allFoods.forEach(food => {
      expect(validQty).toContain(food.qty);
    });
  });
});

// ─── V4.2 : CATÉGORIES KETO ─────────────────────────────────────────────────

describe('[V4.2] Catégorie Keto', () => {
  it('catégorie Keto existe', () => {
    const ketoKey = Object.keys(FOOD_DB).find(k => k.includes('Keto'));
    expect(ketoKey).toBeDefined();
  });

  it('aliments keto ont ≤ 6g glucides', () => {
    const ketoKey = Object.keys(FOOD_DB).find(k => k.includes('Keto'));
    const ketoFoods = FOOD_DB[ketoKey];
    expect(ketoFoods.length).toBeGreaterThan(10);
    ketoFoods.forEach(food => {
      expect(food.carbs).toBeLessThanOrEqual(6);
    });
  });

  it('aliments keto sont majoritairement fat élevé', () => {
    const ketoKey = Object.keys(FOOD_DB).find(k => k.includes('Keto'));
    const ketoFoods = FOOD_DB[ketoKey];
    const highFat = ketoFoods.filter(f => f.fat === 'élevé');
    expect(highFat.length).toBeGreaterThan(ketoFoods.length * 0.6);
  });

  it('aliments keto sont IG faible', () => {
    const ketoKey = Object.keys(FOOD_DB).find(k => k.includes('Keto'));
    const ketoFoods = FOOD_DB[ketoKey];
    ketoFoods.forEach(food => {
      expect(food.gi).toBe('faible');
    });
  });
});

// ─── V4.2 : SALADES MAROCAINES ───────────────────────────────────────────────

describe('[V4.2] Catégorie Salades marocaines', () => {
  it('catégorie Salades marocaines existe', () => {
    const key = Object.keys(FOOD_DB).find(k => k.includes('Salades marocaines'));
    expect(key).toBeDefined();
  });

  it('contient au moins 8 salades', () => {
    const key = Object.keys(FOOD_DB).find(k => k.includes('Salades marocaines'));
    expect(FOOD_DB[key].length).toBeGreaterThanOrEqual(8);
  });

  it('salade marocaine classique est présente', () => {
    const key = Object.keys(FOOD_DB).find(k => k.includes('Salades marocaines'));
    const classic = FOOD_DB[key].find(f => f.id === 'sld_marocaine');
    expect(classic).toBeDefined();
    expect(classic.carbs).toBeLessThan(10);
  });
});

// ─── NON-RÉGRESSION : Catégories existantes ──────────────────────────────────

describe('[NON-RÉGRESSION] Catégories v4.1 préservées', () => {
  it('Pains & Céréales existe toujours', () => {
    expect(Object.keys(FOOD_DB).some(k => k.includes('Pains'))).toBe(true);
  });

  it('Tajines existe toujours', () => {
    expect(Object.keys(FOOD_DB).some(k => k.includes('Tajines'))).toBe(true);
  });

  it('khobz existe toujours', () => {
    const allFoods = Object.values(FOOD_DB).flat();
    expect(allFoods.find(f => f.id === 'khobz_t')).toBeDefined();
  });

  it('harira existe toujours', () => {
    const allFoods = Object.values(FOOD_DB).flat();
    expect(allFoods.find(f => f.id === 'harira')).toBeDefined();
  });

  it('Fast food existe toujours', () => {
    expect(Object.keys(FOOD_DB).some(k => k.includes('Fast food'))).toBe(true);
  });
});
