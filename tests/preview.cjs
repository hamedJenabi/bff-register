// Disposable browser-QA server: no operational DB, Stripe key or SendGrid key.
require('./register.cjs');
const { execFileSync, spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const postgres = require('postgres');
const net = require('node:net');
(async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'bff-reg2026-preview-'));
  const data = path.join(root, 'data');
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.on('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  let started = false, child;
  const cleanup = () => {
    if (child) child.kill('SIGTERM');
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
      ('2026','confirmed','advanced','partyPass','Complete','Dancer','demo+complete@example.com','Austria') RETURNING *`;
    const store = require('../lib/reg2026/store').createRegistrationStore(sql);
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
      ADMIN_USER: 'preview', HASHED_PASS: 'preview', STRIPE_SECRET_KEY: '', SENDGRID_API_KEY: '',
      REG2026_CONFIRMATION_TEMPLATE_ID: '', REG2026_INVITATION_TEMPLATE_ID: '', REG2026_CATALOG_REVIEWED: 'false' };
    process.env.REG2026_SIGNING_SECRET = env.REG2026_SIGNING_SECRET;
    const { buildRegistrationPath } = require('../lib/reg2026/security');
    console.log('FULL_PASS_URL=http://localhost:31026' + buildRegistrationPath({ firstname: 'Demo', email: 'demo+full@example.com' }));
    console.log('PARTY_PASS_URL=http://localhost:31026' + buildRegistrationPath({ firstname: 'Party', email: 'demo+party@example.com' }));
    console.log('PENDING_URL=http://localhost:31026' + buildRegistrationPath({ firstname: 'Pending', email: 'demo+pending@example.com' }));
    console.log('COMPLETED_URL=http://localhost:31026' + buildRegistrationPath({ firstname: 'Complete', email: 'demo+complete@example.com' }));
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-H', '127.0.0.1', '-p', '31026'], { env, stdio: 'inherit' });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { cleanup(); process.exit(0); });
    await new Promise((resolve) => child.on('exit', resolve));
  } finally { cleanup(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
