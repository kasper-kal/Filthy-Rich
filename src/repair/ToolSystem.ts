import * as THREE from 'three'

/**
 * ToolSystem - Tools ownership, skill progression, tool quality effects
 * Player collects tools over time, quality affects repair speed/quality
 */

// ============================================
// TOOL DEFINITIONS
// ============================================

export type ToolCategory =
  | 'hand_tools'      // sockets, spanners, screwdrivers
  | 'specialty'       // torque wrench, spring compressors, etc.
  | 'diagnostic'      // OBD scanner, multimeter, compression tester
  | 'lifting'         // jack, axle stands, engine hoist, transmission jack
  | 'power_tools'     // impact wrench, angle grinder, drill
  | 'consumables'     // brake bleeder kit, penetrating oil, gasket sealant

export interface Tool {
  id: string
  name: string
  category: ToolCategory
  description: string
  basePrice: number
  quality: 1 | 2 | 3 | 4 | 5 // budget / standard / professional / premium / master
  weight: number // kg
  size?: string // for sockets/spanners
  durability: number // 0-100, degrades with use
  maxDurability: number
  effects: ToolEffect[]
  requiredFor: string[] // repair job IDs
  unlocks: string[] // enables certain repair actions
}

export interface ToolEffect {
  type: 'speed' | 'quality' | 'access' | 'precision' | 'safety'
  value: number // multiplier or flat bonus
  appliesTo: string[] // subsystem names or 'all'
}

export interface OwnedTool extends Tool {
  currentDurability: number
  usageCount: number
  acquiredDate: number
  isEquipped: boolean // in mobile toolbox
}

// ============================================
// TOOL CATALOGUE
// ============================================

export class ToolCatalogue {
  private tools: Map<string, Tool> = new Map()

  constructor() {
    this.generateCatalogue()
  }

  private generateCatalogue(): void {
    // HAND TOOLS
    this.addTool({
      id: 'socket_set_budget',
      name: '1/4" + 3/8" Socket Set (Budget)',
      category: 'hand_tools',
      description: 'Basic sockets, ratchet, extensions. Cheap chrome vanadium. Rounds off bolts if you look at them wrong.',
      basePrice: 35,
      quality: 1,
      weight: 2.5,
      durability: 60,
      maxDurability: 60,
      effects: [{ type: 'speed', value: 1.0, appliesTo: ['all'] }, { type: 'quality', value: 0.85, appliesTo: ['all'] }],
      requiredFor: [],
      unlocks: ['basic_bolts']
    })

    this.addTool({
      id: 'socket_set_standard',
      name: '1/4" + 3/8" + 1/2" Socket Set (Standard)',
      category: 'hand_tools',
      description: 'Decent mixed drive set. Six-point sockets, quick-release ratchet. Will last years.',
      basePrice: 120,
      quality: 2,
      weight: 4.5,
      durability: 85,
      maxDurability: 85,
      effects: [{ type: 'speed', value: 1.0, appliesTo: ['all'] }, { type: 'quality', value: 1.0, appliesTo: ['all'] }],
      requiredFor: [],
      unlocks: ['basic_bolts', 'wheel_nuts', 'suspension_bolts']
    })

    this.addTool({
      id: 'socket_set_pro',
      name: 'Pro Mixed Drive Socket Set (Snap-on style)',
      category: 'hand_tools',
      description: 'Flush-connect ratchet, spline-drive sockets, magnetic retainers. The good stuff.',
      basePrice: 450,
      quality: 3,
      weight: 6,
      durability: 95,
      maxDurability: 95,
      effects: [{ type: 'speed', value: 1.15, appliesTo: ['all'] }, { type: 'quality', value: 1.1, appliesTo: ['all'] }, { type: 'access', value: 1, appliesTo: ['tight_spaces'] }],
      requiredFor: [],
      unlocks: ['basic_bolts', 'wheel_nuts', 'suspension_bolts', 'engine_internal', 'gearbox_internal']
    })

    this.addTool({
      id: 'spanner_set_budget',
      name: 'Combination Spanner Set 6-24mm (Budget)',
      category: 'hand_tools',
      description: 'Thin walls, soft metal. Fine for light work, will bend on stuck suspension bolts.',
      basePrice: 25,
      quality: 1,
      weight: 1.8,
      durability: 55,
      maxDurability: 55,
      effects: [{ type: 'speed', value: 1.0, appliesTo: ['all'] }, { type: 'quality', value: 0.8, appliesTo: ['all'] }],
      requiredFor: [],
      unlocks: ['basic_nuts']
    })

    this.addTool({
      id: 'spanner_set_standard',
      name: 'Combination Spanner Set 6-32mm (Standard)',
      category: 'hand_tools',
      description: 'Good ring ends, open ends at 15°. Proper chrome finish.',
      basePrice: 95,
      quality: 2,
      weight: 3.2,
      durability: 90,
      maxDurability: 90,
      effects: [{ type: 'speed', value: 1.0, appliesTo: ['all'] }, { type: 'quality', value: 1.0, appliesTo: ['all'] }],
      requiredFor: [],
      unlocks: ['basic_nuts', 'brake_lines', 'fuel_lines', 'large_suspension']
    })

    this.addTool({
      id: 'screwdriver_set',
      name: 'Screwdriver Set (Phillips/Flat/Torx)',
      category: 'hand_tools',
      description: 'Magnetic tips, hardened shafts. Torx for modern cars essential.',
      basePrice: 28,
      quality: 2,
      weight: 1.2,
      durability: 85,
      maxDurability: 85,
      effects: [{ type: 'speed', value: 1.0, appliesTo: ['all'] }, { type: 'access', value: 1, appliesTo: ['interior', 'electrical'] }],
      requiredFor: [],
      unlocks: ['interior_clips', 'electrical_connectors', 'torx_bolts']
    })

    this.addTool({
      id: 'hex_key_set',
      name: 'Hex/Allen Key Set (Metric + Imperial)',
      category: 'hand_tools',
      description: 'Ball-end for angles. Essential for brake calipers, engine covers.',
      basePrice: 18,
      quality: 2,
      weight: 0.6,
      durability: 90,
      maxDurability: 90,
      effects: [{ type: 'access', value: 1, appliesTo: ['brakes', 'engine_covers'] }],
      requiredFor: [],
      unlocks: ['caliper_bolts', 'engine_covers']
    })

    this.addTool({
      id: 'pliers_set',
      name: 'Pliers Set (Combination, Needle-nose, Locking, Circlip)',
      category: 'hand_tools',
      description: 'Linesman for wire, needle-nose for clips, locking for stuck things, circlip for... circlips.',
      basePrice: 42,
      quality: 2,
      weight: 1.5,
      durability: 85,
      maxDurability: 85,
      effects: [{ type: 'access', value: 1, appliesTo: ['hoses', 'clips', 'wire', 'circlips'] }],
      requiredFor: [],
      unlocks: ['hose_clips', 'wire_crimping', 'circlips', 'stuck_parts']
    })

    // SPECIALTY TOOLS
    this.addTool({
      id: 'torque_wrench_1_2',
      name: '1/2" Drive Torque Wrench (40-210 Nm)',
      category: 'specialty',
      description: 'Click-type. Critical for head bolts, wheel nuts, suspension. Calibrate annually.',
      basePrice: 85,
      quality: 2,
      weight: 2.2,
      durability: 80,
      maxDurability: 80,
      effects: [{ type: 'precision', value: 1, appliesTo: ['engine_block', 'gearbox', 'suspension', 'wheels'] }, { type: 'safety', value: 1, appliesTo: ['critical_fasteners'] }],
      requiredFor: ['head_gasket', 'wheel_bearings', 'suspension_arms', 'clutch_flywheel'],
      unlocks: ['torque_critical']
    })

    this.addTool({
      id: 'torque_wrench_3_8',
      name: '3/8" Drive Torque Wrench (5-25 Nm)',
      category: 'specialty',
      description: 'Low torque for spark plugs, oil drain plugs, small bolts.',
      basePrice: 55,
      quality: 2,
      weight: 1.1,
      durability: 80,
      maxDurability: 80,
      effects: [{ type: 'precision', value: 1, appliesTo: ['engine_head', 'oil_system', 'cooling'] }],
      requiredFor: ['spark_plugs', 'oil_change', 'thermostat'],
      unlocks: ['torque_delicate']
    })

    this.addTool({
      id: 'spring_compressors',
      name: 'Macpherson Strut Spring Compressors (Pair)',
      category: 'specialty',
      description: 'Screw-type, heavy duty. DO NOT use cheap claw type. Your face depends on this.',
      basePrice: 45,
      quality: 2,
      weight: 4,
      durability: 75,
      maxDurability: 75,
      effects: [{ type: 'access', value: 1, appliesTo: ['suspension_front'] }, { type: 'safety', value: 1, appliesTo: ['spring_work'] }],
      requiredFor: ['front_struts', 'front_springs'],
      unlocks: ['spring_compression']
    })

    this.addTool({
      id: 'ball_joint_separator',
      name: 'Ball Joint Separator (Scissor Type)',
      category: 'specialty',
      description: 'Splits taper joints without damaging boots. Track rods, lower arms.',
      basePrice: 22,
      quality: 2,
      weight: 1.5,
      durability: 80,
      maxDurability: 80,
      effects: [{ type: 'speed', value: 1.5, appliesTo: ['suspension_front', 'steering'] }, { type: 'safety', value: 1, appliesTo: ['ball_joints'] }],
      requiredFor: ['track_rod_ends', 'lower_arms'],
      unlocks: ['ball_joint_separation']
    })

    this.addTool({
      id: 'brake_bleeder_kit',
      name: 'Pressure Brake Bleeder Kit',
      category: 'specialty',
      description: 'One-man bleeding. Pressurises reservoir. Clean, fast, no pump-and-hold.',
      basePrice: 38,
      quality: 2,
      weight: 1.8,
      durability: 85,
      maxDurability: 85,
      effects: [{ type: 'speed', value: 2, appliesTo: ['brakes_front', 'brakes_rear'] }, { type: 'quality', value: 1.2, appliesTo: ['brakes'] }],
      requiredFor: ['brake_fluid_change', 'caliper_replacement'],
      unlocks: ['brake_bleeding']
    })

    this.addTool({
      id: 'oil_filter_wrench',
      name: 'Oil Filter Wrench Set (Strap + Cap + Claw)',
      category: 'specialty',
      description: 'Three types cover every filter. Cap wrench for cartridge filters is essential on moderns.',
      basePrice: 24,
      quality: 2,
      weight: 0.8,
      durability: 90,
      maxDurability: 90,
      effects: [{ type: 'access', value: 1, appliesTo: ['oil_system'] }, { type: 'speed', value: 1.5, appliesTo: ['oil_changes'] }],
      requiredFor: ['oil_filter_change'],
      unlocks: ['oil_filter_removal']
    })

    // DIAGNOSTIC TOOLS
    this.addTool({
      id: 'obd_scanner_basic',
      name: 'Basic OBD2 Scanner (ELM327 Bluetooth)',
      category: 'diagnostic',
      description: 'Reads/clears codes, live data stream. Phone app does the UI. Cheap but slow.',
      basePrice: 22,
      quality: 1,
      weight: 0.1,
      durability: 70,
      maxDurability: 70,
      effects: [{ type: 'access', value: 1, appliesTo: ['obd_scanning'] }],
      requiredFor: ['fault_code_read'],
      unlocks: ['read_codes', 'clear_codes', 'basic_live_data']
    })

    this.addTool({
      id: 'obd_scanner_pro',
      name: 'Professional OBD Scanner (Launch/Autel style)',
      category: 'diagnostic',
      description: 'Bi-directional control, actuation tests, ECU coding, graphing. Pays for itself.',
      basePrice: 380,
      quality: 3,
      weight: 1.5,
      durability: 90,
      maxDurability: 90,
      effects: [{ type: 'speed', value: 2, appliesTo: ['diagnosis'] }, { type: 'precision', value: 1.5, appliesTo: ['obd_scanning'] }, { type: 'access', value: 1, appliesTo: ['actuation_tests', 'ecu_coding'] }],
      requiredFor: ['advanced_diagnosis', 'actuation_test', 'adaptation_reset'],
      unlocks: ['read_codes', 'clear_codes', 'full_live_data', 'actuation_tests', 'ecu_coding', 'graphing']
    })

    this.addTool({
      id: 'multimeter',
      name: 'Digital Multimeter (Fluke style)',
      category: 'diagnostic',
      description: 'Volts, ohms, amps, continuity, diode, frequency. Auto-ranging. Don\'t buy the £5 one.',
      basePrice: 45,
      quality: 2,
      weight: 0.5,
      durability: 95,
      maxDurability: 95,
      effects: [{ type: 'precision', value: 1, appliesTo: ['electrical', 'fuel_system', 'ignition_system'] }, { type: 'access', value: 1, appliesTo: ['circuit_testing'] }],
      requiredFor: ['circuit_test', 'sensor_test', 'wiring_check'],
      unlocks: ['voltage_test', 'resistance_test', 'continuity', 'current_clamp']
    })

    this.addTool({
      id: 'compression_tester',
      name: 'Compression Tester Kit (Petrol + Diesel Adapters)',
      category: 'diagnostic',
      description: 'Screw-in adapter holds pressure. Gauge reads per cylinder. Essential for engine health.',
      basePrice: 35,
      quality: 2,
      weight: 1.2,
      durability: 85,
      maxDurability: 85,
      effects: [{ type: 'precision', value: 1, appliesTo: ['engine_block'] }, { type: 'access', value: 1, appliesTo: ['compression_test'] }],
      requiredFor: ['compression_test'],
      unlocks: ['compression_test']
    })

    this.addTool({
      id: 'borescope',
      name: 'Articulating Borescope (5mm Camera, 1.5m Cable)',
      category: 'diagnostic',
      description: 'Look inside cylinders, manifolds, behind dash. Phone-connected or built-in screen.',
      basePrice: 65,
      quality: 2,
      weight: 0.4,
      durability: 80,
      maxDurability: 80,
      effects: [{ type: 'precision', value: 1.3, appliesTo: ['engine_block', 'engine_head'] }, { type: 'access', value: 1, appliesTo: ['internal_inspection'] }],
      requiredFor: ['borescope_inspection'],
      unlocks: ['cylinder_inspection', 'valve_inspection', 'piston_inspection']
    })

    this.addTool({
      id: 'stethoscope',
      name: 'Mechanic\'s Stethoscope (Metal Probe + Hose)',
      category: 'diagnostic',
      description: 'Listen to bearings, injectors, valves. That tapping - is it top end or bottom end?',
      basePrice: 15,
      quality: 2,
      weight: 0.3,
      durability: 90,
      maxDurability: 90,
      effects: [{ type: 'precision', value: 1.2, appliesTo: ['engine_block', 'engine_head', 'gearbox', 'differential'] }],
      requiredFor: ['stethoscope_diagnosis'],
      unlocks: ['auditory_diagnosis']
    })

    this.addTool({
      id: 'pressure_tester',
      name: 'Cooling System Pressure Tester',
      category: 'diagnostic',
      description: 'Pump up cold system, watch for pressure drop. Finds leaks water pump won\'t show.',
      basePrice: 32,
      quality: 2,
      weight: 1,
      durability: 85,
      maxDurability: 85,
      effects: [{ type: 'precision', value: 1.3, appliesTo: ['cooling_system'] }],
      requiredFor: ['pressure_test_cooling'],
      unlocks: ['cooling_pressure_test']
    })

    this.addTool({
      id: 'smoke_machine',
      name: 'EVAP Smoke Machine (Workshop Grade)',
      category: 'diagnostic',
      description: 'Pressurises intake/exhaust with UV smoke. Finds vacuum leaks, exhaust leaks, EVAP leaks.',
      basePrice: 280,
      quality: 3,
      weight: 5,
      durability: 80,
      maxDurability: 80,
      effects: [{ type: 'precision', value: 1.5, appliesTo: ['fuel_system', 'exhaust', 'engine_block'] }],
      requiredFor: ['smoke_test'],
      unlocks: ['vacuum_leak_test', 'exhaust_leak_test', 'evap_test']
    })

    // LIFTING EQUIPMENT
    this.addTool({
      id: 'floor_jack',
      name: '3-Ton Low-Profile Floor Jack',
      category: 'lifting',
      description: 'Quick lift, low entry for slammed cars. Steel saddle, rubber pad.',
      basePrice: 85,
      quality: 2,
      weight: 18,
      durability: 90,
      maxDurability: 90,
      effects: [{ type: 'access', value: 1, appliesTo: ['all_wheel_work', 'under_car_access'] }, { type: 'speed', value: 1.2, appliesTo: ['wheel_changes'] }],
      requiredFor: ['wheel_removal', 'brake_work', 'suspension_work'],
      unlocks: ['lifting', 'wheel_access']
    })

    this.addTool({
      id: 'axle_stands',
      name: 'Axle Stands (Pair, 3-Ton, Ratchet)',
      category: 'lifting',
      description: 'NEVER work under a car on just a jack. Ratchet stands lock positively.',
      basePrice: 40,
      quality: 2,
      weight: 8,
      durability: 95,
      maxDurability: 95,
      effects: [{ type: 'safety', value: 1, appliesTo: ['all_under_car'] }],
      requiredFor: ['all_under_car_work'],
      unlocks: ['safe_working']
    })

    this.addTool({
      id: 'engine_hoist',
      name: '2-Ton Folding Engine Hoist (Cherry Picker)',
      category: 'lifting',
      description: 'Folds flat for storage. Boom extends. Chain and hook included. Need level concrete.',
      basePrice: 180,
      quality: 2,
      weight: 45,
      durability: 90,
      maxDurability: 90,
      effects: [{ type: 'access', value: 1, appliesTo: ['engine_removal', 'gearbox_removal'] }],
      requiredFor: ['engine_swap', 'gearbox_swap', 'clutch_replacement'],
      unlocks: ['engine_lifting']
    })

    this.addTool({
      id: 'transmission_jack',
      name: 'Transmission Jack (Saddle Type, 500kg)',
      category: 'lifting',
      description: 'Wide saddle, tilt adjustment. Essential for gearbox/clutch. Floor jack + wood block = bad idea.',
      basePrice: 140,
      quality: 2,
      weight: 22,
      durability: 85,
      maxDurability: 85,
      effects: [{ type: 'access', value: 1, appliesTo: ['gearbox_removal', 'clutch_replacement'] }, { type: 'safety', value: 1, appliesTo: ['gearbox_handling'] }],
      requiredFor: ['gearbox_swap', 'clutch_replacement'],
      unlocks: ['gearbox_lifting']
    })

    // POWER TOOLS
    this.addTool({
      id: 'impact_wrench_cordless',
      name: '1/2" Cordless Impact Wrench (400 Nm)',
      category: 'power_tools',
      description: 'Brushless, 18V/20V platform. Removes wheel nuts, suspension bolts in seconds. Spare battery essential.',
      basePrice: 220,
      quality: 3,
      weight: 3.2,
      durability: 85,
      maxDurability: 85,
      effects: [{ type: 'speed', value: 3, appliesTo: ['wheel_nuts', 'suspension_bolts', 'subframe_bolts'] }, { type: 'access', value: 1, appliesTo: ['seized_fasteners'] }],
      requiredFor: ['stuck_wheel_nuts', 'suspension_arms', 'subframe'],
      unlocks: ['impact_removal']
    })

    this.addTool({
      id: 'angle_grinder',
      name: '115mm Angle Grinder (Corded)',
      category: 'power_tools',
      description: 'Cutting discs for exhaust, grinding discs for prep. Dust everywhere. Wear a mask.',
      basePrice: 45,
      quality: 2,
      weight: 2.5,
      durability: 80,
      maxDurability: 80,
      effects: [{ type: 'access', value: 1, appliesTo: ['exhaust', 'rusted_bolts', 'fabrication'] }],
      requiredFor: ['exhaust_cutting', 'rusted_bolt_removal'],
      unlocks: ['cutting', 'grinding']
    })

    this.addTool({
      id: 'drill_driver',
      name: 'Combi Drill/Driver (18V, Brushless)',
      category: 'power_tools',
      description: 'Drilling holes, driving screws, wire brushing. Two batteries, charger.',
      basePrice: 120,
      quality: 2,
      weight: 2,
      durability: 90,
      maxDurability: 90,
      effects: [{ type: 'speed', value: 1.5, appliesTo: ['fabrication', 'bracket_work', 'wire_brushing'] }],
      requiredFor: [],
      unlocks: ['drilling', 'driving', 'wire_brushing']
    })

    // CONSUMABLES (treated as tools that deplete)
    this.addTool({
      id: 'penetrating_oil',
      name: 'Penetrating Oil (500ml, PlusGas/WD40 Specialist)',
      category: 'consumables',
      description: 'Soak stuck bolts overnight. Heat + penetrate + shock = freedom. Not WD40 regular.',
      basePrice: 12,
      quality: 2,
      weight: 0.5,
      durability: 100,
      maxDurability: 100,
      effects: [{ type: 'access', value: 1, appliesTo: ['seized_fasteners'] }, { type: 'speed', value: 2, appliesTo: ['rusted_bolts'] }],
      requiredFor: ['seized_bolt_removal'],
      unlocks: ['penetrating']
    })

    this.addTool({
      id: 'gasket_sealant',
      name: 'RTV Gasket Maker (Grey, High-Temp)',
      category: 'consumables',
      description: 'For surfaces without gaskets, or as supplement. Sensor-safe, oil-resistant.',
      basePrice: 8,
      quality: 2,
      weight: 0.1,
      durability: 100,
      maxDurability: 100,
      effects: [{ type: 'quality', value: 1, appliesTo: ['engine_block', 'gearbox', 'cooling'] }],
      requiredFor: ['sump_gasket', 'water_pump', 'thermostat_housing'],
      unlocks: ['gasket_making']
    })

    this.addTool({
      id: 'copper_grease',
      name: 'Copper Slip / Anti-Seize (Tub)',
      category: 'consumables',
      description: 'Exhaust bolts, spark plugs, wheel centres. Prevents galvanic corrosion and seizing.',
      basePrice: 6,
      quality: 2,
      weight: 0.2,
      durability: 100,
      maxDurability: 100,
      effects: [{ type: 'quality', value: 1, appliesTo: ['exhaust', 'engine_head', 'wheels'] }, { type: 'safety', value: 1, appliesTo: ['future_removal'] }],
      requiredFor: ['exhaust_bolts', 'spark_plugs', 'wheel_fitment'],
      unlocks: ['anti_seize']
    })

    this.addTool({
      id: 'brake_cleaner',
      name: 'Brake Cleaner (500ml Aerosol)',
      category: 'consumables',
      description: 'Degreases discs, cleans sensors, evaporates fast. Don\'t breathe it.',
      basePrice: 4,
      quality: 2,
      weight: 0.5,
      durability: 100,
      maxDurability: 100,
      effects: [{ type: 'quality', value: 1, appliesTo: ['brakes', 'electrical'] }],
      requiredFor: ['brake_cleaning', 'sensor_cleaning'],
      unlocks: ['degreasing']
    })

    this.addTool({
      id: 'threadlocker_blue',
      name: 'Threadlocker Blue (Medium Strength, 10ml)',
      category: 'consumables',
      description: 'Brake caliper bolts, suspension arms, anything that vibrates loose. Not red.',
      basePrice: 7,
      quality: 2,
      weight: 0.05,
      durability: 100,
      maxDurability: 100,
      effects: [{ type: 'safety', value: 1, appliesTo: ['vibrating_fasteners'] }],
      requiredFor: ['caliper_bolts', 'suspension_arms', 'bracket_bolts'],
      unlocks: ['threadlocking']
    })
  }

  private addTool(tool: Omit<Tool, 'maxDurability'> & { maxDurability?: number }): void {
    const t: Tool = {
      ...tool,
      maxDurability: tool.maxDurability || tool.durability
    }
    this.tools.set(t.id, t)
  }

  getTool(id: string): Tool | undefined {
    return this.tools.get(id)
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values())
  }

  getToolsByCategory(category: ToolCategory): Tool[] {
    return Array.from(this.tools.values()).filter(t => t.category === category)
  }

  getToolsForJob(jobId: string): Tool[] {
    return Array.from(this.tools.values()).filter(t => t.requiredFor.includes(jobId))
  }

  getToolsUnlocking(action: string): Tool[] {
    return Array.from(this.tools.values()).filter(t => t.unlocks.includes(action))
  }
}

// ============================================
// PLAYER TOOLKIT
// ============================================

export class Toolkit {
  private catalogue: ToolCatalogue
  private ownedTools: Map<string, OwnedTool> = new Map()
  private mobileToolbox: Set<string> = new Set() // tool IDs equipped for roadside
  private toolboxCapacity = 15 // max tools in mobile toolbox
  private garageStorage = true // unlimited in garage

  // Skill/experience
  private toolSkill: Map<string, number> = new Map() // toolId -> experience (0-100)
  private categorySkill: Map<ToolCategory, number> = new Map()

  // Callbacks
  onToolAcquired?: (tool: OwnedTool) => void
  onToolBroken?: (tool: OwnedTool) => void
  onSkillUp?: (category: ToolCategory, level: number) => void

  constructor(catalogue: ToolCatalogue) {
    this.catalogue = catalogue
  }

  /**
   * Purchase and acquire a tool
   */
  acquireTool(toolId: string, money: number): { success: boolean; newMoney: number; tool?: OwnedTool } {
    const baseTool = this.catalogue.getTool(toolId)
    if (!baseTool) return { success: false, newMoney: money }

    if (money < baseTool.basePrice) return { success: false, newMoney: money }
    if (this.ownedTools.has(toolId)) return { success: false, newMoney: money }

    const newMoney = money - baseTool.basePrice
    const owned: OwnedTool = {
      ...baseTool,
      currentDurability: baseTool.maxDurability,
      usageCount: 0,
      acquiredDate: Date.now(),
      isEquipped: this.mobileToolbox.size < this.toolboxCapacity
    }

    this.ownedTools.set(toolId, owned)

    if (owned.isEquipped) {
      this.mobileToolbox.add(toolId)
    }

    this.onToolAcquired?.(owned)
    return { success: true, newMoney, tool: owned }
  }

  /**
   * Use a tool (degrades durability, grants skill XP)
   */
  useTool(toolId: string, subsystem: string, durationMinutes: number): { success: boolean; effect: number } {
    const tool = this.ownedTools.get(toolId)
    if (!tool) return { success: false, effect: 0 }

    // Calculate wear
    const wearRate = tool.quality === 1 ? 0.5 : tool.quality === 2 ? 0.25 : 0.1
    const wear = durationMinutes * wearRate * (tool.category === 'power_tools' ? 1.5 : 1)
    tool.currentDurability = Math.max(0, tool.currentDurability - wear)
    tool.usageCount++

    // Grant skill XP
    this.addSkillXP(toolId, tool.category, durationMinutes * 2)

    // Check for breakage
    if (tool.currentDurability <= 0) {
      this.onToolBroken?.(tool)
      return { success: true, effect: this.getToolEffect(tool, subsystem) * 0.5 } // half effectiveness when broken
    }

    return { success: true, effect: this.getToolEffect(tool, subsystem) }
  }

  private getToolEffect(tool: OwnedTool, subsystem: string): number {
    let effect = 1
    for (const eff of tool.effects) {
      if (eff.appliesTo.includes('all') || eff.appliesTo.includes(subsystem)) {
        if (eff.type === 'speed' || eff.type === 'quality') {
          effect *= eff.value
        }
      }
    }
    // Durability affects performance
    effect *= THREE.MathUtils.mapLinear(tool.currentDurability, 0, tool.maxDurability, 0.5, 1)
    return effect
  }

  private addSkillXP(toolId: string, category: ToolCategory, xp: number): void {
    const current = this.toolSkill.get(toolId) || 0
    this.toolSkill.set(toolId, Math.min(100, current + xp))

    const catCurrent = this.categorySkill.get(category) || 0
    const newCatLevel = Math.min(100, catCurrent + xp * 0.5)
    this.categorySkill.set(category, newCatLevel)

    // Check for level up (every 20 XP = 1 level)
    const oldLevel = Math.floor(catCurrent / 20)
    const newLevel = Math.floor(newCatLevel / 20)
    if (newLevel > oldLevel) {
      this.onSkillUp?.(category, newLevel)
    }
  }

  /**
   * Get tool effectiveness for a job
   */
  getJobEffectiveness(jobId: string): number {
    let totalEffect = 1
    let toolCount = 0

    for (const tool of this.ownedTools.values()) {
      if (tool.requiredFor.includes(jobId)) {
        totalEffect *= this.getToolEffect(tool, jobId)
        toolCount++
      }
    }

    // Bonus for having multiple correct tools
    if (toolCount > 1) {
      totalEffect *= 1 + (toolCount - 1) * 0.1
    }

    return toolCount > 0 ? totalEffect : 0.5 // penalty for missing tools
  }

  /**
   * Check if player can perform action
   */
  canPerform(action: string): boolean {
    for (const tool of this.ownedTools.values()) {
      if (tool.unlocks.includes(action)) return true
    }
    return false
  }

  /**
   * Equip/unequip tool for mobile toolbox
   */
  setEquipped(toolId: string, equipped: boolean): boolean {
    const tool = this.ownedTools.get(toolId)
    if (!tool) return false

    if (equipped) {
      if (this.mobileToolbox.size >= this.toolboxCapacity) return false
      this.mobileToolbox.add(toolId)
      tool.isEquipped = true
    } else {
      this.mobileToolbox.delete(toolId)
      tool.isEquipped = false
    }
    return true
  }

  /**
   * Get owned tools
   */
  getOwnedTools(): OwnedTool[] {
    return Array.from(this.ownedTools.values())
  }

  getEquippedTools(): OwnedTool[] {
    return Array.from(this.mobileToolbox).map(id => this.ownedTools.get(id)!).filter(Boolean)
  }

  getToolsByCategory(category: ToolCategory): OwnedTool[] {
    return Array.from(this.ownedTools.values()).filter(t => t.category === category)
  }

  getToolSkill(toolId: string): number {
    return this.toolSkill.get(toolId) || 0
  }

  getCategorySkill(category: ToolCategory): number {
    return this.categorySkill.get(category) || 0
  }

  getCategoryLevel(category: ToolCategory): number {
    return Math.floor((this.categorySkill.get(category) || 0) / 20)
  }

  /**
   * Repair/refurbish tool durability
   */
  refurbishTool(toolId: string, money: number): { success: boolean; newMoney: number } {
    const tool = this.ownedTools.get(toolId)
    if (!tool) return { success: false, newMoney: money }

    const needed = tool.maxDurability - tool.currentDurability
    if (needed <= 0) return { success: true, newMoney: money }

    const cost = Math.round(needed * tool.basePrice * 0.01) // 1% of price per durability point
    if (money < cost) return { success: false, newMoney: money }

    tool.currentDurability = tool.maxDurability
    return { success: true, newMoney: money - cost }
  }

  /**
   * Sell tool
   */
  sellTool(toolId: string, money: number): { success: boolean; newMoney: number } {
    const tool = this.ownedTools.get(toolId)
    if (!tool) return { success: false, newMoney: money }

    const sellPrice = Math.round(tool.basePrice * 0.4 * (tool.currentDurability / tool.maxDurability))
    this.ownedTools.delete(toolId)
    this.mobileToolbox.delete(toolId)
    this.toolSkill.delete(toolId)

    return { success: true, newMoney: money + sellPrice }
  }

  serialize(): any {
    return {
      ownedTools: Array.from(this.ownedTools.entries()),
      mobileToolbox: Array.from(this.mobileToolbox),
      toolboxCapacity: this.toolboxCapacity,
      toolSkill: Array.from(this.toolSkill.entries()),
      categorySkill: Array.from(this.categorySkill.entries())
    }
  }

  deserialize(data: any): void {
    this.ownedTools = new Map(data.ownedTools || [])
    this.mobileToolbox = new Set(data.mobileToolbox || [])
    this.toolboxCapacity = data.toolboxCapacity || 15
    this.toolSkill = new Map(data.toolSkill || [])
    this.categorySkill = new Map(data.categorySkill || [])
  }
}

// ============================================
// TOOL QUALITY EFFECTS ON REPAIR
// ============================================

export function calculateRepairQuality(
  ownedTools: OwnedTool[],
  requiredTools: { tool: string; optional?: boolean }[],
  playerSkill: Map<string, number>
): { quality: number; speed: number; canComplete: boolean; missing: string[] } {
  let quality = 1
  let speed = 1
  let canComplete = true
  const missing: string[] = []

  for (const req of requiredTools) {
    const tool = ownedTools.find(t => t.id === req.tool)
    if (!tool) {
      if (req.optional) continue
      canComplete = false
      missing.push(req.tool)
      continue
    }

    // Tool quality bonus
    const qualityBonus = tool.quality / 5 // 0.2 to 1.0
    quality *= 0.7 + qualityBonus * 0.3

    // Tool condition
    const conditionFactor = tool.currentDurability / tool.maxDurability
    quality *= 0.8 + conditionFactor * 0.2

    // Player skill with this tool
    const skill = playerSkill.get(tool.id) || 0
    quality *= 0.85 + (skill / 100) * 0.15

    // Speed from power tools
    if (tool.category === 'power_tools') speed *= 1.5
    else if (tool.category === 'diagnostic') speed *= 1.3

    // Specialty tools give precision
    if (tool.category === 'specialty') quality *= 1.1
  }

  return {
    quality: THREE.MathUtils.clamp(quality, 0.3, 1.5),
    speed: THREE.MathUtils.clamp(speed, 0.5, 3),
    canComplete,
    missing
  }
}