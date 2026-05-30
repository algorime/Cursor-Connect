import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.resolve(extensionRoot, '../web/dist');
const targetDir = path.join(extensionRoot, 'dashboard');
const manifest = path.join(sourceDir, '.vite/manifest.json');

if (!fs.existsSync(manifest)) {
	console.error('Dashboard build missing. Run pnpm --filter @codex-auth-ext/web build first.');
	process.exit(1);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Staged dashboard assets at ${targetDir}`);
