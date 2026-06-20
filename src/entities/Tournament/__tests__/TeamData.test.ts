import { describe, it, expect } from "vitest";
import { WORLD_CUP_2026_TEAMS } from "../TeamData.ts";

describe("TeamData completeness", () => {
  it("has exactly 48 teams", () => {
    expect(WORLD_CUP_2026_TEAMS).toHaveLength(48);
  });

  it("every team has a non-empty abbreviation of exactly 3 characters", () => {
    for (const team of WORLD_CUP_2026_TEAMS) {
      expect(team.abbreviation, `${team.id} missing abbreviation`).toBeTruthy();
      expect(
        team.abbreviation.length,
        `${team.id} abbreviation "${team.abbreviation}" is not 3 chars`,
      ).toBe(3);
    }
  });

  it("every team has a non-null flagSpec", () => {
    for (const team of WORLD_CUP_2026_TEAMS) {
      expect(team.flagSpec, `${team.id} missing flagSpec`).toBeDefined();
      expect(team.flagSpec, `${team.id} flagSpec is null`).not.toBeNull();
    }
  });

  it("all existing legacy fields are still present", () => {
    for (const team of WORLD_CUP_2026_TEAMS) {
      expect(team.id, `${team.id} missing id`).toBeTruthy();
      expect(team.name, `${team.id} missing name`).toBeTruthy();
      expect(team.confederation, `${team.id} missing confederation`).toBeTruthy();
      expect(typeof team.strikerColor).toBe("number");
      expect(typeof team.goalkeeperColor).toBe("number");
      expect(typeof team.power).toBe("number");
    }
  });
});
