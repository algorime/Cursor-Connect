import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [svelte({ compilerOptions: { compatibility: { componentApi: 4 } } })],
	build: {
		emptyOutDir: true,
		manifest: true,
		outDir: 'dist',
		rollupOptions: {
			input: 'src/main.ts',
			output: {
				entryFileNames: 'assets/dashboard.js',
				chunkFileNames: 'assets/[name].js',
				assetFileNames: 'assets/[name][extname]'
			}
		}
	}
});
