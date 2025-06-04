// electron/electron-env.d.ts
// This file declares global variables injected by Electron Forge Vite plugin.
// It should be placed in your 'electron' folder and included in your electron/tsconfig.json.

declare global {
  // Variables injected by @electron-forge/plugin-vite
  // eslint-disable-next-line no-var
  var MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  // eslint-disable-next-line no-var
  var MAIN_WINDOW_VITE_NAME: string;
}

// Adding an empty export makes this a module, which can sometimes help with global augmentation
// and ensures it's treated as a module by TypeScript if your tsconfig expects that.
export {};