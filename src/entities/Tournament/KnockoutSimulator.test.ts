import { describe, it, expect } from "vitest";
import { simulateFullBracket, advanceRound } from "./KnockoutSimulator.ts";
import { buildKnockoutBracket } from "./KnockoutBracketBuilder.ts";
import type { TournamentGroup, GroupStanding } from "./TournamentGroup.ts";
import type { WorldCupTeam } from "./WorldCupTeam.ts";
import type { KnockoutBracket, KnockoutRound } from "./Tournament.ts";
import type { TournamentMatch } from "./TournamentMatch.ts";
import type { IRng } from "../Match/IRng.ts";

// Fixed RNG that always returns 0.4:
//   pHome*0.6 = 0.5*0.6 = 0.3 → 0.4 < 0.3 = false → 0 goals per attempt
//   tie → rng.next() < 0.5 → 0.4 < 0.5 = true → HOME always wins
const fixedRng: IRng = { next: () => 0.4 };

function makeTeam(id: string, power = 70): WorldCupTeam {
  return { id, name: id, confederation: "UEFA", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, power, abbreviation: id.slice(0, 3).toUpperCase(), flagSpec: { h: ["red", "white"] as ["red", "white"] } };
}

function makeStanding(team: WorldCupTeam, pts: number): GroupStanding {
  return { team, played: 3, won: pts / 3, drawn: 0, lost: 0, goalsFor: pts, goalsAgainst: 0, points: pts };
}

function makeGroup(id: string): TournamentGroup {
  const teams = [makeTeam(`${id}1`), makeTeam(`${id}2`), makeTeam(`${id}3`), makeTeam(`${id}4`)];
  return {
    id,
    teams: teams as [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam],
    matches: [],
    standings: [
      makeStanding(teams[0], 9),
      makeStanding(teams[1], 6),
      makeStanding(teams[2], 3),
      makeStanding(teams[3], 0),
    ],
  };
}

function makeBracket() {
  const groups = "ABCDEFGHIJKL".split("").map(makeGroup);
  return buildKnockoutBracket(groups);
}

describe("simulateFullBracket", () => {
  it("SCEN-SFB-COMPLETE: all rounds have all matches with homeGoals !== null", () => {
    const bracket = makeBracket();
    const result = simulateFullBracket(bracket, fixedRng);
    for (const round of result.rounds) {
      for (const match of round.matches) {
        expect(match.homeGoals).not.toBeNull();
        expect(match.awayGoals).not.toBeNull();
      }
    }
  });

  it("SCEN-SFB-CHAMPION: final round match has a non-null winner", () => {
    const bracket = makeBracket();
    const result = simulateFullBracket(bracket, fixedRng);
    const finalRound = result.rounds.find(r => r.phase === "final");
    expect(finalRound).toBeDefined();
    expect(finalRound!.matches[0].winner).not.toBeNull();
  });

  it("SCEN-SFB-SF-WINNERS-IN-FINAL: both SF winners appear in the final match", () => {
    const bracket = makeBracket();
    const result = simulateFullBracket(bracket, fixedRng);

    const sfRound = result.rounds.find(r => r.phase === "sf")!;
    const finalRound = result.rounds.find(r => r.phase === "final")!;

    const sfWinnerIds = sfRound.matches.map(m => m.winner!.id);
    const finalTeamIds = [finalRound.matches[0].home.id, finalRound.matches[0].away.id];

    expect(finalTeamIds).toContain(sfWinnerIds[0]);
    expect(finalTeamIds).toContain(sfWinnerIds[1]);
  });

  it("SCEN-SFB-SF-LOSERS-IN-3RD: both SF losers appear in the 3rd-place match", () => {
    const bracket = makeBracket();
    const result = simulateFullBracket(bracket, fixedRng);

    const sfRound = result.rounds.find(r => r.phase === "sf")!;
    const thirdRound = result.rounds.find(r => r.phase === "3rd")!;

    const sfLoserIds = sfRound.matches.map(m =>
      m.winner!.id === m.home.id ? m.away.id : m.home.id,
    );
    const thirdTeamIds = [thirdRound.matches[0].home.id, thirdRound.matches[0].away.id];

    expect(thirdTeamIds).toContain(sfLoserIds[0]);
    expect(thirdTeamIds).toContain(sfLoserIds[1]);
  });

  it("SCEN-SFB-IMMUTABLE: does not mutate the original bracket", () => {
    const bracket = makeBracket();
    const r32BeforeIds = bracket.rounds.find(r => r.phase === "r32")!.matches.map(m => m.homeGoals);
    simulateFullBracket(bracket, fixedRng);
    const r32AfterIds = bracket.rounds.find(r => r.phase === "r32")!.matches.map(m => m.homeGoals);
    expect(r32AfterIds).toEqual(r32BeforeIds); // original unchanged (all null)
  });
});

// ── advanceRound — SF→3rd branch ───────────────────────────────────────────

function makeMatch(
  id: string,
  phase: TournamentMatch["phase"],
  home: WorldCupTeam,
  away: WorldCupTeam,
  winner: WorldCupTeam | null = null,
): TournamentMatch {
  return {
    id,
    phase,
    home,
    away,
    homeGoals: winner ? (winner.id === home.id ? 1 : 0) : null,
    awayGoals: winner ? (winner.id === away.id ? 1 : 0) : null,
    winner,
    isPlayerMatch: false,
  };
}

function makeEmptyMatch(id: string, phase: TournamentMatch["phase"]): TournamentMatch {
  const tbd: WorldCupTeam = { id: "tbd", name: "TBD", confederation: "UEFA", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, power: 0, abbreviation: "TBD", flagSpec: { h: ["red", "white"] as ["red", "white"] } };
  return { id, phase, home: tbd, away: tbd, homeGoals: null, awayGoals: null, winner: null, isPlayerMatch: false };
}

function makeSFBracket(): KnockoutBracket {
  const teamA = makeTeam("teamA");
  const teamB = makeTeam("teamB");
  const teamC = makeTeam("teamC");
  const teamD = makeTeam("teamD");

  // SF round: teamA beats teamB, teamC beats teamD
  const sfRound: KnockoutRound = {
    phase: "sf",
    matches: [
      makeMatch("sf-0", "sf", teamA, teamB, teamA),  // winner: A, loser: B
      makeMatch("sf-1", "sf", teamC, teamD, teamC),  // winner: C, loser: D
    ],
  };

  const thirdRound: KnockoutRound = { phase: "3rd", matches: [makeEmptyMatch("3rd-0", "3rd")] };
  const finalRound: KnockoutRound = { phase: "final", matches: [makeEmptyMatch("final-0", "final")] };

  return { rounds: [sfRound, thirdRound, finalRound] };
}

function makeR32Bracket(): KnockoutBracket {
  const teams = Array.from({ length: 32 }, (_, i) => makeTeam(`t${i}`));
  const r32Matches: TournamentMatch[] = [];
  for (let i = 0; i < 16; i++) {
    const home = teams[i * 2];
    const away = teams[i * 2 + 1];
    r32Matches.push(makeMatch(`r32-${i}`, "r32", home, away, home)); // home always wins
  }
  const r32Round: KnockoutRound = { phase: "r32", matches: r32Matches };

  // R16: 8 empty matches
  const r16Round: KnockoutRound = {
    phase: "r16",
    matches: Array.from({ length: 8 }, (_, i) => makeEmptyMatch(`r16-${i}`, "r16")),
  };

  return { rounds: [r32Round, r16Round] };
}

// Builds a full R32→R16→QF bracket with one R32 match flagged as isPlayerMatch.
// All R32 matches have resolved results (home wins), simulating post-match state.
function makeR32BracketWithPlayer(playerMatchIdx: number): KnockoutBracket {
  const teams = Array.from({ length: 32 }, (_, i) => makeTeam(`t${i}`));
  const r32Matches: TournamentMatch[] = Array.from({ length: 16 }, (_, i) => ({
    ...makeMatch(`r32-${i}`, "r32", teams[i * 2], teams[i * 2 + 1], teams[i * 2]),
    isPlayerMatch: i === playerMatchIdx,
  }));
  return {
    rounds: [
      { phase: "r32", matches: r32Matches },
      { phase: "r16", matches: Array.from({ length: 8 }, (_, i) => makeEmptyMatch(`r16-${i}`, "r16")) },
      { phase: "qf", matches: Array.from({ length: 4 }, (_, i) => makeEmptyMatch(`qf-${i}`, "qf")) },
    ],
  };
}

describe("advanceRound — isPlayerMatch propagation", () => {
  it("SCEN-AR-PLAYER-SLOT-PRESERVED: player R16 slot gets isPlayerMatch:true and homeGoals:null", () => {
    // Player wins R32 match 0 (home team t0). Slot 0 in R16 should be preserved.
    const bracket = makeR32BracketWithPlayer(0);
    const result = advanceRound(bracket, fixedRng);
    const r16 = result.rounds.find(r => r.phase === "r16")!;
    expect(r16.matches[0].isPlayerMatch).toBe(true);
    expect(r16.matches[0].homeGoals).toBeNull();
    expect(r16.matches[0].home.id).toBe("t0"); // player winner placed correctly
  });

  it("SCEN-AR-PLAYER-SLOT-NOT-SIMULATED: non-player R16 slots get simulated results", () => {
    const bracket = makeR32BracketWithPlayer(0);
    const result = advanceRound(bracket, fixedRng);
    const r16 = result.rounds.find(r => r.phase === "r16")!;
    // Slot 0 is player (homeGoals null), all others should be simulated
    for (let i = 1; i < 8; i++) {
      expect(r16.matches[i].homeGoals).not.toBeNull();
      expect(r16.matches[i].isPlayerMatch).toBe(false);
    }
  });

  it("SCEN-AR-PLAYER-STOPS-CASCADE: cascade stops at R16 when player slot is unplayed", () => {
    const bracket = makeR32BracketWithPlayer(0);
    const result = advanceRound(bracket, fixedRng);
    // QF must remain TBD — cascade must NOT continue past the player's unplayed slot
    const qf = result.rounds.find(r => r.phase === "qf")!;
    for (const m of qf.matches) {
      expect(m.home.id).toBe("tbd");
      expect(m.away.id).toBe("tbd");
    }
  });

  it("SCEN-AR-PLAYER-ODD-SLOT: player match at odd R32 index propagates to correct R16 slot", () => {
    // Player wins R32 match 3 → winner t6 → R16 slot 1 (indices 2 and 3 → slot 1)
    const bracket = makeR32BracketWithPlayer(3);
    const result = advanceRound(bracket, fixedRng);
    const r16 = result.rounds.find(r => r.phase === "r16")!;
    expect(r16.matches[1].isPlayerMatch).toBe(true);
    expect(r16.matches[1].homeGoals).toBeNull();
  });

  it("SCEN-AR-SF-PLAYER-IN-FINAL: final gets isPlayerMatch:true when player is in SF", () => {
    const teamA = makeTeam("teamA");
    const teamB = makeTeam("teamB");
    const teamC = makeTeam("teamC");
    const teamD = makeTeam("teamD");
    const sfRound: KnockoutRound = {
      phase: "sf",
      matches: [
        { ...makeMatch("sf-0", "sf", teamA, teamB, teamA), isPlayerMatch: true },
        makeMatch("sf-1", "sf", teamC, teamD, teamC),
      ],
    };
    const bracket: KnockoutBracket = {
      rounds: [
        sfRound,
        { phase: "3rd", matches: [makeEmptyMatch("3rd-0", "3rd")] },
        { phase: "final", matches: [makeEmptyMatch("final-0", "final")] },
      ],
    };
    const result = advanceRound(bracket, fixedRng);
    const finalMatch = result.rounds.find(r => r.phase === "final")!.matches[0];
    expect(finalMatch.isPlayerMatch).toBe(true);
    expect(finalMatch.homeGoals).toBeNull();
  });

  it("SCEN-AR-SF-NO-PLAYER-FINAL-SIMULATED: final is NOT isPlayerMatch when player not in SF", () => {
    const sfBracket = makeSFBracket(); // no isPlayerMatch flags
    const result = advanceRound(sfBracket, fixedRng);
    const finalMatch = result.rounds.find(r => r.phase === "final")!.matches[0];
    expect(finalMatch.isPlayerMatch).toBe(false);
  });
});

describe("advanceRound — SF→3rd branch", () => {
  it("SCEN-AR-SF-WINNERS-IN-FINAL: SF winners propagate into final round home+away", () => {
    const bracket = makeSFBracket();
    const result = advanceRound(bracket, fixedRng);
    const finalMatch = result.rounds.find(r => r.phase === "final")!.matches[0];
    expect(finalMatch.home.id).toBe("teamA");
    expect(finalMatch.away.id).toBe("teamC");
  });

  it("SCEN-AR-SF-LOSERS-IN-3RD: SF losers propagate into 3rd-place match home+away", () => {
    const bracket = makeSFBracket();
    const result = advanceRound(bracket, fixedRng);
    const thirdMatch = result.rounds.find(r => r.phase === "3rd")!.matches[0];
    expect(thirdMatch.home.id).toBe("teamB");
    expect(thirdMatch.away.id).toBe("teamD");
  });

  it("SCEN-AR-NON-SF-STANDARD: non-SF round (R32) uses standard index-based winner pairing", () => {
    const bracket = makeR32Bracket();
    const result = advanceRound(bracket, fixedRng);
    const r16Round = result.rounds.find(r => r.phase === "r16")!;
    // R32 winners (even-indexed teams: t0, t2, t4...) should be paired into R16
    expect(r16Round.matches[0].home.id).toBe("t0");
    expect(r16Round.matches[0].away.id).toBe("t2");
    expect(r16Round.matches[1].home.id).toBe("t4");
    expect(r16Round.matches[1].away.id).toBe("t6");
  });

  it("SCEN-AR-NULL-WINNER-GUARD: round with winner===null does NOT propagate", () => {
    const bracket = makeSFBracket();
    // Overwrite SF matches to have null winners (unresolved round)
    const sfRound: KnockoutRound = {
      phase: "sf",
      matches: [
        makeEmptyMatch("sf-0", "sf"),
        makeEmptyMatch("sf-1", "sf"),
      ],
    };
    const bracketWithNulls: KnockoutBracket = {
      rounds: [sfRound, bracket.rounds[1], bracket.rounds[2]],
    };
    const result = advanceRound(bracketWithNulls, fixedRng);
    const finalMatch = result.rounds.find(r => r.phase === "final")!.matches[0];
    // Final slot should remain tbd — no propagation happened
    expect(finalMatch.home.id).toBe("tbd");
    expect(finalMatch.away.id).toBe("tbd");
  });
});
