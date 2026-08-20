import {
  Body,
  HelioVector,
  RotateVector,
  Rotation_EQJ_ECL,
} from "astronomy-engine";

export const KM_PER_AU = 149_597_870.7;
export const KM_PER_RENDER_UNIT = 1_000_000;
export const RENDER_UNITS_PER_AU = KM_PER_AU / KM_PER_RENDER_UNIT;

export type BodyId =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "moon"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto";

export interface BodyDefinition {
  id: BodyId;
  name: string;
  astronomyBody: Body;
  radiusKm: number;
  color: string;
  orbitDays: number | null;
}

export interface BodyState extends BodyDefinition {
  position: [number, number, number];
  distanceFromSunAU: number;
  radiusUnits: number;
}

export const BODY_DEFINITIONS: BodyDefinition[] = [
  { id: "sun", name: "Sun", astronomyBody: Body.Sun, radiusKm: 696_340, color: "#ffd166", orbitDays: null },
  { id: "mercury", name: "Mercury", astronomyBody: Body.Mercury, radiusKm: 2_439.7, color: "#a7a7a4", orbitDays: 87.969 },
  { id: "venus", name: "Venus", astronomyBody: Body.Venus, radiusKm: 6_051.8, color: "#dba866", orbitDays: 224.701 },
  { id: "earth", name: "Earth", astronomyBody: Body.Earth, radiusKm: 6_371, color: "#4d82dc", orbitDays: 365.256 },
  { id: "moon", name: "Moon", astronomyBody: Body.Moon, radiusKm: 1_737.4, color: "#c9c8c4", orbitDays: 27.322 },
  { id: "mars", name: "Mars", astronomyBody: Body.Mars, radiusKm: 3_389.5, color: "#c75c43", orbitDays: 686.98 },
  { id: "jupiter", name: "Jupiter", astronomyBody: Body.Jupiter, radiusKm: 69_911, color: "#d6ae83", orbitDays: 4_332.59 },
  { id: "saturn", name: "Saturn", astronomyBody: Body.Saturn, radiusKm: 58_232, color: "#dfc98f", orbitDays: 10_759.22 },
  { id: "uranus", name: "Uranus", astronomyBody: Body.Uranus, radiusKm: 25_362, color: "#78cdd1", orbitDays: 30_688.5 },
  { id: "neptune", name: "Neptune", astronomyBody: Body.Neptune, radiusKm: 24_622, color: "#4569cf", orbitDays: 60_182 },
  { id: "pluto", name: "Pluto", astronomyBody: Body.Pluto, radiusKm: 1_188.3, color: "#b8a58d", orbitDays: 90_560 },
];

const eclipticRotation = Rotation_EQJ_ECL();

export function calculateBodyStates(date: Date): BodyState[] {
  return BODY_DEFINITIONS.map((definition) => {
    const vector = RotateVector(
      eclipticRotation,
      HelioVector(definition.astronomyBody, date),
    );

    const clean = (value: number) => (Math.abs(value) < 1e-15 ? 0 : value);
    const position: [number, number, number] = [
      clean(vector.x * RENDER_UNITS_PER_AU),
      clean(vector.z * RENDER_UNITS_PER_AU),
      clean(-vector.y * RENDER_UNITS_PER_AU),
    ];

    return {
      ...definition,
      position,
      distanceFromSunAU: Math.hypot(vector.x, vector.y, vector.z),
      radiusUnits: definition.radiusKm / KM_PER_RENDER_UNIT,
    };
  });
}

export function formatDistance(au: number): string {
  if (au < 0.01) {
    return `${Math.round(au * KM_PER_AU).toLocaleString()} km`;
  }
  return `${au.toFixed(au < 10 ? 3 : 1)} AU`;
}

export function formatRadius(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}
