import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceBundleDir = path.resolve(extensionRoot, '../api/bundle');
const targetBundleDir = path.join(extensionRoot, 'api/bundle');
const entryFile = path.join(sourceBundleDir, 'main.cjs');

if (!fs.existsSync(entryFile)) {
	console.error('API bundle missing. Run pnpm --filter @codex-auth-ext/api build first.');
	process.exit(1);
}

fs.rmSync(targetBundleDir, { recursive: true, force: true });
fs.mkdirSync(targetBundleDir, { recursive: true });

for (const file of fs.readdirSync(sourceBundleDir)) {
	fs.copyFileSync(path.join(sourceBundleDir, file), path.join(targetBundleDir, file));
}

console.log(`Staged API bundle at ${targetBundleDir}`);
