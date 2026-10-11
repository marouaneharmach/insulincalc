import { test, expect, type Page } from '@playwright/test';

async function completeOnboarding(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Suivant/i }).click();
  await page.getByRole('button', { name: /Suivant/i }).click();
  await page.getByText(/Je comprends que cet outil/i).click();
  await page.getByRole('button', { name: /Commencer/i }).click();
  await expect(page.getByRole('button', { name: /Analyser/i })).toBeVisible();
}

test.describe('InsulinCalc v7', () => {
  test('onboarding → consultation → journal', async ({ page }) => {
    await completeOnboarding(page);
    const glyc = page.getByPlaceholder('1.10');
    await glyc.fill('1.45');
    await page.getByRole('button', { name: /Glucides/i }).first().click();
    await page.getByPlaceholder('0').first().fill('60');
    await page.getByRole('button', { name: /Analyser/i }).click();
    await expect(page.getByText(/Recommandation/i).first()).toBeVisible();
    await expect(page.getByText(/Injecter/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Confirmer/i }).click();
    await expect(page.getByText(/Dose réellement prise/i)).toBeVisible();
    await expect(page.getByText(/Aujourd/i).first()).toBeVisible();
  });

  test('hypoglycémie : parcours bloqué et resucrage', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByPlaceholder('1.10').fill('0.62');
    await expect(page.getByText(/Traitement de l'hypoglycémie/i)).toBeVisible();
    await page.getByRole('button', { name: /lancer le minuteur/i }).click();
    await expect(page.getByText(/Resucrage enregistré/i)).toBeVisible();
    await page.getByRole('button', { name: /Journal/i }).click();
    await expect(page.getByText(/Hypoglycémie traitée/i)).toBeVisible();
  });

  test('rapports et réglages accessibles, bascule en arabe', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('button', { name: /Rapports/i }).click();
    await expect(page.getByRole('heading', { name: /Rapports glycémiques/i })).toBeVisible();
    await page.getByRole('button', { name: /Réglages/i }).click();
    await page.getByRole('button', { name: /Sécurité/i }).click();
    await expect(page.getByText(/Plafond de dose/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Apparence/i }).click();
    await page.getByRole('button', { name: /العربية|Arabe/i }).click();
    await expect(page.locator('html, [dir="rtl"]').first()).toBeVisible();
    await expect(page.getByText(/الإعدادات|التقارير/).first()).toBeVisible();
  });

  test('données persistées après rechargement', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('button', { name: /Journal/i }).click();
    await page.getByRole('button', { name: /Saisie rapide/i }).click();
    await page.getByLabel(/Glycémie/i).first().fill('1.33');
    await page.getByRole('button', { name: /^Enregistrer$/i }).click();
    await expect(page.getByText('1.33 g/L')).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: /Journal/i }).click();
    await expect(page.getByText('1.33 g/L')).toBeVisible();
  });
});
