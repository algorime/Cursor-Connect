import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['dist/main.js'],
	outDir: 'bundle',
	format: 'cjs',
	target: 'node22',
	bundle: true,
	splitting: false,
	sourcemap: true,
	clean: true,
	outExtension: () => ({ js: '.cjs' }),
	noExternal: ['@codex-auth-ext/shared', 'fastify', 'sql.js']
});
