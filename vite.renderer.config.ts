import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './', 
  build: {
    outDir: 'dist/renderer', 
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      external: ['electron', 'path', 'fs', 'os', 'child_process', '@lydell/node-pty'], 
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