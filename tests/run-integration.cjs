const { execFileSync, spawnSync } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
(async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "bff-reg2026-tests-"));
  const data = path.join(root, "data");
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.on("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  let started = false;
  try {
    execFileSync("initdb", ["-D", data, "-A", "trust", "--no-locale", "-E", "UTF8"], { stdio: "pipe" });
    execFileSync("pg_ctl", ["-D", data, "-l", path.join(root, "postgres.log"), "-o", `-k ${root} -h 127.0.0.1 -p ${port}`, "-w", "start"], { stdio: "pipe" });
    started = true;
    const result = spawnSync(process.execPath, ["-r", "./tests/register.cjs", "--test", "tests/reg2026-integration.test.cjs"], {
      stdio: "inherit", env: { ...process.env, TEST_DATABASE_URL: `postgres://${encodeURIComponent(os.userInfo().username)}@127.0.0.1:${port}/postgres` },
    });
    process.exitCode = result.status || (result.error ? 1 : 0);
  } finally {
    if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(root, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
