import * as THREE from 'three';
import { SceneManager } from '../systems/SceneManager.js';
import { InputManager } from '../systems/InputManager.js';
import { CleaningSystem } from '../systems/CleaningSystem.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { FurnitureManager } from '../systems/FurnitureManager.js';
import type { NarratorContext } from '../systems/Narrator.js';
import { Narrator } from '../systems/Narrator.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import type { Job } from '../systems/JobSystem.js';
import { JobSystem, JobStatus } from '../systems/JobSystem.js';
import { HOUSE_LAYOUT } from '../systems/HouseLayout.js';
import { audioManager } from '../systems/AudioManager.js';
import { DiegeticHUD } from '../systems/DiegeticHUD.js';
import { TrashItem } from '../systems/TrashItem.js';
import { PostProcessing } from '../systems/PostProcessing.js';
import type { MemoryProfiler } from '../systems/MemoryProfiler.js';
import { memoryProfiler, performanceMonitor } from '../systems/MemoryProfiler.js';
import { DebugOverlay } from '../systems/DebugOverlay.js';
import { DEVICE } from '../systems/DeviceProfile.js';
import { TouchControls } from '../systems/TouchControls.js';
import { WorldStreamer } from '../world/WorldStreamer.js';
import { Vehicle, VehicleType } from '../vehicle/Vehicle.js';
import { VehicleSpecs, VehicleSpecsData } from '../vehicle/VehicleSpecs.js';
import { EnterExitSystem } from '../vehicle/EnterExitSystem.js';
import { VehicleCamera } from '../vehicle/VehicleCamera.js';
import { DamageModel } from '../vehicle/DamageModel.js';
import { BreakdownSystem } from '../vehicle/BreakdownSystem.js';
import { RepairBayManager } from '../repair/RepairBay.js';
import { RecoverySystem } from '../vehicle/RecoveryTruck.js';
import { GarageNetwork } from '../world/GarageNetwork.js';
import { DiagnosisMinigame } from '../repair/DiagnosisMinigame.js';
import { PartsManager } from '../repair/PartSystem.js';
import { Toolkit, ToolCatalogue } from '../repair/ToolSystem.js';

export type GameState =
  | 'ON_FOOT'
  | 'DRIVING'
  | 'CLEANING'
  | 'REPAIRING'
  | 'SHOPPING'
  | 'MENU'
  | 'DIAGNOSIS'
  | 'RECOVERY_WAIT';

export class Game {
  private renderer!: THREE.WebGLRenderer;
  private sceneManager!: SceneManager;
  private inputManager!: InputManager;
  private cleaningSystem!: CleaningSystem;
  private economySystem!: EconomySystem;
  private furnitureManager!: FurnitureManager;
  private narrator!: Narrator;
  private saveSystem!: SaveSystem;
  private shopSystem!: ShopSystem;
  private jobSystem!: JobSystem;
  private hud!: DiegeticHUD;
  private postProcessing!: PostProcessing;
  private debugOverlay!: DebugOverlay;

  // Only ever created on phones/tablets.
  private touchControls: TouchControls | null = null;

  // World & Vehicle systems
  private worldStreamer!: WorldStreamer;
  private vehicle!: Vehicle;
  private vehicleCamera!: VehicleCamera;
  private enterExitSystem!: EnterExitSystem;
  private damageModel!: DamageModel;
  private breakdownSystem!: BreakdownSystem;
  private repairBayManager!: RepairBayManager;
  private recoverySystem!: RecoverySystem;
  private garageNetwork!: GarageNetwork;
  private diagnosisMinigame!: DiagnosisMinigame;
  private partsManager!: PartsManager;
  private toolkit!: Toolkit;

  private running = false;
  private lastTime = 0;

  // Memory profiling
  private memoryProfiler!: MemoryProfiler;
  private profileTimer = 0;
  private profileInterval = 5000; // Log every 5 seconds

  // State machine
  private currentState: GameState = 'ON_FOOT';
  private previousState: GameState = 'ON_FOOT';
  private stateData = new Map<string, any>();

  // Interaction state
  private isInteracting = false;
  private lastInteractionTime = 0;

  // Performance
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private currentFps = 60;

  async init(): Promise<void> {
    this.setupRenderer();
    this.sceneManager = new SceneManager(this.renderer);
    await this.sceneManager.init();

    // Initialize world streaming first
    this.worldStreamer = new WorldStreamer(this.sceneManager, this.renderer);
    await this.worldStreamer.init();

    // Set camera bounds for current house/chunk
    this.sceneManager.cameraController.setBounds({ minX: -11, maxX: 11, minZ: -11, maxZ: 11 });

    this.inputManager = new InputManager(this.renderer.domElement);
    this.cleaningSystem = new CleaningSystem(this.sceneManager, this.inputManager);
    this.economySystem = new EconomySystem();
    this.furnitureManager = new FurnitureManager(this.sceneManager.scene);
    await this.furnitureManager.init();
    this.narrator = new Narrator();
    this.jobSystem = new JobSystem();
    this.hud = new DiegeticHUD(
      this.sceneManager.scene,
      this.sceneManager.camera,
      this.cleaningSystem
    );
    this.shopSystem = new ShopSystem(
      this.sceneManager,
      this.economySystem,
      this.furnitureManager,
      this.hud
    );

    // Initialize vehicle systems
    this.damageModel = new DamageModel();
    this.breakdownSystem = new BreakdownSystem();
    this.repairBayManager = new RepairBayManager();
    this.recoverySystem = new RecoverySystem();
    this.garageNetwork = new GarageNetwork(this.repairBayManager, this.recoverySystem, {
      worldSize: this.worldStreamer.getWorldSize(),
      garageDensity: 0.15,
    });
    this.diagnosisMinigame = new DiagnosisMinigame({} as any); // Will set proper diagnosis system later
    this.partsManager = new PartsManager({} as any); // Will set proper catalogue later
    this.toolkit = new Toolkit(new ToolCatalogue());

    // Initialize vehicle
    this.vehicle = new Vehicle({
      specs: VehicleSpecs.getPreset('hatchback'),
      scene: this.sceneManager.scene,
      damageModel: this.damageModel,
      audioManager: audioManager,
    });

    // Initialize vehicle camera with physics
    this.vehicleCamera = new VehicleCamera(
      this.vehicle.getPhysics(),
      this.vehicle.specs,
      this.sceneManager.camera
    );

    this.enterExitSystem = new EnterExitSystem(
      this.vehicle,
      this.vehicleCamera,
      this.sceneManager.camera,
      {}, // config
      {} // callbacks
    );

    // Initialize SaveSystem LAST after all dependencies are ready
    this.saveSystem = new SaveSystem(
      this.economySystem,
      this.cleaningSystem,
      this.sceneManager,
      this.furnitureManager,
      this.worldStreamer,
      this.vehicle,
      this.damageModel,
      this.breakdownSystem,
      this.garageNetwork,
      this.partsManager,
      this.toolkit,
      this.repairBayManager,
      this.recoverySystem,
      this.jobSystem
    );

    await this.saveSystem.load();
    await audioManager.init();

    // Initialize job system callbacks
    this.setupJobSystemCallbacks();

    // Generate initial jobs
    this.jobSystem.generateJobs(5);

    // Place saved furniture after loading
    await this.placeSavedFurniture();

    // Setup furniture placement callbacks
    this.setupFurniturePlacementCallbacks();

    // Post-processing
    this.setupPostProcessing();

    this.narrator.onLine = (line: string, category: string) => {
      this.hud.showPrompt(line);
    };

    // Initialize memory profiler
    this.memoryProfiler = memoryProfiler;
    this.memoryProfiler.setSystemReferences({
      assetStreamer: this.worldStreamer.getAssetStreamer(),
      worldStreamer: this.worldStreamer,
    });
    this.memoryProfiler.setBudgets({
      jsHeapMB: 300,
      texturesMB: 500,
      totalMB: 1200,
    });
    this.memoryProfiler.start(1000); // Sample every second

    this.memoryProfiler.onBudgetExceeded = (budget, current, limit) => {
      console.warn(
        `[MemoryProfiler] Budget exceeded: ${budget} = ${current.toFixed(1)}MB / ${limit}MB`
      );
      this.hud.showPrompt?.(`Memory budget exceeded: ${budget}`);
    };

    this.memoryProfiler.onMemoryLeakDetected = details => {
      console.warn(`[MemoryProfiler] Potential leak: ${details}`);
    };

    this.cleaningSystem.onProgressChange = (progress: number) => {
      this.hud.updateProgress(progress / 100);

      const activeJob = this.jobSystem.getActiveJob();
      if (activeJob) {
        const cameraPos = this.sceneManager.getCameraPosition();
        const currentRoom = this.getCurrentRoom(cameraPos);
        if (currentRoom && activeJob.targetRooms.includes(currentRoom)) {
          const decalProgress = this.cleaningSystem.getDecalSystem().getProgress();
          const trashPercent = this.cleaningSystem.trashManager.getCollectedPercent();
          this.jobSystem.updateJobProgress(currentRoom, decalProgress.percent, trashPercent);
        }
      }
    };

    this.cleaningSystem.onJobComplete = (score: number) => {
      this.onJobComplete(score);
    };

    // Vehicle callbacks
    this.setupVehicleCallbacks();

    // Breakdown callbacks
    this.setupBreakdownCallbacks();

    // Recovery callbacks
    this.setupRecoveryCallbacks();

    // Diagnosis minigame callbacks
    this.setupDiagnosisCallbacks();

    // Input bindings
    this.bindInputs();

    // Phones get on-screen controls; desktop never instantiates these.
    if (DEVICE.isMobile) this.setupTouchControls();

    // Listen for cleaning events to trigger audio/haptics
    window.addEventListener('stain-cleaned', () => {
      audioManager.play('clean_success', { volume: 0.5 });
      this.sceneManager.addHitPause(0.06);
      this.sceneManager.addScreenShake(0.03, 0.8);
      this.narrator.onStainCleaned();
    });

    window.addEventListener('trash-collected', () => {
      audioManager.play('trash_pickup', { volume: 0.6 });
      this.sceneManager.addHitPause(0.04);
      this.narrator.onTrashCollected();
    });

    window.addEventListener('missed-spot', () => {
      audioManager.play('sad_trombone', { volume: 0.7 });
      this.sceneManager.addHitPause(0.08);
      this.sceneManager.addScreenShake(0.05, 0.7);
      this.sceneManager.addLean(0.1);
      this.narrator.onMissedSpot();
    });

    window.addEventListener('furniture-placed', () => {
      audioManager.play('place', { volume: 0.5 });
      this.sceneManager.addHitPause(0.1);
      this.sceneManager.addScreenShake(0.08, 0.75);
      this.narrator.sayFurniturePlace();
    });

    window.addEventListener('resize', this.onResize.bind(this));

    // Expose systems to window for debugging
    (window as any).__game = this;
    (window as any).__jobSystem = this.jobSystem;
    (window as any).__vehicle = this.vehicle;
    (window as any).__worldStreamer = this.worldStreamer;
    (window as any).__garageNetwork = this.garageNetwork;

    // Initialize debug overlay
    this.debugOverlay = new DebugOverlay(
      this.sceneManager.scene,
      this.sceneManager.camera,
      this.memoryProfiler,
      performanceMonitor,
      {
        position: 'top-right',
        visible: true,
        showMemory: true,
        showPerformance: true,
        showSystemStats: true,
        updateInterval: 500,
      }
    );

    // Say intro line
    setTimeout(() => {
      this.narrator.sayIntro();
    }, 1500);
  }

  private setupVehicleCallbacks(): void {
    this.enterExitSystem.setCallbacks({
      onEnterComplete: () => {
        this.setState('DRIVING');
        this.narrator.onEnterVehicle();
      },
      onExitComplete: () => {
        this.setState('ON_FOOT');
        this.narrator.onExitVehicle();
      },
    });

    this.vehicle.onDamage = (damage: number, subsystem: string) => {
      this.narrator.setContext({
        vehicleHealth: this.damageModel.getMechanicalState().totalMechanicalDamage * 100,
        subsystemHealth: this.getSubsystemHealthMap(),
      });
    };

    this.vehicle.onBreakdown = (severity: 'minor' | 'major' | 'critical', subsystem: string) => {
      this.narrator.onBreakdown(severity);
      this.setState('ON_FOOT'); // Force exit vehicle
      this.enterExitSystem.forceExit();
    };
  }

  private setupBreakdownCallbacks(): void {
    this.breakdownSystem.onBreakdown = (event: any) => {
      this.narrator.onBreakdown(event.severity);
      this.hud.showBreakdownAlert(event);
    };

    this.breakdownSystem.onWarning = (
      vehicleId: string,
      subsystem: string,
      severity: string,
      message: string
    ) => {
      this.hud.showWarningLight(subsystem, severity, message);
    };

    this.breakdownSystem.onFuelLow = (vehicleId: string, fuelFraction: number) => {
      this.narrator.onFuelLow();
      this.hud.showFuelWarning(fuelFraction);
    };

    this.breakdownSystem.onRoadsideRepairComplete = (event: any) => {
      this.narrator.onRoadsideRepairSuccess();
      this.hud.hideBreakdownAlert();
    };
  }

  private setupRecoveryCallbacks(): void {
    this.recoverySystem.onRequestCreated = (request: any) => {
      this.hud.showPrompt(
        `Recovery called. ${request.quotedCost} quid. They'll be there in ${Math.round((request.acceptedAt! - Date.now()) / 60000)} mins.`
      );
    };

    this.recoverySystem.onTruckArrived = (request: any, truck: any) => {
      this.narrator.onRecoveryArrived();
      this.hud.showPrompt(
        `Recovery truck's here. ${truck.driverName}'s driving. Looks ${truck.driverPersonality}.`
      );
    };

    this.recoverySystem.onVehicleDelivered = (request: any) => {
      this.hud.hidePrompt();
      this.narrator.setContext({});
      // Use sayBreakdownRecovery instead of private speak
      this.narrator.onBreakdown?.('critical');
    };

    this.recoverySystem.onCostUpdate = (requestId: string, cost: number) => {
      this.hud.showPrompt(`Recovery cost updated: £${cost.toLocaleString()}. Waiting time, innit.`);
    };
  }

  private setupDiagnosisCallbacks(): void {
    this.diagnosisMinigame.onPhaseChange = (phase: string) => {
      // DiagnosisMinigame callback sends phase string, HUD expects state object
      // We'll track step internally
      this.hud.updateDiagnosisState?.({ phase, step: 0, totalSteps: 6 });
    };

    this.diagnosisMinigame.onCodesFound = (codes: any[]) => {
      this.hud.showFaultCodes?.(codes);
    };

    this.diagnosisMinigame.onLiveDataUpdate = (readings: any[]) => {
      this.hud.updateLiveData?.(readings);
    };

    this.diagnosisMinigame.onTestComplete = (result: any) => {
      this.hud.showTestResult?.(result);
      this.narrator.onTestResult?.(result.actualResult === 'fail');
    };

    this.diagnosisMinigame.onDiagnosisComplete = (session: any) => {
      if (session.success) {
        this.narrator.onDiagnosisComplete?.(true);
        this.setState('REPAIRING');
      } else {
        this.narrator.onDiagnosisComplete?.(false);
      }
    };
  }

  private bindInputs(): void {
    this.inputManager.onMouseMove = event => {
      this.onMouseMove(event);
    };
    this.inputManager.onMouseDown = event => {
      this.onMouseDown(event);
    };
    this.inputManager.onMouseUp = event => {
      this.onMouseUp(event);
    };
    this.inputManager.onKeyDown = event => {
      this.onKeyDown(event);
    };
    this.inputManager.onWheel = event => {
      this.onWheel(event);
    };
  }

  // ============================================
  // STATE MACHINE
  // ============================================
  setState(newState: GameState, data?: any): void {
    if (this.currentState === newState) return;

    this.previousState = this.currentState;
    this.currentState = newState;

    if (data) {
      this.stateData.set(newState, data);
    }

    this.onStateChange(this.previousState, this.currentState);
  }

  getState(): GameState {
    return this.currentState;
  }

  getPreviousState(): GameState {
    return this.previousState;
  }

  getStateData(state?: GameState): any {
    return this.stateData.get(state || this.currentState);
  }

  private onStateChange(from: GameState, to: GameState): void {
    // Disable/enable systems based on state
    this.cleaningSystem.setEnabled?.(to === 'CLEANING' || to === 'ON_FOOT');
    this.vehicle.setControllable(to === 'DRIVING');
    // this.vehicleCamera.setActive(to === 'DRIVING') // No such method
    this.enterExitSystem.setEnabled?.(to === 'ON_FOOT' || to === 'DRIVING');
    this.shopSystem.setEnabled?.(to === 'SHOPPING');
    this.furnitureManager.setPlacementModeEnabled?.(to === 'CLEANING');

    // HUD visibility
    this.hud.setDrivingMode?.(to === 'DRIVING');
    this.hud.setRepairMode?.(to === 'REPAIRING' || to === 'DIAGNOSIS');
    this.hud.setRecoveryMode?.(to === 'RECOVERY_WAIT');

    // Narrator context
    this.updateNarratorContext();

    // Camera transitions - handled by EnterExitSystem
    // this.vehicleCamera.transitionToDriving() etc don't exist

    // Audio
    audioManager.setState?.(to);

    console.log(`[Game] State: ${from} -> ${to}`);
  }

  private updateNarratorContext(): void {
    const mechanicalState = this.damageModel.getMechanicalState();
    const ctx: NarratorContext = {
      vehicleHealth: Math.round((1 - mechanicalState.totalMechanicalDamage) * 100),
      subsystemHealth: this.getSubsystemHealthMap(),
      fuelLevel: this.breakdownSystem.getFuelLevel(this.vehicle.id),
      fuelCapacity: this.vehicle.specs.fuelCapacity,
      speed: this.vehicle.getSpeed(),
      speedLimit: this.worldStreamer.getCurrentSpeedLimit(),
      gear: this.vehicle.getGear(),
      rpm: this.vehicle.getRPM(),
      redline: this.vehicle.specs.engineRedline,
      isCornering: Math.abs(this.vehicle.getLateralG()) > 0.3,
      lateralG: this.vehicle.getLateralG(),
      isParking: this.vehicle.getSpeed() < 1 && this.currentState === 'DRIVING',
      warningLights: this.damageModel.getWarningLights(),
      position: this.vehicle.getPosition(),
      hasActiveJob: this.jobSystem.getActiveJob() !== null,
      isInGarage: this.garageNetwork.getPlayerGarage() !== null,
      currentRepairTask: this.getStateData('REPAIRING')?.currentTask,
      repairQuality: this.getStateData('REPAIRING')?.quality,
      hasBreakdown: this.breakdownSystem.getActiveBreakdown(this.vehicle.id) !== undefined,
      breakdownSeverity: this.breakdownSystem.getActiveBreakdown(this.vehicle.id)?.severity,
      breakdownSubsystem: this.breakdownSystem.getActiveBreakdown(this.vehicle.id)?.subsystem,
      recoveryETA: this.garageNetwork.getRecoveryETA(
        this.getStateData('RECOVERY_WAIT')?.requestId ?? undefined
      ),
      timeOfDay: this.worldStreamer.getTimeOfDay(),
      weather: this.worldStreamer.getWeather() as 'clear' | 'fog' | 'rain' | 'snow',
    };

    this.narrator.setContext(ctx);
  }

  private getSubsystemHealthMap(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const [name, sub] of this.damageModel.getMechanicalState().subsystems) {
      map[name] = sub.health;
    }
    return map;
  }

  // ============================================
  // GAME LOOP
  // ============================================
  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.animate(performance.now());
  }

  private animate = (time: number): void => {
    if (!this.running) return;

    const delta = Math.min((time - this.lastTime) / 1000, 1 / 30);
    this.lastTime = time;

    // Update FPS counter
    this.frameCount++;
    if (time - this.lastFpsUpdate > 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = time;
      this.hud.updateFPS(this.currentFps);
    }

    // Update world streaming
    this.worldStreamer.update(delta, this.sceneManager.getCameraPosition());

    // Update vehicle physics
    if (this.currentState === 'DRIVING') {
      this.vehicle.update(delta, this.inputManager.getInputState());
      this.updateNarratorContext();

      // Check for entering house interior
      this.checkHouseEntry();
    }

    // Update breakdown system
    this.breakdownSystem.update(
      this.vehicle.id,
      delta,
      this.vehicle.getSpeed() * 3.6, // km/h
      this.vehicle.getLoad(),
      this.damageModel,
      this.currentState !== 'DRIVING'
    );

    // Update recovery system
    this.recoverySystem.update(delta, this.vehicle.getPosition());

    // Update diagnosis minigame
    if (this.currentState === 'DIAGNOSIS') {
      this.diagnosisMinigame.update(delta);
    }

    // Update repair job progress
    if (this.currentState === 'REPAIRING') {
      this.updateRepairProgress(delta);
    }

    this.sceneManager.update(delta);

    // Update continuous particle effects with tool tip pose
    if (this.cleaningSystem.scrubState.isScrubbing) {
      const pose = this.hud.getToolTipPose();
      this.cleaningSystem.updateScrubToolPose(pose.position, pose.direction);
    }

    this.cleaningSystem.update(delta);
    this.furnitureManager.update(delta);
    this.shopSystem.update(delta);
    this.hud.update(delta);
    this.updateNarratorContext();
    this.narrator.update(delta);

    this.postProcessing.render(delta);

    // Update debug overlay
    this.debugOverlay.update(delta, {
      gameState: this.currentState,
      vehicleSpeed: this.vehicle.getSpeed(),
      vehiclePosition: this.vehicle.getPosition(),
      timeOfDay: this.worldStreamer.getTimeOfDay(),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    });

    // Memory profiling
    this.profileTimer += delta * 1000;
    if (this.profileTimer >= this.profileInterval) {
      this.memoryProfiler.sample();
      this.profileTimer = 0;
    }

    requestAnimationFrame(this.animate);
  };

  private updateRepairProgress(delta: number): void {
    // Would integrate with RepairBayManager job progress
  }

  private checkHouseEntry(): void {
    const pos = this.vehicle.getPosition();
    const house = this.worldStreamer.getHouseAtPosition(pos);
    if (house && house.isDoorNearby(pos)) {
      // Show prompt to enter
      this.hud.showPrompt('[E] Enter house');
      if (this.inputManager.isKeyPressed('e')) {
        this.enterHouse(house);
      }
    }
  }

  private enterHouse(house: any): void {
    // Stream in house interior
    this.worldStreamer.loadHouseInterior(house.id);
    this.setState('CLEANING');
    this.vehicle.setEngineRunning(false);
    this.jobSystem.startJobForHouse(house.id);
    this.narrator.sayJobStart({
      clientName: house.clientName,
      title: house.jobTitle,
      flavorText: house.flavorText,
      targetRooms: house.rooms,
      description: house.description,
    });
  }

  // ============================================
  // INPUT HANDLERS
  // ============================================
  private onMouseMove(event: MouseEvent): void {
    this.sceneManager.setMouseFromEvent(event);

    if (this.furnitureManager.isInPlacementMode()) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(this.sceneManager.getMouse(), this.sceneManager.camera);
      this.furnitureManager.updatePlacement(raycaster, this.sceneManager.camera);
      return;
    }

    if (this.currentState === 'CLEANING' || this.currentState === 'ON_FOOT') {
      this.updateInteraction();
    }
  }

  private onMouseDown(event: MouseEvent): void {
    if (this.furnitureManager.isInPlacementMode()) {
      if (event.button === 0) {
        this.furnitureManager.confirmPlacement();
        return;
      } else if (event.button === 2) {
        this.furnitureManager.exitPlacementMode();
        return;
      }
    }

    if (this.shopSystem.handleMouseDown(event)) return;

    if (event.button !== 0) return;

    const now = performance.now();
    if (now - this.lastInteractionTime < 100) return;
    this.lastInteractionTime = now;

    const tool = this.cleaningSystem.getCurrentTool();
    const hit = this.getInteractionTarget();

    if (tool.type === 'trash_bag' && hit?.object.name.startsWith('trash_')) {
      const item = TrashItem.fromObject(hit.object);
      if (item && !item.collected) {
        this.cleaningSystem.collectTrash(item);
        this.sceneManager.addLean(-0.05);
      }
    } else if (
      ['spray', 'mop', 'vacuum'].includes(tool.type) &&
      hit?.object.name.startsWith('decal_')
    ) {
      const raycaster = this.sceneManager.getRaycaster();
      const decal = this.cleaningSystem.getDecalSystem().getDecalUnderCursor(raycaster);
      if (decal) {
        this.cleaningSystem.startScrubbing(decal);
        this.isInteracting = true;
        this.sceneManager.addLean(0.03);
      }
    }
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button !== 0) return;
    if (this.isInteracting) {
      this.cleaningSystem.stopScrubbing();
      this.isInteracting = false;
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.furnitureManager.isInPlacementMode()) {
      if (event.key === 'r' || event.key === 'R') {
        this.furnitureManager.rotatePreview();
        return;
      }
      if (event.key === 'Escape') {
        this.furnitureManager.exitPlacementMode();
        return;
      }
      return;
    }

    if (this.hud.isJobBoardVisible()) {
      if (event.key === 'e' || event.key === 'E') {
        const jobId = this.hud.getSelectedJobId();
        if (jobId && this.jobSystem.startJob(jobId)) {
          this.hud.showJobBoard(false);
          audioManager.play('click', { volume: 0.4 });
        }
        return;
      }
      if (event.key === 'Escape') {
        this.hud.showJobBoard(false);
        audioManager.play('click', { volume: 0.3 });
        return;
      }
      const num = parseInt(event.key);
      if (num >= 1 && num <= 9) {
        this.hud.selectJobOnBoard(num - 1);
        audioManager.play('click', { volume: 0.2 });
        return;
      }
      return;
    }

    if (this.shopSystem.handleKeyDown(event)) return;

    // Vehicle enter/exit
    if (event.key === 'e' || event.key === 'E') {
      if (this.currentState === 'ON_FOOT' && this.enterExitSystem.canEnterVehicle()) {
        this.enterExitSystem.tryEnterVehicle(this.vehicle.getPosition());
        return;
      } else if (this.currentState === 'DRIVING') {
        this.enterExitSystem.exitVehicle();
        return;
      }
    }

    // Job board
    if (event.key === 'j' || event.key === 'J') {
      if (!this.shopSystem.isShopOpen() && !this.furnitureManager.isInPlacementMode()) {
        this.hud.showJobBoard(!this.hud.isJobBoardVisible());
        if (this.hud.isJobBoardVisible()) this.refreshJobBoard();
        audioManager.play('click', { volume: 0.3 });
      }
      return;
    }

    // Tool wheel
    if (event.key === 'q' || event.key === 'Q') {
      this.hud.showToolWheel(true);
      return;
    }

    // Tool selection
    if (!this.shopSystem.isShopOpen()) {
      const num = parseInt(event.key);
      if (num >= 1 && num <= 4) {
        this.hud.selectTool(num - 1);
        audioManager.play('click', { volume: 0.3 });
        return;
      }
    }

    // Recovery cancel
    if (event.key === 'Escape' && this.currentState === 'RECOVERY_WAIT') {
      const requestId = this.getStateData('RECOVERY_WAIT')?.requestId;
      if (requestId) {
        this.garageNetwork.cancelRecovery(requestId);
        this.setState('ON_FOOT');
      }
      return;
    }

    // Toggle debug overlay (F3)
    if (event.key === 'F3') {
      this.debugOverlay.toggle();
      return;
    }

    // Diagnosis minigame keys
    if (this.currentState === 'DIAGNOSIS') {
      this.handleDiagnosisKeys(event);
    }
  }

  private handleDiagnosisKeys(event: KeyboardEvent): void {
    // Implementation for diagnosis minigame keyboard controls
  }

  private onWheel(event: WheelEvent): void {
    if (this.shopSystem.handleWheel(event)) return;

    if (
      !this.shopSystem.isShopOpen() &&
      (this.currentState === 'CLEANING' || this.currentState === 'ON_FOOT')
    ) {
      if (event.deltaY > 0) this.hud.nextTool();
      else this.hud.prevTool();
      audioManager.play('click', { volume: 0.2, pitch: event.deltaY > 0 ? 1.1 : 0.9 });
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================
  private getInteractionTarget(): THREE.Intersection | null {
    const tool = this.cleaningSystem.getCurrentTool();
    const objects: THREE.Object3D[] = [];

    if (tool.type === 'trash_bag') {
      const items = this.cleaningSystem.trashManager.getActiveItems();
      items.forEach(item => objects.push(item.object));
    } else {
      const decals = this.cleaningSystem.getDecalSystem().getAllDecals();
      decals.forEach(decal => objects.push(decal.mesh));
    }

    return this.sceneManager.raycastFirst(objects);
  }

  private updateInteraction(): void {
    const tool = this.cleaningSystem.getCurrentTool();
    const hit = this.getInteractionTarget();
    const canInteract = hit !== null;

    this.hud.updateReticle(hit, canInteract);
    this.hud.updateCrosshair(canInteract, canInteract ? 0x2ecc71 : 0xffffff);

    if (canInteract) {
      const action = tool.type === 'trash_bag' ? 'Bag' : 'Scrub';
      this.hud.showPrompt(`[LMB] ${action} ${tool.name}`);
    } else {
      this.hud.hidePrompt();
    }
  }

  private getCurrentRoom(position: THREE.Vector3): string | null {
    for (const room of HOUSE_LAYOUT) {
      const halfX = room.size.x / 2;
      const halfZ = room.size.z / 2;
      const halfY = room.size.y / 2;

      if (
        position.x >= room.position.x - halfX &&
        position.x <= room.position.x + halfX &&
        position.z >= room.position.z - halfZ &&
        position.z <= room.position.z + halfZ &&
        position.y >= room.position.y - halfY &&
        position.y <= room.position.y + halfY
      ) {
        return room.name;
      }
    }
    return null;
  }

  private onJobComplete(score: number): void {
    const budget = this.economySystem.calculateBudget(score);
    this.economySystem.addBudget(budget);
    this.narrator.onJobComplete(score);
    this.sceneManager.addHitPause(0.3);
    this.sceneManager.addScreenShake(0.15, 0.6);
    this.saveSystem.save();

    this.hud.showPrompt(`JOB DONE — ${score}% — Earned £${budget.toLocaleString()}`);
    setTimeout(() => {
      this.hud.hidePrompt();
    }, 4000);

    // Complete job in garage network for reputation
    const pos = this.sceneManager.getCameraPosition();
    this.garageNetwork.completeJobInArea(pos, budget);
  }

  private openShop(): void {
    this.setState('SHOPPING');
    this.shopSystem.open();
    this.narrator.sayShopEnter();
  }

  private closeShop(): void {
    this.shopSystem.close();
    this.setState(this.previousState === 'SHOPPING' ? 'ON_FOOT' : this.previousState);
  }

  private async placeSavedFurniture(): Promise<void> {
    const placed = this.economySystem.placedFurniture;
    for (const item of placed) {
      await this.furnitureManager.placeSavedFurniture(item.id, item.position, item.rotation);
    }
  }

  private setupFurniturePlacementCallbacks(): void {
    this.furnitureManager.onPlacementUpdate = (valid: boolean, roomName: string) => {
      if (valid) {
        this.hud.showPrompt(`[LMB] Place  [R] Rotate  [ESC] Cancel — ${roomName}`);
      } else {
        this.hud.showPrompt(
          `[LMB] Place  [R] Rotate  [ESC] Cancel — ${roomName} (Invalid position)`
        );
      }
      this.hud.updateCrosshair(valid, valid ? 0x2ecc71 : 0xe74c3c);
    };

    this.furnitureManager.onPlacementConfirm = data => {
      this.hud.hidePrompt();
      this.hud.updateCrosshair(false, 0xffffff);
      this.narrator.sayFurniturePlace();
    };

    this.furnitureManager.onPlacementCancel = () => {
      this.hud.hidePrompt();
      this.hud.updateCrosshair(false, 0xffffff);
    };
  }

  private setupJobSystemCallbacks(): void {
    this.jobSystem.onJobCreated = (job: Job) => {
      this.hud.addJobToBoard(job);
    };

    this.jobSystem.onJobStarted = (job: Job) => {
      this.setState('CLEANING');
      this.hud.showPrompt(`JOB STARTED: ${job.title}`);
      this.hud.updateJobInfo(job);
      this.narrator.sayJobStart(job);
      this.cleaningSystem.getDecalSystem().generateJobStains(job);
      this.cleaningSystem.trashManager.generateJobTrash(job);
    };

    this.jobSystem.onJobCompleted = (job: Job, finalPay: number, reputationGained: number) => {
      this.economySystem.addBudget(finalPay);
      const score = Math.round((job.requiredCleanliness + job.requiredTrashCollected) / 2);
      this.narrator.onJobComplete(score);
      this.sceneManager.addHitPause(0.3);
      this.sceneManager.addScreenShake(0.15, 0.6);
      this.saveSystem.save();

      this.hud.showPrompt(
        `JOB COMPLETE — ${job.title} — Earned £${finalPay.toLocaleString()} (${reputationGained} XP)`
      );
      this.hud.updateJobInfo(null);
      setTimeout(() => {
        this.hud.hidePrompt();
      }, 5000);

      this.cleaningSystem.getDecalSystem().clearAllDecals();
      this.cleaningSystem.trashManager.reset();
      this.setState('ON_FOOT');

      this.jobSystem.generateJobs(2);
    };

    this.jobSystem.onJobFailed = (job: Job) => {
      this.hud.showPrompt(`JOB FAILED — ${job.title} — Reputation lost`);
      this.hud.updateJobInfo(null);
      this.narrator.sayJobFail(job);
      setTimeout(() => {
        this.hud.hidePrompt();
      }, 4000);

      this.cleaningSystem.getDecalSystem().clearAllDecals();
      this.cleaningSystem.trashManager.reset();
      this.setState('ON_FOOT');

      this.jobSystem.generateJobs(1);
    };

    this.jobSystem.onReputationChanged = (level: number, reputation: number) => {
      this.hud.showPrompt(`REPUTATION UP — Level ${level} (${reputation} XP)`);
      this.narrator.sayReputationUp(level);
      setTimeout(() => {
        this.hud.hidePrompt();
      }, 3000);
      this.shopSystem.refreshCatalog();
    };
  }

  private refreshJobBoard(): void {
    const jobs = this.jobSystem.getAvailableJobs();
    this.hud.clearJobBoard();
    jobs.forEach((job, index) => {
      this.hud.addJobToBoard(job);
    });
    if (jobs.length > 0) this.hud.selectJobOnBoard(0);
  }

  private setupRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      // Mobile relies on the reduced graphics profile in DeviceProfile instead
      // of MSAA, shadows and the post-processing chain.
      antialias: !DEVICE.isMobile,
      alpha: false,
      powerPreference: DEVICE.isMobile ? 'default' : 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, DEVICE.maxPixelRatio));
    this.renderer.shadowMap.enabled = DEVICE.enableShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('app')!.appendChild(this.renderer.domElement);
  }

  private setupPostProcessing(): void {
    this.postProcessing = new PostProcessing(
      this.renderer,
      this.sceneManager.scene,
      this.sceneManager.camera
    );
    this.postProcessing.setBloomStrength(0.4);
    this.postProcessing.setBloomThreshold(0.9);
    this.postProcessing.setBloomRadius(0.6);
    this.postProcessing.setSSAOKernelRadius(6);
    this.postProcessing.setSSAOMinDistance(0.01);
    this.postProcessing.setSSAOMaxDistance(0.15);
    this.postProcessing.setFXAAEnabled(true);
    this.postProcessing.setFilmEnabled(true);
  }

  /**
   * Phones only: on-screen stick for walking/driving, drag-to-look, and buttons
   * for the actions already bound to the keyboard and mouse.
   */
  private setupTouchControls(): void {
    this.touchControls = new TouchControls({
      onMove: (x: number, y: number) => {
        this.sceneManager.cameraController.setMoveAxis(x, y);
        // The same stick drives the car: push up to accelerate, pull down to brake.
        this.inputManager.setTouchInput({
          throttle: Math.max(0, -y),
          brake: Math.max(0, y),
          steer: x,
        });
      },
      onLook: (dx: number, dy: number) => {
        this.sceneManager.cameraController.addLookDelta(dx, dy);
      },
    });
  }

  private onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, DEVICE.maxPixelRatio));
    this.sceneManager.onResize(window.innerWidth, window.innerHeight);
    this.postProcessing.onResize(window.innerWidth, window.innerHeight);
    this.hud.onResize(window.innerWidth, window.innerHeight);
    this.debugOverlay.setPosition(this.debugOverlay.isVisible() ? 'top-right' : 'top-right'); // Force reposition
  }

  // ============================================
  // PUBLIC API
  // ============================================
  getVehicle(): Vehicle {
    return this.vehicle;
  }
  getWorldStreamer(): WorldStreamer {
    return this.worldStreamer;
  }
  getGarageNetwork(): GarageNetwork {
    return this.garageNetwork;
  }
  getBreakdownSystem(): BreakdownSystem {
    return this.breakdownSystem;
  }
  getRepairBayManager(): RepairBayManager {
    return this.repairBayManager;
  }
  getPartsManager(): PartsManager {
    return this.partsManager;
  }
  getToolkit(): Toolkit {
    return this.toolkit;
  }
  getDiagnosisMinigame(): DiagnosisMinigame {
    return this.diagnosisMinigame;
  }
  getDamageModel(): DamageModel {
    return this.damageModel;
  }
  getEconomySystem(): EconomySystem {
    return this.economySystem;
  }
  getJobSystem(): JobSystem {
    return this.jobSystem;
  }
  getSaveSystem(): SaveSystem {
    return this.saveSystem;
  }
  getHUD(): DiegeticHUD {
    return this.hud;
  }
  getSceneManager(): SceneManager {
    return this.sceneManager;
  }
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }
  getDebugOverlay(): DebugOverlay {
    return this.debugOverlay;
  }

  // Save/Load
  saveGame(): void {
    this.saveSystem.save();
  }

  loadGame(): Promise<void> {
    return this.saveSystem.load();
  }

  exportSave(): string {
    return this.saveSystem.exportSave();
  }

  importSave(json: string): boolean {
    return this.saveSystem.importSave(json);
  }

  resetGame(): void {
    this.saveSystem.reset();
    this.jobSystem.generateJobs(5);
  }
}

// Type for tool types
type ToolType = 'spray' | 'mop' | 'vacuum' | 'trash_bag';
