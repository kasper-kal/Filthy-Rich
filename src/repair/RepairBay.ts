import * as THREE from 'three'
import { SubsystemName } from '../vehicle/DamageModel.js'
import { PartsManager, InventoryPart } from './PartSystem.js'
import { Toolkit, OwnedTool } from './ToolSystem.js'

/**
 * RepairBay - Workshop locations, lifts, parts storage, job board
 * Player can rent bay time, use lifts, access parts storage
 */

// ============================================
// REPAIR BAY TYPES
// ============================================

export type BayType = 'basic' | 'standard' | 'professional' | 'specialist'
export type LiftType = 'none' | 'two_post' | 'four_post' | 'scissor' | 'alignment' | 'pit'

export interface RepairBay {
  id: string
  name: string
  type: BayType
  location: string // garage network ID
  position: THREE.Vector3

  // Equipment
  lift: LiftType
  hasCompressor: boolean
  hasTireMachine: boolean
  hasWheelBalancer: boolean
  hasBrakeLathe: boolean
  hasACMachine: boolean
  hasDiagnosticBench: boolean
  hasEngineStand: boolean
  hasTransmissionJack: boolean
  hasSpringCompressor: boolean
  hasPress: boolean
  hasWelder: boolean
  hasPartsWasher: boolean

  // Storage
  partsStorageCapacity: number // kg
  toolStorageCapacity: number // tool count

  // Rental
  hourlyRate: number
  minimumHours: number
  requiresBooking: boolean

  // Specializations
  specialties: SubsystemName[]
  // e.g., ['engine_block', 'turbocharger'] = engine specialist

  // Status
  isOccupied: boolean
  currentJob?: RepairJob
  bookedUntil?: number // timestamp
}

export interface RepairJob {
  id: string
  bayId: string
  vehicleId: string
  customerName?: string // if NPC job
  tasks: RepairTask[]
  status: 'pending' | 'in_progress' | 'waiting_parts' | 'testing' | 'complete' | 'abandoned'
  startedAt: number
  estimatedHours: number
  actualHours: number
  quotedPrice: number
  finalPrice: number
  partsUsed: InventoryPart[]
  labourRate: number
}

export interface RepairTask {
  id: string
  subsystem: SubsystemName
  description: string
  requiredParts: { partId: string; quantity: number; condition?: string }[]
  requiredTools: string[]
  estimatedHours: number
  actualHours: number
  status: 'pending' | 'in_progress' | 'waiting_parts' | 'complete'
  assignedTo?: string // player or NPC mechanic
  quality?: number // 0-1 final quality
}

export interface GarageFacility {
  id: string
  name: string
  position: THREE.Vector3
  bays: RepairBay[]
  partsShop: PartsManager
  toolRental: Map<string, { toolId: string; hourlyRate: number }>
  services: GarageService[]
  reputation: number // 0-100
  specialties: SubsystemName[]
  openingHours: { open: number; close: number } // hour 0-23
  isPlayerOwned: boolean
}

export type GarageService =
  | 'mot_test'
  | 'wheel_alignment'
  | 'ac_recharge'
  | 'brake_disc_skimming'
  | 'engine_rebuild'
  | 'gearbox_rebuild'
  | 'turbo_rebuild'
  | 'dpf_clean'
  | 'ecu_remap'
  | 'custom_fabrication'
  | 'classic_restoration'
  | 'performance_tuning'

export interface PlayerGarage extends GarageFacility {
  ownedBays: string[] // bay IDs player owns
  rentedBays: Map<string, { expires: number; hoursPaid: number }>
  staff: GarageStaff[]
  monthlyRent: number
  monthlyBills: number
}

export interface GarageStaff {
  id: string
  name: string
  role: 'mechanic' | 'apprentice' | 'parts_manager' | 'receptionist'
  skill: Record<SubsystemName, number> // 0-100
  wage: number // per hour
  efficiency: number // 0.5-1.5
  morale: number // 0-100
  maxHoursPerWeek: number
}

// ============================================
// REPAIR BAY CATALOGUE
// ============================================

export class RepairBayCatalogue {
  static readonly BAY_PRESETS: Record<BayType, Partial<RepairBay>> = {
    basic: {
      type: 'basic',
      lift: 'two_post',
      hasCompressor: true,
      hasTireMachine: false,
      hasWheelBalancer: false,
      hasBrakeLathe: false,
      hasACMachine: false,
      hasDiagnosticBench: false,
      hasEngineStand: false,
      hasTransmissionJack: false,
      hasSpringCompressor: false,
      hasPress: false,
      hasWelder: false,
      hasPartsWasher: false,
      partsStorageCapacity: 100,
      toolStorageCapacity: 20,
      hourlyRate: 15,
      minimumHours: 1,
      requiresBooking: false,
      specialties: []
    },
    standard: {
      type: 'standard',
      lift: 'four_post',
      hasCompressor: true,
      hasTireMachine: true,
      hasWheelBalancer: true,
      hasBrakeLathe: true,
      hasACMachine: false,
      hasDiagnosticBench: true,
      hasEngineStand: true,
      hasTransmissionJack: true,
      hasSpringCompressor: true,
      hasPress: true,
      hasWelder: false,
      hasPartsWasher: true,
      partsStorageCapacity: 300,
      toolStorageCapacity: 50,
      hourlyRate: 30,
      minimumHours: 2,
      requiresBooking: true,
      specialties: ['brakes_front', 'brakes_rear', 'suspension_front', 'suspension_rear', 'wheels', 'exhaust']
    },
    professional: {
      type: 'professional',
      lift: 'four_post',
      hasCompressor: true,
      hasTireMachine: true,
      hasWheelBalancer: true,
      hasBrakeLathe: true,
      hasACMachine: true,
      hasDiagnosticBench: true,
      hasEngineStand: true,
      hasTransmissionJack: true,
      hasSpringCompressor: true,
      hasPress: true,
      hasWelder: true,
      hasPartsWasher: true,
      partsStorageCapacity: 500,
      toolStorageCapacity: 100,
      hourlyRate: 55,
      minimumHours: 2,
      requiresBooking: true,
      specialties: ['engine_block', 'engine_head', 'turbocharger', 'fuel_system', 'ignition_system', 'cooling_system', 'oil_system', 'gearbox', 'clutch', 'differential', 'driveshafts', 'steering', 'electrical']
    },
    specialist: {
      type: 'specialist',
      lift: 'alignment',
      hasCompressor: true,
      hasTireMachine: true,
      hasWheelBalancer: true,
      hasBrakeLathe: true,
      hasACMachine: true,
      hasDiagnosticBench: true,
      hasEngineStand: true,
      hasTransmissionJack: true,
      hasSpringCompressor: true,
      hasPress: true,
      hasWelder: true,
      hasPartsWasher: true,
      partsStorageCapacity: 1000,
      toolStorageCapacity: 200,
      hourlyRate: 90,
      minimumHours: 4,
      requiresBooking: true,
      specialties: ['engine_block', 'engine_head', 'turbocharger', 'gearbox', 'differential', 'electrical']
    }
  }

  static readonly GARAGE_TEMPLATES: Record<string, Partial<GarageFacility>> = {
    'backstreet_garage': {
      name: "Dave's Backstreet Motors",
      services: ['mot_test', 'brake_disc_skimming'],
      reputation: 45,
      specialties: ['brakes_front', 'brakes_rear', 'suspension_front', 'suspension_rear', 'exhaust'],
      openingHours: { open: 8, close: 17 },
      isPlayerOwned: false
    },
    'main_dealer': {
      name: 'Main Dealer Service Centre',
      services: ['mot_test', 'wheel_alignment', 'ac_recharge', 'ecu_remap', 'dpf_clean'],
      reputation: 85,
      specialties: ['engine_block', 'engine_head', 'turbocharger', 'fuel_system', 'ignition_system', 'cooling_system', 'oil_system', 'gearbox', 'electrical'],
      openingHours: { open: 7, close: 19 },
      isPlayerOwned: false
    },
    'specialist_tuner': {
      name: 'Velocity Tuning',
      services: ['ecu_remap', 'custom_fabrication', 'performance_tuning', 'engine_rebuild', 'gearbox_rebuild', 'turbo_rebuild'],
      reputation: 70,
      specialties: ['engine_block', 'engine_head', 'turbocharger', 'gearbox', 'differential', 'electrical', 'fuel_system', 'ignition_system'],
      openingHours: { open: 9, close: 18 },
      isPlayerOwned: false
    },
    'classic_specialist': {
      name: 'Heritage Classics',
      services: ['classic_restoration', 'custom_fabrication', 'engine_rebuild', 'gearbox_rebuild'],
      reputation: 90,
      specialties: ['engine_block', 'engine_head', 'gearbox', 'differential', 'steering', 'body_structure'],
      openingHours: { open: 9, close: 17 },
      isPlayerOwned: false
    },
    'quick_fit': {
      name: 'Kwik-Fit Style',
      services: ['mot_test', 'wheel_alignment', 'ac_recharge', 'brake_disc_skimming'],
      reputation: 55,
      specialties: ['brakes_front', 'brakes_rear', 'suspension_front', 'suspension_rear', 'wheels', 'exhaust', 'cooling_system'],
      openingHours: { open: 8, close: 18 },
      isPlayerOwned: false
    }
  }

  static createBay(id: string, type: BayType, position: THREE.Vector3, location: string): RepairBay {
    const preset = this.BAY_PRESETS[type]
    return {
      id,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Bay ${id.slice(-2)}`,
      type,
      location,
      position,
      lift: preset.lift!,
      hasCompressor: preset.hasCompressor!,
      hasTireMachine: preset.hasTireMachine!,
      hasWheelBalancer: preset.hasWheelBalancer!,
      hasBrakeLathe: preset.hasBrakeLathe!,
      hasACMachine: preset.hasACMachine!,
      hasDiagnosticBench: preset.hasDiagnosticBench!,
      hasEngineStand: preset.hasEngineStand!,
      hasTransmissionJack: preset.hasTransmissionJack!,
      hasSpringCompressor: preset.hasSpringCompressor!,
      hasPress: preset.hasPress!,
      hasWelder: preset.hasWelder!,
      hasPartsWasher: preset.hasPartsWasher!,
      partsStorageCapacity: preset.partsStorageCapacity!,
      toolStorageCapacity: preset.toolStorageCapacity!,
      hourlyRate: preset.hourlyRate!,
      minimumHours: preset.minimumHours!,
      requiresBooking: preset.requiresBooking!,
      specialties: preset.specialties!,
      isOccupied: false
    }
  }

  static createGarage(id: string, template: string, position: THREE.Vector3, bayCount = 4): GarageFacility {
    const tpl = this.GARAGE_TEMPLATES[template] || this.GARAGE_TEMPLATES['backstreet_garage']
    const bays: RepairBay[] = []

    // Mix of bay types
    const bayTypes: BayType[] = template === 'main_dealer' ? ['standard', 'standard', 'professional', 'professional'] :
                                template === 'specialist_tuner' ? ['professional', 'professional', 'specialist', 'specialist'] :
                                template === 'classic_specialist' ? ['professional', 'professional', 'specialist', 'basic'] :
                                ['basic', 'standard', 'standard', 'professional']

    for (let i = 0; i < Math.min(bayCount, bayTypes.length); i++) {
      bays.push(this.createBay(`${id}_bay_${i}`, bayTypes[i], new THREE.Vector3(position.x + i * 8, position.y, position.z), id))
    }

    const partsShop = new PartsManager({} as any) // Will be initialized properly

    return {
      id,
      name: tpl.name || 'Garage',
      position,
      bays,
      partsShop,
      toolRental: new Map(),
      services: tpl.services || [],
      reputation: tpl.reputation || 50,
      specialties: tpl.specialties || [],
      openingHours: tpl.openingHours || { open: 8, close: 17 },
      isPlayerOwned: tpl.isPlayerOwned || false
    }
  }
}

// ============================================
// REPAIR BAY MANAGER
// ============================================

export class RepairBayManager {
  private garages: Map<string, GarageFacility> = new Map()
  private currentGarageId: string | null = null
  private currentBayId: string | null = null

  // Player garage
  private playerGarage: PlayerGarage | null = null

  // Callbacks
  onJobStart?: (job: RepairJob) => void
  onJobComplete?: (job: RepairJob) => void
  onJobUpdate?: (job: RepairJob) => void
  onBayStatusChange?: (bay: RepairBay) => void

  constructor() {
    this.generateWorldGarages()
  }

  private generateWorldGarages(): void {
    // Create several garages across the world
    const garages = [
      { id: 'garage_town_center', template: 'backstreet_garage', pos: new THREE.Vector3(200, 0, 150), bays: 3 },
      { id: 'garage_main_dealer', template: 'main_dealer', pos: new THREE.Vector3(-300, 0, 400), bays: 6 },
      { id: 'garage_tuner', template: 'specialist_tuner', pos: new THREE.Vector3(500, 0, -200), bays: 4 },
      { id: 'garage_classic', template: 'classic_specialist', pos: new THREE.Vector3(-450, 0, -350), bays: 3 },
      { id: 'garage_quickfit_north', template: 'quick_fit', pos: new THREE.Vector3(100, 0, 500), bays: 4 },
      { id: 'garage_quickfit_south', template: 'quick_fit', pos: new THREE.Vector3(-150, 0, -400), bays: 3 },
      { id: 'garage_industrial', template: 'backstreet_garage', pos: new THREE.Vector3(600, 0, 300), bays: 5 }
    ]

    for (const g of garages) {
      const garage = RepairBayCatalogue.createGarage(g.id, g.template, g.pos, g.bays)
      this.garages.set(g.id, garage)
    }
  }

  /**
   * Get garage by ID
   */
  getGarage(id: string): GarageFacility | undefined {
    return this.garages.get(id)
  }

  getAllGarages(): GarageFacility[] {
    return Array.from(this.garages.values())
  }

  /**
   * Find nearest garage to position
   */
  findNearestGarage(position: THREE.Vector3): GarageFacility | null {
    let nearest: GarageFacility | null = null
    let nearestDist = Infinity

    for (const garage of this.garages.values()) {
      const dist = position.distanceTo(garage.position)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = garage
      }
    }

    return nearest
  }

  /**
   * Find garage with specialty
   */
  findGarageWithSpecialty(subsystem: SubsystemName): GarageFacility[] {
    return Array.from(this.garages.values()).filter(g =>
      g.specialties.includes(subsystem) || g.bays.some(b => b.specialties.includes(subsystem))
    )
  }

  /**
   * Find available bay at garage
   */
  findAvailableBay(garageId: string, requiredSpecialties: SubsystemName[] = []): RepairBay | null {
    const garage = this.garages.get(garageId)
    if (!garage) return null

    const now = Date.now()
    for (const bay of garage.bays) {
      if (!bay.isOccupied && (!bay.bookedUntil || bay.bookedUntil < now)) {
        if (requiredSpecialties.length === 0 || requiredSpecialties.every(s => bay.specialties.includes(s))) {
          return bay
        }
      }
    }
    return null
  }

  /**
   * Book a bay for player
   */
  bookBay(garageId: string, bayId: string, hours: number, money: number): { success: boolean; newMoney: number; job?: RepairJob } {
    const garage = this.garages.get(garageId)
    if (!garage) return { success: false, newMoney: money }

    const bay = garage.bays.find(b => b.id === bayId)
    if (!bay) return { success: false, newMoney: money }

    if (bay.isOccupied) return { success: false, newMoney: money }
    if (bay.requiresBooking && bay.bookedUntil && bay.bookedUntil > Date.now()) return { success: false, newMoney: money }

    const minHours = bay.minimumHours
    const actualHours = Math.max(hours, minHours)
    const cost = actualHours * bay.hourlyRate

    if (money < cost) return { success: false, newMoney: money }

    const newMoney = money - cost
    bay.isOccupied = true
    bay.bookedUntil = Date.now() + actualHours * 3600 * 1000

    const job: RepairJob = {
      id: `job_${Date.now()}`,
      bayId: bay.id,
      vehicleId: '', // Set when vehicle enters
      tasks: [],
      status: 'pending',
      startedAt: Date.now(),
      estimatedHours: actualHours,
      actualHours: 0,
      quotedPrice: cost,
      finalPrice: cost,
      partsUsed: [],
      labourRate: bay.hourlyRate
    }

    bay.currentJob = job
    this.currentGarageId = garageId
    this.currentBayId = bayId
    this.onBayStatusChange?.(bay)

    return { success: true, newMoney, job }
  }

  /**
   * Start a repair job in booked bay
   */
  startJob(job: RepairJob, vehicleId: string, tasks: RepairTask[]): boolean {
    const bay = this.getBay(job.bayId)
    if (!bay || !bay.isOccupied) return false

    job.vehicleId = vehicleId
    job.tasks = tasks
    job.status = 'in_progress'
    bay.currentJob = job

    this.onJobStart?.(job)
    this.onBayStatusChange?.(bay)
    return true
  }

  /**
   * Update job progress
   */
  updateJobProgress(jobId: string, deltaHours: number, taskProgress: Map<string, { hours: number; quality?: number }>): void {
    // Find job across all bays
    for (const garage of this.garages.values()) {
      for (const bay of garage.bays) {
        if (bay.currentJob && bay.currentJob.id === jobId) {
          const job = bay.currentJob
          job.actualHours += deltaHours

          for (const [taskId, progress] of taskProgress) {
            const task = job.tasks.find(t => t.id === taskId)
            if (task) {
              task.actualHours += progress.hours
              if (progress.quality !== undefined) task.quality = progress.quality
              if (task.actualHours >= task.estimatedHours) task.status = 'complete'
            }
          }

          // Check if all tasks complete
          const allComplete = job.tasks.every(t => t.status === 'complete')
          if (allComplete) {
            job.status = 'testing'
          }

          this.onJobUpdate?.(job)
          this.onBayStatusChange?.(bay)
          return
        }
      }
    }
  }

  /**
   * Complete job
   */
  completeJob(jobId: string): RepairJob | null {
    for (const garage of this.garages.values()) {
      for (const bay of garage.bays) {
        if (bay.currentJob && bay.currentJob.id === jobId) {
          const job = bay.currentJob
          job.status = 'complete'
          job.finalPrice = job.quotedPrice // Add parts cost etc.

          bay.isOccupied = false
          bay.currentJob = undefined
          bay.bookedUntil = undefined

          this.onJobComplete?.(job)
          this.onBayStatusChange?.(bay)

          if (this.currentBayId === bay.id) {
            this.currentBayId = null
            this.currentGarageId = null
          }

          return job
        }
      }
    }
    return null
  }

  /**
   * Abandon job
   */
  abandonJob(jobId: string): void {
    for (const garage of this.garages.values()) {
      for (const bay of garage.bays) {
        if (bay.currentJob && bay.currentJob.id === jobId) {
          bay.currentJob.status = 'abandoned'
          bay.isOccupied = false
          bay.currentJob = undefined
          bay.bookedUntil = undefined
          this.onBayStatusChange?.(bay)
          return
        }
      }
    }
  }

  getBay(bayId: string): RepairBay | undefined {
    for (const garage of this.garages.values()) {
      const bay = garage.bays.find(b => b.id === bayId)
      if (bay) return bay
    }
    return undefined
  }

  getCurrentBay(): RepairBay | null {
    if (!this.currentBayId) return null
    return this.getBay(this.currentBayId) || null
  }

  getCurrentGarage(): GarageFacility | null {
    if (!this.currentGarageId) return null
    return this.garages.get(this.currentGarageId) || null
  }

  /**
   * Player purchases/rent a garage
   */
  purchaseGarage(garageId: string, money: number): { success: boolean; newMoney: number } {
    const garage = this.garages.get(garageId)
    if (!garage || garage.isPlayerOwned) return { success: false, newMoney: money }

    const price = this.calculateGaragePrice(garage)
    if (money < price) return { success: false, newMoney: money }

    garage.isPlayerOwned = true
    this.playerGarage = {
      ...garage,
      ownedBays: garage.bays.map(b => b.id),
      rentedBays: new Map(),
      staff: [],
      monthlyRent: price * 0.02, // 2% per month
      monthlyBills: 500
    }

    return { success: true, newMoney: money - price }
  }

  private calculateGaragePrice(garage: GarageFacility): number {
    let price = 50000 // base
    price += garage.bays.length * 15000
    price += garage.reputation * 1000
    price += garage.services.length * 5000
    return price
  }

  /**
   * Hire staff for player garage
   */
  hireStaff(role: GarageStaff['role'], money: number): { success: boolean; newMoney: number; staff?: GarageStaff } {
    if (!this.playerGarage) return { success: false, newMoney: money }

    const wage = role === 'mechanic' ? 18 : role === 'apprentice' ? 8 : role === 'parts_manager' ? 15 : 12
    const weeklyCost = wage * 40
    if (money < weeklyCost * 4) return { success: false, newMoney: money } // Need 1 month reserve

    const staff: GarageStaff = {
      id: `staff_${Date.now()}`,
      name: this.generateStaffName(),
      role,
      skill: this.generateStaffSkills(role),
      wage,
      efficiency: 0.8 + Math.random() * 0.4,
      morale: 50 + Math.random() * 30,
      maxHoursPerWeek: role === 'apprentice' ? 30 : 48
    }

    this.playerGarage.staff.push(staff)
    return { success: true, newMoney: money, staff }
  }

  private generateStaffName(): string {
    const first = ['Dave', 'Mike', 'Steve', 'Gary', 'Pete', 'Baz', 'Gav', 'Kev', 'Sharon', 'Tracey', 'Karen', 'Debbie']
    const last = ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Evans', 'Wilson', 'Thomas', 'Roberts']
    return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`
  }

  private generateStaffSkills(role: GarageStaff['role']): Record<SubsystemName, number> {
    const skills: Record<SubsystemName, number> = {} as Record<SubsystemName, number>
    const subsystems: SubsystemName[] = [
      'engine_block', 'engine_head', 'turbocharger', 'fuel_system', 'ignition_system',
      'cooling_system', 'oil_system', 'gearbox', 'clutch', 'differential', 'driveshafts',
      'brakes_front', 'brakes_rear', 'suspension_front', 'suspension_rear', 'steering',
      'electrical', 'exhaust', 'body_structure'
    ]

    for (const sub of subsystems) {
      let base = role === 'mechanic' ? 40 : role === 'apprentice' ? 15 : 10
      if (role === 'parts_manager') base = 20
      skills[sub] = Math.max(0, Math.min(100, base + (Math.random() - 0.5) * 30))
    }
    return skills
  }

  /**
   * Get available services at garage
   */
  getAvailableServices(garageId: string): GarageService[] {
    const garage = this.garages.get(garageId)
    return garage?.services || []
  }

  /**
   * Request service at garage (NPC does work)
   */
  requestService(garageId: string, service: GarageService, vehicleId: string, money: number): { success: boolean; newMoney: number; cost: number } {
    const garage = this.garages.get(garageId)
    if (!garage || !garage.services.includes(service)) return { success: false, newMoney: money, cost: 0 }

    const prices: Record<GarageService, number> = {
      mot_test: 54,
      wheel_alignment: 65,
      ac_recharge: 80,
      brake_disc_skimming: 120,
      engine_rebuild: 2500,
      gearbox_rebuild: 1800,
      turbo_rebuild: 900,
      dpf_clean: 150,
      ecu_remap: 350,
      custom_fabrication: 500,
      classic_restoration: 5000,
      performance_tuning: 800
    }

    const cost = Math.round(prices[service] * (1.2 - garage.reputation / 500))
    if (money < cost) return { success: false, newMoney: money, cost }

    return { success: true, newMoney: money - cost, cost }
  }

  serialize(): any {
    return {
      garages: Array.from(this.garages.entries()).map(([id, g]) => ({
        ...g,
        bays: g.bays.map(b => ({ ...b, position: { x: b.position.x, y: b.position.y, z: b.position.z } }))
      })),
      currentGarageId: this.currentGarageId,
      currentBayId: this.currentBayId,
      playerGarage: this.playerGarage ? {
        ...this.playerGarage,
        rentedBays: Array.from(this.playerGarage.rentedBays.entries()),
        bays: this.playerGarage.bays.map(b => ({ ...b, position: { x: b.position.x, y: b.position.y, z: b.position.z } }))
      } : null
    }
  }

  deserialize(data: any): void {
    this.garages.clear()
    for (const [id, g] of data.garages || []) {
      this.garages.set(id, {
        ...g,
        bays: g.bays.map((b: any) => ({ ...b, position: new THREE.Vector3(b.position.x, b.position.y, b.position.z) })),
        partsShop: new PartsManager({} as any) // Re-initialize
      })
    }
    this.currentGarageId = data.currentGarageId
    this.currentBayId = data.currentBayId

    if (data.playerGarage) {
      this.playerGarage = {
        ...data.playerGarage,
        rentedBays: new Map(data.playerGarage.rentedBays || []),
        bays: data.playerGarage.bays.map((b: any) => ({ ...b, position: new THREE.Vector3(b.position.x, b.position.y, b.position.z) }))
      }
    }
  }
}

// ============================================
// REPAIR JOB BOARD (NPC Jobs)
// ============================================

export interface JobBoardEntry {
  id: string
  garageId: string
  customerName: string
  vehicleSpecsId: string
  vehicleCondition: number // 0-100
  tasks: { subsystem: SubsystemName; description: string }[]
  reward: number
  reputationReward: number
  deadline: number // timestamp
  difficulty: 'easy' | 'medium' | 'hard' | 'nightmare'
  postedAt: number
  isTaken: boolean
}

export class JobBoard {
  private entries: Map<string, JobBoardEntry> = new Map()
  private garageManager: RepairBayManager

  constructor(garageManager: RepairBayManager) {
    this.garageManager = garageManager
    this.generateInitialJobs()
  }

  private generateInitialJobs(): void {
    const customerNames = [
      'Arthur Pendelton', 'Beryl Higgins', 'Colin "The Wrench" Wright', 'Doris Maples',
      'Eddie "Leadfoot" Lawson', 'Florence Nightingale', 'Graham Cracker', 'Hilda Ogden',
      'Ian "The Van" Vanstone', 'Janet "Jags" Jackson', 'Kevin "Knackered" Norris', 'Linda Lovelace'
    ]

    const subsystems: SubsystemName[] = [
      'engine_block', 'engine_head', 'turbocharger', 'fuel_system', 'ignition_system',
      'cooling_system', 'oil_system', 'gearbox', 'clutch', 'differential', 'driveshafts',
      'brakes_front', 'brakes_rear', 'suspension_front', 'suspension_rear', 'steering',
      'electrical', 'exhaust'
    ]

    for (let i = 0; i < 20; i++) {
      const garage = this.garageManager.getAllGarages()[Math.floor(Math.random() * this.garageManager.getAllGarages().length)]
      const taskCount = 1 + Math.floor(Math.random() * 3)
      const tasks = []
      for (let t = 0; t < taskCount; t++) {
        const sub = subsystems[Math.floor(Math.random() * subsystems.length)]
        tasks.push({ subsystem: sub, description: this.getTaskDescription(sub) })
      }

      const difficulty = ['easy', 'medium', 'hard', 'nightmare'][Math.floor(Math.random() * 4)] as any
      const baseReward = difficulty === 'easy' ? 80 : difficulty === 'medium' ? 180 : difficulty === 'hard' ? 350 : 600
      const reward = baseReward + Math.floor(Math.random() * 100)

      this.entries.set(`job_${i}`, {
        id: `job_${i}`,
        garageId: garage.id,
        customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
        vehicleSpecsId: ['hatchback', 'sedan', 'van', 'sports'][Math.floor(Math.random() * 4)],
        vehicleCondition: 20 + Math.floor(Math.random() * 60),
        tasks,
        reward,
        reputationReward: difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : difficulty === 'hard' ? 20 : 35,
        deadline: Date.now() + (24 + Math.random() * 72) * 3600 * 1000,
        difficulty,
        postedAt: Date.now(),
        isTaken: false
      })
    }
  }

  private getTaskDescription(sub: SubsystemName): string {
    const desc: Record<SubsystemName, string> = {
      engine_block: 'Bottom end rattle - likely big end bearings',
      engine_head: 'Tappety top end - valve clearances or cam wear',
      turbocharger: 'Whistle on boost, smoke on overrun - turbo seals gone',
      fuel_system: 'Lumpy idle, cuts out - injector or pump',
      ignition_system: 'Misfire under load - coils or plugs',
      cooling_system: 'Overheating in traffic - water pump or thermostat',
      oil_system: 'Low pressure light flickers - pump or pickup',
      gearbox: 'Crunching into 3rd, whine in 4th - synchros or bearings',
      clutch: 'Slipping on hills, high bite - plate or slave cylinder',
      differential: 'Whine on overrun, clunk on power - diff bearings',
      driveshafts: 'Clicking on full lock - CV joints',
      brakes_front: 'Grinding, pedal judder - discs and pads',
      brakes_rear: 'Handbrake won\'t hold, squeal - shoes or cylinders',
      suspension_front: 'Knock over bumps, vague steering - top mounts or arms',
      suspension_rear: 'Clunk from back, uneven tyre wear - bushes or shocks',
      steering: 'Play in wheel, clunk on lock - rack or track rods',
      electrical: 'Random warnings, parasitic drain - wiring or module',
      exhaust: 'Blowing at manifold, failed MOT - flexi or cat',
      body_structure: 'Rot in sills, MOT advisory - welding needed',
      wheels: 'Vibration at speed, uneven tyre wear - bearings or rims',
      radiator_grille: 'Overheating, coolant loss - radiator or fan',
      transmission_mounts: 'Thump on gear change, engine movement - mounts'
    }
    return desc[sub] || 'Needs attention'
  }

  getAvailableJobs(garageId?: string): JobBoardEntry[] {
    const now = Date.now()
    return Array.from(this.entries.values()).filter(j =>
      !j.isTaken && j.deadline > now && (!garageId || j.garageId === garageId)
    )
  }

  takeJob(jobId: string): JobBoardEntry | null {
    const job = this.entries.get(jobId)
    if (!job || job.isTaken) return null
    job.isTaken = true
    return job
  }

  completeJob(jobId: string): { reward: number; reputationReward: number } | null {
    const job = this.entries.get(jobId)
    if (!job || !job.isTaken) return null
    this.entries.delete(jobId)
    return { reward: job.reward, reputationReward: job.reputationReward }
  }

  refreshJobs(): void {
    // Remove expired
    const now = Date.now()
    for (const [id, job] of this.entries) {
      if (job.deadline < now || job.isTaken) {
        this.entries.delete(id)
      }
    }
    // Add new
    this.generateInitialJobs()
  }

  serialize(): any {
    return {
      entries: Array.from(this.entries.entries())
    }
  }

  deserialize(data: any): void {
    this.entries = new Map(data.entries || [])
  }
}