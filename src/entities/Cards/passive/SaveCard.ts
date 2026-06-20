import { PassiveCard } from "./PassiveCard.ts";
import { Tier } from "../Tier.ts";

export class SaveCard extends PassiveCard {
  constructor(
    id: number,
    name: string,
    description: string,
    imageUrl: string,
    tier: Tier,
  ) {
    super(id, name, description, imageUrl, tier);
  }
}
