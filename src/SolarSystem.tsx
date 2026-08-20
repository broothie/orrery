import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { BodyId, BodyState } from "./astronomy";

export interface BodyIndicator {
  id: BodyId;
  name: string;
  color: string;
  x: number;
  y: number;
  selected: boolean;
}

interface SolarSystemProps {
  bodies: BodyState[];
  focusedId: BodyId;
  selectedIds: ReadonlySet<BodyId>;
  focusSequence: number;
  overviewSequence: number;
  onSelect: (id: BodyId, additive?: boolean) => void;
  onIndicators: (indicators: BodyIndicator[]) => void;
}

function BodyMeshes({
  bodies,
  focusedId,
  selectedIds,
  onSelect,
}: Pick<SolarSystemProps, "bodies" | "focusedId" | "selectedIds" | "onSelect">) {
  const origin = bodies.find((body) => body.id === focusedId)!.position;
  const focused = bodies.find((body) => body.id === focusedId)!;
  const sun = bodies[0];
  const sunPosition = new THREE.Vector3(
    sun.position[0] - origin[0],
    sun.position[1] - origin[1],
    sun.position[2] - origin[2],
  );
  const adaptivePower = Math.max(
    50_000,
    focused.distanceFromSunAU * focused.distanceFromSunAU * 50_000,
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
        const isSelected = selectedIds.has(body.id);
        const detail = body.radiusUnits > 0.05 ? 48 : 28;

        return (
          <mesh
            key={body.id}
            position={position}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(
                body.id,
                event.nativeEvent.metaKey || event.nativeEvent.ctrlKey,
              );
            }}
          >
            <sphereGeometry args={[body.radiusUnits, detail, Math.max(16, detail / 2)]} />
            {isSun ? (
              <meshBasicMaterial color={body.color} toneMapped={false} />
            ) : (
              <meshStandardMaterial
                color={body.color}
                roughness={0.82}
                metalness={0}
                emissive={isSelected ? body.color : "#000000"}
                emissiveIntensity={isSelected ? 0.07 : 0}
              />
            )}
          </mesh>
        );
      })}
    </>
  );
}

function CameraRig({
  bodies,
  focusedId,
  focusSequence,
  overviewSequence,
}: Pick<
  SolarSystemProps,
  "bodies" | "focusedId" | "focusSequence" | "overviewSequence"
>) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const focused = bodies.find((body) => body.id === focusedId)!;
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    if (!focusSequence) return;

    const direction = camera.position.clone().normalize();
    if (direction.lengthSq() === 0) direction.set(0.35, 0.22, 1);
    const distance = Math.max(focused.radiusUnits * 7, 0.018);
    camera.position.copy(direction.multiplyScalar(distance));
    camera.near = Math.max(focused.radiusUnits / 10_000, 1e-8);
    camera.far = 50_000;
    camera.updateProjectionMatrix();
    controls.current?.target.set(0, 0, 0);
    if (controls.current) {
      controls.current.minDistance = Math.max(focused.radiusUnits * 1.08, 1e-7);
      controls.current.update();
    }
  }, [camera, focusSequence, focused]);

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
  focusedId,
  selectedIds,
  onIndicators,
}: Pick<
  SolarSystemProps,
  "bodies" | "focusedId" | "selectedIds" | "onIndicators"
>) {
  const { camera, size } = useThree();
  const lastUpdate = useRef(0);

  useFrame(({ clock }) => {
    if (clock.elapsedTime - lastUpdate.current < 0.08) return;
    lastUpdate.current = clock.elapsedTime;

    const origin = bodies.find((body) => body.id === focusedId)!.position;
    const compact = size.width <= 820;
    const leftInset = compact ? 0 : 154;
    const topInset = compact ? 60 : 68;
    const bottomInset = compact ? 180 : 92;
    const margin = 46;
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);

    const indicators = bodies
      .filter((body) => body.id !== focusedId)
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
        if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return null;

        const offscreen =
          behind ||
          screenX < leftInset + margin ||
          screenX > size.width - margin ||
          screenY < topInset + margin ||
          screenY > size.height - bottomInset - margin;
        const tooSmall = pixelRadius < 3.5;
        if (offscreen || !tooSmall) return null;

        return {
          id: body.id,
          name: body.name,
          color: body.color,
          x: (projected.x * 0.5 + 0.5) * size.width,
          y: (-projected.y * 0.5 + 0.5) * size.height,
          selected: selectedIds.has(body.id),
        };
      })
      .filter((item): item is BodyIndicator => item !== null);

    onIndicators(indicators);
  });

  return null;
}

export function SolarSystem(props: SolarSystemProps) {
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
      <BodyMeshes
        bodies={props.bodies}
        focusedId={props.focusedId}
        selectedIds={props.selectedIds}
        onSelect={props.onSelect}
      />
      <CameraRig
        bodies={props.bodies}
        focusedId={props.focusedId}
        focusSequence={props.focusSequence}
        overviewSequence={props.overviewSequence}
      />
      <IndicatorBridge
        bodies={props.bodies}
        focusedId={props.focusedId}
        selectedIds={props.selectedIds}
        onIndicators={props.onIndicators}
      />
    </Canvas>
  );
}
