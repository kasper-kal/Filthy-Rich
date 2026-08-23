import * as THREE from 'three';
import type { DrivetrainSpecs } from './Drivetrain.js';
import { EngineSpecs, GearboxSpecs, DifferentialSpecs, DiffType } from './Drivetrain.js';

export interface VehicleDimensions {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  trackFront: number;
  trackRear: number;
  groundClearance: number;
}

export interface SuspensionSpecs {
  springRate: number; // N/m
  damperRate: number; // Ns/m
  travel: number; // m
  antiRollBar: number; // Nm/deg
}

export interface WheelSpecs {
  radius: number;
  width: number;
  mass: number;
  inertia: number;
  frictionCurve: { B: number; C: number; D: number; E: number }; // Pacejka
}

export interface AeroSpecs {
  dragCoefficient: number;
  frontalArea: number; // m²
  downforceCoefficient: number;
  liftCoefficient: number;
}

export interface BrakeSpecs {
  frontBias: number; // 0-1
  maxTorqueFront: number; // Nm
  maxTorqueRear: number; // Nm
  discRadiusFront: number;
  discRadiusRear: number;
}

export interface SteeringSpecs {
  maxAngle: number; // radians
  ratio: number; // steering wheel : wheel
  speedSensitivity: number;
}

export interface VehicleSpecsData {
  name: string;
  type: string;
  color: number;
  mass: number; // kg
  centerOfMass: THREE.Vector3; // relative to chassis center
  dimensions: VehicleDimensions;
  wheelRadius: number;
  wheelWidth: number;
  engineRedline: number;
  fuelCapacity: number; // liters
  suspension: {
    front: SuspensionSpecs;
    rear: SuspensionSpecs;
  };
  wheels: {
    front: WheelSpecs;
    rear: WheelSpecs;
  };
  aero: AeroSpecs;
  brakes: BrakeSpecs;
  steering: SteeringSpecs;
  drivetrain: DrivetrainSpecs;
}

export class VehicleSpecs {
  static presets = new Map<string, VehicleSpecsData>();

  static init(): void {
    // HATCHBACK - Basic FWD runabout
    this.presets.set('hatchback', {
      name: 'Hatchback',
      type: 'hatchback',
      color: 0x3498db,
      mass: 1150,
      centerOfMass: new THREE.Vector3(0, 0.55, -0.1),
      dimensions: {
        length: 4.0,
        width: 1.75,
        height: 1.5,
        wheelbase: 2.5,
        trackFront: 1.5,
        trackRear: 1.5,
        groundClearance: 0.15,
      },
      wheelRadius: 0.3,
      wheelWidth: 0.205,
      engineRedline: 6500,
      fuelCapacity: 45,
      suspension: {
        front: { springRate: 35000, damperRate: 4000, travel: 0.12, antiRollBar: 25000 },
        rear: { springRate: 30000, damperRate: 3500, travel: 0.12, antiRollBar: 15000 },
      },
      wheels: {
        front: {
          radius: 0.3,
          width: 0.205,
          mass: 18,
          inertia: 0.8,
          frictionCurve: { B: 10, C: 1.9, D: 1.0, E: 0.97 },
        },
        rear: {
          radius: 0.3,
          width: 0.205,
          mass: 18,
          inertia: 0.8,
          frictionCurve: { B: 10, C: 1.9, D: 1.0, E: 0.97 },
        },
      },
      aero: {
        dragCoefficient: 0.32,
        frontalArea: 2.2,
        downforceCoefficient: 0.0,
        liftCoefficient: 0.1,
      },
      brakes: {
        frontBias: 0.7,
        maxTorqueFront: 2500,
        maxTorqueRear: 1800,
        discRadiusFront: 0.14,
        discRadiusRear: 0.12,
      },
      steering: { maxAngle: 0.6, ratio: 16, speedSensitivity: 0.3 },
      drivetrain: this.createDrivetrainSpecs('hot_hatch'),
    });

    // SEDAN - RWD family car
    this.presets.set('sedan', {
      name: 'Sedan',
      type: 'sedan',
      color: 0x2c3e50,
      mass: 1450,
      centerOfMass: new THREE.Vector3(0, 0.52, 0.05),
      dimensions: {
        length: 4.7,
        width: 1.85,
        height: 1.45,
        wheelbase: 2.8,
        trackFront: 1.58,
        trackRear: 1.58,
        groundClearance: 0.14,
      },
      wheelRadius: 0.33,
      wheelWidth: 0.225,
      engineRedline: 7000,
      fuelCapacity: 60,
      suspension: {
        front: { springRate: 40000, damperRate: 4500, travel: 0.11, antiRollBar: 30000 },
        rear: { springRate: 38000, damperRate: 4200, travel: 0.11, antiRollBar: 22000 },
      },
      wheels: {
        front: {
          radius: 0.33,
          width: 0.225,
          mass: 22,
          inertia: 1.2,
          frictionCurve: { B: 11, C: 2.0, D: 1.1, E: 0.97 },
        },
        rear: {
          radius: 0.33,
          width: 0.225,
          mass: 22,
          inertia: 1.2,
          frictionCurve: { B: 11, C: 2.0, D: 1.1, E: 0.97 },
        },
      },
      aero: {
        dragCoefficient: 0.29,
        frontalArea: 2.3,
        downforceCoefficient: 0.05,
        liftCoefficient: 0.05,
      },
      brakes: {
        frontBias: 0.65,
        maxTorqueFront: 3000,
        maxTorqueRear: 2200,
        discRadiusFront: 0.15,
        discRadiusRear: 0.13,
      },
      steering: { maxAngle: 0.55, ratio: 15, speedSensitivity: 0.35 },
      drivetrain: this.createDrivetrainSpecs('sports_sedan'),
    });

    // VAN - FWD workhorse
    this.presets.set('van', {
      name: 'Panel Van',
      type: 'van',
      color: 0xecf0f1,
      mass: 2100,
      centerOfMass: new THREE.Vector3(0, 0.7, -0.3),
      dimensions: {
        length: 5.0,
        width: 2.0,
        height: 2.3,
        wheelbase: 3.2,
        trackFront: 1.7,
        trackRear: 1.7,
        groundClearance: 0.18,
      },
      wheelRadius: 0.35,
      wheelWidth: 0.215,
      engineRedline: 4500,
      fuelCapacity: 80,
      suspension: {
        front: { springRate: 50000, damperRate: 5000, travel: 0.15, antiRollBar: 20000 },
        rear: { springRate: 60000, damperRate: 6000, travel: 0.15, antiRollBar: 10000 },
      },
      wheels: {
        front: {
          radius: 0.35,
          width: 0.215,
          mass: 28,
          inertia: 1.8,
          frictionCurve: { B: 9, C: 1.8, D: 0.9, E: 0.95 },
        },
        rear: {
          radius: 0.35,
          width: 0.215,
          mass: 28,
          inertia: 1.8,
          frictionCurve: { B: 9, C: 1.8, D: 0.9, E: 0.95 },
        },
      },
      aero: {
        dragCoefficient: 0.45,
        frontalArea: 4.0,
        downforceCoefficient: 0.0,
        liftCoefficient: 0.15,
      },
      brakes: {
        frontBias: 0.6,
        maxTorqueFront: 3500,
        maxTorqueRear: 2800,
        discRadiusFront: 0.16,
        discRadiusRear: 0.14,
      },
      steering: { maxAngle: 0.5, ratio: 18, speedSensitivity: 0.2 },
      drivetrain: this.createDrivetrainSpecs('van'),
    });

    // SPORTS CAR - RWD performance
    this.presets.set('sports', {
      name: 'Sports Coupe',
      type: 'sports',
      color: 0xe74c3c,
      mass: 1350,
      centerOfMass: new THREE.Vector3(0, 0.45, 0.1),
      dimensions: {
        length: 4.3,
        width: 1.85,
        height: 1.25,
        wheelbase: 2.6,
        trackFront: 1.6,
        trackRear: 1.62,
        groundClearance: 0.11,
      },
      wheelRadius: 0.32,
      wheelWidth: 0.245,
      engineRedline: 8000,
      fuelCapacity: 55,
      suspension: {
        front: { springRate: 60000, damperRate: 6000, travel: 0.09, antiRollBar: 40000 },
        rear: { springRate: 55000, damperRate: 5500, travel: 0.09, antiRollBar: 35000 },
      },
      wheels: {
        front: {
          radius: 0.32,
          width: 0.245,
          mass: 20,
          inertia: 1.1,
          frictionCurve: { B: 12, C: 2.1, D: 1.2, E: 0.98 },
        },
        rear: {
          radius: 0.32,
          width: 0.245,
          mass: 20,
          inertia: 1.1,
          frictionCurve: { B: 12, C: 2.1, D: 1.2, E: 0.98 },
        },
      },
      aero: {
        dragCoefficient: 0.31,
        frontalArea: 2.0,
        downforceCoefficient: 0.3,
        liftCoefficient: -0.1,
      },
      brakes: {
        frontBias: 0.62,
        maxTorqueFront: 4000,
        maxTorqueRear: 3000,
        discRadiusFront: 0.17,
        discRadiusRear: 0.15,
      },
      steering: { maxAngle: 0.5, ratio: 13, speedSensitivity: 0.5 },
      drivetrain: this.createDrivetrainSpecs('sports_sedan'),
    });

    // BANGER - Old FWD beater
    this.presets.set('banger', {
      name: 'Old Banger',
      type: 'banger',
      color: 0x7f8c8d,
      mass: 1050,
      centerOfMass: new THREE.Vector3(0, 0.58, -0.15),
      dimensions: {
        length: 3.8,
        width: 1.65,
        height: 1.45,
        wheelbase: 2.4,
        trackFront: 1.45,
        trackRear: 1.45,
        groundClearance: 0.13,
      },
      wheelRadius: 0.28,
      wheelWidth: 0.185,
      engineRedline: 5500,
      fuelCapacity: 40,
      suspension: {
        front: { springRate: 25000, damperRate: 2500, travel: 0.14, antiRollBar: 10000 },
        rear: { springRate: 22000, damperRate: 2200, travel: 0.14, antiRollBar: 5000 },
      },
      wheels: {
        front: {
          radius: 0.28,
          width: 0.185,
          mass: 15,
          inertia: 0.6,
          frictionCurve: { B: 8, C: 1.7, D: 0.8, E: 0.9 },
        },
        rear: {
          radius: 0.28,
          width: 0.185,
          mass: 15,
          inertia: 0.6,
          frictionCurve: { B: 8, C: 1.7, D: 0.8, E: 0.9 },
        },
      },
      aero: {
        dragCoefficient: 0.38,
        frontalArea: 2.0,
        downforceCoefficient: 0.0,
        liftCoefficient: 0.12,
      },
      brakes: {
        frontBias: 0.75,
        maxTorqueFront: 2000,
        maxTorqueRear: 1200,
        discRadiusFront: 0.12,
        discRadiusRear: 0.1,
      },
      steering: { maxAngle: 0.65, ratio: 18, speedSensitivity: 0.25 },
      drivetrain: this.createDrivetrainSpecs('banger'),
    });

    console.log('[VehicleSpecs] Loaded', this.presets.size, 'presets');
  }

  static getPreset(name: string): VehicleSpecsData {
    const preset = this.presets.get(name);
    if (!preset) {
      console.warn(`[VehicleSpecs] Preset "${name}" not found, using hatchback`);
      return this.presets.get('hatchback')!;
    }
    return { ...preset }; // Return copy
  }

  static getAllPresets(): string[] {
    return Array.from(this.presets.keys());
  }

  private static createDrivetrainSpecs(preset: string): DrivetrainSpecs {
    const presets: Record<string, DrivetrainSpecs> = {
      hot_hatch: {
        engine: {
          displacement: 1.6,
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
            [1, 0.3],
          ],
          maxPowerKW: 140,
          maxPowerRPM: 6000,
          maxTorqueNm: 240,
          maxTorqueRPM: 3500,
          inertia: 0.25,
          frictionTorque: 45,
          compressionBraking: 0.15,
          turboLag: 0.3,
          maxBoost: 1.2,
          boostThresholdRPM: 2000,
          soundProfile: 'inline4',
        },
        gearbox: {
          type: 'manual',
          ratios: [-3.5, 0, 3.6, 2.1, 1.4, 1.0, 0.8],
          finalDrive: 4.2,
          shiftTime: 0.4,
          autoShiftUpRPM: 0.85,
          autoShiftDownRPM: 0.35,
          clutchSlip: 1.5,
          efficiency: 0.95,
        },
        frontDiff: {
          type: 'lsd',
          lockRatio: 0.4,
          preload: 30,
          rampAngle: 45,
          responseRate: 15,
        },
        rearDiff: {
          type: 'open',
          lockRatio: 0,
          preload: 0,
          rampAngle: 0,
          responseRate: 10,
        },
        centerDiff: {
          type: 'open',
          lockRatio: 0,
          preload: 0,
          rampAngle: 0,
          responseRate: 10,
        },
        drivetrainLayout: 'fwd',
        centerDiffSplit: 0,
      },
      sports_sedan: {
        engine: {
          displacement: 3.0,
          cylinders: 6,
          layout: 'inline',
          aspiration: 'twin-turbo',
          redlineRPM: 7000,
          limiterRPM: 7300,
          idleRPM: 750,
          torqueCurve: [
            [0, 0.3],
            [0.15, 0.55],
            [0.3, 0.8],
            [0.45, 0.95],
            [0.55, 1.0],
            [0.7, 0.95],
            [0.85, 0.8],
            [1, 0.5],
          ],
          maxPowerKW: 250,
          maxPowerRPM: 6500,
          maxTorqueNm: 400,
          maxTorqueRPM: 4000,
          inertia: 0.4,
          frictionTorque: 60,
          compressionBraking: 0.18,
          turboLag: 0.25,
          maxBoost: 1.6,
          boostThresholdRPM: 1800,
          soundProfile: 'inline4',
        },
        gearbox: {
          type: 'manual',
          ratios: [-3.5, 0, 4.1, 2.3, 1.5, 1.1, 0.9, 0.75],
          finalDrive: 3.45,
          shiftTime: 0.35,
          autoShiftUpRPM: 0.85,
          autoShiftDownRPM: 0.3,
          clutchSlip: 1.5,
          efficiency: 0.96,
        },
        frontDiff: {
          type: 'open',
          lockRatio: 0,
          preload: 0,
          rampAngle: 0,
          responseRate: 10,
        },
        rearDiff: {
          type: 'lsd',
          lockRatio: 0.6,
          preload: 50,
          rampAngle: 40,
          responseRate: 20,
        },
        centerDiff: {
          type: 'open',
          lockRatio: 0,
          preload: 0,
          rampAngle: 0,
          responseRate: 10,
        },
        drivetrainLayout: 'rwd',
        centerDiffSplit: 0,
      },
      rally: {
        engine: {
          displacement: 2.0,
          cylinders: 4,
          layout: 'inline',
          aspiration: 'turbo',
          redlineRPM: 6800,
          limiterRPM: 7200,
          idleRPM: 850,
          torqueCurve: [
            [0, 0.25],
            [0.15, 0.55],
            [0.3, 0.85],
            [0.45, 1.0],
            [0.6, 0.95],
            [0.75, 0.8],
            [0.9, 0.55],
            [1, 0.3],
          ],
          maxPowerKW: 220,
          maxPowerRPM: 6000,
          maxTorqueNm: 450,
          maxTorqueRPM: 3500,
          inertia: 0.25,
          frictionTorque: 50,
          compressionBraking: 0.2,
          turboLag: 0.4,
          maxBoost: 2.2,
          boostThresholdRPM: 2200,
          soundProfile: 'inline4',
        },
        gearbox: {
          type: 'sequential',
          ratios: [-3.5, 0, 3.8, 2.2, 1.5, 1.1, 0.9, 0.75],
          finalDrive: 4.5,
          shiftTime: 0.1,
          autoShiftUpRPM: 0.9,
          autoShiftDownRPM: 0.3,
          clutchSlip: 1.2,
          efficiency: 0.97,
        },
        frontDiff: {
          type: 'torsen',
          lockRatio: 0.7,
          preload: 40,
          rampAngle: 0,
          responseRate: 30,
        },
        rearDiff: {
          type: 'torsen',
          lockRatio: 0.7,
          preload: 40,
          rampAngle: 0,
          responseRate: 30,
        },
        centerDiff: {
          type: 'viscous',
          lockRatio: 0.5,
          preload: 0,
          rampAngle: 0,
          responseRate: 25,
        },
        drivetrainLayout: 'awd',
        centerDiffSplit: 0.5,
      },
      banger: {
        engine: {
          displacement: 1.2,
          cylinders: 4,
          layout: 'inline',
          aspiration: 'na',
          redlineRPM: 5500,
          limiterRPM: 5800,
          idleRPM: 900,
          torqueCurve: [
            [0, 0.3],
            [0.15, 0.5],
            [0.3, 0.75],
            [0.5, 1.0],
            [0.65, 0.95],
            [0.8, 0.8],
            [0.9, 0.6],
            [1, 0.3],
          ],
          maxPowerKW: 55,
          maxPowerRPM: 5000,
          maxTorqueNm: 100,
          maxTorqueRPM: 3000,
          inertia: 0.2,
          frictionTorque: 40,
          compressionBraking: 0.12,
          turboLag: 0,
          maxBoost: 0,
          boostThresholdRPM: 0,
          soundProfile: 'inline4',
        },
        gearbox: {
          type: 'manual',
          ratios: [-3.5, 0, 3.5, 2.0, 1.3, 0.95, 0.8],
          finalDrive: 3.9,
          shiftTime: 0.6,
          autoShiftUpRPM: 0.8,
          autoShiftDownRPM: 0.4,
          clutchSlip: 1.8,
          efficiency: 0.92,
        },
        frontDiff: {
          type: 'open',
          lockRatio: 0,
          preload: 0,
          rampAngle: 0,
          responseRate: 10,
        },
        rearDiff: {
          type: 'open',
          lockRatio: 0,
          preload: 0,
          rampAngle: 0,
          responseRate: 10,
        },
        centerDiff: {
          type: 'open',
          lockRatio: 0,
          preload: 0,
          rampAngle: 0,
          responseRate: 10,
        },
        drivetrainLayout: 'fwd',
        centerDiffSplit: 0,
      },
      van: {
        engine: {
          displacement: 2.2,
          cylinders: 4,
          layout: 'inline',
          aspiration: 'turbo',
          redlineRPM: 4500,
          limiterRPM: 4800,
          idleRPM: 800,
          torqueCurve: [
            [0, 0.35],
            [0.15, 0.6],
            [0.3, 0.85],
            [0.4, 1.0],
            [0.55, 0.95],
            [0.7, 0.85],
            [0.85, 0.65],
            [1, 0.4],
          ],
          maxPowerKW: 100,
          maxPowerRPM: 3500,
          maxTorqueNm: 350,
          maxTorqueRPM: 1750,
          inertia: 0.6,
          frictionTorque: 70,
          compressionBraking: 0.3,
          turboLag: 0.5,
          maxBoost: 1.8,
          boostThresholdRPM: 1500,
          soundProfile: 'diesel',
        },
        gearbox: {
          type: 'manual',
          ratios: [-3.8, 0, 4.5, 2.4, 1.4, 1.0, 0.8],
          finalDrive: 4.1,
          shiftTime: 0.5,
          autoShiftUpRPM: 0.75,
          autoShiftDownRPM: 0.35,
          clutchSlip: 2.0,
          efficiency: 0.93,
        },
        frontDiff: {
          type: 'open',
          lockRatio: 0,
          preload: 0,
          rampAngle: 0,
          responseRate: 10,
        },
        rearDiff: {
          type: 'lsd',
          lockRatio: 0.3,
          preload: 20,
          rampAngle: 45,
          responseRate: 10,
        },
        centerDiff: {
          type: 'open',
          lockRatio: 0,
          preload: 0,
          rampAngle: 0,
          responseRate: 10,
        },
        drivetrainLayout: 'rwd',
        centerDiffSplit: 0,
      },
    };

    return presets[preset] || presets.hot_hatch;
  }
}

// Initialize on import
VehicleSpecs.init();
