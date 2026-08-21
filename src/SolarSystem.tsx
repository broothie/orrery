import { OrbitControls, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { BodyId, BodyState } from "./astronomy";
import { StarField } from "./StarField";

const BODY_TEXTURES: Partial<Record<BodyId, string>> = {
  sun: "sun.jpg",
  mercury: "mercury.jpg",
  venus: "venus.jpg",
  earth: "earth.jpg",
  moon: "moon.jpg",
  mars: "mars.jpg",
  jupiter: "jupiter.jpg",
  saturn: "saturn.jpg",
  uranus: "uranus.jpg",
  neptune: "neptune.jpg",
};

export interface BodyIndicator {
  id: BodyId;
  name: string;
  color: string;
  x: number;
  y: number;
  labelOffsetX: number;
  labelOffsetY: number;
  selected: boolean;
  showReticle: boolean;
}

interface ProjectedIndicator extends Omit<BodyIndicator, "x" | "y" | "labelOffsetX" | "labelOffsetY"> {
  targetX: number;
  targetY: number;
  labelLeft: number;
  width: number;
}

function crowdIndicators(
  projected: ProjectedIndicator[],
  height: number,
  topInset: number,
  bottomInset: number,
) {
  const labelHeight = 18;
  const horizontalGap = 6;
  const minY = topInset + labelHeight / 2 + 8;
  const maxY = height - bottomInset - labelHeight / 2 - 8;
  const occupied: Array<{ left: number; right: number; y: number }> = [];
  const offsetOrder = Array.from({ length: 17 }, (_, index) => {
    if (index === 0) return 0;
    const distance = Math.ceil(index / 2) * (labelHeight + 3);
    return index % 2 === 1 ? -distance : distance;
  });

  return [...projected]
    .sort((a, b) => a.targetY - b.targetY || a.targetX - b.targetX)
    .map((indicator): BodyIndicator => {
      const labelRight = indicator.labelLeft + indicator.width;
      const labelY = offsetOrder
        .map((offset) => THREE.MathUtils.clamp(indicator.targetY + offset, minY, maxY))
        .find((candidateY) => !occupied.some((item) =>
          indicator.labelLeft < item.right + horizontalGap
          && labelRight + horizontalGap > item.left
          && Math.abs(candidateY - item.y) < labelHeight + 3,
        )) ?? THREE.MathUtils.clamp(indicator.targetY, minY, maxY);
      occupied.push({ left: indicator.labelLeft, right: labelRight, y: labelY });

      return {
        id: indicator.id,
        name: indicator.name,
        color: indicator.color,
        selected: indicator.selected,
        showReticle: indicator.showReticle,
        x: indicator.targetX,
        y: indicator.targetY,
        labelOffsetX: indicator.labelLeft - indicator.targetX,
        labelOffsetY: labelY - indicator.targetY,
      };
    });
}

interface SolarSystemProps {
  bodies: BodyState[];
  focusedId: BodyId;
  selectedIds: ReadonlySet<BodyId>;
  visibleIds: ReadonlySet<BodyId>;
  focusSequence: number;
  onSelect: (id: BodyId, additive?: boolean) => void;
  onClearSelection: () => void;
  onIndicators: (indicators: BodyIndicator[]) => void;
}

interface BodyMeshProps {
  body: BodyState;
  position: [number, number, number];
  selected: boolean;
  loadTexture: boolean;
  onSelect: SolarSystemProps["onSelect"];
}

interface BodyMaterialProps {
  body: BodyState;
  selected: boolean;
  textureFile: string;
}

function BodyMaterial({ body, selected, textureFile }: BodyMaterialProps) {
  const { gl } = useThree();
  const isSun = body.id === "sun";
  const texture = useTexture(`${import.meta.env.BASE_URL}textures/${textureFile}`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());

  return (
    isSun ? (
      <meshBasicMaterial
        color={texture ? "#ffffff" : body.color}
        map={texture ?? undefined}
        toneMapped={false}
      />
    ) : (
      <meshStandardMaterial
        color={texture ? "#b0b0b0" : body.color}
        map={texture ?? undefined}
        roughness={0.82}
        metalness={0}
        emissive={texture ? "#ffffff" : selected ? body.color : "#000000"}
        emissiveMap={texture ?? undefined}
        emissiveIntensity={texture ? 0.035 : selected ? 0.07 : 0}
      />
    )
  );
}

function BodyMesh({ body, position, selected, loadTexture, onSelect }: BodyMeshProps) {
  const detail = body.radiusUnits > 0.05 ? 48 : 28;
  const textureFile = BODY_TEXTURES[body.id];
  const isSun = body.id === "sun";

  return (
    <mesh
      position={position}
      quaternion={body.orientation}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(
          body.id,
          event.nativeEvent.metaKey || event.nativeEvent.ctrlKey,
        );
      }}
    >
      <sphereGeometry args={[body.radiusUnits, detail, Math.max(16, detail / 2)]} />
      {loadTexture && textureFile ? (
        <Suspense fallback={isSun ? (
          <meshBasicMaterial color={body.color} toneMapped={false} />
        ) : (
          <meshStandardMaterial
            color={body.color}
            roughness={0.82}
            metalness={0}
            emissive={selected ? body.color : "#000000"}
            emissiveIntensity={selected ? 0.07 : 0}
          />
        )}>
          <BodyMaterial body={body} selected={selected} textureFile={textureFile} />
        </Suspense>
      ) : isSun ? (
        <meshBasicMaterial color={body.color} toneMapped={false} />
      ) : (
        <meshStandardMaterial
          color={body.color}
          roughness={0.82}
          metalness={0}
          emissive={selected ? body.color : "#000000"}
          emissiveIntensity={selected ? 0.07 : 0}
        />
      )}
    </mesh>
  );
}

function BodyMeshes({
  bodies,
  focusedId,
  selectedIds,
  visibleIds,
  onSelect,
}: Pick<SolarSystemProps, "bodies" | "focusedId" | "selectedIds" | "visibleIds" | "onSelect">) {
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

      {bodies.filter((body) => visibleIds.has(body.id)).map((body) => {
        const position: [number, number, number] = [
          body.position[0] - origin[0],
          body.position[1] - origin[1],
          body.position[2] - origin[2],
        ];
        return (
          <BodyMesh
            key={body.id}
            body={body}
            position={position}
            selected={selectedIds.has(body.id)}
            loadTexture={selectedIds.has(body.id)}
            onSelect={onSelect}
          />
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
  onClearSelection,
}: Pick<
  SolarSystemProps,
  "bodies" | "focusedId" | "selectedIds" | "focusSequence" | "onClearSelection"
>) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, gl } = useThree();
  const initialized = useRef(false);
  const lastFitSequence = useRef(0);
  const panPointer = useRef<{
    id: number;
    startX: number;
    startY: number;
    cleared: boolean;
  } | null>(null);
  const isGroupSelection = selectedIds.size > 1;

  useEffect(() => {
    const element = gl.domElement;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 2 || selectedIds.size === 0) return;
      panPointer.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        cleared: false,
      };
      if (controls.current) controls.current.enablePan = true;
    };
    const handlePointerMove = (event: PointerEvent) => {
      const pointer = panPointer.current;
      if (!pointer || pointer.id !== event.pointerId || pointer.cleared) return;
      if (Math.hypot(
        event.clientX - pointer.startX,
        event.clientY - pointer.startY,
      ) < 4) return;
      pointer.cleared = true;
      onClearSelection();
    };
    const handlePointerEnd = (event: PointerEvent) => {
      const pointer = panPointer.current;
      if (!pointer || pointer.id !== event.pointerId) return;
      if (!pointer.cleared && controls.current) {
        controls.current.enablePan = !isGroupSelection;
      }
      panPointer.current = null;
    };

    element.addEventListener("pointerdown", handlePointerDown, true);
    element.addEventListener("pointermove", handlePointerMove, true);
    element.addEventListener("pointerup", handlePointerEnd, true);
    element.addEventListener("pointercancel", handlePointerEnd, true);
    return () => {
      element.removeEventListener("pointerdown", handlePointerDown, true);
      element.removeEventListener("pointermove", handlePointerMove, true);
      element.removeEventListener("pointerup", handlePointerEnd, true);
      element.removeEventListener("pointercancel", handlePointerEnd, true);
    };
  }, [gl, isGroupSelection, onClearSelection, selectedIds.size]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    if (!focusSequence) return;

    const origin = bodies.find((body) => body.id === focusedId)!.position;
    const selectedBodies = bodies.filter((body) => selectedIds.has(body.id));
    if (selectedBodies.length === 0) return;
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
    const minDistance = Math.max(radius * 1.08, 1e-7);

    if (lastFitSequence.current === focusSequence) {
      camera.position.add(center.clone().sub(currentTarget));
      controls.current?.target.copy(center);
      if (controls.current) {
        controls.current.minDistance = minDistance;
        controls.current.update();
      }
      return;
    }

    lastFitSequence.current = focusSequence;
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
      controls.current.minDistance = minDistance;
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
      enableZoom
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
  visibleIds,
  onIndicators,
}: Pick<
  SolarSystemProps,
  "bodies" | "focusedId" | "selectedIds" | "visibleIds" | "onIndicators"
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
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);

    const projectedIndicators = bodies
      .filter((body) => visibleIds.has(body.id))
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

        const visibleRadius = Math.max(pixelRadius, 0);
        const offscreen =
          behind ||
          screenX + visibleRadius < leftInset ||
          screenX - visibleRadius > size.width ||
          screenY + visibleRadius < topInset ||
          screenY - visibleRadius > size.height - bottomInset;
        const tooSmall = pixelRadius < 3.5;
        if (offscreen) return null;

        const labelWidth = 12 + body.name.length * 6;
        const labelGap = Math.max(pixelRadius, 4) + (tooSmall ? 10 : 16);
        const rightLabelLeft = screenX + labelGap;
        const leftLabelLeft = screenX - labelGap - labelWidth;
        const minLabelLeft = leftInset + 8;
        const maxLabelLeft = size.width - labelWidth - 8;
        const labelLeft = rightLabelLeft <= maxLabelLeft
          ? rightLabelLeft
          : leftLabelLeft >= minLabelLeft
            ? leftLabelLeft
            : THREE.MathUtils.clamp(rightLabelLeft, minLabelLeft, maxLabelLeft);

        return {
          id: body.id,
          name: body.name,
          color: body.color,
          targetX: screenX,
          targetY: screenY,
          labelLeft,
          width: labelWidth,
          selected: selectedIds.has(body.id),
          showReticle: tooSmall,
        };
      })
      .filter((item): item is ProjectedIndicator => item !== null);

    onIndicators(crowdIndicators(
      projectedIndicators,
      size.height,
      topInset,
      bottomInset,
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
      <StarField />
      <BodyMeshes
        bodies={props.bodies}
        focusedId={props.focusedId}
        selectedIds={props.selectedIds}
        visibleIds={props.visibleIds}
        onSelect={props.onSelect}
      />
      <CameraRig
        bodies={props.bodies}
        focusedId={props.focusedId}
        selectedIds={props.selectedIds}
        focusSequence={props.focusSequence}
        onClearSelection={props.onClearSelection}
      />
      <IndicatorBridge
        bodies={props.bodies}
        focusedId={props.focusedId}
        selectedIds={props.selectedIds}
        visibleIds={props.visibleIds}
        onIndicators={props.onIndicators}
      />
    </Canvas>
  );
}
