import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

/**
 * Emits `ads.txt` at the build output root from `VITE_GOOGLE_AD_CLIENT`.
 * Files under `public/` are copied verbatim (Vite doesn't template them), so this
 * is the only way to keep the AdSense account id as a single env-driven value
 * instead of a hardcoded file that needs editing by hand if the account changes.
 */
export function adsTxtPlugin(): Plugin {
  let config: ResolvedConfig;

  const content = (): string | undefined => {
    const clientId = config.env.VITE_GOOGLE_AD_CLIENT;
    if (!clientId) return undefined;
    return `google.com, ${clientId}, DIRECT, f08c47fec0942fa0\n`;
  };

  return {
    name: "vite-plugin-ads-txt",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    closeBundle() {
      const body = content();
      if (!body) return;
      writeFileSync(resolve(config.root, config.build.outDir, "ads.txt"), body);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const body = content();
        if (req.url !== "/ads.txt" || !body) return next();
        res.setHeader("Content-Type", "text/plain");
        res.end(body);
      });
    },
  };
}
