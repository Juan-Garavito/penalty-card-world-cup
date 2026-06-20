export type Tier = "Normal" | "Special" | "Epic";

export const TIER_STATS: Record<
  Tier,
  { power: number; cooldown: number; counterChance: number }
> = {
  Normal: { power: 0, cooldown: 0, counterChance: 70 },
  Special: { power: 5, cooldown: 3, counterChance: 50 },
  Epic: { power: 10, cooldown: 5, counterChance: 40 },
};
