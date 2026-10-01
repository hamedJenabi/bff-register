// Disposable browser-QA server: no operational DB, live Stripe or SendGrid key.
require('./register.cjs');
const { execFileSync, spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const postgres = require('postgres');
const net = require('node:net');
const http = require('node:http');
(async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'bff-reg2026-preview-'));
  const data = path.join(root, 'data');
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.on('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  let started = false, child;
  const checkout = http.createServer((req, res) => {
    const query = new URL(req.url, 'http://127.0.0.1').searchParams;
    const order = Number(query.get('order'));
    const amount = Number(query.get('amount'));
    const returnUrl = query.get('return');
    const safeReturn = returnUrl?.startsWith('http://localhost:31026/reg2026?')
      ? returnUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') : null;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Test checkout</title>
      <body style="font-family:system-ui;max-width:640px;margin:60px auto;padding:24px"><h1>Test checkout destination</h1>
      <p>The registration form redirected here automatically after submission.</p>
      <p>This local stand-in creates no payment and sends no email.</p>
      <p>Order ${Number.isSafeInteger(order) ? order : 'unknown'} · ${Number.isSafeInteger(amount) ? (amount / 100).toFixed(2) : 'unknown'} EUR</p>
      ${safeReturn ? `<a href="${safeReturn}">Return without paying</a>` : ''}</body></html>`);
  });
  await new Promise((resolve, reject) => { checkout.on('error', reject); checkout.listen(0, '127.0.0.1', resolve); });
  const checkoutOrigin = `http://127.0.0.1:${checkout.address().port}`;
  const cleanup = () => {
    if (child) child.kill('SIGTERM');
    checkout.close();
    if (started) {
      started = false;
      execFileSync('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
    }
    rmSync(root, { recursive: true, force: true });
  };
  try {
    execFileSync('initdb', ['-D', data, '-A', 'trust', '--no-locale', '-E', 'UTF8'], { stdio: 'pipe' });
    execFileSync('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-k ${root} -h 127.0.0.1 -p ${port}`, '-w', 'start'], { stdio: 'pipe' });
    started = true;
    const url = `postgres://${encodeURIComponent(os.userInfo().username)}@127.0.0.1:${port}/postgres`;
    const sql = postgres(url, { onnotice: () => {} });
    for (const file of ['00004-CREAT-registraion-2026', '00006-create-class-capacities-2026', '00007-create-reg2026-bookings', '00008-reg2026-order-safety']) {
      await sql.begin((tx) => require(`../migrations/${file}`).up(tx));
    }
    await sql`CREATE TABLE tickets_26 (id SERIAL, name TEXT, label TEXT, capacity INTEGER, waiting_list INTEGER)`;
    const people = await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country)
      VALUES ('2026','confirmed','advanced','fullpass','Demo','Dancer','demo+full@example.com','Austria'),
      ('2026','confirmed','advanced','partyPass','Party','Dancer','demo+party@example.com','Austria'),
      ('2026','confirmed','advanced','partyPass','Pending','Dancer','demo+pending@example.com','Austria'),
      ('2026','confirmed','advanced','partyPass','Complete','Dancer','demo+complete@example.com','Austria'),
      ('2026','confirmed','advanced','fullpass','Hamed','Demo','demo+classes@example.com','Austria') RETURNING *`;
    const store = require('../lib/reg2026/store').createRegistrationStore(sql);
    await store.submit(people[4], { classes: [{ sessionId: 'fri-1330-kantine', role: 'lead' },
      { sessionId: 'sat-1130-superar-1' }, { sessionId: 'sun-1130-ankersaal', role: 'follow' }],
      competitions: [], competitionRoles: {}, lunch: [] }, 'preview-classes-01');
    const paidDraft = { classes: [], competitions: ['solo_battle'], competitionRoles: {}, lunch: ['saturday'] };
    await store.submit(people[2], paidDraft, 'preview-pending-001');
    const confirmed = await store.submit(people[3], paidDraft, 'preview-complete-01');
    await store.attachSession(confirmed.id, 'cs_preview_complete');
    await store.applyPayment({ id: 'cs_preview_complete', amount_total: confirmed.total_cents, currency: 'eur',
      client_reference_id: String(people[3].id), metadata: { reg2026OrderId: String(confirmed.id) },
      status: 'complete', payment_status: 'paid' }, 'checkout.session.completed');
    await sql.end();
    const env = { ...process.env, DATABASE_URL: url, PGPORT: String(port), NODE_ENV: 'development', BFF_PREVIEW: 'true',
      REG2026_ENABLED: 'true', REG2026_SIGNING_SECRET: 'preview-only-signing-secret', REG2026_ORIGIN: 'http://localhost:31026',
      REG2026_CLOSES_AT: '2099-01-01T00:00:00Z', ADMIN_SESSION_SECRET: 'preview-only-admin-secret',
      ADMIN_USER: 'preview', HASHED_PASS: 'preview', STRIPE_SECRET_KEY: 'sk_test_preview_only', SENDGRID_API_KEY: '',
      PREVIEW_CHECKOUT_ORIGIN: checkoutOrigin,
      REG2026_CONFIRMATION_TEMPLATE_ID: '', REG2026_INVITATION_TEMPLATE_ID: '', REG2026_CATALOG_REVIEWED: 'false' };
    process.env.REG2026_SIGNING_SECRET = env.REG2026_SIGNING_SECRET;
    const { buildRegistrationPath } = require('../lib/reg2026/security');
    console.log('FULL_PASS_URL=http://localhost:31026' + buildRegistrationPath({ firstname: 'Demo', email: 'demo+full@example.com' }));
    console.log('PARTY_PASS_URL=http://localhost:31026' + buildRegistrationPath({ firstname: 'Party', email: 'demo+party@example.com' }));
    console.log('PENDING_URL=http://localhost:31026' + buildRegistrationPath({ firstname: 'Pending', email: 'demo+pending@example.com' }));
    console.log('COMPLETED_URL=http://localhost:31026' + buildRegistrationPath({ firstname: 'Complete', email: 'demo+complete@example.com' }));
    console.log('CLASSES_URL=http://localhost:31026' + buildRegistrationPath({ firstname: 'Hamed', email: 'demo+classes@example.com' }));
    console.log('TEST_CHECKOUT_ORIGIN=' + checkoutOrigin);
    child = spawn(process.execPath, ['--experimental-loader', path.join(__dirname, 'preview-loader.mjs'),
      'node_modules/next/dist/bin/next', 'dev', '-H', '127.0.0.1', '-p', '31026'], { env, stdio: 'inherit' });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { cleanup(); process.exit(0); });
    await new Promise((resolve) => child.on('exit', resolve));
  } finally { cleanup(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
