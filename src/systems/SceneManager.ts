import * as THREE from 'three'
import { Room } from './Room.js'
import { FurnitureManager } from './FurnitureManager.js'
import { CameraController } from './CameraController.js'

export class SceneManager {
  public scene!: THREE.Scene
  public camera!: THREE.PerspectiveCamera
  public cameraController!: CameraController
  public room!: Room
  public furnitureManager!: FurnitureManager

  private renderer: THREE.WebGLRenderer
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
  }

  async init(): Promise<void> {
    this.createScene()
    this.createCamera()
    this.createLighting()
    this.room = new Room(this.scene)
    await this.room.init()
    this.furnitureManager = new FurnitureManager(this.scene)
    await this.furnitureManager.init()
  }

  private createScene(): void {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0d0d10)
    this.scene.fog = new THREE.Fog(0x0d0d10, 8, 25)
  }

  private createCamera(): void {
    this.cameraController = new CameraController(this.renderer)
    this.camera = this.cameraController.camera
  }

  private createLighting(): void {
    // Dark ambient for mood
    const ambient = new THREE.AmbientLight(0x222233, 0.12)
    this.scene.add(ambient)

    // Main sun - warm, directional
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.0)
    sun.position.set(8, 18, 10)
    sun.castShadow = true
    sun.shadow.mapSize.width = 4096
    sun.shadow.mapSize.height = 4096
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 50
    sun.shadow.camera.left = -20
    sun.shadow.camera.right = 20
    sun.shadow.camera.top = 20
    sun.shadow.camera.bottom = -20
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.03
    this.scene.add(sun)

    // Cool fill from window (north-facing)
    const windowLight = new THREE.DirectionalLight(0x88aacc, 0.5)
    windowLight.position.set(-5, 6, -15)
    windowLight.castShadow = false
    this.scene.add(windowLight)

    // Rim/backlight for shape
    const rim = new THREE.DirectionalLight(0xffddaa, 0.15)
    rim.position.set(0, 8, -15)
    this.scene.add(rim)

    // Room-specific point lights for interior atmosphere
    const roomLights: Array<{ pos: THREE.Vector3; color: number; intensity: number; dist: number; decay: number }> = [
      // Entrance hall
      { pos: new THREE.Vector3(0, 2.5, 6), color: 0xffeecc, intensity: 0.6, dist: 8, decay: 2 },
      // Living room
      { pos: new THREE.Vector3(0, 2.5, 0), color: 0xffddaa, intensity: 0.5, dist: 10, decay: 2 },
      // Kitchen
      { pos: new THREE.Vector3(5.5, 2.5, 6), color: 0xffffee, intensity: 0.7, dist: 6, decay: 2 },
      // Dining
      { pos: new THREE.Vector3(5.5, 2.5, 0), color: 0xffccaa, intensity: 0.4, dist: 8, decay: 2 },
      // Master bedroom
      { pos: new THREE.Vector3(-6, 2.5, 6), color: 0xffeeee, intensity: 0.3, dist: 8, decay: 2 },
      // Bathroom
      { pos: new THREE.Vector3(-1, 2.5, 6), color: 0xaaeeff, intensity: 0.5, dist: 5, decay: 2 },
      // Study
      { pos: new THREE.Vector3(-6, 2.5, 0), color: 0xffdd99, intensity: 0.4, dist: 6, decay: 2 },
      // Bedroom 2
      { pos: new THREE.Vector3(-6, 2.5, -5), color: 0xffeeee, intensity: 0.3, dist: 6, decay: 2 },
    ]

    roomLights.forEach(lightData => {
      const light = new THREE.PointLight(lightData.color, lightData.intensity, lightData.dist, lightData.decay)
      light.position.copy(lightData.pos)
      light.castShadow = false // Point light shadows are expensive
      this.scene.add(light)
    })
  }

  onResize(width: number, height: number): void {
    this.cameraController.onResize(width, height)
  }

  update(delta: number): void {
    this.cameraController.update(delta)
    this.room.update(delta)
    this.furnitureManager.update(delta)
  }

  // Raycasting helpers
  setMouseFromEvent(event: MouseEvent): void {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  }

  raycast(objects: THREE.Object3D[]): THREE.Intersection[] {
    this.raycaster.setFromCamera(this.mouse, this.camera)
    return this.raycaster.intersectObjects(objects, true)
  }

  raycastFirst(objects: THREE.Object3D[]): THREE.Intersection | null {
    const hits = this.raycast(objects)
    return hits.length > 0 ? hits[0] : null
  }

  getRaycaster(): THREE.Raycaster {
    return this.raycaster
  }

  // Camera controller accessors
  getCameraPosition(): THREE.Vector3 {
    return this.cameraController.getCameraPosition()
  }

  getCameraDirection(): THREE.Vector3 {
    return this.cameraController.getCameraDirection()
  }

  addHitPause(duration: number): void {
    this.cameraController.addHitPause(duration)
  }

  addScreenShake(intensity: number, decay?: number): void {
    this.cameraController.addScreenShake(intensity, decay)
  }

  addLean(amount: number): void {
    this.cameraController.addLean(amount)
  }

  isPointerLocked(): boolean {
    return this.cameraController.isPointerLocked()
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer
  }
}