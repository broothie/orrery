import {
  Body,
  HelioVector,
  MakeTime,
  RotationAxis,
  RotateVector,
  Rotation_EQJ_ECL,
  Vector,
} from "astronomy-engine";

export const KM_PER_AU = 149_597_870.7;
export const KM_PER_RENDER_UNIT = 1_000_000;
export const RENDER_UNITS_PER_AU = KM_PER_AU / KM_PER_RENDER_UNIT;

export type PrimaryBodyId =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto";

export type MoonId =
  | "moon"
  | "phobos"
  | "deimos"
  | "io"
  | "europa"
  | "ganymede"
  | "callisto"
  | "mimas"
  | "enceladus"
  | "tethys"
  | "dione"
  | "rhea"
  | "titan"
  | "hyperion"
  | "iapetus"
  | "miranda"
  | "ariel"
  | "umbriel"
  | "titania"
  | "oberon"
  | "triton"
  | "proteus"
  | "nereid"
  | "charon"
  | "styx"
  | "nix"
  | "kerberos"
  | "hydra";

export type BodyId = PrimaryBodyId | MoonId;

export interface BodyDefinition {
  id: BodyId;
  name: string;
  radiusKm: number;
  color: string;
  orbitDays: number | null;
  parentId: PrimaryBodyId | null;
}

interface PrimaryBodyDefinition extends BodyDefinition {
  id: PrimaryBodyId;
  astronomyBody: Body;
  parentId: null;
}

interface OrbitalElements {
  semiMajorAxisKm: number;
  eccentricity: number;
  argumentOfPeriapsisDeg: number;
  meanAnomalyDeg: number;
  inclinationDeg: number;
  ascendingNodeDeg: number;
  periodDays: number;
  epochMs?: number;
  poleRaDeg: number;
  poleDecDeg: number;
}

interface MoonDefinition extends BodyDefinition {
  id: MoonId;
  parentId: PrimaryBodyId;
  astronomyBody?: Body;
  orbit?: OrbitalElements;
}

export interface BodyState extends BodyDefinition {
  position: [number, number, number];
  orientation: [number, number, number, number];
  distanceFromSunAU: number;
  radiusUnits: number;
}

export const PRIMARY_BODY_DEFINITIONS: PrimaryBodyDefinition[] = [
  { id: "sun", name: "Sun", astronomyBody: Body.Sun, radiusKm: 696_340, color: "#ffd166", orbitDays: null, parentId: null },
  { id: "mercury", name: "Mercury", astronomyBody: Body.Mercury, radiusKm: 2_439.7, color: "#a7a7a4", orbitDays: 87.969, parentId: null },
  { id: "venus", name: "Venus", astronomyBody: Body.Venus, radiusKm: 6_051.8, color: "#dba866", orbitDays: 224.701, parentId: null },
  { id: "earth", name: "Earth", astronomyBody: Body.Earth, radiusKm: 6_371, color: "#4d82dc", orbitDays: 365.256, parentId: null },
  { id: "mars", name: "Mars", astronomyBody: Body.Mars, radiusKm: 3_389.5, color: "#c75c43", orbitDays: 686.98, parentId: null },
  { id: "jupiter", name: "Jupiter", astronomyBody: Body.Jupiter, radiusKm: 69_911, color: "#d6ae83", orbitDays: 4_332.59, parentId: null },
  { id: "saturn", name: "Saturn", astronomyBody: Body.Saturn, radiusKm: 58_232, color: "#dfc98f", orbitDays: 10_759.22, parentId: null },
  { id: "uranus", name: "Uranus", astronomyBody: Body.Uranus, radiusKm: 25_362, color: "#78cdd1", orbitDays: 30_688.5, parentId: null },
  { id: "neptune", name: "Neptune", astronomyBody: Body.Neptune, radiusKm: 24_622, color: "#4569cf", orbitDays: 60_182, parentId: null },
  { id: "pluto", name: "Pluto", astronomyBody: Body.Pluto, radiusKm: 1_188.3, color: "#b8a58d", orbitDays: 90_560, parentId: null },
];

const ECLIPTIC_POLE = { poleRaDeg: 270, poleDecDeg: 66.5607 };
const URANUS_POLE = { poleRaDeg: 257.311, poleDecDeg: -15.175 };
const PLUTO_POLE = { poleRaDeg: 132.993, poleDecDeg: -6.163 };

function moon(
  id: MoonId,
  name: string,
  parentId: PrimaryBodyId,
  radiusKm: number,
  color: string,
  orbit: Omit<OrbitalElements, "poleRaDeg" | "poleDecDeg"> & Pick<OrbitalElements, "poleRaDeg" | "poleDecDeg">,
): MoonDefinition {
  return { id, name, parentId, radiusKm, color, orbitDays: orbit.periodDays, orbit };
}

export const MOON_DEFINITIONS: MoonDefinition[] = [
  { id: "moon", name: "Moon", parentId: "earth", astronomyBody: Body.Moon, radiusKm: 1_737.4, color: "#c9c8c4", orbitDays: 27.322 },
  moon("phobos", "Phobos", "mars", 11.08, "#9b8878", { semiMajorAxisKm: 9_375, eccentricity: 0.015, argumentOfPeriapsisDeg: 216.3, meanAnomalyDeg: 189.7, inclinationDeg: 1.1, ascendingNodeDeg: 169.2, periodDays: 0.3187, poleRaDeg: 317.7, poleDecDeg: 52.9 }),
  moon("deimos", "Deimos", "mars", 6.2, "#b5a18e", { semiMajorAxisKm: 23_457, eccentricity: 0, argumentOfPeriapsisDeg: 0, meanAnomalyDeg: 205, inclinationDeg: 1.8, ascendingNodeDeg: 54.3, periodDays: 1.2625, poleRaDeg: 316.6, poleDecDeg: 53.5 }),
  moon("io", "Io", "jupiter", 1_821.49, "#e3c15f", { semiMajorAxisKm: 421_800, eccentricity: 0.004, argumentOfPeriapsisDeg: 49.1, meanAnomalyDeg: 330.9, inclinationDeg: 0, ascendingNodeDeg: 0, periodDays: 1.762732, poleRaDeg: 268.1, poleDecDeg: 64.5 }),
  moon("europa", "Europa", "jupiter", 1_560.8, "#c7b693", { semiMajorAxisKm: 671_100, eccentricity: 0.009, argumentOfPeriapsisDeg: 45, meanAnomalyDeg: 345.4, inclinationDeg: 0.5, ascendingNodeDeg: 184, periodDays: 3.525463, poleRaDeg: 268.1, poleDecDeg: 64.5 }),
  moon("ganymede", "Ganymede", "jupiter", 2_631.2, "#9b8a74", { semiMajorAxisKm: 1_070_400, eccentricity: 0.001, argumentOfPeriapsisDeg: 198.3, meanAnomalyDeg: 324.8, inclinationDeg: 0.2, ascendingNodeDeg: 58.5, periodDays: 7.155588, poleRaDeg: 268.2, poleDecDeg: 64.6 }),
  moon("callisto", "Callisto", "jupiter", 2_410.3, "#746b61", { semiMajorAxisKm: 1_882_700, eccentricity: 0.007, argumentOfPeriapsisDeg: 43.8, meanAnomalyDeg: 87.4, inclinationDeg: 0.3, ascendingNodeDeg: 309.1, periodDays: 16.69044, poleRaDeg: 268.7, poleDecDeg: 64.8 }),
  moon("mimas", "Mimas", "saturn", 198.2, "#bcbcb7", { semiMajorAxisKm: 186_000, eccentricity: 0.02, argumentOfPeriapsisDeg: 160.4, meanAnomalyDeg: 275.3, inclinationDeg: 1.6, ascendingNodeDeg: 66.2, periodDays: 0.942422, poleRaDeg: 40.6, poleDecDeg: 83.5 }),
  moon("enceladus", "Enceladus", "saturn", 252.1, "#e4e6e3", { semiMajorAxisKm: 238_400, eccentricity: 0.005, argumentOfPeriapsisDeg: 119.5, meanAnomalyDeg: 57, inclinationDeg: 0, ascendingNodeDeg: 0, periodDays: 1.370218, poleRaDeg: 40.6, poleDecDeg: 83.5 }),
  moon("tethys", "Tethys", "saturn", 531.1, "#c9c8c0", { semiMajorAxisKm: 295_000, eccentricity: 0.001, argumentOfPeriapsisDeg: 335.3, meanAnomalyDeg: 0, inclinationDeg: 1.1, ascendingNodeDeg: 273, periodDays: 1.887802, poleRaDeg: 40.6, poleDecDeg: 83.5 }),
  moon("dione", "Dione", "saturn", 561.4, "#b9b8b1", { semiMajorAxisKm: 377_700, eccentricity: 0.002, argumentOfPeriapsisDeg: 116, meanAnomalyDeg: 212, inclinationDeg: 0, ascendingNodeDeg: 0, periodDays: 2.736916, poleRaDeg: 40.6, poleDecDeg: 83.5 }),
  moon("rhea", "Rhea", "saturn", 763.5, "#aaa9a2", { semiMajorAxisKm: 527_200, eccentricity: 0.001, argumentOfPeriapsisDeg: 44.3, meanAnomalyDeg: 31.5, inclinationDeg: 0.3, ascendingNodeDeg: 133.7, periodDays: 4.517503, poleRaDeg: 40.6, poleDecDeg: 83.5 }),
  moon("titan", "Titan", "saturn", 2_574.76, "#d19a4a", { semiMajorAxisKm: 1_221_900, eccentricity: 0.029, argumentOfPeriapsisDeg: 78.3, meanAnomalyDeg: 11.7, inclinationDeg: 0.3, ascendingNodeDeg: 78.6, periodDays: 15.945448, poleRaDeg: 36.4, poleDecDeg: 84 }),
  moon("hyperion", "Hyperion", "saturn", 135, "#927d67", { semiMajorAxisKm: 1_481_500, eccentricity: 0.105, argumentOfPeriapsisDeg: 214, meanAnomalyDeg: 122.9, inclinationDeg: 0.6, ascendingNodeDeg: 87.1, periodDays: 21.276658, poleRaDeg: 40.2, poleDecDeg: 83.6 }),
  moon("iapetus", "Iapetus", "saturn", 734.3, "#8b8173", { semiMajorAxisKm: 3_561_700, eccentricity: 0.028, argumentOfPeriapsisDeg: 254.5, meanAnomalyDeg: 74.8, inclinationDeg: 7.6, ascendingNodeDeg: 86.5, periodDays: 79.331002, poleRaDeg: 288.7, poleDecDeg: 78.9 }),
  moon("miranda", "Miranda", "uranus", 235.8, "#c7d1ce", { semiMajorAxisKm: 129_846, eccentricity: 0.001, argumentOfPeriapsisDeg: 154.8, meanAnomalyDeg: 73, inclinationDeg: 4.4, ascendingNodeDeg: 100.9, periodDays: 1.413479, ...URANUS_POLE }),
  moon("ariel", "Ariel", "uranus", 578.9, "#d5dedb", { semiMajorAxisKm: 190_929, eccentricity: 0.001, argumentOfPeriapsisDeg: 9.6, meanAnomalyDeg: 193.5, inclinationDeg: 0, ascendingNodeDeg: 0, periodDays: 2.520379, ...URANUS_POLE }),
  moon("umbriel", "Umbriel", "uranus", 584.7, "#777e7c", { semiMajorAxisKm: 265_986, eccentricity: 0.004, argumentOfPeriapsisDeg: 183.4, meanAnomalyDeg: 253, inclinationDeg: 0.1, ascendingNodeDeg: 174.8, periodDays: 4.144177, ...URANUS_POLE }),
  moon("titania", "Titania", "uranus", 788.9, "#b7c2bf", { semiMajorAxisKm: 436_298, eccentricity: 0.002, argumentOfPeriapsisDeg: 184, meanAnomalyDeg: 68.1, inclinationDeg: 0.1, ascendingNodeDeg: 29.5, periodDays: 8.705869, ...URANUS_POLE }),
  moon("oberon", "Oberon", "uranus", 761.4, "#949c9a", { semiMajorAxisKm: 583_511, eccentricity: 0.002, argumentOfPeriapsisDeg: 132.2, meanAnomalyDeg: 143.6, inclinationDeg: 0.1, ascendingNodeDeg: 76.8, periodDays: 13.463237, ...URANUS_POLE }),
  moon("triton", "Triton", "neptune", 1_352.6, "#c9bcb0", { semiMajorAxisKm: 354_800, eccentricity: 0, argumentOfPeriapsisDeg: 0, meanAnomalyDeg: 63, inclinationDeg: 157.3, ascendingNodeDeg: 178.1, periodDays: 5.876994, poleRaDeg: 299.8, poleDecDeg: 43.1 }),
  moon("proteus", "Proteus", "neptune", 208, "#77736f", { semiMajorAxisKm: 117_600, eccentricity: 0, argumentOfPeriapsisDeg: 0, meanAnomalyDeg: 276.8, inclinationDeg: 0, ascendingNodeDeg: 0, periodDays: 1.122315, poleRaDeg: 299.8, poleDecDeg: 42.6 }),
  moon("nereid", "Nereid", "neptune", 170, "#a4aaa7", { semiMajorAxisKm: 5_513_900, eccentricity: 0.751, argumentOfPeriapsisDeg: 296.8, meanAnomalyDeg: 318.5, inclinationDeg: 5.1, ascendingNodeDeg: 319.5, periodDays: 360.133039, epochMs: Date.UTC(2020, 0, 1), ...ECLIPTIC_POLE }),
  moon("charon", "Charon", "pluto", 606, "#aaa39a", { semiMajorAxisKm: 19_600, eccentricity: 0, argumentOfPeriapsisDeg: 0, meanAnomalyDeg: 304.1, inclinationDeg: 0, ascendingNodeDeg: 0, periodDays: 6.387222, ...PLUTO_POLE }),
  moon("styx", "Styx", "pluto", 5.2, "#8d8780", { semiMajorAxisKm: 43_200, eccentricity: 0.025, argumentOfPeriapsisDeg: 322.5, meanAnomalyDeg: 358.1, inclinationDeg: 0, ascendingNodeDeg: 0, periodDays: 20.16, ...PLUTO_POLE }),
  moon("nix", "Nix", "pluto", 18, "#c2bbb1", { semiMajorAxisKm: 49_300, eccentricity: 0.015, argumentOfPeriapsisDeg: 31.4, meanAnomalyDeg: 338.2, inclinationDeg: 0, ascendingNodeDeg: 0, periodDays: 24.85, ...PLUTO_POLE }),
  moon("kerberos", "Kerberos", "pluto", 6, "#857e76", { semiMajorAxisKm: 58_300, eccentricity: 0.01, argumentOfPeriapsisDeg: 32.1, meanAnomalyDeg: 276.1, inclinationDeg: 0.4, ascendingNodeDeg: 314.3, periodDays: 32.17, ...PLUTO_POLE }),
  moon("hydra", "Hydra", "pluto", 18.5, "#b5aea5", { semiMajorAxisKm: 65_200, eccentricity: 0.009, argumentOfPeriapsisDeg: 139.3, meanAnomalyDeg: 335, inclinationDeg: 0.3, ascendingNodeDeg: 114.3, periodDays: 38.2, ...PLUTO_POLE }),
];

export const BODY_DEFINITIONS: BodyDefinition[] = PRIMARY_BODY_DEFINITIONS.flatMap(
  (body) => [body, ...MOON_DEFINITIONS.filter((candidate) => candidate.parentId === body.id)],
);

const eclipticRotation = Rotation_EQJ_ECL();
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86_400_000;
const DEG_TO_RAD = Math.PI / 180;

function toScenePosition(vector: { x: number; y: number; z: number }): [number, number, number] {
  const clean = (value: number) => (Math.abs(value) < 1e-15 ? 0 : value);
  return [
    clean(vector.x * RENDER_UNITS_PER_AU),
    clean(vector.z * RENDER_UNITS_PER_AU),
    clean(-vector.y * RENDER_UNITS_PER_AU),
  ];
}

function toSceneDirection(vector: Vector): [number, number, number] {
  const ecliptic = RotateVector(eclipticRotation, vector);
  return [ecliptic.x, ecliptic.z, -ecliptic.y];
}

// Convert an orthonormal scene basis to Three's [x, y, z, w] quaternion format.
function quaternionFromBasis(
  xAxis: [number, number, number],
  yAxis: [number, number, number],
  zAxis: [number, number, number],
): [number, number, number, number] {
  const m11 = xAxis[0];
  const m12 = yAxis[0];
  const m13 = zAxis[0];
  const m21 = xAxis[1];
  const m22 = yAxis[1];
  const m23 = zAxis[1];
  const m31 = xAxis[2];
  const m32 = yAxis[2];
  const m33 = zAxis[2];
  const trace = m11 + m22 + m33;
  let x: number;
  let y: number;
  let z: number;
  let w: number;

  if (trace > 0) {
    const scale = 2 * Math.sqrt(trace + 1);
    x = (m32 - m23) / scale;
    y = (m13 - m31) / scale;
    z = (m21 - m12) / scale;
    w = scale / 4;
  } else if (m11 > m22 && m11 > m33) {
    const scale = 2 * Math.sqrt(1 + m11 - m22 - m33);
    x = scale / 4;
    y = (m12 + m21) / scale;
    z = (m13 + m31) / scale;
    w = (m32 - m23) / scale;
  } else if (m22 > m33) {
    const scale = 2 * Math.sqrt(1 + m22 - m11 - m33);
    x = (m12 + m21) / scale;
    y = scale / 4;
    z = (m23 + m32) / scale;
    w = (m13 - m31) / scale;
  } else {
    const scale = 2 * Math.sqrt(1 + m33 - m11 - m22);
    x = (m13 + m31) / scale;
    y = (m23 + m32) / scale;
    z = scale / 4;
    w = (m21 - m12) / scale;
  }

  const length = Math.hypot(x, y, z, w);
  return [x / length, y / length, z / length, w / length];
}

function calculateBodyOrientation(body: Body, date: Date): [number, number, number, number] {
  const axis = RotationAxis(body, date);
  const time = MakeTime(date);
  const rightAscension = axis.ra * 15 * DEG_TO_RAD;
  const spin = axis.spin * DEG_TO_RAD;
  const reference = new Vector(
    -Math.sin(rightAscension),
    Math.cos(rightAscension),
    0,
    time,
  );
  const east = new Vector(
    axis.north.y * reference.z - axis.north.z * reference.y,
    axis.north.z * reference.x - axis.north.x * reference.z,
    axis.north.x * reference.y - axis.north.y * reference.x,
    time,
  );
  const primeMeridian = new Vector(
    reference.x * Math.cos(spin) + east.x * Math.sin(spin),
    reference.y * Math.cos(spin) + east.y * Math.sin(spin),
    reference.z * Math.cos(spin) + east.z * Math.sin(spin),
    time,
  );
  // SphereGeometry maps its north pole to +Y and texture longitude zero to +X.
  const xAxis = toSceneDirection(primeMeridian);
  const yAxis = toSceneDirection(axis.north);
  const zAxis: [number, number, number] = [
    xAxis[1] * yAxis[2] - xAxis[2] * yAxis[1],
    xAxis[2] * yAxis[0] - xAxis[0] * yAxis[2],
    xAxis[0] * yAxis[1] - xAxis[1] * yAxis[0],
  ];
  return quaternionFromBasis(xAxis, yAxis, zAxis);
}

function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number) {
  let eccentricAnomaly = meanAnomaly;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    eccentricAnomaly -=
      (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly)
      / (1 - eccentricity * Math.cos(eccentricAnomaly));
  }
  return eccentricAnomaly;
}

function calculateMoonOffset(elements: OrbitalElements, date: Date): [number, number, number] {
  const elapsedDays = (date.getTime() - (elements.epochMs ?? J2000_MS)) / DAY_MS;
  const meanAnomaly = (elements.meanAnomalyDeg * DEG_TO_RAD + elapsedDays * Math.PI * 2 / elements.periodDays) % (Math.PI * 2);
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, elements.eccentricity);
  const trueAnomaly = 2 * Math.atan2(
    Math.sqrt(1 + elements.eccentricity) * Math.sin(eccentricAnomaly / 2),
    Math.sqrt(1 - elements.eccentricity) * Math.cos(eccentricAnomaly / 2),
  );
  const radius = elements.semiMajorAxisKm * (1 - elements.eccentricity * Math.cos(eccentricAnomaly));
  const argument = elements.argumentOfPeriapsisDeg * DEG_TO_RAD + trueAnomaly;
  const inclination = elements.inclinationDeg * DEG_TO_RAD;
  const node = elements.ascendingNodeDeg * DEG_TO_RAD;

  const localX = radius * (Math.cos(node) * Math.cos(argument) - Math.sin(node) * Math.sin(argument) * Math.cos(inclination));
  const localY = radius * (Math.sin(node) * Math.cos(argument) + Math.cos(node) * Math.sin(argument) * Math.cos(inclination));
  const localZ = radius * Math.sin(argument) * Math.sin(inclination);

  const ra = elements.poleRaDeg * DEG_TO_RAD;
  const dec = elements.poleDecDeg * DEG_TO_RAD;
  const pole = { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
  const xAxisLength = Math.hypot(pole.x, pole.y);
  const xAxis = { x: -pole.y / xAxisLength, y: pole.x / xAxisLength, z: 0 };
  const yAxis = {
    x: pole.y * xAxis.z - pole.z * xAxis.y,
    y: pole.z * xAxis.x - pole.x * xAxis.z,
    z: pole.x * xAxis.y - pole.y * xAxis.x,
  };
  const eqj = {
    x: xAxis.x * localX + yAxis.x * localY + pole.x * localZ,
    y: xAxis.y * localX + yAxis.y * localY + pole.y * localZ,
    z: xAxis.z * localX + yAxis.z * localY + pole.z * localZ,
  };
  const ecliptic = RotateVector(
    eclipticRotation,
    new Vector(eqj.x / KM_PER_AU, eqj.y / KM_PER_AU, eqj.z / KM_PER_AU, MakeTime(date)),
  );
  return toScenePosition(ecliptic);
}

export function calculateBodyStates(date: Date): BodyState[] {
  const primaryStates = PRIMARY_BODY_DEFINITIONS.map((definition): BodyState => {
    const vector = RotateVector(eclipticRotation, HelioVector(definition.astronomyBody, date));
    return {
      ...definition,
      position: toScenePosition(vector),
      orientation: calculateBodyOrientation(definition.astronomyBody, date),
      distanceFromSunAU: Math.hypot(vector.x, vector.y, vector.z),
      radiusUnits: definition.radiusKm / KM_PER_RENDER_UNIT,
    };
  });
  const primaryById = new Map(primaryStates.map((state) => [state.id, state]));

  const moonStates = MOON_DEFINITIONS.map((definition): BodyState => {
    let position: [number, number, number];
    if (definition.astronomyBody) {
      const vector = RotateVector(eclipticRotation, HelioVector(definition.astronomyBody, date));
      position = toScenePosition(vector);
    } else {
      const parent = primaryById.get(definition.parentId)!;
      const offset = calculateMoonOffset(definition.orbit!, date);
      position = [
        parent.position[0] + offset[0],
        parent.position[1] + offset[1],
        parent.position[2] + offset[2],
      ];
    }
    return {
      ...definition,
      position,
      orientation: definition.astronomyBody
        ? calculateBodyOrientation(definition.astronomyBody, date)
        : [0, 0, 0, 1],
      distanceFromSunAU: Math.hypot(...position) / RENDER_UNITS_PER_AU,
      radiusUnits: definition.radiusKm / KM_PER_RENDER_UNIT,
    };
  });
  const moonById = new Map(moonStates.map((state) => [state.id, state]));

  return BODY_DEFINITIONS.map((definition) =>
    primaryById.get(definition.id as PrimaryBodyId) ?? moonById.get(definition.id as MoonId)!,
  );
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
