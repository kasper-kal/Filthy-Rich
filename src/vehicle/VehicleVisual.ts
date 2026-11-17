import * as THREE from 'three';
import type { VehicleSpecsData } from './VehicleSpecs.js';

/**
 * Builds the procedural chassis visual for a vehicle.
 *
 * The returned group's origin is at ground level beneath the centre of the car,
 * matching the wheel positions Vehicle.createWheel() uses (y === wheelRadius).
 * Wheels are added as children by Vehicle itself, so nothing wheel-related lives here.
 */
export function createVehicleVisual(specs: VehicleSpecsData, id: string): THREE.Group {
  const group = new THREE.Group();
  group.name = `vehicle_visual_${id}`;

  const { length, width, height } = specs.dimensions;
  const isBoxy = specs.type === 'van' || specs.type === 'truck';

  const bodyPaint = new THREE.MeshStandardMaterial({
    color: specs.color,
    roughness: 0.35,
    metalness: 0.65,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0x1a1a1c,
    roughness: 0.7,
    metalness: 0.3,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x0d1a24,
    roughness: 0.08,
    metalness: 0.9,
    transparent: true,
    opacity: 0.72,
  });
  const headlightGlass = new THREE.MeshStandardMaterial({
    color: 0xfff4d6,
    emissive: 0xffe9b0,
    emissiveIntensity: 0.35,
    roughness: 0.2,
    metalness: 0.1,
  });
  const taillightGlass = new THREE.MeshStandardMaterial({
    color: 0x8c1a12,
    emissive: 0xcc2a1a,
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.1,
  });

  const addBox = (
    size: { x: number; y: number; z: number },
    position: { x: number; y: number; z: number },
    material: THREE.Material,
    name: string
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // Body proportions scale with the spec sheet so a van reads as a van.
  const sillHeight = Math.min(0.45, height * 0.3);
  const bodyHeight = isBoxy ? height * 0.55 : height * 0.42;
  const bodyCenterY = sillHeight + bodyHeight / 2;
  const cabinHeight = isBoxy ? height * 0.34 : height * 0.3;
  const cabinLength = isBoxy ? length * 0.72 : length * 0.52;
  const cabinCenterZ = isBoxy ? -length * 0.06 : -length * 0.04;
  const cabinCenterY = bodyCenterY + bodyHeight / 2 + cabinHeight / 2;

  // Main body and cabin.
  addBox(
    { x: width, y: bodyHeight, z: length },
    { x: 0, y: bodyCenterY, z: 0 },
    bodyPaint,
    'chassis_body'
  );
  addBox(
    { x: width * 0.9, y: cabinHeight, z: cabinLength },
    { x: 0, y: cabinCenterY, z: cabinCenterZ },
    bodyPaint,
    'chassis_cabin'
  );

  // Greenhouse: windscreen, rear screen and side glass sit slightly proud of the cabin.
  const glassY = cabinCenterY + cabinHeight * 0.05;
  const glassZ = cabinLength / 2;
  addBox(
    { x: width * 0.82, y: cabinHeight * 0.62, z: 0.05 },
    { x: 0, y: glassY, z: cabinCenterZ + glassZ - 0.06 },
    glass,
    'glass_windscreen'
  );
  addBox(
    { x: width * 0.82, y: cabinHeight * 0.55, z: 0.05 },
    { x: 0, y: glassY, z: cabinCenterZ - glassZ + 0.06 },
    glass,
    'glass_rear'
  );
  addBox(
    { x: width * 0.905, y: cabinHeight * 0.5, z: cabinLength * 0.66 },
    { x: 0, y: glassY, z: cabinCenterZ },
    glass,
    'glass_sides'
  );

  // Bumpers, front and rear.
  addBox(
    { x: width * 1.01, y: 0.28, z: 0.22 },
    { x: 0, y: sillHeight + 0.12, z: length / 2 - 0.09 },
    trim,
    'bumper_front'
  );
  addBox(
    { x: width * 1.01, y: 0.26, z: 0.2 },
    { x: 0, y: sillHeight + 0.12, z: -length / 2 + 0.08 },
    trim,
    'bumper_rear'
  );

  // Grille.
  addBox(
    { x: width * 0.55, y: 0.16, z: 0.06 },
    { x: 0, y: sillHeight + 0.42, z: length / 2 - 0.005 },
    trim,
    'grille'
  );

  // Headlights and tail lights.
  const lampY = sillHeight + 0.48;
  const lampX = width * 0.34;
  for (const side of [-1, 1]) {
    addBox(
      { x: width * 0.22, y: 0.13, z: 0.05 },
      { x: side * lampX, y: lampY, z: length / 2 - 0.002 },
      headlightGlass,
      side < 0 ? 'headlight_left' : 'headlight_right'
    );
    addBox(
      { x: width * 0.2, y: 0.15, z: 0.05 },
      { x: side * lampX, y: lampY, z: -length / 2 + 0.002 },
      taillightGlass,
      side < 0 ? 'taillight_left' : 'taillight_right'
    );
  }

  // Wing mirrors.
  for (const side of [-1, 1]) {
    addBox(
      { x: 0.12, y: 0.08, z: 0.14 },
      { x: side * (width / 2 + 0.05), y: cabinCenterY - cabinHeight * 0.1, z: cabinLength / 2 - 0.3 },
      trim,
      side < 0 ? 'mirror_left' : 'mirror_right'
    );
  }

  // Side skirts, which also hide the seam between body and wheels.
  for (const side of [-1, 1]) {
    addBox(
      { x: 0.06, y: 0.1, z: length * 0.62 },
      { x: side * (width / 2 - 0.01), y: sillHeight, z: 0 },
      trim,
      side < 0 ? 'skirt_left' : 'skirt_right'
    );
  }

  // Exhaust.
  addBox(
    { x: 0.08, y: 0.08, z: 0.14 },
    { x: -width * 0.26, y: sillHeight - 0.02, z: -length / 2 - 0.02 },
    trim,
    'exhaust'
  );

  group.userData['specsName'] = specs.name;
  group.userData['vehicleId'] = id;

  return group;
}
