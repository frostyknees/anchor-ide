import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  root: __dirname,
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'renderer/assets/[name].js',
        chunkFileNames: 'renderer/assets/[name].[hash].js',
        assetFileNames: 'renderer/assets/[name].[ext]',
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