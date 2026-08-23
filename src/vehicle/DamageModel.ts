import * as THREE from 'three'

/**
 * DamageModel - Comprehensive vehicle damage system
 * Visual damage (panels, glass) + Mechanical damage (12 subsystems)
 */

// ============================================
// VISUAL DAMAGE (Body Panels)
// ============================================

export type PanelName =
  | 'front_bumper' | 'rear_bumper'
  | 'bonnet' | 'boot' | 'roof'
  | 'front_left_wing' | 'front_right_wing'
  | 'rear_left_quarter' | 'rear_right_quarter'
  | 'front_left_door' | 'front_right_door'
  | 'rear_left_door' | 'rear_right_door'
  | 'front_windshield' | 'rear_windshield'
  | 'front_left_window' | 'front_right_window'
  | 'rear_left_window' | 'rear_right_window'
  | 'left_mirror' | 'right_mirror'
  | 'front_left_light' | 'front_right_light'
  | 'rear_left_light' | 'rear_right_light'
  | 'exhaust' | 'radiator_grille'

export interface PanelDamage {
  name: PanelName
  health: number // 0-100
  deformation: number // 0-1 visual deformation
  isDetached: boolean
  paintDamage: number // 0-1 scratches/dents
  originalVertices?: Float32Array // for vertex deformation shader
  deformedVertices?: Float32Array
}

export interface VisualDamageState {
  panels: Map<PanelName, PanelDamage>
  totalVisualDamage: number // 0-1
  dirty: boolean
}

export const PANEL_NAMES: PanelName[] = [
  'front_bumper', 'rear_bumper',
  'bonnet', 'boot', 'roof',
  'front_left_wing', 'front_right_wing',
  'rear_left_quarter', 'rear_right_quarter',
  'front_left_door', 'front_right_door',
  'rear_left_door', 'rear_right_door',
  'front_windshield', 'rear_windshield',
  'front_left_window', 'front_right_window',
  'rear_left_window', 'rear_right_window',
  'left_mirror', 'right_mirror',
  'front_left_light', 'front_right_light',
  'rear_left_light', 'rear_right_light',
  'exhaust', 'radiator_grille'
]

// Panel groups for deformation zones
export const DEFORMATION_ZONES: Record<string, PanelName[]> = {
  front: ['front_bumper', 'bonnet', 'front_left_wing', 'front_right_wing', 'radiator_grille', 'front_left_light', 'front_right_light', 'front_windshield'],
  rear: ['rear_bumper', 'boot', 'rear_left_quarter', 'rear_right_quarter', 'rear_left_light', 'rear_right_light', 'rear_windshield'],
  left: ['front_left_wing', 'front_left_door', 'rear_left_door', 'rear_left_quarter', 'left_mirror', 'front_left_window', 'rear_left_window'],
  right: ['front_right_wing', 'front_right_door', 'rear_right_door', 'rear_right_quarter', 'right_mirror', 'front_right_window', 'rear_right_window'],
  roof: ['roof'],
  underbody: ['exhaust']
}

// Panel health thresholds
const PANEL_HEALTH_THRESHOLDS = {
  pristine: 100,
  minor: 80,    // scratches, small dents
  moderate: 50, // visible dents, paint damage
  major: 20,    // large deformation, possible detachment
  destroyed: 0  // detached, missing
}

// ============================================
// MECHANICAL DAMAGE (Subsystems)
// ============================================

export type SubsystemName =
  | 'engine_block'       // Core engine - compression, power
  | 'engine_head'        // Valves, camshaft - breathing
  | 'turbocharger'       // Boost, lag, whine
  | 'fuel_system'        // Injection, pump - starvation, misfire
  | 'ignition_system'    // Coils, plugs - misfire, hard start
  | 'cooling_system'     // Radiator, pump, thermostat - overheating
  | 'oil_system'         // Pump, pressure - bearing wear, seizure
  | 'gearbox'            // Gears, synchros - grinding, popping out
  | 'clutch'             // Plate, release - slip, judder
  | 'differential'       // Gears, bearings - whine, lockup
  | 'driveshafts'        // CV joints, propshaft - vibration, clunk
  | 'brakes_front'       // Pads, discs, calipers - fade, pull
  | 'brakes_rear'        // Pads, discs, calipers - fade, pull
  | 'suspension_front'   // Springs, dampers, arms - bounce, wander
  | 'suspension_rear'    // Springs, dampers, arms - bounce, wander
  | 'steering'           // Rack, column, pump - play, heaviness
  | 'electrical'         // Battery, alternator, wiring - cutouts
  | 'exhaust'            // Manifold, cat, silencer - noise, leaks
  | 'transmission_mounts'// Engine/gearbox mounts - thump, vibration
  | 'body_structure'     // Chassis, subframes - alignment, creak
  | 'wheels'             // Tyres, rims, bearings - puncture, wobble
  | 'radiator_grille'    // Radiator, grille - airflow, cooling

export interface SubsystemDamage {
  name: SubsystemName
  health: number // 0-100
  wear: number // 0-1 accumulated wear
  symptoms: string[] // active symptoms
  isFailed: boolean // complete failure
  failureMode?: string // how it failed
}

export interface MechanicalDamageState {
  subsystems: Map<SubsystemName, SubsystemDamage>
  totalMechanicalDamage: number // 0-1
  activeWarningLights: string[]
  breakdownRisk: number // 0-1 probability per km
}

const SUBSYSTEM_NAMES: SubsystemName[] = [
  'engine_block', 'engine_head', 'turbocharger',
  'fuel_system', 'ignition_system',
  'cooling_system', 'oil_system',
  'gearbox', 'clutch', 'differential', 'driveshafts',
  'brakes_front', 'brakes_rear',
  'suspension_front', 'suspension_rear',
  'steering', 'electrical', 'exhaust',
  'transmission_mounts', 'body_structure',
  'wheels', 'radiator_grille'
]

// Subsystem failure thresholds and symptoms
const SUBSYSTEM_DATA: Record<SubsystemName, {
  criticalThreshold: number
  symptoms: { threshold: number; symptom: string }[]
  failureModes: string[]
  affectsDrivable: boolean
}> = {
  engine_block: {
    criticalThreshold: 30,
    symptoms: [
      { threshold: 80, symptom: 'Slight tapping noise from engine' },
      { threshold: 60, symptom: 'Knocking sound under load' },
      { threshold: 40, symptom: 'Heavy knocking, power loss' },
      { threshold: 20, symptom: 'Severe rod knock, metal in oil' }
    ],
    failureModes: ['connecting_rod_failure', 'crankshaft_failure', 'block_crack'],
    affectsDrivable: true
  },
  engine_head: {
    criticalThreshold: 40,
    symptoms: [
      { threshold: 80, symptom: 'Ticking from valve train' },
      { threshold: 60, symptom: 'Rough idle, misfire at low RPM' },
      { threshold: 40, symptom: 'Compression loss, hard starting' },
      { threshold: 20, symptom: 'Valve float, catastrophic failure' }
    ],
    failureModes: ['valve_drop', 'head_gasket_failure', 'camshaft_seizure'],
    affectsDrivable: true
  },
  turbocharger: {
    criticalThreshold: 30,
    symptoms: [
      { threshold: 80, symptom: 'Whining noise on boost' },
      { threshold: 60, symptom: 'Blue smoke on acceleration' },
      { threshold: 40, symptom: 'Boost fluctuating, lag increased' },
      { threshold: 20, symptom: 'Shaft play, oil seal failure' }
    ],
    failureModes: ['bearing_failure', 'shaft_snap', 'compressor_wheel_damage'],
    affectsDrivable: false // can run without boost
  },
  fuel_system: {
    criticalThreshold: 25,
    symptoms: [
      { threshold: 80, symptom: 'Slight hesitation on throttle' },
      { threshold: 60, symptom: 'Random misfires, poor economy' },
      { threshold: 40, symptom: 'Fuel starvation under load' },
      { threshold: 20, symptom: 'Pump failure, won\'t start' }
    ],
    failureModes: ['pump_failure', 'injector_clog', 'filter_blocked', 'line_leak'],
    affectsDrivable: true
  },
  ignition_system: {
    criticalThreshold: 30,
    symptoms: [
      { threshold: 80, symptom: 'Occasional misfire at idle' },
      { threshold: 60, symptom: 'Regular misfire, check engine light' },
      { threshold: 40, symptom: 'Running on 3 cylinders' },
      { threshold: 20, symptom: 'Coil pack failure, no start' }
    ],
    failureModes: ['coil_failure', 'plug_fouling', 'lead_breakdown', 'ecu_fault'],
    affectsDrivable: true
  },
  cooling_system: {
    criticalThreshold: 20,
    symptoms: [
      { threshold: 80, symptom: 'Temperature runs slightly high' },
      { threshold: 60, symptom: 'Overheats in traffic' },
      { threshold: 40, symptom: 'Coolant loss, steam from bonnet' },
      { threshold: 20, symptom: 'Head gasket risk, rapid overheating' }
    ],
    failureModes: ['radiator_leak', 'pump_failure', 'thermostat_stuck', 'head_gasket'],
    affectsDrivable: true
  },
  oil_system: {
    criticalThreshold: 15,
    symptoms: [
      { threshold: 80, symptom: 'Oil pressure low at idle' },
      { threshold: 60, symptom: 'Oil light flickers on corners' },
      { threshold: 40, symptom: 'Metallic rattling, pressure critical' },
      { threshold: 20, symptom: 'Bearing seizure imminent' }
    ],
    failureModes: ['pump_failure', 'pickup_blocked', 'bearing_spin', 'oil_pump_drive'],
    affectsDrivable: true
  },
  gearbox: {
    criticalThreshold: 25,
    symptoms: [
      { threshold: 80, symptom: 'Notchy gear changes' },
      { threshold: 60, symptom: 'Grinding into 2nd/3rd' },
      { threshold: 40, symptom: 'Pops out of gear under load' },
      { threshold: 20, symptom: 'Gear teeth stripped, no drive' }
    ],
    failureModes: ['synchro_failure', 'gear_tooth_strip', 'bearing_failure', 'selector_fork_bend'],
    affectsDrivable: true
  },
  clutch: {
    criticalThreshold: 20,
    symptoms: [
      { threshold: 80, symptom: 'High bite point' },
      { threshold: 60, symptom: 'Slipping under hard acceleration' },
      { threshold: 40, symptom: 'Severe slip, burning smell' },
      { threshold: 20, symptom: 'No drive, pedal to floor' }
    ],
    failureModes: ['plate_worn', 'pressure_plate_failure', 'release_bearing_collapse', 'cable_snap'],
    affectsDrivable: true
  },
  differential: {
    criticalThreshold: 25,
    symptoms: [
      { threshold: 80, symptom: 'Faint whine on overrun' },
      { threshold: 60, symptom: 'Whine under acceleration too' },
      { threshold: 40, symptom: 'Clunk on throttle changes' },
      { threshold: 20, symptom: 'Locked up or shattered' }
    ],
    failureModes: ['bearing_failure', 'gear_tooth_failure', 'locker_failure', 'seal_leak'],
    affectsDrivable: true
  },
  driveshafts: {
    criticalThreshold: 30,
    symptoms: [
      { threshold: 80, symptom: 'Click on full lock' },
      { threshold: 60, symptom: 'Vibration at speed' },
      { threshold: 40, symptom: 'Heavy clunk on takeoff' },
      { threshold: 20, symptom: 'CV joint disintegrated' }
    ],
    failureModes: ['cv_joint_failure', 'propshaft_bend', 'centre_bearing_collapse', 'spline_strip'],
    affectsDrivable: true
  },
  brakes_front: {
    criticalThreshold: 15,
    symptoms: [
      { threshold: 80, symptom: 'Squealing on light braking' },
      { threshold: 60, symptom: 'Judder under braking' },
      { threshold: 40, symptom: 'Pulling to one side' },
      { threshold: 20, symptom: 'No front brakes, pedal to floor' }
    ],
    failureModes: ['pad_worn_out', 'disc_cracked', 'caliper_seized', 'hose_burst', 'fluid_boil'],
    affectsDrivable: true
  },
  brakes_rear: {
    criticalThreshold: 15,
    symptoms: [
      { threshold: 80, symptom: 'Rear squeal on braking' },
      { threshold: 60, symptom: 'Rear wheels locking early' },
      { threshold: 40, symptom: 'Handbrake ineffective' },
      { threshold: 20, symptom: 'No rear brakes' }
    ],
    failureModes: ['pad_worn_out', 'disc_cracked', 'caliper_seized', 'hose_burst', 'drum_cracked'],
    affectsDrivable: true
  },
  suspension_front: {
    criticalThreshold: 20,
    symptoms: [
      { threshold: 80, symptom: 'Knock over bumps' },
      { threshold: 60, symptom: 'Excessive bounce, poor turn-in' },
      { threshold: 40, symptom: 'Spring broken, car leaning' },
      { threshold: 20, symptom: 'Strut punctured tyre, no control' }
    ],
    failureModes: ['spring_snap', 'damper_leak', 'ball_joint_failure', 'arm_bend', 'top_mount_tear'],
    affectsDrivable: true
  },
  suspension_rear: {
    criticalThreshold: 20,
    symptoms: [
      { threshold: 80, symptom: 'Rear knock over bumps' },
      { threshold: 60, symptom: 'Wallows over crests' },
      { threshold: 40, symptom: 'Rear sagging, tyre rub' },
      { threshold: 20, symptom: 'Axle displaced, undrivable' }
    ],
    failureModes: ['spring_snap', 'damper_leak', 'bush_failure', 'trailing_arm_bend', 'shock_mount_tear'],
    affectsDrivable: true
  },
  steering: {
    criticalThreshold: 15,
    symptoms: [
      { threshold: 80, symptom: 'Slight play in wheel' },
      { threshold: 60, symptom: 'Vague steering, wanders' },
      { threshold: 40, symptom: 'Heavy spots, clunk on lock' },
      { threshold: 20, symptom: 'Steering disconnected' }
    ],
    failureModes: ['rack_leak', 'column_collapse', 'pump_failure', 'tie_rod_snap', 'u_joint_failure'],
    affectsDrivable: true
  },
  electrical: {
    criticalThreshold: 20,
    symptoms: [
      { threshold: 80, symptom: 'Dim lights at idle' },
      { threshold: 60, symptom: 'Intermittent electrical gremlins' },
      { threshold: 40, symptom: 'Random stalling, ECU resets' },
      { threshold: 20, symptom: 'Complete electrical failure' }
    ],
    failureModes: ['alternator_failure', 'battery_dead', 'earth_strap', 'ecu_water', 'wiring_harness'],
    affectsDrivable: true
  },
  exhaust: {
    criticalThreshold: 40,
    symptoms: [
      { threshold: 80, symptom: 'Raspier exhaust note' },
      { threshold: 60, symptom: 'Blowing from manifold' },
      { threshold: 40, symptom: 'Loud drone, fumes in cabin' },
      { threshold: 20, symptom: 'Silencer fallen off' }
    ],
    failureModes: ['manifold_crack', 'cat_collapse', 'silencer_rot', 'flexi_pipe_split', 'hanger_snap'],
    affectsDrivable: false
  },
  transmission_mounts: {
    criticalThreshold: 30,
    symptoms: [
      { threshold: 80, symptom: 'Thump on gear change' },
      { threshold: 60, symptom: 'Engine rocks visibly' },
      { threshold: 40, symptom: 'Severe shunt on throttle' },
      { threshold: 20, symptom: 'Engine shifting, driveshaft bind' }
    ],
    failureModes: ['mount_tear', 'mount_perished', 'bolt_shear', 'bracket_crack'],
    affectsDrivable: false
  },
  body_structure: {
    criticalThreshold: 20,
    symptoms: [
      { threshold: 80, symptom: 'Creaking over bumps' },
      { threshold: 60, symptom: 'Doors misaligned' },
      { threshold: 40, symptom: 'Chassis flex visible' },
      { threshold: 20, symptom: 'Structural failure risk' }
    ],
    failureModes: ['subframe_rot', 'chassis_crack', 'pillar_buckle', 'floorpan_rot'],
    affectsDrivable: false
  },
  wheels: {
    criticalThreshold: 20,
    symptoms: [
      { threshold: 80, symptom: 'Steering wheel vibration at speed' },
      { threshold: 60, symptom: 'Uneven tyre wear, pulling' },
      { threshold: 40, symptom: 'Wheel bearing rumble, wobble' },
      { threshold: 20, symptom: 'Wheel detached or seized' }
    ],
    failureModes: ['bearing_failure', 'rim_crack', 'tyre_blowout', 'hub_seizure'],
    affectsDrivable: true
  },
  radiator_grille: {
    criticalThreshold: 30,
    symptoms: [
      { threshold: 80, symptom: 'Slightly higher temps in traffic' },
      { threshold: 60, symptom: 'Overheats on long climbs' },
      { threshold: 40, symptom: 'Rapid coolant loss, steam' },
      { threshold: 20, symptom: 'Radiator burst, immediate overheat' }
    ],
    failureModes: ['core_leak', 'fan_failure', 'blockage', 'mount_failure'],
    affectsDrivable: true
  }
}

// ============================================
// DAMAGE MODEL CLASS
// ============================================

export interface DamageEvent {
  type: 'impact' | 'overrev' | 'overheat' | 'wear' | 'collision' | 'mechanical_stress'
  subsystem?: SubsystemName
  panel?: PanelName
  force?: number
  location?: THREE.Vector3
  direction?: THREE.Vector3
  severity: number // 0-1
}

export interface DamageModelConfig {
  visualDamageMultiplier: number
  mechanicalDamageMultiplier: number
  wearRate: number // per km
  impactDamageThreshold: number // force needed to cause damage
  enableVisualDeformation: boolean
  enableMechanicalWear: boolean
  breakdownThreshold: number // total mechanical damage for breakdown
}

const DEFAULT_CONFIG: DamageModelConfig = {
  visualDamageMultiplier: 1.0,
  mechanicalDamageMultiplier: 1.0,
  wearRate: 0.001, // 0.1% per km
  impactDamageThreshold: 5000, // Newtons
  enableVisualDeformation: true,
  enableMechanicalWear: true,
  breakdownThreshold: 0.6
}

export class DamageModel {
  private config: DamageModelConfig

  // Visual damage
  private visualState: VisualDamageState = {
    panels: new Map(),
    totalVisualDamage: 0,
    dirty: false
  }

  // Mechanical damage
  private mechanicalState: MechanicalDamageState = {
    subsystems: new Map(),
    totalMechanicalDamage: 0,
    activeWarningLights: [],
    breakdownRisk: 0
  }

  // Mileage tracking
  private totalDistance = 0 // meters
  private lastOdometer = 0

  // Callbacks
  onVisualDamageChange?: (state: VisualDamageState) => void
  onMechanicalDamageChange?: (state: MechanicalDamageState) => void
  onBreakdown?: (failedSubsystem: SubsystemName) => void
  onWarningLight?: (light: string, active: boolean) => void

  constructor(config?: Partial<DamageModelConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initialize()
  }

  /**
   * Initialize all panels and subsystems
   */
  private initialize(): void {
    // Visual panels
    for (const name of PANEL_NAMES) {
      this.visualState.panels.set(name, {
        name,
        health: 100,
        deformation: 0,
        isDetached: false,
        paintDamage: 0
      })
    }

    // Mechanical subsystems
    for (const name of SUBSYSTEM_NAMES) {
      this.mechanicalState.subsystems.set(name, {
        name,
        health: 100,
        wear: 0,
        symptoms: [],
        isFailed: false
      })
    }
  }

  /**
   * Main update - call every frame
   */
  update(deltaTime: number, vehicleState: any): void {
    // Update wear based on distance
    if (this.config.enableMechanicalWear && vehicleState.speed > 0) {
      const distanceThisFrame = vehicleState.speed * deltaTime
      this.totalDistance += distanceThisFrame
      this.applyWear(distanceThisFrame)
    }

    // Update symptoms based on current health
    this.updateSymptoms()

    // Update warning lights
    this.updateWarningLights()

    // Calculate breakdown risk
    this.calculateBreakdownRisk()

    // Check for breakdown
    if (this.mechanicalState.breakdownRisk > 0.95 && Math.random() < 0.001 * deltaTime) {
      this.triggerBreakdown()
    }
  }

  /**
   * Apply damage from an event
   */
  applyDamage(event: DamageEvent): void {
    switch (event.type) {
      case 'impact':
      case 'collision':
        this.applyImpactDamage(event)
        break
      case 'overrev':
        this.applyOverrevDamage(event)
        break
      case 'overheat':
        this.applyOverheatDamage(event)
        break
      case 'wear':
        this.applyWearDamage(event)
        break
      case 'mechanical_stress':
        this.applyMechanicalStress(event)
        break
    }

    this.recalculateTotals()
    this.visualState.dirty = true
  }

  /**
   * Apply impact/collision damage
   */
  private applyImpactDamage(event: DamageEvent): void {
    if (!event.panel && !event.location) return

    const force = event.force || 0
    if (force < this.config.impactDamageThreshold) return

    const severity = Math.min(1, force / 50000) * event.severity * this.config.visualDamageMultiplier

    // Determine affected panels based on impact location
    let affectedPanels: PanelName[] = []

    if (event.panel) {
      affectedPanels = [event.panel]
    } else if (event.location && event.direction) {
      affectedPanels = this.getPanelsForImpact(event.location, event.direction, force)
    }

    // Apply damage to panels
    for (const panelName of affectedPanels) {
      const panel = this.visualState.panels.get(panelName)
      if (!panel) continue

      const damage = severity * 100 * (0.5 + Math.random() * 0.5) // 50-100% of severity
      panel.health = Math.max(0, panel.health - damage)
      panel.deformation = Math.min(1, 1 - panel.health / 100)
      panel.paintDamage = Math.min(1, panel.paintDamage + severity * 0.5)

      // Check for detachment
      if (panel.health <= PANEL_HEALTH_THRESHOLDS.major && Math.random() < severity * 0.3) {
        panel.isDetached = true
      }

      // Apply mechanical damage to nearby subsystems
      this.applyMechanicalFromImpact(panelName, severity)
    }
  }

  /**
   * Get panels affected by impact at location
   */
  private getPanelsForImpact(location: THREE.Vector3, direction: THREE.Vector3, force: number): PanelName[] {
    // Simplified: determine zone from impact direction
    const panels: PanelName[] = []

    // Front impact
    if (direction.z > 0.5) {
      panels.push(...DEFORMATION_ZONES.front)
    }
    // Rear impact
    else if (direction.z < -0.5) {
      panels.push(...DEFORMATION_ZONES.rear)
    }
    // Side impact
    if (direction.x > 0.5) {
      panels.push(...DEFORMATION_ZONES.right)
    } else if (direction.x < -0.5) {
      panels.push(...DEFORMATION_ZONES.left)
    }
    // Top impact (rollover)
    if (direction.y > 0.7) {
      panels.push(...DEFORMATION_ZONES.roof)
    }

    // High force affects more panels
    if (force > 100000) {
      panels.push(...DEFORMATION_ZONES.front, ...DEFORMATION_ZONES.rear)
    }

    return [...new Set(panels)] // deduplicate
  }

  /**
   * Apply mechanical damage from panel impact
   */
  private applyMechanicalFromImpact(panelName: PanelName, severity: number): void {
    const panelToSubsystem: Record<PanelName, SubsystemName[]> = {
      front_bumper: ['cooling_system', 'radiator_grille'],
      rear_bumper: ['exhaust'],
      bonnet: ['engine_block', 'engine_head'],
      boot: ['fuel_system', 'body_structure'],
      roof: ['body_structure'],
      front_left_wing: ['suspension_front', 'brakes_front', 'cooling_system'],
      front_right_wing: ['suspension_front', 'brakes_front', 'cooling_system'],
      rear_left_quarter: ['suspension_rear', 'brakes_rear', 'fuel_system'],
      rear_right_quarter: ['suspension_rear', 'brakes_rear', 'exhaust'],
      front_left_door: ['steering', 'electrical'],
      front_right_door: ['electrical'],
      rear_left_door: ['electrical', 'fuel_system'],
      rear_right_door: ['electrical'],
      front_windshield: [],
      rear_windshield: [],
      front_left_window: [],
      front_right_window: [],
      rear_left_window: [],
      rear_right_window: [],
      left_mirror: [],
      right_mirror: [],
      front_left_light: ['electrical'],
      front_right_light: ['electrical'],
      rear_left_light: ['electrical'],
      rear_right_light: ['electrical'],
      exhaust: ['exhaust'],
      radiator_grille: ['cooling_system']
    }

    const affected = panelToSubsystem[panelName] || []
    for (const subsystem of affected) {
      this.damageSubsystem(subsystem, severity * 30 * this.config.mechanicalDamageMultiplier)
    }
  }

  /**
   * Apply over-rev damage
   */
  private applyOverrevDamage(event: DamageEvent): void {
    const severity = event.severity * this.config.mechanicalDamageMultiplier

    // Primarily affects engine internals
    this.damageSubsystem('engine_block', severity * 40)
    this.damageSubsystem('engine_head', severity * 30)
    this.damageSubsystem('turbocharger', severity * 20)
    this.damageSubsystem('gearbox', severity * 15)
    this.damageSubsystem('clutch', severity * 10)
  }

  /**
   * Apply overheating damage
   */
  private applyOverheatDamage(event: DamageEvent): void {
    const severity = event.severity * this.config.mechanicalDamageMultiplier

    this.damageSubsystem('cooling_system', severity * 50)
    this.damageSubsystem('engine_head', severity * 40) // head gasket
    this.damageSubsystem('engine_block', severity * 20)
    this.damageSubsystem('oil_system', severity * 15) // oil breakdown
  }

  /**
   * Apply wear damage (time/distance based)
   */
  private applyWear(distance: number): void {
    const km = distance / 1000
    const wearAmount = km * this.config.wearRate * 100 // percentage points

    // Wear affects different subsystems at different rates
    const wearRates: Record<SubsystemName, number> = {
      engine_block: 0.1,
      engine_head: 0.08,
      turbocharger: 0.15,
      fuel_system: 0.12,
      ignition_system: 0.1,
      cooling_system: 0.08,
      oil_system: 0.07,
      gearbox: 0.12,
      clutch: 0.15,
      differential: 0.08,
      driveshafts: 0.1,
      brakes_front: 0.2,
      brakes_rear: 0.15,
      suspension_front: 0.12,
      suspension_rear: 0.1,
      steering: 0.08,
      electrical: 0.05,
      exhaust: 0.1,
      transmission_mounts: 0.08,
      body_structure: 0.03,
      wheels: 0.2,
      radiator_grille: 0.05
    }

    for (const [name, rate] of Object.entries(wearRates)) {
      this.damageSubsystem(name as SubsystemName, wearAmount * rate)
    }
  }

  /**
   * Apply wear damage event
   */
  private applyWearDamage(event: DamageEvent): void {
    if (event.subsystem) {
      this.damageSubsystem(event.subsystem, event.severity * 20 * this.config.mechanicalDamageMultiplier)
    }
  }

  /**
   * Apply mechanical stress (high load, launch, etc.)
   */
  private applyMechanicalStress(event: DamageEvent): void {
    if (!event.subsystem) return

    const severity = event.severity * this.config.mechanicalDamageMultiplier

    // High stress damages the specific subsystem and related ones
    this.damageSubsystem(event.subsystem, severity * 25)

    // Related subsystems get minor damage
    const related: Record<SubsystemName, SubsystemName[]> = {
      engine_block: ['engine_head', 'oil_system'],
      engine_head: ['engine_block', 'cooling_system'],
      turbocharger: ['engine_block', 'oil_system', 'exhaust'],
      fuel_system: ['engine_block', 'ignition_system'],
      ignition_system: ['engine_block', 'fuel_system'],
      cooling_system: ['engine_head', 'engine_block'],
      oil_system: ['engine_block', 'turbocharger'],
      gearbox: ['clutch', 'differential', 'driveshafts', 'transmission_mounts'],
      clutch: ['gearbox', 'engine_block', 'transmission_mounts'],
      differential: ['gearbox', 'driveshafts'],
      driveshafts: ['differential', 'suspension_rear', 'suspension_front'],
      brakes_front: ['suspension_front', 'steering'],
      brakes_rear: ['suspension_rear'],
      suspension_front: ['steering', 'brakes_front', 'body_structure'],
      suspension_rear: ['brakes_rear', 'body_structure'],
      steering: ['suspension_front', 'suspension_rear'],
      electrical: ['ignition_system', 'fuel_system'],
      exhaust: ['turbocharger', 'engine_block'],
      transmission_mounts: ['gearbox', 'clutch', 'driveshafts'],
      body_structure: ['suspension_front', 'suspension_rear', 'steering'],
      wheels: ['suspension_front', 'suspension_rear', 'brakes_front', 'brakes_rear'],
      radiator_grille: ['cooling_system', 'engine_block', 'engine_head']
    }

    const relatedSubsystems = related[event.subsystem] || []
    for (const related of relatedSubsystems) {
      this.damageSubsystem(related, severity * 5)
    }
  }

  /**
   * Damage a specific subsystem
   */
  private damageSubsystem(name: SubsystemName, amount: number): void {
    const subsystem = this.mechanicalState.subsystems.get(name)
    if (!subsystem || subsystem.isFailed) return

    subsystem.health = Math.max(0, subsystem.health - amount)
    subsystem.wear = Math.min(1, subsystem.wear + amount / 1000)

    // Check for failure
    const data = SUBSYSTEM_DATA[name]
    if (subsystem.health <= data.criticalThreshold && !subsystem.isFailed) {
      subsystem.isFailed = true
      subsystem.failureMode = data.failureModes[Math.floor(Math.random() * data.failureModes.length)]

      if (data.affectsDrivable) {
        this.triggerBreakdown(name)
      }
    }
  }

  /**
   * Update active symptoms based on health
   */
  private updateSymptoms(): void {
    for (const [name, subsystem] of this.mechanicalState.subsystems) {
      const data = SUBSYSTEM_DATA[name]
      subsystem.symptoms = []

      for (const { threshold, symptom } of data.symptoms) {
        if (subsystem.health <= threshold) {
          subsystem.symptoms.push(symptom)
        }
      }
    }
  }

  /**
   * Update warning lights
   */
  private updateWarningLights(): void {
    const newLights: string[] = []

    // Check each subsystem for warning conditions
    for (const [name, subsystem] of this.mechanicalState.subsystems) {
      if (subsystem.health < 50) {
        switch (name) {
          case 'engine_block':
          case 'engine_head':
            newLights.push('check_engine')
            break
          case 'oil_system':
            newLights.push('oil_pressure')
            break
          case 'cooling_system':
            newLights.push('coolant_temp')
            break
          case 'electrical':
            newLights.push('battery')
            break
          case 'brakes_front':
          case 'brakes_rear':
            newLights.push('brake_system')
            break
          case 'fuel_system':
            newLights.push('fuel')
            break
        }
      }
    }

    // Detect changes
    for (const light of newLights) {
      if (!this.mechanicalState.activeWarningLights.includes(light)) {
        this.onWarningLight?.(light, true)
      }
    }
    for (const light of this.mechanicalState.activeWarningLights) {
      if (!newLights.includes(light)) {
        this.onWarningLight?.(light, false)
      }
    }

    this.mechanicalState.activeWarningLights = newLights
  }

  /**
   * Calculate breakdown risk
   */
  private calculateBreakdownRisk(): void {
    let risk = 0
    let criticalCount = 0

    for (const [name, subsystem] of this.mechanicalState.subsystems) {
      if (subsystem.isFailed && SUBSYSTEM_DATA[name].affectsDrivable) {
        criticalCount++
        risk += 0.3
      } else if (subsystem.health < 30) {
        risk += 0.1
      } else if (subsystem.health < 50) {
        risk += 0.02
      }
    }

    // Multiple critical failures = much higher risk
    if (criticalCount > 1) {
      risk *= criticalCount
    }

    this.mechanicalState.breakdownRisk = Math.min(1, risk)
  }

  /**
   * Trigger breakdown event
   */
  private triggerBreakdown(subsystemName?: SubsystemName): void {
    if (subsystemName) {
      this.onBreakdown?.(subsystemName)
      return
    }
    // Find a failed critical subsystem
    for (const [name, subsystem] of this.mechanicalState.subsystems) {
      if (subsystem.isFailed && SUBSYSTEM_DATA[name].affectsDrivable) {
        this.onBreakdown?.(name)
        break
      }
    }
  }

  /**
   * Recalculate total damage percentages
   */
  private recalculateTotals(): void {
    // Visual
    let visualTotal = 0
    for (const panel of this.visualState.panels.values()) {
      visualTotal += (100 - panel.health)
    }
    this.visualState.totalVisualDamage = visualTotal / (PANEL_NAMES.length * 100)

    // Mechanical
    let mechanicalTotal = 0
    for (const subsystem of this.mechanicalState.subsystems.values()) {
      mechanicalTotal += (100 - subsystem.health)
    }
    this.mechanicalState.totalMechanicalDamage = mechanicalTotal / (SUBSYSTEM_NAMES.length * 100)
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Get visual damage state
   */
  getVisualState(): VisualDamageState {
    return this.visualState
  }

  /**
   * Get mechanical damage state
   */
  getMechanicalState(): MechanicalDamageState {
    return this.mechanicalState
  }

  /**
   * Get panel damage
   */
  getPanelDamage(name: PanelName): PanelDamage | undefined {
    return this.visualState.panels.get(name)
  }

  /**
   * Get subsystem damage
   */
  getSubsystemDamage(name: SubsystemName): SubsystemDamage | undefined {
    return this.mechanicalState.subsystems.get(name)
  }

  /**
   * Get all active symptoms
   */
  getAllSymptoms(): { subsystem: SubsystemName; symptom: string }[] {
    const symptoms: { subsystem: SubsystemName; symptom: string }[] = []
    for (const [name, subsystem] of this.mechanicalState.subsystems) {
      for (const symptom of subsystem.symptoms) {
        symptoms.push({ subsystem: name, symptom })
      }
    }
    return symptoms
  }

  /**
   * Get active warning lights
   */
  getWarningLights(): string[] {
    return [...this.mechanicalState.activeWarningLights]
  }

  /**
   * Get breakdown risk (0-1)
   */
  getBreakdownRisk(): number {
    return this.mechanicalState.breakdownRisk
  }

  /**
   * Check if vehicle is drivable
   */
  isDrivable(): boolean {
    // Check for critical failures that prevent driving
    for (const [name, subsystem] of this.mechanicalState.subsystems) {
      if (subsystem.isFailed && SUBSYSTEM_DATA[name].affectsDrivable) {
        return false
      }
    }
    return true
  }

  /**
   * Repair a panel
   */
  repairPanel(name: PanelName, amount = 100): void {
    const panel = this.visualState.panels.get(name)
    if (!panel) return

    panel.health = Math.min(100, panel.health + amount)
    panel.deformation = Math.max(0, 1 - panel.health / 100)
    panel.paintDamage = Math.max(0, panel.paintDamage - amount / 100)
    panel.isDetached = false

    this.recalculateTotals()
    this.visualState.dirty = true
    this.onVisualDamageChange?.(this.visualState)
  }

  /**
   * Repair a subsystem
   */
  repairSubsystem(name: SubsystemName, amount = 100): void {
    const subsystem = this.mechanicalState.subsystems.get(name)
    if (!subsystem) return

    const wasFailed = subsystem.isFailed
    subsystem.health = Math.min(100, subsystem.health + amount)
    subsystem.wear = Math.max(0, subsystem.wear - amount / 1000)

    if (subsystem.health > SUBSYSTEM_DATA[name].criticalThreshold) {
      subsystem.isFailed = false
      subsystem.failureMode = undefined
    }

    this.recalculateTotals()
    this.onMechanicalDamageChange?.(this.mechanicalState)
  }

  /**
   * Full repair
   */
  fullRepair(): void {
    for (const panel of this.visualState.panels.values()) {
      panel.health = 100
      panel.deformation = 0
      panel.paintDamage = 0
      panel.isDetached = false
    }

    for (const subsystem of this.mechanicalState.subsystems.values()) {
      subsystem.health = 100
      subsystem.wear = 0
      subsystem.symptoms = []
      subsystem.isFailed = false
      subsystem.failureMode = undefined
    }

    this.recalculateTotals()
    this.visualState.dirty = true
    this.onVisualDamageChange?.(this.visualState)
    this.onMechanicalDamageChange?.(this.mechanicalState)
  }

  /**
   * Set odometer (for wear calculation)
   */
  setOdometer(meters: number): void {
    this.totalDistance = meters
  }

  /**
   * Get total distance
   */
  getDistance(): number {
    return this.totalDistance
  }

  /**
   * Serialize for save
   */
  serialize(): any {
    const panels: any = {}
    for (const [name, panel] of this.visualState.panels) {
      panels[name] = { ...panel }
    }

    const subsystems: any = {}
    for (const [name, subsystem] of this.mechanicalState.subsystems) {
      subsystems[name] = { ...subsystem }
    }

    return {
      visual: panels,
      mechanical: subsystems,
      totalDistance: this.totalDistance,
      config: this.config
    }
  }

  /**
   * Deserialize from save
   */
  deserialize(data: any): void {
    if (data.visual) {
      for (const [name, panel] of Object.entries(data.visual)) {
        const p = this.visualState.panels.get(name as PanelName)
        if (p) Object.assign(p, panel)
      }
    }

    if (data.mechanical) {
      for (const [name, subsystem] of Object.entries(data.mechanical)) {
        const s = this.mechanicalState.subsystems.get(name as SubsystemName)
        if (s) Object.assign(s, subsystem)
      }
    }

    this.totalDistance = data.totalDistance || 0
    this.recalculateTotals()
    this.updateSymptoms()
    this.updateWarningLights()
    this.calculateBreakdownRisk()
  }

  /**
   * Reset damage model
   */
  reset(): void {
    this.initialize()
    this.totalDistance = 0
    this.recalculateTotals()
  }

  /**
   * Set config
   */
  setConfig(config: Partial<DamageModelConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get config
   */
  getConfig(): DamageModelConfig {
    return { ...this.config }
  }
}

// ============================================
// DAMAGE VISUALIZATION HELPERS
// ============================================

/**
 * Create deformation data for vertex shader
 */
export function createDeformationData(panelDamage: PanelDamage, baseGeometry: THREE.BufferGeometry): Float32Array | null {
  if (!panelDamage.originalVertices) {
    const posAttr = baseGeometry.getAttribute('position')
    if (!posAttr) return null
    panelDamage.originalVertices = new Float32Array(posAttr.array)
  }

  if (panelDamage.deformation <= 0) return panelDamage.originalVertices

  const deformed = new Float32Array(panelDamage.originalVertices.length)
  const deformation = panelDamage.deformation

  for (let i = 0; i < panelDamage.originalVertices.length; i += 3) {
    const x = panelDamage.originalVertices[i]
    const y = panelDamage.originalVertices[i + 1]
    const z = panelDamage.originalVertices[i + 2]

    // Apply deformation based on panel type
    // This is simplified - real implementation would use deformation maps
    let dx = 0, dy = 0, dz = 0

    // Push vertices inward based on damage
    const distFromCenter = Math.sqrt(x * x + z * z)
    const maxDist = 1 // normalized
    const falloff = 1 - Math.min(1, distFromCenter / maxDist)

    dz = -deformation * 0.1 * falloff // push back
    dy = deformation * 0.05 * falloff * (Math.random() - 0.5) // slight buckle

    deformed[i] = x + dx
    deformed[i + 1] = y + dy
    deformed[i + 2] = z + dz
  }

  panelDamage.deformedVertices = deformed
  return deformed
}

/**
 * Get damage color for panel (for debug visualization)
 */
export function getDamageColor(health: number): THREE.Color {
  if (health > 80) return new THREE.Color(0x00ff00) // Green
  if (health > 50) return new THREE.Color(0xffff00) // Yellow
  if (health > 20) return new THREE.Color(0xff8800) // Orange
  return new THREE.Color(0xff0000) // Red
}

/**
 * Get subsystem status color
 */
export function getSubsystemColor(health: number): THREE.Color {
  if (health > 70) return new THREE.Color(0x00ff00)
  if (health > 40) return new THREE.Color(0xffff00)
  if (health > 15) return new THREE.Color(0xff8800)
  return new THREE.Color(0xff0000)
}