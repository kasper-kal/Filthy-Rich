import * as THREE from 'three';
import type {
  RepairBayManager,
  GarageFacility,
  GarageService,
  RepairBay,
} from '../repair/RepairBay.js';
import { BayType, RepairBayCatalogue } from '../repair/RepairBay.js';
import type { RecoverySystem } from '../vehicle/RecoveryTruck.js';
import type { PartsManager } from '../repair/PartSystem.js';
import { Toolkit } from '../repair/ToolSystem.js';
import { BreakdownSystem } from '../vehicle/BreakdownSystem.js';

/**
 * GarageNetwork - Multiple garages across map with specialties
 * Integrates repair bays, recovery, parts, and player garage ownership
 */

export interface GarageNetworkConfig {
  worldSize: number; // meters
  garageDensity: number; // garages per km²
  playerStartGarage?: string;
}

export interface GarageDiscovery {
  garageId: string;
  discoveredAt: number;
  lastVisited: number;
  timesVisited: number;
  reputationWithPlayer: number; // -100 to 100
  knownServices: GarageService[];
  knownSpecialties: string[];
}

export interface AreaReputation {
  areaId: string;
  reputation: number; // 0-100
  jobsCompleted: number;
  totalEarned: number;
  preferredGarage?: string;
}

export class GarageNetwork {
  private repairBayManager: RepairBayManager;
  private recoverySystem: RecoverySystem;
  private config: GarageNetworkConfig;
  private discoveredGarages = new Map<string, GarageDiscovery>();
  private areaReputations = new Map<string, AreaReputation>();
  private playerGarageId: string | null = null;
  private rng: () => number;

  // Events
  onGarageDiscovered?: (garage: GarageFacility) => void;
  onReputationChange?: (areaId: string, reputation: number) => void;
  onPlayerGaragePurchased?: (garage: GarageFacility) => void;

  constructor(
    repairBayManager: RepairBayManager,
    recoverySystem: RecoverySystem,
    config: GarageNetworkConfig,
    rng: () => number = Math.random
  ) {
    this.repairBayManager = repairBayManager;
    this.recoverySystem = recoverySystem;
    this.config = config;
    this.rng = rng;

    // Discover starting garage
    if (config.playerStartGarage) {
      this.discoverGarage(config.playerStartGarage);
    }
  }

  /**
   * Discover a garage (when player gets close)
   */
  discoverGarage(garageId: string): GarageFacility | null {
    const garage = this.repairBayManager.getGarage(garageId);
    if (!garage) return null;

    if (!this.discoveredGarages.has(garageId)) {
      this.discoveredGarages.set(garageId, {
        garageId,
        discoveredAt: Date.now(),
        lastVisited: 0,
        timesVisited: 0,
        reputationWithPlayer: 0,
        knownServices: [...garage.services],
        knownSpecialties: [...garage.specialties],
      });
      this.onGarageDiscovered?.(garage);
    }

    return garage;
  }

  /**
   * Get garage by ID (creates discovery if not known)
   */
  getGarage(garageId: string): GarageFacility | null {
    const garage = this.repairBayManager.getGarage(garageId);
    return garage ?? null;
  }

  /**
   * Get all discovered garages
   */
  getDiscoveredGarages(): GarageDiscovery[] {
    return Array.from(this.discoveredGarages.values());
  }

  /**
   * Get all garages (for map display)
   */
  getAllGarages(): GarageFacility[] {
    return this.repairBayManager.getAllGarages();
  }

  /**
   * Visit garage (player arrives)
   */
  visitGarage(garageId: string): GarageDiscovery | null {
    const discovery = this.discoveredGarages.get(garageId);
    if (!discovery) {
      this.discoverGarage(garageId);
      return this.discoveredGarages.get(garageId) || null;
    }

    discovery.lastVisited = Date.now();
    discovery.timesVisited++;
    return discovery;
  }

  /**
   * Get discovery info
   */
  getDiscovery(garageId: string): GarageDiscovery | undefined {
    return this.discoveredGarages.get(garageId);
  }

  /**
   * Find nearest garage with specific service
   */
  findNearestGarageWithService(
    position: THREE.Vector3,
    service: GarageService
  ): GarageFacility | null {
    const garages = this.repairBayManager.getAllGarages().filter(g => g.services.includes(service));
    if (garages.length === 0) return null;

    return garages.reduce((nearest, current) => {
      const nearestDist = nearest.position.distanceTo(position);
      const currentDist = current.position.distanceTo(position);
      return currentDist < nearestDist ? current : nearest;
    });
  }

  /**
   * Find nearest garage with specialty
   */
  findNearestSpecialist(position: THREE.Vector3, subsystem: string): GarageFacility | null {
    const garages = this.repairBayManager.findGarageWithSpecialty(subsystem as any);
    if (garages.length === 0) return null;

    return garages.reduce((nearest, current) => {
      const nearestDist = nearest.position.distanceTo(position);
      const currentDist = current.position.distanceTo(position);
      return currentDist < nearestDist ? current : nearest;
    });
  }

  /**
   * Get area ID from position
   */
  getAreaId(position: THREE.Vector3): string {
    const gridSize = 2000; // 2km grid
    const x = Math.floor(position.x / gridSize);
    const z = Math.floor(position.z / gridSize);
    return `area_${x}_${z}`;
  }

  /**
   * Get area reputation
   */
  getAreaReputation(position: THREE.Vector3): AreaReputation {
    const areaId = this.getAreaId(position);
    let rep = this.areaReputations.get(areaId);
    if (!rep) {
      rep = {
        areaId,
        reputation: 0,
        jobsCompleted: 0,
        totalEarned: 0,
      };
      this.areaReputations.set(areaId, rep);
    }
    return rep;
  }

  /**
   * Complete job in area
   */
  completeJobInArea(position: THREE.Vector3, earnings: number, garageId?: string): void {
    const areaId = this.getAreaId(position);
    const rep = this.getAreaReputation(position);
    rep.jobsCompleted++;
    rep.totalEarned += earnings;
    rep.reputation = Math.min(100, rep.reputation + 2);

    if (garageId) {
      rep.preferredGarage = garageId;
      const discovery = this.discoveredGarages.get(garageId);
      if (discovery) {
        discovery.reputationWithPlayer = Math.min(100, discovery.reputationWithPlayer + 5);
      }
    }

    this.onReputationChange?.(areaId, rep.reputation);
  }

  /**
   * Purchase garage for player
   */
  purchaseGarage(
    garageId: string,
    money: number
  ): { success: boolean; newMoney: number; garage?: GarageFacility } {
    const result = this.repairBayManager.purchaseGarage(garageId, money);
    if (result.success) {
      this.playerGarageId = garageId;
      const garage = this.repairBayManager.getGarage(garageId)!;
      this.onPlayerGaragePurchased?.(garage);
    }
    return {
      success: result.success,
      newMoney: result.newMoney,
      garage: result.success ? this.repairBayManager.getGarage(garageId)! : undefined,
    };
  }

  getPlayerGarage(): GarageFacility | null {
    if (!this.playerGarageId) return null;
    return this.repairBayManager.getGarage(this.playerGarageId) || null;
  }

  /**
   * Get player garage as PlayerGarage with staff/bays
   */
  getPlayerGarageData(): any {
    // Access internal player garage data
    const serialized = this.repairBayManager.serialize();
    return serialized.playerGarage;
  }

  /**
   * Hire staff for player garage
   */
  hireStaff(
    role: 'mechanic' | 'apprentice' | 'parts_manager' | 'receptionist',
    money: number
  ): { success: boolean; newMoney: number; staff?: any } {
    return this.repairBayManager.hireStaff(role, money);
  }

  /**
   * Get garage parts shop
   */
  getPartsShop(garageId: string): PartsManager | null {
    const garage = this.repairBayManager.getGarage(garageId);
    return garage?.partsShop || null;
  }

  /**
   * Call recovery through network
   */
  callRecovery(
    vehicleId: string,
    position: THREE.Vector3,
    breakdown: any,
    preferredGarageId?: string,
    money = 0
  ) {
    // If player has preferred garage in area, use that
    if (!preferredGarageId) {
      const areaRep = this.getAreaReputation(position);
      if (areaRep.preferredGarage) {
        preferredGarageId = areaRep.preferredGarage;
      }
    }

    return this.recoverySystem.callRecovery(
      vehicleId,
      position,
      breakdown,
      preferredGarageId,
      money
    );
  }

  /**
   * Update recovery system
   */
  updateRecovery(deltaTime: number, playerPosition?: THREE.Vector3): void {
    this.recoverySystem.update(deltaTime, playerPosition);
  }

  /**
   * Get active recovery request
   */
  getActiveRecovery(vehicleId: string) {
    return this.recoverySystem.getActiveRequest(vehicleId);
  }

  /**
   * Get recovery ETA
   */
  getRecoveryETA(requestId: string): number | undefined {
    return this.recoverySystem.getETA(requestId) ?? undefined;
  }

  /**
   * Cancel recovery
   */
  cancelRecovery(requestId: string): boolean {
    return this.recoverySystem.cancelRequest(requestId);
  }

  /**
   * Get available services at garage
   */
  getAvailableServices(garageId: string): GarageService[] {
    return this.repairBayManager.getAvailableServices(garageId);
  }

  /**
   * Request NPC service at garage
   */
  requestService(garageId: string, service: GarageService, vehicleId: string, money: number) {
    return this.repairBayManager.requestService(garageId, service, vehicleId, money);
  }

  /**
   * Get job board entries for garage
   */
  getJobBoard(garageId: string): any[] {
    // Would integrate with JobBoard from RepairBay.ts
    return [];
  }

  /**
   * Find available bay for player
   */
  findAvailableBay(garageId: string, requiredSpecialties: string[] = []): RepairBay | null {
    return this.repairBayManager.findAvailableBay(garageId, requiredSpecialties as any);
  }

  /**
   * Book bay at garage
   */
  bookBay(garageId: string, bayId: string, hours: number, money: number) {
    return this.repairBayManager.bookBay(garageId, bayId, hours, money);
  }

  /**
   * Start repair job
   */
  startRepairJob(job: any, vehicleId: string, tasks: any[]) {
    return this.repairBayManager.startJob(job, vehicleId, tasks);
  }

  /**
   * Update repair job progress
   */
  updateRepairJob(
    jobId: string,
    deltaHours: number,
    taskProgress: Map<string, { hours: number; quality?: number }>
  ) {
    this.repairBayManager.updateJobProgress(jobId, deltaHours, taskProgress);
  }

  /**
   * Complete repair job
   */
  completeRepairJob(jobId: string) {
    return this.repairBayManager.completeJob(jobId);
  }

  /**
   * Abandon repair job
   */
  abandonRepairJob(jobId: string) {
    this.repairBayManager.abandonJob(jobId);
  }

  /**
   * Get garage reputation with player
   */
  getGarageReputation(garageId: string): number {
    return this.discoveredGarages.get(garageId)?.reputationWithPlayer || 0;
  }

  /**
   * Modify garage reputation (e.g., after good/bad job)
   */
  modifyGarageReputation(garageId: string, delta: number): void {
    const discovery = this.discoveredGarages.get(garageId);
    if (discovery) {
      discovery.reputationWithPlayer = Math.max(
        -100,
        Math.min(100, discovery.reputationWithPlayer + delta)
      );
    }
  }

  /**
   * Get all area reputations
   */
  getAllAreaReputations(): AreaReputation[] {
    return Array.from(this.areaReputations.values());
  }

  /**
   * Get garage network stats for UI
   */
  getNetworkStats(): {
    totalGarages: number;
    discoveredGarages: number;
    playerOwnedGarage: boolean;
    totalAreaReputation: number;
    highestAreaReputation: AreaReputation | null;
  } {
    const areas = Array.from(this.areaReputations.values());
    const highest = areas.reduce(
      (max, a) => (a.reputation > max.reputation ? a : max),
      areas[0] || null
    );

    return {
      totalGarages: this.repairBayManager.getAllGarages().length,
      discoveredGarages: this.discoveredGarages.size,
      playerOwnedGarage: !!this.playerGarageId,
      totalAreaReputation: areas.reduce((sum, a) => sum + a.reputation, 0),
      highestAreaReputation: highest,
    };
  }

  serialize(): any {
    return {
      config: this.config,
      discoveredGarages: Array.from(this.discoveredGarages.entries()),
      areaReputations: Array.from(this.areaReputations.entries()),
      playerGarageId: this.playerGarageId,
      repairBayManager: this.repairBayManager.serialize(),
      recoverySystem: this.recoverySystem.serialize(),
    };
  }

  deserialize(data: any): void {
    this.config = data.config;
    this.discoveredGarages = new Map(data.discoveredGarages || []);
    this.areaReputations = new Map(data.areaReputations || []);
    this.playerGarageId = data.playerGarageId;
    this.repairBayManager.deserialize(data.repairBayManager);
    this.recoverySystem.deserialize(data.recoverySystem);
  }
}

// ============================================
// GARAGE NETWORK GENERATOR
// ============================================

export function generateGarageNetwork(worldSize: number, density: number): GarageFacility[] {
  const garages: GarageFacility[] = [];
  const gridSize = 2000; // 2km spacing
  const templates = [
    'backstreet_garage',
    'main_dealer',
    'specialist_tuner',
    'classic_specialist',
    'quick_fit',
  ];

  for (let x = -worldSize / 2; x < worldSize / 2; x += gridSize) {
    for (let z = -worldSize / 2; z < worldSize / 2; z += gridSize) {
      if (Math.random() > density) continue;

      // Jitter position
      const pos = new THREE.Vector3(
        x + (Math.random() - 0.5) * gridSize * 0.5,
        0,
        z + (Math.random() - 0.5) * gridSize * 0.5
      );

      const template = templates[Math.floor(Math.random() * templates.length)];
      const bayCount = 2 + Math.floor(Math.random() * 4);

      const garage = RepairBayCatalogue.createGarage(`garage_${x}_${z}`, template, pos, bayCount);

      garages.push(garage);
    }
  }

  return garages;
}
