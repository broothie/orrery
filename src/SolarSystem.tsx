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
  angle: number;
  selected: boolean;
}

interface ProjectedIndicator extends Omit<BodyIndicator, "x" | "y" | "angle"> {
  targetX: number;
  targetY: number;
  width: number;
}

function crowdIndicators(
  projected: ProjectedIndicator[],
  width: number,
  leftInset: number,
  topInset: number,
) {
  const calloutHeight = 50;
  const horizontalGap = 8;
  const verticalGap = 6;
  const minY = topInset + calloutHeight / 2 + 8;
  const occupied: Array<{ x: number; y: number; width: number }> = [];
  const slotOrder = [0, -1, 1, -2, 2, -3, 3, -4, 4];

  return [...projected]
    .sort((a, b) => a.targetY - b.targetY || a.targetX - b.targetX)
    .map((indicator): BodyIndicator => {
      const desiredY = indicator.targetY - 28;
      let placement: { x: number; y: number } | undefined;

      for (let row = 0; row < 5 && !placement; row += 1) {
        const y = Math.max(minY, desiredY - row * (calloutHeight + verticalGap));
        for (const slot of slotOrder) {
          const x = THREE.MathUtils.clamp(
            indicator.targetX + slot * (indicator.width + horizontalGap),
            leftInset + indicator.width / 2 + 10,
            width - indicator.width / 2 - 10,
          );
          const overlaps = occupied.some((item) =>
            Math.abs(item.x - x) < (item.width + indicator.width) / 2 + horizontalGap
            && Math.abs(item.y - y) < calloutHeight + verticalGap,
          );
          if (!overlaps) {
            placement = { x, y };
            break;
          }
        }
      }

      const x = placement?.x ?? THREE.MathUtils.clamp(
        indicator.targetX,
        leftInset + indicator.width / 2 + 10,
        width - indicator.width / 2 - 10,
      );
      const y = placement?.y ?? Math.max(minY, desiredY);
      occupied.push({ x, y, width: indicator.width });

      return {
        id: indicator.id,
        name: indicator.name,
        color: indicator.color,
        selected: indicator.selected,
        x,
        y,
        angle: Math.atan2(indicator.targetY - y, indicator.targetX - x) * (180 / Math.PI) - 90,
      };
    });
}

interface SolarSystemProps {
  bodies: BodyState[];
  focusedId: BodyId;
  selectedIds: ReadonlySet<BodyId>;
  focusSequence: number;
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
  selectedIds,
  focusSequence,
}: Pick<
  SolarSystemProps,
  "bodies" | "focusedId" | "selectedIds" | "focusSequence"
>) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const initialized = useRef(false);
  const isGroupSelection = selectedIds.size > 1;

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    if (!focusSequence) return;

    const origin = bodies.find((body) => body.id === focusedId)!.position;
    const selectedBodies = bodies.filter((body) => selectedIds.has(body.id));
    const bounds = new THREE.Box3();
    selectedBodies.forEach((body) => {
      const position = new THREE.Vector3(
        body.position[0] - origin[0],
        body.position[1] - origin[1],
        body.position[2] - origin[2],
      );
      const radius = new THREE.Vector3(
        body.radiusUnits,
        body.radiusUnits,
        body.radiusUnits,
      );
      bounds.expandByPoint(position.clone().sub(radius));
      bounds.expandByPoint(position.clone().add(radius));
    });

    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(
      ...selectedBodies.map((body) => {
        const position = new THREE.Vector3(
          body.position[0] - origin[0],
          body.position[1] - origin[1],
          body.position[2] - origin[2],
        );
        return position.distanceTo(center) + body.radiusUnits;
      }),
    );
    const currentTarget = controls.current?.target ?? new THREE.Vector3();
    const direction = camera.position.clone().sub(currentTarget).normalize();
    if (direction.lengthSq() === 0) direction.set(0.35, 0.22, 1);
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const verticalFov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
    const horizontalFov = 2 * Math.atan(
      Math.tan(verticalFov / 2) * perspectiveCamera.aspect,
    );
    const fitFov = Math.min(verticalFov, horizontalFov);
    const distance = isGroupSelection
      ? Math.max(radius / Math.sin(fitFov / 2) * 1.15, 0.018)
      : Math.max(radius * 7, 0.018);
    camera.position.copy(center).add(direction.multiplyScalar(distance));
    camera.near = Math.max(radius / 10_000, 1e-8);
    camera.far = Math.max(50_000, distance * 4);
    camera.updateProjectionMatrix();
    controls.current?.target.copy(center);
    if (controls.current) {
      controls.current.minDistance = Math.max(radius * 1.08, 1e-7);
      controls.current.update();
    }
  }, [bodies, camera, focusSequence, focusedId, isGroupSelection, selectedIds]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={!isGroupSelection}
      enableZoom={!isGroupSelection}
      screenSpacePanning
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
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

    const projectedIndicators = bodies
      .map((body): ProjectedIndicator | null => {
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
          targetX: screenX,
          targetY: screenY,
          width: 42 + body.name.length * 6,
          selected: selectedIds.has(body.id),
        };
      })
      .filter((item): item is ProjectedIndicator => item !== null);

    onIndicators(crowdIndicators(
      projectedIndicators,
      size.width,
      leftInset,
      topInset,
    ));
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
        selectedIds={props.selectedIds}
        focusSequence={props.focusSequence}
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
