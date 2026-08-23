import * as THREE from 'three'
import { EconomySystem } from './EconomySystem.js'
import { CleaningSystem } from './CleaningSystem.js'
import { SceneManager } from './SceneManager.js'
import { FurnitureManager } from './FurnitureManager.js'
import { WorldStreamer } from '../world/WorldStreamer.js'
import { Vehicle } from '../vehicle/Vehicle.js'
import { VehicleSpecs, VehicleSpecsData } from '../vehicle/VehicleSpecs.js'
import { DamageModel } from '../vehicle/DamageModel.js'
import { BreakdownSystem } from '../vehicle/BreakdownSystem.js'
import { GarageNetwork, GarageDiscovery, AreaReputation } from '../world/GarageNetwork.js'
import { PartsManager } from '../repair/PartSystem.js'
import { Toolkit, ToolCatalogue } from '../repair/ToolSystem.js'
import { RepairBayManager } from '../repair/RepairBay.js'
import { RecoverySystem } from '../vehicle/RecoveryTruck.js'
import { JobSystem, Job } from './JobSystem.js'

// ============================================
// SAVE SCHEMA INTERFACES
// ============================================

export interface SaveData {
  version: number
  worldSeed: number
  player: PlayerSaveData
  vehicle: VehicleSaveData
  world: WorldSaveData
  garage: GarageSaveData
  economy: EconomySaveData
  timestamp: number
}

export interface PlayerSaveData {
  position: { x: number; y: number; z: number }
  state: string
  money: number
  reputation: number
  reputationLevel: number
  xp: number
}

export interface VehicleSaveData {
  specs: VehicleSpecsData
  condition: DamageModelState
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  fuelLevel: number
  odometer: number
  engineRunning: boolean
  breakdownActive: boolean
  breakdownSubsystem?: string
  breakdownSeverity?: string
}

export interface DamageModelState {
  visual: Record<string, any>
  mechanical: Record<string, any>
  totalDistance: number
}

export interface WorldSaveData {
  discoveredHouses: string[]
  completedJobs: JobRecord[]
  areaReputations: AreaReputationData[]
  timeOfDay: number
  weather: string
  activeJobId?: string
  activeJobProgress?: number
}

export interface JobRecord {
  id: string
  title: string
  houseId: string
  clientName: string
  completedAt: number
  score: number
  pay: number
  reputationGained: number
}

export interface AreaReputationData {
  areaId: string
  reputation: number
  jobsCompleted: number
  totalEarned: number
  preferredGarage?: string
}

export interface GarageSaveData {
  ownedGarageId?: string
  inventory: InventoryPartData[]
  tools: ToolInstanceData[]
  staff: StaffMemberData[]
  discoveredGarages: GarageDiscoveryData[]
  repairBayManager: any
  recoverySystem: any
}

export interface InventoryPartData {
  partId: string
  quantity: number
  purchasePrice: number
  purchaseDate: number
  location: string
  condition: string
}

export interface ToolInstanceData {
  id: string
  tool: string
  quality: number
  condition: number
  owned: boolean
}

export interface StaffMemberData {
  id: string
  role: string
  name: string
  skill: number
  wage: number
  hiredAt: number
}

export interface GarageDiscoveryData {
  garageId: string
  discoveredAt: number
  lastVisited: number
  timesVisited: number
  reputationWithPlayer: number
  knownServices: string[]
  knownSpecialties: string[]
}

export interface EconomySaveData {
  budget: number
  ownedFurniture: string[]
  placedFurniture: Array<{ id: string; position: { x: number; y: number; z: number }; rotation: number }>
}

export const SAVE_VERSION = 2
const STORAGE_KEY = 'filthy-rich-save'

// ============================================
// SAVE SYSTEM CLASS
// ============================================

export class SaveSystem {
  private economySystem: EconomySystem
  private cleaningSystem: CleaningSystem
  private sceneManager: SceneManager
  private furnitureManager: FurnitureManager
  private worldStreamer: WorldStreamer
  private vehicle: Vehicle
  private damageModel: DamageModel
  private breakdownSystem: BreakdownSystem
  private garageNetwork: GarageNetwork
  private partsManager: PartsManager
  private toolkit: Toolkit
  private repairBayManager: RepairBayManager
  private recoverySystem: RecoverySystem
  private jobSystem: JobSystem

  constructor(
    economySystem: EconomySystem,
    cleaningSystem: CleaningSystem,
    sceneManager: SceneManager,
    furnitureManager: FurnitureManager,
    worldStreamer: WorldStreamer,
    vehicle: Vehicle,
    damageModel: DamageModel,
    breakdownSystem: BreakdownSystem,
    garageNetwork: GarageNetwork,
    partsManager: PartsManager,
    toolkit: Toolkit,
    repairBayManager: RepairBayManager,
    recoverySystem: RecoverySystem,
    jobSystem: JobSystem
  ) {
    this.economySystem = economySystem
    this.cleaningSystem = cleaningSystem
    this.sceneManager = sceneManager
    this.furnitureManager = furnitureManager
    this.worldStreamer = worldStreamer
    this.vehicle = vehicle
    this.damageModel = damageModel
    this.breakdownSystem = breakdownSystem
    this.garageNetwork = garageNetwork
    this.partsManager = partsManager
    this.toolkit = toolkit
    this.repairBayManager = repairBayManager
    this.recoverySystem = recoverySystem
    this.jobSystem = jobSystem
  }

  /**
   * Load game from localStorage
   */
  async load(): Promise<void> {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) {
        console.log('[SaveSystem] No save data found, starting fresh')
        return
      }

      const saveData: SaveData = JSON.parse(data)

      // Version migration
      if (saveData.version < SAVE_VERSION) {
        console.log('[SaveSystem] Migrating save from version', saveData.version, 'to', SAVE_VERSION)
        this.migrateSave(saveData)
      }

      // Restore world seed first (affects procedural generation)
      if (saveData.worldSeed) {
        this.worldStreamer.deserialize({ worldSeed: saveData.worldSeed })
      }

      // Restore player
      this.restorePlayer(saveData.player)

      // Restore vehicle
      this.restoreVehicle(saveData.vehicle)

      // Restore world state
      this.restoreWorld(saveData.world)

      // Restore garage
      this.restoreGarage(saveData.garage)

      // Restore economy
      this.restoreEconomy(saveData.economy)

      console.log('[SaveSystem] Game loaded successfully')
    } catch (e) {
      console.warn('[SaveSystem] Failed to load save:', e)
    }
  }

  /**
   * Save game to localStorage
   */
  save(): void {
    try {
      const saveData: SaveData = {
        version: SAVE_VERSION,
        worldSeed: this.worldStreamer.getWorldSeed(),
        player: this.serializePlayer(),
        vehicle: this.serializeVehicle(),
        world: this.serializeWorld(),
        garage: this.serializeGarage(),
        economy: this.serializeEconomy(),
        timestamp: Date.now()
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData))
      console.log('[SaveSystem] Game saved')
    } catch (e) {
      console.warn('[SaveSystem] Failed to save:', e)
    }
  }

  /**
   * Export save as JSON string (for backup/sharing)
   */
  exportSave(): string {
    const saveData: SaveData = {
      version: SAVE_VERSION,
      worldSeed: this.worldStreamer.getWorldSeed(),
      player: this.serializePlayer(),
      vehicle: this.serializeVehicle(),
      world: this.serializeWorld(),
      garage: this.serializeGarage(),
      economy: this.serializeEconomy(),
      timestamp: Date.now()
    }
    return JSON.stringify(saveData, null, 2)
  }

  /**
   * Import save from JSON string
   */
  importSave(json: string): boolean {
    try {
      const saveData: SaveData = JSON.parse(json)

      if (saveData.version < SAVE_VERSION) {
        this.migrateSave(saveData)
      }

      // Apply the save
      if (saveData.worldSeed) {
        this.worldStreamer.deserialize({ worldSeed: saveData.worldSeed })
      }
      this.restorePlayer(saveData.player)
      this.restoreVehicle(saveData.vehicle)
      this.restoreWorld(saveData.world)
      this.restoreGarage(saveData.garage)
      this.restoreEconomy(saveData.economy)

      console.log('[SaveSystem] Save imported successfully')
      return true
    } catch (e) {
      console.warn('[SaveSystem] Failed to import save:', e)
      return false
    }
  }

  /**
   * Reset game to initial state
   */
  reset(): void {
    this.economySystem.reset()
    this.cleaningSystem.reset()
    this.furnitureManager.clearAll()
    localStorage.removeItem(STORAGE_KEY)
    console.log('[SaveSystem] Game reset')
  }

  // ============================================
  // SERIALIZATION METHODS
  // ============================================

  private serializePlayer(): PlayerSaveData {
    const cameraPos = this.sceneManager.getCameraPosition()
    const jobSystem = this.jobSystem
    const reputationData = jobSystem.getReputation()

    return {
      position: { x: cameraPos.x, y: cameraPos.y, z: cameraPos.z },
      state: 'ON_FOOT', // Could be enhanced to save actual state
      money: this.economySystem.budget,
      reputation: reputationData.current,
      reputationLevel: reputationData.level,
      xp: reputationData.current // XP is equivalent to total reputation earned
    }
  }

  private serializeVehicle(): VehicleSaveData {
    const vehicleState = this.vehicle.getState()
    const damageState = this.damageModel.serialize()
    const breakdown = this.breakdownSystem.getActiveBreakdown(this.vehicle.id)

    return {
      specs: this.vehicle.specs,
      condition: damageState,
      position: { x: vehicleState.position.x, y: vehicleState.position.y, z: vehicleState.position.z },
      rotation: { x: vehicleState.rotation.x, y: vehicleState.rotation.y, z: vehicleState.rotation.z, w: 1 },
      fuelLevel: vehicleState.fuelLevel,
      odometer: vehicleState.odometer,
      engineRunning: vehicleState.engineRunning,
      breakdownActive: !!breakdown,
      breakdownSubsystem: breakdown?.subsystem,
      breakdownSeverity: breakdown?.severity
    }
  }

  private serializeWorld(): WorldSaveData {
    // Get discovered houses from world streamer
    const discoveredHouses: string[] = []
    const loadedHouses = this.worldStreamer['loadedHouses'] // private access
    if (loadedHouses) {
      for (const house of loadedHouses.values()) {
        discoveredHouses.push(house.id)
      }
    }

    // Get completed jobs from job system
    const completedJobs: JobRecord[] = []
    // This would need to be tracked in JobSystem
    const jobHistory = (this.jobSystem as any).completedJobs || []
    for (const job of jobHistory) {
      completedJobs.push({
        id: job.id,
        title: job.title,
        houseId: job.houseId,
        clientName: job.clientName,
        completedAt: job.completedAt || Date.now(),
        score: job.finalScore || 0,
        pay: job.finalPay || 0,
        reputationGained: job.reputationGained || 0
      })
    }

    // Get area reputations from garage network
    const areaReputations: AreaReputationData[] = []
    for (const rep of this.garageNetwork.getAllAreaReputations()) {
      areaReputations.push({
        areaId: rep.areaId,
        reputation: rep.reputation,
        jobsCompleted: rep.jobsCompleted,
        totalEarned: rep.totalEarned,
        preferredGarage: rep.preferredGarage
      })
    }

    return {
      discoveredHouses,
      completedJobs,
      areaReputations,
      timeOfDay: this.worldStreamer.getTimeOfDay(),
      weather: this.worldStreamer.getWeather(),
      activeJobId: this.jobSystem.getActiveJob()?.id,
      activeJobProgress: this.jobSystem.getActiveJob() ? this.cleaningSystem.getDecalSystem().getProgress().percent : 0
    }
  }

  private serializeGarage(): GarageSaveData {
    const partsManagerData = this.partsManager.serialize()
    const toolkitData = this.toolkit.serialize()
    const repairBayData = this.repairBayManager.serialize()
    const recoveryData = this.recoverySystem.serialize()

    // Convert inventory parts
    const inventory: InventoryPartData[] = []
    for (const [, invPart] of (partsManagerData.inventory?.parts || [])) {
      inventory.push({
        partId: invPart.part.id,
        quantity: invPart.quantity,
        purchasePrice: invPart.purchasePrice,
        purchaseDate: invPart.purchaseDate,
        location: invPart.location,
        condition: invPart.part.condition
      })
    }

    // Convert tools
    const tools: ToolInstanceData[] = []
    for (const toolInstance of toolkitData.tools || []) {
      tools.push({
        id: toolInstance.id,
        tool: toolInstance.tool,
        quality: toolInstance.quality,
        condition: toolInstance.condition,
        owned: toolInstance.owned
      })
    }

    // Convert staff
    const staff: StaffMemberData[] = []
    for (const staffMember of toolkitData.staff || []) {
      staff.push({
        id: staffMember.id,
        role: staffMember.role,
        name: staffMember.name,
        skill: staffMember.skill,
        wage: staffMember.wage,
        hiredAt: staffMember.hiredAt
      })
    }

    // Convert discovered garages
    const discoveredGarages: GarageDiscoveryData[] = []
    for (const [, discovery] of (repairBayData.discoveredGarages || [])) {
      discoveredGarages.push({
        garageId: discovery.garageId,
        discoveredAt: discovery.discoveredAt,
        lastVisited: discovery.lastVisited,
        timesVisited: discovery.timesVisited,
        reputationWithPlayer: discovery.reputationWithPlayer,
        knownServices: discovery.knownServices,
        knownSpecialties: discovery.knownSpecialties
      })
    }

    return {
      ownedGarageId: this.garageNetwork.getPlayerGarage()?.id,
      inventory,
      tools,
      staff,
      discoveredGarages,
      repairBayManager: repairBayData,
      recoverySystem: recoveryData
    }
  }

  private serializeEconomy(): EconomySaveData {
    return {
      budget: this.economySystem.budget,
      ownedFurniture: this.economySystem.ownedFurniture,
      placedFurniture: this.economySystem.placedFurniture
    }
  }

  // ============================================
  // DESERIALIZATION METHODS
  // ============================================

  private restorePlayer(data: PlayerSaveData): void {
    if (data.position) {
      this.sceneManager.camera.position.set(data.position.x, data.position.y, data.position.z)
    }
    this.economySystem.budget = data.money || 0
    // Reputation/XP would be restored via job system if it has setters
  }

  private restoreVehicle(data: VehicleSaveData): void {
    // Restore vehicle specs (create new vehicle if needed)
    if (data.specs) {
      // Vehicle specs are already set in constructor
      // Just update the dynamic state
    }

    // Restore position and rotation
    if (data.position) {
      const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z)
      const rot = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w)
      )
      this.vehicle.setPosition(pos, rot)
    }

    // Restore fuel and odometer
    this.vehicle['fuelLevel'] = data.fuelLevel || 1
    this.vehicle['odometer'] = data.odometer || 0
    this.vehicle.setEngineRunning(data.engineRunning || false)

    // Restore damage model
    if (data.condition) {
      this.damageModel.deserialize(data.condition)
    }

    // Restore breakdown state
    if (data.breakdownActive && data.breakdownSubsystem) {
      this.breakdownSystem.restoreBreakdown(this.vehicle.id, {
        subsystem: data.breakdownSubsystem,
        severity: data.breakdownSeverity as 'minor' | 'major' | 'critical'
      })
    }
  }

  private restoreWorld(data: WorldSaveData): void {
    // Restore time of day and weather
    if (data.timeOfDay !== undefined) {
      this.worldStreamer.deserialize({ timeOfDay: data.timeOfDay })
    }
    if (data.weather) {
      this.worldStreamer.deserialize({ weather: data.weather })
    }

    // Restore area reputations
    for (const rep of data.areaReputations || []) {
      // This would require a method on GarageNetwork to set area reputation
      // this.garageNetwork.setAreaReputation(rep.areaId, rep)
    }

    // Active job restoration would be handled by job system
    if (data.activeJobId) {
      // this.jobSystem.resumeJob(data.activeJobId, data.activeJobProgress)
    }
  }

  private restoreGarage(data: GarageSaveData): void {
    // Restore parts manager inventory
    if (data.inventory) {
      const partsData = {
        money: this.partsManager.getMoney(),
        inventory: {
          parts: data.inventory.map(p => [p.partId, {
            part: { id: p.partId, condition: p.condition as any },
            quantity: p.quantity,
            purchasePrice: p.purchasePrice,
            purchaseDate: p.purchaseDate,
            location: p.location
          }]),
          maxWeight: 50,
          currentWeight: 0,
          storageLocations: new Map([
            ['garage', []],
            ['van', []],
            ['mobile_toolbox', []]
          ])
        }
      }
      this.partsManager.deserialize(partsData)
    }

    // Restore tools
    if (data.tools) {
      const toolkitData = {
        tools: data.tools.map(t => ({
          id: t.id,
          tool: t.tool,
          quality: t.quality,
          condition: t.condition,
          owned: t.owned
        })),
        staff: data.staff.map(s => ({
          id: s.id,
          role: s.role,
          name: s.name,
          skill: s.skill,
          wage: s.wage,
          hiredAt: s.hiredAt
        }))
      }
      this.toolkit.deserialize(toolkitData)
    }

    // Restore garage network (repair bays, discovered garages, recovery)
    if (data.repairBayManager) {
      this.repairBayManager.deserialize(data.repairBayManager)
    }
    if (data.recoverySystem) {
      this.recoverySystem.deserialize(data.recoverySystem)
    }

    // Restore owned garage
    if (data.ownedGarageId) {
      this.garageNetwork['playerGarageId'] = data.ownedGarageId
    }
  }

  private restoreEconomy(data: EconomySaveData): void {
    this.economySystem.budget = data.budget || 0
    this.economySystem.ownedFurniture = data.ownedFurniture || []
    this.economySystem.placedFurniture = data.placedFurniture || []

    // Re-place furniture in scene
    for (const placed of this.economySystem.placedFurniture) {
      const item = this.economySystem.getCatalog().find(f => f.id === placed.id)
      if (item) {
        this.furnitureManager.placeSavedFurniture(item.id, placed.position, placed.rotation)
      }
    }
  }

  // ============================================
  // SAVE MIGRATION
  // ============================================

  private migrateSave(saveData: any): void {
    // Migration from version 1 to 2
    if (saveData.version === 1) {
      // Add new fields with defaults
      saveData.worldSeed = saveData.worldSeed || 12345
      saveData.vehicle = saveData.vehicle || {
        specs: VehicleSpecs.getPreset('hatchback'),
        condition: { visual: {}, mechanical: {}, totalDistance: 0 },
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        fuelLevel: 1,
        odometer: 0,
        engineRunning: false,
        breakdownActive: false
      }
      saveData.world = saveData.world || {
        discoveredHouses: [],
        completedJobs: [],
        areaReputations: [],
        timeOfDay: 0.5,
        weather: 'clear'
      }
      saveData.garage = saveData.garage || {
        ownedGarageId: undefined,
        inventory: [],
        tools: [],
        staff: [],
        discoveredGarages: [],
        repairBayManager: {},
        recoverySystem: {}
      }
      saveData.economy = saveData.economy || {
        budget: saveData.economy?.budget || 0,
        ownedFurniture: saveData.economy?.ownedFurniture || [],
        placedFurniture: saveData.economy?.placedFurniture || []
      }
      saveData.version = 2
    }
  }
}