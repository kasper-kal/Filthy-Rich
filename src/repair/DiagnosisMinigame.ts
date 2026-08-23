import * as THREE from 'three';
import type { DamageModel, SubsystemName } from '../vehicle/DamageModel.js';
import { SubsystemDamage } from '../vehicle/DamageModel.js';

// ============================================
// DIAGNOSIS MINIGAME
// ============================================

export type DiagnosisPhase =
  'idle' | 'connecting' | 'reading_codes' | 'live_data' | 'component_test' | 'analysis' | 'result';

export interface FaultCode {
  code: string; // P0XXX, B0XXX, C0XXX, U0XXX
  description: string;
  subsystem: SubsystemName;
  severity: 'pending' | 'confirmed' | 'permanent';
  freezeFrame: {
    rpm: number;
    speed: number;
    load: number;
    coolantTemp: number;
    fuelTrim: number;
  };
}

export interface LiveDataParameter {
  pid: string; // Parameter ID
  name: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  expectedMin: number;
  expectedMax: number;
  isAbnormal: boolean;
  subsystem: SubsystemName;
}

export interface ComponentTest {
  id: string;
  name: string;
  subsystem: SubsystemName;
  description: string;
  procedure: string;
  expectedResult: string;
  actualResult: 'pass' | 'fail' | 'inconclusive' | 'not_tested';
  requiresTools: string[];
  cost: number; // Money/time cost
  risk: 'none' | 'low' | 'medium' | 'high';
}

export interface DiagnosisSession {
  vehicleId: string;
  startTime: number;
  phase: DiagnosisPhase;
  suspicionScores: Map<SubsystemName, number>;
  foundCodes: FaultCode[];
  liveData: LiveDataParameter[];
  completedTests: ComponentTest[];
  selectedSubsystem: SubsystemName | null;
  confidence: number; // 0-1
  timeSpent: number;
  moneySpent: number;
}

export interface DiagnosisMinigameConfig {
  // Time limits (seconds)
  connectTimeout: number;
  readCodesTimeout: number;
  liveDataRefreshRate: number;
  testDuration: Record<string, number>;

  // Costs
  obdScanCost: number;
  liveDataCost: number;
  componentTestCost: Record<string, number>;

  // Difficulty
  falsePositiveRate: number;
  falseNegativeRate: number;
  codeAccuracy: number;

  // Scoring
  maxTime: number; // Max time before auto-fail
  perfectScore: number;
  codeReadBonus: number;
  testBonus: number;
  wrongGuessPenalty: number;
}

const DEFAULT_CONFIG: DiagnosisMinigameConfig = {
  connectTimeout: 5,
  readCodesTimeout: 10,
  liveDataRefreshRate: 0.5,
  testDuration: {
    compression: 15,
    leakdown: 20,
    fuel_pressure: 10,
    ignition: 8,
    vacuum: 5,
    sensor: 5,
    electrical: 8,
    smoke: 15,
  },
  obdScanCost: 10,
  liveDataCost: 5,
  componentTestCost: {
    compression: 30,
    leakdown: 50,
    fuel_pressure: 20,
    ignition: 15,
    vacuum: 10,
    sensor: 10,
    electrical: 20,
    smoke: 40,
  },
  falsePositiveRate: 0.1,
  falseNegativeRate: 0.05,
  codeAccuracy: 0.85,
  maxTime: 600, // 10 minutes
  perfectScore: 1000,
  codeReadBonus: 100,
  testBonus: 50,
  wrongGuessPenalty: 200,
};

// Pre-defined fault codes
const FAULT_CODE_DATABASE: Record<string, Omit<FaultCode, 'severity' | 'freezeFrame'>> = {
  // Powertrain (P0xxx)
  P0300: {
    code: 'P0300',
    description: 'Random/Multiple Cylinder Misfire Detected',
    subsystem: 'ignition_system',
  },
  P0301: {
    code: 'P0301',
    description: 'Cylinder 1 Misfire Detected',
    subsystem: 'ignition_system',
  },
  P0302: {
    code: 'P0302',
    description: 'Cylinder 2 Misfire Detected',
    subsystem: 'ignition_system',
  },
  P0303: {
    code: 'P0303',
    description: 'Cylinder 3 Misfire Detected',
    subsystem: 'ignition_system',
  },
  P0304: {
    code: 'P0304',
    description: 'Cylinder 4 Misfire Detected',
    subsystem: 'ignition_system',
  },
  P0171: { code: 'P0171', description: 'System Too Lean (Bank 1)', subsystem: 'fuel_system' },
  P0172: { code: 'P0172', description: 'System Too Rich (Bank 1)', subsystem: 'fuel_system' },
  P0101: {
    code: 'P0101',
    description: 'MAF Sensor Circuit Range/Performance',
    subsystem: 'fuel_system',
  },
  P0102: { code: 'P0102', description: 'MAF Sensor Circuit Low Input', subsystem: 'fuel_system' },
  P0113: { code: 'P0113', description: 'IAT Sensor Circuit High Input', subsystem: 'fuel_system' },
  P0117: {
    code: 'P0117',
    description: 'ECT Sensor Circuit Low Input',
    subsystem: 'cooling_system',
  },
  P0118: {
    code: 'P0118',
    description: 'ECT Sensor Circuit High Input',
    subsystem: 'cooling_system',
  },
  P0128: {
    code: 'P0128',
    description: 'Coolant Thermostat Stuck Open',
    subsystem: 'cooling_system',
  },
  P0299: { code: 'P0299', description: 'Turbo/Supercharger Underboost', subsystem: 'turbocharger' },
  P0234: { code: 'P0234', description: 'Turbo/Supercharger Overboost', subsystem: 'turbocharger' },
  P0420: {
    code: 'P0420',
    description: 'Catalyst System Efficiency Below Threshold',
    subsystem: 'exhaust',
  },
  P0442: {
    code: 'P0442',
    description: 'EVAP System Leak Detected (Small)',
    subsystem: 'fuel_system',
  },
  P0500: {
    code: 'P0500',
    description: 'Vehicle Speed Sensor Malfunction',
    subsystem: 'electrical',
  },
  P0505: {
    code: 'P0505',
    description: 'Idle Control System Malfunction',
    subsystem: 'ignition_system',
  },
  P0606: { code: 'P0606', description: 'ECM/PCM Processor Fault', subsystem: 'electrical' },

  // Chassis (C0xxx)
  C0035: {
    code: 'C0035',
    description: 'Left Front Wheel Speed Sensor Circuit',
    subsystem: 'brakes_front',
  },
  C0040: {
    code: 'C0040',
    description: 'Right Front Wheel Speed Sensor Circuit',
    subsystem: 'brakes_front',
  },
  C0045: {
    code: 'C0045',
    description: 'Left Rear Wheel Speed Sensor Circuit',
    subsystem: 'brakes_rear',
  },
  C0050: {
    code: 'C0050',
    description: 'Right Rear Wheel Speed Sensor Circuit',
    subsystem: 'brakes_rear',
  },
  C0110: { code: 'C0110', description: 'ABS Pump Motor Circuit', subsystem: 'brakes_front' },

  // Body (B0xxx)
  B0001: {
    code: 'B0001',
    description: 'Driver Frontal Stage 1 Deployment Control',
    subsystem: 'electrical',
  },

  // Network (U0xxx)
  U0100: { code: 'U0100', description: 'Lost Communication With ECM/PCM', subsystem: 'electrical' },
  U0101: { code: 'U0101', description: 'Lost Communication With TCM', subsystem: 'gearbox' },
  U0121: { code: 'U0121', description: 'Lost Communication With ABS', subsystem: 'brakes_front' },
};

// Pre-defined live data parameters
const LIVE_DATA_DEFINITIONS: Omit<LiveDataParameter, 'value' | 'isAbnormal'>[] = [
  // Engine
  {
    pid: '010C',
    name: 'Engine RPM',
    unit: 'RPM',
    min: 0,
    max: 8000,
    expectedMin: 750,
    expectedMax: 900,
    subsystem: 'engine_block',
  },
  {
    pid: '0111',
    name: 'Throttle Position',
    unit: '%',
    min: 0,
    max: 100,
    expectedMin: 0,
    expectedMax: 100,
    subsystem: 'fuel_system',
  },
  {
    pid: '0105',
    name: 'Coolant Temperature',
    unit: '°C',
    min: -40,
    max: 140,
    expectedMin: 80,
    expectedMax: 105,
    subsystem: 'cooling_system',
  },
  {
    pid: '010B',
    name: 'Intake Manifold Pressure',
    unit: 'kPa',
    min: 0,
    max: 255,
    expectedMin: 30,
    expectedMax: 100,
    subsystem: 'fuel_system',
  },
  {
    pid: '010F',
    name: 'Intake Air Temperature',
    unit: '°C',
    min: -40,
    max: 125,
    expectedMin: 10,
    expectedMax: 60,
    subsystem: 'fuel_system',
  },
  {
    pid: '0110',
    name: 'MAF Flow Rate',
    unit: 'g/s',
    min: 0,
    max: 655,
    expectedMin: 2,
    expectedMax: 50,
    subsystem: 'fuel_system',
  },
  {
    pid: '011F',
    name: 'Engine Run Time',
    unit: 's',
    min: 0,
    max: 65535,
    expectedMin: 0,
    expectedMax: 65535,
    subsystem: 'engine_block',
  },
  {
    pid: '012F',
    name: 'Fuel Level',
    unit: '%',
    min: 0,
    max: 100,
    expectedMin: 0,
    expectedMax: 100,
    subsystem: 'fuel_system',
  },
  {
    pid: '0130',
    name: 'Warm-ups Since Codes Cleared',
    unit: 'count',
    min: 0,
    max: 255,
    expectedMin: 0,
    expectedMax: 255,
    subsystem: 'electrical',
  },
  {
    pid: '0131',
    name: 'Distance Since Codes Cleared',
    unit: 'km',
    min: 0,
    max: 65535,
    expectedMin: 0,
    expectedMax: 65535,
    subsystem: 'engine_block',
  },

  // Fuel trims
  {
    pid: '0106',
    name: 'Short Term Fuel Trim Bank 1',
    unit: '%',
    min: -100,
    max: 99.2,
    expectedMin: -10,
    expectedMax: 10,
    subsystem: 'fuel_system',
  },
  {
    pid: '0107',
    name: 'Long Term Fuel Trim Bank 1',
    unit: '%',
    min: -100,
    max: 99.2,
    expectedMin: -10,
    expectedMax: 10,
    subsystem: 'fuel_system',
  },

  // O2 Sensors
  {
    pid: '0114',
    name: 'O2 Sensor 1 Voltage',
    unit: 'V',
    min: 0,
    max: 1.275,
    expectedMin: 0.1,
    expectedMax: 0.9,
    subsystem: 'fuel_system',
  },
  {
    pid: '0115',
    name: 'O2 Sensor 1 Fuel Trim',
    unit: '%',
    min: -100,
    max: 99.2,
    expectedMin: -5,
    expectedMax: 5,
    subsystem: 'fuel_system',
  },

  // Ignition
  {
    pid: '010D',
    name: 'Vehicle Speed',
    unit: 'km/h',
    min: 0,
    max: 255,
    expectedMin: 0,
    expectedMax: 255,
    subsystem: 'electrical',
  },
  {
    pid: '010E',
    name: 'Timing Advance',
    unit: '°',
    min: -64,
    max: 63.5,
    expectedMin: -10,
    expectedMax: 40,
    subsystem: 'ignition_system',
  },

  // Transmission
  {
    pid: '0120',
    name: 'Transmission Oil Temp',
    unit: '°C',
    min: -40,
    max: 215,
    expectedMin: 70,
    expectedMax: 110,
    subsystem: 'gearbox',
  },
];

// Component tests available
const COMPONENT_TESTS: Record<string, Omit<ComponentTest, 'actualResult'>> = {
  compression: {
    id: 'compression',
    name: 'Compression Test',
    subsystem: 'engine_block',
    description: 'Measure cylinder compression to check piston rings, valves, head gasket',
    procedure:
      'Remove spark plugs, screw in compression gauge, crank engine 5 revolutions per cylinder',
    expectedResult: 'All cylinders within 10% of each other, >100 PSI',
    requiresTools: ['compression_gauge'],
    cost: 30,
    risk: 'low',
  },
  leakdown: {
    id: 'leakdown',
    name: 'Leak-down Test',
    subsystem: 'engine_head',
    description: 'Pressurize cylinders to find where compression is leaking',
    procedure:
      'Bring cylinder to TDC, apply compressed air, listen for leaks at intake/exhaust/oil cap',
    expectedResult: 'Less than 10% leak-down, no audible leaks',
    requiresTools: ['leakdown_tester', 'compressed_air'],
    cost: 50,
    risk: 'low',
  },
  fuel_pressure: {
    id: 'fuel_pressure',
    name: 'Fuel Pressure Test',
    subsystem: 'fuel_system',
    description: 'Check fuel pump pressure and regulator function',
    procedure:
      'Connect fuel pressure gauge to test port, prime pump, observe pressure at idle and under load',
    expectedResult: 'Pressure within spec at idle, rises with vacuum disconnect',
    requiresTools: ['fuel_pressure_gauge'],
    cost: 20,
    risk: 'medium',
  },
  ignition: {
    id: 'ignition',
    name: 'Ignition System Test',
    subsystem: 'ignition_system',
    description: 'Check spark plugs, coils, leads for proper operation',
    procedure: 'Remove plugs, check gap/condition, test coil resistance, check for spark',
    expectedResult: 'Clean plugs, correct gap, strong blue spark on all cylinders',
    requiresTools: ['spark_tester', 'multimeter'],
    cost: 15,
    risk: 'low',
  },
  vacuum: {
    id: 'vacuum',
    name: 'Vacuum Test',
    subsystem: 'engine_head',
    description: 'Check intake manifold vacuum for leaks and valve timing',
    procedure: 'Connect vacuum gauge to manifold port, observe at idle and snap throttle',
    expectedResult: 'Steady 18-22 inHg at idle, drops momentarily on snap throttle',
    requiresTools: ['vacuum_gauge'],
    cost: 10,
    risk: 'none',
  },
  sensor: {
    id: 'sensor',
    name: 'Sensor Signal Test',
    subsystem: 'fuel_system',
    description: 'Test MAF, MAP, TPS, O2 sensors for correct voltage/signal',
    procedure: 'Backprobe sensor connector, measure voltage/resistance at various conditions',
    expectedResult: 'Signals within manufacturer specifications',
    requiresTools: ['multimeter', 'oscilloscope'],
    cost: 10,
    risk: 'none',
  },
  electrical: {
    id: 'electrical',
    name: 'Electrical System Test',
    subsystem: 'electrical',
    description: 'Check battery, alternator, wiring, grounds',
    procedure: 'Load test battery, check charging voltage, voltage drop test main grounds',
    expectedResult: 'Battery >12.6V, charging 13.8-14.4V, <0.1V drop on grounds',
    requiresTools: ['battery_tester', 'multimeter'],
    cost: 20,
    risk: 'none',
  },
  smoke: {
    id: 'smoke',
    name: 'Smoke Test (EVAP/Vacuum)',
    subsystem: 'fuel_system',
    description: 'Pressurize system with smoke to find leaks',
    procedure: 'Connect smoke machine to EVAP test port or vacuum line, look for escaping smoke',
    expectedResult: 'No visible smoke leaks',
    requiresTools: ['smoke_machine'],
    cost: 40,
    risk: 'low',
  },
};

export class DiagnosisMinigame {
  private damageModel: DamageModel;
  private config: DiagnosisMinigameConfig;
  private session: DiagnosisSession | null = null;
  private phaseTimer = 0;
  private liveDataTimer = 0;

  // Callbacks
  onPhaseChange?: (phase: DiagnosisPhase) => void;
  onCodesFound?: (codes: FaultCode[]) => void;
  onLiveDataUpdate?: (data: LiveDataParameter[]) => void;
  onTestComplete?: (test: ComponentTest) => void;
  onDiagnosisComplete?: (result: DiagnosisResult) => void;
  onMessage?: (message: string, type: 'info' | 'warning' | 'error' | 'success') => void;

  constructor(damageModel: DamageModel, config?: Partial<DiagnosisMinigameConfig>) {
    this.damageModel = damageModel;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start a new diagnosis session
   */
  startSession(vehicleId: string): DiagnosisSession {
    this.session = {
      vehicleId,
      startTime: Date.now(),
      phase: 'connecting',
      suspicionScores: new Map(),
      foundCodes: [],
      liveData: [],
      completedTests: [],
      selectedSubsystem: null,
      confidence: 0,
      timeSpent: 0,
      moneySpent: 0,
    };

    // Initialize suspicion scores from damage model
    this.updateSuspicionFromDamage();

    this.phaseTimer = 0;
    this.onPhaseChange?.('connecting');
    this.onMessage?.('Connecting to OBD-II port...', 'info');

    // Simulate connection
    setTimeout(() => {
      this.onConnectComplete();
    }, this.config.connectTimeout * 1000);

    return this.session;
  }

  /**
   * Update minigame (call every frame)
   */
  update(deltaTime: number): void {
    if (!this.session || this.session.phase === 'idle' || this.session.phase === 'result') return;

    this.session.timeSpent += deltaTime;
    this.phaseTimer += deltaTime;

    // Check timeout
    if (this.session.timeSpent > this.config.maxTime) {
      this.endSession(false, 'Time limit exceeded');
      return;
    }

    switch (this.session.phase) {
      case 'reading_codes':
        this.updateReadingCodes(deltaTime);
        break;
      case 'live_data':
        this.updateLiveData(deltaTime);
        break;
      case 'component_test':
        this.updateComponentTest(deltaTime);
        break;
      case 'analysis':
        this.updateAnalysis(deltaTime);
        break;
    }
  }

  // ============================================
  // PHASE HANDLERS
  // ============================================

  private onConnectComplete(): void {
    if (!this.session) return;

    // Small chance of connection failure
    if (Math.random() < 0.05) {
      this.onMessage?.('Connection failed. Check OBD port and ignition.', 'error');
      this.session.phase = 'idle';
      return;
    }

    this.session.phase = 'reading_codes';
    this.phaseTimer = 0;
    this.onPhaseChange?.('reading_codes');
    this.onMessage?.('Connected. Reading fault codes...', 'info');
    this.session.moneySpent += this.config.obdScanCost;
  }

  private updateReadingCodes(deltaTime: number): void {
    if (!this.session) return;

    if (this.phaseTimer >= this.config.readCodesTimeout) {
      // Read codes complete
      this.readFaultCodes();
      this.session.phase = 'live_data';
      this.phaseTimer = 0;
      this.onPhaseChange?.('live_data');
      this.onMessage?.('Fault codes retrieved. Switching to live data...', 'info');
    }
  }

  private readFaultCodes(): void {
    if (!this.session) return;

    const mechState = this.damageModel.getMechanicalState();
    const codes: FaultCode[] = [];

    // Generate codes based on subsystem health
    for (const [name, sub] of mechState.subsystems) {
      if (sub.health < 70 && sub.symptoms.length > 0) {
        // Find matching fault codes for this subsystem
        const matchingCodes = Object.values(FAULT_CODE_DATABASE).filter(
          fc => fc.subsystem === name
        );

        for (const codeData of matchingCodes) {
          // Accuracy check
          if (Math.random() < this.config.codeAccuracy) {
            codes.push({
              ...codeData,
              severity: sub.health < 30 ? 'permanent' : sub.health < 50 ? 'confirmed' : 'pending',
              freezeFrame: this.generateFreezeFrame(),
            });
          }
        }
      }
    }

    // False positives
    if (Math.random() < this.config.falsePositiveRate) {
      const randomCode =
        Object.values(FAULT_CODE_DATABASE)[
          Math.floor(Math.random() * Object.values(FAULT_CODE_DATABASE).length)
        ];
      codes.push({
        ...randomCode,
        severity: 'pending',
        freezeFrame: this.generateFreezeFrame(),
      });
    }

    this.session.foundCodes = codes;
    this.onCodesFound?.(codes);

    // Update suspicion based on codes
    for (const code of codes) {
      const current = this.session.suspicionScores.get(code.subsystem) || 0;
      this.session.suspicionScores.set(code.subsystem, current + 20);
    }

    if (codes.length === 0) {
      this.onMessage?.('No fault codes stored. Checking live data...', 'info');
    } else {
      this.onMessage?.(
        `Found ${codes.length} fault code(s).`,
        codes.length > 3 ? 'warning' : 'info'
      );
    }
  }

  private updateLiveData(deltaTime: number): void {
    if (!this.session) return;

    this.liveDataTimer += deltaTime;

    if (this.liveDataTimer >= this.config.liveDataRefreshRate) {
      this.liveDataTimer = 0;
      this.refreshLiveData();
    }
  }

  private refreshLiveData(): void {
    if (!this.session) return;

    const mechState = this.damageModel.getMechanicalState();
    const liveData: LiveDataParameter[] = [];

    for (const def of LIVE_DATA_DEFINITIONS) {
      const sub = mechState.subsystems.get(def.subsystem);
      const health = sub?.health || 100;

      // Generate value based on health
      let value = THREE.MathUtils.lerp(def.expectedMax, def.expectedMin, health / 100);
      value += (Math.random() - 0.5) * (def.max - def.min) * 0.05; // Noise

      // False negatives
      const isAbnormal = value < def.expectedMin || value > def.expectedMax;
      const reportedAbnormal = isAbnormal && Math.random() > this.config.falseNegativeRate;
      const falseAlarm = !isAbnormal && Math.random() < this.config.falsePositiveRate * 0.5;

      liveData.push({
        ...def,
        value: THREE.MathUtils.clamp(value, def.min, def.max),
        isAbnormal: reportedAbnormal || falseAlarm,
      });

      // Update suspicion based on abnormal readings
      if (reportedAbnormal || falseAlarm) {
        const current = this.session.suspicionScores.get(def.subsystem) || 0;
        this.session.suspicionScores.set(def.subsystem, current + 5);
      }
    }

    this.session.liveData = liveData;
    this.onLiveDataUpdate?.(liveData);
    this.session.moneySpent += this.config.liveDataCost;
  }

  private generateFreezeFrame(): FaultCode['freezeFrame'] {
    return {
      rpm: Math.floor(Math.random() * 3000) + 800,
      speed: Math.floor(Math.random() * 100),
      load: Math.random() * 100,
      coolantTemp: 80 + Math.random() * 30,
      fuelTrim: (Math.random() - 0.5) * 20,
    };
  }

  /**
   * Start a component test
   */
  startComponentTest(testId: string): boolean {
    if (!this.session || this.session.phase !== 'live_data') return false;

    const testDef = COMPONENT_TESTS[testId];
    if (!testDef) return false;

    // Check if player has required tools (would check inventory)
    // For now, allow all tests

    const test: ComponentTest = {
      ...testDef,
      actualResult: 'not_tested',
    };

    this.session.phase = 'component_test';
    this.phaseTimer = 0;
    this.onPhaseChange?.('component_test');
    this.onMessage?.(`Starting ${testDef.name}...`, 'info');

    // Simulate test duration
    setTimeout(() => {
      this.completeComponentTest(test);
    }, this.config.testDuration[testId] * 1000);

    return true;
  }

  private updateComponentTest(deltaTime: number): void {
    // Waiting for test to complete (handled by setTimeout)
  }

  private completeComponentTest(test: ComponentTest): void {
    if (!this.session) return;

    const sub = this.damageModel.getMechanicalState().subsystems.get(test.subsystem);
    const health = sub?.health || 100;

    // Determine result based on health
    let result: ComponentTest['actualResult'];

    if (health > 70) {
      // Healthy - should pass
      result = Math.random() < 0.95 ? 'pass' : 'inconclusive';
    } else if (health > 40) {
      // Degraded - might fail or be inconclusive
      const r = Math.random();
      if (r < 0.6) result = 'fail';
      else if (r < 0.9) result = 'inconclusive';
      else result = 'pass'; // False negative
    } else {
      // Failed - should fail
      result = Math.random() < 0.9 ? 'fail' : 'inconclusive';
    }

    test.actualResult = result;
    this.session.completedTests.push(test);
    this.session.moneySpent += this.config.componentTestCost[test.id] || 0;

    // Update suspicion
    if (result === 'fail') {
      const current = this.session.suspicionScores.get(test.subsystem) || 0;
      this.session.suspicionScores.set(test.subsystem, current + 30);
    } else if (result === 'pass') {
      const current = this.session.suspicionScores.get(test.subsystem) || 0;
      this.session.suspicionScores.set(test.subsystem, Math.max(0, current - 10));
    }

    this.onTestComplete?.(test);
    this.onMessage?.(
      `${test.name}: ${result.toUpperCase()}`,
      result === 'fail' ? 'warning' : result === 'pass' ? 'success' : 'info'
    );

    // Return to live data
    this.session.phase = 'live_data';
    this.phaseTimer = 0;
    this.onPhaseChange?.('live_data');
  }

  /**
   * Player selects a subsystem as the suspected cause
   */
  selectSubsystem(subsystem: SubsystemName): void {
    if (!this.session || this.session.phase !== 'live_data') return;

    this.session.selectedSubsystem = subsystem;
    this.session.phase = 'analysis';
    this.phaseTimer = 0;
    this.onPhaseChange?.('analysis');
    this.onMessage?.(`Analyzing ${subsystem}...`, 'info');

    // Quick analysis
    setTimeout(() => {
      this.completeAnalysis();
    }, 2000);
  }

  private updateAnalysis(deltaTime: number): void {
    // Waiting for analysis
  }

  private completeAnalysis(): void {
    if (!this.session?.selectedSubsystem) return;

    const selectedSubsystem = this.session.selectedSubsystem;
    const sub = this.damageModel.getMechanicalState().subsystems.get(selectedSubsystem);
    const actualHealth = sub?.health || 100;

    // Calculate confidence based on evidence
    let confidence = 0;

    // Codes pointing to this subsystem
    const relevantCodes = this.session.foundCodes.filter(
      c => c.subsystem === selectedSubsystem
    ).length;
    confidence += relevantCodes * 20;

    // Live data abnormalities
    const abnormalData = this.session.liveData.filter(
      d => d.subsystem === selectedSubsystem && d.isAbnormal
    ).length;
    confidence += abnormalData * 10;

    // Test results
    const failedTests = this.session.completedTests.filter(
      t => t.subsystem === selectedSubsystem && t.actualResult === 'fail'
    ).length;
    confidence += failedTests * 30;

    const passedTests = this.session.completedTests.filter(
      t => t.subsystem === selectedSubsystem && t.actualResult === 'pass'
    ).length;
    confidence -= passedTests * 15;

    // Base suspicion score
    confidence += this.session.suspicionScores.get(selectedSubsystem) || 0;

    this.session.confidence = THREE.MathUtils.clamp(confidence / 100, 0, 1);

    // Determine if correct
    const isCorrect = actualHealth < 50; // Actually faulty
    const playerConfident = this.session.confidence > 0.6;

    let success = false;
    if (isCorrect && playerConfident) {
      success = true;
      this.onMessage?.(
        `Diagnosis confirmed: ${this.session.selectedSubsystem} is faulty.`,
        'success'
      );
    } else if (!isCorrect && playerConfident) {
      success = false;
      this.onMessage?.(
        `Wrong diagnosis! ${this.session.selectedSubsystem} appears healthy.`,
        'error'
      );
    } else {
      success = false;
      this.onMessage?.('Inconclusive. Need more evidence.', 'warning');
    }

    this.endSession(
      success,
      success ? 'Fault identified correctly' : 'Diagnosis incorrect or inconclusive'
    );
  }

  private endSession(success: boolean, message: string): void {
    if (!this.session) return;

    this.session.phase = 'result';
    this.onPhaseChange?.('result');

    const result: DiagnosisResult = {
      success,
      message,
      identifiedSubsystem: this.session.selectedSubsystem,
      actualFaults: this.getActualFaults(),
      timeSpent: this.session.timeSpent,
      moneySpent: this.session.moneySpent,
      score: this.calculateScore(success),
      confidence: this.session.confidence,
    };

    this.onDiagnosisComplete?.(result);
    this.onMessage?.(message, success ? 'success' : 'error');
  }

  private getActualFaults(): SubsystemName[] {
    const faults: SubsystemName[] = [];
    const mechState = this.damageModel.getMechanicalState();
    for (const [name, sub] of mechState.subsystems) {
      if (sub.health < 50 || sub.isFailed) {
        faults.push(name);
      }
    }
    return faults;
  }

  private calculateScore(success: boolean): number {
    if (!this.session) return 0;

    let score = 0;

    if (success) {
      score = this.config.perfectScore;
      score -= this.session.timeSpent; // Time penalty
      score -= this.session.moneySpent * 2; // Cost penalty
      score += this.session.foundCodes.length * this.config.codeReadBonus;
      score += this.session.completedTests.length * this.config.testBonus;
    } else {
      score = -this.config.wrongGuessPenalty;
      score -= this.session.timeSpent * 0.5;
    }

    return Math.max(0, Math.floor(score));
  }

  private updateSuspicionFromDamage(): void {
    if (!this.session) return;

    const mechState = this.damageModel.getMechanicalState();
    for (const [name, sub] of mechState.subsystems) {
      if (sub.health < 100) {
        this.session.suspicionScores.set(name, (100 - sub.health) * 0.5);
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  getSession(): DiagnosisSession | null {
    return this.session;
  }

  getPhase(): DiagnosisPhase {
    return this.session?.phase || 'idle';
  }

  getPhaseProgress(): number {
    if (!this.session) return 0;

    switch (this.session.phase) {
      case 'connecting':
        return this.phaseTimer / this.config.connectTimeout;
      case 'reading_codes':
        return this.phaseTimer / this.config.readCodesTimeout;
      case 'live_data':
        return Math.min(1, this.session.timeSpent / this.config.maxTime);
      case 'component_test':
        return 0; // Unknown duration
      case 'analysis':
        return this.phaseTimer / 2; // 2 second analysis
      default:
        return 0;
    }
  }

  getAvailableTests(): ComponentTest[] {
    return Object.values(COMPONENT_TESTS).map(t => ({
      ...t,
      actualResult: 'not_tested',
    }));
  }

  getCompletedTests(): ComponentTest[] {
    return this.session?.completedTests || [];
  }

  getFaultCodes(): FaultCode[] {
    return this.session?.foundCodes || [];
  }

  getLiveData(): LiveDataParameter[] {
    return this.session?.liveData || [];
  }

  getSuspicionScores(): Map<SubsystemName, number> {
    return this.session?.suspicionScores || new Map();
  }

  getConfidence(): number {
    return this.session?.confidence || 0;
  }

  getTimeRemaining(): number {
    if (!this.session) return 0;
    return Math.max(0, this.config.maxTime - this.session.timeSpent);
  }

  getMoneySpent(): number {
    return this.session?.moneySpent || 0;
  }

  // Cancel current session
  cancel(): void {
    if (this.session) {
      this.session.phase = 'idle';
      this.onPhaseChange?.('idle');
      this.onMessage?.('Diagnosis cancelled.', 'info');
    }
  }

  // For tutorials - force specific codes
  setForcedCodes(codes: string[]): void {
    // Would override fault code generation
  }

  setConfig(config: Partial<DiagnosisMinigameConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): DiagnosisMinigameConfig {
    return { ...this.config };
  }
}

// ============================================
// RESULT TYPES
// ============================================

export interface DiagnosisResult {
  success: boolean;
  message: string;
  identifiedSubsystem: SubsystemName | null;
  actualFaults: SubsystemName[];
  timeSpent: number;
  moneySpent: number;
  score: number;
  confidence: number;
}

// ============================================
// OBD-II SIMULATOR (for UI)
// ============================================

export class OBD2Simulator {
  private minigame: DiagnosisMinigame;

  constructor(minigame: DiagnosisMinigame) {
    this.minigame = minigame;
  }

  // Simulated OBD-II PIDs
  static readonly PIDS = {
    // Current data
    '0100': 'PIDs Supported 01-20',
    '0101': 'Monitor Status',
    '0103': 'Fuel System Status',
    '0104': 'Calculated Engine Load',
    '0105': 'Engine Coolant Temperature',
    '0106': 'Short Term Fuel Trim Bank 1',
    '0107': 'Long Term Fuel Trim Bank 1',
    '010B': 'Intake Manifold Absolute Pressure',
    '010C': 'Engine RPM',
    '010D': 'Vehicle Speed',
    '010E': 'Timing Advance',
    '010F': 'Intake Air Temperature',
    '0110': 'MAF Air Flow Rate',
    '0111': 'Absolute Throttle Position',
    '0114': 'O2 Sensor 1 Voltage',
    '011F': 'Run Time Since Engine Start',
    '0120': 'Transmission Fluid Temperature',
    '012F': 'Fuel Tank Level Input',
    '0130': 'Warm-ups Since Codes Cleared',
    '0131': 'Distance Since Codes Cleared',

    // Mode 02 - Freeze frame
    '0202': 'Freeze Frame DTC',

    // Mode 03 - Stored DTCs
    '03': 'Request DTCs',

    // Mode 04 - Clear DTCs
    '04': 'Clear DTCs',

    // Mode 09 - Vehicle Info
    '0902': 'VIN',
    '0904': 'Calibration ID',
    '0906': 'Calibration Verification Number',
  };

  // Simulate ELM327 responses
  static simulateResponse(pid: string, vehicleState: any): string {
    switch (pid) {
      case '010C': // RPM
        return `41 0C ${(vehicleState.rpm * 4).toString(16).toUpperCase().padStart(4, '0')}`;
      case '010D': // Speed
        return `41 0D ${vehicleState.speed.toString(16).toUpperCase().padStart(2, '0')}`;
      case '0105': // Coolant temp
        return `41 05 ${(vehicleState.coolantTemp + 40).toString(16).toUpperCase().padStart(2, '0')}`;
      case '0111': // Throttle
        return `41 11 ${Math.floor(vehicleState.throttle * 255)
          .toString(16)
          .toUpperCase()
          .padStart(2, '0')}`;
      case '03': // Codes
        return this.formatCodes(vehicleState.faultCodes || []);
      default:
        return 'NO DATA';
    }
  }

  private static formatCodes(codes: string[]): string {
    if (codes.length === 0) return '43 00';
    let response = `43 ${codes.length.toString(16).toUpperCase().padStart(2, '0')}`;
    for (const code of codes) {
      // Convert P0300 to bytes
      const num = parseInt(code.substring(1), 16);
      response += ` ${(num >> 8).toString(16).toUpperCase().padStart(2, '0')} ${(num & 0xff).toString(16).toUpperCase().padStart(2, '0')}`;
    }
    return response;
  }
}

// ============================================
// EXPORTS
// ============================================

export { FAULT_CODE_DATABASE, LIVE_DATA_DEFINITIONS, COMPONENT_TESTS };
