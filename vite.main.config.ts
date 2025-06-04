// vite.main.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      protocolImports: true,
    }),
  ],
  // If you have other specific configurations for the main process, they go here.
  // For example, if you need to resolve aliases differently than the renderer:
  // resolve: {
  //   alias: {
  //     '@common': resolve(__dirname, 'src/common'), // Example
  //   },
  // },
  build: {
    lib: {
      entry: resolve(__dirname, 'electron/main.ts'), // Path to your main process entry file
      name: 'ElectronMain',
      formats: ['cjs'], // Electron main process requires CommonJS
      fileName: () => 'main.js', // **CRITICAL: Ensures output is main.js**
    },
    outDir: 'dist/electron', // **CRITICAL: Output directory must match package.json "main" path**
    emptyOutDir: true, // Cleans the output directory before build (be careful if preload is also output here in a separate step)
    rollupOptions: {
      // Externalize modules that Electron provides or are native
      external: [
        'electron',
        '@lydell/node-pty', // Ensure this is externalized as it's a native module
        'path',
        'fs',
        'os',
        'child_process',
        'util',
        // Add any other Node.js built-ins or native dependencies used in main.ts
      ],
    },
    minify: false, // Minification is often not necessary for the main process and can sometimes cause issues
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  // If your main process code needs to resolve 'node-pty' to '@lydell/node-pty'
  // (though it's better if electron/main.ts directly imports '@lydell/node-pty')
  // resolve: {
  //   alias: {
  //     'node-pty': '@lydell/node-pty',
  //   },
  // },
});