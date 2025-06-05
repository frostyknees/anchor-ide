// vite.main.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'dist/electron/main.ts', //
      formats: ['es'],          //
      fileName: () => 'main.js'  //
    },
    outDir: 'dist/electron',     //
    emptyOutDir: true,           //
                                 // Note: If preload also outputs to 'dist/electron' and isn't cleared first by another step,
                                 // and electron-vite builds main AFTER preload, this could clear preload.
                                 // Your vite.preload.config.ts has emptyOutDir: false, which is safer if they share outDir.
    rollupOptions: {
      external: [ // These were missing in your latest vite.main.config.ts
        'electron',
        '@lydell/node-pty',
        'path',
        'fs',
        'os',
        'child_process',
        'util',
      ],
    },
    minify: process.env.NODE_ENV === 'production', // Good practice
    commonjsOptions: { // From your earlier, more complete config
      transformMixedEsModules: true,
    },
  }
});