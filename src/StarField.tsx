import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const CATALOG_URL = `${import.meta.env.BASE_URL}data/hyg-v4-mag7.bin`;
const CATALOG_MAGIC = 0x52415453;
const STAR_RADIUS = 24_000;

interface StarCatalog {
  positions: Float32Array;
  magnitudes: Float32Array;
  colors: Float32Array;
}

function colorFromIndex(index: number): [number, number, number] {
  const anchors: Array<[number, [number, number, number]]> = [
    [-0.4, [0.64, 0.74, 1]],
    [0, [0.78, 0.84, 1]],
    [0.65, [1, 0.96, 0.86]],
    [1.5, [1, 0.68, 0.43]],
    [2.1, [1, 0.48, 0.28]],
  ];
  const clamped = THREE.MathUtils.clamp(index, anchors[0][0], anchors.at(-1)![0]);
  const upperIndex = anchors.findIndex(([value]) => value >= clamped);
  if (upperIndex <= 0) return anchors[0][1];
  const [lowerValue, lowerColor] = anchors[upperIndex - 1];
  const [upperValue, upperColor] = anchors[upperIndex];
  const amount = (clamped - lowerValue) / (upperValue - lowerValue);
  return [
    THREE.MathUtils.lerp(lowerColor[0], upperColor[0], amount),
    THREE.MathUtils.lerp(lowerColor[1], upperColor[1], amount),
    THREE.MathUtils.lerp(lowerColor[2], upperColor[2], amount),
  ];
}

function parseCatalog(buffer: ArrayBuffer): StarCatalog {
  const view = new DataView(buffer);
  if (view.byteLength < 16 || view.getUint32(0, true) !== CATALOG_MAGIC) {
    throw new Error("Invalid star catalog header");
  }
  const version = view.getUint32(4, true);
  const count = view.getUint32(8, true);
  const recordFloats = view.getUint32(12, true);
  if (version !== 1 || recordFloats !== 5 || view.byteLength !== 16 + count * recordFloats * 4) {
    throw new Error("Unsupported star catalog format");
  }

  const records = new Float32Array(buffer, 16);
  const positions = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const recordOffset = index * recordFloats;
    const positionOffset = index * 3;
    positions[positionOffset] = records[recordOffset] * STAR_RADIUS;
    positions[positionOffset + 1] = records[recordOffset + 1] * STAR_RADIUS;
    positions[positionOffset + 2] = records[recordOffset + 2] * STAR_RADIUS;
    magnitudes[index] = records[recordOffset + 3];
    colors.set(colorFromIndex(records[recordOffset + 4]), positionOffset);
  }
  return { positions, magnitudes, colors };
}

export function StarField() {
  const group = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const [catalog, setCatalog] = useState<StarCatalog>();

  useEffect(() => {
    const controller = new AbortController();
    fetch(CATALOG_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load star catalog: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => setCatalog(parseCatalog(buffer)))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      });
    return () => controller.abort();
  }, []);

  useFrame(() => {
    group.current?.position.copy(camera.position);
  });

  const uniforms = useMemo(() => ({
    pixelRatio: { value: gl.getPixelRatio() },
  }), [gl]);

  if (!catalog) return null;

  return (
    <group ref={group}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[catalog.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[catalog.colors, 3]} />
          <bufferAttribute attach="attributes-magnitude" args={[catalog.magnitudes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={uniforms}
          vertexColors
          transparent
          depthWrite={false}
          toneMapped={false}
          vertexShader={`
            attribute float magnitude;
            varying vec3 starColor;
            varying float starAlpha;
            uniform float pixelRatio;

            void main() {
              vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * viewPosition;
              gl_PointSize = clamp(5.8 - magnitude * 0.62, 0.8, 5.2) * pixelRatio;
              starColor = color;
              starAlpha = clamp((7.25 - magnitude) / 5.5, 0.12, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 starColor;
            varying float starAlpha;

            void main() {
              float radius = length(gl_PointCoord - vec2(0.5));
              float alpha = 1.0 - smoothstep(0.28, 0.5, radius);
              if (alpha <= 0.0) discard;
              gl_FragColor = vec4(starColor, alpha * starAlpha);
            }
          `}
        />
      </points>
    </group>
  );
}
