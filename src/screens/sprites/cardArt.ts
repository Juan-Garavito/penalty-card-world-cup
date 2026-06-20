import { Assets, Texture } from "pixi.js";
import { enablePixelArt } from "../../engine/utils/pixelArt.ts";
import { Card } from "../../entities/Cards/Card.ts";
import { ShootCard } from "../../entities/Cards/passive/ShootCard.ts";
import { SaveCard } from "../../entities/Cards/passive/SaveCard.ts";
import { CheatingCard } from "../../entities/Cards/active/CheatingCard.ts";
import { IntimidateCard } from "../../entities/Cards/active/IntimidateCard.ts";
import { NullifyCard } from "../../entities/Cards/active/NullifyCard.ts";
import type { Tier } from "../../entities/Cards/Tier.ts";

// Resolved relative to the global `Assets.init({ basePath: "assets" })`
// configured in engine.ts — must NOT repeat the "assets/" prefix here, or
// PixiJS's resolver double-prepends it (assets/assets/sprites/...).
const BASE = "sprites";

const TIER_FILE: Record<Tier, string> = {
  Normal: "normal",
  Special: "special",
  Epic: "epic",
};

// Every distinct card artwork shipped in public/assets/sprites. Used to preload
// the textures up front so the hand and the duel panel can render instantly.
export const CARD_ART_URLS: readonly string[] = [
  `${BASE}/striker/cards/shoot.normal.png`,
  `${BASE}/striker/cards/shoot.special.png`,
  `${BASE}/striker/cards/shoot.epic.png`,
  `${BASE}/striker/cards/shoot.cheating.png`,
  `${BASE}/goalkeeper/cards/save.normal.png`,
  `${BASE}/goalkeeper/cards/save.special.png`,
  `${BASE}/goalkeeper/cards/save.epic.png`,
  `${BASE}/goalkeeper/cards/save.intimidate.png`,
  `${BASE}/share-cards/all.nullify.png`,
];

// Maps a domain card to its artwork URL. Lives in the UI layer on purpose:
// asset paths are a presentation concern, the domain stays free of them.
// Returns null for cards without dedicated art (e.g. power-ups).
export function cardArtUrl(card: Card): string | null {
  if (card instanceof ShootCard) {
    return `${BASE}/striker/cards/shoot.${TIER_FILE[card.tier]}.png`;
  }
  if (card instanceof SaveCard) {
    return `${BASE}/goalkeeper/cards/save.${TIER_FILE[card.tier]}.png`;
  }
  if (card instanceof CheatingCard) {
    return `${BASE}/striker/cards/shoot.cheating.png`;
  }
  if (card instanceof IntimidateCard) {
    return `${BASE}/goalkeeper/cards/save.intimidate.png`;
  }
  if (card instanceof NullifyCard) {
    return `${BASE}/share-cards/all.nullify.png`;
  }
  return null;
}

// Loads every card artwork once and returns a url -> Texture lookup with
// nearest-neighbour filtering so the pixel-art cards stay crisp at any scale.
export async function loadCardTextures(): Promise<Map<string, Texture>> {
  const entries = await Promise.all(
    CARD_ART_URLS.map(async (url) => {
      const texture = await Assets.load<Texture>(url);
      enablePixelArt(texture);
      return [url, texture] as const;
    }),
  );
  return new Map(entries);
}
