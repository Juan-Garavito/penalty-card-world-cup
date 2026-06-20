import { ShootCard } from "../Cards/passive/ShootCard.ts";
import { SaveCard } from "../Cards/passive/SaveCard.ts";

export type PlayerCards = {
  readonly shootCards: ShootCard[];
  readonly saveCards: SaveCard[];
};
