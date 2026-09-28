// Load test of Damascino Privilèges through the public entry point (site + /api proxy + gateway + services).
//   node perf/load-test.mjs                      (stack on http://localhost:3000)
//   PERF_BASE_URL=https://… PERF_USERS=200 node perf/load-test.mjs
// Creates its own partner, beneficiaries and till accounts, then measures each scenario:
// latency percentiles, throughput, error rate, and checks the business result under load.
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.PERF_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const USERS = Number(process.env.PERF_USERS ?? 100);
const TILLS = Number(process.env.PERF_TILLS ?? 10);
const DURATION = Number(process.env.PERF_DURATION ?? 20); // seconds per read scenario
const ADMIN_USER = process.env.E2E_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin-E2E-2026';
const OUT = process.env.PERF_OUT ?? path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'perf-results');
const APP = { 'X-Client-App': 'damascino-mobile/perf' };
const run = Math.random().toString(36).slice(2, 7);

// ─── HTTP ────────────────────────────────────────────────────────────────────────────
async function call(method, url, { token, body, form } = {}) {
  const headers = { ...APP };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const start = performance.now();
  let status = 0;
  let data = null;
  try {
    const response = await fetch(BASE + url, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
    status = response.status;
    const text = await response.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  } catch (e) {
    data = String(e);
  }
  return { status, data, ms: performance.now() - start };
}
async function ok(method, url, options) {
  const r = await call(method, url, options);
  if (r.status < 200 || r.status >= 300) throw new Error(`${method} ${url} → ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
  return r.data;
}

// ─── measurement ─────────────────────────────────────────────────────────────────────
const results = [];
function summarize(name, samples, wallSeconds, extra = {}) {
  const times = samples.map((s) => s.ms).sort((a, b) => a - b);
  const pct = (p) => (times.length ? times[Math.min(times.length - 1, Math.ceil((p / 100) * times.length) - 1)] : 0);
  const errors = samples.filter((s) => !s.ok).length;
  const r = {
    name, requests: samples.length, errors, errorRate: samples.length ? errors / samples.length : 0,
    throughput: samples.length / wallSeconds, p50: pct(50), p95: pct(95), p99: pct(99), max: times.at(-1) ?? 0,
    mean: times.reduce((a, b) => a + b, 0) / (times.length || 1), ...extra,
  };
  results.push(r);
  console.log(`${name.padEnd(46)} ${String(r.requests).padStart(6)} req  ${r.throughput.toFixed(1).padStart(7)} req/s  p50 ${r.p50.toFixed(0).padStart(5)} ms  p95 ${r.p95.toFixed(0).padStart(5)} ms  p99 ${r.p99.toFixed(0).padStart(5)} ms  err ${(r.errorRate * 100).toFixed(2)} %`);
  return r;
}
/** `concurrency` virtual users call `task` in a loop for `seconds`. */
async function forDuration(name, concurrency, seconds, task, extra) {
  const samples = [];
  const end = Date.now() + seconds * 1000;
  const start = Date.now();
  await Promise.all(Array.from({ length: concurrency }, async (_, vu) => {
    let i = 0;
    while (Date.now() < end) samples.push(await task(vu, i++));
  }));
  return summarize(name, samples, (Date.now() - start) / 1000, { concurrency, ...extra });
}
/** Runs `items` through `task` with at most `concurrency` in flight. */
async function forEach(name, items, concurrency, task, extra) {
  const samples = [];
  let next = 0;
  const start = Date.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const item = items[next++];
      samples.push(await task(item));
    }
  }));
  return summarize(name, samples, (Date.now() - start) / 1000, { concurrency, ...extra });
}
const sample = (r, expected = (s) => s >= 200 && s < 300) => ({ ms: r.ms, ok: expected(r.status), status: r.status });

// ─── scenario ────────────────────────────────────────────────────────────────────────
console.log(`Damascino Privilèges — test de charge sur ${BASE} (${USERS} bénéficiaires, ${TILLS} caisses, ${DURATION} s par scénario)\n`);
const admin = (await ok('POST', '/api/auth/login', { body: { username: ADMIN_USER, password: ADMIN_PASSWORD, space: 'ADMIN' } })).accessToken;
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const partner = await ok('POST', '/api/partners', {
  token: admin,
  body: { name: `Perf ${run}`, contactName: 'Test de charge', conventionStart: iso(new Date(today - 30 * 864e5)), conventionEnd: iso(new Date(+today + 180 * 864e5)) },
});

// 1. import of the list (one request)
const phones = Array.from({ length: USERS }, (_, i) => `9${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`.slice(0, 8));
const unique = [...new Set(phones)];
const csv = 'Nom;Prénom;Téléphone\n' + unique.map((p, i) => `Charge${run};Utilisateur${i};${p}`).join('\n');
const form = new FormData();
form.append('file', new Blob([csv], { type: 'text/csv' }), 'perf.csv');
const imported = await call('POST', `/api/partners/${partner.id}/beneficiaries/import`, { token: admin, form });
if (imported.status !== 200) throw new Error(`import → ${imported.status} ${JSON.stringify(imported.data)}`);
summarize(`Import Excel/CSV de ${imported.data.created.length} bénéficiaires`, [sample(imported)], imported.ms / 1000);
const users = imported.data.created.map((c) => ({ phone: c.phone, temp: c.temporaryPassword, password: 'Perf-2026-pass' }));

// 2. till accounts
const tills = [];
for (let i = 0; i < TILLS; i++) {
  const username = `perf${run}c${i}`;
  await ok('POST', '/api/accounts', { token: admin, body: { role: 'STAFF', username, displayName: `Caisse perf ${i}`, secret: '4826' } });
  tills.push({ username });
}

// 3. first login + mandatory password change (waits for the accounts to reach identity-service)
await new Promise((resolve) => setTimeout(resolve, 3000));
await forEach('Première connexion + nouveau mot de passe', users, 10, async (u) => {
  let login;
  for (let attempt = 0; attempt < 20; attempt++) {
    login = await call('POST', '/api/auth/login', { body: { username: u.phone, password: u.temp, space: 'BENEFICIARY' } });
    if (login.status === 200) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const change = await call('POST', '/api/auth/change-password', { token: login.data?.accessToken, body: { currentPassword: u.temp, newPassword: u.password } });
  u.token = change.data?.accessToken;
  return { ms: login.ms + change.ms, ok: change.status === 200 };
});

// 4. login (bcrypt): every beneficiary signs in once; the last token is kept
await forEach('Connexion bénéficiaire (mot de passe)', users, 10, async (u) => {
  const r = await call('POST', '/api/auth/login', { body: { username: u.phone, password: u.password, space: 'BENEFICIARY' } });
  if (r.status === 200) u.token = r.data.accessToken;
  return sample(r);
});
await forEach('Connexion personnel de caisse (PIN)', tills, 10, async (t) => {
  const r = await call('POST', '/api/auth/login', { body: { username: t.username, password: '4826', space: 'STAFF' } });
  if (r.status === 200) t.token = r.data.accessToken;
  return sample(r);
});
// wait until every beneficiary is known by privilege-service
for (const u of users) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if ((await call('GET', '/api/privileges/me', { token: u.token })).data?.availability === 'AVAILABLE') break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

// 5. read scenarios
const pick = (vu, i) => users[(vu * 7 + i) % users.length];
await forDuration('Espace bénéficiaire (GET /privileges/me)', 20, DURATION, async (vu, i) => sample(await call('GET', '/api/privileges/me', { token: pick(vu, i).token })));
await forDuration('QR code du jour (POST /privileges/qr)', 20, DURATION, async (vu, i) => sample(await call('POST', '/api/privileges/qr', { token: pick(vu, i).token })));
const PEAK = Number(process.env.PERF_PEAK ?? 50);
await forDuration(`Pic : ${PEAK} utilisateurs simultanés sur /me`, PEAK, Math.max(10, DURATION / 2), async (vu, i) => sample(await call('GET', '/api/privileges/me', { token: pick(vu, i).token })));
await forDuration('Admin : statistiques du tableau de bord', 5, Math.max(10, DURATION / 2), async () => sample(await call('GET', '/api/reporting/statistics', { token: admin })));
await forDuration('Admin : recherche de bénéficiaires', 5, Math.max(10, DURATION / 2), async (vu, i) => sample(await call('GET', `/api/beneficiaries?q=utilisateur${(vu + i) % 50}&size=25`, { token: admin })));

// 6. till rush: every beneficiary goes through a till (QR → verify → confirm), TILLS tills in parallel
const flow = { qr: [], verify: [], confirm: [] };
let confirmed = 0;
const rush = await forEach(`Passage en caisse complet (${TILLS} caisses en parallèle)`, users.map((u, i) => ({ u, till: tills[i % tills.length] })), TILLS, async ({ u, till }) => {
  const qr = await call('POST', '/api/privileges/qr', { token: u.token });
  flow.qr.push(qr.ms);
  const verify = await call('POST', '/api/privileges/scan/verify', { token: till.token, body: { token: qr.data?.token } });
  flow.verify.push(verify.ms);
  const confirm = await call('POST', '/api/privileges/scan/confirm', { token: till.token, body: { token: qr.data?.token, dishPrice: 40 } });
  flow.confirm.push(confirm.ms);
  const good = verify.data?.status === 'VALID' && confirm.data?.status === 'CONFIRMED';
  if (good) confirmed++;
  return { ms: qr.ms + verify.ms + confirm.ms, ok: good };
});
const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.ceil(0.95 * xs.length) - 1] ?? 0;
rush.steps = { qrP95: p95(flow.qr), verifyP95: p95(flow.verify), confirmP95: p95(flow.confirm) };
console.log(`   étapes p95 : QR ${rush.steps.qrP95.toFixed(0)} ms · vérification ${rush.steps.verifyP95.toFixed(0)} ms · confirmation ${rush.steps.confirmP95.toFixed(0)} ms · ${confirmed}/${users.length} passages confirmés`);

// 7. double spending under load: the same QR code presented at 5 tills at once
const doubles = [];
// allow more passages per day so that the same beneficiaries can come back (the rule reaches privilege-service by event)
await ok('PUT', `/api/partners/${partner.id}/rule`, { token: admin, body: { discountPercent: 20, eligibleCategories: ['PLATS'], excludedCategories: [], usagesPerPeriod: 5, usagePeriod: 'DAY' } });
for (const u of users.slice(0, 10)) {
  let qr;
  for (let attempt = 0; attempt < 40; attempt++) {
    qr = await call('POST', '/api/privileges/qr', { token: u.token });
    if (qr.status === 200) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (qr.status !== 200) continue;
  const answers = await Promise.all(tills.slice(0, 5).map((t) => call('POST', '/api/privileges/scan/confirm', { token: t.token, body: { token: qr.data.token, dishPrice: 30 } })));
  doubles.push(answers.filter((a) => a.data?.status === 'CONFIRMED').length);
}

// 8. read model consistency: the reporting service must end up with every passage
const reportingStart = Date.now();
let reported = 0;
const expectedRedemptions = confirmed + doubles.filter((n) => n === 1).length;
for (let attempt = 0; attempt < 120; attempt++) {
  reported = (await ok('GET', `/api/reporting/statistics?partnerId=${partner.id}`, { token: admin })).totals.redemptions;
  if (reported >= expectedRedemptions) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
const convergence = (Date.now() - reportingStart) / 1000;

const checks = [
  { name: 'Tous les passages de la ruée en caisse sont confirmés', ok: confirmed === users.length, detail: `${confirmed}/${users.length}` },
  { name: 'Un même QR présenté à 5 caisses simultanément : un seul passage', ok: doubles.length > 0 && doubles.every((n) => n === 1), detail: `${doubles.filter((n) => n === 1).length}/${doubles.length} QR avec exactement 1 confirmation` },
  { name: 'Le reporting retrouve tous les passages', ok: reported === expectedRedemptions, detail: `${reported}/${expectedRedemptions} en ${convergence.toFixed(1)} s` },
  ...results.filter((r) => r.requests > 1).map((r) => ({ name: `Taux d'erreur < 1 % — ${r.name}`, ok: r.errorRate < 0.01, detail: `${(r.errorRate * 100).toFixed(2)} %` })),
];
console.log('\nContrôles :');
for (const c of checks) console.log(`  ${c.ok ? '✔' : '✘'} ${c.name} (${c.detail})`);

fs.mkdirSync(OUT, { recursive: true });
const report = { date: new Date().toISOString(), base: BASE, users: users.length, tills: TILLS, duration: DURATION, results, checks, convergenceSeconds: convergence };
fs.writeFileSync(path.join(OUT, 'load-test.json'), JSON.stringify(report, null, 2));
console.log(`\nRésultats : ${path.join(OUT, 'load-test.json')}`);
process.exit(checks.every((c) => c.ok) ? 0 : 1);
