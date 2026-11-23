import * as THREE from 'three';
import type { SceneManager } from './SceneManager.js';
import type { InputManager } from './InputManager.js';
import type { TrashManager } from './TrashManager.js';
import { TrashItem } from './TrashItem.js';
import { ParticleSystem } from './ParticleSystem.js';
import type { DecalData } from './DecalSystem.js';
import { DecalSystem } from './DecalSystem.js';
import { FluidSimulation } from './FluidSimulation.js';

export type ToolType = 'spray' | 'mop' | 'vacuum' | 'trash_bag';

export interface ScrubState {
  isScrubbing: boolean;
  target: DecalData | null;
  toolType: ToolType;
  toolPosition: THREE.Vector3;
  toolDirection: THREE.Vector3;
  scrubPhase: number;
  pressure: number;
  circularMotion: number;
}

interface Tool {
  type: ToolType;
  name: string;
  icon: string;
  cursor: string;
  effectiveOn: string[];
  cooldown: number;
  lastUse: number;
  // Tool-specific properties
  sprayRadius?: number;
  mopWidth?: number;
  vacuumSuction?: number;
}

const TOOLS: Tool[] = [
  {
    type: 'spray',
    name: 'Spray Cleaner',
    icon: '🧴',
    cursor: 'crosshair',
    effectiveOn: ['stain'],
    cooldown: 0.08,
    lastUse: 0,
    sprayRadius: 0.25,
  },
  {
    type: 'mop',
    name: 'Mop',
    icon: '🧹',
    cursor: 'grab',
    effectiveOn: ['stain'],
    cooldown: 0.06,
    lastUse: 0,
    mopWidth: 0.3,
  },
  {
    type: 'vacuum',
    name: 'Vacuum',
    icon: '🌀',
    cursor: 'crosshair',
    effectiveOn: ['stain', 'dust'],
    cooldown: 0.05,
    lastUse: 0,
    vacuumSuction: 1.2,
  },
  {
    type: 'trash_bag',
    name: 'Trash Bag',
    icon: '🗑️',
    cursor: 'pointer',
    effectiveOn: ['trash'],
    cooldown: 0.15,
    lastUse: 0,
  },
];

export class CleaningSystem {
  public currentTool: ToolType = 'spray';
  public onProgressChange?: (progress: number) => void;
  public onJobComplete?: (score: number) => void;

  // Scrub state for continuous interaction
  public isScrubbing = false;
  public scrubStartTime = 0;
  public scrubTarget: DecalData | null = null;

  // Public scrub state for external systems (like continuous particles, haptics)
  public scrubState: ScrubState = {
    isScrubbing: false,
    target: null,
    toolType: 'spray',
    toolPosition: new THREE.Vector3(),
    toolDirection: new THREE.Vector3(0, -1, 0),
    scrubPhase: 0,
    pressure: 1.0,
    circularMotion: 0,
  };

  private sceneManager: SceneManager;
  private inputManager: InputManager;
  public trashManager: TrashManager;
  private particleSystem: ParticleSystem;
  private decalSystem: DecalSystem;
  private fluidSimulation: FluidSimulation;

  private tools = new Map<ToolType, Tool>();
  private highlightedTrash: TrashItem | null = null;
  private highlightedDecal: DecalData | null = null;
  private lastProgress = 0;

  // Mouse tracking for circular motion detection
  private lastMousePosition = new THREE.Vector2();
  private mouseVelocity = new THREE.Vector2();
  private scrubCenter = new THREE.Vector2();
  private scrubRadius = 0;

  constructor(sceneManager: SceneManager, inputManager: InputManager) {
    this.sceneManager = sceneManager;
    this.inputManager = inputManager;
    this.trashManager = sceneManager.room.trashManager;
    this.particleSystem = new ParticleSystem(sceneManager.scene);
    this.decalSystem = new DecalSystem(sceneManager);
    this.fluidSimulation = new FluidSimulation(sceneManager.scene, this.particleSystem);

    TOOLS.forEach(t => this.tools.set(t.type, { ...t }));

    // Input is handled by Game.ts
    this.setupInput();
  }

  private setupInput(): void {
    // No-op - handled by Game.ts
  }

  // === PUBLIC API ===

  public getDecalSystem(): DecalSystem {
    return this.decalSystem;
  }

  public getFluidSimulation(): FluidSimulation {
    return this.fluidSimulation;
  }

  public getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  public setTool(type: ToolType): void {
    this.currentTool = type;
    this.updateCursor();

    // Stop any active fluid effects when switching tools
    this.fluidSimulation.stopSpray();
    this.fluidSimulation.stopMopTrail();
    this.fluidSimulation.stopVacuum();

    // Notify UI
    window.dispatchEvent(new CustomEvent('tool-change', { detail: { tool: type } }));
  }

  public collectTrash(item: TrashItem): void {
    item.collect();
    this.particleSystem.emitTrashCollected(item.object.position.clone());
    this.trashManager.removeItem(item);
    window.dispatchEvent(new CustomEvent('trash-collected'));
    this.checkJobComplete();
  }

  public startScrubbing(decal: DecalData): void {
    this.isScrubbing = true;
    this.scrubTarget = decal;
    this.scrubStartTime = performance.now() / 1000;

    // Initialize scrub state for continuous effects
    this.scrubState.isScrubbing = true;
    this.scrubState.target = decal;
    this.scrubState.toolType = this.currentTool;
    this.scrubState.scrubPhase = 0;
    this.scrubState.pressure = 1.0;
    this.scrubState.circularMotion = 0;

    // Start tool-specific fluid effects
    const pose = this.getToolTipPose();
    this.scrubState.toolPosition.copy(pose.position);
    this.scrubState.toolDirection.copy(pose.direction);

    switch (this.currentTool) {
      case 'spray':
        this.fluidSimulation.startMopTrail(pose.position); // Reuse for spray start
        break;
      case 'mop':
        this.fluidSimulation.startMopTrail(pose.position);
        break;
      case 'vacuum':
        // Vacuum starts on update
        break;
    }
  }

  public stopScrubbing(): number {
    if (!this.scrubTarget) return 0;

    const scrubDuration = performance.now() / 1000 - this.scrubStartTime;
    const baseScrubs = Math.floor(scrubDuration * 10);

    // Bonus for circular motion (House Flipper mechanic)
    const motionBonus = Math.min(this.scrubState.circularMotion * 2, 5);
    const totalScrubs = baseScrubs + Math.floor(motionBonus);

    if (totalScrubs > 0) {
      this.applyScrubs(this.scrubTarget, totalScrubs);
    }

    // Trigger haptics/feedback
    this.sceneManager.addHitPause(0.02 * Math.min(totalScrubs, 3));

    this.isScrubbing = false;
    this.scrubTarget = null;

    // Stop fluid effects
    this.fluidSimulation.stopSpray();
    this.fluidSimulation.stopMopTrail();
    this.fluidSimulation.stopVacuum();

    // Update scrub state
    this.scrubState.isScrubbing = false;
    this.scrubState.target = null;
    this.scrubState.circularMotion = 0;

    return totalScrubs;
  }

  // Update scrub tool position/direction for continuous effects (called from Game.ts)
  public updateScrubToolPose(position: THREE.Vector3, direction: THREE.Vector3): void {
    this.scrubState.toolPosition.copy(position);
    this.scrubState.toolDirection.copy(direction);
  }

  public applyScrubs(decal: DecalData, scrubs: number): void {
    // Use the decal system's cleaning with tool-specific effectiveness
    // Trash bag doesn't clean stains
    if (this.currentTool === 'trash_bag') return;

    const tool = this.tools.get(this.currentTool)!;
    const radius = tool.sprayRadius || tool.mopWidth || 0.2;
    const pressure = this.scrubState.pressure;

    const result = this.decalSystem.cleanAtPosition(
      decal.surfacePoint,
      this.currentTool,
      pressure,
      radius
    );

    if (result.cleaned > 0) {
      // Emit particles at stain location
      this.particleSystem.emitScrub(decal.surfacePoint.clone(), this.currentTool);

      // Trigger clean event if fully removed
      if (result.removed) {
        window.dispatchEvent(new CustomEvent('stain-cleaned'));
      }

      // Update scrub state circular motion tracking
      this.updateCircularMotion();

      // Add screen shake for satisfying feedback
      this.sceneManager.addScreenShake(0.01 * Math.min(scrubs, 3), 0.5);
    }
  }

  private updateCircularMotion(): void {
    // Track mouse movement in screen space for circular motion detection
    const mouse = this.sceneManager.getMouse();
    const currentPos = new THREE.Vector2(mouse.x, mouse.y);

    if (this.scrubState.circularMotion === 0) {
      this.scrubCenter.copy(currentPos);
    }

    const toCenter = currentPos.clone().sub(this.scrubCenter);
    const dist = toCenter.length();
    this.scrubRadius = Math.max(this.scrubRadius, dist);

    // Calculate angular velocity
    const lastToCenter = this.lastMousePosition.clone().sub(this.scrubCenter);
    if (lastToCenter.length() > 0.001 && toCenter.length() > 0.001) {
      const cross = lastToCenter.x * toCenter.y - lastToCenter.y * toCenter.x;
      const dot = lastToCenter.dot(toCenter);
      const angle = Math.atan2(cross, dot);
      this.scrubState.circularMotion += Math.abs(angle);
    }

    this.lastMousePosition.copy(currentPos);
    this.scrubState.scrubPhase += 0.1;
  }

  // Get tool tip position and direction from HUD (for continuous effects)
  public getToolTipPose(): { position: THREE.Vector3; direction: THREE.Vector3 } {
    // This will be populated by Game.ts from the HUD
    // Default to camera forward if not available
    const camera = this.sceneManager.camera;
    const position = new THREE.Vector3();
    camera.getWorldPosition(position);
    position.addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 1.5);
    position.y -= 0.3;

    const direction = camera.getWorldDirection(new THREE.Vector3());
    direction.y = -0.5;
    direction.normalize();

    return { position, direction };
  }

  // === HIGHLIGHTING ===

  private updateHighlights(): void {
    // Clear previous highlights
    if (this.highlightedTrash) {
      this.highlightedTrash.setHighlighted(false);
      this.highlightedTrash = null;
    }
    if (this.highlightedDecal) {
      this.highlightedDecal = null;
    }

    const tool = this.tools.get(this.currentTool)!;
    const raycaster = this.sceneManager.getRaycaster();

    if (tool.effectiveOn.includes('trash')) {
      const hit = this.sceneManager.raycastFirst(
        this.trashManager.getActiveItems().map(i => i.object)
      );
      if (hit) {
        // The hit is one of the model's child meshes, so walk up to its owner.
        const item = TrashItem.fromObject(hit.object);
        if (item && !item.collected) {
          this.highlightedTrash = item;
          item.setHighlighted(true);
        }
      }
    }

    if (tool.effectiveOn.includes('stain') || tool.effectiveOn.includes('dust')) {
      const decal = this.decalSystem.getDecalUnderCursor(raycaster);
      if (decal) {
        this.highlightedDecal = decal;
        // Visual highlight on decal
        const material = decal.mesh.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(0x2ecc71);
        material.emissiveIntensity = 0.3;
        material.needsUpdate = true;
      }
    }
  }

  private updateCursor(): void {
    const tool = this.tools.get(this.currentTool)!;
    const renderer = this.sceneManager.getRenderer();
    if (renderer) {
      renderer.domElement.style.cursor = tool.cursor;
    }
  }

  // === JOB PROGRESS ===

  private checkJobComplete(): void {
    const decalProgress = this.decalSystem.getProgress();
    const trashPercent = this.trashManager.getCollectedPercent();
    const overall = Math.round((decalProgress.percent + trashPercent) / 2);

    this.onProgressChange?.(overall);

    if (decalProgress.percent >= 100 && trashPercent >= 100) {
      this.onJobComplete?.(overall);
    }
  }

  // === UPDATE LOOP ===

  update(delta: number): void {
    // Update highlights
    this.updateHighlights();

    // Update particle systems
    this.particleSystem.update(delta);
    this.fluidSimulation.update(delta);
    this.decalSystem.update(delta);

    // Continuous scrubbing while mouse held
    if (this.isScrubbing && this.scrubTarget && this.scrubTarget.cleanedAmount < 1) {
      const tool = this.tools.get(this.currentTool)!;
      const now = performance.now() / 1000;

      if (now - tool.lastUse >= tool.cooldown) {
        this.applyScrubs(this.scrubTarget, 1);
        tool.lastUse = now;

        // Update fluid simulation with current tool pose
        const pose = this.getToolTipPose();
        this.updateScrubToolPose(pose.position, pose.direction);

        switch (this.currentTool) {
          case 'spray':
            this.fluidSimulation.updateSpray(
              pose.position,
              pose.direction,
              delta,
              this.scrubState.pressure
            );
            break;
          case 'mop':
            this.fluidSimulation.addMopTrailPoint(
              pose.position,
              pose.direction,
              this.scrubState.pressure
            );
            break;
          case 'vacuum':
            this.fluidSimulation.updateVacuum(
              pose.position,
              pose.direction,
              delta,
              tool.vacuumSuction || 1.0
            );
            break;
        }
      }
    } else {
      // Stop continuous effects when not scrubbing
      this.fluidSimulation.stopSpray();
      this.fluidSimulation.stopMopTrail();
      this.fluidSimulation.stopVacuum();
    }
  }

  getCurrentTool(): Tool {
    return this.tools.get(this.currentTool)!;
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getProgress(): { stains: number; trash: number; overall: number } {
    const decalProgress = this.decalSystem.getProgress();
    return {
      stains: Math.round(decalProgress.percent),
      trash: this.trashManager.getCollectedPercent(),
      overall: Math.round((decalProgress.percent + this.trashManager.getCollectedPercent()) / 2),
    };
  }

  reset(): void {
    this.decalSystem.clearAllDecals();
    this.trashManager.reset();
    this.highlightedTrash = null;
    this.highlightedDecal = null;
    this.isScrubbing = false;
    this.lastProgress = 0;
    this.scrubState.circularMotion = 0;
    this.onProgressChange?.(0);
  }

  dispose(): void {
    this.particleSystem.dispose();
    this.decalSystem.dispose();
    this.fluidSimulation.dispose();
  }

  // Enable/disable the cleaning system based on game state
  setEnabled(enabled: boolean): void {
    if (enabled) {
      // Re-enable cleaning interactions
      this.currentTool = 'spray';
      this.updateCursor();
    } else {
      // Disable cleaning interactions
      this.fluidSimulation.stopSpray();
      this.fluidSimulation.stopMopTrail();
      this.fluidSimulation.stopVacuum();
      this.isScrubbing = false;
      this.scrubTarget = null;
    }
  }
}
