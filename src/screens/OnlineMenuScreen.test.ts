import { describe, it, expect, vi } from "vitest";
import { Container, Text } from "pixi.js";
import { engine } from "../engine/instance.ts";
import { Navigation } from "../engine/navigation/navigation.ts";
import {
  OnlineMenuScreen,
  setPendingOnHost,
  setPendingOnJoin,
} from "./OnlineMenuScreen.ts";

/** Walk the display tree depth-first and return every Text whose text matches. */
function findTextNodes(root: Container, label: string): Text[] {
  const found: Text[] = [];
  for (const child of root.children) {
    if (child instanceof Text && child.text === label) {
      found.push(child);
    }
    if (child instanceof Container) {
      found.push(...findTextNodes(child, label));
    }
  }
  return found;
}

function makeScreen(onHost = vi.fn(), onJoin = vi.fn()) {
  const screen = new OnlineMenuScreen();
  setPendingOnHost(onHost);
  setPendingOnJoin(onJoin);
  screen.prepare();
  return { screen, onHost, onJoin };
}

// Regression coverage for a bug where the HOST/JOIN handlers read
// `this._onHost`/`this._onJoin` INSIDE `dismissPopup().then(...)`. The real
// `dismissPopup()` synchronously calls the popup's `reset()` (which nulls
// those fields) before its own promise resolves, so by the time `.then()`
// ran, the field was already null and the callback silently never fired —
// the whole HOST/JOIN flow was dead on click. The fix captures the callback
// in a local BEFORE calling dismissPopup(). The mock below mimics that same
// synchronous-reset-then-resolve ordering so this test fails against the
// original buggy code and passes against the fix.
describe("OnlineMenuScreen", () => {
  it("is a PixiJS Container", () => {
    expect(new OnlineMenuScreen()).toBeInstanceOf(Container);
  });

  it("HOST GAME fires onHost (not onJoin) even though dismissPopup() resets the screen first", async () => {
    engine.navigation = new Navigation();
    const { screen, onHost, onJoin } = makeScreen();
    const dismissSpy = vi
      .spyOn(engine.navigation, "dismissPopup")
      .mockImplementation(async () => {
        screen.reset();
      });

    const label = findTextNodes(screen, "HOST GAME")[0];
    expect(label).toBeDefined();
    (label.parent as Container).emit("pointerdown", {} as never);

    await Promise.resolve();
    await Promise.resolve();

    expect(dismissSpy).toHaveBeenCalledTimes(1);
    expect(onHost).toHaveBeenCalledTimes(1);
    expect(onJoin).not.toHaveBeenCalled();
    dismissSpy.mockRestore();
  });

  it("JOIN GAME fires onJoin (not onHost) even though dismissPopup() resets the screen first", async () => {
    engine.navigation = new Navigation();
    const { screen, onHost, onJoin } = makeScreen();
    const dismissSpy = vi
      .spyOn(engine.navigation, "dismissPopup")
      .mockImplementation(async () => {
        screen.reset();
      });

    const label = findTextNodes(screen, "JOIN GAME")[0];
    expect(label).toBeDefined();
    (label.parent as Container).emit("pointerdown", {} as never);

    await Promise.resolve();
    await Promise.resolve();

    expect(dismissSpy).toHaveBeenCalledTimes(1);
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onHost).not.toHaveBeenCalled();
    dismissSpy.mockRestore();
  });
});
