import { vi } from "vitest";
import { IAStrategy } from "../IAStrategy.ts";

/**
 * Returns a complete IAStrategy stub with all required methods mocked.
 * Use overrides to control the return value of pick, pickActive, or pickSide per test.
 */
export function makeIAStrategyMock(
  overrides?: Partial<IAStrategy>,
): IAStrategy {
  return {
    pick: vi.fn(),
    pickActive: vi.fn(),
    pickSide: vi.fn().mockReturnValue("center"),
    ...overrides,
  };
}
