import { ActiveCard } from "./ActiveCard.ts";
import { Tier, TIER_STATS } from "../Tier.ts";

export class CheatingCard extends ActiveCard {
  constructor(id: number, name: string, description: string, imageUrl: string) {
    super(id, name, description, imageUrl);
  }

  // Returns the goal chance when used against a rival of the given tier — pure query, no state mutation
  goalChanceVs(rivalTier: Tier): number {
    return TIER_STATS[rivalTier].counterChance;
  }
}
