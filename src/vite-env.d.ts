/// <reference types="vite/client" />
/** Injected by ViteJS define plugin */
declare const APP_VERSION: string;

interface ImportMetaEnv {
  /** Selects the active ad SDK at build time: "poki" | "crazygames" | "none". */
  readonly VITE_AD_SDK?: string;
}
