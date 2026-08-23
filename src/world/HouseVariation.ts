import * as THREE from 'three'
import { HouseTemplate, RoomTemplate, HouseLayoutTemplate, getHouseTemplate, getHouseLayoutTemplate } from './HouseTemplates.js'

/**
 * HouseVariation - Per-instance variation system for houses
 * Generates unique variations of base templates using deterministic RNG
 */

export interface HouseVariationData {
  // Structural variations
  widthScale: number
  depthScale: number
  heightScale: number
  roofPitchVariation: number

  // Material variations
  brickColorShift: number // hue shift in degrees
  brickTextureVariant: string
  roofColorShift: number
  roofTextureVariant: string
  windowFrameColor: number
  doorColor: number
  gutterColor: number

  // Feature toggles (override template chances)
  hasChimney: boolean
  hasPorch: boolean
  hasDormers: boolean
  hasBayWindow: boolean
  hasGarage: boolean
  garagePosition: 'left' | 'right' | 'integrated' | 'detached'

  // Window/door variations
  windowStyleOverride: string | null
  doorStyleOverride: string | null
  extraWindows: Array<{ floor: number; wall: 'front' | 'back' | 'left' | 'right'; x: number; y: number }>

  // Exterior details
  fenceStyle: 'none' | 'picket' | 'brick' | 'hedge' | 'metal'
  gateStyle: 'none' | 'wooden' | 'metal' | 'brick_pillar'
  pathStyle: 'none' | 'slab' | 'gravel' | 'brick' | 'stepping_stones'
  gardenLayout: 'lawn' | 'cottage' | 'modern' | 'low_maintenance' | 'wildlife' | 'none'
  drivewayWidth: number

  // Interior variations
  floorPlanMirror: boolean
  roomSwap: Map<string, string> // room name -> swapped room name
  wallColorScheme: 'neutral' | 'warm' | 'cool' | 'bold' | 'period'
  floorMaterialScheme: 'carpet' | 'wood' | 'tile' | 'mixed' | 'period'

  // Condition/age
  ageYears: number // 0-100+
  wearLevel: number // 0-1
  dampPatches: boolean
  crackedRender: boolean
  mossOnRoof: boolean
  peelingPaint: boolean

  // Job-specific
  clutterLevel: number // 0-1
  stainSeverity: number // 0-1
  trashAmount: number // 0-1
  specialFeatures: string[] // e.g., 'hoarder', 'builder_debris', 'pet_damage', 'water_damage'
}

export interface VariationContext {
  seed: number
  templateName: string
  chunkId: string
  indexInChunk: number
  areaType: 'urban' | 'suburban' | 'rural' | 'estate' | 'village'
  affluence: 'low' | 'medium' | 'high'
  jobType?: string
}

/**
 * Create deterministic RNG from seed
 */
function createRNG(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Hash string to number
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Generate variation data for a house instance
 */
export function generateHouseVariation(context: VariationContext): HouseVariationData {
  const rng = createRNG(context.seed)
  const template = getHouseTemplate(context.templateName)
  const layout = getHouseLayoutTemplate(template?.roomLayout || 'standard_terraced')

  // Base variation ranges by affluence
  const affluenceRanges = {
    low: { scale: 0.08, colorShift: 15, wear: 0.4 },
    medium: { scale: 0.05, colorShift: 10, wear: 0.2 },
    high: { scale: 0.03, colorShift: 5, wear: 0.1 }
  }
  const ranges = affluenceRanges[context.affluence]

  // Structural variations (small)
  const widthScale = 1 + (rng() - 0.5) * ranges.scale * 2
  const depthScale = 1 + (rng() - 0.5) * ranges.scale * 2
  const heightScale = 1 + (rng() - 0.5) * ranges.scale
  const roofPitchVariation = (rng() - 0.5) * 0.3 // -15% to +15%

  // Material variations
  const brickColorShift = (rng() - 0.5) * ranges.colorShift * 2
  const roofColorShift = (rng() - 0.5) * ranges.colorShift * 2
  const windowFrameColor = rng() < 0.7 ? 0xffffff : lerpColor(0xffffff, 0x888888, rng())
  const doorColor = pickDoorColor(rng, template?.era || 'victorian')
  const gutterColor = 0x333333 + Math.floor(rng() * 0x222222)

  // Texture variants
  const brickTextureVariant = pickTextureVariant(rng, template?.brickTexture || 'brick_default', ['_v1', '_v2', '_v3', '_weathered', '_clean'])
  const roofTextureVariant = pickTextureVariant(rng, template?.roofTexture || 'roof_default', ['_v1', '_v2', '_weathered', '_mossy', '_clean'])

  // Feature overrides (respect template chances but allow variation)
  const hasChimney = rng() < (template?.chimneyChance || 0.5)
  const hasPorch = rng() < (template?.porchChance || 0.3)
  const hasDormers = rng() < (template?.dormerChance || 0.2) && (template?.floors || 2) > 1
  const hasBayWindow = rng() < (template?.bayWindowChance || 0.2)
  const hasGarage = rng() < (template?.garageChance || 0.2)

  // Garage position
  const garagePositions: Array<'left' | 'right' | 'integrated' | 'detached'> = ['left', 'right', 'integrated', 'detached']
  const garagePosition = garagePositions[Math.floor(rng() * garagePositions.length)]

  // Window/door overrides
  const windowStyleOverride = rng() < 0.1 ? pickRandomWindowStyle(rng) : null
  const doorStyleOverride = rng() < 0.15 ? pickRandomDoorStyle(rng) : null

  // Extra windows
  const extraWindows = generateExtraWindows(rng, template?.floors || 2)

  // Exterior details by area type
  const { fenceStyle, gateStyle, pathStyle, gardenLayout } = pickExteriorDetails(rng, context.areaType, context.affluence)

  // Interior variations
  const floorPlanMirror = rng() < 0.5
  const roomSwap = generateRoomSwaps(rng, layout)
  const wallColorScheme = pickColorScheme(rng, template?.era || 'victorian', 'wall')
  const floorMaterialScheme = pickColorScheme(rng, template?.era || 'victorian', 'floor')

  // Condition/age
  const ageYears = Math.floor(rng() * 80) + (template?.era === 'modern' ? 0 : 20)
  const wearLevel = Math.min(1, ageYears / 100 + rng() * ranges.wear)
  const dampPatches = rng() < 0.15 * wearLevel
  const crackedRender = rng() < 0.1 * wearLevel
  const mossOnRoof = rng() < 0.2 * wearLevel && (template?.roofType === 'pitched' || template?.roofType === 'thatched')
  const peelingPaint = rng() < 0.1 * wearLevel

  // Job-specific (if job type provided)
  const { clutterLevel, stainSeverity, trashAmount, specialFeatures } = generateJobVariation(rng, context.jobType)

  return {
    // Structural
    widthScale,
    depthScale,
    heightScale,
    roofPitchVariation,

    // Materials
    brickColorShift,
    brickTextureVariant,
    roofColorShift,
    roofTextureVariant,
    windowFrameColor,
    doorColor,
    gutterColor,

    // Features
    hasChimney,
    hasPorch,
    hasDormers,
    hasBayWindow,
    hasGarage,
    garagePosition,

    // Windows/doors
    windowStyleOverride,
    doorStyleOverride,
    extraWindows,

    // Exterior
    fenceStyle,
    gateStyle,
    pathStyle,
    gardenLayout,
    drivewayWidth: template?.drivewayWidth || 0,

    // Interior
    floorPlanMirror,
    roomSwap,
    wallColorScheme: wallColorScheme as HouseVariationData['wallColorScheme'],
    floorMaterialScheme: floorMaterialScheme as HouseVariationData['floorMaterialScheme'],

    // Condition
    ageYears,
    wearLevel,
    dampPatches,
    crackedRender,
    mossOnRoof,
    peelingPaint,

    // Job
    clutterLevel,
    stainSeverity,
    trashAmount,
    specialFeatures
  }
}

/**
 * Apply variation to template (returns modified template)
 */
export function applyVariation(template: HouseTemplate, variation: HouseVariationData): HouseTemplate {
  const modified = { ...template }

  // Apply structural scales
  modified.width *= variation.widthScale
  modified.depth *= variation.depthScale
  modified.height *= variation.heightScale

  // Apply color shifts
  modified.brickColor = shiftHue(modified.brickColor, variation.brickColorShift)
  modified.roofColor = shiftHue(modified.roofColor, variation.roofColorShift)

  // Apply texture variants
  modified.brickTexture = variation.brickTextureVariant
  modified.roofTexture = variation.roofTextureVariant

  // Apply feature overrides
  modified.chimneyChance = variation.hasChimney ? 1 : 0
  modified.porchChance = variation.hasPorch ? 1 : 0
  modified.dormerChance = variation.hasDormers ? 1 : 0
  modified.bayWindowChance = variation.hasBayWindow ? 1 : 0
  modified.garageChance = variation.hasGarage ? 1 : 0

  // Apply window/door overrides
  if (variation.windowStyleOverride) modified.windowStyle = variation.windowStyleOverride as any
  if (variation.doorStyleOverride) modified.doorStyle = variation.doorStyleOverride as any

  return modified
}

/**
 * Generate room variations for interior
 */
export function generateRoomVariations(
  variation: HouseVariationData,
  rooms: RoomTemplate[],
  rng: () => number
): RoomTemplate[] {
  return rooms.map(room => {
    const modified = { ...room }

    // Apply floor plan mirror
    if (variation.floorPlanMirror) {
      modified.windowPositions = modified.windowPositions.map(w => ({ ...w, x: -w.x }))
      modified.doorPositions = modified.doorPositions.map(d => ({ ...d, position: -d.position }))
    }

    // Apply room swap
    const swappedName = variation.roomSwap.get(room.name)
    if (swappedName) {
      // This would swap room templates - handled at layout level
    }

    // Apply color scheme
    modified.wallMaterial = applyWallScheme(room.wallMaterial, variation.wallColorScheme, rng)
    modified.floorMaterial = applyFloorScheme(room.floorMaterial, variation.floorMaterialScheme, rng)

    // Apply condition
    if (variation.dampPatches && rng() < 0.3) {
      modified.wallMaterial += '_damp'
    }
    if (variation.peelingPaint && rng() < 0.2) {
      modified.wallMaterial += '_peeling'
    }

    return modified
  })
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function lerpColor(a: number, bColor: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (bColor >> 16) & 0xff, bg = (bColor >> 8) & 0xff, bb = bColor & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bVal = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bVal
}

function shiftHue(color: number, degrees: number): number {
  // Simple hue shift approximation
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const bVal = color & 0xff

  // Convert to HSL-ish, shift, convert back
  const max = Math.max(r, g, bVal)
  const min = Math.min(r, g, bVal)
  const l = (max + min) / 2

  if (max === min) return color // grayscale

  let h = 0
  const d = max - min
  const s = l > 0.5 ? d / (510 - max - min) : d / (max + min)

  switch (max) {
    case r: h = (g - bVal) / d + (g < bVal ? 6 : 0); break
    case g: h = (bVal - r) / d + 2; break
    case bVal: h = (r - g) / d + 4; break
  }
  h /= 6

  // Shift hue
  h = (h + degrees / 360) % 1
  if (h < 0) h += 1

  // Convert back to RGB
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }

  const nr = Math.round(hue2rgb(p, q, h + 1/3) * 255)
  const ng = Math.round(hue2rgb(p, q, h) * 255)
  const nb = Math.round(hue2rgb(p, q, h - 1/3) * 255)

  return (nr << 16) | (ng << 8) | nb
}

function pickDoorColor(rng: () => number, era: string): number {
  const eraColors: Record<string, number[]> = {
    victorian: [0x8b4513, 0x2c1810, 0x1a1a2e, 0x2f4f4f, 0x800000],
    edwardian: [0x4a3728, 0x2c3e50, 0x1a1a2e, 0x556b2f, 0x8b4513],
    '1930s': [0x8b4513, 0x556b2f, 0x2c3e50, 0xffffff, 0xc0c0c0],
    '1950s': [0x8b4513, 0xffffff, 0x87ceeb, 0xffa500, 0xff6347],
    '1970s': [0x8b7355, 0xdaa520, 0x8b4513, 0xffa500, 0x808080],
    '1990s': [0xffffff, 0xc0c0c0, 0x87ceeb, 0x8b4513, 0x2c3e50],
    modern: [0x1a1a2e, 0xffffff, 0x2c3e50, 0x8b4513, 0xc0c0c0]
  }
  const colors = eraColors[era] || eraColors.victorian
  return colors[Math.floor(rng() * colors.length)]
}

function pickTextureVariant(rng: () => number, baseTexture: string, variants: string[]): string {
  return baseTexture + variants[Math.floor(rng() * variants.length)]
}

function pickRandomWindowStyle(rng: () => number): string {
  const styles = ['sash', 'casement', 'bay', 'diamond', 'modern', 'georgian']
  return styles[Math.floor(rng() * styles.length)]
}

function pickRandomDoorStyle(rng: () => number): string {
  const styles = ['panel', 'upvc', 'composite', 'stable', 'georgian', 'modern']
  return styles[Math.floor(rng() * styles.length)]
}

function generateExtraWindows(rng: () => number, floors: number): Array<{ floor: number; wall: 'front' | 'back' | 'left' | 'right'; x: number; y: number }> {
  const extra: Array<{ floor: number; wall: 'front' | 'back' | 'left' | 'right'; x: number; y: number }> = []
  const walls: Array<'front' | 'back' | 'left' | 'right'> = ['front', 'back', 'left', 'right']

  for (let floor = 0; floor < floors; floor++) {
    for (const wall of walls) {
      if (rng() < 0.15) { // 15% chance per wall per floor
        extra.push({
          floor,
          wall,
          x: (rng() - 0.5) * 0.8, // relative position
          y: 0.5 + rng() * 0.5 // height variation
        })
      }
    }
  }
  return extra
}

function pickExteriorDetails(
  rng: () => number,
  areaType: VariationContext['areaType'],
  affluence: VariationContext['affluence']
): { fenceStyle: HouseVariationData['fenceStyle']; gateStyle: HouseVariationData['gateStyle']; pathStyle: HouseVariationData['pathStyle']; gardenLayout: HouseVariationData['gardenLayout'] } {
  const fenceOptions = {
    urban: ['none', 'metal', 'brick'],
    suburban: ['picket', 'brick', 'hedge', 'metal'],
    rural: ['none', 'picket', 'hedge', 'brick'],
    estate: ['metal', 'brick', 'none'],
    village: ['picket', 'hedge', 'brick', 'none']
  }
  const gateOptions = {
    urban: ['none', 'metal'],
    suburban: ['wooden', 'metal', 'brick_pillar'],
    rural: ['none', 'wooden'],
    estate: ['metal', 'brick_pillar'],
    village: ['wooden', 'none']
  }
  const pathOptions = {
    urban: ['slab', 'brick'],
    suburban: ['slab', 'gravel', 'brick'],
    rural: ['gravel', 'stepping_stones', 'none'],
    estate: ['slab', 'brick'],
    village: ['slab', 'gravel', 'stepping_stones']
  }
  const gardenOptions = {
    urban: ['low_maintenance', 'none'],
    suburban: ['lawn', 'cottage', 'modern', 'low_maintenance'],
    rural: ['lawn', 'cottage', 'wildlife'],
    estate: ['modern', 'low_maintenance', 'lawn'],
    village: ['cottage', 'lawn', 'wildlife']
  }

  const pick = (options: string[], bias: number = 0) => options[Math.floor(rng() * options.length * (1 + bias)) % options.length]

  return {
    fenceStyle: pick(fenceOptions[areaType] || fenceOptions.suburban, affluence === 'high' ? 0.2 : 0) as any,
    gateStyle: pick(gateOptions[areaType] || gateOptions.suburban) as any,
    pathStyle: pick(pathOptions[areaType] || pathOptions.suburban) as any,
    gardenLayout: pick(gardenOptions[areaType] || gardenOptions.suburban) as any
  }
}

function generateRoomSwaps(rng: () => number, layout: HouseLayoutTemplate | undefined): Map<string, string> {
  const swaps = new Map<string, string>()
  if (!layout) return swaps

  const swappablePairs = [
    ['bedroom_2', 'bedroom_3'],
    ['dining', 'kitchen'],
    ['bathroom', 'en_suite']
  ]

  for (const [a, b] of swappablePairs) {
    if (rng() < 0.1 && layout.rooms.some(r => r.name === a) && layout.rooms.some(r => r.name === b)) {
      swaps.set(a, b)
      swaps.set(b, a)
    }
  }
  return swaps
}

function pickColorScheme(rng: () => number, era: string, type: 'wall' | 'floor'): string {
  const schemes: Record<string, Record<string, string[]>> = {
    wall: {
      victorian: ['neutral', 'warm', 'period', 'bold'],
      edwardian: ['neutral', 'warm', 'period'],
      '1930s': ['neutral', 'warm', 'cool'],
      '1950s': ['neutral', 'cool', 'bold'],
      '1970s': ['warm', 'bold', 'period'],
      '1990s': ['neutral', 'cool'],
      modern: ['neutral', 'cool', 'bold']
    },
    floor: {
      victorian: ['carpet', 'wood', 'mixed', 'period'],
      edwardian: ['carpet', 'wood', 'mixed', 'period'],
      '1930s': ['carpet', 'wood', 'tile'],
      '1950s': ['carpet', 'tile', 'wood'],
      '1970s': ['carpet', 'tile', 'mixed'],
      '1990s': ['carpet', 'wood', 'tile'],
      modern: ['wood', 'tile', 'mixed']
    }
  }
  const eraSchemes = schemes[type][era] || schemes[type].victorian
  return eraSchemes[Math.floor(rng() * eraSchemes.length)]
}

function applyWallScheme(baseMaterial: string, scheme: HouseVariationData['wallColorScheme'], rng: () => number): string {
  const suffixes: Record<HouseVariationData['wallColorScheme'], string[]> = {
    neutral: ['_cream', '_magnolia', '_white', '_pale_grey'],
    warm: ['_cream', '_peach', '_terracotta', '_yellow'],
    cool: ['_pale_blue', '_pale_green', '_lilac', '_white'],
    bold: ['_deep_blue', '_forest_green', '_burgundy', '_charcoal'],
    period: ['_victorian_cream', '_edwardian_green', '_georgian_blue', '_arts_crafts']
  }
  const options = suffixes[scheme] || suffixes.neutral
  return baseMaterial.replace(/_\w+$/, '') + options[Math.floor(rng() * options.length)]
}

function applyFloorScheme(baseMaterial: string, scheme: HouseVariationData['floorMaterialScheme'], rng: () => number): string {
  const options: Record<HouseVariationData['floorMaterialScheme'], string[]> = {
    carpet: ['_neutral', '_beige', '_grey', '_pattern'],
    wood: ['_oak', '_pine', '_walnut', '_engineered'],
    tile: ['_ceramic', '_porcelain', '_stone', '_terracotta'],
    mixed: ['_carpet_wood', '_wood_tile', '_carpet_tile'],
    period: ['_victorian_tile', '_edwardian_parquet', '_georgian_stone', '_arts_crafts_wood']
  }
  const suffixes = options[scheme] || options.carpet
  return baseMaterial.replace(/_\w+$/, '') + suffixes[Math.floor(rng() * suffixes.length)]
}

function generateJobVariation(rng: () => number, jobType?: string): {
  clutterLevel: number
  stainSeverity: number
  trashAmount: number
  specialFeatures: string[]
} {
  const baseClutter = 0.3 + rng() * 0.4
  const baseStains = 0.2 + rng() * 0.5
  const baseTrash = 0.1 + rng() * 0.4

  const jobModifiers: Record<string, { clutter: number; stains: number; trash: number; features: string[] }> = {
    'End of Tenancy Clean': { clutter: 1.2, stains: 1.1, trash: 1.3, features: ['moved_out_mess'] },
    'Deep Clean': { clutter: 0.8, stains: 1.5, trash: 0.7, features: ['neglected'] },
    'Builder\'s Clean': { clutter: 1.5, stains: 0.8, trash: 1.4, features: ['builder_debris', 'dust_everywhere', 'paint_splatter'] },
    'Spring Clean': { clutter: 1.0, stains: 1.0, trash: 1.0, features: ['seasonal_clutter'] },
    'Post-Party Cleanup': { clutter: 1.3, stains: 1.4, trash: 1.6, features: ['bottles', 'food_stains', 'vomit'] },
    'Hoarder Clearance': { clutter: 2.0, stains: 1.2, trash: 2.0, features: ['hoarder', 'blocked_rooms', 'vermin_risk', 'structural_damage'] }
  }

  const mod = jobModifiers[jobType || '']
  const clutterLevel = Math.min(1, baseClutter * (mod?.clutter || 1))
  const stainSeverity = Math.min(1, baseStains * (mod?.stains || 1))
  const trashAmount = Math.min(1, baseTrash * (mod?.trash || 1))
  const specialFeatures = mod?.features || []

  // Random additional features
  if (rng() < 0.1) specialFeatures.push('pet_damage')
  if (rng() < 0.05) specialFeatures.push('water_damage')
  if (rng() < 0.05) specialFeatures.push('mould')
  if (rng() < 0.03) specialFeatures.push('fire_damage')

  return { clutterLevel, stainSeverity, trashAmount, specialFeatures }
}

/**
 * Get variation context from house instance
 */
export function getVariationContext(houseId: string, chunkId: string, indexInChunk: number, worldSeed: number): VariationContext {
  const seed = hashString(`${worldSeed}_${chunkId}_${indexInChunk}`)

  // Determine area type from chunk position
  const chunk = { id: chunkId } // simplified
  const areaTypes: VariationContext['areaType'][] = ['urban', 'suburban', 'rural', 'estate', 'village']
  const areaType = areaTypes[Math.floor((seed * 7) % areaTypes.length)]

  // Determine affluence
  const affluenceLevels: VariationContext['affluence'][] = ['low', 'medium', 'high']
  const affluence = affluenceLevels[Math.floor((seed * 13) % affluenceLevels.length)]

  return {
    seed,
    templateName: '', // will be set by caller
    chunkId,
    indexInChunk,
    areaType,
    affluence
  }
}