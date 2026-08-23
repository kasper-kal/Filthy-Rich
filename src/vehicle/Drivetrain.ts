import * as THREE from 'three'

/**
 * Drivetrain - Engine, gearbox, differential, clutch simulation
 * Sim-cade model with realistic torque curves and gear ratios
 */

// ============================================
// ENGINE
// ============================================

export interface EngineSpecs {
  // Basic
  displacement: number // liters
  cylinders: number
  layout: 'inline' | 'v' | 'boxer' | 'rotary'
  aspiration: 'na' | 'turbo' | 'supercharged' | 'twin-turbo'

  // Limits
  redlineRPM: number
  limiterRPM: number
  idleRPM: number

  // Torque curve (normalized 0-1 RPM, 0-1 torque)
  torqueCurve: number[][] // [[rpm, torque], ...] normalized

  // Power
  maxPowerKW: number
  maxPowerRPM: number
  maxTorqueNm: number
  maxTorqueRPM: number

  // Response
  inertia: number // kg*m^2
  frictionTorque: number // Nm at redline
  compressionBraking: number // factor

  // Turbo
  turboLag: number // seconds to spool
  maxBoost: number // bar
  boostThresholdRPM: number

  // Sound
  soundProfile: 'inline4' | 'v6' | 'v8' | 'v12' | 'boxer4' | 'rotary' | 'diesel' | 'electric'
}

export interface EngineState {
  rpm: number
  throttle: number // 0-1
  load: number // 0-1
  torque: number // Nm
  power: number // kW
  boost: number // bar
  temperature: number // Celsius
  oilPressure: number // bar
  fuelConsumption: number // L/h
  isStalled: boolean
  isOverRevving: boolean
}

const DEFAULT_ENGINE_SPECS: EngineSpecs = {
  displacement: 2.0,
  cylinders: 4,
  layout: 'inline',
  aspiration: 'turbo',
  redlineRPM: 6500,
  limiterRPM: 6800,
  idleRPM: 800,
  torqueCurve: [
    [0, 0.3],
    [0.15, 0.6],
    [0.3, 0.85],
    [0.45, 1.0],
    [0.6, 0.95],
    [0.75, 0.85],
    [0.9, 0.6],
    [1, 0.3]
  ],
  maxPowerKW: 180,
  maxPowerRPM: 5500,
  maxTorqueNm: 350,
  maxTorqueRPM: 3000,
  inertia: 0.3,
  frictionTorque: 50,
  compressionBraking: 0.15,
  turboLag: 0.5,
  maxBoost: 1.2,
  boostThresholdRPM: 2000,
  soundProfile: 'inline4'
}

export class Engine {
  private specs: EngineSpecs
  private state: EngineState

  // Internal
  private currentBoost = 0
  private targetBoost = 0
  private turboSpoolRate = 0

  constructor(specs: Partial<EngineSpecs> = {}) {
    this.specs = { ...DEFAULT_ENGINE_SPECS, ...specs }
    this.state = this.createInitialState()
  }

  private createInitialState(): EngineState {
    return {
      rpm: this.specs.idleRPM,
      throttle: 0,
      load: 0,
      torque: 0,
      power: 0,
      boost: 0,
      temperature: 90,
      oilPressure: 4,
      fuelConsumption: 0,
      isStalled: false,
      isOverRevving: false
    }
  }

  /**
   * Update engine simulation
   */
  update(deltaTime: number, clutchEngagement: number, gearboxInputTorque: number): EngineState {
    // Calculate target boost based on throttle and RPM
    this.updateTurbo(deltaTime)

    // Calculate engine torque
    const torque = this.calculateTorque()

    // Net torque = engine torque - friction - compression braking - gearbox load
    const frictionTorque = this.specs.frictionTorque * (this.state.rpm / this.specs.redlineRPM)
    const compressionTorque = this.specs.compressionBraking * torque * (1 - this.state.throttle)
    const netTorque = torque - frictionTorque - compressionTorque - gearboxInputTorque * clutchEngagement

    // Angular acceleration
    const angularAccel = netTorque / this.specs.inertia

    // Update RPM
    const newRPM = this.state.rpm + angularAccel * deltaTime * (60 / (2 * Math.PI))
    this.state.rpm = THREE.MathUtils.clamp(newRPM, 0, this.specs.limiterRPM * 1.1)

    // Check stall
    if (this.state.rpm < this.specs.idleRPM * 0.5 && this.state.throttle < 0.1) {
      this.state.isStalled = true
      this.state.rpm = 0
    } else if (this.state.isStalled && this.state.throttle > 0.3) {
      this.state.isStalled = false
      this.state.rpm = this.specs.idleRPM
    }

    // Check over-rev
    this.state.isOverRevving = this.state.rpm > this.specs.redlineRPM

    // Apply rev limiter
    if (this.state.rpm > this.specs.limiterRPM) {
      this.state.rpm = this.specs.limiterRPM
      this.state.throttle = 0 // Cut fuel
    }

    // Update load (0-1 based on torque output vs max)
    this.state.load = THREE.MathUtils.clamp(torque / this.specs.maxTorqueNm, 0, 1)

    // Update state
    this.state.torque = torque
    this.state.power = (torque * this.state.rpm) / 9549 // kW
    this.state.boost = this.currentBoost
    this.state.fuelConsumption = this.calculateFuelConsumption()

    // Temperature simulation
    this.updateTemperature(deltaTime)

    // Oil pressure
    this.state.oilPressure = 1 + (this.state.rpm / this.specs.redlineRPM) * 4

    return this.state
  }

  /**
   * Set throttle input (0-1)
   */
  setThrottle(throttle: number): void {
    this.state.throttle = THREE.MathUtils.clamp(throttle, 0, 1)
  }

  /**
   * Get current state
   */
  getState(): EngineState {
    return { ...this.state }
  }

  /**
   * Get specs
   */
  getSpecs(): EngineSpecs {
    return { ...this.specs }
  }

  /**
   * Calculate engine torque at current RPM and throttle
   */
  private calculateTorque(): number {
    if (this.state.isStalled) return 0

    const rpmRatio = this.state.rpm / this.specs.redlineRPM

    // Interpolate torque curve
    let curveTorque = 0
    for (let i = 0; i < this.specs.torqueCurve.length - 1; i++) {
      const [rpm1, tq1] = this.specs.torqueCurve[i]
      const [rpm2, tq2] = this.specs.torqueCurve[i + 1]
      if (rpmRatio >= rpm1 && rpmRatio <= rpm2) {
        const t = (rpmRatio - rpm1) / (rpm2 - rpm1)
        curveTorque = THREE.MathUtils.lerp(tq1, tq2, t)
        break
      }
    }

    // Apply throttle
    let torque = curveTorque * this.specs.maxTorqueNm * this.state.throttle

    // Apply boost (turbo)
    if (this.specs.aspiration !== 'na' && this.currentBoost > 0) {
      const boostFactor = 1 + (this.currentBoost / this.specs.maxBoost) * 0.4 // ~40% more torque at max boost
      torque *= boostFactor
    }

    // Reduce torque at very low RPM (stalling prevention)
    if (this.state.rpm < this.specs.idleRPM * 1.5) {
      torque *= THREE.MathUtils.mapLinear(this.state.rpm, 0, this.specs.idleRPM * 1.5, 0, 1)
    }

    return Math.max(0, torque)
  }

  /**
   * Update turbocharger simulation
   */
  private updateTurbo(deltaTime: number): void {
    if (this.specs.aspiration === 'na') {
      this.currentBoost = 0
      return
    }

    const rpmRatio = this.state.rpm / this.specs.redlineRPM

    // Target boost based on throttle and RPM
    if (this.state.rpm > this.specs.boostThresholdRPM && this.state.throttle > 0.3) {
      this.targetBoost = this.specs.maxBoost * this.state.throttle * rpmRatio
    } else {
      this.targetBoost = 0
    }

    // Spool up/down with lag
    const spoolSpeed = 1 / this.specs.turboLag
    if (this.targetBoost > this.currentBoost) {
      this.currentBoost += (this.targetBoost - this.currentBoost) * spoolSpeed * deltaTime
    } else {
      this.currentBoost += (this.targetBoost - this.currentBoost) * spoolSpeed * 2 * deltaTime // Faster spool down
    }

    this.currentBoost = THREE.MathUtils.clamp(this.currentBoost, 0, this.specs.maxBoost)
  }

  /**
   * Update engine temperature
   */
  private updateTemperature(deltaTime: number): void {
    const targetTemp = 90 + this.state.load * 30 // 90-120C under load
    const coolingRate = 0.5 // degrees per second at idle
    const heatingRate = 2 // degrees per second at full load

    if (this.state.temperature < targetTemp) {
      this.state.temperature += heatingRate * this.state.load * deltaTime
    } else {
      this.state.temperature -= coolingRate * (1 - this.state.load * 0.5) * deltaTime
    }

    this.state.temperature = THREE.MathUtils.clamp(this.state.temperature, 20, 150)
  }

  /**
   * Calculate fuel consumption (L/h)
   */
  private calculateFuelConsumption(): number {
    // Rough BSFC (brake specific fuel consumption) model
    const bsfc = 250 + this.state.load * 100 // g/kWh
    const powerKW = Math.max(0.5, this.state.power)
    return (bsfc * powerKW) / 750 // Convert to L/h (petrol ~0.75 kg/L)
  }

  /**
   * Get inertia
   */
  getInertia(): number {
    return this.specs.inertia
  }

  /**
   * Get idle RPM
   */
  getIdleRPM(): number {
    return this.specs.idleRPM
  }

  /**
   * Get redline RPM
   */
  getRedlineRPM(): number {
    return this.specs.redlineRPM
  }

  /**
   * Get max torque
   */
  getMaxTorque(): number {
    return this.specs.maxTorqueNm
  }

  /**
   * Reset engine
   */
  reset(): void {
    this.state = this.createInitialState()
    this.currentBoost = 0
    this.targetBoost = 0
  }

  /**
   * Damage engine (reduce performance)
   */
  applyDamage(damage: number): void { // 0-1
    this.specs.maxTorqueNm *= (1 - damage * 0.3)
    this.specs.maxPowerKW *= (1 - damage * 0.3)
    this.specs.frictionTorque *= (1 + damage * 0.5)
    this.specs.turboLag *= (1 + damage)
    this.specs.compressionBraking *= (1 - damage * 0.5)
  }

  /**
   * Repair engine
   */
  repair(): void {
    // Would restore to original specs - need to store originals
  }
}

// ============================================
// GEARBOX
// ============================================

export type GearboxType = 'manual' | 'automatic' | 'cvt' | 'dct' | 'sequential'

export interface GearboxSpecs {
  type: GearboxType
  ratios: number[] // gear ratios (including reverse at index 0)
  finalDrive: number
  shiftTime: number // seconds
  autoShiftUpRPM: number // for automatic
  autoShiftDownRPM: number
  clutchSlip: number // max clutch slip torque multiplier
  efficiency: number // 0-1
}

export interface GearboxState {
  gear: number // 0 = neutral, -1 = reverse, 1+ = forward gears
  targetGear: number
  isShifting: boolean
  shiftProgress: number // 0-1
  clutchPosition: number // 0 = disengaged, 1 = engaged
  inputRPM: number
  outputRPM: number
  inputTorque: number
  outputTorque: number
}

const DEFAULT_GEARBOX_SPECS: GearboxSpecs = {
  type: 'manual',
  ratios: [-3.5, 0, 3.6, 2.1, 1.4, 1.0, 0.8], // R, N, 1, 2, 3, 4, 5
  finalDrive: 3.8,
  shiftTime: 0.3,
  autoShiftUpRPM: 0.85,
  autoShiftDownRPM: 0.35,
  clutchSlip: 1.5,
  efficiency: 0.95
}

export class Gearbox {
  private specs: GearboxSpecs
  private state: GearboxState

  constructor(specs: Partial<GearboxSpecs> = {}) {
    this.specs = { ...DEFAULT_GEARBOX_SPECS, ...specs }
    this.state = {
      gear: 0,
      targetGear: 0,
      isShifting: false,
      shiftProgress: 0,
      clutchPosition: 1,
      inputRPM: 0,
      outputRPM: 0,
      inputTorque: 0,
      outputTorque: 0
    }
  }

  /**
   * Update gearbox
   */
  update(deltaTime: number, engineRPM: number, engineTorque: number, wheelRPM: number, throttle: number, isAuto: boolean): GearboxState {
    this.state.inputRPM = engineRPM
    this.state.outputRPM = wheelRPM * this.getCurrentRatio()

    // Handle shifting
    if (this.state.isShifting) {
      this.state.shiftProgress += deltaTime / this.specs.shiftTime
      this.state.clutchPosition = 1 - this.state.shiftProgress

      if (this.state.shiftProgress >= 1) {
        this.state.gear = this.state.targetGear
        this.state.isShifting = false
        this.state.shiftProgress = 0
        this.state.clutchPosition = 1
      }
    } else if (isAuto) {
      this.updateAutoShift(engineRPM, throttle)
    }

    // Calculate current ratio
    const ratio = this.getCurrentRatio()

    // Torque multiplication
    this.state.inputTorque = engineTorque
    this.state.outputTorque = engineTorque * ratio * this.specs.efficiency

    // Clutch slip torque limit
    const maxClutchTorque = this.specs.clutchSlip * engineTorque
    this.state.outputTorque = Math.min(this.state.outputTorque, maxClutchTorque)

    return this.state
  }

  /**
   * Request gear change
   */
  shiftUp(): boolean {
    if (this.state.isShifting) return false
    if (this.state.gear >= this.specs.ratios.length - 1) return false

    this.state.targetGear = this.state.gear + 1
    this.state.isShifting = true
    this.state.shiftProgress = 0
    return true
  }

  shiftDown(): boolean {
    if (this.state.isShifting) return false
    if (this.state.gear <= -1) return false

    this.state.targetGear = this.state.gear - 1
    this.state.isShifting = true
    this.state.shiftProgress = 0
    return true
  }

  setGear(gear: number): boolean {
    if (this.state.isShifting) return false
    if (gear < -1 || gear >= this.specs.ratios.length) return false

    this.state.targetGear = gear
    this.state.isShifting = true
    this.state.shiftProgress = 0
    return true
  }

  /**
   * Set clutch position (0-1) for manual control
   */
  setClutch(position: number): void {
    if (!this.state.isShifting) {
      this.state.clutchPosition = THREE.MathUtils.clamp(position, 0, 1)
    }
  }

  /**
   * Get current gear ratio * final drive
   */
  getCurrentRatio(): number {
    if (this.state.gear === 0) return 0 // Neutral
    if (this.state.gear === -1) return this.specs.ratios[0] * this.specs.finalDrive // Reverse
    return this.specs.ratios[this.state.gear] * this.specs.finalDrive
  }

  /**
   * Get ratio for specific gear
   */
  getRatio(gear: number): number {
    if (gear === 0) return 0
    if (gear === -1) return this.specs.ratios[0] * this.specs.finalDrive
    return this.specs.ratios[gear] * this.specs.finalDrive
  }

  /**
   * Automatic shift logic
   */
  private updateAutoShift(engineRPM: number, throttle: number): void {
    const rpmRatio = engineRPM / 6500 // Assume redline

    // Shift up
    if (this.state.gear > 0 && this.state.gear < this.specs.ratios.length - 1) {
      if (rpmRatio > this.specs.autoShiftUpRPM && throttle > 0.5) {
        this.shiftUp()
      }
    }

    // Shift down
    if (this.state.gear > 1) {
      if (rpmRatio < this.specs.autoShiftDownRPM || throttle < 0.1) {
        this.shiftDown()
      }
    }
  }

  /**
   * Get state
   */
  getState(): GearboxState {
    return { ...this.state }
  }

  /**
   * Get specs
   */
  getSpecs(): GearboxSpecs {
    return { ...this.specs }
  }

  /**
   * Get number of forward gears
   */
  getNumGears(): number {
    return this.specs.ratios.length - 2 // Exclude reverse and neutral
  }

  /**
   * Reset gearbox
   */
  reset(): void {
    this.state = {
      gear: 0,
      targetGear: 0,
      isShifting: false,
      shiftProgress: 0,
      clutchPosition: 1,
      inputRPM: 0,
      outputRPM: 0,
      inputTorque: 0,
      outputTorque: 0
    }
  }

  /**
   * Apply damage
   */
  applyDamage(damage: number): void {
    this.specs.shiftTime *= (1 + damage)
    this.specs.efficiency *= (1 - damage * 0.1)
    this.specs.clutchSlip *= (1 - damage * 0.3)
  }
}

// ============================================
// DIFFERENTIAL
// ============================================

export type DiffType = 'open' | 'lsd' | 'locker' | 'torsen' | 'viscous' | 'electronic'

export interface DifferentialSpecs {
  type: DiffType
  lockRatio: number // 0 = open, 1 = fully locked
  preload: number // Nm
  rampAngle: number // degrees (for LSD)
  responseRate: number // how fast it locks/unlocks
}

export interface DifferentialState {
  leftTorque: number
  rightTorque: number
  lockLevel: number // 0-1
  speedDiff: number
}

const DEFAULT_DIFF_SPECS: DifferentialSpecs = {
  type: 'open',
  lockRatio: 0,
  preload: 0,
  rampAngle: 45,
  responseRate: 10
}

export class Differential {
  private specs: DifferentialSpecs
  private state: DifferentialState

  constructor(specs: Partial<DifferentialSpecs> = {}) {
    this.specs = { ...DEFAULT_DIFF_SPECS, ...specs }
    this.state = {
      leftTorque: 0,
      rightTorque: 0,
      lockLevel: 0,
      speedDiff: 0
    }
  }

  /**
   * Update differential
   */
  update(deltaTime: number, inputTorque: number, leftWheelSpeed: number, rightWheelSpeed: number, throttle: number): DifferentialState {
    this.state.speedDiff = Math.abs(leftWheelSpeed - rightWheelSpeed)

    // Calculate lock level based on type
    let targetLock = 0

    switch (this.specs.type) {
      case 'open':
        targetLock = 0
        break
      case 'lsd':
        // Torque-sensitive LSD
        targetLock = this.specs.lockRatio * Math.min(1, this.state.speedDiff * 0.1)
        targetLock += this.specs.preload / 200 // preload contribution
        break
      case 'locker':
        targetLock = 1
        break
      case 'torsen':
        // Torque bias ratio
        const biasRatio = 2.5
        if (this.state.speedDiff > 0.1) {
          targetLock = (biasRatio - 1) / (biasRatio + 1)
        }
        break
      case 'viscous':
        // Speed-sensitive
        targetLock = Math.min(1, this.state.speedDiff * 0.05)
        break
      case 'electronic':
        // Would be controlled by vehicle dynamics
        targetLock = this.specs.lockRatio * throttle
        break
    }

    targetLock = THREE.MathUtils.clamp(targetLock, 0, 1)

    // Smooth lock engagement
    this.state.lockLevel += (targetLock - this.state.lockLevel) * this.specs.responseRate * deltaTime

    // Distribute torque
    const avgSpeed = (leftWheelSpeed + rightWheelSpeed) * 0.5
    const speedDiffNorm = this.state.speedDiff / (Math.abs(avgSpeed) + 0.1)

    if (this.state.lockLevel < 0.01) {
      // Open diff - equal torque
      this.state.leftTorque = inputTorque * 0.5
      this.state.rightTorque = inputTorque * 0.5
    } else {
      // Limited slip - bias torque to faster wheel (or slower for braking)
      const bias = this.state.lockLevel
      if (leftWheelSpeed > rightWheelSpeed) {
        this.state.leftTorque = inputTorque * (0.5 + bias * 0.5)
        this.state.rightTorque = inputTorque * (0.5 - bias * 0.5)
      } else {
        this.state.leftTorque = inputTorque * (0.5 - bias * 0.5)
        this.state.rightTorque = inputTorque * (0.5 + bias * 0.5)
      }
    }

    return this.state
  }

  getState(): DifferentialState {
    return { ...this.state }
  }

  getSpecs(): DifferentialSpecs {
    return { ...this.specs }
  }

  reset(): void {
    this.state = {
      leftTorque: 0,
      rightTorque: 0,
      lockLevel: 0,
      speedDiff: 0
    }
  }

  applyDamage(damage: number): void {
    this.specs.lockRatio *= (1 - damage * 0.5)
    this.specs.preload *= (1 - damage)
    this.specs.responseRate *= (1 - damage * 0.5)
  }
}

// ============================================
// DRIVETRAIN (Complete Assembly)
// ============================================

export interface DrivetrainSpecs {
  engine: EngineSpecs
  gearbox: GearboxSpecs
  frontDiff: DifferentialSpecs
  rearDiff: DifferentialSpecs
  centerDiff: DifferentialSpecs // for AWD
  drivetrainLayout: 'fwd' | 'rwd' | 'awd'
  centerDiffSplit: number // front/rear torque split (0.5 = 50/50)
}

export interface DrivetrainState {
  engine: EngineState
  gearbox: GearboxState
  frontDiff: DifferentialState
  rearDiff: DifferentialState
  centerDiff: DifferentialState
  wheelTorques: number[] // [FL, FR, RL, RR]
  totalOutputTorque: number
}

const DEFAULT_DRIVETRAIN_SPECS: DrivetrainSpecs = {
  engine: DEFAULT_ENGINE_SPECS,
  gearbox: DEFAULT_GEARBOX_SPECS,
  frontDiff: { ...DEFAULT_DIFF_SPECS, type: 'open' },
  rearDiff: { ...DEFAULT_DIFF_SPECS, type: 'open' },
  centerDiff: { ...DEFAULT_DIFF_SPECS, type: 'viscous', lockRatio: 0.3 },
  drivetrainLayout: 'fwd',
  centerDiffSplit: 0.5
}

export class Drivetrain {
  private specs: DrivetrainSpecs
  private engine: Engine
  private gearbox: Gearbox
  private frontDiff: Differential
  private rearDiff: Differential
  private centerDiff: Differential

  private state: DrivetrainState

  // Input
  private throttle = 0
  private brake = 0
  private clutch = 1 // 0 = pressed, 1 = released
  private isAuto = false

  // Wheel speeds (from physics)
  private wheelSpeeds = [0, 0, 0, 0] // FL, FR, RL, RR

  constructor(specs: Partial<DrivetrainSpecs> = {}) {
    this.specs = { ...DEFAULT_DRIVETRAIN_SPECS, ...specs }

    this.engine = new Engine(this.specs.engine)
    this.gearbox = new Gearbox(this.specs.gearbox)
    this.frontDiff = new Differential(this.specs.frontDiff)
    this.rearDiff = new Differential(this.specs.rearDiff)
    this.centerDiff = new Differential(this.specs.centerDiff)

    this.state = {
      engine: this.engine.getState(),
      gearbox: this.gearbox.getState(),
      frontDiff: this.frontDiff.getState(),
      rearDiff: this.rearDiff.getState(),
      centerDiff: this.centerDiff.getState(),
      wheelTorques: [0, 0, 0, 0],
      totalOutputTorque: 0
    }
  }

  /**
   * Main update - call every physics step
   */
  update(deltaTime: number): DrivetrainState {
    // Update engine
    const gearboxState = this.gearbox.getState()
    const gearboxInputTorque = gearboxState.inputTorque * (1 - this.clutch)
    this.engine.update(deltaTime, this.clutch, gearboxInputTorque)
    this.state.engine = this.engine.getState()

    // Update gearbox - use wheel speeds for RWD
    let avgWheelSpeed = 0
    switch (this.specs.drivetrainLayout) {
      case 'fwd':
        avgWheelSpeed = (this.wheelSpeeds[0] + this.wheelSpeeds[1]) * 0.5
        break
      case 'rwd':
        avgWheelSpeed = (this.wheelSpeeds[2] + this.wheelSpeeds[3]) * 0.5
        break
      case 'awd':
        avgWheelSpeed = (this.wheelSpeeds[0] + this.wheelSpeeds[1] + this.wheelSpeeds[2] + this.wheelSpeeds[3]) * 0.25
        break
    }
    this.gearbox.update(deltaTime, this.state.engine.rpm, this.state.engine.torque, avgWheelSpeed, this.throttle, this.isAuto)
    this.state.gearbox = this.gearbox.getState()

    // Calculate output torque after gearbox
    const gearboxOutputTorque = this.state.gearbox.outputTorque

    // Distribute to axles based on layout
    let frontTorque = 0
    let rearTorque = 0

    switch (this.specs.drivetrainLayout) {
      case 'fwd':
        frontTorque = gearboxOutputTorque
        rearTorque = 0
        break
      case 'rwd':
        frontTorque = 0
        rearTorque = gearboxOutputTorque
        break
      case 'awd':
        this.centerDiff.update(deltaTime, gearboxOutputTorque, this.wheelSpeeds[0], this.wheelSpeeds[2], this.throttle)
        this.state.centerDiff = this.centerDiff.getState()
        frontTorque = this.state.centerDiff.leftTorque
        rearTorque = this.state.centerDiff.rightTorque
        break
    }

    // Update differentials
    if (frontTorque > 0) {
      this.frontDiff.update(deltaTime, frontTorque, this.wheelSpeeds[0], this.wheelSpeeds[1], this.throttle)
      this.state.frontDiff = this.frontDiff.getState()
    }

    if (rearTorque > 0) {
      this.rearDiff.update(deltaTime, rearTorque, this.wheelSpeeds[2], this.wheelSpeeds[3], this.throttle)
      this.state.rearDiff = this.rearDiff.getState()
    }

    // Calculate wheel torques
    this.state.wheelTorques[0] = this.state.frontDiff.leftTorque
    this.state.wheelTorques[1] = this.state.frontDiff.rightTorque
    this.state.wheelTorques[2] = this.state.rearDiff.leftTorque
    this.state.wheelTorques[3] = this.state.rearDiff.rightTorque

    this.state.totalOutputTorque = this.state.wheelTorques.reduce((a, b) => a + b, 0)

    return this.state
  }

  /**
   * Set driver inputs
   */
  setInputs(throttle: number, brake: number, clutch: number): void {
    this.throttle = THREE.MathUtils.clamp(throttle, 0, 1)
    this.brake = THREE.MathUtils.clamp(brake, 0, 1)
    this.clutch = THREE.MathUtils.clamp(clutch, 0, 1)
    this.engine.setThrottle(this.throttle)
  }

  /**
   * Set automatic mode
   */
  setAutoMode(auto: boolean): void {
    this.isAuto = auto
  }

  /**
   * Shift gears
   */
  shiftUp(): boolean {
    return this.gearbox.shiftUp()
  }

  shiftDown(): boolean {
    return this.gearbox.shiftDown()
  }

  setGear(gear: number): boolean {
    return this.gearbox.setGear(gear)
  }

  /**
   * Set wheel speeds (from physics)
   */
  setWheelSpeeds(speeds: number[]): void {
    this.wheelSpeeds = [...speeds]
  }

  /**
   * Get current wheel torques
   */
  getWheelTorques(): number[] {
    return [...this.state.wheelTorques]
  }

  /**
   * Get engine RPM
   */
  getEngineRPM(): number {
    return this.state.engine.rpm
  }

  /**
   * Get current gear
   */
  getGear(): number {
    return this.state.gearbox.gear
  }

  /**
   * Get full state
   */
  getState(): DrivetrainState {
    return { ...this.state }
  }

  /**
   * Get individual components
   */
  getEngine(): Engine {
    return this.engine
  }

  getGearbox(): Gearbox {
    return this.gearbox
  }

  getFrontDiff(): Differential {
    return this.frontDiff
  }

  getRearDiff(): Differential {
    return this.rearDiff
  }

  getCenterDiff(): Differential {
    return this.centerDiff
  }

  /**
   * Get engine load (0-1)
   */
  getLoad(): number {
    return this.state.engine.load
  }

  /**
   * Get fuel consumption (L/h)
   */
  getFuelConsumption(): number {
    return this.state.engine.fuelConsumption
  }

  /**
   * Check if engine is running
   */
  isEngineRunning(): boolean {
    return !this.state.engine.isStalled && this.state.engine.rpm > 0
  }

  /**
   * Start engine
   */
  startEngine(): boolean {
    if (this.state.engine.isStalled) {
      // Would need starter motor simulation
      return false
    }
    return true
  }

  /**
   * Stall engine
   */
  stallEngine(): void {
    this.engine.update(0, 0, 0) // This will trigger stall logic
  }

  /**
   * Apply damage to all components
   */
  applyDamage(damage: number): void {
    this.engine.applyDamage(damage)
    this.gearbox.applyDamage(damage)
    this.frontDiff.applyDamage(damage)
    this.rearDiff.applyDamage(damage)
    this.centerDiff.applyDamage(damage)
  }

  /**
   * Reset drivetrain
   */
  reset(): void {
    this.engine.reset()
    this.gearbox.reset()
    this.frontDiff.reset()
    this.rearDiff.reset()
    this.centerDiff.reset()
    this.wheelSpeeds = [0, 0, 0, 0]
  }

  /**
   * Get specs
   */
  getSpecs(): DrivetrainSpecs {
    return { ...this.specs }
  }
}

// ============================================
// PRESET DRIVETRAINS
// ============================================

export const DRIVETRAIN_PRESETS: Record<string, DrivetrainSpecs> = {
  // Hot hatch - FWD turbo
  hot_hatch: {
    engine: {
      ...DEFAULT_ENGINE_SPECS,
      displacement: 2.0,
      cylinders: 4,
      aspiration: 'turbo',
      redlineRPM: 6500,
      maxPowerKW: 200,
      maxTorqueNm: 380,
      maxTorqueRPM: 3000,
      turboLag: 0.4,
      maxBoost: 1.4,
      soundProfile: 'inline4'
    },
    gearbox: {
      ...DEFAULT_GEARBOX_SPECS,
      type: 'manual',
      ratios: [-3.5, 0, 3.8, 2.2, 1.5, 1.1, 0.9],
      finalDrive: 4.1,
      shiftTime: 0.25
    },
    frontDiff: { type: 'lsd', lockRatio: 0.4, preload: 30, rampAngle: 45, responseRate: 15 },
    rearDiff: { type: 'open', lockRatio: 0, preload: 0, rampAngle: 0, responseRate: 10 },
    centerDiff: { type: 'open', lockRatio: 0, preload: 0, rampAngle: 0, responseRate: 10 },
    drivetrainLayout: 'fwd',
    centerDiffSplit: 0
  },

  // Sports sedan - RWD turbo
  sports_sedan: {
    engine: {
      ...DEFAULT_ENGINE_SPECS,
      displacement: 3.0,
      cylinders: 6,
      layout: 'inline',
      aspiration: 'twin-turbo',
      redlineRPM: 7000,
      maxPowerKW: 300,
      maxTorqueNm: 550,
      maxTorqueRPM: 2500,
      inertia: 0.4,
      turboLag: 0.3,
      maxBoost: 1.6,
      soundProfile: 'inline4'  // Changed from inline6 to inline4
    },
    gearbox: {
      ...DEFAULT_GEARBOX_SPECS,
      type: 'automatic',
      ratios: [-3.8, 0, 4.7, 3.1, 2.1, 1.6, 1.2, 1.0, 0.85],
      finalDrive: 3.45,
      shiftTime: 0.15,
      autoShiftUpRPM: 0.8,
      autoShiftDownRPM: 0.3
    },
    frontDiff: { type: 'open', lockRatio: 0, preload: 0, rampAngle: 0, responseRate: 10 },
    rearDiff: { type: 'lsd', lockRatio: 0.6, preload: 50, rampAngle: 40, responseRate: 20 },
    centerDiff: { type: 'open', lockRatio: 0, preload: 0, rampAngle: 0, responseRate: 10 },
    drivetrainLayout: 'rwd',
    centerDiffSplit: 0
  },

  // Rally car - AWD turbo
  rally: {
    engine: {
      ...DEFAULT_ENGINE_SPECS,
      displacement: 2.0,
      cylinders: 4,
      aspiration: 'turbo',
      redlineRPM: 7500,
      maxPowerKW: 280,
      maxTorqueNm: 450,
      maxTorqueRPM: 3500,
      inertia: 0.25,
      turboLag: 0.2,
      maxBoost: 2.0,
      soundProfile: 'inline4'
    },
    gearbox: {
      ...DEFAULT_GEARBOX_SPECS,
      type: 'sequential',
      ratios: [-3.8, 0, 3.5, 2.3, 1.6, 1.2, 1.0],
      finalDrive: 4.5,
      shiftTime: 0.05
    },
    frontDiff: { type: 'torsen', lockRatio: 0.7, preload: 40, rampAngle: 0, responseRate: 30 },
    rearDiff: { type: 'torsen', lockRatio: 0.7, preload: 40, rampAngle: 0, responseRate: 30 },
    centerDiff: { type: 'viscous', lockRatio: 0.5, preload: 0, rampAngle: 0, responseRate: 25 },
    drivetrainLayout: 'awd',
    centerDiffSplit: 0.5
  },

  // Old banger - FWD NA
  banger: {
    engine: {
      ...DEFAULT_ENGINE_SPECS,
      displacement: 1.4,
      cylinders: 4,
      aspiration: 'na',
      redlineRPM: 6000,
      maxPowerKW: 55,
      maxTorqueNm: 120,
      maxTorqueRPM: 4000,
      inertia: 0.2,
      frictionTorque: 40,
      soundProfile: 'inline4'
    },
    gearbox: {
      ...DEFAULT_GEARBOX_SPECS,
      type: 'manual',
      ratios: [-3.2, 0, 3.5, 2.0, 1.3, 1.0, 0.85],
      finalDrive: 3.9,
      shiftTime: 0.4
    },
    frontDiff: { type: 'open', lockRatio: 0, preload: 0, rampAngle: 0, responseRate: 10 },
    rearDiff: { type: 'open', lockRatio: 0, preload: 0, rampAngle: 0, responseRate: 10 },
    centerDiff: { type: 'open', lockRatio: 0, preload: 0, rampAngle: 0, responseRate: 10 },
    drivetrainLayout: 'fwd',
    centerDiffSplit: 0
  },

  // Van - RWD NA diesel
  van: {
    engine: {
      ...DEFAULT_ENGINE_SPECS,
      displacement: 2.5,
      cylinders: 4,
      aspiration: 'turbo',
      redlineRPM: 4500,
      maxPowerKW: 100,
      maxTorqueNm: 350,
      maxTorqueRPM: 1800,
      inertia: 0.6,
      frictionTorque: 60,
      compressionBraking: 0.3,
      turboLag: 0.8,
      maxBoost: 1.0,
      soundProfile: 'diesel'
    },
    gearbox: {
      ...DEFAULT_GEARBOX_SPECS,
      type: 'manual',
      ratios: [-3.8, 0, 4.2, 2.4, 1.45, 1.0, 0.82],
      finalDrive: 3.7,
      shiftTime: 0.45
    },
    frontDiff: { type: 'open', lockRatio: 0, preload: 0, rampAngle: 0, responseRate: 10 },
    rearDiff: { type: 'lsd', lockRatio: 0.3, preload: 20, rampAngle: 45, responseRate: 10 },
    centerDiff: { type: 'open', lockRatio: 0, preload: 0, rampAngle: 0, responseRate: 10 },
    drivetrainLayout: 'rwd',
    centerDiffSplit: 0
  }
}

/**
 * Create drivetrain from preset
 */
export function createDrivetrain(preset: string): Drivetrain {
  const specs = DRIVETRAIN_PRESETS[preset]
  if (!specs) {
    console.warn(`Drivetrain preset not found: ${preset}, using hot_hatch`)
    return new Drivetrain(DRIVETRAIN_PRESETS.hot_hatch)
  }
  return new Drivetrain(specs)
}