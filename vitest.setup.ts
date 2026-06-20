// @pixi/sound probes the browser audio APIs at import time (format detection,
// AudioContext support). Stub the minimum so importing it in Node doesn't throw —
// it falls back to its "unsupported / legacy" path, which is fine for tests since
// no test actually plays audio through a real engine.
if (typeof window === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
if (typeof document === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).document = {
    createElement: () => ({ canPlayType: () => "" }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
