import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SceneManager } from '../systems/SceneManager.js'
import { HOUSE_LAYOUT, RoomData } from '../systems/HouseLayout.js'

export interface HouseInstance {
  id: string
  chunkId: string
  position: THREE.Vector3
  rotation: number
  seed: number
  template: string
  variant: number
  exteriorLoaded: boolean
  interiorLoaded: boolean
  lodLevel: number
  clientName: string
  jobTitle: string
  flavorText: string
  rooms: string[]
  description: string
  bounds: { min: THREE.Vector3; max: THREE.Vector3 }

  // Method to check if a position is near a door
  isDoorNearby(position: THREE.Vector3): boolean
}

export class HouseGenerator {
  private sceneManager: SceneManager
  private worldSeed: number
  private houseMeshes: Map<string, THREE.Group> = new Map()
  private interiorMeshes: Map<string, THREE.Group> = new Map()

  // Template definitions
  private templates: Map<string, HouseTemplate> = new Map()

  constructor(sceneManager: SceneManager, worldSeed: number) {
    this.sceneManager = sceneManager
    this.worldSeed = worldSeed
    this.defineTemplates()
  }

  private defineTemplates(): void {
    // Terraced house
    this.templates.set('terraced', {
      name: 'terraced',
      width: 6,
      depth: 12,
      height: 6.5,
      floors: 2,
      roofType: 'pitched',
      windowStyle: 'sash',
      doorStyle: 'panel',
      brickColor: 0xaa6644,
      roofColor: 0x552211,
      roomLayout: 'standard_terraced'
    })

    // Semi-detached
    this.templates.set('semi_detached', {
      name: 'semi_detached',
      width: 8,
      depth: 10,
      height: 7,
      floors: 2,
      roofType: 'pitched',
      windowStyle: 'casement',
      doorStyle: 'upvc',
      brickColor: 0xb8860b,
      roofColor: 0x654321,
      roomLayout: 'standard_semi'
    })

    // Detached
    this.templates.set('detached', {
      name: 'detached',
      width: 10,
      depth: 12,
      height: 8,
      floors: 2,
      roofType: 'hipped',
      windowStyle: 'bay',
      doorStyle: 'composite',
      brickColor: 0xd2b48c,
      roofColor: 0x8b4513,
      roomLayout: 'standard_detached'
    })

    // Bungalow
    this.templates.set('bungalow', {
      name: 'bungalow',
      width: 12,
      depth: 10,
      height: 4.5,
      floors: 1,
      roofType: 'pitched',
      windowStyle: 'casement',
      doorStyle: 'upvc',
      brickColor: 0xc0a080,
      roofColor: 0x8b7355,
      roomLayout: 'bungalow'
    })

    // Cottage
    this.templates.set('cottage', {
      name: 'cottage',
      width: 7,
      depth: 9,
      height: 6,
      floors: 1.5,
      roofType: 'thatched',
      windowStyle: 'diamond',
      doorStyle: 'stable',
      brickColor: 0xddc8a8,
      roofColor: 0xc2b280,
      roomLayout: 'cottage'
    })
  }

  generateExterior(house: HouseInstance): THREE.Group {
    const template = this.templates.get(house.template) || this.templates.get('terraced')!
    const group = new THREE.Group()
    group.name = `house_${house.id}_exterior`
    group.position.copy(house.position)
    group.rotation.y = house.rotation

    // Create deterministic RNG for this house
    const rng = this.createRNG(house.seed)

    // Foundation
    const foundation = this.createFoundation(template, rng)
    group.add(foundation)

    // Walls
    const walls = this.createWalls(template, rng)
    group.add(walls)

    // Roof
    const roof = this.createRoof(template, rng)
    group.add(roof)

    // Windows
    const windows = this.createWindows(template, rng)
    group.add(windows)

    // Door
    const door = this.createDoor(template, rng)
    group.add(door)

    // Details (gutters, pipes, chimney)
    const details = this.createDetails(template, rng)
    group.add(details)

    // Garden/Drive
    const exterior = this.createExteriorArea(template, house, rng)
    group.add(exterior)

    // LOD meshes
    this.createLODMeshes(group, template, house)

    this.houseMeshes.set(house.id, group)
    this.sceneManager.scene.add(group)

    return group
  }

  generateInterior(house: HouseInstance): THREE.Group {
    const template = this.templates.get(house.template) || this.templates.get('terraced')!
    const group = new THREE.Group()
    group.name = `house_${house.id}_interior`
    group.position.copy(house.position)
    group.rotation.y = house.rotation

    // Use the standard HOUSE_LAYOUT but with variations
    const rng = this.createRNG(house.seed + 1000)

    // Floor
    const floor = this.createInteriorFloor(template, rng)
    group.add(floor)

    // Ceiling
    const ceiling = this.createCeiling(template, rng)
    group.add(ceiling)

    // Walls with doors/windows cutouts
    const walls = this.createInteriorWalls(template, rng)
    group.add(walls)

    // Room divisions
    const rooms = this.createRoomDivisions(template, rng)
    group.add(rooms)

    // Stairs (if 2 floors)
    if (template.floors > 1) {
      const stairs = this.createStairs(template, rng)
      group.add(stairs)
    }

    this.interiorMeshes.set(house.id, group)
    this.sceneManager.scene.add(group)

    return group
  }

  private createFoundation(template: HouseTemplate, rng: () => number): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(template.width + 0.4, 0.5, template.depth + 0.4)
    const material = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9,
      metalness: 0.0
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = 0.25
    mesh.receiveShadow = true
    return mesh
  }

  private createWalls(template: HouseTemplate, rng: () => number): THREE.Group {
    const group = new THREE.Group()

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: template.brickColor,
      roughness: 0.9,
      metalness: 0.0
    })

    const wallHeight = template.height - (template.roofType === 'pitched' ? 2 : 1)
    const wallThickness = 0.3

    // Front wall (with door/window openings)
    const frontWall = this.createWallWithOpenings(
      template.width, wallHeight, wallThickness,
      [{ x: 0, y: 1, w: 1, h: 2.1 }, { x: -1.5, y: 1.5, w: 1.2, h: 1.2 }, { x: 1.5, y: 1.5, w: 1.2, h: 1.2 }],
      wallMaterial
    )
    frontWall.position.set(0, wallHeight / 2, template.depth / 2 + wallThickness / 2)
    group.add(frontWall)

    // Back wall
    const backWall = this.createWallWithOpenings(
      template.width, wallHeight, wallThickness,
      [{ x: -1.5, y: 1.5, w: 1.2, h: 1.2 }, { x: 1.5, y: 1.5, w: 1.2, h: 1.2 }],
      wallMaterial
    )
    backWall.position.set(0, wallHeight / 2, -template.depth / 2 - wallThickness / 2)
    backWall.rotation.y = Math.PI
    group.add(backWall)

    // Left wall
    const leftWall = this.createWallWithOpenings(
      template.depth, wallHeight, wallThickness,
      [{ x: 0, y: 1.5, w: 1.2, h: 1.2 }],
      wallMaterial
    )
    leftWall.position.set(-template.width / 2 - wallThickness / 2, wallHeight / 2, 0)
    leftWall.rotation.y = -Math.PI / 2
    group.add(leftWall)

    // Right wall
    const rightWall = this.createWallWithOpenings(
      template.depth, wallHeight, wallThickness,
      [{ x: 0, y: 1.5, w: 1.2, h: 1.2 }],
      wallMaterial
    )
    rightWall.position.set(template.width / 2 + wallThickness / 2, wallHeight / 2, 0)
    rightWall.rotation.y = Math.PI / 2
    group.add(rightWall)

    return group
  }

  private createWallWithOpenings(
    width: number, height: number, thickness: number,
    openings: { x: number; y: number; w: number; h: number }[],
    material: THREE.Material
  ): THREE.Mesh {
    // Use CSG-like approach: create wall sections around openings
    const group = new THREE.Group()

    // Sort openings by y position
    openings.sort((a, b) => a.y - b.y)

    let lastY = 0

    for (const opening of openings) {
      // Wall below opening
      if (opening.y > lastY) {
        const h = opening.y - lastY
        const geom = new THREE.BoxGeometry(width, h, thickness)
        const mesh = new THREE.Mesh(geom, material)
        mesh.position.y = lastY + h / 2
        group.add(mesh)
      }

      // Wall above opening (left side)
      if (opening.x - opening.w / 2 > -width / 2) {
        const w = opening.x - opening.w / 2 + width / 2
        const geom = new THREE.BoxGeometry(w, opening.h, thickness)
        const mesh = new THREE.Mesh(geom, material)
        mesh.position.set(-width / 2 + w / 2, opening.y + opening.h / 2, 0)
        group.add(mesh)
      }

      // Wall above opening (right side)
      if (opening.x + opening.w / 2 < width / 2) {
        const w = width / 2 - (opening.x + opening.w / 2)
        const geom = new THREE.BoxGeometry(w, opening.h, thickness)
        const mesh = new THREE.Mesh(geom, material)
        mesh.position.set(opening.x + opening.w / 2 + w / 2, opening.y + opening.h / 2, 0)
        group.add(mesh)
      }

      lastY = opening.y + opening.h
    }

    // Wall above last opening
    if (lastY < height) {
      const h = height - lastY
      const geom = new THREE.BoxGeometry(width, h, thickness)
      const mesh = new THREE.Mesh(geom, material)
      mesh.position.y = lastY + h / 2
      group.add(mesh)
    }

    // Merge into single mesh
    const mergedGeometry = new THREE.BufferGeometry()
    const meshes: THREE.Mesh[] = []
    group.traverse(child => {
      if (child instanceof THREE.Mesh) meshes.push(child)
    })

    if (meshes.length === 1) return meshes[0]

    const merged = mergeGeometries(meshes.map(m => m.geometry), false)
    const mergedMesh = new THREE.Mesh(merged, material)
    mergedMesh.castShadow = true
    mergedMesh.receiveShadow = true
    return mergedMesh
  }

  private createRoof(template: HouseTemplate, rng: () => number): THREE.Group {
    const group = new THREE.Group()

    const roofMaterial = new THREE.MeshStandardMaterial({
      color: template.roofColor,
      roughness: 0.8,
      metalness: 0.1
    })

    const wallHeight = template.height - (template.roofType === 'pitched' ? 2 : 1)
    let roofHeight = 2 // default for pitched

    if (template.roofType === 'pitched') {
      // Simple gable roof
      roofHeight = 2
      const roofDepth = template.depth + 0.6
      const roofWidth = template.width + 0.6

      const shape = new THREE.Shape()
      shape.moveTo(-roofWidth / 2, 0)
      shape.lineTo(0, roofHeight)
      shape.lineTo(roofWidth / 2, 0)
      shape.lineTo(-roofWidth / 2, 0)

      const extrudeSettings = {
        depth: roofDepth,
        bevelEnabled: false
      }

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
      geometry.rotateX(-Math.PI / 2)
      geometry.translate(0, wallHeight + roofHeight / 2, 0)

      const mesh = new THREE.Mesh(geometry, roofMaterial)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    } else if (template.roofType === 'hipped') {
      // Hipped roof - four sloping sides
      roofHeight = 2.5
      const roofDepth = template.depth + 0.6
      const roofWidth = template.width + 0.6

      // Create as multiple planes
      const ridgeLength = roofWidth - roofDepth
      const halfDepth = roofDepth / 2
      const halfWidth = roofWidth / 2

      // Two trapezoidal ends
      for (let side = -1; side <= 1; side += 2) {
        const shape = new THREE.Shape()
        shape.moveTo(-halfWidth, -halfDepth)
        shape.lineTo(0, 0)
        shape.lineTo(halfWidth, -halfDepth)
        shape.lineTo(halfWidth, halfDepth)
        shape.lineTo(-halfWidth, halfDepth)

        const extrudeSettings = { depth: roofHeight, bevelEnabled: false }
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
        geometry.rotateX(-Math.PI / 2)
        geometry.translate(0, wallHeight + roofHeight / 2, side * ridgeLength / 2)

        const mesh = new THREE.Mesh(geometry, roofMaterial)
        mesh.castShadow = true
        group.add(mesh)
      }

      // Two triangular sides
      for (let side = -1; side <= 1; side += 2) {
        const shape = new THREE.Shape()
        shape.moveTo(-halfDepth, 0)
        shape.lineTo(0, roofHeight)
        shape.lineTo(halfDepth, 0)

        const extrudeSettings = { depth: ridgeLength, bevelEnabled: false }
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
        geometry.rotateX(-Math.PI / 2)
        geometry.rotateZ(Math.PI / 2)
        geometry.translate(side * (halfWidth + ridgeLength / 2), wallHeight + roofHeight / 2, 0)

        const mesh = new THREE.Mesh(geometry, roofMaterial)
        mesh.castShadow = true
        group.add(mesh)
      }
    } else if (template.roofType === 'thatched') {
      // Thatch - irregular, thicker
      roofHeight = 2.5
      const roofDepth = template.depth + 0.8
      const roofWidth = template.width + 0.8

      const shape = new THREE.Shape()
      shape.moveTo(-roofWidth / 2, 0)
      shape.lineTo(0, roofHeight * 1.2)
      shape.lineTo(roofWidth / 2, 0)
      shape.lineTo(-roofWidth / 2, 0)

      const extrudeSettings = { depth: roofDepth, bevelEnabled: false }
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
      geometry.rotateX(-Math.PI / 2)
      geometry.translate(0, wallHeight + roofHeight / 2, 0)

      // Add thickness variation with vertex displacement
      const positions = geometry.attributes.position
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i)
        if (y > wallHeight + roofHeight * 0.5) {
          positions.setY(i, y + (rng() - 0.5) * 0.1)
        }
      }
      geometry.computeVertexNormals()

      const mesh = new THREE.Mesh(geometry, roofMaterial)
      mesh.castShadow = true
      group.add(mesh)
    }

    // Chimney
    if (rng() < 0.7) {
      const chimney = this.createChimney(template, wallHeight, roofHeight, roofMaterial)
      group.add(chimney)
    }

    return group
  }

  private createChimney(template: HouseTemplate, wallHeight: number, roofHeight: number, material: THREE.Material): THREE.Mesh {
    const geom = new THREE.BoxGeometry(0.8, roofHeight + 1, 0.6)
    const mesh = new THREE.Mesh(geom, material)
    mesh.position.set(template.width / 2 - 1.2, wallHeight + roofHeight / 2 + 0.5, 0)
    mesh.castShadow = true
    return mesh
  }

  private createWindows(template: HouseTemplate, rng: () => number): THREE.Group {
    const group = new THREE.Group()
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    })
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.0
    })

    const wallHeight = template.height - (template.roofType === 'pitched' ? 2 : 1)
    const windowSize = template.windowStyle === 'bay' ? { w: 2, h: 1.5 } : { w: 1.2, h: 1.2 }
    const windowY = 1.5

    // Front windows
    for (const x of [-1.5, 1.5]) {
      const frame = new THREE.Group()
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(windowSize.w, windowSize.h),
        glassMaterial
      )
      glass.position.z = 0.01
      frame.add(glass)

      // Frame
      const frameGeom = new THREE.BoxGeometry(windowSize.w + 0.1, windowSize.h + 0.1, 0.1)
      const frameMesh = new THREE.Mesh(frameGeom, frameMaterial)
      frame.add(frameMesh)

      frame.position.set(x, windowY + windowSize.h / 2, template.depth / 2 + 0.16)
      group.add(frame)
    }

    // Side windows
    for (const z of [-2, 0, 2]) {
      const frame = new THREE.Group()
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(windowSize.w, windowSize.h),
        glassMaterial
      )
      glass.position.x = 0.01
      frame.add(glass)

      const frameGeom = new THREE.BoxGeometry(windowSize.w + 0.1, windowSize.h + 0.1, 0.1)
      const frameMesh = new THREE.Mesh(frameGeom, frameMaterial)
      frame.add(frameMesh)

      frame.position.set(-template.width / 2 - 0.16, windowY + windowSize.h / 2, z)
      frame.rotation.y = -Math.PI / 2
      group.add(frame)

      // Right side
      const frame2 = frame.clone()
      frame2.position.set(template.width / 2 + 0.16, windowY + windowSize.h / 2, z)
      frame2.rotation.y = Math.PI / 2
      group.add(frame2)
    }

    // Upper floor windows (if 2 floors)
    if (template.floors > 1) {
      const upperY = wallHeight / 2 + 1.5
      for (const x of [-1.5, 0, 1.5]) {
        const frame = new THREE.Group()
        const glass = new THREE.Mesh(
          new THREE.PlaneGeometry(windowSize.w * 0.8, windowSize.h * 0.8),
          glassMaterial
        )
        glass.position.z = 0.01
        frame.add(glass)

        const frameGeom = new THREE.BoxGeometry(windowSize.w * 0.8 + 0.1, windowSize.h * 0.8 + 0.1, 0.1)
        const frameMesh = new THREE.Mesh(frameGeom, frameMaterial)
        frame.add(frameMesh)

        frame.position.set(x, upperY, template.depth / 2 + 0.16)
        group.add(frame)
      }
    }

    return group
  }

  private createDoor(template: HouseTemplate, rng: () => number): THREE.Group {
    const group = new THREE.Group()

    const doorMaterial = new THREE.MeshStandardMaterial({
      color: template.doorStyle === 'composite' ? 0x2c3e50 : 0x8b4513,
      roughness: 0.4,
      metalness: 0.1
    })

    const doorGeom = new THREE.BoxGeometry(1, 2.1, 0.05)
    const doorMesh = new THREE.Mesh(doorGeom, doorMaterial)
    doorMesh.position.set(0, 1.05, template.depth / 2 + 0.18)
    doorMesh.castShadow = true
    group.add(doorMesh)

    // Door frame
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    const frameGeom = new THREE.BoxGeometry(1.15, 2.25, 0.1)
    const frameMesh = new THREE.Mesh(frameGeom, frameMaterial)
    frameMesh.position.set(0, 1.125, template.depth / 2 + 0.13)
    group.add(frameMesh)

    // Porch canopy
    if (rng() < 0.5) {
      const canopyGeom = new THREE.BoxGeometry(1.5, 0.1, 1)
      const canopyMesh = new THREE.Mesh(canopyGeom, new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 }))
      canopyMesh.position.set(0, 2.2, template.depth / 2 + 0.6)
      canopyMesh.castShadow = true
      group.add(canopyMesh)
    }

    return group
  }

  private createDetails(template: HouseTemplate, rng: () => number): THREE.Group {
    const group = new THREE.Group()

    // Gutters and downpipes
    const gutterMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 })

    // Front gutter
    const gutterGeom = new THREE.BoxGeometry(template.width + 0.4, 0.1, 0.1)
    const frontGutter = new THREE.Mesh(gutterGeom, gutterMaterial)
    frontGutter.position.set(0, template.height - 2, template.depth / 2 + 0.3)
    group.add(frontGutter)

    // Downpipes
    for (const x of [-template.width / 2 + 0.5, template.width / 2 - 0.5]) {
      const pipeGeom = new THREE.CylinderGeometry(0.05, 0.05, template.height - 2.5)
      const pipe = new THREE.Mesh(pipeGeom, gutterMaterial)
      pipe.position.set(x, template.height / 2, template.depth / 2 + 0.3)
      group.add(pipe)
    }

    return group
  }

  private createExteriorArea(template: HouseTemplate, house: HouseInstance, rng: () => number): THREE.Group {
    const group = new THREE.Group()

    // Driveway
    const driveGeom = new THREE.PlaneGeometry(3, template.depth + 5)
    const driveMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.9 })
    const drive = new THREE.Mesh(driveGeom, driveMat)
    drive.rotation.x = -Math.PI / 2
    drive.position.set(0, 0.01, -2.5)
    drive.receiveShadow = true
    group.add(drive)

    // Grass
    const grassGeom = new THREE.PlaneGeometry(template.width + 4, template.depth + 4)
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a7c2e, roughness: 1.0 })
    const grass = new THREE.Mesh(grassGeom, grassMat)
    grass.rotation.x = -Math.PI / 2
    grass.position.y = 0.005
    grass.receiveShadow = true
    group.add(grass)

    // Flower beds
    if (rng() < 0.6) {
      for (const side of [-1, 1]) {
        const bedGeom = new THREE.BoxGeometry(0.8, 0.3, template.depth * 0.6)
        const bedMat = new THREE.MeshStandardMaterial({ color: 0x3a5a2e, roughness: 0.9 })
        const bed = new THREE.Mesh(bedGeom, bedMat)
        bed.position.set(side * (template.width / 2 + 0.4), 0.15, 0)
        group.add(bed)
      }
    }

    // Wheelie bin
    if (rng() < 0.8) {
      const bin = this.createWheelieBin(rng)
      bin.position.set((rng() - 0.5) * template.width * 0.5, 0, template.depth / 2 + 2)
      group.add(bin)
    }

    return group
  }

  private createWheelieBin(rng: () => number): THREE.Group {
    const colors = [0x228b22, 0x1a5c1a, 0x006400, 0x8b4513]
    const bodyGeom = new THREE.CylinderGeometry(0.25, 0.3, 0.6, 8)
    const lidGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 8)

    const bodyMat = new THREE.MeshStandardMaterial({ color: colors[Math.floor(rng() * colors.length)], roughness: 0.7 })
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 })

    const group = new THREE.Group()
    const body = new THREE.Mesh(bodyGeom, bodyMat)
    body.position.y = 0.3
    body.castShadow = true
    group.add(body)

    const lid = new THREE.Mesh(lidGeom, lidMat)
    lid.position.y = 0.64
    group.add(lid)

    return group
  }

  private createInteriorFloor(template: HouseTemplate, rng: () => number): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(template.width - 0.6, template.depth - 0.6)
    const mat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.85, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geom, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.01
    mesh.receiveShadow = true
    return mesh
  }

  private createCeiling(template: HouseTemplate, rng: () => number): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(template.width - 0.6, template.depth - 0.6)
    const mat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.95, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geom, mat)
    mesh.rotation.x = Math.PI / 2
    mesh.position.y = template.floors > 1 ? 3 : 2.5
    return mesh
  }

  private createInteriorWalls(template: HouseTemplate, rng: () => number): THREE.Group {
    const group = new THREE.Group()
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.9, side: THREE.DoubleSide })
    const height = template.floors > 1 ? 3 : 2.5
    const thickness = 0.15

    // Four walls
    const walls = [
      { w: template.width - 0.6, d: thickness, pos: new THREE.Vector3(0, height / 2, -(template.depth - 0.6) / 2) },
      { w: template.width - 0.6, d: thickness, pos: new THREE.Vector3(0, height / 2, (template.depth - 0.6) / 2) },
      { w: thickness, d: template.depth - 0.6, pos: new THREE.Vector3(-(template.width - 0.6) / 2, height / 2, 0) },
      { w: thickness, d: template.depth - 0.6, pos: new THREE.Vector3((template.width - 0.6) / 2, height / 2, 0) }
    ]

    for (const wall of walls) {
      const geom = new THREE.BoxGeometry(wall.w, height, wall.d)
      const mesh = new THREE.Mesh(geom, wallMat)
      mesh.position.copy(wall.pos)
      mesh.receiveShadow = true
      group.add(mesh)
    }

    return group
  }

  private createRoomDivisions(template: HouseTemplate, rng: () => number): THREE.Group {
    const group = new THREE.Group()
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.9, side: THREE.DoubleSide })
    const height = template.floors > 1 ? 3 : 2.5
    const thickness = 0.1

    // Add some internal walls based on template
    if (template.name === 'terraced' || template.name === 'semi_detached') {
      // Central dividing wall
      const geom = new THREE.BoxGeometry(thickness, height, template.depth * 0.6)
      const mesh = new THREE.Mesh(geom, wallMat)
      mesh.position.set(0, height / 2, -template.depth * 0.1)
      group.add(mesh)
    }

    return group
  }

  private createStairs(template: HouseTemplate, rng: () => number): THREE.Group {
    const group = new THREE.Group()
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 })
    const stepCount = 12
    const stepHeight = 2.5 / stepCount
    const stepDepth = 0.25
    const stepWidth = 0.9

    for (let i = 0; i < stepCount; i++) {
      const geom = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth)
      const mesh = new THREE.Mesh(geom, stepMat)
      mesh.position.set(-template.width / 2 + 1.5, i * stepHeight + stepHeight / 2, -template.depth / 2 + 1.5 + i * stepDepth)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
    }

    return group
  }

  private createLODMeshes(houseGroup: THREE.Group, template: HouseTemplate, house: HouseInstance): void {
    // Create simplified LOD meshes for distance rendering
    // LOD1: Simplified geometry (no windows/door details)
    // LOD2: Imposter (billboard)

    // For now, just add LOD levels to the main group
    const lod = new THREE.LOD()

    // Level 0: Full detail (0-50m)
    lod.addLevel(houseGroup, 50)

    // Level 1: Simplified (50-150m)
    const simplified = this.createSimplifiedMesh(template, house)
    lod.addLevel(simplified, 150)

    // Level 2: Imposter (150-500m)
    const imposter = this.createImposterMesh(template, house)
    lod.addLevel(imposter, 500)

    // Replace in scene
    this.sceneManager.scene.remove(houseGroup)
    lod.position.copy(houseGroup.position)
    lod.rotation.copy(houseGroup.rotation)
    lod.name = houseGroup.name
    this.sceneManager.scene.add(lod)
    this.houseMeshes.set(house.id, lod as any)
  }

  private createSimplifiedMesh(template: HouseTemplate, house: HouseInstance): THREE.Mesh {
    // Simple box representation
    const geom = new THREE.BoxGeometry(template.width, template.height, template.depth)
    const mat = new THREE.MeshStandardMaterial({
      color: template.brickColor,
      roughness: 0.9
    })
    const mesh = new THREE.Mesh(geom, mat)
    mesh.position.y = template.height / 2
    return mesh
  }

  private createImposterMesh(template: HouseTemplate, house: HouseInstance): THREE.Mesh {
    // Billboard - always faces camera
    const geom = new THREE.PlaneGeometry(template.width, template.height)
    const mat = new THREE.MeshBasicMaterial({
      color: template.brickColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(geom, mat)
    mesh.position.y = template.height / 2
    return mesh
  }

  setLOD(house: HouseInstance, level: number): void {
    const group = this.houseMeshes.get(house.id)
    if (group && group instanceof THREE.LOD) {
      group.levels.forEach((l, i) => {
        l.object.visible = i === level
      })
    }
  }

  disposeHouse(house: HouseInstance): void {
    const exterior = this.houseMeshes.get(house.id)
    if (exterior) {
      this.sceneManager.scene.remove(exterior)
      this.disposeGroup(exterior)
      this.houseMeshes.delete(house.id)
    }

    const interior = this.interiorMeshes.get(house.id)
    if (interior) {
      this.sceneManager.scene.remove(interior)
      this.disposeGroup(interior)
      this.interiorMeshes.delete(house.id)
    }
  }

  private disposeGroup(group: THREE.Object3D): void {
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }

  private createRNG(seed: number): () => number {
    // Mulberry32
    let state = seed >>> 0
    return () => {
      state += 0x6D2B79F5
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
}

interface HouseTemplate {
  name: string
  width: number
  depth: number
  height: number
  floors: number
  roofType: 'pitched' | 'hipped' | 'thatched' | 'flat'
  windowStyle: 'sash' | 'casement' | 'bay' | 'diamond'
  doorStyle: 'panel' | 'upvc' | 'composite' | 'stable'
  brickColor: number
  roofColor: number
  roomLayout: string
}