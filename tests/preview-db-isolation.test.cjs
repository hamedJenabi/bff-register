const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");

const script = `
  const { sql } = require('./db/db');
  (async () => {
    const [row] = await sql\`SELECT current_database() AS name\`;
    console.log(row.name);
    await sql.end();
  })().catch((error) => { console.error(error.message); process.exitCode = 1; });
`;

test("preview database ignores normal database settings and fails closed without its own URL", { skip: !process.env.TEST_DATABASE_URL }, () => {
  const conflicting = {
    ...process.env,
    BFF_PREVIEW: "true",
    NODE_ENV: "development",
    DATABASE_URL: "postgres://wrong@127.0.0.1:1/wrong",
    PGHOST: "127.0.0.1",
    PGPORT: "1",
    PGDATABASE: "wrong",
  };
  const isolated = spawnSync(process.execPath, ["-r", "./tests/register.cjs", "-e", script], {
    cwd: process.cwd(), encoding: "utf8",
    env: { ...conflicting, BFF_PREVIEW_DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
  assert.equal(isolated.status, 0, isolated.stderr);
  assert.equal(isolated.stdout.trim(), "postgres");

  const missing = spawnSync(process.execPath, ["-r", "./tests/register.cjs", "-e", "require('./db/db')"], {
    cwd: process.cwd(), encoding: "utf8",
    env: { ...conflicting, BFF_PREVIEW_DATABASE_URL: "" },
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Preview database is not configured/);
});
