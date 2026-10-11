import { test, expect, type Page } from '@playwright/test';

/**
 * Reconnaissance photo des repas.
 * - Le premier test simule OpenRouter (aucune clé réelle) : il vérifie le parcours complet de l'interface,
 *   l'URL, les en-têtes et le modèle envoyés. Il tourne dans la CI normale.
 * - Les tests « réels » ne tournent que lorsque AI_SMOKE=1 (workflow ai-smoke.yml) : le build est alors
 *   produit avec la clé fournie par les secrets GitHub et l'appel part vraiment vers OpenRouter.
 */
const FIXTURE = 'e2e/fixtures/pizza.jpg';
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const REAL = process.env.AI_SMOKE === '1';

async function completeOnboarding(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Suivant/i }).click();
  await page.getByRole('button', { name: /Suivant/i }).click();
  await page.getByText(/Je comprends que cet outil/i).click();
  await page.getByRole('button', { name: /Terminer|Commencer/i }).click();
  await expect(page.getByRole('button', { name: /Analyser/i })).toBeVisible();
}

async function uploadMealPhoto(page: Page) {
  // Mode « Base alimentaire » (assisté) : recherche d'aliments et boutons photo.
  await page.getByRole('button', { name: /Base alimentaire/i }).click();
  await expect(page.getByRole('button', { name: /Choisir depuis l.album/i })).toBeVisible();
  // L'entrée « album » est l'input fichier sans attribut capture (caché, pilotable par Playwright).
  await page.locator('input[type="file"]:not([capture])').setInputFiles(FIXTURE);
}

test.describe('Reconnaissance photo (OpenRouter simulé)', () => {
  test('parcours complet avec clé saisie sur l’appareil et réponse simulée', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('insulincalc_v4_groqApiKey', JSON.stringify('sk-or-v1-e2e-simulee'));
    });
    let captured: { headers: Record<string, string>; body: { model?: string; messages?: unknown[] } } | null = null;
    await page.route(OPENROUTER, async (route) => {
      const req = route.request();
      captured = { headers: req.headers(), body: req.postDataJSON() };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ foods: [
            { name: 'pizza margherita', nameFr: 'Pizza margherita', confidence: 92, estimatedCarbs: 48, estimatedFat: 14, estimatedWeight: 260, estimatedGI: 'élevé' },
            { name: 'green salad', nameFr: 'Salade verte', confidence: 70, estimatedCarbs: 4, estimatedFat: 6, estimatedWeight: 90, estimatedGI: 'faible' },
          ] }) } }],
        }),
      });
    });

    await completeOnboarding(page);
    await uploadMealPhoto(page);

    await expect(page.getByText(/aliment\(s\) détecté\(s\)/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Pizza margherita/i }).first()).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    expect(captured).not.toBeNull();
    const c = captured!;
    expect(c.headers['authorization']).toBe('Bearer sk-or-v1-e2e-simulee');
    expect(c.headers['x-title']).toBe('InsulinCalc');
    expect(c.body.model).toBe('meta-llama/llama-4-scout');
    expect(Array.isArray(c.body.messages)).toBe(true);
  });
});

test.describe('Reconnaissance photo (OpenRouter réel, workflow ai-smoke)', () => {
  test.skip(!REAL, 'Réservé au workflow ai-smoke : AI_SMOKE=1 et clé fournie par les secrets GitHub');
  test.setTimeout(180_000);

  test('Réglages indique une clé fournie par l’environnement de build', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('button', { name: /Réglages/i }).click();
    await page.getByRole('button', { name: /Sauvegarde/i }).click();
    const status = page.getByRole('status').filter({ hasText: /Clé/i }).first();
    await expect(status).toContainText(/environnement de build/i);
    await expect(status).toContainText(/OpenRouter|Groq/);
    await expect(page.getByLabel(/Clé API IA/i)).toHaveValue('');
  });

  test('une photo de pizza est reconnue par le fournisseur', async ({ page }) => {
    await completeOnboarding(page);
    await uploadMealPhoto(page);

    const results = page.getByText(/aliment\(s\) détecté\(s\)/i);
    const empty = page.getByText(/Aucun aliment reconnu/i);
    const error = page.getByRole('alert');
    await expect(results.or(empty).or(error).first()).toBeVisible({ timeout: 120_000 });

    await expect(error, 'le fournisseur a renvoyé une erreur').toHaveCount(0);
    await expect(results, 'aucun aliment reconnu sur la photo de test').toBeVisible();
    const names = await page.locator('button', { hasText: /g\b/ }).filter({ hasText: /pizza|salade|pain|tomate/i }).allInnerTexts();
    test.info().annotations.push({ type: 'aliments reconnus', description: names.join(' | ').replace(/\s+/g, ' ') });
    await expect(page.getByRole('button', { name: /pizza/i }).first(), 'la pizza doit figurer parmi les aliments reconnus').toBeVisible();
  });
});
