// vite.config.mts
import fs from "node:fs";

import type { AssetPackConfig } from "@assetpack/core";
import { AssetPack } from "@assetpack/core";
import { pixiPipes } from "@assetpack/core/pixi";
import type { Plugin, ResolvedConfig } from "vite";

// AssetPack owns this directory exclusively and regenerates it from
// `raw-assets/` on every run. If its `.assetpack/` cache is missing (e.g. a
// fresh checkout/CI build with no local cache — see @assetpack/core's
// AssetPack constructor), it destructively clears whatever directory
// `output` points to before regenerating. Pointing `output` directly at
// `public/assets/` (the old behavior) meant that wipe also deleted the
// hand-placed, git-committed game assets (sprites/sounds/fonts) that live
// alongside AssetPack's own output there. This directory is isolated and
// gitignored, so the wipe can only ever destroy AssetPack's own disposable
// output. `syncGeneratedAssets` then additively copies (never deletes) the
// staged result into `public/assets/` so the game keeps serving from the
// same location/URLs it always has.
const ASSETPACK_STAGING_DIR = "./.assetpack-output";

export function assetpackPlugin() {
  const apConfig = {
    entry: "./raw-assets",
    output: ASSETPACK_STAGING_DIR,
    pipes: [
      ...pixiPipes({
        cacheBust: false,
        manifest: {
          output: "./src/manifest.json",
        },
      }),
    ],
  } as AssetPackConfig;
  let mode: ResolvedConfig["command"];
  let publicDir: string | false | undefined;
  let ap: AssetPack | undefined;

  const syncGeneratedAssets = () => {
    if (!publicDir) return;
    // Additive merge: copies files from the staging dir into
    // `${publicDir}/assets`, overwriting same-named files, but never
    // deleting anything already there.
    fs.cpSync(ASSETPACK_STAGING_DIR, `${publicDir}/assets`, {
      recursive: true,
    });
  };

  return {
    name: "vite-plugin-assetpack",
    configResolved(resolvedConfig) {
      mode = resolvedConfig.command;
      publicDir = resolvedConfig.publicDir;
    },
    buildStart: async () => {
      if (mode === "serve") {
        if (ap) return;
        ap = new AssetPack(apConfig);
        await ap.watch(syncGeneratedAssets);
      } else {
        await new AssetPack(apConfig).run();
        syncGeneratedAssets();
      }
    },
    buildEnd: async () => {
      if (ap) {
        await ap.stop();
        ap = undefined;
      }
    },
  } as Plugin;
}
