// electron/electron-env.d.ts
// This file declares global variables injected by Electron Forge Vite plugin.
// It should be placed in your 'electron' folder and included in your electron/tsconfig.json.

declare global {
  // eslint-disable-next-line no-var
  var MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  // eslint-disable-next-line no-var
  var MAIN_WINDOW_VITE_NAME: string;
}

// If you don't want to use `var` and prefer them as constants (though they are injected as globals)
// you might need to adjust based on how strictly you want to type them.
// For the purpose of satisfying TypeScript, `var` in a .d.ts file is common for globals.

// Adding an empty export makes this a module, which can sometimes help with global augmentation.
export {};