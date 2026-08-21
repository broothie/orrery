import { createGunzip } from "node:zlib";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";
import { URL } from "node:url";

const SOURCE_URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v40.csv.gz";
const OUTPUT_PATH = new URL("../public/data/hyg-v4-mag7.bin", import.meta.url);
const MAX_MAGNITUDE = 7;
const OBLIQUITY = 23.4392911 * Math.PI / 180;
const RECORD_FLOATS = 5;
const HEADER_BYTES = 16;
const MAGIC = 0x52415453;

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

const response = await globalThis.fetch(SOURCE_URL);
if (!response.ok || !response.body) {
  throw new Error(`Unable to download HYG catalog: ${response.status}`);
}

const lines = createInterface({
  input: Readable.fromWeb(response.body).pipe(createGunzip()),
  crlfDelay: Infinity,
});
const records = [];
let columns;

for await (const line of lines) {
  const fields = parseCsvLine(line);
  if (!columns) {
    columns = new Map(fields.map((field, index) => [field, index]));
    continue;
  }

  const magnitude = Number(fields[columns.get("mag")]);
  const rightAscension = Number(fields[columns.get("rarad")]);
  const declination = Number(fields[columns.get("decrad")]);
  if (
    fields[columns.get("proper")] === "Sol"
    || !Number.isFinite(magnitude)
    || magnitude > MAX_MAGNITUDE
    || !Number.isFinite(rightAscension)
    || !Number.isFinite(declination)
  ) {
    continue;
  }

  const cosDeclination = Math.cos(declination);
  const equatorialX = cosDeclination * Math.cos(rightAscension);
  const equatorialY = cosDeclination * Math.sin(rightAscension);
  const equatorialZ = Math.sin(declination);
  const eclipticX = equatorialX;
  const eclipticY = Math.cos(OBLIQUITY) * equatorialY + Math.sin(OBLIQUITY) * equatorialZ;
  const eclipticZ = -Math.sin(OBLIQUITY) * equatorialY + Math.cos(OBLIQUITY) * equatorialZ;
  const colorIndex = Number(fields[columns.get("ci")]);

  records.push([
    eclipticX,
    eclipticZ,
    -eclipticY,
    magnitude,
    Number.isFinite(colorIndex) ? colorIndex : 0.65,
  ]);
}

records.sort((a, b) => a[3] - b[3]);
const output = Buffer.allocUnsafe(HEADER_BYTES + records.length * RECORD_FLOATS * 4);
output.writeUInt32LE(MAGIC, 0);
output.writeUInt32LE(1, 4);
output.writeUInt32LE(records.length, 8);
output.writeUInt32LE(RECORD_FLOATS, 12);
let offset = HEADER_BYTES;
for (const record of records) {
  for (const value of record) {
    output.writeFloatLE(value, offset);
    offset += 4;
  }
}

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(OUTPUT_PATH, output);
globalThis.console.log(`Wrote ${records.length.toLocaleString()} stars to ${OUTPUT_PATH.pathname}`);
