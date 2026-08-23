/**
 * Physics Worker - Off-main-thread vehicle physics simulation
 * Handles raycast suspension, Pacejka tire model, drivetrain, weight transfer
 */

import * as Comlink from 'comlink'

// ============================================
// TYPES
// ============================================

export interface VehicleSpecs {
  mass: number
  wheelbase: number
  trackWidth: number
  cgHeight: number
  cgForwardBias: number // 0-1, 0.5 = center

  // Suspension
  springRate: number // N/m
  damperRate: number // Ns/m
  suspensionTravel: number
  springRestLength: number

  // Tires (Pacejka simplified)
  tireRadius: number
  tireWidth: number
  pacejkaB: number // stiffness
  pacejkaC: number // shape
  pacejkaD: number // peak
  pacejkaE: number // curvature

  // Drivetrain
  engineTorqueCurve: [number, number][] // [rpm, torque]
  gearRatios: number[]
  finalDriveRatio: number
  diffType: 'open' | 'lsd' | 'locker'
  lsdPreload: number
  lsdRampAngle: number

  // Aero
  dragCoefficient: number
  frontalArea: number
  downforceCoefficient: number

  // Brakes
  brakeForceFront: number
  brakeForceRear: number
  brakeBias: number // 0-1 front

  // Steering
  maxSteerAngle: number // radians
  steerRatio: number
}

export interface VehicleState {
  position: [number, number, number]
  rotation: [number, number, number, number] // quaternion
  velocity: [number, number, number]
  angularVelocity: [number, number, number]

  // Wheel states
  wheelPositions: [number, number, number][]
  wheelRotations: number[]
  wheelSteerAngles: number[]
  wheelLoads: number[]
  wheelSlipRatios: number[]
  wheelSlipAngles: number[]
  wheelOnGround: boolean[]

  // Engine
  engineRPM: number
  gear: number
  clutchEngagement: number // 0-1
  throttle: number
  brake: number
  handbrake: boolean
}

export interface PhysicsInputs {
  throttle: number // 0-1
  brake: number // 0-1
  steer: number // -1 to 1
  handbrake: boolean
  clutch: number // 0-1 (for manual)
  deltaTime: number
}

export interface PhysicsOutputs extends VehicleState {
  // Forces for audio/visual
  engineTorque: number
  wheelTorques: number[]
  suspensionForces: number[]
  tireForcesLat: number[]
  tireForcesLon: number[]
  aeroDrag: number
  aeroDownforce: number
}

// ============================================
// MATH HELPERS
// ============================================

class Vec3 {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}

  static fromArray(arr: [number, number, number]): Vec3 { return new Vec3(arr[0], arr[1], arr[2]) }
  toArray(): [number, number, number] { return [this.x, this.y, this.z] }
  add(v: Vec3): Vec3 { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z) }
  sub(v: Vec3): Vec3 { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z) }
  mul(s: number): Vec3 { return new Vec3(this.x * s, this.y * s, this.z * s) }
  dot(v: Vec3): number { return this.x * v.x + this.y * v.y + this.z * v.z }
  cross(v: Vec3): Vec3 { return new Vec3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x) }
  length(): number { return Math.sqrt(this.dot(this)) }
  normalize(): Vec3 { const l = this.length(); return l > 0 ? this.mul(1 / l) : new Vec3() }
  lerp(v: Vec3, t: number): Vec3 { return this.add(v.sub(this).mul(t)) }
}

class Quat {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0, public w: number = 1) {}

  static fromArray(arr: [number, number, number, number]): Quat { return new Quat(arr[0], arr[1], arr[2], arr[3]) }
  toArray(): [number, number, number, number] { return [this.x, this.y, this.z, this.w] }
  mul(q: Quat): Quat {
    return new Quat(
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w,
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z
    )
  }
  rotateVector(v: Vec3): Vec3 {
    const qv = new Quat(v.x, v.y, v.z, 0)
    const qc = new Quat(-this.x, -this.y, -this.z, this.w)
    const res = this.mul(qv).mul(qc)
    return new Vec3(res.x, res.y, res.z)
  }
  static fromEuler(x: number, y: number, z: number): Quat {
    const cx = Math.cos(x * 0.5), sx = Math.sin(x * 0.5)
    const cy = Math.cos(y * 0.5), sy = Math.sin(y * 0.5)
    const cz = Math.cos(z * 0.5), sz = Math.sin(z * 0.5)
    return new Quat(
      sx * cy * cz - cx * sy * sz,
      cx * sy * cz + sx * cy * sz,
      cx * cy * sz - sx * sy * cz,
      cx * cy * cz + sx * sy * sz
    )
  }
  getEuler(): [number, number, number] {
    const sinr_cosp = 2 * (this.w * this.x + this.y * this.z)
    const cosr_cosp = 1 - 2 * (this.x * this.x + this.y * this.y)
    const roll = Math.atan2(sinr_cosp, cosr_cosp)

    const sinp = 2 * (this.w * this.y - this.z * this.x)
    const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp)

    const siny_cosp = 2 * (this.w * this.z + this.x * this.y)
    const cosy_cosp = 1 - 2 * (this.y * this.y + this.z * this.z)
    const yaw = Math.atan2(siny_cosp, cosy_cosp)

    return [roll, pitch, yaw]
  }
}

// ============================================
// PACEJKA TIRE MODEL
// ============================================

interface PacejkaParams {
  B: number, C: number, D: number, E: number
}

function pacejkaFormula(slip: number, params: PacejkaParams, load: number): number {
  // F = D * sin(C * atan(B * slip - E * (B * slip - atan(B * slip))))
  // Simplified: scale by load (Fz)
  const B = params.B, C = params.C, D = params.D * load, E = params.E
  const Bslip = B * slip
  return D * Math.sin(C * Math.atan(Bslip - E * (Bslip - Math.atan(Bslip))))
}

// ============================================
// VEHICLE PHYSICS CLASS
// ============================================

class VehiclePhysics {
  private specs: VehicleSpecs
  private state: VehicleState
  private wheelLocalPositions: Vec3[]

  constructor(specs: VehicleSpecs) {
    this.specs = specs
    this.wheelLocalPositions = [
      new Vec3(-specs.trackWidth / 2, -specs.cgHeight, -specs.wheelbase / 2), // FL
      new Vec3(specs.trackWidth / 2, -specs.cgHeight, -specs.wheelbase / 2),  // FR
      new Vec3(-specs.trackWidth / 2, -specs.cgHeight, specs.wheelbase / 2),   // RL
      new Vec3(specs.trackWidth / 2, -specs.cgHeight, specs.wheelbase / 2)     // RR
    ]

    this.state = this.createInitialState()
  }

  private createInitialState(): VehicleState {
    return {
      position: [0, 1, 0],
      rotation: [0, 0, 0, 1],
      velocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      wheelPositions: this.wheelLocalPositions.map(w => w.toArray()),
      wheelRotations: [0, 0, 0, 0],
      wheelSteerAngles: [0, 0, 0, 0],
      wheelLoads: [0, 0, 0, 0],
      wheelSlipRatios: [0, 0, 0, 0],
      wheelSlipAngles: [0, 0, 0, 0],
      wheelOnGround: [false, false, false, false],
      engineRPM: 800,
      gear: 1,
      clutchEngagement: 1,
      throttle: 0,
      brake: 0,
      handbrake: false
    }
  }

  setState(state: Partial<VehicleState>): void {
    Object.assign(this.state, state)
  }

  getState(): VehicleState {
    return { ...this.state }
  }

  step(inputs: PhysicsInputs): PhysicsOutputs {
    const dt = Math.min(inputs.deltaTime, 1 / 60) // clamp

    const rotation = Quat.fromArray(this.state.rotation)
    const forward = rotation.rotateVector(new Vec3(0, 0, -1))
    const right = rotation.rotateVector(new Vec3(1, 0, 0))
    const up = new Vec3(0, 1, 0)

    // ============================================
    // SUSPENSION RAYCASTS
    // ============================================
    const wheelLoads = new Array(4).fill(0)
    const wheelOnGround = new Array(4).fill(false)
    const wheelWorldPositions: Vec3[] = []
    const suspensionForces = new Array(4).fill(0)
    const suspensionVelocities = new Array(4).fill(0)

    for (let i = 0; i < 4; i++) {
      const localPos = this.wheelLocalPositions[i]
      const worldPos = rotation.rotateVector(localPos).add(Vec3.fromArray(this.state.position))
      wheelWorldPositions.push(worldPos)

      // Raycast down
      const rayStart = worldPos
      const rayDir = new Vec3(0, -1, 0)
      const rayLength = this.specs.suspensionTravel + this.specs.tireRadius

      // Simulate ground hit (in real implementation, this would query a heightfield/terrain)
      const hit = this.raycastGround(rayStart, rayDir, rayLength)

      if (hit) {
        const compression = this.specs.springRestLength - hit.distance
        if (compression > 0) {
          wheelOnGround[i] = true

          // Spring force
          const springForce = compression * this.specs.springRate

          // Damper force (approximate from velocity)
          const suspensionVel = -this.state.velocity[1] // simplified
          const damperForce = suspensionVel * this.specs.damperRate

          const totalForce = springForce + damperForce
          wheelLoads[i] = Math.max(0, totalForce)
          suspensionForces[i] = totalForce
          suspensionVelocities[i] = suspensionVel
        }
      }
    }

    // ============================================
    // WEIGHT TRANSFER
    // ============================================
    // Longitudinal weight transfer
    const accelForward = forward.dot(Vec3.fromArray(this.state.velocity)) // simplified
    const longWeightTransfer = this.specs.mass * accelForward * this.specs.cgHeight / this.specs.wheelbase

    // Lateral weight transfer
    const accelRight = right.dot(Vec3.fromArray(this.state.velocity))
    const latWeightTransfer = this.specs.mass * accelRight * this.specs.cgHeight / this.specs.trackWidth

    // Static weight distribution
    const staticLoadFront = this.specs.mass * 9.81 * (1 - this.specs.cgForwardBias) / 2
    const staticLoadRear = this.specs.mass * 9.81 * this.specs.cgForwardBias / 2

    // Apply weight transfer
    wheelLoads[0] += staticLoadFront - longWeightTransfer / 2 - latWeightTransfer / 2 // FL
    wheelLoads[1] += staticLoadFront - longWeightTransfer / 2 + latWeightTransfer / 2 // FR
    wheelLoads[2] += staticLoadRear + longWeightTransfer / 2 - latWeightTransfer / 2   // RL
    wheelLoads[3] += staticLoadRear + longWeightTransfer / 2 + latWeightTransfer / 2   // RR

    // Clamp
    for (let i = 0; i < 4; i++) {
      wheelLoads[i] = Math.max(0, wheelLoads[i])
    }

    // ============================================
    // STEERING
    // ============================================
    const steerAngle = inputs.steer * this.specs.maxSteerAngle
    this.state.wheelSteerAngles[0] = steerAngle
    this.state.wheelSteerAngles[1] = steerAngle
    // Rear steer = 0 for now (could add 4WS)

    // ============================================
    // DRIVETRAIN
    // ============================================
    // Engine RPM from wheel speed (simplified)
    const avgRearWheelSpeed = (this.state.wheelRotations[2] + this.state.wheelRotations[3]) / 2 * this.specs.tireRadius
    const gearRatio = this.specs.gearRatios[this.state.gear] || 1
    const engineRPM = Math.abs(avgRearWheelSpeed) * gearRatio * this.specs.finalDriveRatio * 60 / (2 * Math.PI)
    this.state.engineRPM = Math.max(800, engineRPM * this.state.clutchEngagement + 800 * (1 - this.state.clutchEngagement))

    // Engine torque from curve
    const engineTorque = this.getEngineTorque(this.state.engineRPM) * inputs.throttle * this.state.clutchEngagement

    // Torque to wheels
    const driveTorque = engineTorque * gearRatio * this.specs.finalDriveRatio * 0.85 // efficiency

    // Differential
    let wheelTorques = [0, 0, 0, 0]
    if (this.specs.diffType === 'open') {
      // Split equally
      wheelTorques[2] = driveTorque / 2
      wheelTorques[3] = driveTorque / 2
    } else if (this.specs.diffType === 'lsd') {
      // Limited slip - bias to wheel with more grip
      const loadDiff = Math.abs(wheelLoads[2] - wheelLoads[3])
      const bias = 1 + this.specs.lsdPreload + loadDiff * 0.001
      const totalLoad = wheelLoads[2] + wheelLoads[3]
      wheelTorques[2] = driveTorque * (wheelLoads[2] / totalLoad) * bias
      wheelTorques[3] = driveTorque * (wheelLoads[3] / totalLoad) * bias
    }

    // Apply brake torque
    const brakeTorqueFront = inputs.brake * this.specs.brakeForceFront * this.specs.brakeBias
    const brakeTorqueRear = inputs.brake * this.specs.brakeForceRear * (1 - this.specs.brakeBias)
    const handbrakeTorque = inputs.handbrake ? this.specs.brakeForceRear * 2 : 0

    wheelTorques[0] -= brakeTorqueFront
    wheelTorques[1] -= brakeTorqueFront
    wheelTorques[2] -= brakeTorqueRear + handbrakeTorque
    wheelTorques[3] -= brakeTorqueRear + handbrakeTorque

    // ============================================
    // TIRE FORCES (PACEJKA)
    // ============================================
    const tireForcesLat = new Array(4).fill(0)
    const tireForcesLon = new Array(4).fill(0)
    const slipRatios = new Array(4).fill(0)
    const slipAngles = new Array(4).fill(0)

    const pacejkaLat: PacejkaParams = { B: this.specs.pacejkaB, C: this.specs.pacejkaC, D: this.specs.pacejkaD, E: this.specs.pacejkaE }
    const pacejkaLon: PacejkaParams = { B: this.specs.pacejkaB * 1.2, C: this.specs.pacejkaC, D: this.specs.pacejkaD * 1.2, E: this.specs.pacejkaE }

    for (let i = 0; i < 4; i++) {
      if (!wheelOnGround[i]) continue

      // Wheel velocity in world space
      const wheelForward = rotation.rotateVector(new Vec3(
        Math.sin(this.state.wheelSteerAngles[i]),
        0,
        Math.cos(this.state.wheelSteerAngles[i])
      ))
      const wheelRight = wheelForward.cross(up).normalize()

      const wheelWorldVel = Vec3.fromArray(this.state.velocity)
      const wheelVelForward = wheelWorldVel.dot(wheelForward)
      const wheelVelRight = wheelWorldVel.dot(wheelRight)

      // Slip ratio (longitudinal)
      const wheelCircumference = 2 * Math.PI * this.specs.tireRadius
      const wheelSpeed = this.state.wheelRotations[i] * this.specs.tireRadius
      slipRatios[i] = wheelCircumference > 0.01 ? (wheelSpeed - wheelVelForward) / Math.max(0.1, Math.abs(wheelVelForward)) : 0

      // Slip angle (lateral)
      slipAngles[i] = wheelVelForward !== 0 ? Math.atan2(wheelVelRight, Math.abs(wheelVelForward)) : 0

      // Pacejka forces
      const load = wheelLoads[i]
      tireForcesLon[i] = pacejkaFormula(slipRatios[i], pacejkaLon, load / (this.specs.mass * 9.81 / 4))
      tireForcesLat[i] = pacejkaFormula(slipAngles[i], pacejkaLat, load / (this.specs.mass * 9.81 / 4))

      // Add drive/brake torque as longitudinal force
      tireForcesLon[i] += wheelTorques[i] / this.specs.tireRadius
    }

    // ============================================
    // INTEGRATE FORCES
    // ============================================
    let totalForce = new Vec3(0, 0, 0)
    let totalTorque = new Vec3(0, 0, 0)

    for (let i = 0; i < 4; i++) {
      if (!wheelOnGround[i]) continue

      const wheelForward = rotation.rotateVector(new Vec3(
        Math.sin(this.state.wheelSteerAngles[i]),
        0,
        Math.cos(this.state.wheelSteerAngles[i])
      ))
      const wheelRight = wheelForward.cross(up).normalize()

      // Longitudinal force in wheel direction
      const forceLon = wheelForward.mul(tireForcesLon[i])
      // Lateral force perpendicular to wheel
      const forceLat = wheelRight.mul(tireForcesLat[i])

      const wheelForce = forceLon.add(forceLat)
      totalForce = totalForce.add(wheelForce)

      // Torque from forces at contact patch
      const contactPatch = wheelWorldPositions[i].sub(Vec3.fromArray(this.state.position))
      totalTorque = totalTorque.add(contactPatch.cross(wheelForce))
    }

    // Aero forces
    const speed = Vec3.fromArray(this.state.velocity).length()
    const aeroDrag = 0.5 * 1.225 * this.specs.dragCoefficient * this.specs.frontalArea * speed * speed
    const aeroDownforce = 0.5 * 1.225 * this.specs.downforceCoefficient * this.specs.frontalArea * speed * speed

    totalForce = totalForce.add(forward.mul(-aeroDrag))
    totalForce = totalForce.add(up.mul(-aeroDownforce))

    // Gravity
    totalForce = totalForce.add(new Vec3(0, -this.specs.mass * 9.81, 0))

    // Integrate linear motion
    const acceleration = totalForce.mul(1 / this.specs.mass)
    const newVel = Vec3.fromArray(this.state.velocity).add(acceleration.mul(dt))
    this.state.velocity = newVel.toArray()

    const newPos = Vec3.fromArray(this.state.position).add(newVel.mul(dt))
    this.state.position = newPos.toArray()

    // Integrate angular motion (simplified - using diagonal inertia tensor)
    const inertiaY = this.specs.mass * (this.specs.wheelbase * this.specs.wheelbase + this.specs.trackWidth * this.specs.trackWidth) / 12
    const angularAccel = totalTorque.y / inertiaY
    this.state.angularVelocity[1] += angularAccel * dt

    // Update rotation
    const deltaYaw = this.state.angularVelocity[1] * dt
    const deltaRot = Quat.fromEuler(0, deltaYaw, 0)
    const newRot = rotation.mul(deltaRot)
    this.state.rotation = newRot.toArray()

    // Update wheel rotations
    for (let i = 0; i < 4; i++) {
      if (wheelOnGround[i]) {
        const wheelForce = tireForcesLon[i]
        const wheelAngularAccel = wheelForce * this.specs.tireRadius / (1.5) // approximate wheel inertia
        this.state.wheelRotations[i] += wheelAngularAccel * dt
      }
    }

    // Update wheel positions
    this.state.wheelPositions = wheelWorldPositions.map(w => w.toArray())
    this.state.wheelLoads = wheelLoads
    this.state.wheelSlipRatios = slipRatios
    this.state.wheelSlipAngles = slipAngles
    this.state.wheelOnGround = wheelOnGround

    this.state.throttle = inputs.throttle
    this.state.brake = inputs.brake
    this.state.handbrake = inputs.handbrake

    return {
      ...this.state,
      engineTorque,
      wheelTorques,
      suspensionForces,
      tireForcesLat,
      tireForcesLon,
      aeroDrag,
      aeroDownforce
    }
  }

  private getEngineTorque(rpm: number): number {
    const curve = this.specs.engineTorqueCurve
    if (rpm <= curve[0][0]) return curve[0][1]
    if (rpm >= curve[curve.length - 1][0]) return curve[curve.length - 1][1]

    for (let i = 0; i < curve.length - 1; i++) {
      if (rpm >= curve[i][0] && rpm <= curve[i + 1][0]) {
        const t = (rpm - curve[i][0]) / (curve[i + 1][0] - curve[i][0])
        return curve[i][1] + (curve[i + 1][1] - curve[i][1]) * t
      }
    }
    return 0
  }

  private raycastGround(origin: Vec3, dir: Vec3, maxDist: number): { distance: number; normal: Vec3 } | null {
    // Simplified: flat ground at y=0
    if (dir.y < 0 && origin.y > 0) {
      const dist = origin.y / -dir.y
      if (dist <= maxDist) {
        return { distance: dist, normal: new Vec3(0, 1, 0) }
      }
    }
    return null
  }
}

// ============================================
// WORKER API
// ============================================

const PhysicsWorker = {
  init(): void {
    console.log('[PhysicsWorker] Initialized')
  },

  createVehicle(specs: VehicleSpecs): VehiclePhysics {
    return new VehiclePhysics(specs)
  },

  step(vehicle: VehiclePhysics, inputs: PhysicsInputs): PhysicsOutputs {
    return vehicle.step(inputs)
  },

  getState(vehicle: VehiclePhysics): VehicleState {
    return vehicle.getState()
  },

  setState(vehicle: VehiclePhysics, state: Partial<VehicleState>): void {
    vehicle.setState(state)
  }
}

export type PhysicsWorkerAPI = typeof PhysicsWorker

Comlink.expose(PhysicsWorker)

console.log('[PhysicsWorker] Initialized and ready')