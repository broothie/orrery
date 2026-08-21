import { describe, expect, it } from "vitest";
import {
  BODY_DEFINITIONS,
  KM_PER_RENDER_UNIT,
  calculateBodyStates,
} from "./astronomy";

type Vector3 = [number, number, number];
type Quaternion = [number, number, number, number];

function rotateVector(vector: Vector3, quaternion: Quaternion): Vector3 {
  const [qx, qy, qz, qw] = quaternion;
  const [vx, vy, vz] = vector;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx,
  ];
}

function angleBetween(a: Vector3, b: Vector3) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
}

function signedAngleAround(a: Vector3, b: Vector3, axis: Vector3) {
  const cross: Vector3 = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const sine = axis[0] * cross[0] + axis[1] * cross[1] + axis[2] * cross[2];
  const cosine = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.atan2(sine, cosine) * 180 / Math.PI;
}

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

  it("returns normalized body orientations", () => {
    for (const state of states) {
      expect(Math.hypot(...state.orientation)).toBeCloseTo(1, 12);
    }
  });

  it("aligns planetary poles with their IAU axial tilts", () => {
    const j2000States = calculateBodyStates(new Date("2000-01-01T12:00:00Z"));
    const earth = j2000States.find((body) => body.id === "earth")!;
    const uranus = j2000States.find((body) => body.id === "uranus")!;
    const sceneNorth: Vector3 = [0, 1, 0];

    expect(angleBetween(rotateVector(sceneNorth, earth.orientation), sceneNorth))
      .toBeCloseTo(23.44, 1);
    expect(angleBetween(rotateVector(sceneNorth, uranus.orientation), sceneNorth))
      .toBeCloseTo(82.23, 1);
  });

  it("rotates Earth with simulation time", () => {
    const start = calculateBodyStates(new Date("2000-01-01T12:00:00Z"))
      .find((body) => body.id === "earth")!;
    const sixHoursLater = calculateBodyStates(new Date("2000-01-01T18:00:00Z"))
      .find((body) => body.id === "earth")!;
    const primeMeridian: Vector3 = [1, 0, 0];
    const startMeridian = rotateVector(primeMeridian, start.orientation);
    const laterMeridian = rotateVector(primeMeridian, sixHoursLater.orientation);

    expect(angleBetween(startMeridian, laterMeridian)).toBeCloseTo(90.36, 1);
  });

  it("preserves Venus's retrograde rotation", () => {
    const start = calculateBodyStates(new Date("2000-01-01T12:00:00Z"))
      .find((body) => body.id === "venus")!;
    const oneDayLater = calculateBodyStates(new Date("2000-01-02T12:00:00Z"))
      .find((body) => body.id === "venus")!;
    const primeMeridian: Vector3 = [1, 0, 0];
    const localNorth: Vector3 = [0, 1, 0];

    expect(signedAngleAround(
      rotateVector(primeMeridian, start.orientation),
      rotateVector(primeMeridian, oneDayLater.orientation),
      rotateVector(localNorth, start.orientation),
    )).toBeCloseTo(-1.481, 2);
  });
});
