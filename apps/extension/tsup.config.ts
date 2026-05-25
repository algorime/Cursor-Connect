import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/extension.ts'],
	outDir: 'dist',
	format: 'cjs',
	target: 'node22',
	bundle: true,
	splitting: false,
	sourcemap: true,
	clean: true,
	noExternal: ['@codex-auth-ext/shared'],
	external: ['vscode']
});
