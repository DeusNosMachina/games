// Rebuilds index.html, then runs every test file in this folder except the harness, in name order.
// Stops at the first failure. Usage from the repository root: node gut-feeling/tests/run-all.cjs
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function step(label, cmd, args) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`FAIL: ${label} (exit ${result.status ?? result.signal})`);
    process.exit(result.status || 1);
  }
}

step('build', 'python3', [path.join(__dirname, '..', 'build.py')]);
const tests = fs
  .readdirSync(__dirname)
  .filter(f => f.endsWith('.cjs') && f !== 'harness.cjs' && f !== 'run-all.cjs')
  .sort();
for (const file of tests) step(file, process.execPath, [path.join(__dirname, file)]);
console.log(`\nAll ${tests.length} test files passed.`);
