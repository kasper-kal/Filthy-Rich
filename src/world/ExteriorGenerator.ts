import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { HouseTemplate } from './HouseTemplates.js'
import { HouseVariationData } from './HouseVariation.js'

/**
 * ExteriorGenerator - Detailed exterior generation for houses
 * Gardens, drives, fences, gates, bins, parked cars, sheds, lighting, etc.
 */

export interface ExteriorGenerationOptions {
  template: HouseTemplate
  variation: HouseVariationData
  position: THREE.Vector3
  rotation: number
  rng: () => number
  sceneManager: any // SceneManager type
}

export interface GeneratedExterior {
  group: THREE.Group
  drivewayMesh?: THREE.Mesh
  grassMesh?: THREE.Mesh
  fenceMeshes: THREE.Mesh[]
  gateMesh?: THREE.Group
  pathMeshes: THREE.Mesh[]
  flowerBeds: THREE.Mesh[]
  bins: THREE.Group[]
  parkedCars: THREE.Group[]
  shed?: THREE.Group
  lighting: THREE.Group[]
  trees: THREE.Group[]
  decorations: THREE.Group[]
}

const DRIVEWAY_MATERIALS = [
  { name: 'concrete', color: 0x999999, roughness: 0.9 },
  { name: 'asphalt', color: 0x333333, roughness: 0.95 },
  { name: 'gravel', color: 0xaa9988, roughness: 1.0 },
  { name: 'block_paving', color: 0xbb8866, roughness: 0.85 },
  { name: 'cobblestone', color: 0x887766, roughness: 0.9 }
]

const GRASS_VARIANTS = [
  { name: 'healthy', color: 0x4a7c2e, roughness: 1.0 },
  { name: 'patchy', color: 0x5a8c3e, roughness: 1.0 },
  { name: 'weedy', color: 0x557733, roughness: 1.0 },
  { name: 'mossy', color: 0x446622, roughness: 1.0 }
]

const FENCE_STYLES = {
  picket: { height: 1.0, postSpacing: 0.8, picketWidth: 0.05, color: 0xffffff },
  brick: { height: 1.2, postSpacing: 2.0, picketWidth: 0, color: 0xaa6644 },
  hedge: { height: 1.5, postSpacing: 0, picketWidth: 0, color: 0x3a5a2e },
  metal: { height: 1.1, postSpacing: 1.5, picketWidth: 0.02, color: 0x333333 },
  closeboard: { height: 1.8, postSpacing: 2.4, picketWidth: 0.1, color: 0x8b7355 },
  panel: { height: 1.8, postSpacing: 1.8, picketWidth: 0.02, color: 0x8b7355 }
}

const GATE_STYLES = {
  wooden: { width: 1.0, height: 1.0, color: 0x8b7355 },
  metal: { width: 1.0, height: 1.1, color: 0x222222 },
  brick_pillar: { width: 1.2, height: 1.5, color: 0xaa6644 },
  none: { width: 0, height: 0, color: 0 }
}

const PATH_STYLES = {
  slab: { width: 0.9, segmentLength: 0.6, gap: 0.1, color: 0xbbbbaa },
  gravel: { width: 0.8, segmentLength: 1, gap: 0, color: 0xaa9988 },
  brick: { width: 0.9, segmentLength: 0.215, gap: 0.01, color: 0xaa6644 },
  stepping_stones: { width: 0.4, segmentLength: 0.5, gap: 0.3, color: 0x998877 },
  none: { width: 0, segmentLength: 0, gap: 0, color: 0 }
}

const BIN_TYPES = [
  { type: 'wheelie', colors: [0x228b22, 0x1a5c1a, 0x006400, 0x8b4513, 0x4169e1, 0x8b0000, 0xffa500], bodyHeight: 0.6, radius: 0.25 },
  { type: 'recycling_box', colors: [0x4169e1, 0x006400, 0xffa500], bodyHeight: 0.4, radius: 0.35 },
  { type: 'food_caddy', colors: [0x8b4513, 0x556b2f], bodyHeight: 0.35, radius: 0.2 }
]

const SHED_STYLES = [
  { name: 'wooden_apex', width: 2.4, depth: 1.8, height: 2.2, roofType: 'apex', color: 0x8b7355 },
  { name: 'wooden_pent', width: 2.0, depth: 1.5, height: 2.0, roofType: 'pent', color: 0x8b7355 },
  { name: 'metal', width: 2.2, depth: 1.8, height: 2.0, roofType: 'pent', color: 0x888888 },
  { name: 'plastic', width: 1.8, depth: 1.2, height: 1.9, roofType: 'pent', color: 0xaaaaaa }
]

const PARKED_CAR_TYPES = [
  { name: 'hatchback', length: 4.0, width: 1.7, height: 1.45, colors: [0xffffff, 0x222222, 0x888888, 0x1a3a5c, 0x8b0000, 0x2e4a2e] },
  { name: 'saloon', length: 4.6, width: 1.8, height: 1.45, colors: [0x1a1a2e, 0xffffff, 0x2c3e50, 0x8b0000] },
  { name: 'estate', length: 4.8, width: 1.85, height: 1.5, colors: [0x333333, 0x888888, 0x222222, 0x1a3a5c] },
  { name: 'suv', length: 4.6, width: 1.9, height: 1.65, colors: [0x1a1a1a, 0xffffff, 0x888888, 0x2c3e50, 0x2e4a2e] },
  { name: 'van', length: 5.0, width: 2.0, height: 2.2, colors: [0xffffff, 0xffff00, 0xff0000, 0x0000ff] }
]

const TREE_TYPES = [
  { name: 'oak', trunkHeight: 4, trunkRadius: 0.3, canopyRadius: 4, canopyHeight: 5, color: 0x2d5a27 },
  { name: 'birch', trunkHeight: 5, trunkRadius: 0.15, canopyRadius: 2, canopyHeight: 4, color: 0x6a9c6e },
  { name: 'maple', trunkHeight: 3.5, trunkRadius: 0.25, canopyRadius: 3.5, canopyHeight: 4.5, color: 0x3a7a33 },
  { name: 'cherry', trunkHeight: 3, trunkRadius: 0.2, canopyRadius: 3, canopyHeight: 4, color: 0x8a5a7a },
  { name: 'conifer', trunkHeight: 6, trunkRadius: 0.2, canopyRadius: 1.5, canopyHeight: 6, color: 0x1a4a1a },
  { name: 'apple', trunkHeight: 2.5, trunkRadius: 0.25, canopyRadius: 3, canopyHeight: 3.5, color: 0x4a6a3a }
]

const EXTERIOR_LIGHTS = [
  { name: 'wall_lantern', height: 2.2, armLength: 0.4, color: 0xffcc88, intensity: 0.8 },
  { name: 'modern_wall', height: 2.0, armLength: 0.2, color: 0xffffee, intensity: 1.0 },
  { name: 'porch_light', height: 2.4, armLength: 0, color: 0xffddaa, intensity: 0.9 },
  { name: 'pillar_light', height: 1.8, armLength: 0, color: 0xffcc88, intensity: 0.7 },
  { name: 'bollard', height: 0.9, armLength: 0, color: 0xffeecc, intensity: 0.5 }
]

/**
 * Generate complete exterior for a house
 */
export function generateExterior(options: ExteriorGenerationOptions): GeneratedExterior {
  const { template, variation, position, rotation, rng, sceneManager } = options
  const group = new THREE.Group()
  group.name = `house_exterior_${position.x.toFixed(0)}_${position.z.toFixed(0)}`
  group.position.copy(position)
  group.rotation.y = rotation

  const result: GeneratedExterior = {
    group,
    fenceMeshes: [],
    pathMeshes: [],
    flowerBeds: [],
    bins: [],
    parkedCars: [],
    lighting: [],
    trees: [],
    decorations: []
  }

  // Generate in order (back to front for proper layering)
  generateGrass(options, result)
  generateDriveway(options, result)
  generateFencing(options, result)
  generateGate(options, result)
  generatePath(options, result)
  generateFlowerBeds(options, result)
  generateTrees(options, result)
  generateShed(options, result)
  generateBins(options, result)
  generateParkedCars(options, result)
  generateLighting(options, result)
  generateDecorations(options, result)

  // Add to scene
  sceneManager.scene.add(group)

  return result
}

/**
 * Generate grass/lawn area
 */
function generateGrass(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng } = options
  const grassVariant = GRASS_VARIANTS[Math.floor(rng() * GRASS_VARIANTS.length)]

  const grassWidth = template.width + 4 + (variation.gardenLayout === 'lawn' ? 2 : 0)
  const grassDepth = template.depth + 4 + template.gardenDepth

  const grassGeom = new THREE.PlaneGeometry(grassWidth, grassDepth)
  const grassMat = new THREE.MeshStandardMaterial({
    color: grassVariant.color,
    roughness: grassVariant.roughness
  })
  const grassMesh = new THREE.Mesh(grassGeom, grassMat)
  grassMesh.rotation.x = -Math.PI / 2
  grassMesh.position.y = 0.005
  grassMesh.receiveShadow = true
  grassMesh.name = 'grass'
  result.group.add(grassMesh)
  result.grassMesh = grassMesh

  // Add some variation patches
  if (variation.gardenLayout === 'wildlife' || variation.gardenLayout === 'cottage') {
    addGrassPatches(options, result, grassWidth, grassDepth)
  }
}

function addGrassPatches(options: ExteriorGenerationOptions, result: GeneratedExterior, width: number, depth: number): void {
  const { rng } = options
  const patchCount = Math.floor(rng() * 5) + 3

  for (let i = 0; i < patchCount; i++) {
    const patchSize = 1 + rng() * 2
    const patchGeom = new THREE.CircleGeometry(patchSize, 8)
    const patchMat = new THREE.MeshStandardMaterial({
      color: GRASS_VARIANTS[Math.floor(rng() * GRASS_VARIANTS.length)].color,
      roughness: 1.0
    })
    const patch = new THREE.Mesh(patchGeom, patchMat)
    patch.rotation.x = -Math.PI / 2
    patch.position.set(
      (rng() - 0.5) * width * 0.7,
      0.01,
      (rng() - 0.5) * depth * 0.7
    )
    patch.receiveShadow = true
    result.group.add(patch)
  }
}

/**
 * Generate driveway
 */
function generateDriveway(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng } = options

  if (variation.drivewayWidth <= 0) return

  const driveMaterial = DRIVEWAY_MATERIALS[Math.floor(rng() * DRIVEWAY_MATERIALS.length)]
  const driveWidth = variation.drivewayWidth
  const driveDepth = template.depth + 5 + (variation.hasGarage ? 6 : 0)

  const driveGeom = new THREE.PlaneGeometry(driveWidth, driveDepth)
  const driveMat = new THREE.MeshStandardMaterial({
    color: driveMaterial.color,
    roughness: driveMaterial.roughness
  })
  const driveMesh = new THREE.Mesh(driveGeom, driveMat)
  driveMesh.rotation.x = -Math.PI / 2
  driveMesh.position.y = 0.02
  driveMesh.position.z = -driveDepth / 2 + template.depth / 2 + 2.5
  driveMesh.receiveShadow = true
  driveMesh.name = 'driveway'
  result.group.add(driveMesh)
  result.drivewayMesh = driveMesh

  // Add tire tracks for asphalt/concrete
  if (driveMaterial.name === 'asphalt' || driveMaterial.name === 'concrete') {
    addTireTracks(driveMesh, driveWidth, driveDepth, driveMaterial.color)
  }

  // Add driveway edges
  addDrivewayEdges(options, result, driveWidth, driveDepth)
}

function addTireTracks(driveMesh: THREE.Mesh, width: number, depth: number, baseColor: number): void {
  const trackColor = baseColor === 0x333333 ? 0x444444 : 0xaaaaaa
  const trackWidth = 0.35
  const trackSpacing = 0.85 // center to center

  for (let side = -1; side <= 1; side += 2) {
    const trackGeom = new THREE.PlaneGeometry(trackWidth, depth)
    const trackMat = new THREE.MeshStandardMaterial({
      color: trackColor,
      roughness: 0.9
    })
    const track = new THREE.Mesh(trackGeom, trackMat)
    track.rotation.x = -Math.PI / 2
    track.position.set(side * trackSpacing / 2, 0.025, 0)
    driveMesh.add(track)
  }
}

function addDrivewayEdges(options: ExteriorGenerationOptions, result: GeneratedExterior, width: number, depth: number): void {
  const { rng } = options
  if (rng() < 0.5) return

  const edgeGeom = new THREE.BoxGeometry(width + 0.2, 0.1, 0.15)
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.9 })

  for (let side = -1; side <= 1; side += 2) {
    const edge = new THREE.Mesh(edgeGeom, edgeMat)
    edge.position.set(0, 0.05, side * (depth / 2 + 0.075))
    edge.receiveShadow = true
    result.group.add(edge)
  }
}

/**
 * Generate fencing
 */
function generateFencing(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng, rotation } = options

  if (variation.fenceStyle === 'none') return

  const fenceConfig = FENCE_STYLES[variation.fenceStyle]
  if (!fenceConfig) return

  const perimeterWidth = template.width + 2
  const perimeterDepth = template.depth + 2 + template.gardenDepth

  // Front fence (with gap for gate)
  const frontFence = createFenceSection(
    perimeterWidth - (variation.gateStyle !== 'none' ? 1.5 : 0),
    fenceConfig,
    rng
  )
  if (frontFence) {
    frontFence.position.set(0, fenceConfig.height / 2, perimeterDepth / 2 + 0.1)
    frontFence.rotation.y = rotation
    result.group.add(frontFence)
    result.fenceMeshes.push(frontFence)
  }

  // Side fences
  for (let side = -1; side <= 1; side += 2) {
    const sideFence = createFenceSection(
      perimeterDepth,
      fenceConfig,
      rng
    )
    if (sideFence) {
      sideFence.position.set(side * (perimeterWidth / 2 + 0.1), fenceConfig.height / 2, 0)
      sideFence.rotation.y = rotation + Math.PI / 2
      result.group.add(sideFence)
      result.fenceMeshes.push(sideFence)
    }
  }

  // Back fence
  const backFence = createFenceSection(perimeterWidth, fenceConfig, rng)
  if (backFence) {
    backFence.position.set(0, fenceConfig.height / 2, -perimeterDepth / 2 - 0.1)
    backFence.rotation.y = rotation + Math.PI
    result.group.add(backFence)
    result.fenceMeshes.push(backFence)
  }
}

function createFenceSection(length: number, config: typeof FENCE_STYLES.picket, rng: () => number): THREE.Mesh | null {
  if (length <= 0) return null

  const group = new THREE.Group()
  const postGeom = new THREE.CylinderGeometry(0.06, 0.07, config.height + 0.3, 6)
  const postMat = new THREE.MeshStandardMaterial({ color: config.color === 0x333333 ? 0x222222 : 0x554433, roughness: 0.8 })

  if (config.picketWidth > 0) {
    // Picket or closeboard fence
    const picketCount = Math.ceil(length / config.postSpacing)
    const picketGeom = new THREE.BoxGeometry(config.picketWidth, config.height * 0.85, 0.025)
    const picketMat = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.7 })

    for (let i = 0; i <= picketCount; i++) {
      const x = -length / 2 + (i / picketCount) * length
      // Post
      const post = new THREE.Mesh(postGeom, postMat)
      post.position.set(x, config.height / 2 + 0.15, 0)
      post.castShadow = true
      group.add(post)

      // Pickets between posts
      if (i < picketCount) {
        const picketSpacing = length / picketCount
        const picketCountBetween = Math.floor(picketSpacing / 0.1)
        for (let p = 1; p < picketCountBetween; p++) {
          const picketX = x + (p / picketCountBetween) * picketSpacing
          const picket = new THREE.Mesh(picketGeom, picketMat)
          picket.position.set(picketX, config.height * 0.5, 0)
          picket.castShadow = true
          group.add(picket)
        }

        // Top rail
        if (i < picketCount) {
          const railGeom = new THREE.BoxGeometry(picketSpacing, 0.05, 0.08)
          const rail = new THREE.Mesh(railGeom, postMat)
          rail.position.set(x + picketSpacing / 2, config.height - 0.1, 0)
          group.add(rail)
        }
      }
    }
  } else if (config.height > 1.3) {
    // Panel or closeboard fence (solid panels)
    const panelCount = Math.ceil(length / config.postSpacing)
    const panelGeom = new THREE.BoxGeometry(length / panelCount, config.height, 0.04)
    const panelMat = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.7 })

    for (let i = 0; i < panelCount; i++) {
      const x = -length / 2 + (i + 0.5) * (length / panelCount)

      // Post
      const post = new THREE.Mesh(postGeom, postMat)
      post.position.set(x - length / panelCount / 2, config.height / 2 + 0.15, 0)
      post.castShadow = true
      group.add(post)

      // Panel
      const panel = new THREE.Mesh(panelGeom, panelMat)
      panel.position.set(x, config.height / 2, 0)
      panel.castShadow = true
      panel.receiveShadow = true
      group.add(panel)
    }
    // Last post
    const lastPost = new THREE.Mesh(postGeom, postMat)
    lastPost.position.set(length / 2, config.height / 2 + 0.15, 0)
    lastPost.castShadow = true
    group.add(lastPost)
  } else {
    // Hedge - create as volume
    const hedgeGeom = new THREE.BoxGeometry(length, config.height, 0.8)
    const hedgeMat = new THREE.MeshStandardMaterial({ color: config.color, roughness: 1.0 })
    const hedge = new THREE.Mesh(hedgeGeom, hedgeMat)
    hedge.position.set(0, config.height / 2, 0)
    hedge.castShadow = true
    hedge.receiveShadow = true
    group.add(hedge)

    // Add some noise to hedge top
    const positions = hedgeGeom.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i)
      if (y > config.height * 0.4) {
        positions.setY(i, y + (rng() - 0.5) * 0.2)
      }
    }
    hedgeGeom.computeVertexNormals()
    return hedge
  }

  // Merge for performance
  const meshes: THREE.Mesh[] = []
  group.traverse(child => {
    if (child instanceof THREE.Mesh) meshes.push(child)
  })

  if (meshes.length === 0) return null
  if (meshes.length === 1) return meshes[0]

  const mergedGeometry = mergeGeometries(meshes.map(m => m.geometry), false)
  const material = meshes[0].material
  const mergedMesh = new THREE.Mesh(mergedGeometry, material)
  mergedMesh.castShadow = true
  mergedMesh.receiveShadow = true
  return mergedMesh
}

/**
 * Generate gate
 */
function generateGate(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng, rotation } = options

  if (variation.gateStyle === 'none') return

  const gateConfig = GATE_STYLES[variation.gateStyle]
  if (!gateConfig || gateConfig.width <= 0) return

  const group = new THREE.Group()
  const perimeterDepth = template.depth + 2 + template.gardenDepth

  if (variation.gateStyle === 'brick_pillar') {
    // Two brick pillars
    const pillarGeom = new THREE.BoxGeometry(0.4, 1.8, 0.4)
    const pillarMat = new THREE.MeshStandardMaterial({ color: gateConfig.color, roughness: 0.8 })

    for (let side = -1; side <= 1; side += 2) {
      const pillar = new THREE.Mesh(pillarGeom, pillarMat)
      pillar.position.set(side * gateConfig.width / 2, 0.9, perimeterDepth / 2 + 0.2)
      pillar.castShadow = true
      group.add(pillar)

      // Pillar cap
      const capGeom = new THREE.BoxGeometry(0.5, 0.15, 0.5)
      const cap = new THREE.Mesh(capGeom, pillarMat)
      cap.position.set(side * gateConfig.width / 2, 1.875, perimeterDepth / 2 + 0.2)
      group.add(cap)
    }

    // Gate between pillars
    const gateGeom = new THREE.BoxGeometry(gateConfig.width - 0.8, 1.5, 0.05)
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 })
    const gate = new THREE.Mesh(gateGeom, gateMat)
    gate.position.set(0, 0.75, perimeterDepth / 2 + 0.25)
    gate.castShadow = true
    group.add(gate)
  } else {
    // Wooden or metal gate
    const gateGeom = new THREE.BoxGeometry(gateConfig.width, gateConfig.height, 0.05)
    const gateMat = new THREE.MeshStandardMaterial({ color: gateConfig.color, roughness: 0.4 })
    const gate = new THREE.Mesh(gateGeom, gateMat)
    gate.position.set(0, gateConfig.height / 2, perimeterDepth / 2 + 0.15)
    gate.castShadow = true
    group.add(gate)

    // Hinges
    const hingeGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6)
    const hingeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.8 })
    for (let y = 0.3; y < gateConfig.height; y += gateConfig.height - 0.6) {
      const hinge = new THREE.Mesh(hingeGeom, hingeMat)
      hinge.rotation.z = Math.PI / 2
      hinge.position.set(-gateConfig.width / 2 - 0.05, y, perimeterDepth / 2 + 0.18)
      group.add(hinge)
    }
  }

  group.rotation.y = rotation
  result.group.add(group)
  result.gateMesh = group
}

/**
 * Generate path from gate to front door
 */
function generatePath(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng, rotation } = options

  if (variation.pathStyle === 'none') return

  const pathConfig = PATH_STYLES[variation.pathStyle]
  if (!pathConfig || pathConfig.width <= 0) return

  const pathLength = template.depth / 2 + template.gardenDepth / 2 + 1.5
  const segmentCount = Math.ceil(pathLength / (pathConfig.segmentLength + pathConfig.gap))

  for (let i = 0; i < segmentCount; i++) {
    const z = -pathLength / 2 + i * (pathConfig.segmentLength + pathConfig.gap) + pathConfig.segmentLength / 2
    if (z > pathLength / 2) continue

    const segmentGeom = pathConfig.segmentLength > 0.5
      ? new THREE.PlaneGeometry(pathConfig.width, pathConfig.segmentLength)
      : new THREE.CircleGeometry(pathConfig.width / 2, 8)

    const segmentMat = new THREE.MeshStandardMaterial({
      color: pathConfig.color,
      roughness: 0.95
    })
    const segment = new THREE.Mesh(segmentGeom, segmentMat)
    segment.rotation.x = -Math.PI / 2
    segment.position.set(0, 0.03, z)
    segment.receiveShadow = true
    segment.rotation.y = rotation
    result.group.add(segment)
    result.pathMeshes.push(segment)
  }
}

/**
 * Generate flower beds
 */
function generateFlowerBeds(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng, rotation } = options

  if (variation.gardenLayout === 'low_maintenance' || variation.gardenLayout === 'none') return

  const bedCount = variation.gardenLayout === 'cottage' ? 6 + Math.floor(rng() * 4) : 2 + Math.floor(rng() * 3)
  const bedColors = [0xff69b4, 0xff4500, 0xffff00, 0xffa500, 0x8a2be2, 0x00bfff, 0xff1493, 0x32cd32, 0xffd700, 0xffffff]

  for (let i = 0; i < bedCount; i++) {
    const isBorder = rng() < 0.6
    let bedWidth, bedDepth, x, z

    if (isBorder) {
      // Border along house walls
      const side = rng() < 0.5 ? -1 : 1
      bedWidth = 0.6 + rng() * 0.4
      bedDepth = template.depth * (0.3 + rng() * 0.4)
      x = side * (template.width / 2 + bedWidth / 2 + 0.5)
      z = (rng() - 0.5) * bedDepth * 0.5
    } else {
      // Island beds
      bedWidth = 1 + rng() * 1.5
      bedDepth = 1 + rng() * 1.5
      x = (rng() - 0.5) * (template.width * 0.8)
      z = -template.depth / 4 + rng() * (template.gardenDepth * 0.6)
    }

    const bedGeom = new THREE.BoxGeometry(bedWidth, 0.3, bedDepth)
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1.0 })
    const bed = new THREE.Mesh(bedGeom, soilMat)
    bed.position.set(x, 0.15, z)
    bed.receiveShadow = true
    bed.rotation.y = rotation
    result.group.add(bed)
    result.flowerBeds.push(bed)

    // Plants in bed
    const plantCount = Math.floor((bedWidth * bedDepth) / 0.15)
    for (let p = 0; p < plantCount; p++) {
      const plantType = rng() < 0.7 ? 'flower' : 'shrub'
      const plant = createPlant(plantType, bedColors[Math.floor(rng() * bedColors.length)], rng)
      plant.position.set(
        x + (rng() - 0.5) * bedWidth * 0.8,
        0.3,
        z + (rng() - 0.5) * bedDepth * 0.8
      )
      plant.rotation.y = rotation + rng() * Math.PI * 2
      result.group.add(plant)
      result.decorations.push(plant)
    }
  }
}

function createPlant(type: 'flower' | 'shrub', color: number, rng: () => number): THREE.Group {
  const group = new THREE.Group()

  if (type === 'flower') {
    // Small flower cluster
    const stemCount = 3 + Math.floor(rng() * 4)
    const stemGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.25, 4)
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2a5a1a, roughness: 0.8 })

    for (let i = 0; i < stemCount; i++) {
      const stem = new THREE.Mesh(stemGeom, stemMat)
      stem.position.set((rng() - 0.5) * 0.15, 0.125, (rng() - 0.5) * 0.15)
      group.add(stem)

      // Flower head
      const headGeom = new THREE.SphereGeometry(0.04, 6, 6)
      const headMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3 })
      const head = new THREE.Mesh(headGeom, headMat)
      head.position.set(stem.position.x, 0.27, stem.position.z)
      group.add(head)
    }
  } else {
    // Shrub
    const shrubGeom = new THREE.SphereGeometry(0.4 + rng() * 0.3, 8, 6)
    const shrubMat = new THREE.MeshStandardMaterial({ color: 0x2a5a1a + Math.floor(rng() * 0x101010), roughness: 0.9 })
    const shrub = new THREE.Mesh(shrubGeom, shrubMat)
    shrub.position.y = 0.4
    shrub.scale.y = 0.7
    shrub.castShadow = true
    group.add(shrub)
  }

  return group
}

/**
 * Generate trees
 */
function generateTrees(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng, rotation } = options

  if (variation.gardenLayout === 'low_maintenance' || variation.gardenLayout === 'none') return

  const treeCount = variation.gardenLayout === 'wildlife' ? 3 + Math.floor(rng() * 3) : Math.floor(rng() * 2)

  for (let i = 0; i < treeCount; i++) {
    const treeType = TREE_TYPES[Math.floor(rng() * TREE_TYPES.length)]
    const tree = createTree(treeType, rng)
    tree.position.set(
      (rng() - 0.5) * (template.width + 6),
      0,
      -template.depth / 2 - 2 + rng() * (template.gardenDepth - 2)
    )
    tree.rotation.y = rotation
    tree.castShadow = true
    result.group.add(tree)
    result.trees.push(tree)
  }
}

function createTree(type: typeof TREE_TYPES[0], rng: () => number): THREE.Group {
  const group = new THREE.Group()

  // Trunk
  const trunkGeom = new THREE.CylinderGeometry(type.trunkRadius * 0.8, type.trunkRadius, type.trunkHeight, 8)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 })
  const trunk = new THREE.Mesh(trunkGeom, trunkMat)
  trunk.position.y = type.trunkHeight / 2
  trunk.castShadow = true
  group.add(trunk)

  // Canopy
  const canopyGeom = new THREE.ConeGeometry(type.canopyRadius, type.canopyHeight, 8)
  const canopyMat = new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.9 })
  const canopy = new THREE.Mesh(canopyGeom, canopyMat)
  canopy.position.y = type.trunkHeight + type.canopyHeight / 2
  canopy.castShadow = true
  group.add(canopy)

  // Add second canopy layer for fuller trees
  if (rng() < 0.7) {
    const canopy2 = new THREE.Mesh(
      new THREE.ConeGeometry(type.canopyRadius * 0.8, type.canopyHeight * 0.7, 8),
      canopyMat
    )
    canopy2.position.y = type.trunkHeight + type.canopyHeight * 0.6
    canopy2.castShadow = true
    group.add(canopy2)
  }

  return group
}

/**
 * Generate garden shed
 */
function generateShed(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng, rotation } = options

  if (!variation.hasGarage && rng() > 0.3) return // Only sometimes if no garage

  const shedStyle = SHED_STYLES[Math.floor(rng() * SHED_STYLES.length)]
  const group = new THREE.Group()

  // Base
  const baseGeom = new THREE.BoxGeometry(shedStyle.width, 0.1, shedStyle.depth)
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 })
  const base = new THREE.Mesh(baseGeom, baseMat)
  base.position.y = 0.05
  base.receiveShadow = true
  group.add(base)

  // Walls
  const wallHeight = shedStyle.height - (shedStyle.roofType === 'apex' ? 1 : 0.5)
  const wallGeom = new THREE.BoxGeometry(shedStyle.width - 0.1, wallHeight, shedStyle.depth - 0.1)
  const wallMat = new THREE.MeshStandardMaterial({ color: shedStyle.color, roughness: 0.8 })
  const walls = new THREE.Mesh(wallGeom, wallMat)
  walls.position.y = wallHeight / 2 + 0.1
  walls.castShadow = true
  walls.receiveShadow = true
  group.add(walls)

  // Door
  const doorGeom = new THREE.BoxGeometry(0.8, 1.8, 0.05)
  const doorMat = new THREE.MeshStandardMaterial({ color: shedStyle.color === 0x888888 ? 0x555555 : 0x5d4037, roughness: 0.5 })
  const door = new THREE.Mesh(doorGeom, doorMat)
  door.position.set(0, 0.9, shedStyle.depth / 2 - 0.05)
  door.castShadow = true
  group.add(door)

  // Roof
  if (shedStyle.roofType === 'apex') {
    const roofGeom = new THREE.BoxGeometry(shedStyle.width + 0.2, 1, shedStyle.depth + 0.2)
    const roofShape = new THREE.Shape()
    roofShape.moveTo(-(shedStyle.width + 0.2) / 2, 0)
    roofShape.lineTo(0, 1)
    roofShape.lineTo((shedStyle.width + 0.2) / 2, 0)
    const extrudeSettings = { depth: shedStyle.depth + 0.2, bevelEnabled: false }
    const roofGeom2 = new THREE.ExtrudeGeometry(roofShape, extrudeSettings)
    roofGeom2.rotateX(-Math.PI / 2)
    roofGeom2.translate(0, wallHeight + 0.1 + 0.5, 0)
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x552211, roughness: 0.8 })
    const roof = new THREE.Mesh(roofGeom2, roofMat)
    roof.castShadow = true
    group.add(roof)
  } else {
    // Pent roof
    const roofGeom = new THREE.BoxGeometry(shedStyle.width + 0.2, 0.15, shedStyle.depth + 0.2)
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x552211, roughness: 0.8 })
    const roof = new THREE.Mesh(roofGeom, roofMat)
    roof.position.set(0, wallHeight + 0.1 + 0.075, 0)
    roof.castShadow = true
    group.add(roof)
  }

  // Position shed at back corner
  group.position.set(
    (rng() < 0.5 ? -1 : 1) * (template.width / 2 + shedStyle.width / 2 + 1),
    0,
    -template.depth / 2 - template.gardenDepth / 2 - shedStyle.depth / 2
  )
  group.rotation.y = rotation
  result.group.add(group)
  result.shed = group
}

/**
 * Generate wheelie bins
 */
function generateBins(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng, rotation } = options

  const binCount = 1 + Math.floor(rng() * 3) // 1-3 bins

  for (let i = 0; i < binCount; i++) {
    const binType = BIN_TYPES[Math.floor(rng() * BIN_TYPES.length)]
    const binColor = binType.colors[Math.floor(rng() * binType.colors.length)]

    const group = new THREE.Group()

    // Body
    const bodyGeom = new THREE.CylinderGeometry(binType.radius, binType.radius * 1.1, binType.bodyHeight, 8)
    const bodyMat = new THREE.MeshStandardMaterial({ color: binColor, roughness: 0.7 })
    const body = new THREE.Mesh(bodyGeom, bodyMat)
    body.position.y = binType.bodyHeight / 2
    body.castShadow = true
    group.add(body)

    // Lid
    const lidGeom = new THREE.CylinderGeometry(binType.radius * 1.12, binType.radius * 1.12, 0.08, 8)
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
    const lid = new THREE.Mesh(lidGeom, lidMat)
    lid.position.y = binType.bodyHeight + 0.04
    group.add(lid)

    // Handle
    const handleGeom = new THREE.TorusGeometry(0.08, 0.015, 4, 8)
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.8 })
    const handle = new THREE.Mesh(handleGeom, handleMat)
    handle.rotation.x = Math.PI / 2
    handle.position.set(0, binType.bodyHeight * 0.7, binType.radius * 1.12)
    group.add(handle)

    // Position bins near side/back of house
    const side = rng() < 0.5 ? -1 : 1
    group.position.set(
      side * (template.width / 2 + 1 + rng() * 1.5),
      0,
      -template.depth / 4 + rng() * (template.depth / 2)
    )
    group.rotation.y = rotation
    result.group.add(group)
    result.bins.push(group)
  }
}

/**
 * Generate parked cars on driveway
 */
function generateParkedCars(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng, rotation } = options

  if (!variation.hasGarage && rng() > 0.4) return // Sometimes parked on drive even without garage

  const carCount = variation.hasGarage ? (rng() < 0.6 ? 1 : (rng() < 0.8 ? 2 : 0)) : (rng() < 0.3 ? 1 : 0)

  for (let i = 0; i < carCount; i++) {
    const carType = PARKED_CAR_TYPES[Math.floor(rng() * PARKED_CAR_TYPES.length)]
    const carColor = carType.colors[Math.floor(rng() * carType.colors.length)]
    const car = createSimpleCar(carType, carColor, rng)
    car.rotation.y = rotation + Math.PI // Facing house

    // Position on driveway
    const driveWidth = variation.drivewayWidth || 3
    const xPos = (rng() - 0.5) * (driveWidth - carType.width - 0.5)
    const zPos = -template.depth / 2 - 1 - i * (carType.length + 1)

    car.position.set(xPos, 0, zPos)
    car.castShadow = true
    result.group.add(car)
    result.parkedCars.push(car)
  }
}

function createSimpleCar(carType: typeof PARKED_CAR_TYPES[0], color: number, rng: () => number): THREE.Group {
  const group = new THREE.Group()

  // Body
  const bodyGeom = new THREE.BoxGeometry(carType.width, carType.height * 0.6, carType.length)
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.7 })
  const body = new THREE.Mesh(bodyGeom, bodyMat)
  body.position.y = carType.height * 0.3
  body.castShadow = true
  group.add(body)

  // Cabin
  const cabinHeight = carType.height * 0.4
  const cabinGeom = new THREE.BoxGeometry(carType.width * 0.8, cabinHeight, carType.length * 0.5)
  const cabin = new THREE.Mesh(cabinGeom, bodyMat)
  cabin.position.set(0, carType.height * 0.6 + cabinHeight / 2, -carType.length * 0.1)
  cabin.castShadow = true
  group.add(cabin)

  // Windows
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.6 })
  const windowGeom = new THREE.PlaneGeometry(carType.width * 0.7, cabinHeight * 0.7)
  const frontWindow = new THREE.Mesh(windowGeom, windowMat)
  frontWindow.position.set(0, carType.height * 0.6 + cabinHeight / 2, -carType.length * 0.35 + 0.01)
  group.add(frontWindow)

  const rearWindow = new THREE.Mesh(windowGeom, windowMat)
  rearWindow.rotation.y = Math.PI
  rearWindow.position.set(0, carType.height * 0.6 + cabinHeight / 2, carType.length * 0.15 - 0.01)
  group.add(rearWindow)

  // Wheels
  const wheelGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.15, 16)
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
  const wheelPositions = [
    [-carType.width / 2 - 0.05, 0.3, -carType.length * 0.35],
    [carType.width / 2 + 0.05, 0.3, -carType.length * 0.35],
    [-carType.width / 2 - 0.05, 0.3, carType.length * 0.35],
    [carType.width / 2 + 0.05, 0.3, carType.length * 0.35]
  ]

  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeom, wheelMat)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, y, z)
    wheel.castShadow = true
    group.add(wheel)
  }

  return group
}

/**
 * Generate exterior lighting
 */
function generateLighting(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng, rotation } = options

  // Porch light
  if (variation.hasPorch) {
    const light = createExteriorLight('porch_light', rng)
    light.position.set(0, 2.4, template.depth / 2 + 0.5)
    light.rotation.y = rotation
    result.group.add(light)
    result.lighting.push(light)
  }

  // Wall lanterns by front door
  if (rng() < 0.6) {
    for (let side = -1; side <= 1; side += 2) {
      const light = createExteriorLight('wall_lantern', rng)
      light.position.set(side * 0.8, 2.2, template.depth / 2 + 0.3)
      light.rotation.y = rotation
      result.group.add(light)
      result.lighting.push(light)
    }
  }

  // Driveway bollards
  if (variation.drivewayWidth > 2.5 && rng() < 0.4) {
    for (let i = 0; i < 2; i++) {
      const light = createExteriorLight('bollard', rng)
      light.position.set(
        (i === 0 ? -1 : 1) * variation.drivewayWidth / 3,
        0.9,
        -template.depth / 4
      )
      light.rotation.y = rotation
      result.group.add(light)
      result.lighting.push(light)
    }
  }

  // Pillar lights at gate
  if (variation.gateStyle === 'brick_pillar' && rng() < 0.5) {
    for (let side = -1; side <= 1; side += 2) {
      const light = createExteriorLight('pillar_light', rng)
      light.position.set(side * (template.width / 2 + 0.5), 1.8, template.depth / 2 + template.gardenDepth / 2 + 1)
      light.rotation.y = rotation
      result.group.add(light)
      result.lighting.push(light)
    }
  }
}

function createExteriorLight(type: string, rng: () => number): THREE.Group {
  const lightConfig = EXTERIOR_LIGHTS.find(l => l.name === type) || EXTERIOR_LIGHTS[0]
  const group = new THREE.Group()

  // Fixture
  const fixtureGeom = new THREE.CylinderGeometry(0.05, 0.05, lightConfig.height, 8)
  const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.8 })
  const fixture = new THREE.Mesh(fixtureGeom, fixtureMat)
  fixture.position.y = lightConfig.height / 2
  fixture.castShadow = true
  group.add(fixture)

  // Lantern head
  const headGeom = new THREE.SphereGeometry(0.12, 8, 6)
  const headMat = new THREE.MeshStandardMaterial({
    color: lightConfig.color,
    emissive: lightConfig.color,
    emissiveIntensity: lightConfig.intensity,
    roughness: 0.3,
    transparent: true,
    opacity: 0.9
  })
  const head = new THREE.Mesh(headGeom, headMat)
  head.position.y = lightConfig.height
  group.add(head)

  // Arm for wall lights
  if (lightConfig.armLength > 0) {
    const armGeom = new THREE.CylinderGeometry(0.02, 0.02, lightConfig.armLength, 6)
    const arm = new THREE.Mesh(armGeom, fixtureMat)
    arm.rotation.z = Math.PI / 2
    arm.position.set(lightConfig.armLength / 2, lightConfig.height, 0)
    group.add(arm)
  }

  // Actual Three.js light
  const pointLight = new THREE.PointLight(lightConfig.color, lightConfig.intensity * 20, 8, 2)
  pointLight.position.y = lightConfig.height
  pointLight.castShadow = false
  group.add(pointLight)

  // Store light reference for time-of-day control
  ;(group as any).pointLight = pointLight
  ;(group as any).lightConfig = lightConfig

  return group
}

/**
 * Generate decorations (garden ornaments, washing line, etc.)
 */
function generateDecorations(options: ExteriorGenerationOptions, result: GeneratedExterior): void {
  const { template, variation, rng, rotation } = options

  // Washing line
  if (rng() < 0.3 && variation.gardenLayout !== 'low_maintenance') {
    const line = createWashingLine(template, rng, rotation)
    result.group.add(line)
    result.decorations.push(line)
  }

  // Garden gnome/ornament
  if (variation.gardenLayout === 'cottage' && rng() < 0.4) {
    const gnome = createGnome(rng)
    gnome.position.set(
      (rng() - 0.5) * template.width * 0.6,
      0,
      -template.depth / 4 + rng() * template.gardenDepth * 0.5
    )
    gnome.rotation.y = rotation
    result.group.add(gnome)
    result.decorations.push(gnome)
  }

  // Water butt
  if (rng() < 0.25 && variation.gardenLayout !== 'low_maintenance') {
    const butt = createWaterButt(rng)
    butt.position.set(
      (rng() < 0.5 ? -1 : 1) * (template.width / 2 + 0.5),
      0,
      -template.depth / 2 + 1
    )
    butt.rotation.y = rotation
    result.group.add(butt)
    result.decorations.push(butt)
  }

  // Compost bin
  if (variation.gardenLayout === 'cottage' || variation.gardenLayout === 'wildlife') {
    if (rng() < 0.3) {
      const compost = createCompostBin(rng)
      compost.position.set(
        (rng() < 0.5 ? -1 : 1) * (template.width / 2 + 1.2),
        0,
        -template.depth / 2 - 1 - rng() * 2
      )
      compost.rotation.y = rotation
      result.group.add(compost)
      result.decorations.push(compost)
    }
  }
}

function createWashingLine(template: HouseTemplate, rng: () => number, rotation: number): THREE.Group {
  const group = new THREE.Group()
  const postHeight = 2.0
  const lineLength = template.depth * 0.6

  // Two posts
  for (let side = -1; side <= 1; side += 2) {
    const postGeom = new THREE.CylinderGeometry(0.04, 0.05, postHeight, 6)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.7 })
    const post = new THREE.Mesh(postGeom, postMat)
    post.position.set(side * lineLength / 2, postHeight / 2, -template.depth / 4)
    post.castShadow = true
    group.add(post)

    // Line
    const lineGeom = new THREE.CylinderGeometry(0.005, 0.005, lineLength, 4)
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.2, metalness: 0.8 })
    const line = new THREE.Mesh(lineGeom, lineMat)
    line.rotation.z = Math.PI / 2
    line.position.set(0, postHeight * 0.9, -template.depth / 4)
    group.add(line)
  }

  // Some clothes on line
  const clothColors = [0xffffff, 0x88aaff, 0xffaaaa, 0xaaffaa, 0xffffaa]
  for (let i = 0; i < 4; i++) {
    const clothGeom = new THREE.PlaneGeometry(0.5, 0.35)
    const clothMat = new THREE.MeshStandardMaterial({
      color: clothColors[Math.floor(rng() * clothColors.length)],
      roughness: 1.0,
      side: THREE.DoubleSide
    })
    const cloth = new THREE.Mesh(clothGeom, clothMat)
    cloth.position.set(
      -lineLength / 2 + (i + 0.5) * lineLength / 4,
      postHeight * 0.85,
      -template.depth / 4
    )
    cloth.rotation.x = -0.1
    group.add(cloth)
  }

  return group
}

function createGnome(rng: () => number): THREE.Group {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.7 })
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 })
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.7 })

  // Body
  const bodyGeom = new THREE.CylinderGeometry(0.1, 0.12, 0.25, 8)
  const body = new THREE.Mesh(bodyGeom, bodyMat)
  body.position.y = 0.125
  body.castShadow = true
  group.add(body)

  // Head
  const headGeom = new THREE.SphereGeometry(0.08, 8, 8)
  const head = new THREE.Mesh(headGeom, skinMat)
  head.position.y = 0.25 + 0.08
  head.castShadow = true
  group.add(head)

  // Hat
  const hatGeom = new THREE.ConeGeometry(0.1, 0.15, 8)
  const hat = new THREE.Mesh(hatGeom, hatMat)
  hat.position.y = 0.25 + 0.08 + 0.1
  hat.castShadow = true
  group.add(hat)

  // Beard
  const beardGeom = new THREE.ConeGeometry(0.07, 0.08, 8)
  const beardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
  const beard = new THREE.Mesh(beardGeom, beardMat)
  beard.position.y = 0.25 + 0.04
  beard.rotation.x = Math.PI
  group.add(beard)

  return group
}

function createWaterButt(rng: () => number): THREE.Group {
  const group = new THREE.Group()
  const bodyGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12)
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a4a2a, roughness: 0.6 })
  const body = new THREE.Mesh(bodyGeom, bodyMat)
  body.position.y = 0.45
  body.castShadow = true
  group.add(body)

  // Lid
  const lidGeom = new THREE.CylinderGeometry(0.37, 0.37, 0.08, 12)
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.5 })
  const lid = new THREE.Mesh(lidGeom, lidMat)
  lid.position.y = 0.94
  group.add(lid)

  // Tap
  const tapGeom = new THREE.BoxGeometry(0.08, 0.08, 0.12)
  const tapMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.9 })
  const tap = new THREE.Mesh(tapGeom, tapMat)
  tap.position.set(0.37, 0.4, 0)
  group.add(tap)

  return group
}

function createCompostBin(rng: () => number): THREE.Group {
  const group = new THREE.Group()
  const slatGeom = new THREE.BoxGeometry(0.8, 0.05, 0.02)
  const slatMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 })

  // Four sides with gaps
  for (let side = 0; side < 4; side++) {
    const sideGroup = new THREE.Group()
    for (let i = 0; i < 16; i++) {
      const slat = new THREE.Mesh(slatGeom, slatMat)
      slat.position.y = i * 0.06
      sideGroup.add(slat)
    }
    sideGroup.position.set(
      side < 2 ? (side === 0 ? 0.4 : -0.4) : 0,
      0.4,
      side >= 2 ? (side === 2 ? 0.4 : -0.4) : 0
    )
    sideGroup.rotation.y = side * Math.PI / 2
    group.add(sideGroup)
  }

  // Lid
  const lidGeom = new THREE.BoxGeometry(0.84, 0.05, 0.84)
  const lid = new THREE.Mesh(lidGeom, slatMat)
  lid.position.y = 1.0
  group.add(lid)

  return group
}

/**
 * Update exterior lighting for time of day
 */
export function updateExteriorLighting(exterior: GeneratedExterior, timeOfDay: number): void {
  // Time of day: 0-24, night is ~20-6
  const isNight = timeOfDay < 6 || timeOfDay > 20
  const isDuskDawn = (timeOfDay >= 18 && timeOfDay < 20) || (timeOfDay >= 5 && timeOfDay < 7)

  for (const light of exterior.lighting) {
    const pointLight = (light as any).pointLight
    const config = (light as any).lightConfig

    if (pointLight && config) {
      if (isNight) {
        pointLight.intensity = config.intensity * 20
        pointLight.visible = true
      } else if (isDuskDawn) {
        pointLight.intensity = config.intensity * 10
        pointLight.visible = true
      } else {
        pointLight.visible = false
      }
    }
  }
}

/**
 * Dispose exterior resources
 */
export function disposeExterior(exterior: GeneratedExterior): void {
  const disposeGroup = (group: THREE.Object3D) => {
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material.dispose()
        }
      } else if (child instanceof THREE.Light) {
        child.dispose()
      }
    })
  }

  if (exterior.drivewayMesh) disposeGroup(exterior.drivewayMesh)
  if (exterior.grassMesh) disposeGroup(exterior.grassMesh)
  for (const mesh of exterior.fenceMeshes) disposeGroup(mesh)
  if (exterior.gateMesh) disposeGroup(exterior.gateMesh)
  for (const mesh of exterior.pathMeshes) disposeGroup(mesh)
  for (const mesh of exterior.flowerBeds) disposeGroup(mesh)
  for (const group of exterior.bins) disposeGroup(group)
  for (const group of exterior.parkedCars) disposeGroup(group)
  if (exterior.shed) disposeGroup(exterior.shed)
  for (const group of exterior.lighting) disposeGroup(group)
  for (const group of exterior.trees) disposeGroup(group)
  for (const group of exterior.decorations) disposeGroup(group)

  disposeGroup(exterior.group)
}