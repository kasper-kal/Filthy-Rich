import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { VehicleSpecsData } from './VehicleSpecs.js';
import {
  SuspensionSpecs,
  WheelSpecs,
  AeroSpecs,
  BrakeSpecs,
  SteeringSpecs,
} from './VehicleSpecs.js';
import type { DamageModel } from './DamageModel.js';
import { DamageEvent } from './DamageModel.js';

// ============================================
// PHYSICS MATERIALS & CONSTANTS
// ============================================

const GRAVITY = 9.81;
const METERS_PER_SECOND_TO_KMH = 3.6;

// Pacejka Magic Formula constants (simplified)
interface PacejkaCoeffs {
  B: number; // Stiffness
  C: number; // Shape
  D: number; // Peak
  E: number; // Curvature
}

interface WheelContactResult {
  hasContact: boolean;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  force: number;
  slipAngle: number;
  slipRatio: number;
  lateralForce: number;
  longitudinalForce: number;
}

interface SuspensionState {
  compression: number; // 0-1 (0 = fully extended, 1 = fully compressed)
  velocity: number; // m/s
  force: number; // N
  length: number; // current spring length
}

interface WheelPhysicsState {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  steeringAngle: number;
  rotationSpeed: number; // rad/s
  suspension: SuspensionState;
  contact: WheelContactResult;
  load: number; // N
  temperature: number; // Celsius
  wear: number; // 0-1
}

// ============================================
// VEHICLE PHYSICS CLASS
// ============================================

export class VehiclePhysics {
  private specs: VehicleSpecsData;
  private damageModel: DamageModel;

  // Cannon.js bodies
  private chassisBody!: CANNON.Body;
  private wheelBodies: CANNON.Body[] = [];
  private vehicle!: CANNON.RaycastVehicle;

  // Three.js sync
  private chassisMesh: THREE.Object3D | null = null;

  // Wheel states
  private wheelStates: WheelPhysicsState[] = [];
  private wheelContactPoints: THREE.Vector3[] = [];
  private wheelContactNormals: THREE.Vector3[] = [];

  // Vehicle state
  private speed = 0; // m/s
  private velocity = new THREE.Vector3();
  private angularVelocity = new THREE.Vector3();
  private engineRPM = 800;
  private gear = 1;
  private throttle = 0;
  private brake = 0;
  private steering = 0;
  private handbrake = false;

  // Aerodynamics
  private aeroDragForce = new THREE.Vector3();
  private aeroDownforce = 0;

  // Weight transfer
  private weightTransferFront = 0;
  private weightTransferRear = 0;
  private weightTransferLateral = 0;

  // Steering
  private steeringAngle = 0; // current steering angle (radians)
  private targetSteeringAngle = 0;

  // Input smoothing
  private throttleSmooth = 0;
  private brakeSmooth = 0;
  private steeringSmooth = 0;

  // Damage
  private chassisDamage = 0;

  // Debug
  private debugDraw = false;

  constructor(specs: VehicleSpecsData, damageModel: DamageModel) {
    this.specs = specs;
    this.damageModel = damageModel;

    // Initialize wheel states
    for (let i = 0; i < 4; i++) {
      this.wheelStates.push({
        position: new THREE.Vector3(),
        rotation: new THREE.Quaternion(),
        steeringAngle: 0,
        rotationSpeed: 0,
        suspension: {
          compression: 0,
          velocity: 0,
          force: 0,
          length: specs.suspension[i < 2 ? 'front' : 'rear'].travel,
        },
        contact: {
          hasContact: false,
          point: new THREE.Vector3(),
          normal: new THREE.Vector3(0, 1, 0),
          distance: 0,
          force: 0,
          slipAngle: 0,
          slipRatio: 0,
          lateralForce: 0,
          longitudinalForce: 0,
        },
        load: 0,
        temperature: 20,
        wear: 0,
      });
      this.wheelContactPoints.push(new THREE.Vector3());
      this.wheelContactNormals.push(new THREE.Vector3(0, 1, 0));
    }

    // Create physics world
    this.createPhysicsWorld();
  }

  private createPhysicsWorld(): void {
    // Create chassis body
    const mass = this.specs.mass;
    const chassisShape = new CANNON.Box(
      new CANNON.Vec3(
        this.specs.dimensions.width / 2,
        this.specs.dimensions.height / 2,
        this.specs.dimensions.length / 2
      )
    );

    this.chassisBody = new CANNON.Body({ mass, shape: chassisShape });
    this.chassisBody.position.set(0, 1, 0);
    this.chassisBody.angularDamping = 0.1;
    this.chassisBody.linearDamping = 0.01;

    // Set center of mass by adjusting shape offset
    const com = this.specs.centerOfMass;
    this.chassisBody.shapeOffsets[0].set(com.x, com.y, com.z);

    // Create raycast vehicle
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    // Add wheels
    const wheelOptions = {
      radius: this.specs.wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
      suspensionStiffness: this.specs.suspension.front.springRate,
      suspensionRestLength: this.specs.suspension.front.travel,
      maxSuspensionForce: 100000,
      maxSuspensionTravel: this.specs.suspension.front.travel,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
      frictionSlip: 1.5,
      sideAcceleration: 0,
    };

    // Wheel positions (FL, FR, RL, RR). These used to sit at `halfLength - 0.15`,
    // which put the axles almost in the bumpers and made a real wheel arch
    // impossible; the spec's wheelbase and track are the honest numbers
    // (FINALLY-3D.md §10.0). The body models cut their arches at exactly these
    // points, so moving one without the other leaves the wheels outside the car.
    const halfTrackFront = this.specs.dimensions.trackFront / 2;
    const halfTrackRear = this.specs.dimensions.trackRear / 2;
    const halfBase = this.specs.dimensions.wheelbase / 2;
    const wheelPositions = [
      new CANNON.Vec3(-halfTrackFront, 0, halfBase), // FL
      new CANNON.Vec3(halfTrackFront, 0, halfBase), // FR
      new CANNON.Vec3(-halfTrackRear, 0, -halfBase), // RL
      new CANNON.Vec3(halfTrackRear, 0, -halfBase), // RR
    ];

    for (let i = 0; i < 4; i++) {
      const isFront = i < 2;
      const susp = this.specs.suspension[isFront ? 'front' : 'rear'];

      const options = {
        ...wheelOptions,
        chassisConnectionPointLocal: wheelPositions[i],
        directionLocal: new CANNON.Vec3(0, -1, 0),
        axleLocal: new CANNON.Vec3(-1, 0, 0),
        suspensionStiffness: susp.springRate,
        suspensionRestLength: susp.travel,
        maxSuspensionForce: susp.springRate * susp.travel * 2,
        maxSuspensionTravel: susp.travel,
        frictionSlip: this.specs.wheels[isFront ? 'front' : 'rear'].frictionCurve.D,
      };

      this.vehicle.addWheel(options);
    }
  }

  /**
   * Main physics update
   */
  update(
    deltaTime: number,
    input: { throttle: number; brake: number; steering: number; handbrake: boolean }
  ): void {
    // Smooth inputs
    this.throttleSmooth = THREE.MathUtils.lerp(this.throttleSmooth, input.throttle, deltaTime * 10);
    this.brakeSmooth = THREE.MathUtils.lerp(this.brakeSmooth, input.brake, deltaTime * 15);
    this.steeringSmooth = THREE.MathUtils.lerp(this.steeringSmooth, input.steering, deltaTime * 8);
    this.handbrake = input.handbrake;

    this.throttle = this.throttleSmooth;
    this.brake = this.brakeSmooth;
    this.steering = this.steeringSmooth;

    // Update steering angle
    this.updateSteering(deltaTime);

    // Apply engine torque to driven wheels
    this.applyEngineTorque();

    // Apply braking
    this.applyBraking();

    // Apply steering to front wheels
    this.applySteering();

    // Apply handbrake to rear wheels
    if (this.handbrake) {
      this.vehicle.setBrake(this.specs.brakes.maxTorqueRear * 2, 2);
      this.vehicle.setBrake(this.specs.brakes.maxTorqueRear * 2, 3);
    }

    // Step physics
    this.stepPhysics(deltaTime);

    // Update wheel states from physics
    this.updateWheelStates(deltaTime);

    // Calculate aerodynamics
    this.updateAerodynamics();

    // Calculate weight transfer
    this.updateWeightTransfer();

    // Update speed
    this.updateSpeed();

    // Apply damage forces
    this.applyDamageEffects();
  }

  private updateSteering(deltaTime: number): void {
    // Speed-sensitive steering
    const speedFactor = THREE.MathUtils.mapLinear(
      this.speed,
      0,
      50,
      1,
      this.specs.steering.speedSensitivity
    );
    this.targetSteeringAngle = this.steering * this.specs.steering.maxAngle * speedFactor;

    // Steering rate limiting
    const maxSteerRate = Math.PI * 2; // rad/s
    const steerDiff = this.targetSteeringAngle - this.steeringAngle;
    const maxChange = maxSteerRate * deltaTime;
    this.steeringAngle += THREE.MathUtils.clamp(steerDiff, -maxChange, maxChange);
  }

  private applyEngineTorque(): void {
    // Get driven wheels based on drivetrain (simplified - FWD for now)
    // In reality, this would come from the Drivetrain class
    const drivenWheels = [0, 1]; // Front wheels for FWD

    // Engine torque would come from drivetrain
    // For now, apply a placeholder
    const engineTorque = this.throttle * 300; // Nm placeholder

    for (const wheelIndex of drivenWheels) {
      this.vehicle.applyEngineForce(engineTorque * this.getCurrentGearRatio(), wheelIndex);
    }
  }

  private applyBraking(): void {
    const frontBrakeForce = this.brake * this.specs.brakes.maxTorqueFront;
    const rearBrakeForce = this.brake * this.specs.brakes.maxTorqueRear;

    this.vehicle.setBrake(frontBrakeForce, 0);
    this.vehicle.setBrake(frontBrakeForce, 1);
    this.vehicle.setBrake(rearBrakeForce, 2);
    this.vehicle.setBrake(rearBrakeForce, 3);
  }

  private applySteering(): void {
    this.vehicle.setSteeringValue(this.steeringAngle, 0);
    this.vehicle.setSteeringValue(this.steeringAngle, 1);
  }

  private stepPhysics(deltaTime: number): void {
    // Fixed timestep for stability
    const fixedTimeStep = 1 / 60;
    const maxSubSteps = 3;

    // Apply aerodynamic forces to chassis
    this.chassisBody.applyForce(
      new CANNON.Vec3(this.aeroDragForce.x, this.aeroDownforce, this.aeroDragForce.z),
      this.chassisBody.position
    );

    // Step vehicle
    this.vehicle.updateVehicle(fixedTimeStep);

    // Sync chassis body
    this.chassisBody.position.copy(this.vehicle.chassisBody.position);
    this.chassisBody.quaternion.copy(this.vehicle.chassisBody.quaternion);
  }

  private updateWheelStates(deltaTime: number): void {
    for (let i = 0; i < 4; i++) {
      const wheel = this.vehicle.wheelInfos[i];
      const state = this.wheelStates[i];

      // Position
      this.vehicle.updateWheelTransform(i);
      const t = wheel.worldTransform;
      state.position.set(t.position.x, t.position.y, t.position.z);
      state.rotation.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w);

      // Steering angle
      if (i < 2) {
        state.steeringAngle = this.steeringAngle;
      }

      // Suspension
      const suspensionLength = wheel.suspensionLength;
      const maxTravel = this.specs.suspension[i < 2 ? 'front' : 'rear'].travel;
      state.suspension.length = suspensionLength;
      state.suspension.compression = 1 - suspensionLength / maxTravel;
      state.suspension.compression = THREE.MathUtils.clamp(state.suspension.compression, 0, 1);

      // Suspension force (approximate)
      const springRate = this.specs.suspension[i < 2 ? 'front' : 'rear'].springRate;
      state.suspension.force = springRate * (maxTravel - suspensionLength);

      // Contact
      state.contact.hasContact = wheel.isInContact;
      if (wheel.isInContact) {
        state.contact.point.copy(state.position);
        state.contact.normal.set(0, 1, 0); // Raycast gives up direction
        state.contact.force = state.suspension.force;
      }

      // Wheel rotation speed - calculate from wheel rotation
      state.rotationSpeed = wheel.rotation ? wheel.rotation : 0;

      // Calculate load (weight on wheel)
      state.load = this.calculateWheelLoad(i);

      // Temperature and wear
      this.updateWheelTemperatureAndWear(i, deltaTime);
    }
  }

  private calculateWheelLoad(wheelIndex: number): number {
    // Static weight distribution
    const totalMass = this.specs.mass;
    const weightDistributionFront = 0.55; // Approximate for FWD
    const staticLoadFront = ((totalMass * weightDistributionFront) / 2) * GRAVITY;
    const staticLoadRear = ((totalMass * (1 - weightDistributionFront)) / 2) * GRAVITY;

    let staticLoad = wheelIndex < 2 ? staticLoadFront : staticLoadRear;

    // Add weight transfer
    if (wheelIndex < 2) {
      staticLoad += this.weightTransferFront / 2;
      staticLoad += ((wheelIndex === 0 ? -1 : 1) * this.weightTransferLateral) / 2;
    } else {
      staticLoad += this.weightTransferRear / 2;
      staticLoad += ((wheelIndex === 2 ? -1 : 1) * this.weightTransferLateral) / 2;
    }

    // Add downforce
    staticLoad += this.aeroDownforce * (wheelIndex < 2 ? 0.5 : 0.5);

    return Math.max(0, staticLoad);
  }

  private updateWheelTemperatureAndWear(wheelIndex: number, deltaTime: number): void {
    const state = this.wheelStates[wheelIndex];

    // Temperature increases with slip and load
    const slipHeat =
      (Math.abs(state.contact.slipRatio) + Math.abs(state.contact.slipAngle)) * state.load * 0.001;
    const loadHeat = (state.load / 5000) * 0.1;
    const coolingRate = 0.05 * deltaTime;

    state.temperature += (slipHeat + loadHeat - coolingRate) * deltaTime;
    state.temperature = THREE.MathUtils.clamp(state.temperature, 0, 200);

    // Wear increases with temperature and slip
    if (state.temperature > 100) {
      state.wear += (state.temperature - 100) * 0.00001 * deltaTime;
    }
    state.wear +=
      (Math.abs(state.contact.slipRatio) + Math.abs(state.contact.slipAngle)) * 0.0001 * deltaTime;
    state.wear = THREE.MathUtils.clamp(state.wear, 0, 1);
  }

  private updateAerodynamics(): void {
    const aero = this.specs.aero;
    const speedSq = this.speed * this.speed;

    // Drag force (opposite to velocity)
    const dragMagnitude = 0.5 * 1.225 * aero.dragCoefficient * aero.frontalArea * speedSq;
    const velocityDir = this.velocity.clone().normalize();
    this.aeroDragForce.set(-velocityDir.x * dragMagnitude, 0, -velocityDir.z * dragMagnitude);

    // Downforce
    this.aeroDownforce = 0.5 * 1.225 * aero.downforceCoefficient * aero.frontalArea * speedSq;

    // Lift (negative downforce at high speed for some cars)
    const liftForce = 0.5 * 1.225 * aero.liftCoefficient * aero.frontalArea * speedSq;
    this.aeroDownforce -= liftForce;
  }

  private updateWeightTransfer(): void {
    const mass = this.specs.mass;
    const cgHeight = this.specs.centerOfMass.y;
    const wheelbase = this.specs.dimensions.wheelbase;
    const trackWidth = this.specs.dimensions.trackFront;

    // Longitudinal weight transfer (acceleration/braking) - use throttle/brake as approximation
    const longitudinalAccel = (this.throttle - this.brake) * 10; // Approximate max accel
    this.weightTransferFront = (-mass * longitudinalAccel * cgHeight) / wheelbase;
    this.weightTransferRear = -this.weightTransferFront;

    // Lateral weight transfer (cornering)
    const lateralAccel = this.getLateralAcceleration();
    this.weightTransferLateral = (mass * lateralAccel * cgHeight) / trackWidth;
  }

  private updateSpeed(): void {
    const vel = this.chassisBody.velocity;
    this.velocity.set(vel.x, vel.y, vel.z);
    this.speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

    const angVel = this.chassisBody.angularVelocity;
    this.angularVelocity.set(angVel.x, angVel.y, angVel.z);
  }

  private applyDamageEffects(): void {
    // Apply mechanical damage effects to physics
    const mechState = this.damageModel.getMechanicalState();

    // Engine power loss
    const engineHealth = mechState.subsystems.get('engine_block')?.health || 100;
    if (engineHealth < 100) {
      // Would reduce engine torque in drivetrain
    }

    // Brake fade
    const brakeHealthFront = mechState.subsystems.get('brakes_front')?.health || 100;
    const brakeHealthRear = mechState.subsystems.get('brakes_rear')?.health || 100;
    // Would reduce brake force

    // Suspension damage
    const suspHealthFront = mechState.subsystems.get('suspension_front')?.health || 100;
    const suspHealthRear = mechState.subsystems.get('suspension_rear')?.health || 100;
    // Would soften springs, reduce damping

    // Tire damage
    // Would reduce friction
  }

  private getCurrentGearRatio(): number {
    // Placeholder - would come from gearbox
    const ratios = [3.5, 2.1, 1.4, 1.0, 0.8];
    return ratios[this.gear - 1] || 1;
  }

  private getLateralAcceleration(): number {
    // Calculate from angular velocity and speed
    if (this.speed < 0.1) return 0;
    return this.angularVelocity.y * this.speed;
  }

  // ============================================
  // PACEJKA TIRE MODEL (Simplified)
  // ============================================

  /**
   * Calculate lateral force using Pacejka Magic Formula
   */
  calculateLateralForce(slipAngle: number, load: number, coeffs: PacejkaCoeffs): number {
    if (load < 100) return 0;

    // Normalize slip angle to radians
    const alpha = slipAngle;

    // Magic Formula: y = D * sin(C * arctan(B * x - E * (B * x - arctan(B * x))))
    const B = coeffs.B;
    const C = coeffs.C;
    const D = coeffs.D * (load / 4000); // Scale by load
    const E = coeffs.E;

    const Bx = B * alpha;
    const arctanBx = Math.atan(Bx);
    const inner = Bx - E * (Bx - arctanBx);
    const force = D * Math.sin(C * Math.atan(inner));

    return force;
  }

  /**
   * Calculate longitudinal force using Pacejka
   */
  calculateLongitudinalForce(slipRatio: number, load: number, coeffs: PacejkaCoeffs): number {
    if (load < 100) return 0;

    const B = coeffs.B;
    const C = coeffs.C;
    const D = coeffs.D * (load / 4000);
    const E = coeffs.E;

    const Bx = B * slipRatio;
    const arctanBx = Math.atan(Bx);
    const inner = Bx - E * (Bx - arctanBx);
    const force = D * Math.sin(C * Math.atan(inner));

    return force;
  }

  /**
   * Calculate combined slip (lateral + longitudinal)
   */
  calculateCombinedForces(
    slipAngle: number,
    slipRatio: number,
    load: number,
    coeffs: PacejkaCoeffs
  ): { lateral: number; longitudinal: number } {
    const Fy0 = this.calculateLateralForce(slipAngle, load, coeffs);
    const Fx0 = this.calculateLongitudinalForce(slipRatio, load, coeffs);

    // Simple friction circle combination
    const mu = coeffs.D;
    const Fz = load;
    const Fmax = mu * Fz;

    const Ftotal = Math.sqrt(Fx0 * Fx0 + Fy0 * Fy0);
    if (Ftotal > Fmax && Ftotal > 0) {
      const scale = Fmax / Ftotal;
      return { lateral: Fy0 * scale, longitudinal: Fx0 * scale };
    }

    return { lateral: Fy0, longitudinal: Fx0 };
  }

  // ============================================
  // PUBLIC API
  // ============================================

  setChassisMesh(mesh: THREE.Object3D): void {
    this.chassisMesh = mesh;
  }

  getSpeed(): number {
    return this.speed * METERS_PER_SECOND_TO_KMH; // km/h
  }

  getSpeedMS(): number {
    return this.speed;
  }

  getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }

  getEngineRPM(): number {
    return this.engineRPM;
  }

  setEngineRPM(rpm: number): void {
    this.engineRPM = rpm;
  }

  getGear(): number {
    return this.gear;
  }

  setGear(gear: number): void {
    this.gear = gear;
  }

  getSteeringAngle(): number {
    return this.steeringAngle;
  }

  getWheelStates(): WheelPhysicsState[] {
    return this.wheelStates.map(s => ({ ...s }));
  }

  getChassisPosition(): THREE.Vector3 {
    const pos = this.chassisBody.position;
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  getChassisRotation(): THREE.Quaternion {
    const q = this.chassisBody.quaternion;
    return new THREE.Quaternion(q.x, q.y, q.z, q.w);
  }

  getState(): { position: THREE.Vector3; rotation: THREE.Quaternion } {
    return {
      position: this.getChassisPosition(),
      rotation: this.getChassisRotation(),
    };
  }

  getChassisDamage(): number {
    return this.chassisDamage;
  }

  applyImpact(force: number, location: THREE.Vector3, direction: THREE.Vector3): void {
    this.chassisDamage = Math.min(1, this.chassisDamage + force / 100000);

    // Apply to damage model
    this.damageModel.applyDamage({
      type: 'impact',
      force,
      location,
      direction,
      severity: Math.min(1, force / 50000),
    });

    // Apply impulse to physics body
    const impulse = new CANNON.Vec3(direction.x * force, direction.y * force, direction.z * force);
    this.chassisBody.applyImpulse(impulse, new CANNON.Vec3(location.x, location.y, location.z));
  }

  applyDamage(damage: number, subsystem: string): void {
    this.damageModel.applyDamage({
      type: 'wear',
      subsystem: subsystem as any,
      severity: damage,
    });
  }

  getLateralG(): number {
    return this.getLateralAcceleration() / GRAVITY;
  }

  getLongitudinalG(): number {
    // Approximate from throttle/brake input since cannon-es doesn't expose acceleration directly
    return ((this.throttle - this.brake) * 10) / GRAVITY;
  }

  isAirborne(): boolean {
    return this.wheelStates.every(w => !w.contact.hasContact);
  }

  getWheelContactCount(): number {
    return this.wheelStates.filter(w => w.contact.hasContact).length;
  }

  setPosition(position: THREE.Vector3, rotation?: THREE.Euler): void {
    this.chassisBody.position.set(position.x, position.y, position.z);
    if (rotation) {
      const q = new CANNON.Quaternion();
      q.setFromEuler(rotation.x, rotation.y, rotation.z);
      this.chassisBody.quaternion.copy(q);
    }
    this.vehicle.wheelInfos.forEach(w => {
      w.suspensionLength = this.specs.suspension.front.travel;
    });
  }

  reset(): void {
    this.chassisBody.position.set(0, 1, 0);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.quaternion.set(0, 0, 0, 1);
    this.speed = 0;
    this.engineRPM = this.specs.drivetrain?.engine?.idleRPM || 800;
    this.gear = 1;
    this.chassisDamage = 0;
    this.throttle = 0;
    this.brake = 0;
    this.steering = 0;
    this.handbrake = false;
  }

  serialize(): any {
    return {
      position: {
        x: this.chassisBody.position.x,
        y: this.chassisBody.position.y,
        z: this.chassisBody.position.z,
      },
      rotation: {
        x: this.chassisBody.quaternion.x,
        y: this.chassisBody.quaternion.y,
        z: this.chassisBody.quaternion.z,
        w: this.chassisBody.quaternion.w,
      },
      velocity: {
        x: this.chassisBody.velocity.x,
        y: this.chassisBody.velocity.y,
        z: this.chassisBody.velocity.z,
      },
      speed: this.speed,
      engineRPM: this.engineRPM,
      gear: this.gear,
      chassisDamage: this.chassisDamage,
    };
  }

  deserialize(data: any): void {
    this.setPosition(
      new THREE.Vector3(data.position.x, data.position.y, data.position.z),
      new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w)
      )
    );
    this.chassisBody.velocity.set(data.velocity.x, data.velocity.y, data.velocity.z);
    this.speed = data.speed;
    this.engineRPM = data.engineRPM;
    this.gear = data.gear;
    this.chassisDamage = data.chassisDamage;
  }

  getChassisBody(): CANNON.Body {
    return this.chassisBody;
  }

  getVehicle(): CANNON.RaycastVehicle {
    return this.vehicle;
  }
}
