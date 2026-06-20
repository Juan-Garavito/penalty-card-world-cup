import { PassiveCard } from "./PassiveCard.ts";
import { Tier } from "../Tier.ts";

export class ShootCard extends PassiveCard {
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
