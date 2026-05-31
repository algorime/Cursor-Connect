import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionRoot = path.join(repoRoot, 'apps/extension');
const extensionPackage = JSON.parse(
	fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8')
);
const vsixName = `codex-auth-ext-${extensionPackage.version}.vsix`;
const vsixPath = path.join(extensionRoot, vsixName);

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd ?? repoRoot,
			stdio: 'inherit',
			shell: false,
			...options
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
		});
	});
}

console.log('Building monorepo…');
await run('pnpm', ['run', 'build'], { cwd: repoRoot });

console.log(`Packaging ${vsixName}…`);
await run(
	'pnpm',
	[
		'dlx',
		'@vscode/vsce',
		'package',
		'--no-dependencies',
		'-o',
		vsixName
	],
	{ cwd: extensionRoot }
);

if (!fs.existsSync(vsixPath)) {
	throw new Error(`Expected VSIX at ${vsixPath}`);
}

const cursorBin = process.env.CURSOR_CLI ?? 'cursor';
console.log(`Installing into Cursor (${cursorBin})…`);
await run(cursorBin, ['--install-extension', vsixPath, '--force']);

console.log('');
console.log('Done. Reload the main Cursor window: Developer: Reload Window');
