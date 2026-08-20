import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { BodyId, BodyState } from "./astronomy";

export interface BodyIndicator {
  id: BodyId;
  name: string;
  color: string;
  x: number;
  y: number;
  angle: number;
  edge: boolean;
}

interface SolarSystemProps {
  bodies: BodyState[];
  selectedId: BodyId;
  focusSequence: number;
  overviewSequence: number;
  onSelect: (id: BodyId) => void;
  onIndicators: (indicators: BodyIndicator[]) => void;
}

function BodyMeshes({
  bodies,
  selectedId,
  onSelect,
}: Pick<SolarSystemProps, "bodies" | "selectedId" | "onSelect">) {
  const origin = bodies.find((body) => body.id === selectedId)!.position;
  const selected = bodies.find((body) => body.id === selectedId)!;
  const sun = bodies[0];
  const sunPosition = new THREE.Vector3(
    sun.position[0] - origin[0],
    sun.position[1] - origin[1],
    sun.position[2] - origin[2],
  );
  const adaptivePower = Math.max(
    50_000,
    selected.distanceFromSunAU * selected.distanceFromSunAU * 50_000,
  );

  return (
    <>
      <ambientLight intensity={0.012} />
      <pointLight
        position={sunPosition}
        intensity={adaptivePower}
        decay={2}
        distance={0}
      />

      {bodies.map((body) => {
        const position: [number, number, number] = [
          body.position[0] - origin[0],
          body.position[1] - origin[1],
          body.position[2] - origin[2],
        ];
        const isSun = body.id === "sun";
        const detail = body.radiusUnits > 0.05 ? 48 : 28;

        return (
          <mesh
            key={body.id}
            position={position}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(body.id);
            }}
          >
            <sphereGeometry args={[body.radiusUnits, detail, Math.max(16, detail / 2)]} />
            {isSun ? (
              <meshBasicMaterial color={body.color} toneMapped={false} />
            ) : (
              <meshStandardMaterial color={body.color} roughness={0.82} metalness={0} />
            )}
          </mesh>
        );
      })}
    </>
  );
}

function CameraRig({
  bodies,
  selectedId,
  focusSequence,
  overviewSequence,
}: Pick<
  SolarSystemProps,
  "bodies" | "selectedId" | "focusSequence" | "overviewSequence"
>) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const selected = bodies.find((body) => body.id === selectedId)!;
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    if (!focusSequence) return;

    const direction = camera.position.clone().normalize();
    if (direction.lengthSq() === 0) direction.set(0.35, 0.22, 1);
    const distance = Math.max(selected.radiusUnits * 7, 0.018);
    camera.position.copy(direction.multiplyScalar(distance));
    camera.near = Math.max(selected.radiusUnits / 10_000, 1e-8);
    camera.far = 50_000;
    camera.updateProjectionMatrix();
    controls.current?.target.set(0, 0, 0);
    if (controls.current) {
      controls.current.minDistance = Math.max(selected.radiusUnits * 1.08, 1e-7);
      controls.current.update();
    }
  }, [camera, focusSequence, selected]);

  useEffect(() => {
    if (!overviewSequence) return;
    camera.position.set(5_400, 3_200, 9_500);
    camera.near = 0.00001;
    camera.far = 50_000;
    camera.updateProjectionMatrix();
    controls.current?.target.set(0, 0, 0);
    if (controls.current) {
      controls.current.minDistance = 0.0001;
      controls.current.update();
    }
  }, [camera, overviewSequence]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan
      screenSpacePanning
      zoomSpeed={1.35}
      panSpeed={0.8}
      rotateSpeed={0.55}
      minDistance={0.0001}
      maxDistance={30_000}
    />
  );
}

function IndicatorBridge({
  bodies,
  selectedId,
  onIndicators,
}: Pick<SolarSystemProps, "bodies" | "selectedId" | "onIndicators">) {
  const { camera, size } = useThree();
  const lastUpdate = useRef(0);

  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastUpdate.current < 0.08) return;
    lastUpdate.current = clock.elapsedTime;

    const origin = bodies.find((body) => body.id === selectedId)!.position;
    const compact = size.width <= 820;
    const leftInset = compact ? 0 : 154;
    const topInset = compact ? 60 : 68;
    const bottomInset = compact ? 180 : 92;
    const centerX = (leftInset + size.width) / 2;
    const centerY = (topInset + size.height - bottomInset) / 2;
    const margin = 46;
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);

    const indicators = bodies
      .filter((body) => body.id !== selectedId)
      .map((body): BodyIndicator | null => {
        const world = new THREE.Vector3(
          body.position[0] - origin[0],
          body.position[1] - origin[1],
          body.position[2] - origin[2],
        );
        const cameraSpace = world.clone().applyMatrix4(camera.matrixWorldInverse);
        const behind = cameraSpace.z > 0;
        const distance = camera.position.distanceTo(world);
        const pixelRadius =
          (body.radiusUnits * size.height) /
          (2 * Math.tan(fov / 2) * Math.max(distance, 1e-9));
        const projected = world.clone().project(camera);

        const screenX = (projected.x * 0.5 + 0.5) * size.width;
        const screenY = (-projected.y * 0.5 + 0.5) * size.height;
        let dx = screenX - centerX;
        let dy = screenY - centerY;
        if (behind) {
          dx = -dx;
          dy = -dy;
        }
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;

        const offscreen =
          behind ||
          screenX < leftInset + margin ||
          screenX > size.width - margin ||
          screenY < topInset + margin ||
          screenY > size.height - bottomInset - margin;
        const tooSmall = pixelRadius < 3.5;
        if (!offscreen && !tooSmall) return null;

        if (offscreen) {
          const scale = Math.min(
            (centerX - leftInset - margin) / Math.max(Math.abs(dx), 1),
            (size.width - centerX - margin) / Math.max(Math.abs(dx), 1),
            (centerY - topInset - margin) / Math.max(Math.abs(dy), 1),
            (size.height - bottomInset - centerY - margin) / Math.max(Math.abs(dy), 1),
          );
          return {
            id: body.id,
            name: body.name,
            color: body.color,
            x: centerX + dx * scale,
            y: centerY + dy * scale,
            angle: Math.atan2(dy, dx) * (180 / Math.PI),
            edge: true,
          };
        }

        return {
          id: body.id,
          name: body.name,
          color: body.color,
          x: (projected.x * 0.5 + 0.5) * size.width,
          y: (-projected.y * 0.5 + 0.5) * size.height,
          angle: 0,
          edge: false,
        };
      })
      .filter((item): item is BodyIndicator => item !== null);

    const edgeIndicators = indicators
      .filter((indicator) => indicator.edge)
      .sort((a, b) => a.y - b.y);
    const minY = topInset + margin;
    const maxY = size.height - bottomInset - margin;
    for (let index = 0; index < edgeIndicators.length; index += 1) {
      const previous = edgeIndicators[index - 1];
      edgeIndicators[index].y = Math.max(
        minY,
        previous ? previous.y + 30 : edgeIndicators[index].y,
      );
    }
    for (let index = edgeIndicators.length - 1; index >= 0; index -= 1) {
      const next = edgeIndicators[index + 1];
      edgeIndicators[index].y = Math.min(
        maxY,
        next ? next.y - 30 : edgeIndicators[index].y,
      );
    }

    onIndicators(indicators);
  });

  return null;
}

export function SolarSystem(props: SolarSystemProps) {
  const sceneKey = useMemo(() => props.bodies[0]?.position.join(":"), [props.bodies]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [5_400, 3_200, 9_500], fov: 45, near: 0.00001, far: 50_000 }}
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.9;
      }}
    >
      <color attach="background" args={["#030508"]} />
      <fogExp2 attach="fog" args={["#030508", 0.000008]} />
      <Stars radius={14_000} depth={7_000} count={4_500} factor={8} saturation={0.12} fade speed={0.15} />
      <group key={sceneKey}>
        <BodyMeshes bodies={props.bodies} selectedId={props.selectedId} onSelect={props.onSelect} />
      </group>
      <CameraRig
        bodies={props.bodies}
        selectedId={props.selectedId}
        focusSequence={props.focusSequence}
        overviewSequence={props.overviewSequence}
      />
      <IndicatorBridge
        bodies={props.bodies}
        selectedId={props.selectedId}
        onIndicators={props.onIndicators}
      />
    </Canvas>
  );
}
