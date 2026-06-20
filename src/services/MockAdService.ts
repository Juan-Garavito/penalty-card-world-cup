import type { IAdService } from "./IAdService.ts";
import { AdModalScreen } from "../screens/AdModalScreen.ts";
import { Navigation } from "../engine/navigation/navigation.ts";
import { bgm } from "../engine/audio/audio.ts";

export class MockAdService implements IAdService {
  constructor(
    private readonly createModal: () => AdModalScreen = () => new AdModalScreen(),
    private readonly navigation: Navigation | null = null,
  ) {}

  async showAd(): Promise<boolean> {
    const modal = this.createModal();

    // Build a constructor that always returns the same pre-created instance.
    // Navigation.presentPopup calls new ctor() internally, so we wrap the instance.
    const ModalCtor = class extends AdModalScreen {
      constructor() {
        super();
        // Copy the prepared instance's state — but we need identity, so we
        // piggyback on prepare() being called after construction by Navigation.
        // Instead, we return the existing modal via Object.setPrototypeOf trick.
        return modal;
      }
    } as unknown as new () => AdModalScreen;

    bgm.pause();
    try {
      if (this.navigation) {
        await this.navigation.presentPopup(ModalCtor);
        await modal.promise;
        await this.navigation.dismissPopup();
      } else {
        // In tests without a navigation instance, just await the modal promise directly
        // (the test resolves it externally).
        await modal.promise;
      }
    } finally {
      bgm.resume();
    }

    return true;
  }
}
