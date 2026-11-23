import * as THREE from 'three';
import { Room } from './Room.js';
import { FurnitureManager } from './FurnitureManager.js';
import { CameraController } from './CameraController.js';
import { DEVICE } from './DeviceProfile.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class SceneManager {
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public cameraController!: CameraController;
  public room!: Room;
  public furnitureManager!: FurnitureManager;

  private renderer: THREE.WebGLRenderer;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
  }

  async init(): Promise<void> {
    this.createScene();
    this.createCamera();
    // Apply the aspect-dependent field of view immediately, so a phone that
    // loads in portrait never has to wait for a rotation to get a usable view.
    this.onResize(window.innerWidth, window.innerHeight);
    this.createLighting();
    this.room = new Room(this.scene);
    await this.room.init();
    this.furnitureManager = new FurnitureManager(this.scene);
    await this.furnitureManager.init();
  }

  private createScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0d10);
    this.scene.fog = new THREE.Fog(0x0d0d10, 8, 25);

    // Metals have nothing to reflect without an environment, so chrome taps and
    // steel appliances rendered pure black. A small room probe fixes it; the
    // intensity is kept low so the house stays moody rather than showroom-bright.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = environment.texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();
  }

  private createCamera(): void {
    this.cameraController = new CameraController(this.renderer);
    this.camera = this.cameraController.camera;
  }

  private createLighting(): void {
    // Dark ambient for mood
    const ambient = new THREE.AmbientLight(0x2a2a33, 0.4);
    this.scene.add(ambient);

    // Main sun - warm, directional
    const sun = new THREE.DirectionalLight(0xfff0d8, 0.7);
    sun.position.set(8, 18, 10);
    // Phones get no shadows at all; 4K shadow maps wreck mobile GPUs.
    sun.castShadow = DEVICE.enableShadows;
    sun.shadow.mapSize.width = DEVICE.shadowMapSize;
    sun.shadow.mapSize.height = DEVICE.shadowMapSize;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);

    // Cool fill from window (north-facing)
    const windowLight = new THREE.DirectionalLight(0x88aacc, 0.2);
    windowLight.position.set(-5, 6, -15);
    windowLight.castShadow = false;
    this.scene.add(windowLight);

    // Rim/backlight for shape
    const rim = new THREE.DirectionalLight(0xffddaa, 0.1);
    rim.position.set(0, 8, -15);
    this.scene.add(rim);

    // Room-specific point lights for interior atmosphere.
    // These are physical (candela) values: with decay 2 a 0.5 lights the floor by
    // 0.5 / distance², which is invisible, so the interior rendered pitch black.
    const roomLights: {
      pos: THREE.Vector3;
      color: number;
      intensity: number;
      dist: number;
      decay: number;
    }[] = [
      // Entrance hall
      { pos: new THREE.Vector3(0, 2.5, 6), color: 0xffeecc, intensity: 8, dist: 8, decay: 2 },
      // Living room
      { pos: new THREE.Vector3(0, 2.5, 0), color: 0xffddaa, intensity: 7, dist: 10, decay: 2 },
      // Kitchen
      { pos: new THREE.Vector3(5.5, 2.5, 6), color: 0xffffee, intensity: 9, dist: 6, decay: 2 },
      // Dining
      { pos: new THREE.Vector3(5.5, 2.5, 0), color: 0xffccaa, intensity: 4, dist: 8, decay: 2 },
      // Master bedroom
      { pos: new THREE.Vector3(-6, 2.5, 6), color: 0xffeeee, intensity: 3, dist: 8, decay: 2 },
      // Bathroom
      { pos: new THREE.Vector3(-1, 2.5, 6), color: 0xaaeeff, intensity: 5, dist: 5, decay: 2 },
      // Study
      { pos: new THREE.Vector3(-6, 2.5, 0), color: 0xffdd99, intensity: 4, dist: 6, decay: 2 },
      // Bedroom 2
      { pos: new THREE.Vector3(-6, 2.5, -5), color: 0xffeeee, intensity: 3, dist: 6, decay: 2 },
    ];

    roomLights.forEach(lightData => {
      const light = new THREE.PointLight(
        lightData.color,
        lightData.intensity,
        lightData.dist,
        lightData.decay
      );
      light.position.copy(lightData.pos);
      light.castShadow = false; // Point light shadows are expensive
      this.scene.add(light);
    });
  }

  onResize(width: number, height: number): void {
    this.cameraController.onResize(width, height);
  }

  update(delta: number): void {
    this.cameraController.update(delta);
    this.room.update(delta);
    this.furnitureManager.update(delta);
  }

  // Raycasting helpers
  setMouseFromEvent(event: MouseEvent): void {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  raycast(objects: THREE.Object3D[]): THREE.Intersection[] {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(objects, true);
  }

  raycastFirst(objects: THREE.Object3D[]): THREE.Intersection | null {
    const hits = this.raycast(objects);
    return hits.length > 0 ? hits[0] : null;
  }

  getRaycaster(): THREE.Raycaster {
    return this.raycaster;
  }

  /** Normalised device coordinates of the pointer, updated by setMouseFromEvent(). */
  getMouse(): THREE.Vector2 {
    return this.mouse;
  }

  // Camera controller accessors
  getCameraPosition(): THREE.Vector3 {
    return this.cameraController.getCameraPosition();
  }

  getCameraDirection(): THREE.Vector3 {
    return this.cameraController.getCameraDirection();
  }

  addHitPause(duration: number): void {
    this.cameraController.addHitPause(duration);
  }

  addScreenShake(intensity: number, decay?: number): void {
    this.cameraController.addScreenShake(intensity, decay);
  }

  addLean(amount: number): void {
    this.cameraController.addLean(amount);
  }

  isPointerLocked(): boolean {
    return this.cameraController.isPointerLocked();
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }
}
