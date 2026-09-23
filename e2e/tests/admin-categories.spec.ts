import { expect, test } from '@playwright/test';
import { adminLogin, uid } from './support';

test.describe('Administration · catégories de la carte', () => {
  test('ajouter, protéger et supprimer une catégorie', async ({ page }) => {
    await adminLogin(page);
    await page.getByRole('link', { name: 'Catégories' }).first().click();
    for (const label of ['Plats', 'Boissons', 'Desserts', 'Entrées']) {
      await expect(page.getByRole('listitem').filter({ hasText: label }).first()).toBeVisible();
    }

    const label = `Grillades ${uid()}`;
    await page.getByLabel('Libellé').fill(label);
    await page.getByRole('button', { name: 'Ajouter' }).click();
    const item = page.getByRole('listitem').filter({ hasText: label });
    await expect(item).toContainText(label.toUpperCase().replace(' ', '_'));

    // une catégorie utilisée par une règle ne peut pas être supprimée
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('listitem').filter({ has: page.getByText('PLATS', { exact: true }) }).getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveText(
      "Cette catégorie est utilisée par la règle d'un partenaire",
    );

    await item.getByRole('button', { name: 'Supprimer' }).click();
    await expect(item).toHaveCount(0);
  });
});
