import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneManager } from '../systems/SceneManager.js';
import type { HouseTemplate, RoomTemplate, HouseLayoutTemplate } from './HouseTemplates.js';
import {
  getHouseTemplate,
  getHouseLayoutTemplate,
  getAllHouseTemplates,
} from './HouseTemplates.js';
import type { HouseVariationData } from './HouseVariation.js';
import {
  VariationContext,
  generateHouseVariation,
  applyVariation,
  generateRoomVariations,
  getVariationContext,
} from './HouseVariation.js';
import type { GeneratedExterior, ExteriorGenerationOptions } from './ExteriorGenerator.js';
import { generateExterior, disposeExterior, updateExteriorLighting } from './ExteriorGenerator.js';

export interface HouseInstance {
  id: string;
  chunkId: string;
  position: THREE.Vector3;
  rotation: number;
  seed: number;
  template: string;
  variant: number;
  exteriorLoaded: boolean;
  interiorLoaded: boolean;
  lodLevel: number;
  clientName: string;
  jobTitle: string;
  flavorText: string;
  rooms: string[];
  description: string;
  bounds: { min: THREE.Vector3; max: THREE.Vector3 };

  isDoorNearby(position: THREE.Vector3): boolean;

  variation?: HouseVariationData;
  exteriorData?: GeneratedExterior;
  templateData?: HouseTemplate;
}

export class HouseGenerator {
  private sceneManager: SceneManager;
  private worldSeed: number;
  private houseMeshes = new Map<string, THREE.Group | THREE.LOD>();
  private interiorMeshes = new Map<string, THREE.Group>();
  private exteriorData = new Map<string, GeneratedExterior>();

  constructor(sceneManager: SceneManager, worldSeed: number) {
    this.sceneManager = sceneManager;
    this.worldSeed = worldSeed;
  }

  generateExterior(house: HouseInstance): THREE.Group | THREE.LOD {
    const baseTemplate = getHouseTemplate(house.template);
    if (!baseTemplate) {
      console.warn(
        `[HouseGenerator] Unknown template: ${house.template}, falling back to terraced`
      );
      return this.generateFallbackExterior(house);
    }

    const variationContext = getVariationContext(
      house.id,
      house.chunkId,
      house.variant,
      this.worldSeed
    );
    variationContext.templateName = house.template;
    variationContext.jobType = house.jobTitle;
    const variation = generateHouseVariation(variationContext);

    const template = applyVariation(baseTemplate, variation);

    house.variation = variation;
    house.templateData = template;

    const group = new THREE.Group();
    group.name = `house_${house.id}_exterior`;
    group.position.copy(house.position);
    group.rotation.y = house.rotation;

    const rng = this.createRNG(house.seed);

    const exteriorOptions: ExteriorGenerationOptions = {
      template,
      variation,
      position: new THREE.Vector3(0, 0, 0),
      rotation: 0,
      rng,
      sceneManager: this.sceneManager,
    };

    const exterior = generateExterior(exteriorOptions);
    group.add(exterior.group);

    this.exteriorData.set(house.id, exterior);

    this.createLODMeshes(group, template, house);

    this.houseMeshes.set(house.id, group);
    this.sceneManager.scene.add(group);

    house.exteriorLoaded = true;
    return group;
  }

  private generateFallbackExterior(house: HouseInstance): THREE.Group {
    const group = new THREE.Group();
    group.name = `house_${house.id}_exterior_fallback`;
    group.position.copy(house.position);
    group.rotation.y = house.rotation;

    const geom = new THREE.BoxGeometry(6, 7, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0xaa6644, roughness: 0.9 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = 3.5;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    this.createLODMeshes(group, { width: 6, depth: 10, height: 7 } as HouseTemplate, house);
    this.houseMeshes.set(house.id, group);
    this.sceneManager.scene.add(group);
    house.exteriorLoaded = true;
    return group;
  }

  generateInterior(house: HouseInstance): THREE.Group {
    let template = house.templateData;
    let variation = house.variation;

    if (!template) {
      const baseTemplate = getHouseTemplate(house.template);
      template = baseTemplate || getHouseTemplate('terraced')!;
    }

    if (!variation) {
      const variationContext = getVariationContext(
        house.id,
        house.chunkId,
        house.variant,
        this.worldSeed
      );
      variationContext.templateName = house.template;
      variationContext.jobType = house.jobTitle;
      variation = generateHouseVariation(variationContext);
      house.variation = variation;
    }

    const layout = getHouseLayoutTemplate(template.roomLayout);
    const group = new THREE.Group();
    group.name = `house_${house.id}_interior`;
    group.position.copy(house.position);
    group.rotation.y = house.rotation;

    const rng = this.createRNG(house.seed + 1000);

    const rooms = layout ? layout.rooms : [];
    const variedRooms = generateRoomVariations(variation, rooms, rng);

    const floor = this.createInteriorFloor(template, variation, rng);
    group.add(floor);

    const ceiling = this.createCeiling(template, variation, rng);
    group.add(ceiling);

    const walls = this.createInteriorWalls(template, variation, variedRooms, layout, rng);
    group.add(walls);

    const roomDivs = this.createRoomDivisions(template, variation, variedRooms, layout, rng);
    group.add(roomDivs);

    if (template.floors > 1 && layout?.stairs) {
      const stairs = this.createStairs(template, variation, layout.stairs, rng);
      group.add(stairs);
    }

    this.interiorMeshes.set(house.id, group);
    this.sceneManager.scene.add(group);

    house.interiorLoaded = true;
    return group;
  }

  private createInteriorFloor(
    template: HouseTemplate,
    variation: HouseVariationData,
    rng: () => number
  ): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(template.width - 0.6, template.depth - 0.6);
    const floorColor = this.getFloorColor(variation.floorMaterialScheme, rng);
    const mat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createCeiling(
    template: HouseTemplate,
    variation: HouseVariationData,
    rng: () => number
  ): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(template.width - 0.6, template.depth - 0.6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf5f0e8,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = template.floors > 1 ? 3 : 2.5;
    return mesh;
  }

  private createInteriorWalls(
    template: HouseTemplate,
    variation: HouseVariationData,
    rooms: RoomTemplate[],
    layout: HouseLayoutTemplate | undefined,
    rng: () => number
  ): THREE.Group {
    const group = new THREE.Group();
    const wallColor = this.getWallColor(variation.wallColorScheme, rng);
    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const height = template.floors > 1 ? 3 : 2.5;
    const thickness = 0.15;

    const wallWidth = template.width - 0.6;
    const wallDepth = template.depth - 0.6;

    const southWall = this.createWallWithOpenings(
      wallWidth,
      height,
      thickness,
      this.getWallOpenings(rooms, layout, 'south', template),
      wallMat
    );
    southWall.position.set(0, height / 2, wallDepth / 2 + thickness / 2);
    group.add(southWall);

    const northWall = this.createWallWithOpenings(
      wallWidth,
      height,
      thickness,
      this.getWallOpenings(rooms, layout, 'north', template),
      wallMat
    );
    northWall.position.set(0, height / 2, -wallDepth / 2 - thickness / 2);
    northWall.rotation.y = Math.PI;
    group.add(northWall);

    const westWall = this.createWallWithOpenings(
      wallDepth,
      height,
      thickness,
      this.getWallOpenings(rooms, layout, 'west', template),
      wallMat
    );
    westWall.position.set(-wallWidth / 2 - thickness / 2, height / 2, 0);
    westWall.rotation.y = -Math.PI / 2;
    group.add(westWall);

    const eastWall = this.createWallWithOpenings(
      wallDepth,
      height,
      thickness,
      this.getWallOpenings(rooms, layout, 'east', template),
      wallMat
    );
    eastWall.position.set(wallWidth / 2 + thickness / 2, height / 2, 0);
    eastWall.rotation.y = Math.PI / 2;
    group.add(eastWall);

    return group;
  }

  private getWallOpenings(
    rooms: RoomTemplate[],
    layout: HouseLayoutTemplate | undefined,
    wall: 'north' | 'south' | 'east' | 'west',
    template: HouseTemplate
  ): { x: number; y: number; w: number; h: number }[] {
    const openings: { x: number; y: number; w: number; h: number }[] = [];

    if (layout) {
      for (const room of layout.rooms) {
        for (const door of room.doorPositions) {
          if (door.connectsTo === 'outside') {
            const wallMap: Record<string, 'north' | 'south' | 'east' | 'west'> = {
              north: 'north',
              south: 'south',
              east: 'east',
              west: 'west',
            };
            if (wallMap[door.wall] === wall) {
              const houseX = room.position.x + (door.position - 0.5) * door.width;
              openings.push({
                x: houseX,
                y: 1,
                w: door.width,
                h: door.height,
              });
            }
          }
        }
        for (const window of room.windowPositions) {
          const wallMap: Record<string, 'north' | 'south' | 'east' | 'west'> = {
            north: 'north',
            south: 'south',
            east: 'east',
            west: 'west',
          };
          if (wallMap[window.wall] === wall && room.minFloor === 0) {
            const houseX = room.position.x + window.x;
            openings.push({
              x: houseX,
              y: window.heightFromFloor || 1.5,
              w: window.width,
              h: window.height,
            });
          }
        }
      }
    }

    return openings;
  }

  private createWallWithOpenings(
    width: number,
    height: number,
    thickness: number,
    openings: { x: number; y: number; w: number; h: number }[],
    material: THREE.Material
  ): THREE.Mesh {
    const group = new THREE.Group();
    openings.sort((a, b) => a.y - b.y);

    let lastY = 0;
    for (const opening of openings) {
      if (opening.y > lastY) {
        const h = opening.y - lastY;
        const geom = new THREE.BoxGeometry(width, h, thickness);
        const mesh = new THREE.Mesh(geom, material);
        mesh.position.y = lastY + h / 2;
        group.add(mesh);
      }

      if (opening.x - opening.w / 2 > -width / 2) {
        const w = opening.x - opening.w / 2 + width / 2;
        const geom = new THREE.BoxGeometry(w, opening.h, thickness);
        const mesh = new THREE.Mesh(geom, material);
        mesh.position.set(-width / 2 + w / 2, opening.y + opening.h / 2, 0);
        group.add(mesh);
      }

      if (opening.x + opening.w / 2 < width / 2) {
        const w = width / 2 - (opening.x + opening.w / 2);
        const geom = new THREE.BoxGeometry(w, opening.h, thickness);
        const mesh = new THREE.Mesh(geom, material);
        mesh.position.set(opening.x + opening.w / 2 + w / 2, opening.y + opening.h / 2, 0);
        group.add(mesh);
      }

      lastY = opening.y + opening.h;
    }

    if (lastY < height) {
      const h = height - lastY;
      const geom = new THREE.BoxGeometry(width, h, thickness);
      const mesh = new THREE.Mesh(geom, material);
      mesh.position.y = lastY + h / 2;
      group.add(mesh);
    }

    const meshes: THREE.Mesh[] = [];
    group.traverse(child => {
      if (child instanceof THREE.Mesh) meshes.push(child);
    });

    if (meshes.length === 1) return meshes[0];
    const merged = mergeGeometries(
      meshes.map(m => m.geometry),
      false
    );
    const mergedMesh = new THREE.Mesh(merged, material);
    mergedMesh.castShadow = true;
    mergedMesh.receiveShadow = true;
    return mergedMesh;
  }

  private createRoomDivisions(
    template: HouseTemplate,
    variation: HouseVariationData,
    rooms: RoomTemplate[],
    layout: HouseLayoutTemplate | undefined,
    rng: () => number
  ): THREE.Group {
    const group = new THREE.Group();
    const wallColor = this.getWallColor(variation.wallColorScheme, rng);
    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const height = template.floors > 1 ? 3 : 2.5;
    const thickness = 0.1;

    if (!layout) return group;

    for (const connection of layout.connections) {
      const roomA = rooms.find(r => r.name === connection.from);
      const roomB = rooms.find(r => r.name === connection.to);
      if (!roomA || !roomB) continue;

      const midX = (roomA.position.x + roomB.position.x) / 2;
      const midZ = (roomA.position.z + roomB.position.z) / 2;
      const dx = roomB.position.x - roomA.position.x;
      const dz = roomB.position.z - roomA.position.z;

      let geom: THREE.BoxGeometry;
      if (Math.abs(dx) > Math.abs(dz)) {
        geom = new THREE.BoxGeometry(thickness, height, Math.min(roomA.depth, roomB.depth) * 0.8);
        geom.translate(midX, height / 2, midZ);
      } else {
        geom = new THREE.BoxGeometry(Math.min(roomA.width, roomB.width) * 0.8, height, thickness);
        geom.translate(midX, height / 2, midZ);
      }

      const mesh = new THREE.Mesh(geom, wallMat);
      mesh.position.y = 0;
      group.add(mesh);
    }

    return group;
  }

  private createStairs(
    template: HouseTemplate,
    variation: HouseVariationData,
    stairs: HouseLayoutTemplate['stairs'],
    rng: () => number
  ): THREE.Group {
    const group = new THREE.Group();
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 });
    const stepCount = 12;
    const stepHeight = 2.5 / stepCount;
    const stepDepth = 0.25;
    const stepWidth = stairs?.width || 0.9;

    for (let i = 0; i < stepCount; i++) {
      const geom = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);
      const mesh = new THREE.Mesh(geom, stepMat);
      mesh.position.set(
        stairs?.x || -template.width / 2 + 1.5,
        i * stepHeight + stepHeight / 2,
        (stairs?.z || -template.depth / 2 + 1.5) + i * stepDepth
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    return group;
  }

  private createLODMeshes(
    houseGroup: THREE.Group,
    template: HouseTemplate,
    house: HouseInstance
  ): void {
    const lod = new THREE.LOD();

    lod.addLevel(houseGroup, 50);

    const simplified = this.createSimplifiedMesh(template, house);
    lod.addLevel(simplified, 150);

    const imposter = this.createImposterMesh(template, house);
    lod.addLevel(imposter, 500);

    this.sceneManager.scene.remove(houseGroup);
    lod.position.copy(houseGroup.position);
    lod.rotation.copy(houseGroup.rotation);
    lod.name = houseGroup.name;
    this.sceneManager.scene.add(lod);
    this.houseMeshes.set(house.id, lod);
  }

  private createSimplifiedMesh(template: HouseTemplate, house: HouseInstance): THREE.Mesh {
    const geom = new THREE.BoxGeometry(template.width, template.height, template.depth);
    const mat = new THREE.MeshStandardMaterial({
      color: template.brickColor,
      roughness: 0.9,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = template.height / 2;
    return mesh;
  }

  private createImposterMesh(template: HouseTemplate, house: HouseInstance): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(template.width, template.height);
    const mat = new THREE.MeshBasicMaterial({
      color: template.brickColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = template.height / 2;
    return mesh;
  }

  setLOD(house: HouseInstance, level: number): void {
    const group = this.houseMeshes.get(house.id);
    if (group && group instanceof THREE.LOD) {
      group.levels.forEach((l, i) => {
        l.object.visible = i === level;
      });
    } else if (group && !(group instanceof THREE.LOD)) {
      group.visible = level <= 1;
    }
  }

  disposeHouse(house: HouseInstance): void {
    const exterior = this.houseMeshes.get(house.id);
    if (exterior) {
      this.sceneManager.scene.remove(exterior);
      this.disposeGroup(exterior);
      this.houseMeshes.delete(house.id);
    }

    const interior = this.interiorMeshes.get(house.id);
    if (interior) {
      this.sceneManager.scene.remove(interior);
      this.disposeGroup(interior);
      this.interiorMeshes.delete(house.id);
    }

    const extData = this.exteriorData.get(house.id);
    if (extData) {
      disposeExterior(extData);
      this.exteriorData.delete(house.id);
    }
  }

  private disposeGroup(group: THREE.Object3D): void {
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      } else if (child instanceof THREE.Light) {
        child.dispose();
      }
    });
  }

  private createRNG(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state += 0x6d2b79f5;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private getWallColor(scheme: HouseVariationData['wallColorScheme'], rng: () => number): number {
    const baseColors: Record<HouseVariationData['wallColorScheme'], number[]> = {
      neutral: [0xe8dcc8, 0xf0e8e0, 0xf5f0e8, 0xeae4d8],
      warm: [0xf0d8c0, 0xe8c8a0, 0xf5e0c8, 0xfad8b8],
      cool: [0xd8e8f0, 0xc8e0e8, 0xe0f0f5, 0xd0e8f0],
      bold: [0x2c3e50, 0x1a5c2e, 0x8b1a1a, 0x2d2d2d],
      period: [0xf0e8d8, 0xd8e8d0, 0xe8d0c8, 0xe0d8c8],
    };
    const colors = baseColors[scheme] || baseColors.neutral;
    return colors[Math.floor(rng() * colors.length)];
  }

  private getFloorColor(
    scheme: HouseVariationData['floorMaterialScheme'],
    rng: () => number
  ): number {
    const baseColors: Record<HouseVariationData['floorMaterialScheme'], number[]> = {
      carpet: [0x8b7355, 0xa09078, 0x988870, 0x887860],
      wood: [0x8b7355, 0x7a6858, 0x6b5a4a, 0x9a8a75],
      tile: [0x8899aa, 0x9aaab8, 0xaaaacc, 0xbbcccc],
      mixed: [0x8b7355, 0x8899aa, 0x9a8a75, 0x8899aa],
      period: [0x7a6858, 0x8b7355, 0x6b5a4a, 0x9a8a75],
    };
    const colors = baseColors[scheme] || baseColors.carpet;
    return colors[Math.floor(rng() * colors.length)];
  }

  updateExteriorLighting(houseId: string, timeOfDay: number): void {
    const exterior = this.exteriorData.get(houseId);
    if (exterior) {
      updateExteriorLighting(exterior, timeOfDay);
    }
  }

  getExteriorData(houseId: string): GeneratedExterior | undefined {
    return this.exteriorData.get(houseId);
  }

  getLoadedHouseCount(): number {
    return this.houseMeshes.size;
  }
}
