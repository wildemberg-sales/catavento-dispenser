import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // Electron's sandboxed preload loader executes the script directly,
        // not through Node's ESM loader — an `import`/`export` (the default
        // .mjs output) throws "Cannot use import statement outside a
        // module". CJS output (.cjs, unambiguous under "type": "module")
        // is required for sandbox: true to work.
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        "@": resolve(__dirname, "src/renderer/src"),
      },
    },
    plugins: [react()],
  },
});
