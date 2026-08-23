import * as THREE from 'three';
import type { SubsystemName, DamageModel } from '../vehicle/DamageModel.js';

/**
 * BreakdownSystem - Random failures based on condition/maintenance
 * Roadside vs garage breakdown contexts
 */

export interface BreakdownEvent {
  id: string;
  vehicleId: string;
  timestamp: number;
  position: THREE.Vector3;
  severity: 'minor' | 'major' | 'critical';
  subsystem: SubsystemName;
  cause: BreakdownCause;
  isRoadside: boolean;
  recoveryRequired: boolean;
  description: string;
  symptoms: string[];
  warningLights: string[];
  canDrive: boolean;
  mobileRepairPossible: boolean;
  estimatedRepairTime: number; // minutes
  repairCost: number;
  narrated: boolean;
}

export type BreakdownCause =
  | 'wear' // accumulated wear over time
  | 'neglect' // missed servicing
  | 'over_rev' // redlining
  | 'overheat' // cooling failure
  | 'impact' // damage from crash
  | 'fuel_starvation' // ran out of fuel / pump failure
  | 'electrical' // alternator/battery
  | 'manufacturing' // random failure (bad luck)
  | 'abuse'; // driving style

export interface VehicleMaintenanceState {
  vehicleId: string;
  mileage: number;
  lastService: number; // mileage at last service
  serviceInterval: number;
  nextServiceDue: number;
  averageLoad: number; // 0-1 historical
  abuseScore: number; // 0-100 accumulated abuse
  maintenanceScore: number; // 0-100 how well maintained
  fuelLevel: number; // 0-1
  fuelCapacity: number;
  lastOilChange: number;
  lastTimingBelt: number;
  lastCambeltInterval: number;
  breakdownsHistory: string[];
}

// ============================================
// BREAKDOWN HAZARD TABLE
// ============================================

interface BreakdownHazard {
  subsystem: SubsystemName;
  baseProbability: number; // per hour of driving at health 0
  triggerConditions: (state: VehicleMaintenanceState, damage: DamageModel) => boolean;
  severity: BreakdownEvent['severity'];
  canDrive: boolean;
  mobileRepair: boolean;
  estimatedTime: number;
  description: (level: number) => string;
  symptoms: string[];
  warningLights: string[];
  recoveryRequired: boolean;
}

export class BreakdownSystem {
  private vehicleState = new Map<string, VehicleMaintenanceState>();
  private activeBreakdowns = new Map<string, BreakdownEvent>();
  private hazards: BreakdownHazard[] = [];
  private rng: () => number;

  // Configuration
  private difficultyMultiplier = 1.0; // 0.5 easy -> 2.0 hard
  private maintenanceStrictness = 1.0; // how much neglect matters

  // Events
  onBreakdown?: (event: BreakdownEvent) => void;
  onWarning?: (
    vehicleId: string,
    subsystem: SubsystemName,
    severity: string,
    message: string
  ) => void;
  onFuelLow?: (vehicleId: string, fuelFraction: number) => void;
  onRoadsideRepairComplete?: (event: BreakdownEvent) => void;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.populateHazards();
  }

  private populateHazards(): void {
    this.hazards = [
      {
        subsystem: 'fuel_system',
        baseProbability: 0.02,
        triggerConditions: state => state.fuelLevel < 0.02,
        severity: 'major',
        canDrive: false,
        mobileRepair: true,
        estimatedTime: 5,
        description: l =>
          l < 0.05 ? "Tank's dry. Proper dry." : "Fuel pump's packed up, no pressure.",
        symptoms: ['Engine splutters', 'Power loss', 'Stalls'],
        warningLights: ['FUEL'],
        recoveryRequired: false,
      },
      {
        subsystem: 'electrical',
        baseProbability: 0.015,
        triggerConditions: (state, damage) => {
          const sub = damage.getSubsystemDamage('electrical');
          return !!sub && sub.health < 30;
        },
        severity: 'major',
        canDrive: true,
        mobileRepair: true,
        estimatedTime: 15,
        description: l =>
          l < 0.3
            ? "Alternator's given up, battery's flat, you're on borrowed time."
            : "Battery's knackered, won't hold charge.",
        symptoms: ['Warning lights flicker', 'Dim headlights', "Won't restart when warm"],
        warningLights: ['BATTERY', 'CHECK ENGINE'],
        recoveryRequired: false,
      },
      {
        subsystem: 'cooling_system',
        baseProbability: 0.03,
        triggerConditions: (state, damage) => {
          const sub = damage.getSubsystemDamage('cooling_system');
          return !!sub && sub.health < 35;
        },
        severity: 'critical',
        canDrive: false,
        mobileRepair: false,
        estimatedTime: 60,
        description: l =>
          l < 0.2
            ? "Head gasket's gone, coolant's mixing with oil. Game over until fixed."
            : "Water pump's seized, coolant's pissing out.",
        symptoms: ['Steam from bonnet', 'Temperature gauge red', 'Mayonnaise in oil cap'],
        warningLights: ['TEMP', 'OIL'],
        recoveryRequired: true,
      },
      {
        subsystem: 'engine_block',
        baseProbability: 0.02,
        triggerConditions: (state, damage) => {
          const sub = damage.getSubsystemDamage('engine_block');
          return !!sub && sub.health < 25;
        },
        severity: 'critical',
        canDrive: false,
        mobileRepair: false,
        estimatedTime: 120,
        description: l =>
          l < 0.15
            ? "Big end's gone. Rod through the block. That's a new engine, sunshine."
            : "Bearing's knocking, oil pressure's dropped.",
        symptoms: ['Loud metallic knock', 'Oil pressure light', 'Loss of power'],
        warningLights: ['OIL', 'CHECK ENGINE'],
        recoveryRequired: true,
      },
      {
        subsystem: 'clutch',
        baseProbability: 0.025,
        triggerConditions: (state, damage) => {
          const sub = damage.getSubsystemDamage('clutch');
          return !!sub && sub.health < 20;
        },
        severity: 'major',
        canDrive: true,
        mobileRepair: false,
        estimatedTime: 90,
        description: l =>
          l < 0.1
            ? "Clutch has disintegrated. Pedal's to the floor."
            : 'Clutch is slipping badly, burning smell.',
        symptoms: ['Rev but no go', 'Burning smell', 'Grinding'],
        warningLights: [],
        recoveryRequired: true,
      },
      {
        subsystem: 'gearbox',
        baseProbability: 0.018,
        triggerConditions: (state, damage) => {
          const sub = damage.getSubsystemDamage('gearbox');
          return !!sub && sub.health < 22;
        },
        severity: 'major',
        canDrive: true,
        mobileRepair: false,
        estimatedTime: 100,
        description: l =>
          l < 0.15
            ? "Selector fork's snapped, stuck in neutral."
            : "Synchros gone, won't go into gear.",
        symptoms: ["Won't engage gear", 'Grinding', 'Whining'],
        warningLights: [],
        recoveryRequired: true,
      },
      {
        subsystem: 'turbocharger',
        baseProbability: 0.02,
        triggerConditions: (state, damage) => {
          const sub = damage.getSubsystemDamage('turbocharger');
          return !!sub && sub.health < 30;
        },
        severity: 'major',
        canDrive: true,
        mobileRepair: false,
        estimatedTime: 75,
        description: l =>
          l < 0.2 ? "Turbo's grenaded, oil smoke everywhere." : 'Turbo seals gone, boost leak.',
        symptoms: ['Blue smoke', 'No boost', 'Whistle'],
        warningLights: ['CHECK ENGINE'],
        recoveryRequired: true,
      },
      {
        subsystem: 'brakes_front',
        baseProbability: 0.012,
        triggerConditions: (state, damage) => {
          const sub = damage.getSubsystemDamage('brakes_front');
          return !!sub && sub.health < 15;
        },
        severity: 'critical',
        canDrive: true,
        mobileRepair: true,
        estimatedTime: 30,
        description: l =>
          l < 0.1 ? 'Brake hose has burst. No stopping power.' : "Pad's worn to metal, grinding.",
        symptoms: ['Long pedal', 'Grinding', 'Pulls left'],
        warningLights: ['BRAKE'],
        recoveryRequired: false,
      },
      {
        subsystem: 'suspension_front',
        baseProbability: 0.015,
        triggerConditions: (state, damage) => {
          const sub = damage.getSubsystemDamage('suspension_front');
          return !!sub && sub.health < 18;
        },
        severity: 'major',
        canDrive: true,
        mobileRepair: true,
        estimatedTime: 45,
        description: l =>
          l < 0.1 ? "Spring's snapped. Car's on its arse." : 'Wishbone bush has torn.',
        symptoms: ['Knocking', 'Sits low', 'Wandering'],
        warningLights: [],
        recoveryRequired: false,
      },
      {
        subsystem: 'steering',
        baseProbability: 0.01,
        triggerConditions: (state, damage) => {
          const sub = damage.getSubsystemDamage('steering');
          return !!sub && sub.health < 20;
        },
        severity: 'critical',
        canDrive: true,
        mobileRepair: true,
        estimatedTime: 40,
        description: l =>
          l < 0.1 ? "Track rod's separated. No steering on that wheel." : "Rack's leaking, vague.",
        symptoms: ["Won't steer", 'Knock', 'Vague'],
        warningLights: ['STEERING'],
        recoveryRequired: true,
      },
      {
        subsystem: 'exhaust',
        baseProbability: 0.02,
        triggerConditions: (state, damage) => {
          const sub = damage.getSubsystemDamage('exhaust');
          return !!sub && sub.health < 10;
        },
        severity: 'minor',
        canDrive: true,
        mobileRepair: true,
        estimatedTime: 20,
        description: l =>
          l < 0.05 ? "Catalytic converter's fallen off." : 'Blowing at the manifold.',
        symptoms: ['Loud bang', 'Rasp', 'Smell'],
        warningLights: ['CHECK ENGINE'],
        recoveryRequired: false,
      },
      {
        subsystem: 'differential',
        baseProbability: 0.012,
        triggerConditions: (state, damage) => {
          const sub = damage.getSubsystemDamage('differential');
          return !!sub && sub.health < 25;
        },
        severity: 'major',
        canDrive: true,
        mobileRepair: false,
        estimatedTime: 85,
        description: l =>
          l < 0.15 ? "Diff has seized. Wheel's locked." : 'Diff bearings whining.',
        symptoms: ['Clunk', 'Whine', 'Vibration'],
        warningLights: [],
        recoveryRequired: true,
      },
    ];
  }

  /**
   * Register a vehicle in the breakdown system
   */
  registerVehicle(
    vehicleId: string,
    specs: { fuelCapacity: number; serviceInterval: number }
  ): void {
    this.vehicleState.set(vehicleId, {
      vehicleId,
      mileage: 0,
      lastService: 0,
      serviceInterval: specs.serviceInterval,
      nextServiceDue: specs.serviceInterval,
      averageLoad: 0.5,
      abuseScore: 0,
      maintenanceScore: 100,
      fuelLevel: 1,
      fuelCapacity: specs.fuelCapacity,
      lastOilChange: 0,
      lastTimingBelt: 0,
      lastCambeltInterval: 60000,
      breakdownsHistory: [],
    });
  }

  /**
   * Update breakdown probabilities per frame
   */
  update(
    vehicleId: string,
    deltaTime: number, // seconds
    speed: number,
    load: number, // 0-1
    damage: DamageModel,
    isRoadside: boolean
  ): void {
    const state = this.vehicleState.get(vehicleId);
    if (!state || this.activeBreakdowns.has(vehicleId)) return;

    // Update fuel
    const fuelUsed = ((speed * deltaTime) / 3600) * 0.08; // L per km roughly
    state.fuelLevel = Math.max(0, state.fuelLevel - fuelUsed / state.fuelCapacity);
    if (state.fuelLevel < 0.15 && !isRoadside) {
      this.onFuelLow?.(vehicleId, state.fuelLevel);
    }

    // Update mileage
    state.mileage += (speed * deltaTime) / 3600;
    state.averageLoad = state.averageLoad * 0.99 + load * 0.01;

    // Check service due
    if (state.mileage >= state.nextServiceDue) {
      this.onWarning?.(
        vehicleId,
        'engine_block',
        'service',
        `Service overdue by ${Math.floor(state.mileage - state.nextServiceDue)} miles`
      );
    }

    // Check each hazard
    for (const hazard of this.hazards) {
      // Get subsystem health
      const subDamage = damage.getSubsystemDamage(hazard.subsystem);
      const health = subDamage ? subDamage.health / 100 : 1;

      if (!hazard.triggerConditions(state, damage)) continue;

      // Probability per hour, scaled by (1 - health) and difficulty
      const hoursDriven = deltaTime / 3600;
      const failureChance =
        hazard.baseProbability *
        (1 - health) *
        this.difficultyMultiplier *
        (1 + state.abuseScore / 200) *
        (1 + (1 - state.maintenanceScore / 100) * this.maintenanceStrictness);

      const probabilityThisFrame = 1 - Math.pow(1 - failureChance, hoursDriven);

      if (this.rng() < probabilityThisFrame) {
        this.triggerBreakdown(vehicleId, hazard, health, isRoadside);
        break;
      }
    }

    // Random manufacturing fault (very rare)
    if (this.rng() < 0.0000005 * deltaTime) {
      const randomHazard = this.hazards[Math.floor(this.rng() * this.hazards.length)];
      this.triggerBreakdown(vehicleId, randomHazard, 1, isRoadside, 'manufacturing');
    }
  }

  private triggerBreakdown(
    vehicleId: string,
    hazard: BreakdownHazard,
    health: number,
    isRoadside: boolean,
    cause: BreakdownCause = 'wear'
  ): void {
    const event: BreakdownEvent = {
      id: `bd_${Date.now()}_${vehicleId}`,
      vehicleId,
      timestamp: Date.now(),
      position: new THREE.Vector3(),
      severity: hazard.severity,
      subsystem: hazard.subsystem,
      cause,
      isRoadside,
      recoveryRequired: hazard.recoveryRequired,
      description: hazard.description(health),
      symptoms: hazard.symptoms,
      warningLights: hazard.warningLights,
      canDrive: hazard.canDrive,
      mobileRepairPossible: hazard.mobileRepair,
      estimatedRepairTime: hazard.estimatedTime,
      repairCost: Math.round(
        hazard.estimatedTime * (hazard.recoveryRequired ? 1.5 : 0.8) * (1 + (1 - health))
      ),
      narrated: false,
    };

    this.activeBreakdowns.set(vehicleId, event);
    this.onBreakdown?.(event);
  }

  /**
   * Attempt roadside repair (player has tools/parts)
   */
  attemptRoadsideRepair(
    vehicleId: string,
    availableTime: number,
    hasParts: boolean,
    hasTools: boolean
  ): { success: boolean; timeUsed: number } {
    const event = this.activeBreakdowns.get(vehicleId);
    if (!event) return { success: false, timeUsed: 0 };

    if (!event.mobileRepairPossible) {
      return { success: false, timeUsed: 0 };
    }

    if (!hasTools) {
      return { success: false, timeUsed: 0 };
    }

    if (!hasParts && event.severity !== 'minor') {
      // Might manage with temporary fix
      const tempFix = this.rng() < 0.3;
      if (!tempFix) return { success: false, timeUsed: 0 };
    }

    const timeUsed = Math.min(availableTime, event.estimatedRepairTime);
    const success = timeUsed >= event.estimatedRepairTime * 0.8;

    return { success, timeUsed };
  }

  /**
   * Resolve breakdown (after repair)
   */
  resolveBreakdown(vehicleId: string, repairedBy: 'player' | 'garage' | 'recovery'): void {
    const event = this.activeBreakdowns.get(vehicleId);
    if (!event) return;

    event.narrated = true;
    this.activeBreakdowns.delete(vehicleId);

    const state = this.vehicleState.get(vehicleId);
    if (state) {
      state.breakdownsHistory.push(event.id);
      if (repairedBy === 'player') {
        state.maintenanceScore = Math.min(100, state.maintenanceScore + 5);
      }
    }

    if (repairedBy === 'player') {
      this.onRoadsideRepairComplete?.(event);
    }
  }

  /**
   * Get active breakdown
   */
  getActiveBreakdown(vehicleId: string): BreakdownEvent | undefined {
    return this.activeBreakdowns.get(vehicleId);
  }

  /**
   * Add service record
   */
  serviceVehicle(vehicleId: string): void {
    const state = this.vehicleState.get(vehicleId);
    if (!state) return;
    state.lastService = state.mileage;
    state.nextServiceDue = state.mileage + state.serviceInterval;
    state.maintenanceScore = Math.min(100, state.maintenanceScore + 15);
    state.abuseScore = Math.max(0, state.abuseScore - 10);
  }

  /**
   * Record abuse event
   */
  recordAbuse(vehicleId: string, amount: number): void {
    const state = this.vehicleState.get(vehicleId);
    if (state) {
      state.abuseScore = Math.min(100, state.abuseScore + amount);
      state.maintenanceScore = Math.max(0, state.maintenanceScore - amount * 0.5);
    }
  }

  /**
   * Refuel
   */
  refuel(vehicleId: string, amount: number): void {
    const state = this.vehicleState.get(vehicleId);
    if (state) {
      state.fuelLevel = Math.min(1, state.fuelLevel + amount / state.fuelCapacity);
    }
  }

  getMaintenanceState(vehicleId: string): VehicleMaintenanceState | undefined {
    return this.vehicleState.get(vehicleId);
  }

  getFuelLevel(vehicleId: string): number {
    return this.vehicleState.get(vehicleId)?.fuelLevel ?? 0;
  }

  /**
   * Restore breakdown state from save data
   */
  restoreBreakdown(
    vehicleId: string,
    data: { subsystem: string; severity: 'minor' | 'major' | 'critical' }
  ): void {
    const state = this.vehicleState.get(vehicleId);
    if (!state) return;

    // Find the hazard for this subsystem
    const hazard = this.hazards.find(h => h.subsystem === data.subsystem);
    if (!hazard) return;

    const event: BreakdownEvent = {
      id: `bd_${Date.now()}_${vehicleId}`,
      vehicleId,
      timestamp: Date.now(),
      position: new THREE.Vector3(),
      severity: data.severity,
      subsystem: data.subsystem as any,
      cause: 'wear',
      isRoadside: true,
      recoveryRequired: hazard.recoveryRequired,
      description: hazard.description(0.5),
      symptoms: hazard.symptoms,
      warningLights: hazard.warningLights,
      canDrive: hazard.canDrive,
      mobileRepairPossible: hazard.mobileRepair,
      estimatedRepairTime: hazard.estimatedTime,
      repairCost: Math.round(hazard.estimatedTime * (hazard.recoveryRequired ? 1.5 : 0.8)),
      narrated: false,
    };

    this.activeBreakdowns.set(vehicleId, event);
    this.onBreakdown?.(event);
  }

  setDifficulty(multiplier: number): void {
    this.difficultyMultiplier = multiplier;
  }

  serialize(): any {
    return {
      vehicleState: Array.from(this.vehicleState.entries()),
      activeBreakdowns: Array.from(this.activeBreakdowns.entries()).map(([id, e]) => [
        id,
        {
          ...e,
          position: { x: e.position.x, y: e.position.y, z: e.position.z },
        },
      ]),
    };
  }

  deserialize(data: any): void {
    this.vehicleState = new Map(data.vehicleState || []);
    this.activeBreakdowns = new Map(
      (data.activeBreakdowns || []).map(([id, e]: [string, any]) => [
        id,
        {
          ...e,
          position: new THREE.Vector3(e.position.x, e.position.y, e.position.z),
        },
      ])
    );
  }
}

// ============================================
// WARNING LIGHT MANAGER
// ============================================

export class WarningLightManager {
  private activeWarnings = new Map<string, Set<string>>(); // vehicleId -> warning lights
  private warningConfig: Record<string, { color: string; label: string; critical: boolean }> = {
    ENGINE: { color: '#ff4444', label: 'CHECK ENGINE', critical: false },
    TEMP: { color: '#ff8800', label: 'TEMPERATURE', critical: true },
    OIL: { color: '#ffaa00', label: 'OIL PRESSURE', critical: true },
    BATTERY: { color: '#ff4444', label: 'BATTERY', critical: false },
    BRAKE: { color: '#ff0000', label: 'BRAKE', critical: true },
    ABS: { color: '#ff8800', label: 'ABS', critical: false },
    FUEL: { color: '#ffff00', label: 'FUEL', critical: false },
    STEERING: { color: '#ff4444', label: 'POWER STEERING', critical: false },
    AIRBAG: { color: '#ff4444', label: 'AIRBAG', critical: false },
    GLOW: { color: '#ffaa00', label: 'GLOW PLUG', critical: false },
  };

  setWarning(vehicleId: string, warning: string, on: boolean): void {
    if (!this.activeWarnings.has(vehicleId)) {
      this.activeWarnings.set(vehicleId, new Set());
    }
    const warnings = this.activeWarnings.get(vehicleId)!;
    if (on) warnings.add(warning);
    else warnings.delete(warning);
  }

  getWarnings(vehicleId: string): string[] {
    return Array.from(this.activeWarnings.get(vehicleId) || []);
  }

  getCriticalWarnings(vehicleId: string): string[] {
    return this.getWarnings(vehicleId).filter(w => this.warningConfig[w]?.critical);
  }

  hasWarning(vehicleId: string, warning: string): boolean {
    return this.activeWarnings.get(vehicleId)?.has(warning) || false;
  }

  clearAll(vehicleId: string): void {
    this.activeWarnings.delete(vehicleId);
  }
}
