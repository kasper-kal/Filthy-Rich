import * as THREE from 'three';
import type { VehicleSpecsData } from './VehicleSpecs.js';
import { VehicleSpecs } from './VehicleSpecs.js';
import type { DamageModel } from './DamageModel.js';
import { Drivetrain } from './Drivetrain.js';
import { VehiclePhysics } from './VehiclePhysics.js';
import type { SeatPosition } from './EnterExitSystem.js';
import type { audioManager } from '../systems/AudioManager.js';
import { createVehicleVisual, wheelModelPath, wheelModelRadius } from './VehicleVisual.js';
import { ModelLibrary } from '../world/ModelLibrary.js';

export type VehicleType = 'hatchback' | 'sedan' | 'van' | 'sports' | 'truck';

export interface VehicleState {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  speed: number; // m/s
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  steering: number;
  engineRunning: boolean;
  fuelLevel: number;
  odometer: number;
}

export class Vehicle {
  public readonly id: string;
  public readonly specs: VehicleSpecsData;
  public readonly damageModel: DamageModel;

  private physics: VehiclePhysics;
  private drivetrain: Drivetrain;
  private scene: THREE.Scene;
  private audioManager: typeof audioManager;

  // Visual
  private chassis!: THREE.Group;
  private wheels: THREE.Group[] = [];
  private wheelPositions: THREE.Vector3[] = [];

  // State
  private engineRunning = false;
  private fuelLevel = 1;
  private odometer = 0;
  private controllable = false;

  // Input state
  private throttle = 0;
  private brake = 0;
  private steering = 0;
  private handbrake = false;

  // Callbacks
  onDamage?: (damage: number, subsystem: string) => void;
  onBreakdown?: (severity: 'minor' | 'major' | 'critical', subsystem: string) => void;

  constructor(params: {
    specs: VehicleSpecsData;
    scene: THREE.Scene;
    damageModel: DamageModel;
    audioManager: typeof audioManager;
  }) {
    this.id = `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.specs = params.specs;
    this.scene = params.scene;
    this.damageModel = params.damageModel;
    this.audioManager = params.audioManager;

    // Initialize physics
    this.physics = new VehiclePhysics(this.specs, this.damageModel);
    this.drivetrain = new Drivetrain(this.specs.drivetrain);

    // Create visual
    this.createVisual();

    // Start engine sound
    this.audioManager.play('engine_idle', { loop: true, volume: 0.3 });
  }

  private createVisual(): void {
    this.chassis = createVehicleVisual(this.specs, this.id);
    this.chassis.name = this.id;

    // Wheel positions (FL, FR, RL, RR). The spec's wheelbase and track decide
    // these, not the length and width: axles belong under the car, and the
    // body models cut their arches exactly here (FINALLY-3D.md §10.0).
    const halfTrackFront = this.specs.dimensions.trackFront / 2;
    const halfTrackRear = this.specs.dimensions.trackRear / 2;
    const halfBase = this.specs.dimensions.wheelbase / 2;
    this.wheelPositions = [
      new THREE.Vector3(-halfTrackFront, this.specs.wheelRadius, halfBase), // FL
      new THREE.Vector3(halfTrackFront, this.specs.wheelRadius, halfBase), // FR
      new THREE.Vector3(-halfTrackRear, this.specs.wheelRadius, -halfBase), // RL
      new THREE.Vector3(halfTrackRear, this.specs.wheelRadius, -halfBase), // RR
    ];

    // Create wheels
    for (let i = 0; i < 4; i++) {
      const wheel = this.createWheel(i);
      this.wheels.push(wheel);
      this.chassis.add(wheel);
    }

    this.scene.add(this.chassis);
  }

  private createWheel(index: number): THREE.Group {
    const wheelGroup = new THREE.Group();
    wheelGroup.name = `wheel_${index}`;

    // A wheel asset is modelled at one nominal radius (a 0.31 m standard tyre)
    // and the spec's radius is the truth, so the model takes one uniform scale.
    // This is the only place in the game that scales a model, and §10.0 says why:
    // a tyre's size IS the spec, and shipping five sizes of every wheel would
    // cost more than the whole body.
    const path = wheelModelPath(this.specs);
    const model = ModelLibrary.clone(path);
    if (model) {
      this.mountWheelModel(wheelGroup, model, path);
    } else {
      // Visible for a frame or two at most, and the safety net if an asset 404s.
      this.mountWheelFallback(wheelGroup);
      void ModelLibrary.load(path)
        .then(() => {
          const loaded = ModelLibrary.clone(path);
          if (!loaded) return;
          wheelGroup.clear();
          this.mountWheelModel(wheelGroup, loaded, path);
        })
        .catch(error => console.warn(`[Vehicle] could not load ${path}`, error));
    }

    wheelGroup.position.copy(this.wheelPositions[index]);
    return wheelGroup;
  }

  private mountWheelModel(group: THREE.Group, model: THREE.Group, path: string): void {
    model.scale.setScalar(this.specs.wheelRadius / wheelModelRadius(path));
    model.name = 'wheel_model';
    model.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    group.add(model);
  }

  private mountWheelFallback(group: THREE.Group): void {
    const tyre = new THREE.Mesh(
      new THREE.CylinderGeometry(this.specs.wheelRadius, this.specs.wheelRadius, this.specs.wheelWidth, 16),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    );
    tyre.rotation.z = Math.PI / 2;
    tyre.name = 'wheel_fallback_tyre';
    group.add(tyre);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(
        this.specs.wheelRadius * 0.6,
        this.specs.wheelRadius * 0.6,
        this.specs.wheelWidth * 1.05,
        16
      ),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.8 })
    );
    rim.rotation.z = Math.PI / 2;
    rim.name = 'wheel_fallback_rim';
    group.add(rim);
  }

  update(
    deltaTime: number,
    input: { throttle: number; brake: number; steer: number; handbrake: boolean }
  ): void {
    if (!this.controllable) {
      input = { throttle: 0, brake: 0.3, steer: 0, handbrake: true };
    }

    this.throttle = input.throttle;
    this.brake = input.brake;
    this.steering = input.steer;
    this.handbrake = input.handbrake;

    // Update physics
    this.physics.update(deltaTime, {
      throttle: this.throttle,
      brake: this.brake,
      steering: this.steering,
      handbrake: this.handbrake,
    });

    // Update drivetrain
    this.drivetrain.setInputs(this.throttle, this.brake, this.handbrake ? 0 : 1);
    this.drivetrain.update(deltaTime);

    // Update visual
    this.updateVisual(deltaTime);

    // Update audio
    this.updateAudio();

    // Update odometer
    this.odometer += this.getSpeed() * deltaTime;

    // Fuel consumption
    this.fuelLevel -= (this.drivetrain.getFuelConsumption() * deltaTime) / 3600;
    this.fuelLevel = Math.max(0, this.fuelLevel);

    // Check for damage
    this.checkDamage();
  }

  private updateVisual(deltaTime: number): void {
    // Update chassis position/rotation from physics
    const physicsState = this.physics.getState();
    this.chassis.position.copy(physicsState.position);
    this.chassis.quaternion.copy(physicsState.rotation);

    // Update wheel rotation and steering
    const wheelStates = this.physics.getWheelStates();
    for (let i = 0; i < 4; i++) {
      const wheel = this.wheels[i];
      const state = wheelStates[i];

      wheel.position.copy(state.position);
      wheel.quaternion.copy(state.rotation);

      // Visual steering for front wheels
      if (i < 2) {
        wheel.rotation.y = state.steeringAngle;
      }
    }
  }

  private updateAudio(): void {
    const rpm = this.getRPM();
    const load = this.throttle;

    // Engine sound pitch/volume based on RPM and load
    const pitch = THREE.MathUtils.mapLinear(rpm, 800, this.specs.engineRedline, 0.5, 2.0);
    const volume = THREE.MathUtils.mapLinear(load, 0, 1, 0.2, 0.8);

    this.audioManager.setPlaybackRate('engine_idle', pitch);
    this.audioManager.setSoundVolume('engine_idle', volume);

    // Turbo whistle
    const drivetrainSpecs = this.drivetrain.getSpecs();
    if (drivetrainSpecs.engine.aspiration !== 'na' && rpm > 2500 && load > 0.5) {
      this.audioManager.play?.('turbo_whistle', { volume: 0.3 * load, pitch: pitch * 1.5 });
    }
  }

  private checkDamage(): void {
    const damage = this.physics.getChassisDamage();
    if (damage > 0) {
      this.onDamage?.(damage, 'chassis');
    }

    // Check mechanical damage
    for (const [name, sub] of this.damageModel.getMechanicalState().subsystems) {
      if (sub.health < 30 && sub.health > 0) {
        const severity = sub.health < 10 ? 'critical' : sub.health < 20 ? 'major' : 'minor';
        this.onBreakdown?.(severity, name);
        break;
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================
  getSpeed(): number {
    return this.physics.getSpeed();
  }
  getRPM(): number {
    return this.physics.getEngineRPM();
  }
  getGear(): number {
    return this.physics.getGear();
  }
  getLoad(): number {
    return this.drivetrain.getLoad();
  }
  getLateralG(): number {
    return this.physics.getLateralG();
  }
  getPosition(): THREE.Vector3 {
    return this.chassis.position.clone();
  }
  getRotation(): THREE.Euler {
    return new THREE.Euler().setFromQuaternion(this.chassis.quaternion);
  }
  getState(): VehicleState {
    return {
      position: this.getPosition(),
      rotation: this.getRotation(),
      velocity: this.physics.getVelocity(),
      speed: this.getSpeed(),
      rpm: this.getRPM(),
      gear: this.getGear(),
      throttle: this.throttle,
      brake: this.brake,
      steering: this.steering,
      engineRunning: this.engineRunning,
      fuelLevel: this.fuelLevel,
      odometer: this.odometer,
    };
  }

  getFuelLevel(): number {
    return this.fuelLevel;
  }
  getOdometer(): number {
    return this.odometer;
  }

  /** Restore persisted fuel/odometer values, clamped to sane ranges. */
  restoreFuelAndOdometer(fuelLevel: number, odometer: number): void {
    this.fuelLevel = Math.max(0, Math.min(1, fuelLevel));
    this.odometer = Math.max(0, odometer);
  }

  setControllable(controllable: boolean): void {
    this.controllable = controllable;
  }

  setEngineRunning(running: boolean): void {
    this.engineRunning = running;
    if (running) {
      this.audioManager.play?.('engine_start', { volume: 0.5 });
      setTimeout(() => this.audioManager.play?.('engine_idle', { loop: true, volume: 0.3 }), 1000);
    } else {
      this.audioManager.stop('engine_idle');
      this.audioManager.play?.('engine_stop', { volume: 0.5 });
    }
  }

  isEngineRunning(): boolean {
    return this.engineRunning;
  }

  refuel(amount: number): void {
    this.fuelLevel = Math.min(1, this.fuelLevel + amount / this.specs.fuelCapacity);
  }

  setPosition(position: THREE.Vector3, rotation?: THREE.Euler): void {
    this.chassis.position.copy(position);
    if (rotation) this.chassis.quaternion.setFromEuler(rotation);
    this.physics.setPosition(position, rotation);
  }

  getChassis(): THREE.Group {
    return this.chassis;
  }
  getPhysics(): VehiclePhysics {
    return this.physics;
  }
  getDrivetrain(): Drivetrain {
    return this.drivetrain;
  }

  getSeats(): SeatPosition[] {
    // Default seat positions based on vehicle type
    const seats: SeatPosition[] = [
      // Driver seat
      {
        name: 'driver',
        index: 0,
        position: new THREE.Vector3(-0.45, 0.8, 0.5),
        rotation: new THREE.Euler(0, 0, 0),
        doorIndex: 0,
        isDriver: true,
        hasSteeringWheel: true,
        cameraOffset: new THREE.Vector3(0, 1.1, 0.3),
      },
      // Passenger seat
      {
        name: 'passenger',
        index: 1,
        position: new THREE.Vector3(0.45, 0.8, 0.5),
        rotation: new THREE.Euler(0, 0, 0),
        doorIndex: 1,
        isDriver: false,
        hasSteeringWheel: false,
        cameraOffset: new THREE.Vector3(0, 1.1, 0.3),
      },
      // Rear left
      {
        name: 'rear_left',
        index: 2,
        position: new THREE.Vector3(-0.45, 0.8, -0.5),
        rotation: new THREE.Euler(0, 0, 0),
        doorIndex: 2,
        isDriver: false,
        hasSteeringWheel: false,
        cameraOffset: new THREE.Vector3(0, 1.0, 0),
      },
      // Rear right
      {
        name: 'rear_right',
        index: 3,
        position: new THREE.Vector3(0.45, 0.8, -0.5),
        rotation: new THREE.Euler(0, 0, 0),
        doorIndex: 3,
        isDriver: false,
        hasSteeringWheel: false,
        cameraOffset: new THREE.Vector3(0, 1.0, 0),
      },
    ];
    return seats;
  }

  serialize(): any {
    return {
      id: this.id,
      specs: this.specs,
      position: {
        x: this.chassis.position.x,
        y: this.chassis.position.y,
        z: this.chassis.position.z,
      },
      rotation: {
        x: this.chassis.quaternion.x,
        y: this.chassis.quaternion.y,
        z: this.chassis.quaternion.z,
        w: this.chassis.quaternion.w,
      },
      fuelLevel: this.fuelLevel,
      odometer: this.odometer,
      engineRunning: this.engineRunning,
    };
  }

  deserialize(data: any): void {
    this.fuelLevel = data.fuelLevel;
    this.odometer = data.odometer;
    this.engineRunning = data.engineRunning;
    this.setPosition(
      new THREE.Vector3(data.position.x, data.position.y, data.position.z),
      new THREE.Euler(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w)
    );
  }
}
