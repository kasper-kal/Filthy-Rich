import * as THREE from 'three';
import type { VehiclePhysics } from './VehiclePhysics.js';
import type { VehicleSpecsData } from './VehicleSpecs.js';

// ============================================
// CAMERA MODES
// ============================================

export type CameraMode = 'chase' | 'hood' | 'dashboard' | 'cinematic' | 'orbit' | 'rear' | 'top';

export interface CameraConfig {
  // Chase camera (default)
  chase: {
    distance: number;
    height: number;
    lookAhead: number;
    lookAheadSpeed: number;
    pitch: number;
    yaw: number;
    stiffness: number;
    damping: number;
    fov: number;
    fovSpeed: number;
    minFOV: number;
    maxFOV: number;
    collisionRadius: number;
    collisionOffset: number;
  };

  // Hood camera
  hood: {
    offset: THREE.Vector3;
    lookAhead: number;
    pitch: number;
    stiffness: number;
    damping: number;
    fov: number;
  };

  // Dashboard camera
  dashboard: {
    offset: THREE.Vector3;
    pitch: number;
    fov: number;
    headMovement: number;
    stiffness: number;
    damping: number;
  };

  // Cinematic camera
  cinematic: {
    distance: number;
    height: number;
    angle: number;
    stiffness: number;
    damping: number;
    fov: number;
  };

  // Rear camera
  rear: {
    distance: number;
    height: number;
    lookAhead: number;
    stiffness: number;
    damping: number;
    fov: number;
  };

  // Top down camera
  top: {
    height: number;
    lookAhead: number;
    stiffness: number;
    damping: number;
    fov: number;
  };

  // General
  shake: {
    intensity: number;
    frequency: number;
    decay: number;
    maxOffset: number;
    maxRotation: number;
  };
  transition: {
    duration: number;
    easing: (t: number) => number;
  };
}

const DEFAULT_CONFIG: CameraConfig = {
  chase: {
    distance: 8,
    height: 3,
    lookAhead: 10,
    lookAheadSpeed: 0.1,
    pitch: -0.2,
    yaw: 0,
    stiffness: 5,
    damping: 0.8,
    fov: 70,
    fovSpeed: 0.0005,
    minFOV: 50,
    maxFOV: 90,
    collisionRadius: 0.3,
    collisionOffset: 0.5,
  },
  hood: {
    offset: new THREE.Vector3(0, 1.2, 2.5),
    lookAhead: 15,
    pitch: -0.1,
    stiffness: 8,
    damping: 0.9,
    fov: 75,
  },
  dashboard: {
    offset: new THREE.Vector3(0, 1.1, 0.5),
    pitch: 0,
    fov: 80,
    headMovement: 0.1,
    stiffness: 10,
    damping: 0.9,
  },
  cinematic: {
    distance: 15,
    height: 5,
    angle: Math.PI / 6,
    stiffness: 3,
    damping: 0.7,
    fov: 60,
  },
  rear: {
    distance: 10,
    height: 2.5,
    lookAhead: 5,
    stiffness: 6,
    damping: 0.85,
    fov: 70,
  },
  top: {
    height: 30,
    lookAhead: 20,
    stiffness: 10,
    damping: 0.95,
    fov: 60,
  },
  shake: {
    intensity: 0,
    frequency: 0,
    decay: 1,
    maxOffset: 0.5,
    maxRotation: 0.05,
  },
  transition: {
    duration: 0.5,
    easing: (t: number) => t * t * (3 - 2 * t), // smoothstep
  },
};

// ============================================
// VEHICLE CAMERA
// ============================================

export class VehicleCamera {
  private physics: VehiclePhysics;
  private specs: VehicleSpecsData;
  private config: CameraConfig;
  private camera: THREE.PerspectiveCamera;

  // Current mode
  private currentMode: CameraMode = 'chase';
  private targetMode: CameraMode = 'chase';
  private transitionProgress = 1;
  private transitionStartMode: CameraMode = 'chase';

  // Camera state
  private position = new THREE.Vector3();
  private target = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private velocity = new THREE.Vector3();

  // Chase camera specific
  private chaseYaw = 0;
  private chasePitch = -0.2;
  private chaseDistance = 8;
  private targetChaseYaw = 0;
  private targetChasePitch = -0.2;
  private targetChaseDistance = 8;

  // Look-ahead
  private lookAheadPosition = new THREE.Vector3();
  private lookAheadVelocity = new THREE.Vector3();

  // Shake
  private shakeOffset = new THREE.Vector3();
  private shakeRotation = new THREE.Euler();
  private shakeTrauma = 0;
  private shakeSeed = Math.random() * 1000;

  // Orbit camera
  private orbitAngle = 0;
  private orbitDistance = 10;
  private orbitHeight = 5;

  // Collision detection
  private raycaster = new THREE.Raycaster();
  private collisionLayers: THREE.Layers;

  // Input
  private orbitInput = { x: 0, y: 0, zoom: 0 };

  // Callbacks
  onModeChange?: (mode: CameraMode) => void;
  onCollision?: (distance: number) => void;

  constructor(
    physics: VehiclePhysics,
    specs: VehicleSpecsData,
    camera: THREE.PerspectiveCamera,
    config?: Partial<CameraConfig>
  ) {
    this.physics = physics;
    this.specs = specs;
    this.camera = camera;
    this.config = this.deepMerge(DEFAULT_CONFIG, config || {});

    // Initialize chase distance from config
    this.chaseDistance = this.config.chase.distance;
    this.targetChaseDistance = this.config.chase.distance;
    this.chasePitch = this.config.chase.pitch;
    this.targetChasePitch = this.config.chase.pitch;

    // Setup collision layers (exclude vehicle)
    this.collisionLayers = new THREE.Layers();
    this.collisionLayers.enable(1); // Layer 1 for environment
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /**
   * Main update - call every frame
   */
  update(deltaTime: number): void {
    // Update transition
    if (this.transitionProgress < 1) {
      this.transitionProgress += deltaTime / this.config.transition.duration;
      if (this.transitionProgress >= 1) {
        this.transitionProgress = 1;
        this.currentMode = this.targetMode;
      }
    }

    // Update camera based on mode
    switch (this.currentMode) {
      case 'chase':
        this.updateChaseCamera(deltaTime);
        break;
      case 'hood':
        this.updateHoodCamera(deltaTime);
        break;
      case 'dashboard':
        this.updateDashboardCamera(deltaTime);
        break;
      case 'cinematic':
        this.updateCinematicCamera(deltaTime);
        break;
      case 'rear':
        this.updateRearCamera(deltaTime);
        break;
      case 'top':
        this.updateTopCamera(deltaTime);
        break;
      case 'orbit':
        this.updateOrbitCamera(deltaTime);
        break;
    }

    // Apply shake
    this.updateShake(deltaTime);

    // Apply to Three.js camera
    this.camera.position.lerp(this.position, 0.1); // Small lerp for extra smoothness
    this.camera.lookAt(this.target);
    this.camera.up.lerp(this.up, 0.1);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.getCurrentFOV(), deltaTime * 5);
    this.camera.updateProjectionMatrix();
  }

  // ============================================
  // CAMERA MODE UPDATES
  // ============================================

  private updateChaseCamera(deltaTime: number): void {
    const c = this.config.chase;
    const chassisPos = this.physics.getChassisPosition();
    const chassisRot = this.physics.getChassisRotation();
    const speed = this.physics.getSpeedMS();
    const velocity = this.physics.getVelocity();

    // Calculate target yaw (follow vehicle rotation + mouse input)
    const vehicleYaw = chassisRot.y;
    this.targetChaseYaw = vehicleYaw;

    // Smooth yaw
    this.chaseYaw = THREE.MathUtils.lerp(
      this.chaseYaw,
      this.targetChaseYaw,
      deltaTime * c.stiffness
    );

    // Calculate target pitch based on speed
    this.targetChasePitch = c.pitch - Math.atan(speed * c.lookAheadSpeed) * 0.3;
    this.chasePitch = THREE.MathUtils.lerp(
      this.chasePitch,
      this.targetChasePitch,
      deltaTime * c.stiffness
    );

    // Calculate target distance based on speed (zoom out at speed)
    this.targetChaseDistance = c.distance + speed * 0.05;
    this.chaseDistance = THREE.MathUtils.lerp(
      this.chaseDistance,
      this.targetChaseDistance,
      deltaTime * c.stiffness
    );

    // Calculate ideal camera position
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.chaseYaw
    );
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      this.chasePitch
    );
    const offsetQuat = new THREE.Quaternion().multiplyQuaternions(yawQuat, pitchQuat);

    const offset = new THREE.Vector3(0, c.height, this.chaseDistance).applyQuaternion(offsetQuat);
    const idealPosition = chassisPos.clone().add(offset);

    // Look-ahead target
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawQuat);
    this.lookAheadPosition.copy(chassisPos).add(forward.multiplyScalar(c.lookAhead + speed * 0.2));
    this.lookAheadPosition.y += c.height * 0.5;

    // Spring-damper for smooth camera movement
    const toIdeal = new THREE.Vector3().subVectors(idealPosition, this.position);
    const springForce = toIdeal.multiplyScalar(c.stiffness);
    const dampingForce = this.velocity.clone().multiplyScalar(-c.damping);
    const acceleration = springForce.add(dampingForce);

    this.velocity.add(acceleration.multiplyScalar(deltaTime));
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // Collision detection - push camera forward if obstructed
    this.checkCameraCollision(chassisPos, idealPosition);

    // Target is look-ahead position
    this.target.lerp(this.lookAheadPosition, deltaTime * 5);

    // Up vector follows vehicle roll slightly
    const rollFactor = 0.3;
    this.up
      .set(
        -Math.sin(chassisRot.z) * rollFactor,
        Math.cos(chassisRot.z) * rollFactor + (1 - rollFactor),
        0
      )
      .normalize();
  }

  private updateHoodCamera(deltaTime: number): void {
    const c = this.config.hood;
    const chassisPos = this.physics.getChassisPosition();
    const chassisRot = this.physics.getChassisRotation();

    // Fixed offset from vehicle
    const offset = c.offset.clone().applyQuaternion(chassisRot);
    const idealPosition = chassisPos.clone().add(offset);

    // Look ahead
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(chassisRot);
    const lookAt = chassisPos.clone().add(forward.multiplyScalar(c.lookAhead));
    lookAt.y += c.offset.y;

    // Spring-damper
    const toIdeal = new THREE.Vector3().subVectors(idealPosition, this.position);
    const springForce = toIdeal.multiplyScalar(c.stiffness);
    const dampingForce = this.velocity.clone().multiplyScalar(-c.damping);
    const acceleration = springForce.add(dampingForce);

    this.velocity.add(acceleration.multiplyScalar(deltaTime));
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    this.target.lerp(lookAt, deltaTime * 5);
    this.up
      .copy(chassisRot)
      .applyQuaternion(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.pitch)
      );
    this.up.applyQuaternion(chassisRot).normalize();
  }

  private updateDashboardCamera(deltaTime: number): void {
    const c = this.config.dashboard;
    const chassisPos = this.physics.getChassisPosition();
    const chassisRot = this.physics.getChassisRotation();
    const speed = this.physics.getSpeedMS();
    const lateralG = this.physics.getLateralG();

    // Fixed offset from vehicle (driver's head position)
    const offset = c.offset.clone().applyQuaternion(chassisRot);
    const idealPosition = chassisPos.clone().add(offset);

    // Head movement (lean in corners, bounce on bumps)
    const leanAngle = -lateralG * 0.15 * c.headMovement;
    const bounce = Math.sin(Date.now() * 0.01) * 0.01 * (speed / 30) * c.headMovement;

    const headOffset = new THREE.Vector3(Math.sin(leanAngle) * 0.1, bounce, 0).applyQuaternion(
      chassisRot
    );

    this.position.lerp(idealPosition.clone().add(headOffset), deltaTime * c.stiffness);

    // Look direction (slightly turned with steering)
    const steeringAngle = this.physics.getSteeringAngle();
    const lookDir = new THREE.Vector3(Math.sin(steeringAngle * 0.5), 0, -1).applyQuaternion(
      chassisRot
    );

    this.target.copy(this.position).add(lookDir.multiplyScalar(10));
    this.target.y += Math.tan(c.pitch) * 10;

    this.up
      .copy(chassisRot)
      .applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.pitch))
      .normalize();
  }

  private updateCinematicCamera(deltaTime: number): void {
    const c = this.config.cinematic;
    const chassisPos = this.physics.getChassisPosition();
    const chassisRot = this.physics.getChassisRotation();
    const velocity = this.physics.getVelocity();
    const speed = velocity.length();

    // Position at fixed angle to velocity vector
    const velDir =
      speed > 0.1
        ? velocity.clone().normalize()
        : new THREE.Vector3(0, 0, -1).applyQuaternion(chassisRot);
    const sideDir = new THREE.Vector3(-velDir.z, 0, velDir.x);

    const angle = c.angle + Math.sin(Date.now() * 0.0005) * 0.2; // Slow orbit
    const offset = sideDir
      .clone()
      .multiplyScalar(Math.sin(angle) * c.distance)
      .add(new THREE.Vector3(0, c.height, 0))
      .add(velDir.clone().multiplyScalar(-Math.cos(angle) * c.distance));

    const idealPosition = chassisPos.clone().add(offset);

    // Spring-damper
    const toIdeal = new THREE.Vector3().subVectors(idealPosition, this.position);
    const springForce = toIdeal.multiplyScalar(c.stiffness);
    const dampingForce = this.velocity.clone().multiplyScalar(-c.damping);
    const acceleration = springForce.add(dampingForce);

    this.velocity.add(acceleration.multiplyScalar(deltaTime));
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // Look at vehicle
    this.target.lerp(chassisPos.clone().setY(chassisPos.y + 1), deltaTime * 3);
    this.up.set(0, 1, 0);
  }

  private updateRearCamera(deltaTime: number): void {
    const c = this.config.rear;
    const chassisPos = this.physics.getChassisPosition();
    const chassisRot = this.physics.getChassisRotation();

    // Behind vehicle
    const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(chassisRot);
    const offset = backward.multiplyScalar(c.distance).add(new THREE.Vector3(0, c.height, 0));

    const idealPosition = chassisPos.clone().add(offset);

    // Look back along road
    const lookAt = chassisPos.clone().add(backward.multiplyScalar(c.lookAhead));
    lookAt.y += c.height * 0.5;

    // Spring-damper
    const toIdeal = new THREE.Vector3().subVectors(idealPosition, this.position);
    const springForce = toIdeal.multiplyScalar(c.stiffness);
    const dampingForce = this.velocity.clone().multiplyScalar(-c.damping);
    const acceleration = springForce.add(dampingForce);

    this.velocity.add(acceleration.multiplyScalar(deltaTime));
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    this.target.lerp(lookAt, deltaTime * 5);
    this.up.set(0, 1, 0);
  }

  private updateTopCamera(deltaTime: number): void {
    const c = this.config.top;
    const chassisPos = this.physics.getChassisPosition();
    const velocity = this.physics.getVelocity();
    const speed = velocity.length();

    // Look ahead along velocity
    const lookAhead =
      speed > 1 ? velocity.clone().normalize().multiplyScalar(c.lookAhead) : new THREE.Vector3();
    const targetPos = chassisPos.clone().add(lookAhead);

    const idealPosition = targetPos.clone().setY(c.height);

    // Spring-damper
    const toIdeal = new THREE.Vector3().subVectors(idealPosition, this.position);
    const springForce = toIdeal.multiplyScalar(c.stiffness);
    const dampingForce = this.velocity.clone().multiplyScalar(-c.damping);
    const acceleration = springForce.add(dampingForce);

    this.velocity.add(acceleration.multiplyScalar(deltaTime));
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    this.target.copy(targetPos);
    this.up.set(0, 0, -1); // North up
  }

  private updateOrbitCamera(deltaTime: number): void {
    const chassisPos = this.physics.getChassisPosition();

    // Orbit around vehicle
    this.orbitAngle += this.orbitInput.x * deltaTime;

    const offset = new THREE.Vector3(
      Math.sin(this.orbitAngle) * this.orbitDistance,
      this.orbitHeight,
      Math.cos(this.orbitAngle) * this.orbitDistance
    );

    const idealPosition = chassisPos.clone().add(offset);

    this.position.lerp(idealPosition, deltaTime * 5);
    this.target.lerp(chassisPos, deltaTime * 5);
    this.up.set(0, 1, 0);
  }

  // ============================================
  // CAMERA COLLISION
  // ============================================

  private checkCameraCollision(chassisPos: THREE.Vector3, idealPosition: THREE.Vector3): void {
    const c = this.config.chase;
    const direction = new THREE.Vector3().subVectors(chassisPos, idealPosition).normalize();
    const distance = idealPosition.distanceTo(chassisPos);

    this.raycaster.set(idealPosition, direction);
    this.raycaster.far = distance + c.collisionOffset;
    this.raycaster.layers = this.collisionLayers;

    // Note: In real implementation, would check against scene objects
    // For now, simplified - would need scene reference
  }

  // ============================================
  // SHAKE SYSTEM
  // ============================================

  private updateShake(deltaTime: number): void {
    if (this.shakeTrauma <= 0) return;

    const c = this.config.shake;
    this.shakeTrauma = Math.max(0, this.shakeTrauma - c.decay * deltaTime);

    const trauma = this.shakeTrauma * this.shakeTrauma; // Quadratic falloff
    const intensity = trauma * c.intensity;

    // Perlin-like noise for shake
    const t = Date.now() * 0.001 * c.frequency + this.shakeSeed;

    this.shakeOffset.x = Math.sin(t * 1.3) * intensity * c.maxOffset;
    this.shakeOffset.y = Math.sin(t * 1.7) * intensity * c.maxOffset * 0.5;
    this.shakeOffset.z = Math.sin(t * 2.1) * intensity * c.maxOffset;

    this.shakeRotation.x = Math.sin(t * 0.9) * intensity * c.maxRotation;
    this.shakeRotation.y = Math.sin(t * 1.1) * intensity * c.maxRotation;
    this.shakeRotation.z = Math.sin(t * 1.5) * intensity * c.maxRotation;

    // Apply shake
    this.position.add(this.shakeOffset);
    // Rotation shake would be applied to camera quaternion
  }

  /**
   * Add camera shake (trauma-based)
   */
  addShake(trauma: number): void {
    this.shakeTrauma = Math.min(1, this.shakeTrauma + trauma);
  }

  /**
   * Add shake from impact
   */
  addImpactShake(force: number, direction: THREE.Vector3): void {
    const trauma = THREE.MathUtils.mapLinear(force, 0, 50000, 0, 0.5);
    this.addShake(trauma);

    // Directional shake
    this.shakeOffset.add(direction.clone().multiplyScalar(trauma * 0.3));
  }

  /**
   * Add shake from engine
   */
  addEngineShake(rpm: number, redline: number): void {
    const rpmRatio = rpm / redline;
    if (rpmRatio > 0.8) {
      const trauma = (rpmRatio - 0.8) * 0.1;
      this.addShake(trauma);
    }
  }

  /**
   * Add shake from road surface
   */
  addRoadShake(roughness: number, speed: number): void {
    const trauma = roughness * (speed / 50) * 0.05;
    this.addShake(trauma);
  }

  // ============================================
  // MODE MANAGEMENT
  // ============================================

  setMode(mode: CameraMode): void {
    if (mode === this.currentMode || mode === this.targetMode) return;

    this.transitionStartMode = this.currentMode;
    this.targetMode = mode;
    this.transitionProgress = 0;

    // Initialize new mode state
    this.initializeMode(mode);

    this.onModeChange?.(mode);
  }

  private initializeMode(mode: CameraMode): void {
    const chassisPos = this.physics.getChassisPosition();
    const chassisRot = this.physics.getChassisRotation();

    switch (mode) {
      case 'chase':
        this.chaseYaw = chassisRot.y;
        this.targetChaseYaw = chassisRot.y;
        this.chasePitch = this.config.chase.pitch;
        this.targetChasePitch = this.config.chase.pitch;
        this.chaseDistance = this.config.chase.distance;
        this.targetChaseDistance = this.config.chase.distance;
        break;
      case 'orbit':
        this.orbitAngle = chassisRot.y + Math.PI / 4;
        this.orbitDistance = this.config.chase.distance * 1.5;
        this.orbitHeight = this.config.chase.height * 1.5;
        break;
    }

    this.velocity.set(0, 0, 0);
  }

  getMode(): CameraMode {
    return this.currentMode;
  }

  getTargetMode(): CameraMode {
    return this.targetMode;
  }

  cycleMode(): void {
    const modes: CameraMode[] = ['chase', 'hood', 'dashboard', 'cinematic', 'rear', 'top'];
    const currentIndex = modes.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setMode(modes[nextIndex]);
  }

  // Orbit camera input
  setOrbitInput(x: number, y: number, zoom: number): void {
    this.orbitInput.x = x;
    this.orbitInput.y = y;
    this.orbitInput.zoom = zoom;

    this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance - zoom, 5, 50);
    this.orbitHeight = THREE.MathUtils.clamp(this.orbitHeight + y, 2, 30);
  }

  // Chase camera distance control (mouse wheel)
  adjustChaseDistance(delta: number): void {
    this.targetChaseDistance = THREE.MathUtils.clamp(
      this.targetChaseDistance + delta,
      this.config.chase.distance * 0.5,
      this.config.chase.distance * 2
    );
  }

  // ============================================
  // FOV MANAGEMENT
  // ============================================

  private getCurrentFOV(): number {
    const baseFOV = this.getModeBaseFOV();
    const speed = this.physics.getSpeedMS();
    const c = this.config.chase;

    // Speed-based FOV increase
    return THREE.MathUtils.clamp(baseFOV + speed * c.fovSpeed, c.minFOV, c.maxFOV);
  }

  private getModeBaseFOV(): number {
    switch (this.currentMode) {
      case 'chase':
        return this.config.chase.fov;
      case 'hood':
        return this.config.hood.fov;
      case 'dashboard':
        return this.config.dashboard.fov;
      case 'cinematic':
        return this.config.cinematic.fov;
      case 'rear':
        return this.config.rear.fov;
      case 'top':
        return this.config.top.fov;
      case 'orbit':
        return this.config.chase.fov;
      default:
        return 70;
    }
  }

  setFOV(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  // ============================================
  // PUBLIC API
  // ============================================

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  getTarget(): THREE.Vector3 {
    return this.target.clone();
  }

  getUp(): THREE.Vector3 {
    return this.up.clone();
  }

  getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  // For external control (replay, photo mode)
  setDirectPosition(position: THREE.Vector3, target: THREE.Vector3, up?: THREE.Vector3): void {
    this.position.copy(position);
    this.target.copy(target);
    if (up) this.up.copy(up);
    this.velocity.set(0, 0, 0);
  }

  // Get view matrix for rendering
  getViewMatrix(): THREE.Matrix4 {
    const matrix = new THREE.Matrix4();
    matrix.lookAt(this.position, this.target, this.up);
    return matrix;
  }

  // Get projection matrix
  getProjectionMatrix(): THREE.Matrix4 {
    return this.camera.projectionMatrix.clone();
  }

  // Set config
  setConfig(config: Partial<CameraConfig>): void {
    this.config = this.deepMerge(this.config, config);
  }

  getConfig(): CameraConfig {
    return JSON.parse(JSON.stringify(this.config)); // Deep clone
  }

  // Debug
  debugDraw(context: CanvasRenderingContext2D, viewProjection: THREE.Matrix4): void {
    // Draw camera frustum, target, etc.
  }
}

// ============================================
// CAMERA MANAGER (for multiple cameras)
// ============================================

export class CameraManager {
  private cameras = new Map<string, VehicleCamera>();
  private activeCamera: VehicleCamera | null = null;
  private mainCamera: THREE.PerspectiveCamera;

  constructor(mainCamera: THREE.PerspectiveCamera) {
    this.mainCamera = mainCamera;
  }

  addCamera(name: string, camera: VehicleCamera): void {
    this.cameras.set(name, camera);
    if (!this.activeCamera) {
      this.setActiveCamera(name);
    }
  }

  removeCamera(name: string): void {
    this.cameras.delete(name);
    if (this.activeCamera === this.cameras.get(name)) {
      this.activeCamera = this.cameras.values().next().value || null;
    }
  }

  setActiveCamera(name: string): boolean {
    const camera = this.cameras.get(name);
    if (camera) {
      this.activeCamera = camera;
      return true;
    }
    return false;
  }

  getActiveCamera(): VehicleCamera | null {
    return this.activeCamera;
  }

  update(deltaTime: number): void {
    if (this.activeCamera) {
      this.activeCamera.update(deltaTime);
    }
  }

  getCamera(name: string): VehicleCamera | undefined {
    return this.cameras.get(name);
  }

  getAllCameras(): VehicleCamera[] {
    return Array.from(this.cameras.values());
  }
}
