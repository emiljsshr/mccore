import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
const [configPath, action] = process.argv.slice(2);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configText = readFileSync(configPath, 'utf8');
for (const line of configText.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
}
const run = (args, cwd = root) => {
  const result = spawnSync(process.execPath, args, { cwd, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Provisioning command failed (${result.status}).`);
};
if (action === 'migrate') {
  run([resolve(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], resolve(root, 'packages/database'));
  run(['--import', 'tsx', resolve(root, 'packages/database/prisma/seed.ts')]);
} else {
  const { getPrismaClient } = await import('../packages/database/dist/index.js');
  const { ulid } = await import('../packages/contracts/dist/index.js');
  const prisma = getPrismaClient();
  try {
    if (action === 'enroll') {
      const statePath = resolve(process.env.AGENT_STATE_PATH, 'state.json');
      const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
      if (!state.nodeId) {
        const token = randomBytes(32).toString('hex');
        await prisma.enrollmentToken.create({ data: { id: ulid(), label: 'Local Node', tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 15 * 60_000) } });
        const lines = configText.split('\n').filter(line => !line.startsWith('AGENT_ENROLLMENT_TOKEN='));
        lines.push(`AGENT_ENROLLMENT_TOKEN=${token}`);
        writeFileSync(configPath, lines.join('\n'), { mode: 0o600 });
      }
    } else if (action === 'bootstrap') {
      if (await prisma.user.count() === 0) {
        const result = spawnSync(resolve(root, 'bin/mccore'), ['admin', 'bootstrap-code', 'rotate'], { env: process.env, stdio: 'inherit' });
        if (result.status !== 0) throw new Error('Bootstrap code generation failed.');
      } else console.log('Setup already completed; existing accounts were preserved.');
    } else throw new Error('Unknown provisioning action.');
  } finally { await prisma.$disconnect(); }
}
