import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  plugins: [react()],
  base: './',
  root: __dirname,
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist/electron/renderer'),
    emptyOutDir: true,
    assetsInlineLimit: 0, // Ensure all assets are copied as files
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  define: {
    // It's generally safer to avoid defining 'process' for the renderer.
    // If you need environment variables, use Vite's import.meta.env
    // 'process.env': {}, // Avoid this
  },
  server: {
    port: 5173, 
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});