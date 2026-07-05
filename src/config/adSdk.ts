/**
 * Selects which ad SDK is active for this build.
 *
 * Set via the `VITE_AD_SDK` env var (e.g. in a `.env.<mode>` file, or
 * `VITE_AD_SDK=crazygames npm run build`). Defaults to "poki" — the
 * historical behavior — when unset.
 *
 *   - "poki"       → use the Poki HTML5 SDK (game-cdn.poki.com)
 *   - "crazygames" → use the CrazyGames HTML5 SDK (sdk.crazygames.com)
 *   - "google"     → use Google's Ad Placement API (H5 Games Ads), see index.html
 *   - "none"       → skip portal SDKs entirely; use the in-game mock ad modal
 */
export type AdSdkProvider = "poki" | "crazygames" | "google" | "none";

function resolveAdSdkProvider(): AdSdkProvider {
  const raw = (import.meta.env.VITE_AD_SDK ?? "poki").toLowerCase();
  if (raw === "crazygames" || raw === "google" || raw === "none") return raw;
  return "poki";
}

export const AD_SDK_PROVIDER: AdSdkProvider = resolveAdSdkProvider();
