import * as THREE from 'three'
import {
  DamageModel, PanelName, SubsystemName,
  VisualDamageState, MechanicalDamageState
} from './DamageModel.js'

/**
 * RepairSystem - Diagnosis minigame, parts replacement, tools
 * Player-facing repair gameplay: OBD scanning, component testing, part fitting
 */

// ============================================
// DIAGNOSIS SYSTEM
// ============================================

export interface FaultCode {
  code: string // e.g. P0301
  description: string
  subsystem: SubsystemName | null
  severity: 'info' | 'warning' | 'critical'
  isStored: boolean // historical vs current
  isPending: boolean // intermittent
  freezeFrame: {
    rpm: number
    speed: number
    coolantTemp: number
    load: number
    timestamp: number
  }
}

export interface LiveDataReading {
  name: string
  value: number
  unit: string
  min: number
  max: number
  isAbnormal: boolean
  abnormality?: string
  subsystem: SubsystemName | null
}

export type DiagnosticTool = 'obd_scanner' | 'multimeter' | 'compression_tester' | 'borescope' | 'stethoscope' | 'pressure_tester' | 'smoke_machine'

export interface DiagnosticResult {
  tool: DiagnosticTool
  subsystem: SubsystemName
  readings: LiveDataReading[]
  faultCodes: FaultCode[]
  suspectedFaults: { subsystem: SubsystemName; confidence: number; reason: string }[]
  confirmedFault?: { subsystem: SubsystemName; failureMode: string }
}

const FAULT_CODE_TABLE: Record<SubsystemName, { codes: string[]; descriptions: string[] }> = {
  engine_block: {
    codes: ['P0300', 'P0301', 'P0302', 'P0303', 'P0304', 'P0327', 'P0335'],
    descriptions: ['Random/multiple cylinder misfire', 'Cylinder 1 misfire', 'Cylinder 2 misfire', 'Cylinder 3 misfire', 'Cylinder 4 misfire', 'Knock sensor circuit', 'Crankshaft position sensor']
  },
  engine_head: { codes: ['P0011', 'P0016', 'P0340'], descriptions: ['Camshaft timing over-advanced', 'Crank/cam correlation', 'Camshaft position sensor'] },
  turbocharger: { codes: ['P0299', 'P0234', 'P2262'], descriptions: ['Underboost condition', 'Overboost condition', 'Boost pressure not detected'] },
  fuel_system: { codes: ['P0087', 'P0171', 'P0172', 'P0190'], descriptions: ['Fuel rail pressure too low', 'System too lean (bank 1)', 'System too rich (bank 1)', 'Fuel rail pressure sensor'] },
  ignition_system: { codes: ['P0351', 'P0352', 'P0353', 'P0354', 'P2300'], descriptions: ['Ignition coil A primary', 'Ignition coil B primary', 'Ignition coil C primary', 'Ignition coil D primary', 'Ignition coil open'] },
  cooling_system: { codes: ['P0128', 'P0117', 'P2181', 'P0480'], descriptions: ['Coolant below thermostat temp', 'Coolant temp sensor low', 'Cooling system performance', 'Fan 1 control circuit'] },
  oil_system: { codes: ['P0520', 'P0521', 'P0524'], descriptions: ['Oil pressure sensor circuit', 'Oil pressure sensor range', 'Engine oil pressure too low'] },
  gearbox: { codes: ['P0700', 'P0730', 'P0715'], descriptions: ['Transmission control system', 'Incorrect gear ratio', 'Input/turbine speed sensor'] },
  clutch: { codes: ['P0810', 'P0812', 'P2711'], descriptions: ['Clutch position learning', 'Reverse input circuit', 'Unexpected mechanical disengagement'] },
  differential: { codes: ['C1233', 'C1240'], descriptions: ['Diff speed sensor', 'Diff lock actuator'] },
  driveshafts: { codes: ['C1201', 'VSC44'], descriptions: ['ABS wheel speed anomaly', 'Propshaft vibration detected'] },
  brakes_front: { codes: ['C1210', 'C1095', 'P0571'], descriptions: ['ABS pump motor circuit', 'Hydraulic pump relay', 'Brake switch circuit'] },
  brakes_rear: { codes: ['C1211', 'C1096', 'C0245'], descriptions: ['ABS valve relay', 'Hydraulic pump motor', 'Wheel speed sensor frequency error'] },
  suspension_front: { codes: ['C1511', 'U0129', 'C0561'], descriptions: ['Front ride height sensor', 'Lost comm with ABS', 'System disabled information'] },
  suspension_rear: { codes: ['C1512', 'C1521', 'C0775'], descriptions: ['Rear ride height sensor', 'Damper solenoid front left', 'Pressure drop detected'] },
  steering: { codes: ['C1513', 'U0100', 'C0550'], descriptions: ['Steering angle sensor plausibility', 'Lost comm with ECM', 'ECU internal malfunction'] },
  electrical: { codes: ['P0562', 'P0620', 'U0101', 'B1000'], descriptions: ['System voltage low', 'Alternator control circuit', 'Lost comm with TCM', 'ECU internal fault'] },
  exhaust: { codes: ['P0420', 'P0430', 'P2002'], descriptions: ['Catalyst efficiency below threshold (bank 1)', 'Catalyst efficiency below threshold (bank 2)', 'Particulate filter efficiency'] },
  transmission_mounts: { codes: [], descriptions: [] },
  body_structure: { codes: [], descriptions: [] },
  wheels: { codes: ['C1095', 'C1096', 'C1097'], descriptions: ['Wheel speed sensor fault', 'Wheel speed sensor circuit', 'Wheel bearing anomaly'] },
  radiator_grille: { codes: ['P0128', 'P0480', 'P0481'], descriptions: ['Coolant thermostat performance', 'Fan 1 control circuit', 'Fan 2 control circuit'] }
}

export class DiagnosisSystem {
  private connectedVehicle: string | null = null
  private storedCodes: Map<SubsystemName, FaultCode[]> = new Map()
  private pendingCodes: Map<SubsystemName, FaultCode[]> = new Map()

  /**
   * Connect scanner to vehicle
   */
  connect(vehicleId: string): void {
    this.connectedVehicle = vehicleId
    this.storedCodes.clear()
    this.pendingCodes.clear()
  }

  disconnect(): void {
    this.connectedVehicle = null
  }

  isConnected(): boolean {
    return this.connectedVehicle !== null
  }

  /**
   * Scan for fault codes - takes time to "read" ECU
   */
  async scanFaultCodes(damageModel: DamageModel): Promise<FaultCode[]> {
    if (!this.isConnected()) throw new Error('Scanner not connected')

    // Simulate scan time
    await new Promise(resolve => setTimeout(resolve, 1500))

    const codes: FaultCode[] = []
    const mechState = damageModel.getMechanicalState()

    for (const [name, subsystem] of mechState.subsystems) {
      const table = FAULT_CODE_TABLE[name]
      if (!table || table.codes.length === 0) continue

      // Generate codes based on damage level
      const damageLevel = 1 - subsystem.health / 100

      if (subsystem.isFailed) {
        // Failed systems get a current code
        const idx = Math.floor(Math.random() * table.codes.length)
        codes.push({
          code: table.codes[idx],
          description: table.descriptions[idx],
          subsystem: name,
          severity: 'critical',
          isStored: false,
          isPending: false,
          freezeFrame: this.generateFreezeFrame()
        })
      } else if (damageLevel > 0.4 && Math.random() < damageLevel * 0.8) {
        // Damaged systems get pending or stored codes
        const idx = Math.floor(Math.random() * table.codes.length)
        codes.push({
          code: table.codes[idx],
          description: table.descriptions[idx],
          subsystem: name,
          severity: damageLevel > 0.6 ? 'warning' : 'info',
          isStored: Math.random() < 0.5,
          isPending: Math.random() < 0.3,
          freezeFrame: this.generateFreezeFrame()
        })
      }
    }

    return codes
  }

  private generateFreezeFrame(): FaultCode['freezeFrame'] {
    return {
      rpm: Math.round(800 + Math.random() * 4000),
      speed: Math.round(Math.random() * 100),
      coolantTemp: Math.round(85 + Math.random() * 25),
      load: Math.round(Math.random() * 100),
      timestamp: Date.now()
    }
  }

  /**
   * Read live data from sensors
   */
  readLiveData(vehicleState: any): LiveDataReading[] {
    const readings: LiveDataReading[] = []

    const addReading = (
      name: string, value: number, unit: string, min: number, max: number,
      normalMin: number, normalMax: number, subsystem: SubsystemName | null
    ) => {
      const isAbnormal = value < normalMin || value > normalMax
      let abnormality: string | undefined
      if (isAbnormal) {
        abnormality = value < normalMin ? `Below expected (${normalMin}${unit})` : `Above expected (${normalMax}${unit})`
      }
      readings.push({ name, value, unit, min, max, isAbnormal, abnormality, subsystem })
    }

    // Engine parameters
    addReading('Engine RPM', vehicleState.engineRPM || 0, 'rpm', 0, 8000, 750, 6500, 'engine_block')
    addReading('Coolant Temp', vehicleState.coolantTemp || 20, '°C', 0, 130, 88, 105, 'cooling_system')
    addReading('Oil Pressure', vehicleState.oilPressure || 0, 'bar', 0, 8, 2.5, 6, 'oil_system')
    addReading('Intake Air Temp', vehicleState.intakeAirTemp || 20, '°C', -10, 80, 15, 55, 'turbocharger')
    addReading('Boost Pressure', (vehicleState.boost || 0), 'bar', -0.5, 2.5, -0.2, 1.5, 'turbocharger')
    addReading('Battery Voltage', vehicleState.batteryVoltage || 14.4, 'V', 0, 16, 13.5, 14.8, 'electrical')
    addReading('Throttle Position', (vehicleState.throttle || 0) * 100, '%', 0, 100, 0, 100, null)
    addReading('Fuel Rail Pressure', vehicleState.fuelRailPressure || 350, 'bar', 0, 500, 250, 450, 'fuel_system')
    addReading('Lambda / O2 Sensor', vehicleState.lambda || 1.0, '', 0, 2, 0.97, 1.03, 'fuel_system')
    addReading('Misfire Count (cyl 1)', vehicleState.misfireCount1 || 0, '', 0, 999, 0, 5, 'ignition_system')
    addReading('Misfire Count (cyl 2)', vehicleState.misfireCount2 || 0, '', 0, 999, 0, 5, 'ignition_system')
    addReading('Misfire Count (cyl 3)', vehicleState.misfireCount3 || 0, '', 0, 999, 0, 5, 'ignition_system')
    addReading('Misfire Count (cyl 4)', vehicleState.misfireCount4 || 0, '', 0, 999, 0, 5, 'ignition_system')

    return readings
  }

  /**
   * Perform specific test on subsystem
   */
  performTest(
    tool: DiagnosticTool,
    subsystem: SubsystemName,
    damageModel: DamageModel
  ): DiagnosticResult {
    const subsystemData = damageModel.getSubsystemDamage(subsystem)
    const health = subsystemData?.health ?? 100

    const result: DiagnosticResult = {
      tool,
      subsystem,
      readings: [],
      faultCodes: [],
      suspectedFaults: [],
      confirmedFault: undefined
    }

    switch (tool) {
      case 'compression_tester':
        result.readings = this.compressionTest(health)
        break
      case 'multimeter':
        result.readings = this.multimeterTest(subsystem, health)
        break
      case 'borescope':
        result.readings = this.borescopeTest(subsystem, health)
        break
      case 'pressure_tester':
        result.readings = this.pressureTest(subsystem, health)
        break
      case 'stethoscope':
        result.suspectedFaults = this.stethoscopeAnalysis(subsystem, health)
        break
      case 'smoke_machine':
        result.readings = this.smokeTest(subsystem, health)
        break
    }

    // Confirm fault if health is critical and test shows it
    if (health < 40 && Math.random() < (40 - health) / 40) {
      result.confirmedFault = {
        subsystem,
        failureMode: subsystemData?.failureMode || 'wear_related_failure'
      }
    } else if (health < 70) {
      result.suspectedFaults.push({
        subsystem,
        confidence: THREE.MathUtils.mapLinear(health, 70, 0, 0.2, 0.9),
        reason: `${tool.replace('_', ' ')} readings outside spec`
      })
    }

    return result
  }

  private compressionTest(health: number): LiveDataReading[] {
    const cylinders = [1, 2, 3, 4]
    return cylinders.map(cyl => {
      const baseCompression = THREE.MathUtils.mapLinear(health, 0, 100, 6, 14)
      const value = Math.max(4, baseCompression + (Math.random() - 0.5) * 1.5)
      return {
        name: `Cylinder ${cyl} Compression`,
        value: Math.round(value * 10) / 10,
        unit: 'bar',
        min: 0,
        max: 20,
        isAbnormal: value < 11,
        abnormality: value < 8 ? 'Severely low - possible valve/piston damage' :
                     value < 11 ? 'Low - worn rings or valves' : undefined,
        subsystem: 'engine_block' as SubsystemName
      }
    })
  }

  private multimeterTest(subsystem: SubsystemName, health: number): LiveDataReading[] {
    const voltageBase = THREE.MathUtils.mapLinear(health, 0, 100, 8, 14.4)
    return [
      {
        name: 'Supply Voltage',
        value: Math.round(voltageBase * 10) / 10,
        unit: 'V',
        min: 0, max: 16,
        isAbnormal: voltageBase < 12,
        abnormality: voltageBase < 10 ? 'Critical undervoltage' : voltageBase < 12 ? 'Low voltage' : undefined,
        subsystem: 'electrical' as SubsystemName
      },
      {
        name: 'Ground Resistance',
        value: Math.round((1 - health / 100) * 50 * 100) / 100,
        unit: 'Ω',
        min: 0, max: 100,
        isAbnormal: health < 60,
        abnormality: health < 60 ? 'High resistance - corroded connection likely' : undefined,
        subsystem: 'electrical' as SubsystemName
      },
      {
        name: 'Signal Continuity',
        value: health > 50 ? 0 : 1,
        unit: '',
        min: 0, max: 1,
        isAbnormal: health < 50,
        abnormality: health < 50 ? 'Open circuit detected in harness' : undefined,
        subsystem: subsystem as SubsystemName
      }
    ]
  }

  private borescopeTest(subsystem: SubsystemName, health: number): LiveDataReading[] {
    const findings = [
      { name: 'Cylinder Wall Condition', value: Math.round(health), unit: '%', min: 0, max: 100, isAbnormal: health < 60, abnormality: health < 40 ? 'Deep scoring visible' : health < 60 ? 'Light scoring, honing marks fading' : undefined, subsystem },
      { name: 'Valve Condition', value: Math.round(Math.max(0, health - 10)), unit: '%', min: 0, max: 100, isAbnormal: health < 65, abnormality: health < 45 ? 'Carbon deposits heavy, valve seat damage' : undefined, subsystem },
      { name: 'Piston Crown', value: Math.round(Math.max(0, health + 5)), unit: '%', min: 0, max: 100, isAbnormal: health < 50, abnormality: health < 30 ? 'Melting/pitting on crown' : undefined, subsystem }
    ]
    return findings
  }

  private pressureTest(subsystem: SubsystemName, health: number): LiveDataReading[] {
    const specs: Record<string, [number, string]> = {
      cooling_system: [1.1, 'bar'],
      fuel_system: [4.0, 'bar'],
      engine_block: [0.8, 'bar']
    }
    const [baseSpec, unit] = specs[subsystem] || [1.0, 'bar']
    const actual = THREE.MathUtils.mapLinear(health, 0, 100, baseSpec * 0.3, baseSpec)

    return [{
      name: 'System Pressure',
      value: Math.round(actual * 100) / 100,
      unit,
      min: 0, max: baseSpec * 2,
      isAbnormal: actual < baseSpec * 0.85,
      abnormality: actual < baseSpec * 0.5 ? 'Major leak - pressure cannot hold' :
                   actual < baseSpec * 0.85 ? 'Slow pressure loss - small leak present' : undefined,
      subsystem
    }]
  }

  private stethoscopeAnalysis(subsystem: SubsystemName, health: number): { subsystem: SubsystemName; confidence: number; reason: string }[] {
    const suspicions: { subsystem: SubsystemName; confidence: number; reason: string }[] = []

    if (health < 85) {
      suspicions.push({
        subsystem,
        confidence: THREE.MathUtils.mapLinear(health, 85, 0, 0.2, 0.95),
        reason: 'Irregular mechanical noise detected at operating frequency'
      })
    }
    if (health < 50) {
      suspicions.push({
        subsystem,
        confidence: THREE.MathUtils.mapLinear(health, 50, 0, 0.3, 0.9),
        reason: 'Metallic knocking/bearing rumble audible'
      })
    }
    return suspicions
  }

  private smokeTest(subsystem: SubsystemName, health: number): LiveDataReading[] {
    return [{
      name: 'Leak Detection',
      value: Math.round((1 - health / 100) * 100),
      unit: '%',
      min: 0, max: 100,
      isAbnormal: health < 75,
      abnormality: health < 50 ? 'Visible smoke escape - significant leak' :
                   health < 75 ? 'Minor smoke seepage detected' : undefined,
      subsystem
    }]
  }

  serialize(): any {
    return {
      connectedVehicle: this.connectedVehicle,
      storedCodes: Array.from(this.storedCodes.entries()),
      pendingCodes: Array.from(this.pendingCodes.entries())
    }
  }

  deserialize(data: any): void {
    this.connectedVehicle = data.connectedVehicle || null
    this.storedCodes = new Map(data.storedCodes || [])
    this.pendingCodes = new Map(data.pendingCodes || [])
  }
}

// ============================================
// PART SYSTEM
// ============================================

export type PartCondition = 'new' | 'refurbished' | 'used' | 'scrapyard'

export interface Part {
  id: string
  name: string
  category: SubsystemName
  brand: string
  qualityTier: 1 | 2 | 3 // budget / standard / OEM
  priceNew: number
  condition: PartCondition
  conditionMultiplier: number // affects lifespan
  stock: number
  compatibleWith: string[] // vehicle spec IDs
  installTimeMinutes: number
  requiresTools: ToolRequirement[]
}

export interface ToolRequirement {
  tool: 'socket_set' | 'torque_wrench' | 'spanner_set' | 'screwdriver_set' | 'pliers' |
        'jack' | 'axle_stands' | 'engine_hoist' | 'transmission_jack' | 'spring_compressors' |
        'brake_bleeder_kit' | 'diagnostic_scanner' | 'impact_wrench' | 'oil_filter_wrench'
  size?: string
  optional?: boolean
}

export class PartCatalogue {
  private parts: Map<string, Part> = new Map()
  private brands = ['BudgetParts', 'MotorTech', 'OEM Genuine', 'Boschmann', 'LucasElectrics', 'Ferrodo', 'MannFilter']

  constructor() {
    this.generateCatalogue()
  }

  private generateCatalogue(): void {
    const subsystems: { sub: SubsystemName; parts: { name: string; basePrice: number; tools: ToolRequirement[]; minutes: number }[] }[] = [
      {
        sub: 'engine_block',
        parts: [
          { name: 'Full Engine Gasket Set', basePrice: 120, tools: [{ tool: 'torque_wrench' }, { tool: 'engine_hoist' }, { tool: 'socket_set' }], minutes: 480 },
          { name: 'Oil Pump', basePrice: 85, tools: [{ tool: 'socket_set' }, { tool: 'torque_wrench' }], minutes: 240 },
          { name: 'Big End Bearing Set', basePrice: 60, tools: [{ tool: 'engine_hoist' }, { tool: 'torque_wrench' }], minutes: 600 },
          { name: 'Timing Chain Kit', basePrice: 145, tools: [{ tool: 'socket_set' }, { tool: 'torque_wrench' }], minutes: 360 }
        ]
      },
      {
        sub: 'engine_head',
        parts: [
          { name: 'Head Gasket', basePrice: 45, tools: [{ tool: 'torque_wrench' }, { tool: 'engine_hoist' }], minutes: 420 },
          { name: 'Valve Stem Seal Set', basePrice: 25, tools: [{ tool: 'socket_set' }], minutes: 300 },
          { name: 'Complete Cylinder Head (Recon)', basePrice: 380, tools: [{ tool: 'engine_hoist' }, { tool: 'torque_wrench' }], minutes: 480 },
          { name: 'Camshaft', basePrice: 160, tools: [{ tool: 'socket_set' }, { tool: 'torque_wrench' }], minutes: 300 }
        ]
      },
      {
        sub: 'turbocharger',
        parts: [
          { name: 'Complete Turbocharger', basePrice: 450, tools: [{ tool: 'socket_set' }, { tool: 'torque_wrench' }], minutes: 240 },
          { name: 'Turbo Actuator', basePrice: 120, tools: [{ tool: 'screwdriver_set' }], minutes: 90 },
          { name: 'Oil Feed Line', basePrice: 28, tools: [{ tool: 'spanner_set' }], minutes: 45 }
        ]
      },
      {
        sub: 'fuel_system',
        parts: [
          { name: 'In-Tank Fuel Pump', basePrice: 75, tools: [{ tool: 'screwdriver_set' }], minutes: 90 },
          { name: 'Fuel Filter', basePrice: 12, tools: [{ tool: 'spanner_set' }], minutes: 30 },
          { name: 'Set of 4 Fuel Injectors', basePrice: 180, tools: [{ tool: 'screwdriver_set' }], minutes: 120 },
          { name: 'Fuel Pressure Regulator', basePrice: 40, tools: [{ tool: 'screwdriver_set' }], minutes: 45 }
        ]
      },
      {
        sub: 'ignition_system',
        parts: [
          { name: 'Coil Pack (single)', basePrice: 32, tools: [{ tool: 'screwdriver_set' }], minutes: 30 },
          { name: 'Spark Plug Set (x4)', basePrice: 24, tools: [{ tool: 'socket_set' }], minutes: 45 },
          { name: 'HT Lead Set', basePrice: 38, tools: [{ tool: 'pliers' }], minutes: 40 }
        ]
      },
      {
        sub: 'cooling_system',
        parts: [
          { name: 'Radiator', basePrice: 95, tools: [{ tool: 'socket_set' }, { tool: 'screwdriver_set' }], minutes: 120 },
          { name: 'Water Pump', basePrice: 55, tools: [{ tool: 'socket_set' }, { tool: 'torque_wrench' }], minutes: 180 },
          { name: 'Thermostat', basePrice: 18, tools: [{ tool: 'socket_set' }], minutes: 60 },
          { name: 'Radiator Fan Motor', basePrice: 48, tools: [{ tool: 'socket_set' }], minutes: 60 },
          { name: 'Expansion Tank', basePrice: 30, tools: [{ tool: 'pliers' }], minutes: 30 }
        ]
      },
      {
        sub: 'oil_system',
        parts: [
          { name: 'Oil Filter', basePrice: 8, tools: [{ tool: 'oil_filter_wrench' }], minutes: 20 },
          { name: 'Sump Plug & Washer', basePrice: 4, tools: [{ tool: 'spanner_set' }], minutes: 15 },
          { name: 'Oil Pressure Switch', basePrice: 15, tools: [{ tool: 'spanner_set' }], minutes: 30 }
        ]
      },
      {
        sub: 'gearbox',
        parts: [
          { name: 'Gearbox Oil Change Kit', basePrice: 45, tools: [{ tool: 'spanner_set' }], minutes: 60 },
          { name: 'Synchro Ring Set', basePrice: 90, tools: [{ tool: 'transmission_jack' }, { tool: 'socket_set' }], minutes: 480 },
          { name: 'Complete Recon Gearbox', basePrice: 850, tools: [{ tool: 'transmission_jack' }, { tool: 'engine_hoist' }], minutes: 600 },
          { name: 'Gearbox Mount', basePrice: 25, tools: [{ tool: 'socket_set' }], minutes: 90 }
        ]
      },
      {
        sub: 'clutch',
        parts: [
          { name: 'Clutch Kit (plate, cover, bearing)', basePrice: 165, tools: [{ tool: 'transmission_jack' }, { tool: 'engine_hoist' }, { tool: 'socket_set' }], minutes: 360 },
          { name: 'Clutch Master Cylinder', basePrice: 42, tools: [{ tool: 'spanner_set' }], minutes: 90 },
          { name: 'Slave Cylinder', basePrice: 35, tools: [{ tool: 'spanner_set' }], minutes: 60 }
        ]
      },
      {
        sub: 'differential',
        parts: [
          { name: 'Diff Oil Change Kit', basePrice: 35, tools: [{ tool: 'spanner_set' }], minutes: 45 },
          { name: 'Pinion Seal', basePrice: 12, tools: [{ tool: 'socket_set' }], minutes: 120 },
          { name: 'Complete Diff Unit', basePrice: 320, tools: [{ tool: 'axle_stands' }, { tool: 'socket_set' }], minutes: 300 }
        ]
      },
      {
        sub: 'driveshafts',
        parts: [
          { name: 'CV Joint Boot Kit', basePrice: 14, tools: [{ tool: 'pliers' }, { tool: 'axle_stands' }], minutes: 90 },
          { name: 'Complete Driveshaft', basePrice: 110, tools: [{ tool: 'axle_stands' }, { tool: 'impact_wrench' }], minutes: 150 },
          { name: 'Centre Bearing', basePrice: 28, tools: [{ tool: 'axle_stands' }], minutes: 90 }
        ]
      },
      {
        sub: 'brakes_front',
        parts: [
          { name: 'Front Brake Pad Set', basePrice: 28, tools: [{ tool: 'socket_set' }, { tool: 'jack' }, { tool: 'axle_stands' }], minutes: 60 },
          { name: 'Front Brake Discs (pair)', basePrice: 55, tools: [{ tool: 'impact_wrench' }, { tool: 'jack' }, { tool: 'axle_stands' }], minutes: 90 },
          { name: 'Front Caliper (each)', basePrice: 78, tools: [{ tool: 'spanner_set' }, { tool: 'brake_bleeder_kit' }], minutes: 120 },
          { name: 'Brake Fluid (1L)', basePrice: 9, tools: [{ tool: 'brake_bleeder_kit' }], minutes: 45 }
        ]
      },
      {
        sub: 'brakes_rear',
        parts: [
          { name: 'Rear Brake Pad Set', basePrice: 24, tools: [{ tool: 'socket_set' }, { tool: 'jack' }, { tool: 'axle_stands' }], minutes: 60 },
          { name: 'Rear Brake Discs (pair)', basePrice: 48, tools: [{ tool: 'impact_wrench' }, { tool: 'jack' }, { tool: 'axle_stands' }], minutes: 90 },
          { name: 'Handbrake Cable', basePrice: 22, tools: [{ tool: 'spanner_set' }, { tool: 'pliers' }], minutes: 90 }
        ]
      },
      {
        sub: 'suspension_front',
        parts: [
          { name: 'Front Strut Assembly (each)', basePrice: 85, tools: [{ tool: 'spring_compressors' }, { tool: 'impact_wrench' }, { tool: 'jack' }], minutes: 120 },
          { name: 'Front Coil Spring (each)', basePrice: 32, tools: [{ tool: 'spring_compressors' }], minutes: 90 },
          { name: 'Track Rod End (each)', basePrice: 18, tools: [{ tool: 'spanner_set' }], minutes: 45 },
          { name: 'Anti-Roll Bar Drop Link', basePrice: 12, tools: [{ tool: 'spanner_set' }], minutes: 30 }
        ]
      },
      {
        sub: 'suspension_rear',
        parts: [
          { name: 'Rear Shock Absorber (each)', basePrice: 45, tools: [{ tool: 'socket_set' }, { tool: 'jack' }], minutes: 75 },
          { name: 'Rear Coil Spring (each)', basePrice: 26, tools: [{ tool: 'spring_compressors' }], minutes: 60 },
          { name: 'Rear Trailing Arm Bush Kit', basePrice: 30, tools: [{ tool: 'impact_wrench' }, { tool: 'press' as any }], minutes: 180 }
        ]
      },
      {
        sub: 'steering',
        parts: [
          { name: 'Power Steering Pump', basePrice: 140, tools: [{ tool: 'spanner_set' }, { tool: 'pulley_tool' as any }], minutes: 180 },
          { name: 'Steering Rack (recon)', basePrice: 280, tools: [{ tool: 'spanner_set' }, { tool: 'track_rod_remover' as any }], minutes: 300 },
          { name: 'PS Fluid Reservoir', basePrice: 20, tools: [{ tool: 'screwdriver_set' }], minutes: 30 }
        ]
      },
      {
        sub: 'electrical',
        parts: [
          { name: 'Battery', basePrice: 68, tools: [{ tool: 'spanner_set' }], minutes: 20 },
          { name: 'Alternator (recon)', basePrice: 145, tools: [{ tool: 'spanner_set' }, { tool: 'belt_tensioner_tool' as any }], minutes: 120 },
          { name: 'Starter Motor (recon)', basePrice: 125, tools: [{ tool: 'socket_set' }], minutes: 90 },
          { name: 'Earth Strap', basePrice: 10, tools: [{ tool: 'spanner_set' }], minutes: 20 }
        ]
      },
      {
        sub: 'exhaust',
        parts: [
          { name: 'Exhaust Manifold Gasket', basePrice: 18, tools: [{ tool: 'socket_set' }], minutes: 120 },
          { name: 'Catalytic Converter', basePrice: 220, tools: [{ tool: 'penetrating_oil' as any }, { tool: 'spanner_set' }], minutes: 90 },
          { name: 'Centre Silencer Section', basePrice: 65, tools: [{ tool: 'hacksaw' as any }, { tool: 'exhaust_clamp_tool' as any }], minutes: 60 },
          { name: 'Rear Silencer', basePrice: 45, tools: [{ tool: 'exhaust_clamp_tool' as any }], minutes: 45 }
        ]
      },
      {
        sub: 'transmission_mounts',
        parts: [
          { name: 'Engine Mount (each)', basePrice: 38, tools: [{ tool: 'engine_support_bar' as any }, { tool: 'socket_set' }], minutes: 120 },
          { name: 'Gearbox Mount', basePrice: 32, tools: [{ tool: 'transmission_jack' }, { tool: 'socket_set' }], minutes: 90 }
        ]
      },
      {
        sub: 'body_structure',
        parts: [
          { name: 'Subframe Bush Kit', basePrice: 55, tools: [{ tool: 'impact_wrench' }, { tool: 'press' as any }], minutes: 240 }
        ]
      }
    ]

    for (const { sub, parts } of subsystems) {
      for (const part of parts) {
        // Generate variants per brand/quality tier
        for (let tier = 1; tier <= 3; tier++) {
          const tierMultiplier = tier === 1 ? 0.6 : tier === 2 ? 1.0 : 1.8
          const brandNames = ['', 'BudgetParts ', 'MotorTech ', 'OEM Genuine ']

          this.parts.set(`${sub}_${part.name}_t${tier}`, {
            id: `${sub}_${part.name}_t${tier}`,
            name: `${brandNames[tier]}${part.name}`,
            category: sub,
            brand: this.brands[tier],
            qualityTier: tier as 1 | 2 | 3,
            priceNew: Math.round(part.basePrice * tierMultiplier),
            condition: 'new',
            conditionMultiplier: 1,
            stock: 3 + Math.floor(Math.random() * 10),
            compatibleWith: ['*'], // all vehicles by default
            installTimeMinutes: part.minutes * (tier === 3 ? 1 : tier === 1 ? 1.3 : 1),
            requiresTools: part.tools.filter(t => !this.isValidTool(t))
          })
        }
      }
    }
  }

  private isValidTool(tool: ToolRequirement): boolean {
    return true // all defined tools are valid for now
  }

  getPart(id: string): Part | undefined {
    return this.parts.get(id)
  }

  getPartsForSubsystem(subsystem: SubsystemName): Part[] {
    return Array.from(this.parts.values()).filter(p => p.category === subsystem)
  }

  getAllParts(): Part[] {
    return Array.from(this.parts.values())
  }

  purchasePart(id: string): Part | null {
    const part = this.parts.get(id)
    if (!part || part.stock <= 0) return null

    part.stock--
    return { ...part }
  }

  restock(): void {
    for (const part of this.parts.values()) {
      part.stock = 3 + Math.floor(Math.random() * 10)
    }
  }

  serialize(): any {
    return Array.from(this.parts.entries())
  }

  deserialize(data: any): void {
    this.parts = new Map(data)
  }
}

// ============================================
// REPAIR JOB
// ============================================

export type RepairPhase = 'diagnosis' | 'disassembly' | 'inspection' | 'replacement' | 'refit' | 'testing' | 'complete'

export interface RepairJob {
  id: string
  vehicleId: string
  targetSubsystem: SubsystemName
  phase: RepairPhase
  requiredPart: Part
  requiredTools: ToolRequirement[]
  estimatedMinutes: number
  elapsedMinutes: number
  isRoadside: boolean
  labourRatePerHour: number
  complicationsEncountered: string[]
  qualityOfRepair: number // 0-1, affected by player skill/tool correctness
}

export class RepairJobManager {
  private activeJobs: Map<string, RepairJob> = new Map()
  private completedJobs: RepairJob[] = []

  createRepairJob(
    vehicleId: string,
    subsystem: SubsystemName,
    part: Part,
    isRoadside: boolean
  ): RepairJob {
    const job: RepairJob = {
      id: `repair_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      vehicleId,
      targetSubsystem: subsystem,
      phase: 'diagnosis',
      requiredPart: part,
      requiredTools: part.requiresTools,
      estimatedMinutes: part.installTimeMinutes * (isRoadside ? 1.8 : 1),
      elapsedMinutes: 0,
      isRoadside,
      labourRatePerHour: isRoadside ? 0 : 45,
      complicationsEncountered: [],
      qualityOfRepair: 0
    }

    this.activeJobs.set(job.id, job)
    return job
  }

  advancePhase(jobId: string): RepairPhase | null {
    const job = this.activeJobs.get(jobId)
    if (!job) return null

    const order: RepairPhase[] = ['diagnosis', 'disassembly', 'inspection', 'replacement', 'refit', 'testing', 'complete']
    const currentIndex = order.indexOf(job.phase)
    if (currentIndex >= order.length - 1) return null

    job.phase = order[currentIndex + 1]
    return job.phase
  }

  update(deltaTime: number): void {
    for (const job of this.activeJobs.values()) {
      job.elapsedMinutes += deltaTime / 60 // assuming deltaTime in seconds
    }
  }

  completeJob(jobId: string): RepairJob | null {
    const job = this.activeJobs.get(jobId)
    if (!job || job.phase !== 'complete') return null

    this.activeJobs.delete(jobId)
    this.completedJobs.push(job)

    // Apply repair to vehicle happens externally via callback
    return job
  }

  getActiveJobs(): RepairJob[] {
    return Array.from(this.activeJobs.values())
  }

  getCompletedJobs(): RepairJob[] {
    return [...this.completedJobs]
  }

  cancelJob(jobId: string): void {
    this.activeJobs.delete(jobId)
  }
}

// ============================================
// MAIN REPAIR SYSTEM
// ============================================

export class RepairSystem {
  public diagnosis: DiagnosisSystem
  public catalogue: PartCatalogue
  public jobs: RepairJobManager

  private playerMoney = 0

  constructor() {
    this.diagnosis = new DiagnosisSystem()
    this.catalogue = new PartCatalogue()
    this.jobs = new RepairJobManager()
  }

  setPlayerMoney(money: number): void {
    this.playerMoney = money
  }

  getPlayerMoney(): number {
    return this.playerMoney
  }

  canAffordPart(partId: string): boolean {
    const part = this.catalogue.getPart(partId)
    return part !== undefined && this.playerMoney >= part.priceNew
  }

  startRepairWorkflow(
    vehicleId: string,
    subsystem: SubsystemName,
    partId: string,
    isRoadside: boolean
  ): RepairJob | null {
    const part = this.catalogue.purchasePart(partId)
    if (!part) return null // out of stock or doesn't exist

    this.playerMoney -= part.priceNew

    return this.jobs.createRepairJob(vehicleId, subsystem, part, isRoadside)
  }

  applyRepairToDamageModel(damageModel: DamageModel, job: RepairJob): void {
    const qualityFactor = job.qualityOfRepair

    // Better repair quality restores more health
    const repairAmount = 100 * (0.7 + qualityFactor * 0.3)
    damageModel.repairSubsystem(job.targetSubsystem, repairAmount)

    // Also repair related panels slightly
    const relatedPanels: Record<string, PanelName[]> = {
      engine_block: ['bonnet'],
      engine_head: ['bonnet'],
      turbocharger: ['bonnet'],
      cooling_system: ['radiator_grille', 'front_bumper'],
      brakes_front: ['front_left_wing', 'front_right_wing'],
      brakes_rear: ['rear_left_quarter', 'rear_right_quarter']
    }
    const panels = relatedPanels[job.targetSubsystem]
    if (panels) {
      for (const panel of panels) {
        damageModel.repairPanel(panel, repairAmount * 0.3)
      }
    }
  }

  serialize(): any {
    return {
      diagnosis: this.diagnosis.serialize(),
      catalogue: this.catalogue.serialize(),
      jobs: this.jobs.getCompletedJobs().slice(-20)
    }
  }

  deserialize(data: any): void {
    if (data.diagnosis) this.diagnosis.deserialize(data.diagnosis)
    if (data.catalogue) this.catalogue.deserialize(data.catalogue)
  }
}