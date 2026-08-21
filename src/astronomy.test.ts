import { describe, expect, it } from "vitest";
import {
  BODY_DEFINITIONS,
  KM_PER_RENDER_UNIT,
  calculateBodyStates,
} from "./astronomy";

describe("calculateBodyStates", () => {
  const states = calculateBodyStates(new Date("2026-08-20T00:00:00Z"));

  it("places the Sun at the heliocentric origin", () => {
    const sun = states.find((body) => body.id === "sun")!;
    expect(sun.position).toEqual([0, 0, 0]);
    expect(sun.distanceFromSunAU).toBe(0);
  });

  it("keeps Earth near one astronomical unit", () => {
    const earth = states.find((body) => body.id === "earth")!;
    expect(earth.distanceFromSunAU).toBeGreaterThan(0.98);
    expect(earth.distanceFromSunAU).toBeLessThan(1.02);
  });

  it("uses one physical scale for every body radius", () => {
    for (const state of states) {
      const definition = BODY_DEFINITIONS.find((body) => body.id === state.id)!;
      expect(state.radiusUnits).toBeCloseTo(
        definition.radiusKm / KM_PER_RENDER_UNIT,
        12,
      );
    }
  });

  it("places every moon near its parent", () => {
    for (const moon of BODY_DEFINITIONS.filter((body) => body.parentId)) {
      const moonState = states.find((body) => body.id === moon.id)!;
      const parentState = states.find((body) => body.id === moon.parentId)!;
      const separationKm = Math.hypot(
        moonState.position[0] - parentState.position[0],
        moonState.position[1] - parentState.position[1],
        moonState.position[2] - parentState.position[2],
      ) * KM_PER_RENDER_UNIT;
      expect(separationKm).toBeGreaterThan(parentState.radiusKm);
      expect(separationKm).toBeLessThan(11_000_000);
    }
  });
});
