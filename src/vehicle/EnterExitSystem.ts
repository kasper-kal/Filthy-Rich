import * as THREE from 'three';
import type { Vehicle } from './Vehicle.js';
import type { VehicleCamera } from './VehicleCamera.js';

// ============================================
// ENTER/EXIT SYSTEM
// ============================================

export type CharacterState = 'on_foot' | 'entering' | 'driving' | 'exiting' | 'changing_seat';

export interface EnterExitConfig {
  // Distance thresholds
  enterDistance: number; // Max distance to start enter
  exitDistance: number; // Distance from vehicle to place character

  // Animation
  enterDuration: number; // Seconds
  exitDuration: number; // Seconds
  seatSwitchDuration: number; // Seconds

  // Camera
  cameraTransitionDuration: number;
  cameraLerpSpeed: number;

  // Physics
  disableCharacterPhysics: boolean;
  disableVehiclePhysicsOnExit: boolean;

  // Doors
  animateDoors: boolean;
  doorOpenAngle: number; // Radians
  doorOpenSpeed: number; // Rad/s
}

const DEFAULT_CONFIG: EnterExitConfig = {
  enterDistance: 2.5,
  exitDistance: 1.5,
  enterDuration: 2.0,
  exitDuration: 1.5,
  seatSwitchDuration: 1.0,
  cameraTransitionDuration: 0.5,
  cameraLerpSpeed: 10,
  disableCharacterPhysics: true,
  disableVehiclePhysicsOnExit: false,
  animateDoors: true,
  doorOpenAngle: Math.PI / 2,
  doorOpenSpeed: 2.0,
};

export interface SeatPosition {
  name: string;
  index: number; // 0 = driver, 1 = passenger, 2 = rear left, 3 = rear right
  position: THREE.Vector3; // Relative to vehicle center
  rotation: THREE.Euler; // Character rotation when seated
  doorIndex: number; // Which door to use (-1 = no door)
  isDriver: boolean;
  hasSteeringWheel: boolean;
  cameraOffset: THREE.Vector3; // Camera offset from seat
}

const DEFAULT_SEATS: SeatPosition[] = [
  // Driver
  {
    name: 'driver',
    index: 0,
    position: new THREE.Vector3(-0.7, 0.9, 0.5),
    rotation: new THREE.Euler(0, 0, 0),
    doorIndex: 0, // Front left
    isDriver: true,
    hasSteeringWheel: true,
    cameraOffset: new THREE.Vector3(0, 1.1, 0.3),
  },
  // Passenger
  {
    name: 'passenger',
    index: 1,
    position: new THREE.Vector3(0.7, 0.9, 0.5),
    rotation: new THREE.Euler(0, 0, 0),
    doorIndex: 1, // Front right
    isDriver: false,
    hasSteeringWheel: false,
    cameraOffset: new THREE.Vector3(0, 1.1, 0.3),
  },
  // Rear left
  {
    name: 'rear_left',
    index: 2,
    position: new THREE.Vector3(-0.7, 0.9, -0.8),
    rotation: new THREE.Euler(0, 0, 0),
    doorIndex: 2, // Rear left
    isDriver: false,
    hasSteeringWheel: false,
    cameraOffset: new THREE.Vector3(0, 1.0, 0),
  },
  // Rear right
  {
    name: 'rear_right',
    index: 3,
    position: new THREE.Vector3(0.7, 0.9, -0.8),
    rotation: new THREE.Euler(0, 0, 0),
    doorIndex: 3, // Rear right
    isDriver: false,
    hasSteeringWheel: false,
    cameraOffset: new THREE.Vector3(0, 1.0, 0),
  },
];

export interface EnterExitCallbacks {
  onEnterVehicle?: (vehicle: Vehicle, seatIndex: number) => void;
  onExitVehicle?: (vehicle: Vehicle, seatIndex: number) => void;
  onEnterStart?: (vehicle: Vehicle, seatIndex: number) => void;
  onEnterComplete?: (vehicle: Vehicle, seatIndex: number) => void;
  onExitStart?: (vehicle: Vehicle, seatIndex: number) => void;
  onExitComplete?: (vehicle: Vehicle, seatIndex: number) => void;
  onSeatChange?: (vehicle: Vehicle, fromSeat: number, toSeat: number) => void;
  onCameraTransitionStart?: (fromCamera: THREE.Camera, toCamera: THREE.Camera) => void;
  onCameraTransitionComplete?: () => void;
}

export class EnterExitSystem {
  private vehicle: Vehicle;
  private vehicleCamera: VehicleCamera;
  private characterCamera: THREE.Camera;
  private config: EnterExitConfig;
  private seats: SeatPosition[];
  private callbacks: EnterExitCallbacks;

  // State
  private state: CharacterState = 'on_foot';
  private currentSeat = -1;
  private targetSeat = -1;
  private progress = 0;
  private startTime = 0;

  // Animation
  private characterStartPos = new THREE.Vector3();
  private characterStartRot = new THREE.Quaternion();
  private characterTargetPos = new THREE.Vector3();
  private characterTargetRot = new THREE.Quaternion();

  // Door animation
  private doorStates: number[] = [0, 0, 0, 0]; // 0-1 open amount
  private targetDoorStates: number[] = [0, 0, 0, 0];

  // Camera transition
  private isTransitioningCamera = false;
  private cameraTransitionProgress = 0;
  private fromCamera: THREE.Camera | null = null;
  private toCamera: THREE.Camera | null = null;

  // References
  private characterController: any = null; // Would be the character controller
  private characterMesh: THREE.Object3D | null = null;

  constructor(
    vehicle: Vehicle,
    vehicleCamera: VehicleCamera,
    characterCamera: THREE.Camera,
    config?: Partial<EnterExitConfig>,
    callbacks?: EnterExitCallbacks
  ) {
    this.vehicle = vehicle;
    this.vehicleCamera = vehicleCamera;
    this.characterCamera = characterCamera;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.seats = DEFAULT_SEATS;
    this.callbacks = callbacks || {};
  }

  setCharacterController(controller: any): void {
    this.characterController = controller;
  }

  setCharacterMesh(mesh: THREE.Object3D): void {
    this.characterMesh = mesh;
  }

  setSeats(seats: SeatPosition[]): void {
    this.seats = seats;
  }

  // ============================================
  // MAIN UPDATE
  // ============================================

  update(deltaTime: number): void {
    switch (this.state) {
      case 'entering':
        this.updateEntering(deltaTime);
        break;
      case 'exiting':
        this.updateExiting(deltaTime);
        break;
      case 'changing_seat':
        this.updateSeatChange(deltaTime);
        break;
      case 'driving':
        this.updateDriving(deltaTime);
        break;
    }

    // Update door animations
    this.updateDoors(deltaTime);

    // Update camera transition
    if (this.isTransitioningCamera) {
      this.updateCameraTransition(deltaTime);
    }
  }

  // ============================================
  // ENTER VEHICLE
  // ============================================

  /**
   * Attempt to enter vehicle at nearest seat
   */
  tryEnterVehicle(characterPosition: THREE.Vector3): boolean {
    if (this.state !== 'on_foot') return false;

    // Find nearest accessible seat
    const seatIndex = this.findNearestSeat(characterPosition);
    if (seatIndex === -1) return false;

    return this.enterVehicle(seatIndex);
  }

  /**
   * Enter vehicle at specific seat
   */
  enterVehicle(seatIndex: number): boolean {
    if (this.state !== 'on_foot') return false;
    if (seatIndex < 0 || seatIndex >= this.seats.length) return false;

    const seat = this.seats[seatIndex];

    // Store start position
    if (this.characterMesh) {
      this.characterStartPos.copy(this.characterMesh.position);
      this.characterStartRot.copy(this.characterMesh.quaternion);
    }

    // Calculate target position (in world space)
    const vehiclePos = this.vehicle.getPosition();
    const vehicleRot = this.vehicle.getRotation();
    const vehicleQuat = new THREE.Quaternion().setFromEuler(vehicleRot);

    this.characterTargetPos.copy(seat.position).applyQuaternion(vehicleQuat).add(vehiclePos);
    this.characterTargetRot.setFromEuler(seat.rotation).multiply(vehicleQuat);

    // Open door
    if (this.config.animateDoors && seat.doorIndex >= 0) {
      this.targetDoorStates[seat.doorIndex] = 1;
    }

    // Start entering
    this.state = 'entering';
    this.targetSeat = seatIndex;
    this.currentSeat = seatIndex;
    this.progress = 0;
    this.startTime = performance.now();

    // Disable character physics
    if (this.config.disableCharacterPhysics && this.characterController) {
      this.characterController.enabled = false;
    }

    // Callbacks
    this.callbacks.onEnterStart?.(this.vehicle, seatIndex);

    return true;
  }

  private updateEntering(deltaTime: number): void {
    const seat = this.seats[this.targetSeat];
    const duration = this.config.enterDuration;

    this.progress += deltaTime / duration;
    this.progress = Math.min(1, this.progress);

    // Smooth interpolation
    const t = this.easeInOutCubic(this.progress);

    // Update character position/rotation
    if (this.characterMesh) {
      this.characterMesh.position.lerpVectors(this.characterStartPos, this.characterTargetPos, t);
      this.characterMesh.quaternion.slerpQuaternions(
        this.characterStartRot,
        this.characterTargetRot,
        t
      );
    }

    // Check completion
    if (this.progress >= 1) {
      this.completeEnter();
    }
  }

  private completeEnter(): void {
    this.state = 'driving';
    this.progress = 1;

    // Attach character to vehicle (hide mesh, parent to vehicle)
    if (this.characterMesh) {
      this.characterMesh.visible = false;
      // In a real implementation, would parent to vehicle bone/seat
    }

    // Enable vehicle control
    this.vehicle.setControllable(true);

    // Start camera transition from character to vehicle camera
    this.startCameraTransition(this.characterCamera, this.vehicleCamera.getCamera());

    // Callbacks
    this.callbacks.onEnterComplete?.(this.vehicle, this.currentSeat);
  }

  // ============================================
  // EXIT VEHICLE
  // ============================================

  /**
   * Exit vehicle from current seat
   */
  exitVehicle(): boolean {
    if (this.state !== 'driving') return false;
    if (this.currentSeat === -1) return false;

    const seat = this.seats[this.currentSeat];

    // Calculate exit position (outside door)
    const vehiclePos = this.vehicle.getPosition();
    const vehicleRot = this.vehicle.getRotation();
    const vehicleQuat = new THREE.Quaternion().setFromEuler(vehicleRot);

    // Exit position is outside the door
    const exitOffset = seat.position.clone();
    exitOffset.x += seat.position.x < 0 ? -this.config.exitDistance : this.config.exitDistance;
    exitOffset.z += 0.5;

    this.characterStartPos.copy(this.characterTargetPos);
    this.characterStartRot.copy(this.characterTargetRot);
    this.characterTargetPos.copy(exitOffset).applyQuaternion(vehicleQuat).add(vehiclePos);
    this.characterTargetRot.setFromEuler(new THREE.Euler(0, vehicleRot.y, 0));

    // Open door
    if (this.config.animateDoors && seat.doorIndex >= 0) {
      this.targetDoorStates[seat.doorIndex] = 1;
    }

    // Stop vehicle
    this.vehicle.setControllable(false);

    // Start exiting
    this.state = 'exiting';
    this.progress = 0;
    this.startTime = performance.now();

    // Callbacks
    this.callbacks.onExitStart?.(this.vehicle, this.currentSeat);

    return true;
  }

  private updateExiting(deltaTime: number): void {
    const duration = this.config.exitDuration;

    this.progress += deltaTime / duration;
    this.progress = Math.min(1, this.progress);

    const t = this.easeInOutCubic(this.progress);

    // Update character position/rotation
    if (this.characterMesh) {
      this.characterMesh.visible = true;
      this.characterMesh.position.lerpVectors(this.characterStartPos, this.characterTargetPos, t);
      this.characterMesh.quaternion.slerpQuaternions(
        this.characterStartRot,
        this.characterTargetRot,
        t
      );
    }

    // Close door during exit
    if (this.config.animateDoors) {
      const seat = this.seats[this.currentSeat];
      if (seat.doorIndex >= 0) {
        this.targetDoorStates[seat.doorIndex] = 0;
      }
    }

    if (this.progress >= 1) {
      this.completeExit();
    }
  }

  private completeExit(): void {
    this.state = 'on_foot';
    this.progress = 1;

    // Show character
    if (this.characterMesh) {
      this.characterMesh.visible = true;
    }

    // Re-enable character physics
    if (this.config.disableCharacterPhysics && this.characterController) {
      this.characterController.enabled = true;
      // Position character controller at exit position
      if (this.characterController.setPosition) {
        this.characterController.setPosition(this.characterTargetPos);
      }
    }

    // Start camera transition from vehicle to character camera
    this.startCameraTransition(this.vehicleCamera.getCamera(), this.characterCamera);

    // Callbacks
    this.callbacks.onExitComplete?.(this.vehicle, this.currentSeat);

    this.currentSeat = -1;
  }

  // ============================================
  // SEAT CHANGING
  // ============================================

  changeSeat(targetSeatIndex: number): boolean {
    if (this.state !== 'driving') return false;
    if (targetSeatIndex === this.currentSeat) return false;
    if (targetSeatIndex < 0 || targetSeatIndex >= this.seats.length) return false;

    const fromSeat = this.seats[this.currentSeat];
    const toSeat = this.seats[targetSeatIndex];

    // Open both doors
    if (this.config.animateDoors) {
      if (fromSeat.doorIndex >= 0) this.targetDoorStates[fromSeat.doorIndex] = 1;
      if (toSeat.doorIndex >= 0) this.targetDoorStates[toSeat.doorIndex] = 1;
    }

    this.state = 'changing_seat';
    this.targetSeat = targetSeatIndex;
    this.progress = 0;

    this.callbacks.onSeatChange?.(this.vehicle, this.currentSeat, targetSeatIndex);

    return true;
  }

  private updateSeatChange(deltaTime: number): void {
    const duration = this.config.seatSwitchDuration;

    this.progress += deltaTime / duration;
    this.progress = Math.min(1, this.progress);

    if (this.progress >= 1) {
      // Close old door, open new door briefly then close
      const fromSeat = this.seats[this.currentSeat];
      const toSeat = this.seats[this.targetSeat];

      if (this.config.animateDoors) {
        if (fromSeat.doorIndex >= 0) this.targetDoorStates[fromSeat.doorIndex] = 0;
        if (toSeat.doorIndex >= 0) this.targetDoorStates[toSeat.doorIndex] = 0;
      }

      this.currentSeat = this.targetSeat;
      this.state = 'driving';

      // If switched to driver seat, enable controls
      if (toSeat.isDriver) {
        this.vehicle.setControllable(true);
      } else {
        this.vehicle.setControllable(false);
      }
    }
  }

  // ============================================
  // DRIVING STATE
  // ============================================

  private updateDriving(deltaTime: number): void {
    // Update character position to follow vehicle (if visible for some reason)
    if (this.characterMesh && this.characterMesh.visible) {
      const seat = this.seats[this.currentSeat];
      const vehiclePos = this.vehicle.getPosition();
      const vehicleRot = this.vehicle.getRotation();
      const vehicleQuat = new THREE.Quaternion().setFromEuler(vehicleRot);

      const targetPos = seat.position.clone().applyQuaternion(vehicleQuat).add(vehiclePos);
      const targetRot = new THREE.Quaternion().setFromEuler(seat.rotation).multiply(vehicleQuat);

      this.characterMesh.position.copy(targetPos);
      this.characterMesh.quaternion.copy(targetRot);
    }
  }

  // ============================================
  // DOOR ANIMATIONS
  // ============================================

  private updateDoors(deltaTime: number): void {
    for (let i = 0; i < 4; i++) {
      const current = this.doorStates[i];
      const target = this.targetDoorStates[i];

      if (Math.abs(current - target) > 0.01) {
        const speed = this.config.doorOpenSpeed * deltaTime;
        if (current < target) {
          this.doorStates[i] = Math.min(target, current + speed);
        } else {
          this.doorStates[i] = Math.max(target, current - speed);
        }

        // Apply to vehicle door meshes
        this.applyDoorRotation(i, this.doorStates[i]);
      }
    }
  }

  private applyDoorRotation(doorIndex: number, amount: number): void {
    // Get vehicle chassis and find door meshes
    const chassis = this.vehicle.getChassis();
    if (!chassis) return;

    const doorNames = ['door_fl', 'door_fr', 'door_rl', 'door_rr'];
    const door = chassis.getObjectByName(doorNames[doorIndex]);
    if (door) {
      door.rotation.y = amount * this.config.doorOpenAngle * (doorIndex % 2 === 0 ? 1 : -1);
    }
  }

  // ============================================
  // CAMERA TRANSITION
  // ============================================

  private startCameraTransition(from: THREE.Camera, to: THREE.Camera): void {
    this.fromCamera = from;
    this.toCamera = to;
    this.isTransitioningCamera = true;
    this.cameraTransitionProgress = 0;

    this.callbacks.onCameraTransitionStart?.(from, to);
  }

  private updateCameraTransition(deltaTime: number): void {
    this.cameraTransitionProgress += deltaTime / this.config.cameraTransitionDuration;

    if (this.cameraTransitionProgress >= 1) {
      this.cameraTransitionProgress = 1;
      this.isTransitioningCamera = false;
      this.fromCamera = null;
      this.toCamera = null;
      this.callbacks.onCameraTransitionComplete?.();
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private findNearestSeat(characterPosition: THREE.Vector3): number {
    const vehiclePos = this.vehicle.getPosition();
    const vehicleRot = this.vehicle.getRotation();
    const vehicleQuat = new THREE.Quaternion().setFromEuler(vehicleRot);

    let nearestSeat = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < this.seats.length; i++) {
      const seat = this.seats[i];
      const seatWorldPos = seat.position.clone().applyQuaternion(vehicleQuat).add(vehiclePos);
      const dist = characterPosition.distanceTo(seatWorldPos);

      // Check if door is accessible (not blocked)
      if (dist < this.config.enterDistance && dist < nearestDist) {
        nearestDist = dist;
        nearestSeat = i;
      }
    }

    return nearestSeat;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  getState(): CharacterState {
    return this.state;
  }

  getCurrentSeat(): number {
    return this.currentSeat;
  }

  getTargetSeat(): number {
    return this.targetSeat;
  }

  getProgress(): number {
    return this.progress;
  }

  isInVehicle(): boolean {
    return this.state === 'driving' || this.state === 'changing_seat';
  }

  isDriver(): boolean {
    if (this.currentSeat === -1) return false;
    return this.seats[this.currentSeat].isDriver;
  }

  canDrive(): boolean {
    return this.isDriver() && this.state === 'driving';
  }

  getSeatCount(): number {
    return this.seats.length;
  }

  getSeatInfo(index: number): SeatPosition | null {
    return this.seats[index] || null;
  }

  getDoorState(doorIndex: number): number {
    return this.doorStates[doorIndex];
  }

  setDoorState(doorIndex: number, open: boolean): void {
    this.targetDoorStates[doorIndex] = open ? 1 : 0;
  }

  openDoor(doorIndex: number): void {
    this.targetDoorStates[doorIndex] = 1;
  }

  closeDoor(doorIndex: number): void {
    this.targetDoorStates[doorIndex] = 0;
  }

  closeAllDoors(): void {
    for (let i = 0; i < 4; i++) {
      this.targetDoorStates[i] = 0;
    }
  }

  // For AI/scripted sequences
  forceEnter(seatIndex: number): void {
    this.enterVehicle(seatIndex);
    // Instantly complete
    this.progress = 1;
    this.completeEnter();
  }

  forceExit(): void {
    if (this.state === 'driving') {
      this.exitVehicle();
      this.progress = 1;
      this.completeExit();
    }
  }

  setConfig(config: Partial<EnterExitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): EnterExitConfig {
    return { ...this.config };
  }

  // Serialize for save
  serialize(): any {
    return {
      state: this.state,
      currentSeat: this.currentSeat,
      doorStates: [...this.doorStates],
    };
  }

  deserialize(data: any): void {
    this.state = data.state || 'on_foot';
    this.currentSeat = data.currentSeat || -1;
    if (data.doorStates) {
      this.doorStates = [...data.doorStates];
      this.targetDoorStates = [...data.doorStates];
    }
  }

  // Set callbacks after construction
  setCallbacks(callbacks: EnterExitCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Enable/disable the enter/exit system
  setEnabled(enabled: boolean): void {
    // System doesn't need explicit enable/disable - it works based on state
    // But we add this for Game.ts compatibility
  }

  // Check if player can enter vehicle (nearby, not already in vehicle, etc.)
  canEnterVehicle(): boolean {
    if (this.state !== 'on_foot') return false;

    // Could add more checks like:
    // - Is vehicle nearby?
    // - Is vehicle accessible (doors not blocked)?
    // - Is vehicle driveable?

    // For now, just check if we're on foot
    return this.state === 'on_foot';
  }
}

// ============================================
// VEHICLE ENTER/EXIT HELPER (Static)
// ============================================

export class VehicleEnterExitHelper {
  /**
   * Find all enterable vehicles near a position
   */
  static findEnterableVehicles(
    position: THREE.Vector3,
    vehicles: Vehicle[],
    maxDistance = 5
  ): { vehicle: Vehicle; seatIndex: number; distance: number }[] {
    const results: { vehicle: Vehicle; seatIndex: number; distance: number }[] = [];

    for (const vehicle of vehicles) {
      const vehiclePos = vehicle.getPosition();
      const dist = position.distanceTo(vehiclePos);

      if (dist < maxDistance) {
        // Check each seat
        const seats = vehicle.getSeats ? vehicle.getSeats() : DEFAULT_SEATS;
        for (let i = 0; i < seats.length; i++) {
          const seat = seats[i];
          const vehicleRot = vehicle.getRotation();
          const vehicleQuat = new THREE.Quaternion().setFromEuler(vehicleRot);
          const seatWorldPos = seat.position.clone().applyQuaternion(vehicleQuat).add(vehiclePos);
          const seatDist = position.distanceTo(seatWorldPos);

          if (seatDist < 2.5) {
            results.push({ vehicle, seatIndex: i, distance: seatDist });
          }
        }
      }
    }

    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  /**
   * Get best vehicle to enter (nearest driver seat)
   */
  static getBestVehicleToEnter(
    position: THREE.Vector3,
    vehicles: Vehicle[],
    preferDriver = true
  ): { vehicle: Vehicle; seatIndex: number } | null {
    const enterable = this.findEnterableVehicles(position, vehicles);

    if (preferDriver) {
      // Prefer driver seats
      for (const entry of enterable) {
        if (entry.vehicle.getSeats) {
          const seats = entry.vehicle.getSeats();
          if (seats[entry.seatIndex]?.isDriver) {
            return { vehicle: entry.vehicle, seatIndex: entry.seatIndex };
          }
        }
      }
    }

    // Return nearest
    return enterable.length > 0
      ? { vehicle: enterable[0].vehicle, seatIndex: enterable[0].seatIndex }
      : null;
  }
}
