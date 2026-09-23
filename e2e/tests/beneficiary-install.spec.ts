import { expect, test } from '@playwright/test';
import { Api, beneficiaryLogin, readyBeneficiary } from './support';

test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });

test("sur iPhone, l'espace explique l'ajout à l'écran d'accueil", async ({ page, request }) => {
  const b = await readyBeneficiary(new Api(request));
  await beneficiaryLogin(page, b.credentials.phone, b.password);
  const hint = page.getByText("Ajoutez Privilèges à votre écran d'accueil");
  await expect(hint).toBeVisible();
  await expect(page.getByText("Sur l'écran d'accueil")).toBeVisible();
  await page.getByRole('button', { name: 'Masquer' }).click();
  await expect(hint).toBeHidden();
  await page.reload();
  await expect(page.getByText('Disponible')).toBeVisible();
  await expect(hint).toBeHidden();
});
