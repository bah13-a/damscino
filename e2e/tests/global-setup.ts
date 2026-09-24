import { request, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN } from './support';

/** Makes sure the super-administrator has the known E2E password (first login forces a change). */
export default async function globalSetup(config: FullConfig) {
  if (!process.env.E2E_APP_URL && !fs.existsSync(path.join(__dirname, '../../mobile/dist/index.html'))) {
    throw new Error("L'application mobile n'est pas construite pour les tests : lancer `npm run build:app` dans e2e/.");
  }
  const baseURL = config.projects[0].use.baseURL!;
  const api = await request.newContext({ baseURL });
  const login = (password: string) =>
    api.post('/api/auth/login', { data: { username: ADMIN.username, password, space: 'ADMIN' } });

  let response = await login(ADMIN.password);
  if (response.ok() && !(await response.json()).mustChangePassword) {
    await api.dispose();
    return;
  }
  const current = response.ok() ? ADMIN.password : ADMIN.initialPassword;
  response = response.ok() ? response : await login(ADMIN.initialPassword);
  if (!response.ok()) throw new Error(`Cannot log in as ${ADMIN.username}: ${response.status()} ${await response.text()}`);
  const { accessToken } = await response.json();
  const changed = await api.post('/api/auth/change-password', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { currentPassword: current, newPassword: ADMIN.password },
  });
  if (!changed.ok()) throw new Error(`Cannot set the E2E admin password: ${await changed.text()}`);
  await api.dispose();
}
