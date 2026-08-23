import * as THREE from 'three'
import { VehiclePhysics } from './VehiclePhysics.js'
import { VehicleSpecsData } from './VehicleSpecs.js'

// ============================================
// INPUT STATE
// ============================================

export interface ControllerInput {
  // Driving
  throttle: number        // 0-1
  brake: number           // 0-1
  steer: number           // -1 to 1
  handbrake: boolean

  // Gearbox
  shiftUp: boolean
  shiftDown: boolean
  clutch: number          // 0-1 (0 = pressed)

  // Other
  horn: boolean
  lights: boolean
  indicators: -1 | 0 | 1  // left, off, right
  hazardLights: boolean
  wipers: number          // 0-3 (off, intermittent, low, high)
  ignition: boolean       // toggle engine
  starter: boolean        // hold to crank

  // Camera
  cameraMode: number      // 0=chase, 1=hood, 2=dashboard, 3=cinematic
  cameraDistance: number  // zoom
  cameraPitch: number     // up/down
  cameraYaw: number       // left/right (orbit)
}

export interface ControllerConfig {
  // Steering
  steerSpeed: number         // how fast steering reaches max (rad/s)
  steerReturnSpeed: number   // how fast steering centers (rad/s)
  steerSensitivity: number   // input multiplier
  steerSpeedSensitivity: number // reduction at high speed

  // Throttle/Brake
  throttleSensitivity: number
  brakeSensitivity: number
  throttleResponseRate: number
  brakeResponseRate: number

  // Assists
  tractionControl: boolean
  stabilityControl: boolean
  abs: boolean
  autoClutch: boolean
  autoBlip: boolean // rev-match on downshift

  // Gearbox
  shiftDelay: number        // minimum time between shifts
  autoShiftRPM: number      // RPM to auto-shift up
  autoDownshiftRPM: number  // RPM to auto-shift down

  // Camera
  cameraSmoothing: number
  cameraFOVSpeed: number    // FOV change per km/h
  cameraShakeIntensity: number
}

const DEFAULT_CONFIG: ControllerConfig = {
  steerSpeed: Math.PI * 2,
  steerReturnSpeed: Math.PI * 3,
  steerSensitivity: 1.0,
  steerSpeedSensitivity: 0.5,
  throttleSensitivity: 1.0,
  brakeSensitivity: 1.0,
  throttleResponseRate: 8,
  brakeResponseRate: 12,
  tractionControl: true,
  stabilityControl: true,
  abs: true,
  autoClutch: true,
  autoBlip: true,
  shiftDelay: 0.15,
  autoShiftRPM: 0.85,
  autoDownshiftRPM: 0.3,
  cameraSmoothing: 5,
  cameraFOVSpeed: 0.0005,
  cameraShakeIntensity: 0.3
}

// ============================================
// VEHICLE CONTROLLER
// ============================================

export class VehicleController {
  private physics: VehiclePhysics
  private specs: VehicleSpecsData
  private config: ControllerConfig

  // Input state
  private input: ControllerInput = this.createEmptyInput()
  private prevInput: ControllerInput = this.createEmptyInput()

  // Internal state
  private currentGear = 1
  private targetGear = 1
  private isShifting = false
  private shiftTimer = 0
  private clutchPosition = 1 // 0 = pressed, 1 = released
  private engineRunning = false
  private starterEngaged = false

  // Assists state
  private tractionControlActive = false
  private stabilityControlActive = false
  private absActive = false

  // Wheel slip tracking
  private wheelSlip = [0, 0, 0, 0] // FL, FR, RL, RR
  private prevWheelSpeeds = [0, 0, 0, 0]

  // Steering
  private steeringAngle = 0
  private steeringInput = 0

  // Callbacks
  onGearChange?: (gear: number) => void
  onEngineStart?: () => void
  onEngineStall?: () => void
  onTractionControlActivate?: () => void
  onStabilityControlActivate?: () => void
  onABSActivate?: () => void

  constructor(physics: VehiclePhysics, specs: VehicleSpecsData, config?: Partial<ControllerConfig>) {
    this.physics = physics
    this.specs = specs
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private createEmptyInput(): ControllerInput {
    return {
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: false,
      shiftUp: false,
      shiftDown: false,
      clutch: 1,
      horn: false,
      lights: false,
      indicators: 0,
      hazardLights: false,
      wipers: 0,
      ignition: false,
      starter: false,
      cameraMode: 0,
      cameraDistance: 1,
      cameraPitch: 0,
      cameraYaw: 0
    }
  }

  /**
   * Set input from keyboard/gamepad
   */
  setInput(input: Partial<ControllerInput>): void {
    this.prevInput = { ...this.input }
    this.input = { ...this.input, ...input }
  }

  /**
   * Get current input state
   */
  getInput(): ControllerInput {
    return { ...this.input }
  }

  /**
   * Main update - call every frame
   */
  update(deltaTime: number): void {
    // Handle ignition/starter
    this.updateIgnition(deltaTime)

    if (!this.engineRunning) {
      // If engine not running, only allow starter
      this.physics.update(deltaTime, {
        throttle: 0,
        brake: 0.3,
        steering: 0,
        handbrake: true
      })
      return
    }

    // Process inputs
    this.processSteering(deltaTime)
    this.processPedals(deltaTime)
    this.processGearbox(deltaTime)
    this.processAssists(deltaTime)

    // Apply to physics
    const physicsInput = {
      throttle: this.input.throttle,
      brake: this.input.brake,
      steering: this.steeringInput,
      handbrake: this.input.handbrake
    }

    this.physics.update(deltaTime, physicsInput)

    // Update gear display
    this.currentGear = this.physics.getGear()

    // Update wheel slip tracking
    this.updateWheelSlip()
  }

  private updateIgnition(deltaTime: number): void {
    // Toggle ignition
    if (this.input.ignition && !this.prevInput.ignition) {
      if (this.engineRunning) {
        this.stopEngine()
      } else {
        this.startEngine()
      }
    }

    // Starter motor
    if (this.input.starter && !this.engineRunning) {
      this.starterEngaged = true
      // Crank engine
      this.physics.setEngineRPM(200)
    } else if (this.starterEngaged && !this.input.starter) {
      this.starterEngaged = false
      // Try to start
      if (this.physics.getEngineRPM() > 100) {
        this.startEngine()
      }
    }
  }

  private startEngine(): void {
    if (this.engineRunning) return

    // Check fuel, battery, etc.
    const rpm = this.physics.getEngineRPM()
    if (rpm > 400) { // Started
      this.engineRunning = true
      this.clutchPosition = 1
      this.currentGear = 1
      this.physics.setGear(1)
      this.onEngineStart?.()
    }
  }

  private stopEngine(): void {
    this.engineRunning = false
    this.clutchPosition = 0
    this.physics.setEngineRPM(0)
    this.onEngineStall?.()
  }

  private processSteering(deltaTime: number): void {
    // Raw steering input with sensitivity
    const rawSteer = this.input.steer * this.config.steerSensitivity

    // Speed-sensitive steering reduction
    const speed = this.physics.getSpeedMS()
    const speedFactor = THREE.MathUtils.mapLinear(speed, 0, 60, 1, this.config.steerSpeedSensitivity)
    const targetSteer = rawSteer * speedFactor

    // Rate-limited steering
    const maxSteerRate = this.config.steerSpeed * deltaTime
    const steerDiff = targetSteer - this.steeringInput

    if (Math.abs(steerDiff) < maxSteerRate) {
      this.steeringInput = targetSteer
    } else {
      this.steeringInput += Math.sign(steerDiff) * maxSteerRate
    }

    // Apply steering return force when input centered
    if (Math.abs(this.input.steer) < 0.05) {
      const returnRate = this.config.steerReturnSpeed * deltaTime
      if (Math.abs(this.steeringInput) < returnRate) {
        this.steeringInput = 0
      } else {
        this.steeringInput -= Math.sign(this.steeringInput) * returnRate
      }
    }

    // Clamp
    this.steeringInput = THREE.MathUtils.clamp(this.steeringInput, -1, 1)
  }

  private processPedals(deltaTime: number): void {
    // Throttle with response rate
    const targetThrottle = this.input.throttle * this.config.throttleSensitivity
    const throttleRate = this.config.throttleResponseRate * deltaTime
    this.input.throttle = THREE.MathUtils.lerp(this.input.throttle, targetThrottle, throttleRate)

    // Brake with response rate
    const targetBrake = this.input.brake * this.config.brakeSensitivity
    const brakeRate = this.config.brakeResponseRate * deltaTime
    this.input.brake = THREE.MathUtils.lerp(this.input.brake, targetBrake, brakeRate)

    // Clutch (manual)
    if (!this.config.autoClutch) {
      this.clutchPosition = 1 - this.input.clutch
    } else {
      // Auto clutch during shifts
      if (this.isShifting) {
        this.clutchPosition = 0
      } else {
        this.clutchPosition = 1
      }
    }
  }

  private processGearbox(deltaTime: number): void {
    this.shiftTimer += deltaTime

    // Manual shifting
    if (this.input.shiftUp && !this.prevInput.shiftUp && this.shiftTimer > this.config.shiftDelay) {
      this.requestShiftUp()
    }

    if (this.input.shiftDown && !this.prevInput.shiftDown && this.shiftTimer > this.config.shiftDelay) {
      this.requestShiftDown()
    }

    // Auto shifting (if in auto mode or assist)
    if (this.config.autoClutch && !this.input.shiftUp && !this.input.shiftDown) {
      this.processAutoShift()
    }

    // Handle shift in progress
    if (this.isShifting) {
      this.processShift(deltaTime)
    }
  }

  private processAutoShift(): void {
    const rpm = this.physics.getEngineRPM()
    const redline = this.specs.engineRedline
    const rpmRatio = rpm / redline

    // Shift up
    if (rpmRatio > this.config.autoShiftRPM && this.input.throttle > 0.5) {
      if (this.currentGear < this.getMaxGear() && this.shiftTimer > this.config.shiftDelay) {
        this.requestShiftUp()
      }
    }

    // Shift down
    if (rpmRatio < this.config.autoDownshiftRPM && this.currentGear > 1) {
      if (this.shiftTimer > this.config.shiftDelay) {
        this.requestShiftDown()
      }
    }
  }

  private requestShiftUp(): boolean {
    if (this.isShifting) return false
    if (this.currentGear >= this.getMaxGear()) return false

    this.targetGear = this.currentGear + 1
    this.isShifting = true
    this.shiftTimer = 0

    // Rev matching for downshifts (not needed for upshift)
    return true
  }

  private requestShiftDown(): boolean {
    if (this.isShifting) return false
    if (this.currentGear <= 1) return false

    this.targetGear = this.currentGear - 1
    this.isShifting = true
    this.shiftTimer = 0

    // Auto-blip throttle for rev match
    if (this.config.autoBlip) {
      this.blipThrottle()
    }

    return true
  }

  private blipThrottle(): void {
    // Briefly increase throttle to match revs
    // This would be handled by the drivetrain
  }

  private processShift(deltaTime: number): void {
    const shiftTime = 0.3 // seconds for manual shift

    if (this.shiftTimer > shiftTime) {
      // Complete shift
      this.currentGear = this.targetGear
      this.physics.setGear(this.currentGear)
      this.isShifting = false
      this.onGearChange?.(this.currentGear)
    }
  }

  private processAssists(deltaTime: number): void {
    const wheelStates = this.physics.getWheelStates()

    // Traction Control
    if (this.config.tractionControl) {
      let tcActive = false
      for (let i = 0; i < 4; i++) {
        // Check for excessive wheel spin (driven wheels only)
        // Simplified: check rear wheels for RWD, front for FWD
        const isDriven = this.specs.drivetrain.drivetrainLayout === 'fwd' ? i < 2 : i >= 2
        if (isDriven && wheelStates[i].contact.slipRatio > 0.15) {
          tcActive = true
          break
        }
      }

      if (tcActive && !this.tractionControlActive) {
        this.tractionControlActive = true
        this.onTractionControlActivate?.()
      } else if (!tcActive) {
        this.tractionControlActive = false
      }

      // Reduce throttle if TC active
      if (this.tractionControlActive) {
        this.input.throttle *= 0.5
      }
    }

    // Stability Control (ESC)
    if (this.config.stabilityControl) {
      const lateralG = this.physics.getLateralG()
      const yawRate = this.physics.getChassisRotation ? this.physics.getChassisRotation().y : 0
      const steeringAngle = this.physics.getSteeringAngle()

      // Detect understeer/oversteer
      const expectedYaw = steeringAngle * this.physics.getSpeedMS() / this.specs.dimensions.wheelbase
      const yawError = Math.abs(yawRate - expectedYaw)

      if (yawError > 0.5 && lateralG > 0.5) {
        if (!this.stabilityControlActive) {
          this.stabilityControlActive = true
          this.onStabilityControlActivate?.()
        }

        // Apply corrective braking
        // Simplified: reduce throttle, apply individual wheel brakes
        this.input.throttle *= 0.7
        // Would apply selective braking here
      } else {
        this.stabilityControlActive = false
      }
    }

    // ABS
    if (this.config.abs) {
      let absActive = false
      for (let i = 0; i < 4; i++) {
        if (wheelStates[i].contact.slipRatio < -0.3 && this.input.brake > 0.3) {
          absActive = true
          break
        }
      }

      if (absActive && !this.absActive) {
        this.absActive = true
        this.onABSActivate?.()
      } else if (!absActive) {
        this.absActive = false
      }

      // Pulse brakes if ABS active
      if (this.absActive) {
        this.input.brake *= 0.7 + 0.3 * Math.sin(Date.now() * 0.02)
      }
    }
  }

  private updateWheelSlip(): void {
    const wheelStates = this.physics.getWheelStates()

    for (let i = 0; i < 4; i++) {
      const wheelSpeed = wheelStates[i].rotationSpeed * this.specs.wheelRadius
      const vehicleSpeed = this.physics.getSpeedMS()

      if (vehicleSpeed > 1) {
        // Longitudinal slip ratio
        const slipRatio = (wheelSpeed - vehicleSpeed) / Math.max(vehicleSpeed, 1)
        this.wheelSlip[i] = slipRatio
      }
    }
  }

  private getMaxGear(): number {
    return 5 // Would come from gearbox specs
  }

  // ============================================
  // PUBLIC API
  // ============================================

  getCurrentGear(): number {
    return this.currentGear
  }

  getTargetGear(): number {
    return this.targetGear
  }

  isShiftingGear(): boolean {
    return this.isShifting
  }

  getClutchPosition(): number {
    return this.clutchPosition
  }

  isEngineRunning(): boolean {
    return this.engineRunning
  }

  setEngineRunning(running: boolean): void {
    this.engineRunning = running
  }

  getTractionControlActive(): boolean {
    return this.tractionControlActive
  }

  getStabilityControlActive(): boolean {
    return this.stabilityControlActive
  }

  getABSActive(): boolean {
    return this.absActive
  }

  getSteeringAngle(): number {
    return this.steeringInput
  }

  getWheelSlip(): number[] {
    return [...this.wheelSlip]
  }

  setConfig(config: Partial<ControllerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): ControllerConfig {
    return { ...this.config }
  }

  // Assist toggles
  setTractionControl(enabled: boolean): void {
    this.config.tractionControl = enabled
  }

  setStabilityControl(enabled: boolean): void {
    this.config.stabilityControl = enabled
  }

  setABS(enabled: boolean): void {
    this.config.abs = enabled
  }

  setAutoClutch(enabled: boolean): void {
    this.config.autoClutch = enabled
  }

  // For external control (AI, replay, etc.)
  setDirectInput(throttle: number, brake: number, steer: number, handbrake: boolean): void {
    this.input.throttle = THREE.MathUtils.clamp(throttle, 0, 1)
    this.input.brake = THREE.MathUtils.clamp(brake, 0, 1)
    this.input.steer = THREE.MathUtils.clamp(steer, -1, 1)
    this.input.handbrake = handbrake
  }

  // Emergency stop
  emergencyStop(): void {
    this.input.throttle = 0
    this.input.brake = 1
    this.input.handbrake = true
    this.input.steer = 0
    this.steeringInput = 0
  }

  // Drift mode (disable assists)
  setDriftMode(enabled: boolean): void {
    this.config.tractionControl = !enabled
    this.config.stabilityControl = !enabled
    this.config.abs = !enabled
    this.config.autoClutch = !enabled
    this.config.autoBlip = !enabled
  }
}

// ============================================
// INPUT MAPPING HELPERS
// ============================================

export class KeyboardInputMapper {
  private keys: Set<string> = new Set()
  private controller: VehicleController

  constructor(controller: VehicleController) {
    this.controller = controller
    this.setupListeners()
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e) => this.keys.add(e.code))
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
  }

  update(): void {
    const input: Partial<ControllerInput> = {}

    // Throttle/Brake
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) input.throttle = 1
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) input.brake = 1

    // Steering
    let steer = 0
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) steer -= 1
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) steer += 1
    input.steer = steer

    // Handbrake
    if (this.keys.has('Space')) input.handbrake = true

    // Gears
    if (this.keys.has('ShiftLeft') || this.keys.has('KeyE')) input.shiftUp = true
    if (this.keys.has('ControlLeft') || this.keys.has('KeyQ')) input.shiftDown = true

    // Clutch
    if (this.keys.has('KeyC')) input.clutch = 0

    // Ignition
    if (this.keys.has('KeyI')) input.ignition = true
    if (this.keys.has('KeyO')) input.starter = true

    // Camera
    if (this.keys.has('Digit1')) input.cameraMode = 0
    if (this.keys.has('Digit2')) input.cameraMode = 1
    if (this.keys.has('Digit3')) input.cameraMode = 2
    if (this.keys.has('Digit4')) input.cameraMode = 3

    this.controller.setInput(input)
  }

  dispose(): void {
    // Listeners would need proper removal in real implementation
  }
}

export class GamepadInputMapper {
  private controller: VehicleController
  private gamepadIndex = 0
  private deadzone = 0.1

  constructor(controller: VehicleController, gamepadIndex = 0) {
    this.controller = controller
    this.gamepadIndex = gamepadIndex
  }

  update(): void {
    const gamepads = navigator.getGamepads()
    const gp = gamepads[this.gamepadIndex]

    if (!gp) return

    const input: Partial<ControllerInput> = {}

    // Throttle (RT / R2)
    const throttle = gp.axes[5] // Usually RT
    if (throttle > this.deadzone) input.throttle = (throttle + 1) / 2

    // Brake (LT / L2)
    const brake = gp.axes[2] // Usually LT
    if (brake > this.deadzone) input.brake = (brake + 1) / 2

    // Steering (Left stick X)
    const steer = gp.axes[0]
    if (Math.abs(steer) > this.deadzone) input.steer = steer

    // Handbrake (A / Cross)
    if (gp.buttons[0].pressed) input.handbrake = true

    // Shift up (RB / R1)
    if (gp.buttons[5].pressed) input.shiftUp = true

    // Shift down (LB / L1)
    if (gp.buttons[4].pressed) input.shiftDown = true

    // Clutch (Left stick click / L3)
    if (gp.buttons[10].pressed) input.clutch = 0

    // Ignition/Start (Start button)
    if (gp.buttons[9].pressed) input.ignition = true

    // Camera mode (D-pad)
    if (gp.buttons[12].pressed) input.cameraMode = 0 // Up
    if (gp.buttons[13].pressed) input.cameraMode = 1 // Down
    if (gp.buttons[14].pressed) input.cameraMode = 2 // Left
    if (gp.buttons[15].pressed) input.cameraMode = 3 // Right

    this.controller.setInput(input)
  }
}