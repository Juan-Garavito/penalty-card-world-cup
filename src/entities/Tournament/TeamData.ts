import type { WorldCupTeam } from "./WorldCupTeam.ts";

// All 48 FIFA World Cup 2026 qualified teams.
// Colors: primary kit hex for striker, alternate for goalkeeper.
// Power: 1–100 based on FIFA ranking tier and tournament history.
export const WORLD_CUP_2026_TEAMS: readonly WorldCupTeam[] = [
  // ── Group A ──────────────────────────────────────────────────────────────
  { id: "mexico",       name: "Mexico",           confederation: "CONCACAF", strikerColor: 0x006847, goalkeeperColor: 0xce1126, power: 70, abbreviation: "MEX", flagSpec: { h: ["green", "white", "red"] } },
  { id: "south-africa", name: "South Africa",     confederation: "CAF",      strikerColor: 0x007a4d, goalkeeperColor: 0xffb612, power: 52, abbreviation: "RSA", flagSpec: { special: "rsa" } },
  { id: "south-korea",  name: "South Korea",      confederation: "AFC",      strikerColor: 0xc60c30, goalkeeperColor: 0xffffff, power: 74, abbreviation: "KOR", flagSpec: { bg: "white", emblem: "red" } },
  { id: "czechia",      name: "Czech Republic",   confederation: "UEFA",     strikerColor: 0xd7141a, goalkeeperColor: 0x11457e, power: 68, abbreviation: "CZE", flagSpec: { special: "cze" } },

  // ── Group B ──────────────────────────────────────────────────────────────
  { id: "canada",       name: "Canada",           confederation: "CONCACAF", strikerColor: 0xff0000, goalkeeperColor: 0xffffff, power: 72, abbreviation: "CAN", flagSpec: { v: ["red", "white", "red"] } },
  { id: "bosnia",       name: "Bosnia & Herz.",   confederation: "UEFA",     strikerColor: 0x002395, goalkeeperColor: 0xffd700, power: 58, abbreviation: "BIH", flagSpec: { bg: "navy", emblem: "yellow" } },
  { id: "qatar",        name: "Qatar",            confederation: "AFC",      strikerColor: 0x8d1b3d, goalkeeperColor: 0xffffff, power: 50, abbreviation: "QAT", flagSpec: { v: ["maroon", "white"] } },
  { id: "switzerland",  name: "Switzerland",      confederation: "UEFA",     strikerColor: 0xff0000, goalkeeperColor: 0xffffff, power: 78, abbreviation: "SUI", flagSpec: { bg: "red", emblem: "white" } },

  // ── Group C ──────────────────────────────────────────────────────────────
  { id: "brazil",       name: "Brazil",           confederation: "CONMEBOL", strikerColor: 0xffd700, goalkeeperColor: 0x009c3b, power: 92, abbreviation: "BRA", flagSpec: { bg: "green", disc: "blue" } },
  { id: "morocco",      name: "Morocco",          confederation: "CAF",      strikerColor: 0xc1272d, goalkeeperColor: 0x006233, power: 78, abbreviation: "MAR", flagSpec: { bg: "red", emblem: "dgreen" } },
  { id: "haiti",        name: "Haiti",            confederation: "CONCACAF", strikerColor: 0x00209f, goalkeeperColor: 0xd21034, power: 44, abbreviation: "HAI", flagSpec: { h: ["navy", "red"] } },
  { id: "scotland",     name: "Scotland",         confederation: "UEFA",     strikerColor: 0x003078, goalkeeperColor: 0xffffff, power: 66, abbreviation: "SCO", flagSpec: { bg: "navy", cross: "white", crossInner: "navy" } },

  // ── Group D ──────────────────────────────────────────────────────────────
  { id: "usa",          name: "United States",    confederation: "CONCACAF", strikerColor: 0x002868, goalkeeperColor: 0xffffff, power: 74, abbreviation: "USA", flagSpec: { h: ["red", "white", "red"] } },
  { id: "paraguay",     name: "Paraguay",         confederation: "CONMEBOL", strikerColor: 0xffffff, goalkeeperColor: 0xd52b1e, power: 64, abbreviation: "PAR", flagSpec: { h: ["red", "white", "blue"] } },
  { id: "australia",    name: "Australia",        confederation: "AFC",      strikerColor: 0xffcd00, goalkeeperColor: 0x00008b, power: 74, abbreviation: "AUS", flagSpec: { bg: "navy", cross: "red", crossInner: "white" } },
  { id: "turkey",       name: "Turkey",           confederation: "UEFA",     strikerColor: 0xe30a17, goalkeeperColor: 0xffffff, power: 76, abbreviation: "TUR", flagSpec: { bg: "red", emblem: "white" } },

  // ── Group E ──────────────────────────────────────────────────────────────
  { id: "germany",      name: "Germany",          confederation: "UEFA",     strikerColor: 0xffffff, goalkeeperColor: 0x000000, power: 89, abbreviation: "GER", flagSpec: { h: ["black", "red", "gold"] } },
  { id: "curacao",      name: "Curaçao",          confederation: "CONCACAF", strikerColor: 0x003da5, goalkeeperColor: 0xffd700, power: 48, abbreviation: "CUW", flagSpec: { bg: "blue", emblem: "yellow" } },
  { id: "ivory-coast",  name: "Ivory Coast",      confederation: "CAF",      strikerColor: 0xf77f00, goalkeeperColor: 0x009a44, power: 72, abbreviation: "CIV", flagSpec: { v: ["orange", "white", "green"] } },
  { id: "ecuador",      name: "Ecuador",          confederation: "CONMEBOL", strikerColor: 0xffda00, goalkeeperColor: 0x003087, power: 74, abbreviation: "ECU", flagSpec: { h: ["yellow", "blue", "red"] } },

  // ── Group F ──────────────────────────────────────────────────────────────
  { id: "netherlands",  name: "Netherlands",      confederation: "UEFA",     strikerColor: 0xff6600, goalkeeperColor: 0xffffff, power: 86, abbreviation: "NED", flagSpec: { h: ["red", "white", "blue"] } },
  { id: "japan",        name: "Japan",            confederation: "AFC",      strikerColor: 0x003087, goalkeeperColor: 0xffffff, power: 78, abbreviation: "JPN", flagSpec: { bg: "white", disc: "red" } },
  { id: "sweden",       name: "Sweden",           confederation: "UEFA",     strikerColor: 0x006aa7, goalkeeperColor: 0xffd700, power: 76, abbreviation: "SWE", flagSpec: { bg: "navy", cross: "yellow", crossInner: "yellow" } },
  { id: "tunisia",      name: "Tunisia",          confederation: "CAF",      strikerColor: 0xe70013, goalkeeperColor: 0xffffff, power: 62, abbreviation: "TUN", flagSpec: { bg: "red", emblem: "white" } },

  // ── Group G ──────────────────────────────────────────────────────────────
  { id: "belgium",      name: "Belgium",          confederation: "UEFA",     strikerColor: 0xef3340, goalkeeperColor: 0x000000, power: 82, abbreviation: "BEL", flagSpec: { v: ["black", "yellow", "red"] } },
  { id: "egypt",        name: "Egypt",            confederation: "CAF",      strikerColor: 0xce1126, goalkeeperColor: 0xffffff, power: 66, abbreviation: "EGY", flagSpec: { h: ["red", "white", "black"] } },
  { id: "iran",         name: "Iran",             confederation: "AFC",      strikerColor: 0x239f40, goalkeeperColor: 0xffffff, power: 68, abbreviation: "IRN", flagSpec: { h: ["green", "white", "red"] } },
  { id: "new-zealand",  name: "New Zealand",      confederation: "OFC",      strikerColor: 0x000000, goalkeeperColor: 0xffffff, power: 46, abbreviation: "NZL", flagSpec: { bg: "navy", cross: "red", crossInner: "white" } },

  // ── Group H ──────────────────────────────────────────────────────────────
  { id: "spain",        name: "Spain",            confederation: "UEFA",     strikerColor: 0xaa151b, goalkeeperColor: 0xffd700, power: 88, abbreviation: "ESP", flagSpec: { h: ["red", "yellow", "red"] } },
  { id: "cape-verde",   name: "Cape Verde",       confederation: "CAF",      strikerColor: 0x003893, goalkeeperColor: 0xffffff, power: 54, abbreviation: "CPV", flagSpec: { h: ["blue", "white", "blue"] } },
  { id: "saudi-arabia", name: "Saudi Arabia",     confederation: "AFC",      strikerColor: 0x006c35, goalkeeperColor: 0xffffff, power: 64, abbreviation: "KSA", flagSpec: { bg: "green", emblem: "white" } },
  { id: "uruguay",      name: "Uruguay",          confederation: "CONMEBOL", strikerColor: 0x75aadb, goalkeeperColor: 0xffffff, power: 80, abbreviation: "URU", flagSpec: { h: ["white", "sky", "white"] } },

  // ── Group I ──────────────────────────────────────────────────────────────
  { id: "france",       name: "France",           confederation: "UEFA",     strikerColor: 0x002395, goalkeeperColor: 0xffffff, power: 94, abbreviation: "FRA", flagSpec: { v: ["navy", "white", "red"] } },
  { id: "senegal",      name: "Senegal",          confederation: "CAF",      strikerColor: 0x00853f, goalkeeperColor: 0xffffff, power: 76, abbreviation: "SEN", flagSpec: { v: ["green", "yellow", "red"] } },
  { id: "iraq",         name: "Iraq",             confederation: "AFC",      strikerColor: 0x007a3d, goalkeeperColor: 0xffffff, power: 56, abbreviation: "IRQ", flagSpec: { h: ["red", "white", "black"] } },
  { id: "norway",       name: "Norway",           confederation: "UEFA",     strikerColor: 0xef2b2d, goalkeeperColor: 0xffffff, power: 72, abbreviation: "NOR", flagSpec: { bg: "red", cross: "navy", crossInner: "white" } },

  // ── Group J ──────────────────────────────────────────────────────────────
  { id: "argentina",    name: "Argentina",        confederation: "CONMEBOL", strikerColor: 0x74acdf, goalkeeperColor: 0xffffff, power: 96, abbreviation: "ARG", flagSpec: { h: ["sky", "white", "sky"] } },
  { id: "algeria",      name: "Algeria",          confederation: "CAF",      strikerColor: 0xffffff, goalkeeperColor: 0x006233, power: 66, abbreviation: "ALG", flagSpec: { v: ["white", "green"] } },
  { id: "austria",      name: "Austria",          confederation: "UEFA",     strikerColor: 0xed2939, goalkeeperColor: 0xffffff, power: 74, abbreviation: "AUT", flagSpec: { h: ["red", "white", "red"] } },
  { id: "jordan",       name: "Jordan",           confederation: "AFC",      strikerColor: 0x007a3d, goalkeeperColor: 0xffffff, power: 48, abbreviation: "JOR", flagSpec: { h: ["black", "white", "green"] } },

  // ── Group K ──────────────────────────────────────────────────────────────
  { id: "portugal",     name: "Portugal",         confederation: "UEFA",     strikerColor: 0x006600, goalkeeperColor: 0xffd700, power: 87, abbreviation: "POR", flagSpec: { v: ["dgreen", "red"] } },
  { id: "dr-congo",     name: "DR Congo",         confederation: "CAF",      strikerColor: 0x007fff, goalkeeperColor: 0xffd700, power: 56, abbreviation: "COD", flagSpec: { bg: "sky", emblem: "yellow" } },
  { id: "uzbekistan",   name: "Uzbekistan",       confederation: "AFC",      strikerColor: 0x1eb53a, goalkeeperColor: 0xffffff, power: 54, abbreviation: "UZB", flagSpec: { h: ["sky", "white", "green"] } },
  { id: "colombia",     name: "Colombia",         confederation: "CONMEBOL", strikerColor: 0xfcd116, goalkeeperColor: 0x003087, power: 78, abbreviation: "COL", flagSpec: { h: ["yellow", "navy", "red"] } },

  // ── Group L ──────────────────────────────────────────────────────────────
  { id: "england",      name: "England",          confederation: "UEFA",     strikerColor: 0xffffff, goalkeeperColor: 0xce1124, power: 90, abbreviation: "ENG", flagSpec: { bg: "white", cross: "red", crossInner: "red" } },
  { id: "croatia",      name: "Croatia",          confederation: "UEFA",     strikerColor: 0xff0000, goalkeeperColor: 0xffffff, power: 78, abbreviation: "CRO", flagSpec: { h: ["red", "white", "navy"] } },
  { id: "ghana",        name: "Ghana",            confederation: "CAF",      strikerColor: 0xfcd116, goalkeeperColor: 0xffffff, power: 60, abbreviation: "GHA", flagSpec: { h: ["red", "gold", "green"] } },
  { id: "panama",       name: "Panama",           confederation: "CONCACAF", strikerColor: 0xffffff, goalkeeperColor: 0xce1126, power: 50, abbreviation: "PAN", flagSpec: { special: "pan" } },
] as const;

export const GROUP_ASSIGNMENTS: ReadonlyArray<{ groupId: string; teamIds: readonly string[] }> = [
  { groupId: "A", teamIds: ["mexico", "south-africa", "south-korea", "czechia"] },
  { groupId: "B", teamIds: ["canada", "bosnia", "qatar", "switzerland"] },
  { groupId: "C", teamIds: ["brazil", "morocco", "haiti", "scotland"] },
  { groupId: "D", teamIds: ["usa", "paraguay", "australia", "turkey"] },
  { groupId: "E", teamIds: ["germany", "curacao", "ivory-coast", "ecuador"] },
  { groupId: "F", teamIds: ["netherlands", "japan", "sweden", "tunisia"] },
  { groupId: "G", teamIds: ["belgium", "egypt", "iran", "new-zealand"] },
  { groupId: "H", teamIds: ["spain", "cape-verde", "saudi-arabia", "uruguay"] },
  { groupId: "I", teamIds: ["france", "senegal", "iraq", "norway"] },
  { groupId: "J", teamIds: ["argentina", "algeria", "austria", "jordan"] },
  { groupId: "K", teamIds: ["portugal", "dr-congo", "uzbekistan", "colombia"] },
  { groupId: "L", teamIds: ["england", "croatia", "ghana", "panama"] },
];

export function getTeamById(id: string): WorldCupTeam {
  const team = WORLD_CUP_2026_TEAMS.find((t) => t.id === id);
  if (!team) throw new Error(`Unknown team id: ${id}`);
  return team;
}

export function getGroupForTeam(id: string): string {
  const entry = GROUP_ASSIGNMENTS.find((g) => g.teamIds.includes(id));
  return entry ? entry.groupId : "?";
}
