import * as THREE from 'three'
import { DamageModel, SubsystemName } from './DamageModel.js'

// ============================================
// MECHANICAL SYSTEMS (Runtime Simulation)
// ============================================

export interface SystemTemperatureState {
  current: number // Celsius
  target: number
  rate: number // deg/s heating
  coolingRate: number // deg/s cooling
}

export interface SystemCondition {
  health: number // 0-100
  wear: number // 0-1
  noise: number // 0-1 current noise level
  vibration: number // 0-1 current vibration
  efficiency: number // 0-1
  temperature: SystemTemperatureState
  pressure: number // bar (for fluids/pressure systems)
  flow: number // 0-1 (for fluid/pump systems)

  // Threshold tracking
  wasOverheating?: boolean
  wasHardFailed?: boolean
  wasNoisy?: boolean
  wasVibrating?: boolean
  play?: number // degrees of play for steering
}

export interface MechanicalSystemConfig {
  // Temperature
  ambientTemp: number
  overheatTemp: number
  criticalTemp: number

  // Noise thresholds
  healthForNoise: number // health below which noise starts

  // Vibration thresholds
  healthForVibration: number

  // Failure modes
  hardFailureHealth: number

  // Wear rates (per hour of operation)
  wearRates: Record<SubsystemName, number>
}

const DEFAULT_CONFIG: MechanicalSystemConfig = {
  ambientTemp: 20,
  overheatTemp: 110,
  criticalTemp: 130,
  healthForNoise: 60,
  healthForVibration: 50,
  hardFailureHealth: 15,
  wearRates: {
    engine_block: 0.5,
    engine_head: 0.4,
    turbocharger: 0.8,
    fuel_system: 0.6,
    ignition_system: 0.5,
    cooling_system: 0.4,
    oil_system: 0.35,
    gearbox: 0.6,
    clutch: 0.75,
    differential: 0.4,
    driveshafts: 0.5,
    brakes_front: 1.0,
    brakes_rear: 0.75,
    suspension_front: 0.6,
    suspension_rear: 0.5,
    steering: 0.4,
    electrical: 0.25,
    exhaust: 0.5,
    transmission_mounts: 0.4,
    body_structure: 0.15,
    wheels: 1.2,
    radiator_grille: 0.3
  }
}

export interface MechanicalSystemState {
  conditions: Map<SubsystemName, SystemCondition>
  totalNoise: number
  totalVibration: number
  isAnyOverheating: boolean
  hasHardFailure: boolean
  averageEfficiency: number
  fuelConsumptionMultiplier: number
  powerMultiplier: number
  torqueMultiplier: number
  emissionsMultiplier: number
}

export class MechanicalSystems {
  private config: MechanicalSystemConfig
  private damageModel: DamageModel
  private state: MechanicalSystemState
  private runningTime = 0 // seconds since last service

  // System-specific state
  private turboSpool = 0
  private oilPressure = 4
  private coolantPressure = 1.5
  private fuelPressure = 3
  private batteryVoltage = 12.6
  private alternatorOutput = 14.2

  // Callbacks
  onOverheat?: (subsystem: SubsystemName, temp: number) => void
  onHardFailure?: (subsystem: SubsystemName) => void
  onNoiseThreshold?: (subsystem: SubsystemName, level: number) => void
  onVibrationThreshold?: (subsystem: SubsystemName, level: number) => void

  constructor(damageModel: DamageModel, config?: Partial<MechanicalSystemConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.damageModel = damageModel

    this.state = {
      conditions: new Map(),
      totalNoise: 0,
      totalVibration: 0,
      isAnyOverheating: false,
      hasHardFailure: false,
      averageEfficiency: 1,
      fuelConsumptionMultiplier: 1,
      powerMultiplier: 1,
      torqueMultiplier: 1,
      emissionsMultiplier: 1
    }

    this.initialize()
  }

  private initialize(): void {
    const subsystemNames: SubsystemName[] = [
      'engine_block', 'engine_head', 'turbocharger',
      'fuel_system', 'ignition_system',
      'cooling_system', 'oil_system',
      'gearbox', 'clutch', 'differential', 'driveshafts',
      'brakes_front', 'brakes_rear',
      'suspension_front', 'suspension_rear',
      'steering', 'electrical', 'exhaust',
      'transmission_mounts', 'body_structure'
    ]

    for (const name of subsystemNames) {
      this.state.conditions.set(name, {
        health: 100,
        wear: 0,
        noise: 0,
        vibration: 0,
        efficiency: 1,
        temperature: {
          current: this.config.ambientTemp,
          target: this.config.ambientTemp,
          rate: 0,
          coolingRate: 0.5
        },
        pressure: 1,
        flow: 1
      })
    }
  }

  /**
   * Main update - call every frame
   */
  update(deltaTime: number, vehicleState: any): void {
    this.runningTime += deltaTime

    // Sync conditions with damage model
    this.syncWithDamageModel()

    // Update each system
    this.updateEngineSystems(deltaTime, vehicleState)
    this.updateTransmissionSystems(deltaTime, vehicleState)
    this.updateBrakeSystems(deltaTime, vehicleState)
    this.updateSuspensionSystems(deltaTime, vehicleState)
    this.updateElectricalSystems(deltaTime, vehicleState)
    this.updateExhaustSystems(deltaTime, vehicleState)
    this.updateBodySystems(deltaTime, vehicleState)

    // Aggregate state
    this.aggregateState()

    // Check thresholds
    this.checkThresholds()
  }

  private syncWithDamageModel(): void {
    const mechState = this.damageModel.getMechanicalState()
    for (const [name, subsystem] of mechState.subsystems) {
      const condition = this.state.conditions.get(name)
      if (condition) {
        condition.health = subsystem.health
        condition.wear = subsystem.wear
      }
    }
  }

  private updateEngineSystems(deltaTime: number, vehicleState: any): void {
    const rpm = vehicleState.rpm || 800
    const throttle = vehicleState.throttle || 0
    const speed = vehicleState.speed || 0

    // Engine block & head temperature
    const engineCond = this.state.conditions.get('engine_block')!
    const headCond = this.state.conditions.get('engine_head')!
    const coolingCond = this.state.conditions.get('cooling_system')!

    // Target temperature based on load
    const targetTemp = this.config.ambientTemp + throttle * 80 + speed * 0.1
    engineCond.temperature.target = targetTemp
    headCond.temperature.target = targetTemp + 10

    // Cooling effectiveness (reduced if cooling system damaged)
    const coolingFactor = coolingCond.efficiency
    engineCond.temperature.coolingRate = 0.5 * coolingFactor
    headCond.temperature.coolingRate = 0.5 * coolingFactor

    // Update temperatures
    this.updateTemperature(engineCond.temperature, deltaTime)
    this.updateTemperature(headCond.temperature, deltaTime)

    // Turbocharger
    const turboCond = this.state.conditions.get('turbocharger')!
    if (this.isTurbocharged()) {
      const boostDemand = throttle * (rpm > 2000 ? 1 : rpm / 2000)
      this.turboSpool = THREE.MathUtils.lerp(this.turboSpool, boostDemand, deltaTime * 2)
      turboCond.temperature.target = this.config.ambientTemp + this.turboSpool * 400 + speed * 0.05
      this.updateTemperature(turboCond.temperature, deltaTime)

      // Turbo wear from heat
      if (turboCond.temperature.current > 200) {
        this.state.conditions.get('turbocharger')!.wear += deltaTime * 0.001
      }
    }

    // Fuel system
    const fuelCond = this.state.conditions.get('fuel_system')!
    fuelCond.pressure = 3 * fuelCond.efficiency + (1 - fuelCond.efficiency) * 0.5
    fuelCond.flow = fuelCond.efficiency

    // Ignition system
    const igCond = this.state.conditions.get('ignition_system')!
    igCond.efficiency = igCond.health / 100

    // Oil system
    const oilCond = this.state.conditions.get('oil_system')!
    this.oilPressure = 1 + (rpm / 6500) * 4 * oilCond.efficiency
    oilCond.pressure = this.oilPressure

    // Low oil pressure = bad
    if (this.oilPressure < 1 && rpm > 1000) {
      engineCond.health -= deltaTime * 5 // Rapid damage
    }
  }

  private updateTransmissionSystems(deltaTime: number, vehicleState: any): void {
    const rpm = vehicleState.rpm || 800
    const gear = vehicleState.gear || 1
    const speed = vehicleState.speed || 0

    // Gearbox
    const gbCond = this.state.conditions.get('gearbox')!
    gbCond.temperature.target = this.config.ambientTemp + 20 + Math.abs(speed) * 0.05
    this.updateTemperature(gbCond.temperature, deltaTime)

    // Clutch
    const clCond = this.state.conditions.get('clutch')!
    if (vehicleState.clutchSlip) {
      clCond.temperature.target = this.config.ambientTemp + vehicleState.clutchSlip * 100
      this.updateTemperature(clCond.temperature, deltaTime)
      clCond.wear += vehicleState.clutchSlip * deltaTime * 0.001
    }

    // Differential
    const diffCond = this.state.conditions.get('differential')!
    diffCond.temperature.target = this.config.ambientTemp + 15 + Math.abs(speed) * 0.08
    this.updateTemperature(diffCond.temperature, deltaTime)

    // Driveshafts
    const dsCond = this.state.conditions.get('driveshafts')!
    dsCond.vibration = dsCond.health < 50 ? (50 - dsCond.health) / 50 * 0.5 : 0
    dsCond.vibration += Math.abs(vehicleState.wheelSpeedDiff || 0) * 0.01

    // Transmission mounts
    const tmCond = this.state.conditions.get('transmission_mounts')!
    tmCond.vibration = tmCond.health < 50 ? (50 - tmCond.health) / 50 * 0.3 : 0
  }

  private updateBrakeSystems(deltaTime: number, vehicleState: any): void {
    const brake = vehicleState.brake || 0
    const speed = vehicleState.speed || 0

    // Front brakes
    const fbCond = this.state.conditions.get('brakes_front')!
    fbCond.temperature.target = this.config.ambientTemp + brake * Math.abs(speed) * 0.2
    this.updateTemperature(fbCond.temperature, deltaTime)
    fbCond.wear += brake * Math.abs(speed) * 0.00001

    // Rear brakes
    const rbCond = this.state.conditions.get('brakes_rear')!
    rbCond.temperature.target = this.config.ambientTemp + brake * Math.abs(speed) * 0.15
    this.updateTemperature(rbCond.temperature, deltaTime)
    rbCond.wear += brake * Math.abs(speed) * 0.000008

    // Brake fade at high temp
    if (fbCond.temperature.current > 300) {
      fbCond.efficiency = 0.5 + (400 - fbCond.temperature.current) / 200 * 0.5
    } else {
      fbCond.efficiency = fbCond.health / 100
    }
  }

  private updateSuspensionSystems(deltaTime: number, vehicleState: any): void {
    const speed = vehicleState.speed || 0
    const lateralG = vehicleState.lateralG || 0

    // Front suspension
    const fsCond = this.state.conditions.get('suspension_front')!
    fsCond.vibration = fsCond.health < 50 ? (50 - fsCond.health) / 50 * 0.4 : 0
    fsCond.vibration += Math.abs(lateralG) * 0.02

    // Rear suspension
    const rsCond = this.state.conditions.get('suspension_rear')!
    rsCond.vibration = rsCond.health < 50 ? (50 - rsCond.health) / 50 * 0.4 : 0
    rsCond.vibration += Math.abs(lateralG) * 0.015

    // Steering
    const stCond = this.state.conditions.get('steering')!
    stCond.play = stCond.health < 50 ? (50 - stCond.health) / 50 * 0.2 : 0 // degrees
  }

  private updateElectricalSystems(deltaTime: number, vehicleState: any): void {
    const rpm = vehicleState.rpm || 800
    const electricalCond = this.state.conditions.get('electrical')!

    // Alternator output
    this.alternatorOutput = rpm > 1000 ? 14.2 : 11.5
    this.batteryVoltage = THREE.MathUtils.lerp(this.batteryVoltage, this.alternatorOutput, deltaTime * 0.5)

    // Battery drain if not charging
    if (rpm < 500) {
      this.batteryVoltage -= deltaTime * 0.1
    }

    // Electrical issues
    electricalCond.efficiency = electricalCond.health / 100
    if (this.batteryVoltage < 11) {
      electricalCond.efficiency *= 0.5
    }
  }

  private updateExhaustSystems(deltaTime: number, vehicleState: any): void {
    const throttle = vehicleState.throttle || 0

    // Exhaust system
    const exCond = this.state.conditions.get('exhaust')!
    exCond.temperature.target = this.config.ambientTemp + throttle * 400
    this.updateTemperature(exCond.temperature, deltaTime)

    // Emissions
    exCond.pressure = throttle * 1.5 + 0.5 * exCond.efficiency
  }

  private updateBodySystems(deltaTime: number, vehicleState: any): void {
    // Body structure integrity
    const bodyCond = this.state.conditions.get('body_structure')!
    bodyCond.vibration = bodyCond.health < 50 ? (50 - bodyCond.health) / 50 * 0.2 : 0

    // Creaking at low health
    bodyCond.noise = bodyCond.health < 60 ? (60 - bodyCond.health) / 60 * 0.3 : 0
  }

  private updateTemperature(temp: SystemTemperatureState, deltaTime: number): void {
    if (temp.current < temp.target) {
      temp.current += Math.min(temp.rate * deltaTime, temp.target - temp.current + 0.1)
    } else {
      temp.current -= Math.min(temp.coolingRate * deltaTime, temp.current - temp.target + 0.1)
    }
    temp.current = THREE.MathUtils.clamp(temp.current, this.config.ambientTemp, 300)
  }

  private aggregateState(): void {
    let totalNoise = 0
    let totalVibration = 0
    let efficiencySum = 0
    let overheating = false
    let hardFailure = false
    let subsystemCount = 0

    let fuelMulti = 1
    let powerMulti = 1
    let torqueMulti = 1
    let emissionsMulti = 1

    for (const [name, condition] of this.state.conditions) {
      // Noise from health
      if (condition.health < this.config.healthForNoise) {
        condition.noise = (this.config.healthForNoise - condition.health) / this.config.healthForNoise * 0.7
      } else {
        condition.noise = 0
      }

      // Additional noise from temperature
      if (condition.temperature.current > 100) {
        condition.noise += (condition.temperature.current - 100) / 100 * 0.3
      }
      condition.noise = Math.min(1, condition.noise)

      totalNoise += condition.noise
      totalVibration += condition.vibration

      // Efficiency
      efficiencySum += condition.efficiency
      subsystemCount++

      // Overheating
      if (condition.temperature.current > this.config.overheatTemp) {
        overheating = true
      }
      if (condition.temperature.current > this.config.criticalTemp) {
        condition.health -= 10 * 0.016 // Rapid damage from extreme heat
      }

      // Hard failure
      if (condition.health < this.config.hardFailureHealth) {
        hardFailure = true
      }

      // Performance multipliers
      switch (name) {
        case 'engine_block':
          powerMulti *= 0.5 + condition.health / 200
          torqueMulti *= 0.5 + condition.health / 200
          fuelMulti *= condition.efficiency > 0.8 ? 1 : 1.2
          break
        case 'fuel_system':
          fuelMulti *= condition.efficiency > 0.8 ? 1 : 1.3
          emissionsMulti *= condition.efficiency > 0.8 ? 1 : 1.5
          break
        case 'exhaust':
          emissionsMulti *= condition.efficiency > 0.8 ? 1 : 1.4
          break
        case 'oil_system':
          powerMulti *= condition.efficiency > 0.7 ? 1 : 0.95
          break
      }
    }

    this.state.totalNoise = totalNoise / subsystemCount
    this.state.totalVibration = totalVibration / subsystemCount
    this.state.averageEfficiency = efficiencySum / subsystemCount
    this.state.isAnyOverheating = overheating
    this.state.hasHardFailure = hardFailure
    this.state.fuelConsumptionMultiplier = fuelMulti
    this.state.powerMultiplier = powerMulti
    this.state.torqueMultiplier = torqueMulti
    this.state.emissionsMultiplier = emissionsMulti
  }

  private checkThresholds(): void {
    for (const [name, condition] of this.state.conditions) {
      // Overheat
      if (condition.temperature.current > this.config.overheatTemp && !condition.wasOverheating) {
        condition.wasOverheating = true
        this.onOverheat?.(name, condition.temperature.current)
      } else if (condition.temperature.current < this.config.overheatTemp - 10) {
        condition.wasOverheating = false
      }

      // Hard failure
      if (condition.health < this.config.hardFailureHealth && !condition.wasHardFailed) {
        condition.wasHardFailed = true
        this.onHardFailure?.(name)
      } else if (condition.health > this.config.hardFailureHealth + 10) {
        condition.wasHardFailed = false
      }

      // Noise threshold
      if (condition.noise > 0.5 && !condition.wasNoisy) {
        condition.wasNoisy = true
        this.onNoiseThreshold?.(name, condition.noise)
      } else if (condition.noise < 0.3) {
        condition.wasNoisy = false
      }

      // Vibration threshold
      if (condition.vibration > 0.5 && !condition.wasVibrating) {
        condition.wasVibrating = true
        this.onVibrationThreshold?.(name, condition.vibration)
      } else if (condition.vibration < 0.3) {
        condition.wasVibrating = false
      }
    }
  }

  private isTurbocharged(): boolean {
    // Would check specs - simplified
    return true
  }

  // ============================================
  // PUBLIC API
  // ============================================

  getState(): MechanicalSystemState {
    return this.state
  }

  getCondition(subsystem: SubsystemName): SystemCondition | undefined {
    return this.state.conditions.get(subsystem)
  }

  getTemperature(subsystem: SubsystemName): number {
    return this.state.conditions.get(subsystem)?.temperature.current || this.config.ambientTemp
  }

  getNoise(subsystem: SubsystemName): number {
    return this.state.conditions.get(subsystem)?.noise || 0
  }

  getVibration(subsystem: SubsystemName): number {
    return this.state.conditions.get(subsystem)?.vibration || 0
  }

  getEfficiency(subsystem: SubsystemName): number {
    return this.state.conditions.get(subsystem)?.efficiency || 0
  }

  getPressure(subsystem: SubsystemName): number {
    return this.state.conditions.get(subsystem)?.pressure ?? 0
  }

  getFlow(subsystem: SubsystemName): number {
    return this.state.conditions.get(subsystem)?.flow ?? 0
  }

  getTotalNoise(): number {
    return this.state.totalNoise
  }

  getTotalVibration(): number {
    return this.state.totalVibration
  }

  isOverheating(): boolean {
    return this.state.isAnyOverheating
  }

  hasHardFailure(): boolean {
    return this.state.hasHardFailure
  }

  getAverageEfficiency(): number {
    return this.state.averageEfficiency
  }

  getFuelConsumptionMultiplier(): number {
    return this.state.fuelConsumptionMultiplier
  }

  getPowerMultiplier(): number {
    return this.state.powerMultiplier
  }

  getTorqueMultiplier(): number {
    return this.state.torqueMultiplier
  }

  getEmissionsMultiplier(): number {
    return this.state.emissionsMultiplier
  }

  getTurboSpool(): number {
    return this.turboSpool
  }

  getOilPressure(): number {
    return this.oilPressure
  }

  getBatteryVoltage(): number {
    return this.batteryVoltage
  }

  getAlternatorOutput(): number {
    return this.alternatorOutput
  }

  // For diagnostics
  getDiagnostics(): {
    subsystem: SubsystemName
    health: number
    temperature: number
    noise: number
    vibration: number
    efficiency: number
    pressure: number
  }[] {
    const diagnostics: any[] = []
    for (const [name, condition] of this.state.conditions) {
      diagnostics.push({
        subsystem: name,
        health: condition.health,
        temperature: condition.temperature.current,
        noise: condition.noise,
        vibration: condition.vibration,
        efficiency: condition.efficiency,
        pressure: condition.pressure
      })
    }
    return diagnostics
  }

  setConfig(config: Partial<MechanicalSystemConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): MechanicalSystemConfig {
    return { ...this.config }
  }

  // Serialize for save
  serialize(): any {
    const conditions: any = {}
    for (const [name, condition] of this.state.conditions) {
      conditions[name] = {
        health: condition.health,
        wear: condition.wear,
        noise: condition.noise,
        vibration: condition.vibration,
        efficiency: condition.efficiency,
        temperature: { ...condition.temperature },
        pressure: condition.pressure,
        flow: condition.flow
      }
    }

    return {
      conditions,
      runningTime: this.runningTime,
      turboSpool: this.turboSpool,
      oilPressure: this.oilPressure,
      coolantPressure: this.coolantPressure,
      fuelPressure: this.fuelPressure,
      batteryVoltage: this.batteryVoltage,
      alternatorOutput: this.alternatorOutput,
      config: this.config
    }
  }

  deserialize(data: any): void {
    if (data.conditions) {
      for (const [name, condition] of Object.entries(data.conditions)) {
        const c = this.state.conditions.get(name as SubsystemName)
        if (c) Object.assign(c, condition)
      }
    }

    this.runningTime = data.runningTime || 0
    this.turboSpool = data.turboSpool || 0
    this.oilPressure = data.oilPressure || 4
    this.coolantPressure = data.coolantPressure || 1.5
    this.fuelPressure = data.fuelPressure || 3
    this.batteryVoltage = data.batteryVoltage || 12.6
    this.alternatorOutput = data.alternatorOutput || 14.2

    if (data.config) this.config = { ...this.config, ...data.config }
  }
}
