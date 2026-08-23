import * as THREE from 'three';

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public target = new THREE.Vector3(0, 1.6, 0);

  private yaw = 0;
  private pitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;

  // Movement
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private moveSpeed = 4.5;
  private sprintMultiplier = 1.8;
  private damping = 0.15;

  // Input state
  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    crouch: false,
  };
  private pointerLocked = false;

  // Camera effects
  private bobTime = 0;
  private bobAmount = 0.02;
  private bobSpeed = 8;
  private leanAmount = 0;
  private targetLean = 0;

  // Hit pause / screen shake
  private hitPauseTimer = 0;
  private shakeIntensity = 0;
  private shakeDecay = 0;
  private shakeOffset = new THREE.Vector3();
  private shakeRotation = new THREE.Euler();

  // Smoothing
  private currentHeight = 1.6;
  private targetHeight = 1.6;
  private heightSpeed = 8;

  private bounds = { minX: -12, maxX: 12, minZ: -12, maxZ: 12 };

  constructor(renderer: THREE.WebGLRenderer) {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.05,
      100
    );
    this.camera.position.set(0, 1.6, 6); // Start in entrance
    this.camera.lookAt(0, 1.6, 0);

    this.setupInput(renderer.domElement);
    this.setupPointerLock(renderer.domElement);
  }

  setBounds(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
    this.bounds = bounds;
  }

  private setupInput(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', e => {
      this.onKeyDown(e);
    });
    window.addEventListener('keyup', e => {
      this.onKeyUp(e);
    });

    // Prevent default for game keys
    window.addEventListener('keydown', e => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ControlLeft', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
  }

  private setupPointerLock(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('click', async () => {
      if (!this.pointerLocked) {
        try {
          await canvas.requestPointerLock();
        } catch (e) {
          console.warn('Pointer lock failed:', e);
        }
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', e => {
      if (!this.pointerLocked) return;

      const sensitivity = 0.002;
      this.targetYaw -= e.movementX * sensitivity;
      this.targetPitch -= e.movementY * sensitivity;
      this.targetPitch = THREE.MathUtils.clamp(
        this.targetPitch,
        -Math.PI / 2 + 0.01,
        Math.PI / 2 - 0.01
      );
    });
  }

  private onKeyDown(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
        this.keys.forward = true;
        break;
      case 'KeyS':
        this.keys.backward = true;
        break;
      case 'KeyA':
        this.keys.left = true;
        break;
      case 'KeyD':
        this.keys.right = true;
        break;
      case 'ShiftLeft':
        this.keys.sprint = true;
        break;
      case 'ControlLeft':
        this.keys.crouch = true;
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
        this.keys.forward = false;
        break;
      case 'KeyS':
        this.keys.backward = false;
        break;
      case 'KeyA':
        this.keys.left = false;
        break;
      case 'KeyD':
        this.keys.right = false;
        break;
      case 'ShiftLeft':
        this.keys.sprint = false;
        break;
      case 'ControlLeft':
        this.keys.crouch = false;
        break;
    }
  }

  // Public API for hit pause
  addHitPause(duration: number): void {
    this.hitPauseTimer = Math.max(this.hitPauseTimer, duration);
  }

  addScreenShake(intensity: number, decay = 0.9): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDecay = decay;
  }

  addLean(amount: number): void {
    this.targetLean = THREE.MathUtils.clamp(amount, -0.15, 0.15);
  }

  update(delta: number): void {
    // Hit pause - freeze everything
    if (this.hitPauseTimer > 0) {
      this.hitPauseTimer -= delta;
      return;
    }

    // Smooth yaw/pitch
    this.yaw = THREE.MathUtils.lerp(this.yaw, this.targetYaw, 1 - Math.exp(-30 * delta));
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.targetPitch, 1 - Math.exp(-30 * delta));

    // Calculate movement direction relative to camera
    this.direction.set(0, 0, 0);
    if (this.keys.forward) this.direction.z -= 1;
    if (this.keys.backward) this.direction.z += 1;
    if (this.keys.left) this.direction.x -= 1;
    if (this.keys.right) this.direction.x += 1;
    this.direction.normalize();

    // Apply yaw rotation to movement
    const moveDir = new THREE.Vector3();
    moveDir.x = this.direction.x * Math.cos(this.yaw) - this.direction.z * Math.sin(this.yaw);
    moveDir.z = this.direction.x * Math.sin(this.yaw) + this.direction.z * Math.cos(this.yaw);

    // Speed
    const speed = this.moveSpeed * (this.keys.sprint ? this.sprintMultiplier : 1);

    // Velocity with damping
    this.velocity.x = THREE.MathUtils.lerp(
      this.velocity.x,
      moveDir.x * speed,
      1 - Math.exp(-15 * delta)
    );
    this.velocity.z = THREE.MathUtils.lerp(
      this.velocity.z,
      moveDir.z * speed,
      1 - Math.exp(-15 * delta)
    );

    // Move target
    this.target.x += this.velocity.x * delta;
    this.target.z += this.velocity.z * delta;

    // Clamp to house bounds
    this.target.x = THREE.MathUtils.clamp(this.target.x, this.bounds.minX, this.bounds.maxX);
    this.target.z = THREE.MathUtils.clamp(this.target.z, this.bounds.minZ, this.bounds.maxZ);

    // Crouch/stand height
    this.targetHeight = this.keys.crouch ? 0.9 : 1.6;
    this.currentHeight = THREE.MathUtils.lerp(
      this.currentHeight,
      this.targetHeight,
      1 - Math.exp(-this.heightSpeed * delta)
    );

    // Head bob when moving
    const moving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1;
    if (moving) {
      this.bobTime += delta * this.bobSpeed * (this.keys.sprint ? 1.5 : 1);
    }

    // Lean smoothing
    this.leanAmount = THREE.MathUtils.lerp(
      this.leanAmount,
      this.targetLean,
      1 - Math.exp(-12 * delta)
    );
    this.targetLean *= 0.95; // Auto-return to center

    // Screen shake
    if (this.shakeIntensity > 0.01) {
      this.shakeOffset.set(
        (Math.random() - 0.5) * this.shakeIntensity,
        (Math.random() - 0.5) * this.shakeIntensity * 0.5,
        (Math.random() - 0.5) * this.shakeIntensity
      );
      this.shakeRotation.set(
        (Math.random() - 0.5) * this.shakeIntensity * 0.1,
        (Math.random() - 0.5) * this.shakeIntensity * 0.1,
        (Math.random() - 0.5) * this.shakeIntensity * 0.1
      );
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.shakeOffset.set(0, 0, 0);
      this.shakeRotation.set(0, 0, 0);
    }

    // Update camera position
    const bobY = moving
      ? Math.sin(this.bobTime) * this.bobAmount * (this.keys.sprint ? 1.3 : 1)
      : 0;
    const bobX = moving ? Math.sin(this.bobTime * 0.5) * this.bobAmount * 0.3 : 0;

    this.camera.position.x = this.target.x + bobX + this.shakeOffset.x + this.leanAmount;
    this.camera.position.y = this.currentHeight + bobY + this.shakeOffset.y;
    this.camera.position.z = this.target.z + this.shakeOffset.z;

    // Look direction
    const lookDir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    this.camera.lookAt(this.camera.position.clone().add(lookDir).add(this.shakeRotation));
  }

  getForwardVector(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }

  getRightVector(): THREE.Vector3 {
    return new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw)).normalize();
  }

  getCameraPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }

  getCameraDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
