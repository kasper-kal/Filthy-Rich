import * as THREE from 'three';
import type { VehicleSpecsData } from './VehicleSpecs.js';
import { ModelLibrary } from '../world/ModelLibrary.js';

/**
 * The Blender-built chassis (FINALLY-3D.md §10).
 *
 * A body is a real model now: the panels are named after `PANEL_NAMES`, so
 * `DamageVisuals` can dent `front_left_door` and crack `front_windshield`
 * without knowing anything about how the car was built. The model is authored
 * with its origin on the ground under the centre of the wheelbase, exactly
 * where `VehiclePhysics` puts the chassis, so nothing here needs a transform.
 *
 * Wheels are NOT in the body file: `Vehicle` owns them and positions them from
 * the spec (wheelbase, track, radius). That is why every body has real arch
 * cut-outs and nothing sitting in them.
 */

const BODY_MODELS: Record<string, string> = {
  hatchback: '/models/vehicles/car_hatch.glb',
  banger: '/models/vehicles/car_hatch.glb',
  sedan: '/models/vehicles/car_sedan.glb',
  estate: '/models/vehicles/car_estate.glb',
  van: '/models/vehicles/car_van.glb',
  sports: '/models/vehicles/car_coupe.glb',
  pickup: '/models/vehicles/car_pickup.glb',
  truck: '/models/vehicles/recovery_truck.glb',
};

const WHEEL_MODELS: Record<string, string> = {
  hatchback: '/models/vehicles/wheel_standard.glb',
  banger: '/models/vehicles/wheel_steel.glb',
  sedan: '/models/vehicles/wheel_standard.glb',
  estate: '/models/vehicles/wheel_standard.glb',
  van: '/models/vehicles/wheel_steel.glb',
  sports: '/models/vehicles/wheel_sport.glb',
  pickup: '/models/vehicles/wheel_recovery.glb',
  truck: '/models/vehicles/wheel_recovery.glb',
};

/** Radius each wheel asset was modelled at; the spec's radius wins at runtime. */
const WHEEL_RADII: Record<string, number> = {
  wheel_standard: 0.31,
  wheel_sport: 0.33,
  wheel_steel: 0.30,
  wheel_recovery: 0.40,
};

const CABIN_MODEL = '/models/vehicles/interior_cabin.glb';
/** The cabin interior was authored to the hatchback; only close cabins wear it. */
const CABIN_BODIES = new Set(['car_hatch', 'car_sedan', 'car_estate', 'car_coupe']);

const assetName = (path: string): string => (path.split('/').pop() ?? '').replace('.glb', '');

export function bodyModelPath(specs: VehicleSpecsData): string {
  return BODY_MODELS[specs.type] ?? BODY_MODELS['hatchback'];
}

export function wheelModelPath(specs: VehicleSpecsData): string {
  return WHEEL_MODELS[specs.type] ?? WHEEL_MODELS['hatchback'];
}

export function wheelModelRadius(path: string): number {
  return WHEEL_RADII[assetName(path)] ?? 0.31;
}

/** Everything a vehicle needs on disk, so the game can warm the cache at boot. */
export function vehicleAssets(specs: VehicleSpecsData): string[] {
  const body = bodyModelPath(specs);
  const assets = [body, wheelModelPath(specs)];
  if (CABIN_BODIES.has(assetName(body))) assets.push(CABIN_MODEL);
  return assets;
}

/**
 * Give the clone its own materials so one car's paint cannot tint another's.
 * `paint` is tinted from the spec; the glass is made transparent; the lamps get
 * an emissive glow so headlights read at night without a light rig.
 */
function ownMaterials(root: THREE.Object3D, specs: VehicleSpecsData): void {
  const owned = new Map<THREE.Material, THREE.Material>();

  const adopt = (material: THREE.Material): THREE.Material => {
    const existing = owned.get(material);
    if (existing) return existing;

    const copy = material.clone();
    copy.name = material.name;
    if (material.name === 'fr_paint' && 'color' in copy) {
      (copy as THREE.MeshStandardMaterial).color.setHex(specs.color);
    } else if (material.name === 'fr_glass_tint' && 'transparent' in copy) {
      const glass = copy as THREE.MeshStandardMaterial;
      glass.transparent = true;
      glass.opacity = 0.62;
      glass.depthWrite = false;
      glass.roughness = 0.06;
      glass.metalness = 0.1;
    } else if (material.name === 'fr_emissive_warm') {
      const lamp = copy as THREE.MeshStandardMaterial;
      lamp.emissive = new THREE.Color(0xffe6b0);
      lamp.emissiveIntensity = 0.45;
    } else if (material.name === 'fr_emissive_red') {
      const lamp = copy as THREE.MeshStandardMaterial;
      lamp.emissive = new THREE.Color(0xd42a18);
      lamp.emissiveIntensity = 0.5;
    }
    owned.set(material, copy);
    return copy;
  };

  root.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.material = Array.isArray(child.material)
      ? child.material.map(adopt)
      : adopt(child.material);
  });
}

function attachBody(group: THREE.Group, specs: VehicleSpecsData): void {
  const path = bodyModelPath(specs);
  const body = ModelLibrary.clone(path);
  if (!body) {
    // The car is only visible outside, so a late model beats blocking the boot.
    void ModelLibrary.load(path)
      .then(() => attachBody(group, specs))
      .catch(error => console.warn(`[VehicleVisual] could not load ${path}`, error));
    return;
  }

  body.name = 'chassis_model';
  ownMaterials(body, specs);
  group.add(body);

  if (CABIN_BODIES.has(assetName(path))) {
    const cabin = ModelLibrary.clone(CABIN_MODEL);
    if (cabin) {
      cabin.name = 'interior_cabin';
      cabin.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = false;
          child.receiveShadow = true;
        }
      });
      group.add(cabin);
    }
  }
}

export function createVehicleVisual(specs: VehicleSpecsData, id: string): THREE.Group {
  const group = new THREE.Group();
  group.name = `vehicle_visual_${id}`;
  group.userData['specsName'] = specs.name;
  group.userData['vehicleId'] = id;

  attachBody(group, specs);
  return group;
}
