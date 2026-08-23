/**
 * House Worker - Off-main-thread house assembly and mesh generation
 * Handles procedural house generation including rooms, furniture, LODs
 */

import * as Comlink from 'comlink'

// ============================================
// TYPES
// ============================================

export interface HouseGenerationParams {
  seed: number
  templateId: string
  variationSeed: number
  lodLevel: 0 | 1 | 2 | 3 // 0=full, 1=simplified, 2=imposter, 3=culled
  includeInterior: boolean
  includeExterior: boolean
}

export interface HouseGeometryData {
  // Main meshes
  exteriorVertices: Float32Array
  exteriorNormals: Float32Array
  exteriorUvs: Float32Array
  exteriorIndices: Uint32Array
  interiorVertices?: Float32Array
  interiorNormals?: Float32Array
  interiorUvs?: Float32Array
  interiorIndices?: Uint32Array

  // Collision
  collisionVertices: Float32Array
  collisionIndices: Uint32Array

  // Room bounds for interior streaming
  rooms: RoomBoundsData[]

  // Exterior props (bins, cars, etc)
  props: PropData[]

  // Bounding info
  bounds: { min: number[]; max: number[] }
  entrancePosition: number[] // world position of front door
}

export interface RoomBoundsData {
  name: string
  min: number[] // [x, y, z]
  max: number[] // [x, y, z]
  floorY: number
  ceilingY: number
  hasDoor: boolean
  doorPosition?: number[]
}

export interface PropData {
  type: 'wheelie_bin' | 'driveway_car' | 'fence' | 'garden_ornament' | 'mailbox' | 'gutter' | 'tv_aerial'
  position: number[]
  rotation: number[]
  scale: number[]
}

export interface HouseTemplate {
  id: string
  name: string
  footprint: { width: number; depth: number }
  storeys: number
  rooms: RoomTemplate[]
  roofType: 'gable' | 'hip' | 'flat' | 'mansard'
  roofPitch: number
  hasGarage: boolean
  garagePosition?: 'left' | 'right' | 'integrated'
}

export interface RoomTemplate {
  name: string
  type: 'entrance' | 'living' | 'kitchen' | 'dining' | 'bathroom' | 'bedroom' | 'utility' | 'garage' | 'hallway' | 'study' | 'conservatory'
  position: { x: number; z: number } // relative to house center
  size: { width: number; depth: number }
  connections: string[] // connected room names
  windows: WindowSpec[]
  doors: DoorSpec[]
  furniture?: FurnitureSpec[]
}

export interface WindowSpec {
  wall: 'north' | 'south' | 'east' | 'west'
  position: number // 0-1 along wall
  width: number
  height: number
  style: 'casement' | 'sash' | 'bay' | 'skylight'
}

export interface DoorSpec {
  wall: 'north' | 'south' | 'east' | 'west'
  position: number // 0-1 along wall
  width: number
  height: number
  type: 'external' | 'internal' | 'patio' | 'garage'
  leadsTo?: string // room name or 'outside'
}

export interface FurnitureSpec {
  type: string
  position: { x: number; z: number }
  rotation: number
  variant: number
}

// ============================================
// SEEDED RNG
// ============================================

function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t = Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// ============================================
// HOUSE TEMPLATES
// ============================================

const HOUSE_TEMPLATES: Record<string, HouseTemplate> = {
  terraced: {
    id: 'terraced',
    name: 'Terraced House',
    footprint: { width: 6, depth: 12 },
    storeys: 2,
    roofType: 'gable',
    roofPitch: 0.6,
    hasGarage: false,
    rooms: [
      { name: 'entrance', type: 'entrance', position: { x: 0, z: -4.5 }, size: { width: 3, depth: 3 }, connections: ['living', 'hallway'], windows: [], doors: [{ wall: 'south', position: 0.5, width: 1, height: 2.1, type: 'external', leadsTo: 'outside' }] },
      { name: 'living', type: 'living', position: { x: -1.5, z: -1.5 }, size: { width: 4.5, depth: 4.5 }, connections: ['entrance', 'kitchen', 'dining'], windows: [{ wall: 'west', position: 0.5, width: 1.5, height: 1.2, style: 'casement' }], doors: [] },
      { name: 'kitchen', type: 'kitchen', position: { x: 1.5, z: -1.5 }, size: { width: 3, depth: 3 }, connections: ['living', 'dining'], windows: [{ wall: 'east', position: 0.5, width: 1.2, height: 1.0, style: 'casement' }], doors: [] },
      { name: 'dining', type: 'dining', position: { x: 0, z: 1.5 }, size: { width: 6, depth: 3 }, connections: ['living', 'kitchen', 'hallway'], windows: [{ wall: 'north', position: 0.5, width: 1.5, height: 1.2, style: 'casement' }], doors: [{ wall: 'north', position: 0.5, width: 1, height: 2.1, type: 'patio', leadsTo: 'outside' }] },
      { name: 'hallway', type: 'hallway', position: { x: 0, z: -1.5 }, size: { width: 2, depth: 3 }, connections: ['entrance', 'living', 'dining'], windows: [], doors: [] },
      { name: 'bedroom1', type: 'bedroom', position: { x: -1.5, z: -1.5 }, size: { width: 3, depth: 4.5 }, connections: ['landing'], windows: [{ wall: 'west', position: 0.5, width: 1.2, height: 1.2, style: 'casement' }], doors: [{ wall: 'east', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'landing' }] },
      { name: 'bedroom2', type: 'bedroom', position: { x: 1.5, z: -1.5 }, size: { width: 3, depth: 3 }, connections: ['landing'], windows: [{ wall: 'east', position: 0.5, width: 1.2, height: 1.2, style: 'casement' }], doors: [{ wall: 'west', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'landing' }] },
      { name: 'bathroom', type: 'bathroom', position: { x: 1.5, z: 1.5 }, size: { width: 3, depth: 3 }, connections: ['landing'], windows: [{ wall: 'north', position: 0.5, width: 0.8, height: 0.8, style: 'casement' }], doors: [{ wall: 'south', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'landing' }] },
      { name: 'landing', type: 'hallway', position: { x: 0, z: -1.5 }, size: { width: 6, depth: 3 }, connections: ['bedroom1', 'bedroom2', 'bathroom'], windows: [{ wall: 'north', position: 0.5, width: 1, height: 1, style: 'casement' }], doors: [] }
    ]
  },
  semi_detached: {
    id: 'semi_detached',
    name: 'Semi-Detached House',
    footprint: { width: 8, depth: 10 },
    storeys: 2,
    roofType: 'hip',
    roofPitch: 0.5,
    hasGarage: true,
    garagePosition: 'left',
    rooms: [
      { name: 'entrance', type: 'entrance', position: { x: 0, z: -4 }, size: { width: 3, depth: 2 }, connections: ['living', 'hallway'], windows: [], doors: [{ wall: 'south', position: 0.5, width: 1, height: 2.1, type: 'external', leadsTo: 'outside' }] },
      { name: 'living', type: 'living', position: { x: -2.5, z: -1 }, size: { width: 4, depth: 4 }, connections: ['entrance', 'kitchen'], windows: [{ wall: 'west', position: 0.5, width: 2, height: 1.5, style: 'bay' }], doors: [] },
      { name: 'kitchen', type: 'kitchen', position: { x: 1, z: -1 }, size: { width: 4, depth: 3 }, connections: ['living', 'dining'], windows: [{ wall: 'east', position: 0.5, width: 1.5, height: 1.0, style: 'casement' }], doors: [{ wall: 'south', position: 0.5, width: 1, height: 2.1, type: 'patio', leadsTo: 'outside' }] },
      { name: 'dining', type: 'dining', position: { x: 0, z: 2 }, size: { width: 5, depth: 3 }, connections: ['kitchen', 'hallway'], windows: [{ wall: 'north', position: 0.5, width: 1.5, height: 1.2, style: 'casement' }], doors: [] },
      { name: 'hallway', type: 'hallway', position: { x: 0, z: -1 }, size: { width: 2, depth: 3 }, connections: ['entrance', 'living', 'dining', 'garage'], windows: [], doors: [{ wall: 'west', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'garage' }] },
      { name: 'garage', type: 'garage', position: { x: -4, z: -1 }, size: { width: 3.5, depth: 5.5 }, connections: ['hallway'], windows: [], doors: [{ wall: 'south', position: 0.5, width: 2.4, height: 2.2, type: 'garage', leadsTo: 'outside' }] },
      { name: 'bedroom1', type: 'bedroom', position: { x: -2.5, z: -1 }, size: { width: 4, depth: 4 }, connections: ['landing'], windows: [{ wall: 'west', position: 0.5, width: 1.5, height: 1.2, style: 'casement' }], doors: [{ wall: 'east', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'landing' }] },
      { name: 'bedroom2', type: 'bedroom', position: { x: 1, z: -1 }, size: { width: 3.5, depth: 4 }, connections: ['landing'], windows: [{ wall: 'east', position: 0.5, width: 1.2, height: 1.2, style: 'casement' }], doors: [{ wall: 'west', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'landing' }] },
      { name: 'bathroom', type: 'bathroom', position: { x: 0, z: 2 }, size: { width: 3, depth: 3 }, connections: ['landing'], windows: [{ wall: 'north', position: 0.5, width: 0.8, height: 0.8, style: 'casement' }], doors: [{ wall: 'south', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'landing' }] },
      { name: 'landing', type: 'hallway', position: { x: 0, z: -1 }, size: { width: 6, depth: 3 }, connections: ['bedroom1', 'bedroom2', 'bathroom'], windows: [{ wall: 'north', position: 0.5, width: 1, height: 1, style: 'casement' }], doors: [] }
    ]
  },
  detached: {
    id: 'detached',
    name: 'Detached House',
    footprint: { width: 10, depth: 12 },
    storeys: 2,
    roofType: 'hip',
    roofPitch: 0.45,
    hasGarage: true,
    garagePosition: 'integrated',
    rooms: [
      { name: 'entrance', type: 'entrance', position: { x: 0, z: -5 }, size: { width: 4, depth: 3 }, connections: ['hallway', 'living', 'study'], windows: [], doors: [{ wall: 'south', position: 0.5, width: 1.2, height: 2.2, type: 'external', leadsTo: 'outside' }] },
      { name: 'living', type: 'living', position: { x: -3, z: -2 }, size: { width: 5, depth: 5 }, connections: ['hallway', 'dining'], windows: [{ wall: 'west', position: 0.3, width: 1.8, height: 1.5, style: 'bay' }, { wall: 'west', position: 0.7, width: 1.8, height: 1.5, style: 'bay' }], doors: [] },
      { name: 'dining', type: 'dining', position: { x: 1, z: -2 }, size: { width: 4, depth: 4 }, connections: ['living', 'kitchen', 'hallway'], windows: [{ wall: 'east', position: 0.5, width: 1.5, height: 1.2, style: 'casement' }], doors: [{ wall: 'north', position: 0.5, width: 2, height: 2.2, type: 'patio', leadsTo: 'outside' }] },
      { name: 'kitchen', type: 'kitchen', position: { x: 3, z: 0 }, size: { width: 4, depth: 4 }, connections: ['dining', 'utility'], windows: [{ wall: 'east', position: 0.5, width: 1.5, height: 1.0, style: 'casement' }, { wall: 'north', position: 0.3, width: 1.2, height: 1.0, style: 'casement' }], doors: [] },
      { name: 'utility', type: 'utility', position: { x: 3, z: 3 }, size: { width: 3, depth: 3 }, connections: ['kitchen', 'garage'], windows: [{ wall: 'north', position: 0.5, width: 0.8, height: 0.8, style: 'casement' }], doors: [] },
      { name: 'garage', type: 'garage', position: { x: 3.5, z: 5 }, size: { width: 3.5, depth: 6 }, connections: ['utility'], windows: [], doors: [{ wall: 'south', position: 0.5, width: 2.4, height: 2.2, type: 'garage', leadsTo: 'outside' }] },
      { name: 'study', type: 'study', position: { x: -3, z: -5 }, size: { width: 3.5, depth: 3.5 }, connections: ['entrance'], windows: [{ wall: 'west', position: 0.5, width: 1.2, height: 1.2, style: 'casement' }], doors: [{ wall: 'east', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'entrance' }] },
      { name: 'hallway', type: 'hallway', position: { x: 0, z: -2 }, size: { width: 3, depth: 4 }, connections: ['entrance', 'living', 'dining', 'stairs'], windows: [], doors: [] },
      { name: 'stairs', type: 'hallway', position: { x: 0, z: 2 }, size: { width: 2.5, depth: 3 }, connections: ['hallway', 'landing'], windows: [], doors: [] },
      { name: 'bedroom1', type: 'bedroom', position: { x: -3, z: -2 }, size: { width: 5, depth: 5 }, connections: ['landing', 'ensuite'], windows: [{ wall: 'west', position: 0.5, width: 1.8, height: 1.5, style: 'bay' }], doors: [{ wall: 'east', position: 0.5, width: 0.9, height: 2, type: 'internal', leadsTo: 'landing' }, { wall: 'north', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'ensuite' }] },
      { name: 'ensuite', type: 'bathroom', position: { x: -3, z: 2.5 }, size: { width: 2.5, depth: 3 }, connections: ['bedroom1'], windows: [{ wall: 'west', position: 0.5, width: 0.8, height: 0.8, style: 'casement' }], doors: [{ wall: 'south', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'bedroom1' }] },
      { name: 'bedroom2', type: 'bedroom', position: { x: 2, z: -2 }, size: { width: 4, depth: 4 }, connections: ['landing'], windows: [{ wall: 'east', position: 0.5, width: 1.5, height: 1.2, style: 'casement' }], doors: [{ wall: 'west', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'landing' }] },
      { name: 'bedroom3', type: 'bedroom', position: { x: -1, z: 2.5 }, size: { width: 3.5, depth: 3.5 }, connections: ['landing'], windows: [{ wall: 'north', position: 0.5, width: 1.2, height: 1.2, style: 'casement' }], doors: [{ wall: 'south', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'landing' }] },
      { name: 'bathroom', type: 'bathroom', position: { x: 2, z: 2.5 }, size: { width: 3.5, depth: 3.5 }, connections: ['landing'], windows: [{ wall: 'east', position: 0.5, width: 0.8, height: 0.8, style: 'casement' }], doors: [{ wall: 'west', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'landing' }] },
      { name: 'landing', type: 'hallway', position: { x: 0, z: 2.5 }, size: { width: 6, depth: 4 }, connections: ['bedroom1', 'bedroom2', 'bedroom3', 'bathroom', 'stairs'], windows: [{ wall: 'north', position: 0.5, width: 1, height: 1, style: 'casement' }], doors: [] }
    ]
  },
  bungalow: {
    id: 'bungalow',
    name: 'Bungalow',
    footprint: { width: 12, depth: 10 },
    storeys: 1,
    roofType: 'hip',
    roofPitch: 0.35,
    hasGarage: true,
    garagePosition: 'integrated',
    rooms: [
      { name: 'entrance', type: 'entrance', position: { x: 0, z: -4 }, size: { width: 3, depth: 2 }, connections: ['hallway', 'living'], windows: [], doors: [{ wall: 'south', position: 0.5, width: 1, height: 2.1, type: 'external', leadsTo: 'outside' }] },
      { name: 'living', type: 'living', position: { x: -3, z: -1 }, size: { width: 5, depth: 5 }, connections: ['hallway', 'kitchen'], windows: [{ wall: 'west', position: 0.5, width: 2, height: 1.5, style: 'bay' }], doors: [] },
      { name: 'kitchen', type: 'kitchen', position: { x: 2, z: -1 }, size: { width: 4, depth: 4 }, connections: ['living', 'dining'], windows: [{ wall: 'east', position: 0.5, width: 1.5, height: 1.0, style: 'casement' }], doors: [{ wall: 'south', position: 0.5, width: 1.5, height: 2.1, type: 'patio', leadsTo: 'outside' }] },
      { name: 'dining', type: 'dining', position: { x: 0, z: 3 }, size: { width: 6, depth: 3 }, connections: ['kitchen', 'hallway'], windows: [{ wall: 'north', position: 0.5, width: 2, height: 1.2, style: 'casement' }], doors: [] },
      { name: 'hallway', type: 'hallway', position: { x: 0, z: -1 }, size: { width: 3, depth: 4 }, connections: ['entrance', 'living', 'dining', 'bedroom1', 'bedroom2', 'bathroom', 'garage'], windows: [], doors: [{ wall: 'east', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'garage' }] },
      { name: 'bedroom1', type: 'bedroom', position: { x: -4, z: 2 }, size: { width: 4, depth: 4 }, connections: ['hallway'], windows: [{ wall: 'west', position: 0.5, width: 1.5, height: 1.2, style: 'casement' }, { wall: 'north', position: 0.5, width: 1.2, height: 1.2, style: 'casement' }], doors: [{ wall: 'east', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'hallway' }] },
      { name: 'bedroom2', type: 'bedroom', position: { x: 0, z: 2 }, size: { width: 3.5, depth: 3.5 }, connections: ['hallway'], windows: [{ wall: 'north', position: 0.5, width: 1.2, height: 1.2, style: 'casement' }], doors: [{ wall: 'south', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'hallway' }] },
      { name: 'bathroom', type: 'bathroom', position: { x: 3, z: 2 }, size: { width: 3, depth: 3 }, connections: ['hallway'], windows: [{ wall: 'east', position: 0.5, width: 0.8, height: 0.8, style: 'casement' }], doors: [{ wall: 'west', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'hallway' }] },
      { name: 'garage', type: 'garage', position: { x: 4.5, z: 2 }, size: { width: 3.5, depth: 6 }, connections: ['hallway'], windows: [], doors: [{ wall: 'south', position: 0.5, width: 2.4, height: 2.2, type: 'garage', leadsTo: 'outside' }] }
    ]
  },
  cottage: {
    id: 'cottage',
    name: 'Country Cottage',
    footprint: { width: 8, depth: 8 },
    storeys: 1,
    roofType: 'gable',
    roofPitch: 0.7,
    hasGarage: false,
    rooms: [
      { name: 'entrance', type: 'entrance', position: { x: 0, z: -3 }, size: { width: 2.5, depth: 2 }, connections: ['living'], windows: [], doors: [{ wall: 'south', position: 0.5, width: 0.9, height: 2, type: 'external', leadsTo: 'outside' }] },
      { name: 'living', type: 'living', position: { x: 0, z: 0 }, size: { width: 5, depth: 4 }, connections: ['entrance', 'kitchen', 'bedroom1', 'bedroom2'], windows: [{ wall: 'west', position: 0.5, width: 1.5, height: 1.2, style: 'casement' }, { wall: 'east', position: 0.5, width: 1.5, height: 1.2, style: 'casement' }], doors: [] },
      { name: 'kitchen', type: 'kitchen', position: { x: 2.5, z: 0 }, size: { width: 3, depth: 3.5 }, connections: ['living'], windows: [{ wall: 'east', position: 0.5, width: 1, height: 0.8, style: 'casement' }, { wall: 'north', position: 0.5, width: 1, height: 0.8, style: 'casement' }], doors: [{ wall: 'north', position: 0.5, width: 0.9, height: 2, type: 'patio', leadsTo: 'outside' }] },
      { name: 'bedroom1', type: 'bedroom', position: { x: -2.5, z: 2.5 }, size: { width: 3.5, depth: 3.5 }, connections: ['living'], windows: [{ wall: 'west', position: 0.5, width: 1.2, height: 1.2, style: 'casement' }, { wall: 'north', position: 0.5, width: 1, height: 1, style: 'casement' }], doors: [{ wall: 'south', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'living' }] },
      { name: 'bedroom2', type: 'bedroom', position: { x: 0.5, z: 2.5 }, size: { width: 3, depth: 3.5 }, connections: ['living'], windows: [{ wall: 'north', position: 0.5, width: 1, height: 1, style: 'casement' }, { wall: 'east', position: 0.5, width: 1, height: 1, style: 'casement' }], doors: [{ wall: 'south', position: 0.5, width: 0.8, height: 2, type: 'internal', leadsTo: 'living' }] },
      { name: 'bathroom', type: 'bathroom', position: { x: -2.5, z: -2.5 }, size: { width: 2.5, depth: 2.5 }, connections: ['living'], windows: [{ wall: 'west', position: 0.5, width: 0.6, height: 0.6, style: 'casement' }], doors: [{ wall: 'east', position: 0.5, width: 0.7, height: 2, type: 'internal', leadsTo: 'living' }] }
    ]
  }
}

// ============================================
// MESH GENERATION HELPERS
// ============================================

interface MeshData {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
}

function createBoxMesh(w: number, h: number, d: number, centerY: number = 0): MeshData {
  const hw = w / 2, hh = h / 2, hd = d / 2
  const positions = [
    // Front face
    -hw, centerY - hh, hd,  hw, centerY - hh, hd,  hw, centerY + hh, hd,  -hw, centerY + hh, hd,
    // Back face
    hw, centerY - hh, -hd,  -hw, centerY - hh, -hd,  -hw, centerY + hh, -hd,  hw, centerY + hh, -hd,
    // Right face
    hw, centerY - hh, hd,  hw, centerY - hh, -hd,  hw, centerY + hh, -hd,  hw, centerY + hh, hd,
    // Left face
    -hw, centerY - hh, -hd,  -hw, centerY - hh, hd,  -hw, centerY + hh, hd,  -hw, centerY + hh, -hd,
    // Top face
    -hw, centerY + hh, hd,  hw, centerY + hh, hd,  hw, centerY + hh, -hd,  -hw, centerY + hh, -hd,
    // Bottom face
    -hw, centerY - hh, -hd,  hw, centerY - hh, -hd,  hw, centerY - hh, hd,  -hw, centerY - hh, hd
  ]
  const normals = [
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0
  ]
  const uvs = [
    0, 1,  1, 1,  1, 0,  0, 0,
    0, 1,  1, 1,  1, 0,  0, 0,
    0, 1,  1, 1,  1, 0,  0, 0,
    0, 1,  1, 1,  1, 0,  0, 0,
    0, 1,  1, 1,  1, 0,  0, 0,
    0, 1,  1, 1,  1, 0,  0, 0
  ]
  const indices = [
    0, 1, 2,  0, 2, 3,
    4, 5, 6,  4, 6, 7,
    8, 9, 10,  8, 10, 11,
    12, 13, 14,  12, 14, 15,
    16, 17, 18,  16, 18, 19,
    20, 21, 22,  20, 22, 23
  ]
  return { positions, normals, uvs, indices }
}

function createPrismMesh(w: number, h: number, d: number, centerY: number = 0): MeshData {
  // Triangular prism for gable roof
  const hw = w / 2, hh = h / 2, hd = d / 2
  const positions = [
    // Front triangle
    -hw, centerY, hd,  hw, centerY, hd,  0, centerY + hh, hd,
    // Back triangle
    hw, centerY, -hd,  -hw, centerY, -hd,  0, centerY + hh, -hd,
    // Bottom rectangle
    -hw, centerY, hd,  -hw, centerY, -hd,  hw, centerY, -hd,  hw, centerY, hd,
    // Left rectangle
    -hw, centerY, hd,  0, centerY + hh, hd,  0, centerY + hh, -hd,  -hw, centerY, -hd,
    // Right rectangle
    hw, centerY, -hd,  0, centerY + hh, -hd,  0, centerY + hh, hd,  hw, centerY, hd
  ]
  const normals = [
    0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, -1,  0, 0, -1,  0, 0, -1,
    0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
    -0.707, 0.707, 0,  -0.707, 0.707, 0,  -0.707, 0.707, 0,  -0.707, 0.707, 0,
    0.707, 0.707, 0,  0.707, 0.707, 0,  0.707, 0.707, 0,  0.707, 0.707, 0
  ]
  const uvs = [
    0, 1,  1, 1,  0.5, 0,
    0, 1,  1, 1,  0.5, 0,
    0, 1,  1, 1,  1, 0,  0, 0,
    0, 1,  1, 1,  1, 0,  0, 0,
    0, 1,  1, 1,  1, 0,  0, 0
  ]
  const indices = [
    0, 1, 2,
    3, 4, 5,
    6, 7, 8,  6, 8, 9,
    10, 11, 12,  10, 12, 13,
    14, 15, 16,  14, 16, 17
  ]
  return { positions, normals, uvs, indices }
}

function createHipRoofMesh(w: number, h: number, d: number, centerY: number = 0): MeshData {
  // Simplified hip roof as a box with sloped sides
  const hw = w / 2, hh = h / 2, hd = d / 2
  const positions = [
    // Front trapezoid (top cut off)
    -hw, centerY, hd,  hw, centerY, hd,  hw * 0.3, centerY + hh, hd,  -hw * 0.3, centerY + hh, hd,
    // Back trapezoid
    hw, centerY, -hd,  -hw, centerY, -hd,  -hw * 0.3, centerY + hh, -hd,  hw * 0.3, centerY + hh, -hd,
    // Left trapezoid
    -hw, centerY, hd,  -hw, centerY, -hd,  -hw * 0.3, centerY + hh, -hd,  -hw * 0.3, centerY + hh, hd,
    // Right trapezoid
    hw, centerY, -hd,  hw, centerY, hd,  hw * 0.3, centerY + hh, hd,  hw * 0.3, centerY + hh, -hd,
    // Top ridge
    -hw * 0.3, centerY + hh, hd,  hw * 0.3, centerY + hh, hd,  hw * 0.3, centerY + hh, -hd,  -hw * 0.3, centerY + hh, -hd,
    // Bottom
    -hw, centerY, -hd,  hw, centerY, -hd,  hw, centerY, hd,  -hw, centerY, hd
  ]
  // Simplified normals and UVs
  const normals = new Array(positions.length / 3).fill(0).flatMap((_, i) => {
    if (i < 8) return [0, 0.707, i < 4 ? 1 : -1]
    if (i < 16) return [i < 12 ? -0.707 : 0.707, 0.707, 0]
    if (i < 20) return [0, 1, 0]
    return [0, -1, 0]
  })
  const uvs = new Array(positions.length / 3).fill(0).flatMap((_, i) => [i % 2, Math.floor(i / 2) % 2])
  const indices = [
    0, 1, 2,  0, 2, 3,
    4, 5, 6,  4, 6, 7,
    8, 9, 10,  8, 10, 11,
    12, 13, 14,  12, 14, 15,
    16, 17, 18,  16, 18, 19,
    20, 21, 22,  20, 22, 23
  ]
  return { positions, normals, uvs, indices }
}

function mergeMeshData(target: MeshData, source: MeshData, vertexOffset: number): number {
  target.positions.push(...source.positions)
  target.normals.push(...source.normals)
  target.uvs.push(...source.uvs)
  target.indices.push(...source.indices.map(i => i + vertexOffset))
  return vertexOffset + source.positions.length / 3
}

// ============================================
// HOUSE GENERATION
// ============================================

const HouseWorker = {
  init(): void {
    console.log('[HouseWorker] Initialized')
  },

  getTemplates(): Record<string, HouseTemplate> {
    return HOUSE_TEMPLATES
  },

  generateHouse(params: HouseGenerationParams): HouseGeometryData {
    const rng = mulberry32(params.seed + params.variationSeed * 1000)
    const template = HOUSE_TEMPLATES[params.templateId] || HOUSE_TEMPLATES.terraced

    // Determine wall height per storey
    const storeyHeight = 2.8
    const wallThickness = 0.2

    // LOD determines detail level
    const isImposter = params.lodLevel >= 2
    const isSimplified = params.lodLevel >= 1

    const exterior: MeshData = { positions: [], normals: [], uvs: [], indices: [] }
    const interior: MeshData = { positions: [], normals: [], uvs: [], indices: [] }
    const collision: MeshData = { positions: [], normals: [], uvs: [], indices: [] }
    const rooms: RoomBoundsData[] = []
    const props: PropData[] = []

    let vertexOffset = 0
    let interiorOffset = 0
    let collisionOffset = 0

    // ============================================
    // GENERATE EXTERIOR WALLS
    // ============================================
    for (const room of template.rooms) {
      if (room.type === 'garage' && !template.hasGarage) continue

      const roomMinX = room.position.x - room.size.width / 2
      const roomMaxX = room.position.x + room.size.width / 2
      const roomMinZ = room.position.z - room.size.depth / 2
      const roomMaxZ = room.position.z + room.size.depth / 2

      // Determine which walls are exterior
      const hasNorthNeighbor = template.rooms.some(r =>
        r.name !== room.name &&
        Math.abs(r.position.x - room.position.x) < 0.1 &&
        r.position.z > room.position.z &&
        Math.abs(r.position.z - roomMaxZ) < 1
      )
      const hasSouthNeighbor = template.rooms.some(r =>
        r.name !== room.name &&
        Math.abs(r.position.x - room.position.x) < 0.1 &&
        r.position.z < room.position.z &&
        Math.abs(r.position.z - roomMinZ) < 1
      )
      const hasEastNeighbor = template.rooms.some(r =>
        r.name !== room.name &&
        Math.abs(r.position.z - room.position.z) < 0.1 &&
        r.position.x > room.position.x &&
        Math.abs(r.position.x - roomMaxX) < 1
      )
      const hasWestNeighbor = template.rooms.some(r =>
        r.name !== room.name &&
        Math.abs(r.position.z - room.position.z) < 0.1 &&
        r.position.x < room.position.x &&
        Math.abs(r.position.x - roomMinX) < 1
      )

      const wallHeight = template.storeys * storeyHeight
      const wallBaseY = 0

      // North wall
      if (!hasNorthNeighbor) {
        const wall = createBoxMesh(room.size.width, wallHeight, wallThickness, wallBaseY + wallHeight / 2)
        // Position wall
        for (let i = 0; i < wall.positions.length; i += 3) {
          wall.positions[i] += room.position.x
          wall.positions[i + 2] += roomMaxZ + wallThickness / 2
        }
        // Cut out windows/doors
        // (simplified - just skip for now, would need CSG for proper cutouts)
        vertexOffset = mergeMeshData(exterior, wall, vertexOffset)

        // Add window geometry if not imposter
        if (!isImposter) {
          for (const win of room.windows) {
            if (win.wall === 'north') {
              // Add window frame/glass as separate small mesh
              const wx = room.position.x + (win.position - 0.5) * room.size.width
              const winMesh = createBoxMesh(win.width, win.height, 0.05, win.height / 2)
              for (let i = 0; i < winMesh.positions.length; i += 3) {
                winMesh.positions[i] += wx
                winMesh.positions[i + 1] += 1.0 // window sill height
                winMesh.positions[i + 2] += roomMaxZ + wallThickness
              }
              vertexOffset = mergeMeshData(exterior, winMesh, vertexOffset)
            }
          }
        }
      }

      // South wall
      if (!hasSouthNeighbor) {
        const wall = createBoxMesh(room.size.width, wallHeight, wallThickness, wallBaseY + wallHeight / 2)
        for (let i = 0; i < wall.positions.length; i += 3) {
          wall.positions[i] += room.position.x
          wall.positions[i + 2] += roomMinZ - wallThickness / 2
        }
        vertexOffset = mergeMeshData(exterior, wall, vertexOffset)

        if (!isImposter) {
          for (const win of room.windows) {
            if (win.wall === 'south') {
              const wx = room.position.x + (win.position - 0.5) * room.size.width
              const winMesh = createBoxMesh(win.width, win.height, 0.05, win.height / 2)
              for (let i = 0; i < winMesh.positions.length; i += 3) {
                winMesh.positions[i] += wx
                winMesh.positions[i + 1] += 1.0
                winMesh.positions[i + 2] += roomMinZ - wallThickness
              }
              vertexOffset = mergeMeshData(exterior, winMesh, vertexOffset)
            }
          }
        }
      }

      // East wall
      if (!hasEastNeighbor) {
        const wall = createBoxMesh(wallThickness, wallHeight, room.size.depth, wallBaseY + wallHeight / 2)
        for (let i = 0; i < wall.positions.length; i += 3) {
          wall.positions[i] += roomMaxX + wallThickness / 2
          wall.positions[i + 2] += room.position.z
        }
        vertexOffset = mergeMeshData(exterior, wall, vertexOffset)

        if (!isImposter) {
          for (const win of room.windows) {
            if (win.wall === 'east') {
              const wz = room.position.z + (win.position - 0.5) * room.size.depth
              const winMesh = createBoxMesh(0.05, win.height, win.width, win.height / 2)
              for (let i = 0; i < winMesh.positions.length; i += 3) {
                winMesh.positions[i] += roomMaxX + wallThickness
                winMesh.positions[i + 1] += 1.0
                winMesh.positions[i + 2] += wz
              }
              vertexOffset = mergeMeshData(exterior, winMesh, vertexOffset)
            }
          }
        }
      }

      // West wall
      if (!hasWestNeighbor) {
        const wall = createBoxMesh(wallThickness, wallHeight, room.size.depth, wallBaseY + wallHeight / 2)
        for (let i = 0; i < wall.positions.length; i += 3) {
          wall.positions[i] += roomMinX - wallThickness / 2
          wall.positions[i + 2] += room.position.z
        }
        vertexOffset = mergeMeshData(exterior, wall, vertexOffset)

        if (!isImposter) {
          for (const win of room.windows) {
            if (win.wall === 'west') {
              const wz = room.position.z + (win.position - 0.5) * room.size.depth
              const winMesh = createBoxMesh(0.05, win.height, win.width, win.height / 2)
              for (let i = 0; i < winMesh.positions.length; i += 3) {
                winMesh.positions[i] += roomMinX - wallThickness
                winMesh.positions[i + 1] += 1.0
                winMesh.positions[i + 2] += wz
              }
              vertexOffset = mergeMeshData(exterior, winMesh, vertexOffset)
            }
          }
        }
      }

      // Add doors to exterior
      if (!isImposter) {
        for (const door of room.doors) {
          if (door.type === 'external' || door.type === 'patio' || door.type === 'garage') {
            // Door frame would go here
          }
        }
      }
    }

    // ============================================
    // GENERATE FLOORS AND CEILINGS
    // ============================================
    for (let storey = 0; storey < template.storeys; storey++) {
      const floorY = storey * storeyHeight

      // Floor
      for (const room of template.rooms) {
        if (room.type === 'garage' && !template.hasGarage) continue

        const floor = createBoxMesh(room.size.width, 0.2, room.size.depth, floorY + 0.1)
        for (let i = 0; i < floor.positions.length; i += 3) {
          floor.positions[i] += room.position.x
          floor.positions[i + 2] += room.position.z
        }
        vertexOffset = mergeMeshData(exterior, floor, vertexOffset)
      }

      // Ceiling (for non-top storeys)
      if (storey < template.storeys - 1) {
        for (const room of template.rooms) {
          if (room.type === 'garage' && !template.hasGarage) continue
          const ceiling = createBoxMesh(room.size.width, 0.15, room.size.depth, floorY + storeyHeight - 0.075)
          for (let i = 0; i < ceiling.positions.length; i += 3) {
            ceiling.positions[i] += room.position.x
            ceiling.positions[i + 2] += room.position.z
          }
          vertexOffset = mergeMeshData(exterior, ceiling, vertexOffset)
        }
      }
    }

    // ============================================
    // GENERATE ROOF
    // ============================================
    const roofBaseY = template.storeys * storeyHeight
    const roofWidth = template.footprint.width + 1 // overhang
    const roofDepth = template.footprint.depth + 1
    const roofHeight = Math.min(roofWidth, roofDepth) * template.roofPitch * 0.5

    let roofMesh: MeshData
    switch (template.roofType) {
      case 'gable':
        roofMesh = createPrismMesh(roofWidth, roofHeight, roofDepth, roofBaseY + roofHeight / 2)
        break
      case 'hip':
        roofMesh = createHipRoofMesh(roofWidth, roofHeight, roofDepth, roofBaseY + roofHeight / 2)
        break
      case 'flat':
        roofMesh = createBoxMesh(roofWidth, 0.3, roofDepth, roofBaseY + 0.15)
        break
      case 'mansard':
        // Two-slope roof - simplified as hip
        roofMesh = createHipRoofMesh(roofWidth, roofHeight * 1.3, roofDepth, roofBaseY + roofHeight * 0.65)
        break
      default:
        roofMesh = createHipRoofMesh(roofWidth, roofHeight, roofDepth, roofBaseY + roofHeight / 2)
    }
    vertexOffset = mergeMeshData(exterior, roofMesh, vertexOffset)

    // Chimney (random)
    if (!isImposter && rng() < 0.7) {
      const chimneyX = (rng() - 0.5) * roofWidth * 0.5
      const chimneyZ = (rng() - 0.5) * roofDepth * 0.5
      const chimney = createBoxMesh(0.6, 1.5, 0.6, roofBaseY + roofHeight + 0.75)
      for (let i = 0; i < chimney.positions.length; i += 3) {
        chimney.positions[i] += chimneyX
        chimney.positions[i + 2] += chimneyZ
      }
      vertexOffset = mergeMeshData(exterior, chimney, vertexOffset)
    }

    // ============================================
    // GENERATE INTERIOR (if requested and not imposter)
    // ============================================
    if (params.includeInterior && !isImposter) {
      for (const room of template.rooms) {
        if (room.type === 'garage' && !template.hasGarage) continue

        const floorY = 0 // Single storey for interior, or compute per storey

        // Floor
        const floor = createBoxMesh(room.size.width, 0.05, room.size.depth, 0.025)
        for (let i = 0; i < floor.positions.length; i += 3) {
          floor.positions[i] += room.position.x
          floor.positions[i + 2] += room.position.z
        }
        interiorOffset = mergeMeshData(interior, floor, interiorOffset)

        // Ceiling
        const ceiling = createBoxMesh(room.size.width, 0.05, room.size.depth, storeyHeight - 0.025)
        for (let i = 0; i < ceiling.positions.length; i += 3) {
          ceiling.positions[i] += room.position.x
          ceiling.positions[i + 2] += room.position.z
        }
        interiorOffset = mergeMeshData(interior, ceiling, interiorOffset)

        // Interior walls (simplified)
        // In a full implementation, we'd generate interior walls between rooms
      }
    }

    // ============================================
    // GENERATE COLLISION MESH (simplified)
    // ============================================
    // Just the exterior walls and floor for collision
    for (const room of template.rooms) {
      if (room.type === 'garage' && !template.hasGarage) continue

      const roomMinX = room.position.x - room.size.width / 2
      const roomMaxX = room.position.x + room.size.width / 2
      const roomMinZ = room.position.z - room.size.depth / 2
      const roomMaxZ = room.position.z + room.size.depth / 2
      const wallHeight = template.storeys * storeyHeight

      // Floor collision
      const floor = createBoxMesh(room.size.width, 0.2, room.size.depth, 0.1)
      for (let i = 0; i < floor.positions.length; i += 3) {
        floor.positions[i] += room.position.x
        floor.positions[i + 2] += room.position.z
      }
      collisionOffset = mergeMeshData(collision, floor, collisionOffset)

      // Wall collisions (simplified - just bounding boxes)
      if (!isSimplified) {
        const hasNorthNeighbor = template.rooms.some(r =>
          r.name !== room.name &&
          Math.abs(r.position.x - room.position.x) < 0.1 &&
          r.position.z > room.position.z &&
          Math.abs(r.position.z - roomMaxZ) < 1
        )
        if (!hasNorthNeighbor) {
          const wall = createBoxMesh(room.size.width, wallHeight, wallThickness, wallHeight / 2)
          for (let i = 0; i < wall.positions.length; i += 3) {
            wall.positions[i] += room.position.x
            wall.positions[i + 2] += roomMaxZ + wallThickness / 2
          }
          collisionOffset = mergeMeshData(collision, wall, collisionOffset)
        }
        // ... other walls similarly
      }
    }

    // ============================================
    // ROOM BOUNDS FOR STREAMING
    // ============================================
    for (const room of template.rooms) {
      if (room.type === 'garage' && !template.hasGarage) continue

      const roomMinX = room.position.x - room.size.width / 2
      const roomMaxX = room.position.x + room.size.width / 2
      const roomMinZ = room.position.z - room.size.depth / 2
      const roomMaxZ = room.position.z + room.size.depth / 2

      // Find entrance door
      const entranceDoor = room.doors.find(d => d.type === 'external')
      let doorPos: number[] | undefined
      if (entranceDoor) {
        if (entranceDoor.wall === 'south') doorPos = [room.position.x + (entranceDoor.position - 0.5) * room.size.width, 0, roomMinZ]
        else if (entranceDoor.wall === 'north') doorPos = [room.position.x + (entranceDoor.position - 0.5) * room.size.width, 0, roomMaxZ]
        else if (entranceDoor.wall === 'east') doorPos = [roomMaxX, 0, room.position.z + (entranceDoor.position - 0.5) * room.size.depth]
        else if (entranceDoor.wall === 'west') doorPos = [roomMinX, 0, room.position.z + (entranceDoor.position - 0.5) * room.size.depth]
      }

      rooms.push({
        name: room.name,
        min: [roomMinX, 0, roomMinZ],
        max: [roomMaxX, storeyHeight, roomMaxZ],
        floorY: 0,
        ceilingY: storeyHeight,
        hasDoor: !!entranceDoor,
        doorPosition: doorPos
      })
    }

    // ============================================
    // EXTERIOR PROPS
    // ============================================
    if (!isImposter && params.includeExterior) {
      // Wheelie bins
      if (rng() < 0.8) {
        props.push({
          type: 'wheelie_bin',
          position: [template.footprint.width / 2 + 1, 0, -template.footprint.depth / 2 - 1],
          rotation: [0, rng() * Math.PI * 2, 0],
          scale: [1, 1, 1]
        })
      }

      // Driveway car
      if (template.hasGarage && rng() < 0.3) {
        props.push({
          type: 'driveway_car',
          position: [0, 0, -template.footprint.depth / 2 - 3],
          rotation: [0, Math.PI, 0],
          scale: [1, 1, 1]
        })
      }

      // Mailbox
      if (rng() < 0.6) {
        props.push({
          type: 'mailbox',
          position: [template.footprint.width / 2 + 0.5, 0, -template.footprint.depth / 2 - 0.5],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        })
      }

      // TV aerial on roof
      if (!isSimplified && rng() < 0.7) {
        props.push({
          type: 'tv_aerial',
          position: [0, roofBaseY + roofHeight + 1, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        })
      }
    }

    // ============================================
    // COMPUTE BOUNDS
    // ============================================
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    for (let i = 0; i < exterior.positions.length; i += 3) {
      minX = Math.min(minX, exterior.positions[i])
      minY = Math.min(minY, exterior.positions[i + 1])
      minZ = Math.min(minZ, exterior.positions[i + 2])
      maxX = Math.max(maxX, exterior.positions[i])
      maxY = Math.max(maxY, exterior.positions[i + 1])
      maxZ = Math.max(maxZ, exterior.positions[i + 2])
    }

    // Entrance position (front door of entrance room)
    const entranceRoom = template.rooms.find(r => r.type === 'entrance')
    let entrancePos = [0, 0, -template.footprint.depth / 2 - 1]
    if (entranceRoom) {
      const door = entranceRoom.doors.find(d => d.type === 'external')
      if (door) {
        if (door.wall === 'south') entrancePos = [entranceRoom.position.x + (door.position - 0.5) * entranceRoom.size.width, 1, entranceRoom.position.z - entranceRoom.size.depth / 2 - 0.5]
      }
    }

    // ============================================
    // CONVERT TO TYPED ARRAYS
    // ============================================
    return {
      exteriorVertices: new Float32Array(exterior.positions),
      exteriorNormals: new Float32Array(exterior.normals),
      exteriorUvs: new Float32Array(exterior.uvs),
      exteriorIndices: new Uint32Array(exterior.indices),
      interiorVertices: params.includeInterior && !isImposter ? new Float32Array(interior.positions) : undefined,
      interiorNormals: params.includeInterior && !isImposter ? new Float32Array(interior.normals) : undefined,
      interiorUvs: params.includeInterior && !isImposter ? new Float32Array(interior.uvs) : undefined,
      interiorIndices: params.includeInterior && !isImposter ? new Uint32Array(interior.indices) : undefined,
      collisionVertices: new Float32Array(collision.positions),
      collisionIndices: new Uint32Array(collision.indices),
      rooms,
      props,
      bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
      entrancePosition: entrancePos
    }
  }
}

export type HouseWorkerAPI = typeof HouseWorker

Comlink.expose(HouseWorker)

console.log('[HouseWorker] Initialized and ready')