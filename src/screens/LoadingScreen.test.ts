import { describe, it, expect, vi } from "vitest";
import { Container, Text, Ticker } from "pixi.js";

// `motion`'s real animate() probes browser-only globals (NodeList, Element, ...)
// even when animating a plain object, so it throws outside a real DOM/browser
// test environment. Replace it with a deterministic fake that mutates the
// target object's value in-place based on elapsed fake-timer time — this still
// exercises LoadingScreen's real update()/redraw logic on every tick, it just
// replaces the easing math source (real motion vs. fake), matching the design's
// documented fallback ("mock motion.animate ... otherwise assert post-update state").
vi.mock("motion", () => {
  return {
    animate: vi.fn(
      (
        target: Record<string, number>,
        keyframes: Record<string, number>,
        _options?: { duration?: number; ease?: string },
      ) => {
        void _options;
        const key = Object.keys(keyframes)[0];
        const from = target[key];
        const to = keyframes[key];
        const start = Date.now();
        const durationMs = 400;
        const tick = () => {
          const elapsed = Date.now() - start;
          const t = Math.min(1, elapsed / durationMs);
          target[key] = from + (to - from) * t;
        };
        // Re-applied every time the fake clock advances, via vi's timer queue.
        const interval = setInterval(tick, 16);
        if (typeof interval === "object" && "unref" in interval) {
          (interval as unknown as { unref: () => void }).unref();
        }
        tick();
        return Promise.resolve();
      },
    ),
  };
});

const { LoadingScreen } = await import("./LoadingScreen.ts");

/** Walk the display tree depth-first and return every Text node found. */
function findAllTextNodes(root: Container): Text[] {
  const found: Text[] = [];
  for (const child of root.children) {
    if (child instanceof Text) {
      found.push(child);
    }
    if (child instanceof Container) {
      found.push(...findAllTextNodes(child));
    }
  }
  return found;
}

function makeScreen() {
  const screen = new LoadingScreen();
  screen.prepare();
  return screen;
}

describe("LoadingScreen", () => {
  it("is a PixiJS Container", () => {
    expect(new LoadingScreen()).toBeInstanceOf(Container);
  });

  it("SCEN-LS-PREPARE: prepare() does not throw", () => {
    expect(() => makeScreen()).not.toThrow();
  });

  it("SCEN-LS-CHILDREN: has children after prepare (panel, border, label, bar, percentage)", () => {
    const screen = makeScreen();
    expect(screen.children.length).toBeGreaterThan(0);
  });

  it("SCEN-LS-LABEL: a Text node with text 'LOADING' and fontFamily 'Minecraft' exists after prepare()", () => {
    const screen = makeScreen();
    const texts = findAllTextNodes(screen);
    const label = texts.find((t) => t.text === "LOADING");
    expect(label).toBeDefined();
    expect(label!.style.fontFamily).toBe("Minecraft");
  });

  it("SCEN-LS-PERCENT-FONT: percentage Text node uses fontFamily 'Minecraft' and starts at '0%'", () => {
    const screen = makeScreen();
    const texts = findAllTextNodes(screen);
    const percent = texts.find((t) => t.text === "0%");
    expect(percent).toBeDefined();
    expect(percent!.style.fontFamily).toBe("Minecraft");
  });

  it("SCEN-LS-SETPROGRESS-50: setProgress(50) then update(ticker) eases toward 50, not an instant snap", () => {
    vi.useFakeTimers();
    try {
      const screen = makeScreen();
      screen.setProgress(50);
      vi.advanceTimersByTime(50); // partway through the 400ms tween
      screen.update(Ticker.shared);

      const texts = findAllTextNodes(screen);
      const percent = texts.find((t) => /%$/.test(t.text));
      expect(percent).toBeDefined();
      const value = Number(percent!.text.replace("%", ""));
      // Eased value at 50/400ms elapsed must be strictly between 0 and 50 —
      // a snap implementation would jump straight to 50 on the same tick.
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(50);
    } finally {
      vi.useRealTimers();
    }
  });

  it("SCEN-LS-SETPROGRESS-100: setProgress(100) after setProgress(50) eases toward 100", () => {
    vi.useFakeTimers();
    try {
      const screen = makeScreen();
      screen.setProgress(50);
      vi.advanceTimersByTime(400); // let the first tween fully complete
      screen.update(Ticker.shared);

      const textsAt50 = findAllTextNodes(screen);
      const percentAt50 = textsAt50.find((t) => /%$/.test(t.text));
      const valueAt50 = Number(percentAt50!.text.replace("%", ""));
      expect(valueAt50).toBe(50);

      screen.setProgress(100);
      vi.advanceTimersByTime(50); // partway through the second tween
      screen.update(Ticker.shared);

      const textsAfter = findAllTextNodes(screen);
      const percentAfter = textsAfter.find((t) => /%$/.test(t.text));
      const valueAfter = Number(percentAfter!.text.replace("%", ""));
      // Eases toward 100 — must be greater than where we left off at 50,
      // but not snap instantly to 100.
      expect(valueAfter).toBeGreaterThan(valueAt50);
      expect(valueAfter).toBeLessThan(100);
    } finally {
      vi.useRealTimers();
    }
  });

  it("SCEN-LS-RESET: reset() clears children with no throw", () => {
    const screen = makeScreen();
    expect(() => screen.reset()).not.toThrow();
    expect(screen.children.length).toBe(0);
  });

  it("SCEN-LS-RESIZE: resize() does not throw", () => {
    const screen = makeScreen();
    expect(() => screen.resize(1280, 720)).not.toThrow();
    expect(() => screen.resize(1920, 1080)).not.toThrow();
  });

  it("SCEN-LS-SHOW-HIDE: show() and hide() resolve without throwing", async () => {
    const screen = makeScreen();
    await expect(screen.show()).resolves.toBeUndefined();
    await expect(screen.hide()).resolves.toBeUndefined();
  });

  it("SCEN-LS-STUDIO-CREDIT: a Text node with 'GUARICHO GAMES' and fontFamily 'Minecraft' exists after prepare()", () => {
    const screen = makeScreen();
    const texts = findAllTextNodes(screen);
    const studio = texts.find((t) => t.text === "GUARICHO GAMES");
    expect(studio).toBeDefined();
    expect(studio!.style.fontFamily).toBe("Minecraft");
  });

  it("SCEN-LS-STUDIO-BLINK: the studio credit's alpha changes over time via update()", () => {
    const screen = makeScreen();
    screen.update({ deltaMS: 0 } as Ticker);
    const texts = findAllTextNodes(screen);
    const studio = texts.find((t) => t.text === "GUARICHO GAMES")!;
    const initialAlpha = studio.alpha;

    screen.update({ deltaMS: 400 } as Ticker);
    const laterAlpha = studio.alpha;

    expect(laterAlpha).not.toBe(initialAlpha);
  });

  it("SCEN-LS-FADE-IN: show() eases alpha from 0 toward 1, not an instant snap", async () => {
    vi.useFakeTimers();
    try {
      const screen = makeScreen();
      expect(screen.alpha).toBe(0);
      const pending = screen.show();
      vi.advanceTimersByTime(50); // partway through the 400ms (mocked) fade
      screen.update({ deltaMS: 16 } as Ticker);
      expect(screen.alpha).toBeGreaterThan(0);
      expect(screen.alpha).toBeLessThan(1);
      vi.advanceTimersByTime(400);
      screen.update({ deltaMS: 16 } as Ticker);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it("SCEN-LS-FADE-OUT: hide() eases alpha from 1 toward 0, not an instant snap", async () => {
    vi.useFakeTimers();
    try {
      const screen = makeScreen();
      const shown = screen.show();
      vi.advanceTimersByTime(400); // let the fade-in fully complete
      screen.update({ deltaMS: 16 } as Ticker);
      await shown;
      expect(screen.alpha).toBe(1);

      const pending = screen.hide();
      vi.advanceTimersByTime(50); // partway through the 400ms (mocked) fade
      screen.update({ deltaMS: 16 } as Ticker);
      expect(screen.alpha).toBeLessThan(1);
      expect(screen.alpha).toBeGreaterThan(0);
      vi.advanceTimersByTime(400);
      screen.update({ deltaMS: 16 } as Ticker);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });
});
