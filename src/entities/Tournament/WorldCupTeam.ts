export type Confederation =
  | "UEFA"
  | "CONMEBOL"
  | "CAF"
  | "AFC"
  | "CONCACAF"
  | "OFC";

export type FlagColor =
  | "red"
  | "dred"
  | "white"
  | "blue"
  | "navy"
  | "lblue"
  | "sky"
  | "green"
  | "dgreen"
  | "yellow"
  | "gold"
  | "black"
  | "orange"
  | "maroon"
  | "brown";

export type FlagSpec =
  | { v: FlagColor[] }
  | { h: FlagColor[] }
  | { bg: FlagColor; cross: FlagColor; crossInner?: FlagColor }
  | { bg: FlagColor; disc: FlagColor }
  | { bg: FlagColor; emblem: FlagColor }
  | { special: string };

export interface WorldCupTeam {
  readonly id: string;
  readonly name: string;
  readonly confederation: Confederation;
  readonly flagUrl?: string;
  readonly strikerColor: number;
  readonly goalkeeperColor: number;
  /** 1–100. Used to weight win probability in simulated matches. */
  readonly power: number;
  readonly abbreviation: string;
  readonly flagSpec: FlagSpec;
}
