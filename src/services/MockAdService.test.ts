import { describe, it, expect, vi } from "vitest";
import { MockAdService } from "./MockAdService.ts";
import { AdModalScreen } from "../screens/AdModalScreen.ts";

describe("MockAdService — SCEN-AD-MOCK-RETURNS-TRUE", () => {
  it("showAd() resolves true using a stub modal that resolves immediately", async () => {
    // Create a stub modal that resolves its promise immediately
    const stubModal = new AdModalScreen();

    // Create MockAdService with a factory that returns our stub
    const service = new MockAdService(() => stubModal);

    // Mock Navigation so presentPopup and dismissPopup are no-ops
    const { Navigation } = await import("../engine/navigation/navigation.ts");
    const presentSpy = vi.spyOn(Navigation.prototype, "presentPopup").mockResolvedValue(undefined);
    const dismissSpy = vi.spyOn(Navigation.prototype, "dismissPopup").mockResolvedValue(undefined);

    // Resolve the modal promise immediately
    (stubModal as unknown as { _resolve: () => void })._resolve();

    const result = await service.showAd();

    expect(result).toBe(true);

    presentSpy.mockRestore();
    dismissSpy.mockRestore();
  });
});
