import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveApiBundlePaths } from '../src/runtime/process-spawner.js';

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
