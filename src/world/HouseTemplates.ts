import * as THREE from 'three'
import { HouseVariationData } from './HouseVariation.js'

/**
 * HouseTemplates - Data-driven house templates for procedural generation
 * Separated from HouseGenerator for maintainability and variety
 */

export interface HouseTemplate {
  name: string
  width: number
  depth: number
  height: number
  floors: number
  roofType: 'pitched' | 'hipped' | 'thatched' | 'flat' | 'mansard'
  windowStyle: 'sash' | 'casement' | 'bay' | 'diamond' | 'modern' | 'georgian'
  doorStyle: 'panel' | 'upvc' | 'composite' | 'stable' | 'georgian' | 'modern'
  brickColor: number
  brickTexture: string // texture name
  roofColor: number
  roofTexture: string
  roomLayout: string
  chimneyChance: number
  porchChance: number
  dormerChance: number
  bayWindowChance: number
  garageChance: number
  gardenDepth: number
  drivewayWidth: number
  era: 'victorian' | 'edwardian' | '1930s' | '1950s' | '1970s' | '1990s' | 'modern'
  affluence: 'low' | 'medium' | 'high' // affects materials, details, size
}

export interface RoomTemplate {
  name: string
  width: number
  depth: number
  height: number
  floorMaterial: string
  wallMaterial: string
  ceilingMaterial: string
  windowPositions: Array<{ wall: 'north' | 'south' | 'east' | 'west'; x: number; z: number; width: number; height: number; heightFromFloor?: number }>
  doorPositions: Array<{ wall: 'north' | 'south' | 'east' | 'west'; position: number; width: number; height: number; connectsTo: string }>
  required: boolean // must exist in this house type
  minFloor: number // 0 = ground, 1 = first, etc.
  maxFloor: number
  position: THREE.Vector3 // center of room in house local space
}

export interface HouseLayoutTemplate {
  name: string
  rooms: RoomTemplate[]
  connections: Array<{ from: string; to: string; doorWidth: number }>
  stairs?: { x: number; z: number; width: number; depth: number; goesUp: boolean }
}

// ============================================
// HOUSE TEMPLATES (5 base types with variations)
// ============================================

export const HOUSE_TEMPLATES: Map<string, HouseTemplate> = new Map([
  // TERRACED HOUSE - Classic UK terraced, narrow frontage
  ['terraced', {
    name: 'terraced',
    width: 5.5,
    depth: 11,
    height: 7.5,
    floors: 2,
    roofType: 'pitched',
    windowStyle: 'sash',
    doorStyle: 'panel',
    brickColor: 0xaa6644,
    brickTexture: 'brick_victorian_red',
    roofColor: 0x552211,
    roofTexture: 'roof_slate_dark',
    roomLayout: 'standard_terraced',
    chimneyChance: 0.8,
    porchChance: 0.2,
    dormerChance: 0.15,
    bayWindowChance: 0.1,
    garageChance: 0.0,
    gardenDepth: 10,
    drivewayWidth: 0,
    era: 'victorian',
    affluence: 'medium'
  }],

  // SEMI-DETACHED - Wider, shared party wall
  ['semi_detached', {
    name: 'semi_detached',
    width: 7.5,
    depth: 10,
    height: 8,
    floors: 2,
    roofType: 'pitched',
    windowStyle: 'casement',
    doorStyle: 'upvc',
    brickColor: 0xb8860b,
    brickTexture: 'brick_edwardian_yellow',
    roofColor: 0x654321,
    roofTexture: 'roof_concrete_tile',
    roomLayout: 'standard_semi',
    chimneyChance: 0.9,
    porchChance: 0.4,
    dormerChance: 0.25,
    bayWindowChance: 0.3,
    garageChance: 0.1,
    gardenDepth: 12,
    drivewayWidth: 2.5,
    era: '1930s',
    affluence: 'medium'
  }],

  // DETACHED - Standalone, larger, more variation
  ['detached', {
    name: 'detached',
    width: 10,
    depth: 12,
    height: 9,
    floors: 2,
    roofType: 'hipped',
    windowStyle: 'bay',
    doorStyle: 'composite',
    brickColor: 0xd2b48c,
    brickTexture: 'brick_modern_buff',
    roofColor: 0x8b4513,
    roofTexture: 'roof_clay_tile',
    roomLayout: 'standard_detached',
    chimneyChance: 0.7,
    porchChance: 0.6,
    dormerChance: 0.35,
    bayWindowChance: 0.5,
    garageChance: 0.6,
    gardenDepth: 15,
    drivewayWidth: 3.5,
    era: '1970s',
    affluence: 'high'
  }],

  // BUNGALOW - Single storey, wider footprint
  ['bungalow', {
    name: 'bungalow',
    width: 11,
    depth: 9.5,
    height: 4.5,
    floors: 1,
    roofType: 'pitched',
    windowStyle: 'casement',
    doorStyle: 'upvc',
    brickColor: 0xc0a080,
    brickTexture: 'brick_1950s_cream',
    roofColor: 0x8b7355,
    roofTexture: 'roof_concrete_tile',
    roomLayout: 'bungalow',
    chimneyChance: 0.5,
    porchChance: 0.5,
    dormerChance: 0.2,
    bayWindowChance: 0.4,
    garageChance: 0.4,
    gardenDepth: 12,
    drivewayWidth: 3,
    era: '1950s',
    affluence: 'medium'
  }],

  // COTTAGE - Smaller, character, thatched or pitched
  ['cottage', {
    name: 'cottage',
    width: 6.5,
    depth: 8.5,
    height: 6,
    floors: 1.5,
    roofType: 'thatched',
    windowStyle: 'diamond',
    doorStyle: 'stable',
    brickColor: 0xddc8a8,
    brickTexture: 'brick_cottage_stone',
    roofColor: 0xc2b280,
    roofTexture: 'roof_thatch',
    roomLayout: 'cottage',
    chimneyChance: 0.9,
    porchChance: 0.3,
    dormerChance: 0.4,
    bayWindowChance: 0.1,
    garageChance: 0.0,
    gardenDepth: 8,
    drivewayWidth: 0,
    era: 'victorian',
    affluence: 'low'
  }],

  // MODERN TOWNHOUSE - New build, 3 floors
  ['modern_townhouse', {
    name: 'modern_townhouse',
    width: 5.8,
    depth: 10,
    height: 11,
    floors: 3,
    roofType: 'flat',
    windowStyle: 'modern',
    doorStyle: 'modern',
    brickColor: 0xcccccc,
    brickTexture: 'brick_modern_white',
    roofColor: 0x222222,
    roofTexture: 'roof_membrane',
    roomLayout: 'modern_townhouse',
    chimneyChance: 0.0,
    porchChance: 0.1,
    dormerChance: 0.0,
    bayWindowChance: 0.0,
    garageChance: 0.3,
    gardenDepth: 6,
    drivewayWidth: 2.5,
    era: 'modern',
    affluence: 'high'
  }],

  // 1970s SEMI - Distinctive style
  ['semi_1970s', {
    name: 'semi_1970s',
    width: 7.5,
    depth: 9.5,
    height: 7,
    floors: 2,
    roofType: 'pitched',
    windowStyle: 'casement',
    doorStyle: 'upvc',
    brickColor: 0xcd9b6b,
    brickTexture: 'brick_1970s_orange',
    roofColor: 0x8b5a2b,
    roofTexture: 'roof_concrete_tile_brown',
    roomLayout: 'standard_semi',
    chimneyChance: 0.3,
    porchChance: 0.2,
    dormerChance: 0.1,
    bayWindowChance: 0.05,
    garageChance: 0.4,
    gardenDepth: 10,
    drivewayWidth: 3,
    era: '1970s',
    affluence: 'low'
  }],

  // VICTORIAN VILLA - Large, high ceilings, ornate
  ['victorian_villa', {
    name: 'victorian_villa',
    width: 12,
    depth: 14,
    height: 10,
    floors: 2,
    roofType: 'mansard',
    windowStyle: 'georgian',
    doorStyle: 'georgian',
    brickColor: 0xcdb891,
    brickTexture: 'brick_victorian_yellow',
    roofColor: 0x3a3a3a,
    roofTexture: 'roof_slate',
    roomLayout: 'victorian_villa',
    chimneyChance: 1.0,
    porchChance: 0.8,
    dormerChance: 0.6,
    bayWindowChance: 0.7,
    garageChance: 0.0,
    gardenDepth: 20,
    drivewayWidth: 4,
    era: 'victorian',
    affluence: 'high'
  }]
])

// ============================================
// ROOM TEMPLATES
// ============================================

export const ROOM_TEMPLATES: Map<string, RoomTemplate> = new Map([
  // Standard rooms
  ['entrance', {
    name: 'entrance',
    width: 3,
    depth: 2.5,
    height: 2.5,
    floorMaterial: 'floor_hallway_tile',
    wallMaterial: 'wall_painted_cream',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [],
    doorPositions: [
      { wall: 'south', position: 0.5, width: 1, height: 2.1, connectsTo: 'outside' },
      { wall: 'north', position: 0.5, width: 0.8, height: 2, connectsTo: 'living' }
    ],
    required: true,
    minFloor: 0,
    maxFloor: 0,
    position: new THREE.Vector3(0, 0, 6)
  }],

  ['living', {
    name: 'living',
    width: 4.5,
    depth: 5,
    height: 2.5,
    floorMaterial: 'floor_carpet_neutral',
    wallMaterial: 'wall_painted_cream',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'north', x: 0, z: 2.5, width: 1.8, height: 1.4, heightFromFloor: 1.0 },
      { wall: 'north', x: -1.5, z: 2.5, width: 1.2, height: 1.2, heightFromFloor: 1.0 }
    ],
    doorPositions: [
      { wall: 'south', position: 0.5, width: 0.8, height: 2, connectsTo: 'entrance' },
      { wall: 'east', position: 0.3, width: 0.8, height: 2, connectsTo: 'kitchen' }
    ],
    required: true,
    minFloor: 0,
    maxFloor: 0,
    position: new THREE.Vector3(0, 0, 0)
  }],

  ['kitchen', {
    name: 'kitchen',
    width: 3.5,
    depth: 4,
    height: 2.5,
    floorMaterial: 'floor_kitchen_tile',
    wallMaterial: 'wall_tiled_half',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'east', x: 0, z: -2, width: 1.2, height: 1, heightFromFloor: 1.2 },
      { wall: 'north', x: -1.75, z: 0, width: 0.8, height: 1, heightFromFloor: 1.0 }
    ],
    doorPositions: [
      { wall: 'west', position: 0.5, width: 0.8, height: 2, connectsTo: 'living' },
      { wall: 'north', position: 0.5, width: 0.8, height: 2, connectsTo: 'dining' }
    ],
    required: true,
    minFloor: 0,
    maxFloor: 0,
    position: new THREE.Vector3(5.5, 0, 6)
  }],

  ['dining', {
    name: 'dining',
    width: 3.5,
    depth: 3.5,
    height: 2.5,
    floorMaterial: 'floor_wood',
    wallMaterial: 'wall_painted_cream',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'east', x: 0, z: -1.75, width: 1.5, height: 1.3, heightFromFloor: 0.8 }
    ],
    doorPositions: [
      { wall: 'west', position: 0.3, width: 0.8, height: 2, connectsTo: 'kitchen' },
      { wall: 'east', position: 0.5, width: 0.8, height: 2, connectsTo: 'living' }
    ],
    required: false,
    minFloor: 0,
    maxFloor: 0,
    position: new THREE.Vector3(5.5, 0, 0)
  }],

  ['bathroom', {
    name: 'bathroom',
    width: 2.2,
    depth: 2.5,
    height: 2.4,
    floorMaterial: 'floor_bathroom_tile',
    wallMaterial: 'wall_tiled_full',
    ceilingMaterial: 'ceiling_white_moisture',
    windowPositions: [
      { wall: 'north', x: 0, z: 1.25, width: 0.6, height: 0.8, heightFromFloor: 1.8 }
    ],
    doorPositions: [
      { wall: 'west', position: 0.5, width: 0.7, height: 1.9, connectsTo: 'landing' }
    ],
    required: true,
    minFloor: 0,
    maxFloor: 1,
    position: new THREE.Vector3(-1, 0, 6)
  }],

  ['bedroom_main', {
    name: 'bedroom_main',
    width: 4,
    depth: 4.5,
    height: 2.4,
    floorMaterial: 'floor_carpet_neutral',
    wallMaterial: 'wall_painted_pale',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'west', x: 0, z: 2.25, width: 1.5, height: 1.3, heightFromFloor: 0.8 },
      { wall: 'north', x: -1.5, z: 2.25, width: 1, height: 1.2, heightFromFloor: 1.0 }
    ],
    doorPositions: [
      { wall: 'east', position: 0.5, width: 0.8, height: 2, connectsTo: 'landing' }
    ],
    required: true,
    minFloor: 1,
    maxFloor: 2,
    position: new THREE.Vector3(-6, 0, 6)
  }],

  ['bedroom_2', {
    name: 'bedroom_2',
    width: 3.2,
    depth: 3.5,
    height: 2.4,
    floorMaterial: 'floor_carpet_neutral',
    wallMaterial: 'wall_painted_pale',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'west', x: 0, z: 1.75, width: 1.2, height: 1.2, heightFromFloor: 0.9 }
    ],
    doorPositions: [
      { wall: 'north', position: 0.5, width: 0.8, height: 2, connectsTo: 'landing' }
    ],
    required: false,
    minFloor: 1,
    maxFloor: 2,
    position: new THREE.Vector3(-6, 0, 0)
  }],

  ['bedroom_3', {
    name: 'bedroom_3',
    width: 2.8,
    depth: 3,
    height: 2.3,
    floorMaterial: 'floor_carpet_neutral',
    wallMaterial: 'wall_painted_pale',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'west', x: 0, z: 1.5, width: 1, height: 1, heightFromFloor: 0.8 }
    ],
    doorPositions: [
      { wall: 'north', position: 0.5, width: 0.7, height: 1.9, connectsTo: 'landing' }
    ],
    required: false,
    minFloor: 1,
    maxFloor: 2,
    position: new THREE.Vector3(-3, 0, -4)
  }],

  ['landing', {
    name: 'landing',
    width: 2.5,
    depth: 3,
    height: 2.4,
    floorMaterial: 'floor_carpet_neutral',
    wallMaterial: 'wall_painted_cream',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'west', x: 0, z: 1.5, width: 0.8, height: 1, heightFromFloor: 1.0 }
    ],
    doorPositions: [
      { wall: 'west', position: 0.3, width: 0.8, height: 2, connectsTo: 'bedroom_main' },
      { wall: 'east', position: 0.3, width: 0.7, height: 1.9, connectsTo: 'bedroom_2' },
      { wall: 'south', position: 0.5, width: 0.8, height: 2, connectsTo: 'stairs_down' }
    ],
    required: true,
    minFloor: 1,
    maxFloor: 2,
    position: new THREE.Vector3(-4, 0, -1)
  }],

  // Bungalow rooms (all on ground floor)
  ['bungalow_living', {
    name: 'bungalow_living',
    width: 5,
    depth: 5.5,
    height: 2.5,
    floorMaterial: 'floor_carpet_neutral',
    wallMaterial: 'wall_painted_cream',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'north', x: 0, z: 2.75, width: 2, height: 1.5, heightFromFloor: 0.8 },
      { wall: 'north', x: -2, z: 2.75, width: 1.2, height: 1.2, heightFromFloor: 0.8 }
    ],
    doorPositions: [
      { wall: 'south', position: 0.5, width: 0.8, height: 2, connectsTo: 'entrance' },
      { wall: 'east', position: 0.5, width: 0.8, height: 2, connectsTo: 'kitchen' }
    ],
    required: true,
    minFloor: 0,
    maxFloor: 0,
    position: new THREE.Vector3(0, 0, 0)
  }],

  ['bungalow_kitchen', {
    name: 'bungalow_kitchen',
    width: 3.5,
    depth: 4,
    height: 2.5,
    floorMaterial: 'floor_kitchen_tile',
    wallMaterial: 'wall_tiled_half',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'east', x: 0, z: -2, width: 1.2, height: 1, heightFromFloor: 1.2 }
    ],
    doorPositions: [
      { wall: 'west', position: 0.5, width: 0.8, height: 2, connectsTo: 'living' },
      { wall: 'north', position: 0.5, width: 0.7, height: 1.9, connectsTo: 'bathroom' }
    ],
    required: true,
    minFloor: 0,
    maxFloor: 0,
    position: new THREE.Vector3(5.5, 0, 6)
  }],

  // Cottage rooms (compact, cozy)
  ['cottage_living', {
    name: 'cottage_living',
    width: 4,
    depth: 4.5,
    height: 3.5, // exposed beams
    floorMaterial: 'floor_flagstone',
    wallMaterial: 'wall_plaster_rough',
    ceilingMaterial: 'ceiling_beams',
    windowPositions: [
      { wall: 'north', x: 0, z: 2.25, width: 1, height: 1.5, heightFromFloor: 0.8 },
      { wall: 'north', x: -1.5, z: 2.25, width: 0.8, height: 1.2, heightFromFloor: 1.0 }
    ],
    doorPositions: [
      { wall: 'south', position: 0.5, width: 0.8, height: 2, connectsTo: 'entrance' }
    ],
    required: true,
    minFloor: 0,
    maxFloor: 0,
    position: new THREE.Vector3(0, 0, 0)
  }],

  // Modern townhouse rooms
  ['modern_openplan', {
    name: 'modern_openplan',
    width: 5,
    depth: 8,
    height: 2.7,
    floorMaterial: 'floor_engineered_wood',
    wallMaterial: 'wall_painted_white',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'north', x: 0, z: 4, width: 3, height: 2.2, heightFromFloor: 0.5 }, // large picture window
      { wall: 'north', x: 2.5, z: 4, width: 1.5, height: 2.2, heightFromFloor: 0.5 }
    ],
    doorPositions: [
      { wall: 'south', position: 0.5, width: 1, height: 2.2, connectsTo: 'entrance' },
      { wall: 'west', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'wc' },
      { wall: 'east', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'utility' }
    ],
    required: true,
    minFloor: 0,
    maxFloor: 0,
    position: new THREE.Vector3(0, 0, 0)
  }],

  ['modern_master', {
    name: 'modern_master',
    width: 4,
    depth: 5,
    height: 2.6,
    floorMaterial: 'floor_carpet_luxury',
    wallMaterial: 'wall_painted_grey',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'north', x: 0, z: 2.5, width: 1.8, height: 1.6, heightFromFloor: 0.8 }
    ],
    doorPositions: [
      { wall: 'south', position: 0.5, width: 0.9, height: 2.1, connectsTo: 'landing' },
      { wall: 'west', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'en_suite' }
    ],
    required: true,
    minFloor: 1,
    maxFloor: 2,
    position: new THREE.Vector3(0, 0, 6)
  }],

  ['modern_bedroom', {
    name: 'modern_bedroom',
    width: 3.2,
    depth: 3.5,
    height: 2.6,
    floorMaterial: 'floor_carpet_luxury',
    wallMaterial: 'wall_painted_grey',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [
      { wall: 'north', x: 0, z: 1.75, width: 1.2, height: 1.4, heightFromFloor: 0.9 }
    ],
    doorPositions: [
      { wall: 'south', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'landing' }
    ],
    required: false,
    minFloor: 1,
    maxFloor: 2,
    position: new THREE.Vector3(-4, 0, 6)
  }],

  ['en_suite', {
    name: 'en_suite',
    width: 2,
    depth: 2.5,
    height: 2.4,
    floorMaterial: 'floor_bathroom_tile',
    wallMaterial: 'wall_tiled_full',
    ceilingMaterial: 'ceiling_white_moisture',
    windowPositions: [
      { wall: 'north', x: 0, z: 1.25, width: 0.5, height: 0.6, heightFromFloor: 1.8 }
    ],
    doorPositions: [
      { wall: 'south', position: 0.5, width: 0.7, height: 1.9, connectsTo: 'bedroom_main' }
    ],
    required: false,
    minFloor: 1,
    maxFloor: 2,
    position: new THREE.Vector3(-3, 0, 3)
  }],

  ['utility', {
    name: 'utility',
    width: 1.8,
    depth: 2,
    height: 2.4,
    floorMaterial: 'floor_kitchen_tile',
    wallMaterial: 'wall_painted_white',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [],
    doorPositions: [
      { wall: 'north', position: 0.5, width: 0.7, height: 2, connectsTo: 'kitchen' }
    ],
    required: false,
    minFloor: 0,
    maxFloor: 0,
    position: new THREE.Vector3(4, 0, -6)
  }],

  ['wc', {
    name: 'wc',
    width: 1,
    depth: 1.5,
    height: 2.4,
    floorMaterial: 'floor_bathroom_tile',
    wallMaterial: 'wall_tiled_half',
    ceilingMaterial: 'ceiling_white',
    windowPositions: [],
    doorPositions: [
      { wall: 'east', position: 0.5, width: 0.6, height: 1.9, connectsTo: 'living' }
    ],
    required: false,
    minFloor: 0,
    maxFloor: 0,
    position: new THREE.Vector3(2, 0, -4)
  }]
])

// ============================================
// HOUSE LAYOUT TEMPLATES (room arrangements per house type)
// ============================================

export const HOUSE_LAYOUT_TEMPLATES: Map<string, HouseLayoutTemplate> = new Map([
  ['standard_terraced', {
    name: 'standard_terraced',
    rooms: [
      ROOM_TEMPLATES.get('entrance')!,
      ROOM_TEMPLATES.get('living')!,
      ROOM_TEMPLATES.get('kitchen')!,
      ROOM_TEMPLATES.get('bathroom')!,
      ROOM_TEMPLATES.get('bedroom_main')!,
      ROOM_TEMPLATES.get('bedroom_2')!,
      ROOM_TEMPLATES.get('landing')!
    ],
    connections: [
      { from: 'entrance', to: 'living', doorWidth: 0.8 },
      { from: 'living', to: 'kitchen', doorWidth: 0.8 },
      { from: 'landing', to: 'bedroom_main', doorWidth: 0.8 },
      { from: 'landing', to: 'bedroom_2', doorWidth: 0.7 },
      { from: 'landing', to: 'bathroom', doorWidth: 0.7 },
      { from: 'landing', to: 'stairs_down', doorWidth: 0.8 }
    ],
    stairs: { x: 0, z: -1.5, width: 1, depth: 2.5, goesUp: true }
  }],

  ['standard_semi', {
    name: 'standard_semi',
    rooms: [
      ROOM_TEMPLATES.get('entrance')!,
      ROOM_TEMPLATES.get('living')!,
      ROOM_TEMPLATES.get('kitchen')!,
      ROOM_TEMPLATES.get('dining')!,
      ROOM_TEMPLATES.get('bathroom')!,
      ROOM_TEMPLATES.get('bedroom_main')!,
      ROOM_TEMPLATES.get('bedroom_2')!,
      ROOM_TEMPLATES.get('bedroom_3')!,
      ROOM_TEMPLATES.get('landing')!
    ],
    connections: [
      { from: 'entrance', to: 'living', doorWidth: 0.8 },
      { from: 'living', to: 'dining', doorWidth: 0.8 },
      { from: 'dining', to: 'kitchen', doorWidth: 0.8 },
      { from: 'landing', to: 'bedroom_main', doorWidth: 0.8 },
      { from: 'landing', to: 'bedroom_2', doorWidth: 0.7 },
      { from: 'landing', to: 'bedroom_3', doorWidth: 0.7 },
      { from: 'landing', to: 'bathroom', doorWidth: 0.7 },
      { from: 'landing', to: 'stairs_down', doorWidth: 0.8 }
    ],
    stairs: { x: 0, z: -1.5, width: 1.2, depth: 2.8, goesUp: true }
  }],

  ['standard_detached', {
    name: 'standard_detached',
    rooms: [
      ROOM_TEMPLATES.get('entrance')!,
      ROOM_TEMPLATES.get('living')!,
      ROOM_TEMPLATES.get('dining')!,
      ROOM_TEMPLATES.get('kitchen')!,
      ROOM_TEMPLATES.get('utility')!,
      ROOM_TEMPLATES.get('wc')!,
      ROOM_TEMPLATES.get('bathroom')!,
      ROOM_TEMPLATES.get('bedroom_main')!,
      ROOM_TEMPLATES.get('bedroom_2')!,
      ROOM_TEMPLATES.get('bedroom_3')!,
      ROOM_TEMPLATES.get('en_suite')!,
      ROOM_TEMPLATES.get('landing')!
    ],
    connections: [
      { from: 'entrance', to: 'living', doorWidth: 0.9 },
      { from: 'living', to: 'dining', doorWidth: 0.9 },
      { from: 'dining', to: 'kitchen', doorWidth: 0.9 },
      { from: 'kitchen', to: 'utility', doorWidth: 0.7 },
      { from: 'entrance', to: 'wc', doorWidth: 0.6 },
      { from: 'landing', to: 'bedroom_main', doorWidth: 0.9 },
      { from: 'bedroom_main', to: 'en_suite', doorWidth: 0.8 },
      { from: 'landing', to: 'bedroom_2', doorWidth: 0.8 },
      { from: 'landing', to: 'bedroom_3', doorWidth: 0.8 },
      { from: 'landing', to: 'bathroom', doorWidth: 0.8 },
      { from: 'landing', to: 'stairs_down', doorWidth: 0.9 }
    ],
    stairs: { x: 0, z: -1.5, width: 1.2, depth: 3, goesUp: true }
  }],

  ['bungalow', {
    name: 'bungalow',
    rooms: [
      ROOM_TEMPLATES.get('entrance')!,
      ROOM_TEMPLATES.get('bungalow_living')!,
      ROOM_TEMPLATES.get('bungalow_kitchen')!,
      ROOM_TEMPLATES.get('bathroom')!,
      ROOM_TEMPLATES.get('bedroom_main')!,
      ROOM_TEMPLATES.get('bedroom_2')!,
      ROOM_TEMPLATES.get('bedroom_3')!
    ],
    connections: [
      { from: 'entrance', to: 'bungalow_living', doorWidth: 0.8 },
      { from: 'bungalow_living', to: 'bungalow_kitchen', doorWidth: 0.8 },
      { from: 'bungalow_kitchen', to: 'bathroom', doorWidth: 0.7 },
      { from: 'bungalow_living', to: 'bedroom_main', doorWidth: 0.8 },
      { from: 'bungalow_living', to: 'bedroom_2', doorWidth: 0.7 },
      { from: 'bungalow_living', to: 'bedroom_3', doorWidth: 0.7 }
    ]
  }],

  ['cottage', {
    name: 'cottage',
    rooms: [
      ROOM_TEMPLATES.get('entrance')!,
      ROOM_TEMPLATES.get('cottage_living')!,
      ROOM_TEMPLATES.get('kitchen')!,
      ROOM_TEMPLATES.get('bathroom')!,
      { ...ROOM_TEMPLATES.get('bedroom_main')!, name: 'bedroom_main', minFloor: 0, maxFloor: 1 },
      { ...ROOM_TEMPLATES.get('bedroom_2')!, name: 'bedroom_2', minFloor: 1, maxFloor: 1 }
    ],
    connections: [
      { from: 'entrance', to: 'cottage_living', doorWidth: 0.8 },
      { from: 'cottage_living', to: 'kitchen', doorWidth: 0.7 },
      { from: 'kitchen', to: 'bathroom', doorWidth: 0.7 },
      { from: 'cottage_living', to: 'bedroom_main', doorWidth: 0.8 },
      { from: 'landing', to: 'bedroom_2', doorWidth: 0.7 }
    ],
    stairs: { x: 0, z: -1, width: 0.9, depth: 2, goesUp: true }
  }],

  ['modern_townhouse', {
    name: 'modern_townhouse',
    rooms: [
      ROOM_TEMPLATES.get('entrance')!,
      ROOM_TEMPLATES.get('modern_openplan')!,
      ROOM_TEMPLATES.get('wc')!,
      ROOM_TEMPLATES.get('utility')!,
      ROOM_TEMPLATES.get('modern_master')!,
      ROOM_TEMPLATES.get('modern_bedroom')!,
      ROOM_TEMPLATES.get('modern_bedroom')!, // second
      ROOM_TEMPLATES.get('bathroom')!,
      ROOM_TEMPLATES.get('en_suite')!,
      ROOM_TEMPLATES.get('landing')!
    ],
    connections: [
      { from: 'entrance', to: 'modern_openplan', doorWidth: 1.0 },
      { from: 'modern_openplan', to: 'wc', doorWidth: 0.6 },
      { from: 'modern_openplan', to: 'utility', doorWidth: 0.7 },
      { from: 'landing', to: 'modern_master', doorWidth: 0.9 },
      { from: 'modern_master', to: 'en_suite', doorWidth: 0.8 },
      { from: 'landing', to: 'modern_bedroom', doorWidth: 0.8 },
      { from: 'landing', to: 'bathroom', doorWidth: 0.8 },
      { from: 'landing', to: 'stairs_down', doorWidth: 0.9 }
    ],
    stairs: { x: 0, z: -1.5, width: 1.1, depth: 3, goesUp: true }
  }],

  ['victorian_villa', {
    name: 'victorian_villa',
    rooms: [
      ROOM_TEMPLATES.get('entrance')!,
      ROOM_TEMPLATES.get('living')!,
      ROOM_TEMPLATES.get('dining')!,
      ROOM_TEMPLATES.get('kitchen')!,
      ROOM_TEMPLATES.get('utility')!,
      ROOM_TEMPLATES.get('wc')!,
      ROOM_TEMPLATES.get('bathroom')!,
      { ...ROOM_TEMPLATES.get('bedroom_main')!, height: 3.2 }, // high ceilings
      ROOM_TEMPLATES.get('bedroom_2')!,
      ROOM_TEMPLATES.get('bedroom_3')!,
      { ...ROOM_TEMPLATES.get('bedroom_3')!, name: 'bedroom_4' },
      { ...ROOM_TEMPLATES.get('bedroom_3')!, name: 'bedroom_5' },
      ROOM_TEMPLATES.get('en_suite')!,
      ROOM_TEMPLATES.get('landing')!
    ],
    connections: [
      { from: 'entrance', to: 'living', doorWidth: 0.9 },
      { from: 'living', to: 'dining', doorWidth: 0.9 },
      { from: 'dining', to: 'kitchen', doorWidth: 0.9 },
      { from: 'kitchen', to: 'utility', doorWidth: 0.7 },
      { from: 'entrance', to: 'wc', doorWidth: 0.6 },
      { from: 'landing', to: 'bedroom_main', doorWidth: 0.9 },
      { from: 'bedroom_main', to: 'en_suite', doorWidth: 0.8 },
      { from: 'landing', to: 'bedroom_2', doorWidth: 0.8 },
      { from: 'landing', to: 'bedroom_3', doorWidth: 0.8 },
      { from: 'landing', to: 'bedroom_4', doorWidth: 0.8 },
      { from: 'landing', to: 'bedroom_5', doorWidth: 0.7 },
      { from: 'landing', to: 'bathroom', doorWidth: 0.8 },
      { from: 'landing', to: 'stairs_down', doorWidth: 0.9 }
    ],
    stairs: { x: 0, z: -1.5, width: 1.5, depth: 3.5, goesUp: true }
  }]
])

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getHouseTemplate(name: string): HouseTemplate | undefined {
  return HOUSE_TEMPLATES.get(name)
}

export function getRoomTemplate(name: string): RoomTemplate | undefined {
  return ROOM_TEMPLATES.get(name)
}

export function getHouseLayoutTemplate(name: string): HouseLayoutTemplate | undefined {
  return HOUSE_LAYOUT_TEMPLATES.get(name)
}

export function getAllHouseTemplates(): HouseTemplate[] {
  return Array.from(HOUSE_TEMPLATES.values())
}

export function getTemplatesByEra(era: HouseTemplate['era']): HouseTemplate[] {
  return Array.from(HOUSE_TEMPLATES.values()).filter(t => t.era === era)
}

export function getTemplatesByAffluence(affluence: HouseTemplate['affluence']): HouseTemplate[] {
  return Array.from(HOUSE_TEMPLATES.values()).filter(t => t.affluence === affluence)
}

export function getRandomTemplate(rng: () => number): HouseTemplate {
  const templates = Array.from(HOUSE_TEMPLATES.values())
  return templates[Math.floor(rng() * templates.length)]
}

export function getRandomTemplateWeighted(rng: () => number, weights: Map<string, number>): HouseTemplate {
  const entries = Array.from(HOUSE_TEMPLATES.entries())
  let totalWeight = 0
  for (const [, template] of entries) {
    totalWeight += weights.get(template.name) || 1
  }

  let random = rng() * totalWeight
  for (const [, template] of entries) {
    random -= weights.get(template.name) || 1
    if (random <= 0) return template
  }
  return entries[0][1]
}