import { ActiveCard } from "./ActiveCard.ts";
import { PassiveCard } from "../passive/PassiveCard.ts";

export class NullifyCard extends ActiveCard {
  constructor(id: number, name: string, description: string, imageUrl: string) {
    super(id, name, description, imageUrl);
  }

  // Nullifies the target passive card — one-way bridge: active/ → passive/
  applyTo(target: PassiveCard): void {
    target.nullify();
  }
}
