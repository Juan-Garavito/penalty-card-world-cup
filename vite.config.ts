import { defineConfig } from "vite";

import { assetpackPlugin } from "./scripts/assetpack-vite-plugin";
import { adsTxtPlugin } from "./scripts/ads-txt-vite-plugin";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [assetpackPlugin(), adsTxtPlugin()],
  server: {
    port: 8000,
    open: true,
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
  },
  esbuild: {
    // Strip console/debugger from production bundles only; keep them in dev
    drop: command === "build" ? ["console", "debugger"] : [],
  },
}));
