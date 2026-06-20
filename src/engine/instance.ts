import { CreationEngine } from "./engine";

/** Shared engine instance, used by `main.ts` and by screens that need navigation (e.g. settings popup). */
export const engine = new CreationEngine();
