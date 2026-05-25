import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	outDir: 'lib',
	format: ['esm', 'cjs'],
	target: 'node22',
	dts: true,
	sourcemap: true,
	clean: true
});
