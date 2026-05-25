import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { NodeProcessSpawner, resolveApiBundlePaths } from '../src/runtime/process-spawner.js';

describe('resolveApiBundlePaths', () => {
	it('prefers the packaged bundle under the extension install path', () => {
		const extensionPath = path.join(os.tmpdir(), 'codex-auth-ext-packaged');
		const packagedBundle = path.join(extensionPath, 'api/bundle/main.cjs');

		fs.mkdirSync(path.dirname(packagedBundle), { recursive: true });
		fs.writeFileSync(packagedBundle, 'module.exports = {};\n');

		try {
			const paths = resolveApiBundlePaths(extensionPath, false);

			expect(paths.apiEntryPath).toBe(packagedBundle);
			expect(paths.cwd).toBe(path.join(extensionPath, 'api/bundle'));
		} finally {
			fs.rmSync(path.join(extensionPath, 'api'), { recursive: true, force: true });
		}
	});
});

describe('NodeProcessSpawner', () => {
	it('forwards API child stdout to the extension host stdout', async () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-auth-ext-spawner-'));
		const scriptPath = path.join(tempDir, 'child.cjs');
		const lines: string[] = [];
		const originalWrite = process.stdout.write.bind(process.stdout);

		fs.writeFileSync(scriptPath, 'process.stdout.write("api child visible\\n");\n');
		process.stdout.write = ((chunk: string | Uint8Array) => {
			lines.push(String(chunk));
			return true;
		}) as typeof process.stdout.write;

		try {
			const processHandle = new NodeProcessSpawner(scriptPath, tempDir).spawn({
				runtimePath: process.execPath,
				env: process.env
			});

			const exit = await processHandle.onExit;

			expect(exit.code).toBe(0);
			expect(lines.join('')).toContain('api child visible');
		} finally {
			process.stdout.write = originalWrite;
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
