import * as THREE from 'three';

/**
 * Memory Profiler - Tracks and reports memory usage across the application
 * Helps identify leaks and optimize memory budget
 */

export interface MemorySnapshot {
  timestamp: number;
  jsHeap: {
    used: number;
    total: number;
    limit: number;
  };
  threejs: {
    geometries: number;
    textures: number;
    materials: number;
    renderCalls: number;
    triangles: number;
    points: number;
    lines: number;
  };
  custom: {
    assetCache: number;
    worldChunks: number;
    vehicles: number;
    aiTraffic: number;
    houses: number;
  };
}

export interface MemoryBudget {
  jsHeapMB: number;
  texturesMB: number;
  geometriesMB: number;
  audioMB: number;
  totalMB: number;
}

export class MemoryProfiler {
  private snapshots: MemorySnapshot[] = [];
  private maxSnapshots = 300; // ~5 minutes at 1Hz
  private enabled = false;
  private sampleInterval = 1000; // ms
  private intervalId: ReturnType<typeof setInterval> | null = null;

  // References to systems for custom memory tracking
  private assetStreamer?: {
    getMemoryStats(): { used: number; budget: number; assetCount: number };
  };
  private worldStreamer?: {
    getChunkManager(): { getLoadedChunkCount(): number };
    getHouseGenerator(): { getLoadedHouseCount(): number };
    getAITrafficManager(): { getVehicleCount(): number };
  };
  private vehicleSystem?: { getVehicleCount(): number };

  // Budget thresholds
  private budgets: MemoryBudget = {
    jsHeapMB: 300,
    texturesMB: 500,
    geometriesMB: 200,
    audioMB: 100,
    totalMB: 1200,
  };

  // Callbacks
  onBudgetExceeded?: (budget: string, current: number, limit: number) => void;
  onMemoryLeakDetected?: (details: string) => void;

  constructor() {
    // Check if performance.memory is available (Chrome/Edge)
    this.enabled = typeof performance !== 'undefined' && 'memory' in performance;
  }

  /**
   * Set system references for custom memory tracking
   */
  setSystemReferences(refs: {
    assetStreamer?: MemoryProfiler['assetStreamer'];
    worldStreamer?: MemoryProfiler['worldStreamer'];
    vehicleSystem?: MemoryProfiler['vehicleSystem'];
  }): void {
    this.assetStreamer = refs.assetStreamer;
    this.worldStreamer = refs.worldStreamer;
    this.vehicleSystem = refs.vehicleSystem;
  }

  /**
   * Set memory budgets
   */
  setBudgets(budgets: Partial<MemoryBudget>): void {
    this.budgets = { ...this.budgets, ...budgets };
  }

  /**
   * Start periodic memory sampling
   */
  start(intervalMs = 1000): void {
    if (!this.enabled) {
      console.warn('[MemoryProfiler] performance.memory not available in this browser');
      return;
    }

    if (this.intervalId) return;

    this.sampleInterval = intervalMs;
    this.intervalId = setInterval(() => this.sample(), intervalMs);
    console.log(`[MemoryProfiler] Started sampling at ${intervalMs}ms interval`);
  }

  /**
   * Stop periodic memory sampling
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[MemoryProfiler] Stopped sampling');
    }
  }

  /**
   * Take a memory snapshot
   */
  sample(): MemorySnapshot {
    const snapshot = this.takeSnapshot();
    this.snapshots.push(snapshot);

    // Trim old snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Check budgets
    this.checkBudgets(snapshot);

    // Detect potential leaks
    this.detectLeaks();

    return snapshot;
  }

  private takeSnapshot(): MemorySnapshot {
    // JS Heap (Chrome only)
    const memInfo = (performance as any).memory;
    const jsHeap = memInfo
      ? {
          used: memInfo.usedJSHeapSize,
          total: memInfo.totalJSHeapSize,
          limit: memInfo.jsHeapSizeLimit,
        }
      : { used: 0, total: 0, limit: 0 };

    // Three.js renderer info
    const threejs = {
      geometries: 0,
      textures: 0,
      materials: 0,
      renderCalls: 0,
      triangles: 0,
      points: 0,
      lines: 0,
    };

    // Custom system memory
    const custom = {
      assetCache: 0,
      worldChunks: 0,
      vehicles: 0,
      aiTraffic: 0,
      houses: 0,
    };

    if (this.assetStreamer) {
      const stats = this.assetStreamer.getMemoryStats();
      custom.assetCache = stats.used;
    }

    if (this.worldStreamer) {
      const chunkManager = this.worldStreamer.getChunkManager();
      const houseGenerator = this.worldStreamer.getHouseGenerator();
      const aiManager = this.worldStreamer.getAITrafficManager();

      custom.worldChunks =
        typeof chunkManager.getLoadedChunkCount === 'function'
          ? chunkManager.getLoadedChunkCount()
          : 0;
      custom.houses =
        typeof houseGenerator.getLoadedHouseCount === 'function'
          ? houseGenerator.getLoadedHouseCount()
          : 0;
      custom.aiTraffic = aiManager ? aiManager.getVehicleCount() : 0;
    }

    if (this.vehicleSystem) {
      custom.vehicles = this.vehicleSystem.getVehicleCount();
    }

    return {
      timestamp: Date.now(),
      jsHeap,
      threejs,
      custom,
    };
  }

  private checkBudgets(snapshot: MemorySnapshot): void {
    const jsHeapMB = snapshot.jsHeap.used / (1024 * 1024);
    const assetCacheMB = snapshot.custom.assetCache / (1024 * 1024);

    if (jsHeapMB > this.budgets.jsHeapMB) {
      this.onBudgetExceeded?.('jsHeap', jsHeapMB, this.budgets.jsHeapMB);
    }

    if (assetCacheMB > this.budgets.texturesMB) {
      this.onBudgetExceeded?.('assetCache', assetCacheMB, this.budgets.texturesMB);
    }
  }

  private detectLeaks(): void {
    if (this.snapshots.length < 60) return; // Need at least 1 minute of data

    // Check for consistent growth over last 60 samples
    const recent = this.snapshots.slice(-60);
    const first = recent[0];
    const last = recent[recent.length - 1];

    const heapGrowth = last.jsHeap.used - first.jsHeap.used;
    const assetGrowth = last.custom.assetCache - first.custom.assetCache;

    // Alert if heap grew > 50MB in 1 minute
    if (heapGrowth > 50 * 1024 * 1024) {
      this.onMemoryLeakDetected?.(
        `JS Heap grew ${(heapGrowth / (1024 * 1024)).toFixed(1)}MB in 1 minute`
      );
    }

    // Alert if asset cache grew > 100MB in 1 minute
    if (assetGrowth > 100 * 1024 * 1024) {
      this.onMemoryLeakDetected?.(
        `Asset cache grew ${(assetGrowth / (1024 * 1024)).toFixed(1)}MB in 1 minute`
      );
    }
  }

  /**
   * Get current memory snapshot
   */
  getCurrentSnapshot(): MemorySnapshot | null {
    return this.snapshots[this.snapshots.length - 1] || null;
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get memory statistics summary
   */
  getStats(): {
    current: MemorySnapshot | null;
    average: Partial<MemorySnapshot> | null;
    peak: Partial<MemorySnapshot> | null;
    trend: 'stable' | 'growing' | 'shrinking';
  } {
    if (this.snapshots.length === 0) {
      return { current: null, average: null, peak: null, trend: 'stable' };
    }

    const current = this.snapshots[this.snapshots.length - 1];

    // Calculate averages
    const avgJsHeap =
      this.snapshots.reduce((sum, s) => sum + s.jsHeap.used, 0) / this.snapshots.length;
    const avgAssetCache =
      this.snapshots.reduce((sum, s) => sum + s.custom.assetCache, 0) / this.snapshots.length;

    // Find peaks
    const peakJsHeap = Math.max(...this.snapshots.map(s => s.jsHeap.used));
    const peakAssetCache = Math.max(...this.snapshots.map(s => s.custom.assetCache));

    // Determine trend (last 30 vs previous 30)
    let trend: 'stable' | 'growing' | 'shrinking' = 'stable';
    if (this.snapshots.length >= 60) {
      const recent30 = this.snapshots.slice(-30);
      const prev30 = this.snapshots.slice(-60, -30);
      const recentAvg = recent30.reduce((sum, s) => sum + s.jsHeap.used, 0) / 30;
      const prevAvg = prev30.reduce((sum, s) => sum + s.jsHeap.used, 0) / 30;
      const diff = recentAvg - prevAvg;

      if (diff > 5 * 1024 * 1024) trend = 'growing';
      else if (diff < -5 * 1024 * 1024) trend = 'shrinking';
    }

    return {
      current,
      average: {
        jsHeap: { used: avgJsHeap, total: 0, limit: 0 },
        custom: { assetCache: avgAssetCache } as any,
      },
      peak: {
        jsHeap: { used: peakJsHeap, total: 0, limit: 0 },
        custom: { assetCache: peakAssetCache } as any,
      },
      trend,
    };
  }

  /**
   * Generate a memory report
   */
  generateReport(): string {
    const stats = this.getStats();
    if (!stats.current) return 'No memory data collected';

    const current = stats.current;
    const lines = [
      '=== MEMORY PROFILER REPORT ===',
      `Timestamp: ${new Date(current.timestamp).toISOString()}`,
      `Sampling: ${this.snapshots.length} samples over ${((this.snapshots.length * this.sampleInterval) / 1000).toFixed(1)}s`,
      '',
      '--- JavaScript Heap ---',
      `  Used: ${(current.jsHeap.used / 1024 / 1024).toFixed(1)} MB`,
      `  Total: ${(current.jsHeap.total / 1024 / 1024).toFixed(1)} MB`,
      `  Limit: ${(current.jsHeap.limit / 1024 / 1024).toFixed(1)} MB`,
      `  Budget: ${this.budgets.jsHeapMB} MB ${current.jsHeap.used / 1024 / 1024 > this.budgets.jsHeapMB ? '⚠️ EXCEEDED' : '✓'}`,
      '',
      '--- Asset Cache ---',
      `  Used: ${(current.custom.assetCache / 1024 / 1024).toFixed(1)} MB`,
      `  Budget: ${this.budgets.texturesMB} MB ${current.custom.assetCache / 1024 / 1024 > this.budgets.texturesMB ? '⚠️ EXCEEDED' : '✓'}`,
      '',
      '--- World ---',
      `  Loaded Chunks: ${current.custom.worldChunks}`,
      `  Loaded Houses: ${current.custom.houses}`,
      `  AI Vehicles: ${current.custom.aiTraffic}`,
      `  Player Vehicles: ${current.custom.vehicles}`,
      '',
      '--- Trends ---',
      `  Heap Trend: ${stats.trend}`,
      `  Average Heap: ${(stats.average?.jsHeap?.used || 0) / 1024 / 1024} MB`,
      `  Peak Heap: ${(stats.peak?.jsHeap?.used || 0) / 1024 / 1024} MB`,
    ];

    return lines.join('\n');
  }

  /**
   * Log report to console
   */
  logReport(): void {
    console.log(this.generateReport());
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots = [];
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): void {
    // In browser, gc is not available; in Node.js with --expose-gc it is on globalThis
    const g = globalThis as unknown as { gc?: () => void };
    if (typeof g.gc === 'function') {
      g.gc();
      console.log('[MemoryProfiler] Forced garbage collection');
    } else {
      console.warn('[MemoryProfiler] GC not available. Run with --expose-gc flag');
    }
  }

  dispose(): void {
    this.stop();
    this.snapshots = [];
  }
}

/**
 * Three.js Object Memory Tracker
 * Tracks memory usage of Three.js objects
 */
export class ThreeMemoryTracker {
  private trackedObjects = new Map<
    THREE.Object3D,
    { geometries: THREE.BufferGeometry[]; materials: THREE.Material[]; textures: THREE.Texture[] }
  >();

  /**
   * Track a Three.js object and its children
   */
  track(object: THREE.Object3D, label = ''): void {
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];

    object.traverse(child => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) geometries.push(child.geometry);
        if (child.material) {
          if (Array.isArray(child.material)) {
            materials.push(...child.material);
          } else {
            materials.push(child.material);
          }
        }
      }
    });

    // Extract textures from materials
    for (const material of materials) {
      const mat = material as any;
      if (mat.map) textures.push(mat.map);
      if (mat.normalMap) textures.push(mat.normalMap);
      if (mat.roughnessMap) textures.push(mat.roughnessMap);
      if (mat.metalnessMap) textures.push(mat.metalnessMap);
      if (mat.aoMap) textures.push(mat.aoMap);
      if (mat.emissiveMap) textures.push(mat.emissiveMap);
    }

    this.trackedObjects.set(object, { geometries, materials, textures });
  }

  /**
   * Untrack an object
   */
  untrack(object: THREE.Object3D): void {
    this.trackedObjects.delete(object);
  }

  /**
   * Get memory estimate for tracked objects
   */
  getMemoryEstimate(): {
    geometries: number;
    materials: number;
    textures: number;
    totalBytes: number;
  } {
    let geoBytes = 0;
    let matBytes = 0;
    let texBytes = 0;

    for (const { geometries, materials, textures } of this.trackedObjects.values()) {
      for (const g of geometries) {
        for (const attr of Object.values(g.attributes)) {
          geoBytes += attr.array.byteLength;
        }
        if (g.index) geoBytes += g.index.array.byteLength;
      }

      matBytes += materials.length * 1024; // Rough estimate

      for (const t of textures) {
        if (t.image) {
          const img = t.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
          if ('width' in img && 'height' in img) {
            texBytes += img.width * img.height * 4; // RGBA estimate
          }
        }
      }
    }

    return {
      geometries: geoBytes,
      materials: matBytes,
      textures: texBytes,
      totalBytes: geoBytes + matBytes + texBytes,
    };
  }

  /**
   * Log top memory consumers
   */
  logTopConsumers(limit = 10): void {
    const entries: { label: string; bytes: number }[] = [];

    for (const [obj, data] of this.trackedObjects.entries()) {
      const estimate = this.getObjectEstimate(data);
      entries.push({ label: obj.name || obj.uuid, bytes: estimate });
    }

    entries.sort((a, b) => b.bytes - a.bytes);

    console.log('--- Top Three.js Memory Consumers ---');
    for (let i = 0; i < Math.min(limit, entries.length); i++) {
      console.log(
        `  ${i + 1}. ${entries[i].label}: ${(entries[i].bytes / 1024 / 1024).toFixed(2)} MB`
      );
    }
  }

  private getObjectEstimate(data: {
    geometries: THREE.BufferGeometry[];
    materials: THREE.Material[];
    textures: THREE.Texture[];
  }): number {
    let bytes = 0;
    for (const g of data.geometries) {
      for (const attr of Object.values(g.attributes)) {
        bytes += attr.array.byteLength;
      }
      if (g.index) bytes += g.index.array.byteLength;
    }
    bytes += data.materials.length * 1024;
    for (const t of data.textures) {
      if (t.image) {
        const img = t.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
        if ('width' in img && 'height' in img) {
          bytes += img.width * img.height * 4;
        }
      }
    }
    return bytes;
  }

  clear(): void {
    this.trackedObjects.clear();
  }
}

/**
 * Performance Monitor - Tracks frame time and render stats
 */
export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private maxFrames = 600; // 10 seconds at 60fps
  private lastTime = 0;
  private frameCount = 0;

  // Custom metrics
  private metrics = new Map<string, number[]>();

  update(currentTime: number): void {
    if (this.lastTime > 0) {
      const frameTime = currentTime - this.lastTime;
      this.frameTimes.push(frameTime);
      if (this.frameTimes.length > this.maxFrames) {
        this.frameTimes.shift();
      }
    }
    this.lastTime = currentTime;
    this.frameCount++;
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const arr = this.metrics.get(name)!;
    arr.push(value);
    if (arr.length > this.maxFrames) arr.shift();
  }

  getFPS(): number {
    if (this.frameTimes.length < 2) return 0;
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return 1000 / avgFrameTime;
  }

  getFrameTimeStats(): { min: number; max: number; avg: number; p99: number } {
    if (this.frameTimes.length === 0) return { min: 0, max: 0, avg: 0, p99: 0 };

    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  getMetricStats(name: string): { min: number; max: number; avg: number } | null {
    const arr = this.metrics.get(name);
    if (!arr || arr.length === 0) return null;

    return {
      min: Math.min(...arr),
      max: Math.max(...arr),
      avg: arr.reduce((a, b) => a + b, 0) / arr.length,
    };
  }

  logStats(): void {
    const fps = this.getFPS();
    const frameStats = this.getFrameTimeStats();

    console.log(`--- Performance ---`);
    console.log(`  FPS: ${fps.toFixed(1)}`);
    console.log(
      `  Frame: min=${frameStats.min.toFixed(2)}ms avg=${frameStats.avg.toFixed(2)}ms max=${frameStats.max.toFixed(2)}ms p99=${frameStats.p99.toFixed(2)}ms`
    );

    for (const [name] of this.metrics) {
      const stats = this.getMetricStats(name);
      if (stats) {
        console.log(
          `  ${name}: avg=${stats.avg.toFixed(2)} min=${stats.min.toFixed(2)} max=${stats.max.toFixed(2)}`
        );
      }
    }
  }

  clear(): void {
    this.frameTimes = [];
    this.metrics.clear();
    this.frameCount = 0;
    this.lastTime = 0;
  }
}

// Singleton instances
export const memoryProfiler = new MemoryProfiler();
export const threeMemoryTracker = new ThreeMemoryTracker();
export const performanceMonitor = new PerformanceMonitor();
