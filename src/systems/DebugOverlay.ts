import * as THREE from 'three';
import type { MemoryProfiler, MemorySnapshot, PerformanceMonitor } from './MemoryProfiler.js';

export interface DebugOverlayOptions {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  visible?: boolean;
  showMemory?: boolean;
  showPerformance?: boolean;
  showSystemStats?: boolean;
  updateInterval?: number;
}

export class DebugOverlay {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private memoryProfiler: MemoryProfiler;
  private performanceMonitor: PerformanceMonitor;
  private options: Required<DebugOverlayOptions>;

  private overlayGroup!: THREE.Group;
  private panels = new Map<string, THREE.Group>();
  private textMeshes = new Map<string, THREE.Mesh>();
  private updateTimer = 0;
  private lastStats: {
    memory?: MemorySnapshot;
    fps: number;
    frameStats: { min: number; max: number; avg: number; p99: number };
  } = {
    fps: 0,
    frameStats: { min: 0, max: 0, avg: 0, p99: 0 },
  };

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    memoryProfiler: MemoryProfiler,
    performanceMonitor: PerformanceMonitor,
    options: DebugOverlayOptions = {}
  ) {
    this.scene = scene;
    this.camera = camera;
    this.memoryProfiler = memoryProfiler;
    this.performanceMonitor = performanceMonitor;
    this.options = {
      position: options.position || 'top-right',
      visible: options.visible ?? true,
      showMemory: options.showMemory ?? true,
      showPerformance: options.showPerformance ?? true,
      showSystemStats: options.showSystemStats ?? true,
      updateInterval: options.updateInterval || 500,
    };

    this.createOverlay();
    if (!this.options.visible) {
      this.overlayGroup.visible = false;
    }
  }

  private createOverlay(): void {
    this.overlayGroup = new THREE.Group();
    this.overlayGroup.name = 'debugOverlay';
    this.camera.add(this.overlayGroup);

    // Position based on option
    const positions: Record<string, THREE.Vector3> = {
      'top-left': new THREE.Vector3(-0.95, 0.9, -1),
      'top-right': new THREE.Vector3(0.95, 0.9, -1),
      'bottom-left': new THREE.Vector3(-0.95, -0.9, -1),
      'bottom-right': new THREE.Vector3(0.95, -0.9, -1),
    };
    this.overlayGroup.position.copy(positions[this.options.position]);

    // Create panels
    if (this.options.showPerformance) {
      this.createPerformancePanel();
    }
    if (this.options.showMemory) {
      this.createMemoryPanel();
    }
    if (this.options.showSystemStats) {
      this.createSystemStatsPanel();
    }

    // Set render order to be on top
    this.overlayGroup.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.renderOrder = 2000;
        if (child.material) {
          child.material.depthTest = false;
          child.material.depthWrite = false;
        }
      }
    });
  }

  private createPanelBackground(
    width: number,
    height: number,
    color = 0x0a0a10,
    opacity = 0.85
  ): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1999;
    return mesh;
  }

  private createTextMesh(
    text: string,
    options: {
      color?: number;
      size?: number;
      width?: number;
      height?: number;
      align?: 'left' | 'center' | 'right';
      fontWeight?: string;
    } = {}
  ): THREE.Mesh {
    const {
      color = 0xffffff,
      size = 12,
      width = 0.4,
      height = 0.022,
      align = 'left',
      fontWeight = '500',
    } = options;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `${fontWeight} ${size}px "Space Mono", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');

    const x = align === 'left' ? 16 : align === 'center' ? 256 : 496;
    ctx.fillText(text, x, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;

    const geo = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2001;
    return mesh;
  }

  private updateTextMesh(mesh: THREE.Mesh, text: string, color = 0xffffff, size = 12): void {
    if (mesh.material instanceof THREE.MeshBasicMaterial && mesh.material.map) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.font = `500 ${size}px "Space Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
      ctx.fillText(text, 16, 32);

      mesh.material.map.dispose();
      mesh.material.map = new THREE.CanvasTexture(canvas);
      mesh.material.map.needsUpdate = true;
      mesh.material.needsUpdate = true;
    }
  }

  private createPerformancePanel(): void {
    const panel = new THREE.Group();
    panel.name = 'performancePanel';

    const bg = this.createPanelBackground(0.42, 0.22);
    bg.position.set(0, 0, -0.01);
    panel.add(bg);

    // Title
    const title = this.createTextMesh('PERFORMANCE', {
      color: 0x2ecc71,
      size: 14,
      width: 0.38,
      fontWeight: '600',
    });
    title.position.set(-0.19, 0.08, 0.01);
    panel.add(title);

    // FPS
    const fpsMesh = this.createTextMesh('FPS: --', { color: 0x2ecc71, size: 13, width: 0.38 });
    fpsMesh.position.set(-0.19, 0.045, 0.01);
    panel.add(fpsMesh);
    this.textMeshes.set('fps', fpsMesh);

    // Frame time
    const frameMesh = this.createTextMesh('Frame: --ms', {
      color: 0xf39c12,
      size: 12,
      width: 0.38,
    });
    frameMesh.position.set(-0.19, 0.02, 0.01);
    panel.add(frameMesh);
    this.textMeshes.set('frameTime', frameMesh);

    // P99
    const p99Mesh = this.createTextMesh('P99: --ms', { color: 0xe74c3c, size: 12, width: 0.38 });
    p99Mesh.position.set(-0.19, -0.005, 0.01);
    panel.add(p99Mesh);
    this.textMeshes.set('p99', p99Mesh);

    // Min/Max
    const minMaxMesh = this.createTextMesh('Min: --ms  Max: --ms', {
      color: 0x888888,
      size: 11,
      width: 0.38,
    });
    minMaxMesh.position.set(-0.19, -0.03, 0.01);
    panel.add(minMaxMesh);
    this.textMeshes.set('minMax', minMaxMesh);

    // Draw calls
    const drawCallsMesh = this.createTextMesh('Draw Calls: --', {
      color: 0x3498db,
      size: 12,
      width: 0.38,
    });
    drawCallsMesh.position.set(-0.19, -0.055, 0.01);
    panel.add(drawCallsMesh);
    this.textMeshes.set('drawCalls', drawCallsMesh);

    // Triangles
    const trisMesh = this.createTextMesh('Triangles: --', {
      color: 0x9b59b6,
      size: 12,
      width: 0.38,
    });
    trisMesh.position.set(-0.19, -0.08, 0.01);
    panel.add(trisMesh);
    this.textMeshes.set('triangles', trisMesh);

    this.panels.set('performance', panel);
    this.overlayGroup.add(panel);
  }

  private createMemoryPanel(): void {
    const panel = new THREE.Group();
    panel.name = 'memoryPanel';

    const perfPanel = this.panels.get('performance');
    const yOffset = perfPanel ? -0.24 : 0;

    const bg = this.createPanelBackground(0.42, 0.28);
    bg.position.set(0, yOffset, -0.01);
    panel.add(bg);

    // Title
    const title = this.createTextMesh('MEMORY', {
      color: 0x3498db,
      size: 14,
      width: 0.38,
      fontWeight: '600',
    });
    title.position.set(-0.19, yOffset + 0.12, 0.01);
    panel.add(title);

    // JS Heap
    const jsHeapMesh = this.createTextMesh('JS Heap: -- MB / -- MB', {
      color: 0xe74c3c,
      size: 12,
      width: 0.38,
    });
    jsHeapMesh.position.set(-0.19, yOffset + 0.085, 0.01);
    panel.add(jsHeapMesh);
    this.textMeshes.set('jsHeap', jsHeapMesh);

    // Asset Cache
    const assetMesh = this.createTextMesh('Asset Cache: -- MB', {
      color: 0xf39c12,
      size: 12,
      width: 0.38,
    });
    assetMesh.position.set(-0.19, yOffset + 0.06, 0.01);
    panel.add(assetMesh);
    this.textMeshes.set('assetCache', assetMesh);

    // World Chunks
    const chunksMesh = this.createTextMesh('Chunks: --  Houses: --', {
      color: 0x2ecc71,
      size: 12,
      width: 0.38,
    });
    chunksMesh.position.set(-0.19, yOffset + 0.035, 0.01);
    panel.add(chunksMesh);
    this.textMeshes.set('chunks', chunksMesh);

    // AI Traffic
    const aiMesh = this.createTextMesh('AI Vehicles: --  Player Vehicles: --', {
      color: 0x9b59b6,
      size: 12,
      width: 0.38,
    });
    aiMesh.position.set(-0.19, yOffset + 0.01, 0.01);
    panel.add(aiMesh);
    this.textMeshes.set('aiTraffic', aiMesh);

    // Trend
    const trendMesh = this.createTextMesh('Trend: --', { color: 0x888888, size: 11, width: 0.38 });
    trendMesh.position.set(-0.19, yOffset - 0.015, 0.01);
    panel.add(trendMesh);
    this.textMeshes.set('trend', trendMesh);

    // Budget status
    const budgetMesh = this.createTextMesh('Budget: --', {
      color: 0xffffff,
      size: 11,
      width: 0.38,
    });
    budgetMesh.position.set(-0.19, yOffset - 0.04, 0.01);
    panel.add(budgetMesh);
    this.textMeshes.set('budget', budgetMesh);

    // Average/Peak
    const avgMesh = this.createTextMesh('Avg: -- MB  Peak: -- MB', {
      color: 0x888888,
      size: 11,
      width: 0.38,
    });
    avgMesh.position.set(-0.19, yOffset - 0.065, 0.01);
    panel.add(avgMesh);
    this.textMeshes.set('avgPeak', avgMesh);

    this.panels.set('memory', panel);
    this.overlayGroup.add(panel);
  }

  private createSystemStatsPanel(): void {
    const panel = new THREE.Group();
    panel.name = 'systemStatsPanel';

    const memPanel = this.panels.get('memory');
    const perfPanel = this.panels.get('performance');
    const baseY = memPanel ? -0.52 : perfPanel ? -0.24 : 0;

    const bg = this.createPanelBackground(0.42, 0.18);
    bg.position.set(0, baseY, -0.01);
    panel.add(bg);

    // Title
    const title = this.createTextMesh('SYSTEM', {
      color: 0xe67e22,
      size: 14,
      width: 0.38,
      fontWeight: '600',
    });
    title.position.set(-0.19, baseY + 0.07, 0.01);
    panel.add(title);

    // Game state
    const stateMesh = this.createTextMesh('State: --', { color: 0xffffff, size: 12, width: 0.38 });
    stateMesh.position.set(-0.19, baseY + 0.035, 0.01);
    panel.add(stateMesh);
    this.textMeshes.set('gameState', stateMesh);

    // Vehicle speed
    const speedMesh = this.createTextMesh('Speed: -- km/h', {
      color: 0x2ecc71,
      size: 12,
      width: 0.38,
    });
    speedMesh.position.set(-0.19, baseY + 0.01, 0.01);
    panel.add(speedMesh);
    this.textMeshes.set('speed', speedMesh);

    // Position
    const posMesh = this.createTextMesh('Pos: (0, 0, 0)', {
      color: 0x888888,
      size: 11,
      width: 0.38,
    });
    posMesh.position.set(-0.19, baseY - 0.015, 0.01);
    panel.add(posMesh);
    this.textMeshes.set('position', posMesh);

    // Time of day
    const timeMesh = this.createTextMesh('Time: --:--', { color: 0x888888, size: 11, width: 0.38 });
    timeMesh.position.set(-0.19, baseY - 0.04, 0.01);
    panel.add(timeMesh);
    this.textMeshes.set('timeOfDay', timeMesh);

    this.panels.set('systemStats', panel);
    this.overlayGroup.add(panel);
  }

  update(
    delta: number,
    extraData?: {
      gameState?: string;
      vehicleSpeed?: number;
      vehiclePosition?: THREE.Vector3;
      timeOfDay?: number;
      drawCalls?: number;
      triangles?: number;
    }
  ): void {
    this.updateTimer += delta * 1000;
    if (this.updateTimer < this.options.updateInterval) return;
    this.updateTimer = 0;

    // Update performance stats
    if (this.options.showPerformance) {
      const fps = this.performanceMonitor.getFPS();
      const frameStats = this.performanceMonitor.getFrameTimeStats();

      this.updateTextMesh(
        this.textMeshes.get('fps')!,
        `FPS: ${fps.toFixed(1)}`,
        fps >= 55 ? 0x2ecc71 : fps >= 30 ? 0xf39c12 : 0xe74c3c
      );
      this.updateTextMesh(
        this.textMeshes.get('frameTime')!,
        `Frame: ${frameStats.avg.toFixed(2)}ms`,
        frameStats.avg <= 16.67 ? 0x2ecc71 : frameStats.avg <= 33.33 ? 0xf39c12 : 0xe74c3c
      );
      this.updateTextMesh(
        this.textMeshes.get('p99')!,
        `P99: ${frameStats.p99.toFixed(2)}ms`,
        frameStats.p99 <= 16.67 ? 0x2ecc71 : frameStats.p99 <= 33.33 ? 0xf39c12 : 0xe74c3c
      );
      this.updateTextMesh(
        this.textMeshes.get('minMax')!,
        `Min: ${frameStats.min.toFixed(2)}ms  Max: ${frameStats.max.toFixed(2)}ms`
      );

      if (extraData?.drawCalls !== undefined) {
        this.updateTextMesh(
          this.textMeshes.get('drawCalls')!,
          `Draw Calls: ${extraData.drawCalls}`,
          extraData.drawCalls <= 100 ? 0x2ecc71 : extraData.drawCalls <= 200 ? 0xf39c12 : 0xe74c3c
        );
      }
      if (extraData?.triangles !== undefined) {
        const tris = extraData.triangles;
        const trisStr =
          tris >= 1e6
            ? `${(tris / 1e6).toFixed(1)}M`
            : tris >= 1e3
              ? `${(tris / 1e3).toFixed(0)}K`
              : `${tris}`;
        this.updateTextMesh(
          this.textMeshes.get('triangles')!,
          `Triangles: ${trisStr}`,
          tris <= 100000 ? 0x2ecc71 : tris <= 500000 ? 0xf39c12 : 0xe74c3c
        );
      }
    }

    // Update memory stats
    if (this.options.showMemory) {
      const snapshot = this.memoryProfiler.getCurrentSnapshot();
      const stats = this.memoryProfiler.getStats();

      if (snapshot) {
        const jsHeapMB = snapshot.jsHeap.used / (1024 * 1024);
        const jsHeapTotalMB = snapshot.jsHeap.total / (1024 * 1024);
        const assetCacheMB = snapshot.custom.assetCache / (1024 * 1024);

        this.updateTextMesh(
          this.textMeshes.get('jsHeap')!,
          `JS Heap: ${jsHeapMB.toFixed(1)} MB / ${jsHeapTotalMB.toFixed(1)} MB`,
          jsHeapMB > 250 ? 0xe74c3c : jsHeapMB > 150 ? 0xf39c12 : 0x2ecc71
        );
        this.updateTextMesh(
          this.textMeshes.get('assetCache')!,
          `Asset Cache: ${assetCacheMB.toFixed(1)} MB`,
          assetCacheMB > 400 ? 0xe74c3c : assetCacheMB > 250 ? 0xf39c12 : 0x2ecc71
        );
        this.updateTextMesh(
          this.textMeshes.get('chunks')!,
          `Chunks: ${snapshot.custom.worldChunks}  Houses: ${snapshot.custom.houses}`
        );
        this.updateTextMesh(
          this.textMeshes.get('aiTraffic')!,
          `AI Vehicles: ${snapshot.custom.aiTraffic}  Player Vehicles: ${snapshot.custom.vehicles}`
        );

        this.updateTextMesh(
          this.textMeshes.get('trend')!,
          `Trend: ${stats.trend}`,
          stats.trend === 'growing' ? 0xe74c3c : stats.trend === 'shrinking' ? 0x2ecc71 : 0x888888
        );

        const heapBudgetPct = (jsHeapMB / 300) * 100;
        const assetBudgetPct = (assetCacheMB / 500) * 100;
        const overallPct = Math.max(heapBudgetPct, assetBudgetPct);
        this.updateTextMesh(
          this.textMeshes.get('budget')!,
          `Budget: ${overallPct.toFixed(0)}% (Heap ${heapBudgetPct.toFixed(0)}% / Assets ${assetBudgetPct.toFixed(0)}%)`,
          overallPct > 90 ? 0xe74c3c : overallPct > 70 ? 0xf39c12 : 0x2ecc71
        );

        if (stats.average && stats.peak) {
          const avgMB = (stats.average.jsHeap?.used || 0) / (1024 * 1024);
          const peakMB = (stats.peak.jsHeap?.used || 0) / (1024 * 1024);
          this.updateTextMesh(
            this.textMeshes.get('avgPeak')!,
            `Avg: ${avgMB.toFixed(1)} MB  Peak: ${peakMB.toFixed(1)} MB`
          );
        }
      }
    }

    // Update system stats
    if (this.options.showSystemStats && extraData) {
      if (extraData.gameState) {
        this.updateTextMesh(this.textMeshes.get('gameState')!, `State: ${extraData.gameState}`);
      }
      if (extraData.vehicleSpeed !== undefined) {
        this.updateTextMesh(
          this.textMeshes.get('speed')!,
          `Speed: ${Math.round(extraData.vehicleSpeed * 3.6)} km/h`
        );
      }
      if (extraData.vehiclePosition) {
        const pos = extraData.vehiclePosition;
        this.updateTextMesh(
          this.textMeshes.get('position')!,
          `Pos: (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)})`
        );
      }
      if (extraData.timeOfDay !== undefined) {
        const hours = Math.floor(extraData.timeOfDay * 24);
        const mins = Math.floor((extraData.timeOfDay * 24 * 60) % 60);
        this.updateTextMesh(
          this.textMeshes.get('timeOfDay')!,
          `Time: ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
        );
      }
    }
  }

  setVisible(visible: boolean): void {
    this.options.visible = visible;
    this.overlayGroup.visible = visible;
  }

  toggle(): void {
    this.setVisible(!this.options.visible);
  }

  isVisible(): boolean {
    return this.options.visible;
  }

  setPosition(position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'): void {
    this.options.position = position;
    const positions: Record<string, THREE.Vector3> = {
      'top-left': new THREE.Vector3(-0.95, 0.9, -1),
      'top-right': new THREE.Vector3(0.95, 0.9, -1),
      'bottom-left': new THREE.Vector3(-0.95, -0.9, -1),
      'bottom-right': new THREE.Vector3(0.95, -0.9, -1),
    };
    this.overlayGroup.position.copy(positions[position]);
  }

  dispose(): void {
    this.camera.remove(this.overlayGroup);
    this.overlayGroup.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      }
    });
  }
}

// Singleton instance
let debugOverlayInstance: DebugOverlay | null = null;

export function createDebugOverlay(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  memoryProfiler: MemoryProfiler,
  performanceMonitor: PerformanceMonitor,
  options?: DebugOverlayOptions
): DebugOverlay {
  debugOverlayInstance = new DebugOverlay(
    scene,
    camera,
    memoryProfiler,
    performanceMonitor,
    options
  );
  return debugOverlayInstance;
}

export function getDebugOverlay(): DebugOverlay | null {
  return debugOverlayInstance;
}
