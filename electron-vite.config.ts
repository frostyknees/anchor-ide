import { defineConfig } from 'electron-vite';
import { resolve } from 'path'; // Ensure 'path' is imported if using resolve

export default defineConfig({
  main: {
    vite: {
      configFile: resolve(__dirname, 'vite.main.config.ts'),
    }
  },
  preload: {
    vite: {
      configFile: resolve(__dirname, 'vite.preload.config.ts'),
    }
  },
  renderer: {
    vite: {
      // You have both vite.config.ts and vite.renderer.config.ts.
      // The content of vite.config.ts is for the renderer.
      // If vite.renderer.config.ts is preferred, change this path.
      configFile: resolve(__dirname, 'vite.config.ts'),
    }
  }
});
