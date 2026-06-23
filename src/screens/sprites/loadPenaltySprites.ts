import { Assets, Rectangle, Spritesheet, Texture } from "pixi.js";
import type { SpritesheetData } from "pixi.js";
import { enablePixelArt } from "../../engine/utils/pixelArt.ts";
import { ASSETS_BASE_PATH } from "../../engine/engine.ts";

export interface LayeredFrames {
  body: Texture[];
  feet: Texture[];
  head: Texture[];
}

export interface StandLayers {
  wall: Texture;
  fanBackground: Texture;
  fanBody: Texture;
  fanShirt: Texture;
  fanHair: [Texture, Texture, Texture];
}

/**
 * Scoreboard panel (164×82 native), exported as separate Aseprite layers:
 * - panel: frame/background, including the two empty display windows.
 * - resultado: the two dark "digit display" boxes (home/away score).
 * - equipo1 / equipo2: the small nameplate strips below each digit box.
 */
export interface ScorePanelTextures {
  panel: Texture;
  resultado: Texture;
  equipo1: Texture;
  equipo2: Texture;
}

export interface PenaltySpriteBundle {
  striker: LayeredFrames;
  goalkeeper: LayeredFrames;
  goal: Texture;
  /** Penalty-kick ball (32×32 native), spun via rotation during ball flight. */
  ball: Texture;
  stands: StandLayers;
  /** Two 32×32 frames sliced from coin.goal.png: [0]=goal, [1]=miss. */
  coinFrames: [Texture, Texture];
  /** Scoreboard panel layers (164×82) mounted on the stadium wall. */
  scorePanel: ScorePanelTextures;
}

interface LayerSource {
  layer: "body" | "feet" | "head";
  json: string;
  png: string;
}

// Resolved relative to the global `Assets.init({ basePath: "assets" })`
// configured in engine.ts — must NOT repeat the "assets/" prefix here, or
// PixiJS's resolver double-prepends it (assets/assets/sprites/...).
const SPRITES_BASE = "sprites";

const STRIKER_LAYERS: LayerSource[] = [
  {
    layer: "body",
    json: `${SPRITES_BASE}/striker/striker.body.json`,
    png: `${SPRITES_BASE}/striker/striker.body.png`,
  },
  {
    layer: "feet",
    json: `${SPRITES_BASE}/striker/striker.feet.json`,
    png: `${SPRITES_BASE}/striker/striker.feet.png`,
  },
  {
    layer: "head",
    json: `${SPRITES_BASE}/striker/striker.head.json`,
    png: `${SPRITES_BASE}/striker/striker.head.png`,
  },
];

const GOALKEEPER_LAYERS: LayerSource[] = [
  {
    layer: "body",
    json: `${SPRITES_BASE}/goalkeeper/goalkeeper.body.json`,
    png: `${SPRITES_BASE}/goalkeeper/goalkeeper.body.png`,
  },
  {
    layer: "feet",
    json: `${SPRITES_BASE}/goalkeeper/goalkeeper.feet.json`,
    png: `${SPRITES_BASE}/goalkeeper/goalkeeper.feet.png`,
  },
  {
    layer: "head",
    json: `${SPRITES_BASE}/goalkeeper/goalkeeper.head.json`,
    png: `${SPRITES_BASE}/goalkeeper/goalkeeper.head.png`,
  },
];

const GOAL_TEXTURE_URL = `${SPRITES_BASE}/environment/soccer.goal.png`;
const BALL_TEXTURE_URL = `${SPRITES_BASE}/environment/ball.goal.png`;
const COIN_TEXTURE_URL = `${SPRITES_BASE}/environment/coin.goal.png`;
const SCORE_PANEL_URL = `${SPRITES_BASE}/environment/score.panel.png`;
const SCORE_RESULTADO_URL = `${SPRITES_BASE}/environment/score.resultado.png`;
const SCORE_EQUIPO1_URL = `${SPRITES_BASE}/environment/score.equipo1.png`;
const SCORE_EQUIPO2_URL = `${SPRITES_BASE}/environment/score.equipo2.png`;

// Stadium crowd, composed from per-layer 32×32 tiles so each fan is built from
// background + body + shirt (tinted per team) + one of three hair variants. The
// wall tile divides the two hinchadas.
const STAND_WALL_URL = `${SPRITES_BASE}/environment/stand.wall.png`;
const FAN_BACKGROUND_URL = `${SPRITES_BASE}/environment/fan.goal.background.png`;
const FAN_BODY_URL = `${SPRITES_BASE}/environment/fan.goal.body.png`;
const FAN_SHIRT_URL = `${SPRITES_BASE}/environment/fan.goal.shirt.png`;
const FAN_HAIR_URLS = [
  `${SPRITES_BASE}/environment/fan.goal.hair1.png`,
  `${SPRITES_BASE}/environment/fan.goal.hair2.png`,
  `${SPRITES_BASE}/environment/fan.goal.hair3.png`,
];

export async function loadPenaltySprites(): Promise<PenaltySpriteBundle> {
  const [
    striker,
    goalkeeper,
    goal,
    ball,
    coin,
    wall,
    fanBackground,
    fanBody,
    fanShirt,
    fanHair1,
    fanHair2,
    fanHair3,
    scorePanelBg,
    scoreResultado,
    scoreEquipo1,
    scoreEquipo2,
  ] = await Promise.all([
    loadCharacter(STRIKER_LAYERS),
    loadCharacter(GOALKEEPER_LAYERS),
    Assets.load<Texture>(GOAL_TEXTURE_URL),
    Assets.load<Texture>(BALL_TEXTURE_URL),
    Assets.load<Texture>(COIN_TEXTURE_URL),
    Assets.load<Texture>(STAND_WALL_URL),
    Assets.load<Texture>(FAN_BACKGROUND_URL),
    Assets.load<Texture>(FAN_BODY_URL),
    Assets.load<Texture>(FAN_SHIRT_URL),
    Assets.load<Texture>(FAN_HAIR_URLS[0]),
    Assets.load<Texture>(FAN_HAIR_URLS[1]),
    Assets.load<Texture>(FAN_HAIR_URLS[2]),
    Assets.load<Texture>(SCORE_PANEL_URL),
    Assets.load<Texture>(SCORE_RESULTADO_URL),
    Assets.load<Texture>(SCORE_EQUIPO1_URL),
    Assets.load<Texture>(SCORE_EQUIPO2_URL),
  ]);

  const fanHair: [Texture, Texture, Texture] = [fanHair1, fanHair2, fanHair3];

  for (const tex of [
    goal,
    ball,
    wall,
    fanBackground,
    fanBody,
    fanShirt,
    scorePanelBg,
    scoreResultado,
    scoreEquipo1,
    scoreEquipo2,
    ...fanHair,
  ]) {
    enablePixelArt(tex);
  }

  enablePixelArt(coin);
  // Slice the 64×32 coin sheet into two 32×32 frames.
  const coinFrames: [Texture, Texture] = [
    new Texture({ source: coin.source, frame: new Rectangle(0, 0, 32, 32) }),
    new Texture({ source: coin.source, frame: new Rectangle(32, 0, 32, 32) }),
  ];

  return {
    striker,
    goalkeeper,
    goal,
    ball,
    stands: {
      wall,
      fanBackground,
      fanBody,
      fanShirt,
      fanHair,
    },
    coinFrames,
    scorePanel: {
      panel: scorePanelBg,
      resultado: scoreResultado,
      equipo1: scoreEquipo1,
      equipo2: scoreEquipo2,
    },
  };
}

async function loadCharacter(layers: LayerSource[]): Promise<LayeredFrames> {
  const entries = await Promise.all(layers.map(loadLayer));
  const out: Partial<LayeredFrames> = {};
  for (const { layer, frames } of entries) {
    out[layer] = frames;
  }
  return out as LayeredFrames;
}

async function loadLayer(source: LayerSource): Promise<{
  layer: "body" | "feet" | "head";
  frames: Texture[];
}> {
  const [rawData, texture] = await Promise.all([
    fetchJson(source.json),
    Assets.load<Texture>(source.png),
  ]);

  // The striker JSONs reference a non-existent "player_small.png" in meta.image.
  // We already have the correct texture loaded, so we substitute meta.image with
  // the actual URL we used. This keeps Spritesheet.parse() happy.
  // Pixel-art: nearest-neighbour on the shared source keeps every frame crisp
  // at any scale. Set before parse so all frame textures inherit it.
  enablePixelArt(texture);

  const data = withFixedMetaImage(rawData, source.png);
  const sheet = new Spritesheet(texture, data);
  await sheet.parse();

  const frames = orderedFramesByX(data, sheet);
  return { layer: source.layer, frames };
}

async function fetchJson(url: string): Promise<SpritesheetData> {
  // Plain fetch() doesn't go through Pixi's Assets resolver, so it never gets
  // the configured basePath — prepend it manually (unlike Assets.load(url)
  // calls elsewhere in this file, which already get it automatically).
  const fullUrl = `${ASSETS_BASE_PATH}/${url}`;
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error(`Failed to load ${fullUrl}: ${res.status}`);
  return (await res.json()) as SpritesheetData;
}

function withFixedMetaImage(
  data: SpritesheetData,
  imageUrl: string,
): SpritesheetData {
  return {
    ...data,
    meta: { ...data.meta, image: imageUrl },
  };
}

// Returns frame Textures ordered by their .x position in the source sheet.
// This avoids coupling to specific frame key naming (which differs between
// striker "player_small (Body) N.aseprite" and goalkeeper "goalkeeper (Body) N.aseprite").
function orderedFramesByX(
  data: SpritesheetData,
  sheet: Spritesheet,
): Texture[] {
  const frames = data.frames as Record<string, { frame: { x: number } }>;
  const keys = Object.keys(frames);
  keys.sort((a, b) => frames[a].frame.x - frames[b].frame.x);
  return keys.map((k) => sheet.textures[k]);
}
