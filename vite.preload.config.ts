// vite.preload.config.ts
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'electron/preload.ts'), // Path to your preload script
      name: 'ElectronPreload',
      formats: ['es'],
      fileName: () => 'preload.js', // Ensure this outputs 'preload.js'
    },
    outDir: 'dist/electron', // Output to the same directory as main.js
    emptyOutDir: false, // Set to false if main.js is built to the same dir in a separate step
    rollupOptions: {
      external: ['electron'],
    },
    minify: false,
  },
});