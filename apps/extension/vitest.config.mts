import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const extensionRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		testTimeout: 30_000
	},
	resolve: {
		alias: {
			'@codex-auth-ext/api/server': path.resolve(extensionRoot, '../api/src/server.ts')
		},
		extensions: ['.ts', '.js', '.json']
	}
});
