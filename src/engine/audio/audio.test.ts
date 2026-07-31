import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sound } from "@pixi/sound";
import { animate } from "motion";

// Tracks the order animate()/stop() calls happen in, and the per-test tween
// id counter, so tests can assert cancellation happens BEFORE a new tween
// starts. `controlsCounter` is reset in `beforeEach` (via `resetEvents()`)
// so each test's call indices start from 0, regardless of how many prior
// tests already invoked the mocked `animate()`.
const { events, resetEvents, nextControlsId } = vi.hoisted(() => {
  const state = { events: [] as string[], controlsCounter: 0 };
  return {
    events: state.events,
    resetEvents: () => {
      state.events.length = 0;
      state.controlsCounter = 0;
    },
    nextControlsId: () => state.controlsCounter++,
  };
});

// `motion`'s real animate() probes browser-only globals even when animating
// a plain object, so it throws outside a real DOM/browser test environment.
// Replace it with a deterministic, cancellable fake: it mutates the target
// object's value on a `setInterval` tick (like `LoadingScreen.test.ts`'s
// pattern), but — unlike that fake — its returned controls' `.stop()`
// actually calls `clearInterval` so a cancelled tween produces zero further
// writes. This is the exact mechanism the repro test needs to prove the bug
// (an in-flight tween outliving a direct `setVolume()` write) and later the
// fix (cancelling it stops the writes).
vi.mock("motion", () => {
  return {
    animate: vi.fn(
      (
        target: Record<string, number>,
        keyframes: Record<string, number>,
        options?: { duration?: number; ease?: string },
      ) => {
        const id = nextControlsId();
        events.push(`animate:${id}`);
        const key = Object.keys(keyframes)[0];
        const from = target[key];
        const to = keyframes[key];
        const durationMs = (options?.duration ?? 1) * 1000;
        const start = Date.now();
        let stopped = false;
        const tick = () => {
          if (stopped) return;
          const elapsed = Date.now() - start;
          const t = Math.min(1, elapsed / durationMs);
          target[key] = from + (to - from) * t;
        };
        const interval = setInterval(tick, 16);
        tick();
        const controls = {
          stop: vi.fn(() => {
            if (stopped) return;
            stopped = true;
            clearInterval(interval);
            events.push(`stop:${id}`);
          }),
          then: (onFulfilled?: () => void) => {
            onFulfilled?.();
            return Promise.resolve();
          },
        };
        return controls;
      },
    ),
  };
});

const soundExists = vi.fn(() => true);
const soundFind = vi.fn();

vi.mock("@pixi/sound", () => {
  return {
    sound: {
      exists: soundExists,
      find: soundFind,
    },
  };
});

const { BGM } = await import("./audio.ts");

/** A minimal fake `Sound` instance — only the members `BGM` touches. */
function makeFakeSound(): Sound {
  return {
    volume: 0,
    play: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  } as unknown as Sound;
}

/** Shape of the fake tween controls object returned by the mocked `animate()`. */
type FakeTweenControls = { stop: ReturnType<typeof vi.fn> };

const animateMock = vi.mocked(animate);

/** Get the fake controls returned by the Nth `animate()` call (0-indexed). */
function controlsFromCall(index: number): FakeTweenControls {
  return animateMock.mock.results[index]!.value as FakeTweenControls;
}

describe("BGM", () => {
  beforeEach(() => {
    resetEvents();
    animateMock.mockClear();
    soundExists.mockReset().mockReturnValue(true);
    soundFind.mockReset();
  });

  describe("mute-first-click race (Requirement: Volume-affecting operations cancel in-flight tweens)", () => {
    it("SCEN-BGM-MUTE-MIDFADE: setVolume(0) mid-fade-in silences BGM immediately and stays silent", async () => {
      vi.useFakeTimers();
      try {
        const track = makeFakeSound();
        soundFind.mockReturnValue(track);

        const bgm = new BGM();
        await bgm.play("music-bg");
        // The 1s fade-in tween is now in flight (mocked `animate`, not settled).
        vi.advanceTimersByTime(300); // partway through the fade-in

        bgm.setVolume(0);
        expect(bgm.current!.volume).toBe(0);

        // Advance the remaining fake time the stale tween would have used —
        // a still-running tween would overwrite volume back toward its
        // fade-in target on its next tick.
        vi.advanceTimersByTime(800);

        expect(bgm.current!.volume).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("SCEN-BGM-UNMUTE-MIDTWEEN: setVolume(musicVolume) mid-tween restores configured volume and stays", async () => {
      vi.useFakeTimers();
      try {
        const track = makeFakeSound();
        soundFind.mockReturnValue(track);

        const bgm = new BGM();
        await bgm.play("music-bg");
        vi.advanceTimersByTime(1000); // fade-in settles at volume 1
        bgm.setVolume(0); // mute
        // unduck() (ducked=false) starts a tween targeting this.volume (0,
        // still muted) — an in-flight tween racing the upcoming unmute call,
        // without leaving `ducked` true (which would scale the write below).
        bgm.unduck();
        vi.advanceTimersByTime(200);

        bgm.setVolume(0.7); // unmute mid-tween
        expect(track.volume).toBe(0.7);

        vi.advanceTimersByTime(500); // let the stale tween's remaining frames run
        expect(track.volume).toBe(0.7);
      } finally {
        vi.useRealTimers();
      }
    });

    it("SCEN-BGM-SETVOLUME-ARBITRARY: setVolume(x) mid-tween lands on x and stays, for arbitrary 0<=x<=1", async () => {
      vi.useFakeTimers();
      try {
        const track = makeFakeSound();
        soundFind.mockReturnValue(track);

        // Use `play()`'s own fade-in tween as the in-flight tween (rather
        // than `duck()`, which would leave `ducked=true` and scale the
        // write below by DUCK_FACTOR — a separate, pre-existing behavior
        // not under test here).
        const bgm = new BGM();
        bgm.setVolume(0.9); // fade-in target, before any Sound exists yet
        await bgm.play("music-bg"); // 1s fade-in toward 0.9 — in flight
        vi.advanceTimersByTime(300);

        bgm.setVolume(0.35);
        expect(track.volume).toBe(0.35);

        vi.advanceTimersByTime(500);
        expect(track.volume).toBe(0.35);
      } finally {
        vi.useRealTimers();
      }
    });

    it("SCEN-BGM-DUCK-CANCELS-PRIOR: duck() cancels a prior in-flight tween before animating", async () => {
      vi.useFakeTimers();
      try {
        const track = makeFakeSound();
        soundFind.mockReturnValue(track);

        const bgm = new BGM();
        await bgm.play("music-bg"); // call 0: fade-in tween, still in flight
        vi.advanceTimersByTime(200);
        const fadeInControls = controlsFromCall(0);

        bgm.duck(); // call 1: duck tween — must stop call 0's controls first
        expect(fadeInControls.stop).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(500); // let duck's tween fully settle
        expect(track.volume).toBeCloseTo(0.2); // 1 * DUCK_FACTOR, never a stale fade-in value
      } finally {
        vi.useRealTimers();
      }
    });

    it("SCEN-BGM-UNDUCK-CANCELS-PRIOR: unduck() cancels a prior in-flight tween before animating", async () => {
      vi.useFakeTimers();
      try {
        const track = makeFakeSound();
        soundFind.mockReturnValue(track);

        const bgm = new BGM();
        await bgm.play("music-bg");
        vi.advanceTimersByTime(1000); // fade-in settles fully at volume 1
        bgm.duck(); // call 1: duck tween, still in flight
        vi.advanceTimersByTime(100);
        const duckControls = controlsFromCall(1);

        bgm.unduck(); // call 2: must stop call 1's controls first
        expect(duckControls.stop).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(500); // let unduck's tween fully settle
        expect(track.volume).toBeCloseTo(1); // never converges to duck's stale 0.2 target
      } finally {
        vi.useRealTimers();
      }
    });

    it("SCEN-BGM-MUTE-DUCK-UNDUCK: setVolume(0) then duck() then unduck() stays silent throughout", async () => {
      vi.useFakeTimers();
      try {
        const track = makeFakeSound();
        soundFind.mockReturnValue(track);

        const bgm = new BGM();
        await bgm.play("music-bg");
        vi.advanceTimersByTime(1000);

        bgm.setVolume(0);
        expect(track.volume).toBe(0);

        bgm.duck();
        vi.advanceTimersByTime(500);
        expect(track.volume).toBe(0);

        bgm.unduck();
        vi.advanceTimersByTime(500);
        expect(track.volume).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("SCEN-BGM-PLAY-SWITCH-CANCELS-PRIOR: play() track switch stops the outgoing track's active tween before its fade-out animate() starts", async () => {
      vi.useFakeTimers();
      try {
        const trackA = makeFakeSound();
        const trackB = makeFakeSound();
        soundFind.mockReturnValueOnce(trackA).mockReturnValueOnce(trackB);

        const bgm = new BGM();
        await bgm.play("music-bg"); // call 0: fade-in trackA
        vi.advanceTimersByTime(1000);
        bgm.duck(); // call 1: duck tween on trackA — still in flight
        vi.advanceTimersByTime(100);

        await bgm.play("other-track"); // call 2: fade-out trackA, call 3: fade-in trackB

        const stopIndex = events.indexOf("stop:1");
        const fadeOutAnimateIndex = events.indexOf("animate:2");
        expect(stopIndex).toBeGreaterThanOrEqual(0);
        expect(fadeOutAnimateIndex).toBeGreaterThanOrEqual(0);
        expect(stopIndex).toBeLessThan(fadeOutAnimateIndex);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
