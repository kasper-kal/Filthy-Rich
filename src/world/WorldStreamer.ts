import * as THREE from 'three';
import type { SceneManager } from '../systems/SceneManager.js';
import type { HouseInstance } from './HouseGenerator.js';
import { HouseGenerator } from './HouseGenerator.js';
import { ChunkManager } from './ChunkManager.js';
import { TerrainSystem } from './TerrainSystem.js';
import { RoadNetwork } from './RoadNetwork.js';
import { AssetStreamer } from './AssetStreamer.js';
import { NavMesh, AITrafficManager, AIVehicle } from './NavMesh.js';

export class WorldStreamer {
  private sceneManager: SceneManager;
  private renderer: THREE.WebGLRenderer;
  private chunkManager: ChunkManager;
  private terrainSystem: TerrainSystem;
  private roadNetwork: RoadNetwork;
  private houseGenerator: HouseGenerator;
  private assetStreamer: AssetStreamer;
  private navMesh: NavMesh;
  private aiTrafficManager: AITrafficManager;

  private loadedHouses = new Map<string, HouseInstance>();
  private worldSeed: number;
  private worldSize: number;
  private chunkSize = 200; // meters
  private maxLoadedHouses = 10;

  // LOD distances
  private lodDistances = {
    FULL: 50,
    SIMPLIFIED: 150,
    IMPOSTER: 500,
    CULLED: 1000,
  };

  // Time/weather
  private timeOfDay = 12; // 0-24
  private weather: 'clear' | 'rain' | 'fog' | 'snow' = 'clear';

  // Callbacks
  onHouseLoaded?: (house: HouseInstance) => void;
  onHouseUnloaded?: (houseId: string) => void;
  onChunkLoaded?: (chunkId: string) => void;
  onChunkUnloaded?: (chunkId: string) => void;

  constructor(sceneManager: SceneManager, renderer: THREE.WebGLRenderer) {
    this.sceneManager = sceneManager;
    this.renderer = renderer;
    this.worldSeed = Date.now(); // Fixed seed for deterministic generation
    this.worldSize = 8000; // 8km x 8km

    this.chunkManager = new ChunkManager(this.chunkSize, this.worldSize);
    this.terrainSystem = new TerrainSystem(this.sceneManager, this.worldSeed, this.worldSize);
    this.roadNetwork = new RoadNetwork(this.sceneManager, this.worldSeed, this.worldSize);
    this.houseGenerator = new HouseGenerator(this.sceneManager, this.worldSeed);
    this.assetStreamer = new AssetStreamer();
    this.navMesh = new NavMesh(this.roadNetwork);
    this.aiTrafficManager = new AITrafficManager(this.navMesh);
  }

  async init(): Promise<void> {
    // Initialize asset streamer with renderer
    await this.assetStreamer.init(this.renderer);

    // Initialize terrain
    await this.terrainSystem.init();

    // Initialize road network
    await this.roadNetwork.init();

    // Build navigation mesh from road network
    this.navMesh.build();

    // Generate initial chunks around origin
    this.chunkManager.generateInitialChunks();

    console.log('[WorldStreamer] Initialized');
  }

  update(deltaTime: number, cameraPosition: THREE.Vector3): void {
    // Update time of day
    this.timeOfDay = (this.timeOfDay + deltaTime * 0.01) % 24; // 1 day = ~16 real minutes

    // Update chunk loading based on camera position
    this.chunkManager.update(cameraPosition);

    // Load/unload houses based on distance
    this.streamHouses(cameraPosition);

    // Update LOD for loaded houses
    this.updateHouseLODs(cameraPosition);

    // Update terrain/road LOD
    this.terrainSystem.updateLOD(cameraPosition);
    this.roadNetwork.updateLOD(cameraPosition);

    // Update AI traffic
    this.aiTrafficManager.update(deltaTime, cameraPosition);
  }

  private streamHouses(cameraPosition: THREE.Vector3): void {
    const currentChunk = this.chunkManager.getChunkAtPosition(cameraPosition);
    const nearbyChunks = this.chunkManager.getNearbyChunks(currentChunk, 2); // 2 chunk radius

    // Determine which houses should be loaded
    const targetHouses = new Set<string>();

    for (const chunk of nearbyChunks) {
      const houses = this.getHousesInChunk(chunk.id);
      for (const house of houses) {
        const dist = cameraPosition.distanceTo(house.position);
        if (dist < this.lodDistances.CULLED) {
          targetHouses.add(house.id);
        }
      }
    }

    // Load missing houses (prioritize closest)
    const housesToLoad = Array.from(targetHouses)
      .filter(id => !this.loadedHouses.has(id))
      .map(id => this.getHouseInstance(id))
      .filter((h): h is HouseInstance => h !== undefined)
      .sort(
        (a, b) => cameraPosition.distanceTo(a.position) - cameraPosition.distanceTo(b.position)
      );

    for (const house of housesToLoad.slice(0, 3)) {
      // Load max 3 per frame
      this.loadHouse(house);
    }

    // Unload distant houses
    if (this.loadedHouses.size > this.maxLoadedHouses) {
      const housesToUnload = Array.from(this.loadedHouses.values())
        .filter(h => !targetHouses.has(h.id))
        .sort(
          (a, b) => cameraPosition.distanceTo(b.position) - cameraPosition.distanceTo(a.position)
        );

      for (const house of housesToUnload.slice(0, this.loadedHouses.size - this.maxLoadedHouses)) {
        this.unloadHouse(house.id);
      }
    }
  }

  private updateHouseLODs(cameraPosition: THREE.Vector3): void {
    for (const house of this.loadedHouses.values()) {
      const dist = cameraPosition.distanceTo(house.position);
      let newLOD = 0;

      if (dist < this.lodDistances.FULL) newLOD = 0;
      else if (dist < this.lodDistances.SIMPLIFIED) newLOD = 1;
      else if (dist < this.lodDistances.IMPOSTER) newLOD = 2;
      else newLOD = 3;

      if (newLOD !== house.lodLevel) {
        this.setHouseLOD(house, newLOD);
        house.lodLevel = newLOD;
      }
    }
  }

  private loadHouse(house: HouseInstance): void {
    if (house.lodLevel <= 1 && !house.exteriorLoaded) {
      this.houseGenerator.generateExterior(house);
      house.exteriorLoaded = true;
    }

    if (house.lodLevel === 0 && !house.interiorLoaded) {
      this.houseGenerator.generateInterior(house);
      house.interiorLoaded = true;
    }

    this.loadedHouses.set(house.id, house);
    this.onHouseLoaded?.(house);
  }

  private unloadHouse(houseId: string): void {
    const house = this.loadedHouses.get(houseId);
    if (!house) return;

    this.houseGenerator.disposeHouse(house);
    this.loadedHouses.delete(houseId);
    this.onHouseUnloaded?.(houseId);
  }

  private setHouseLOD(house: HouseInstance, lod: number): void {
    this.houseGenerator.setLOD(house, lod);
  }

  private getHousesInChunk(chunkId: string): HouseInstance[] {
    const houseIds = this.chunkManager.getHousesInChunk(chunkId);
    return houseIds
      .map(id => this.getHouseInstance(id))
      .filter((h): h is HouseInstance => h !== undefined);
  }

  private getHouseInstance(houseId: string): HouseInstance | undefined {
    // Generate deterministic house instance
    const parts = houseId.split('_house_');
    if (parts.length !== 2) return undefined;
    const chunkId = parts[0]!;
    const indexStr = parts[1]!;
    const index = parseInt(indexStr, 10);
    const chunk = this.chunkManager.getChunk(chunkId);
    if (!chunk) return undefined;

    const seed = this.hash(`${this.worldSeed}_${chunkId}_${index}`);
    const template = this.pickTemplate(seed);
    const variant = seed % 100;
    // Ensure template is defined (should always be with our implementation)
    const templateSafe = template ?? 'terraced';

    const position = new THREE.Vector3(
      chunk.position.x + (this.hash(`${seed}_x`) % 180) - 90,
      0,
      chunk.position.z + (this.hash(`${seed}_z`) % 180) - 90
    );

    const rotation = ((this.hash(`${seed}_rot`) % 4) * Math.PI) / 2;

    const houseInstance: HouseInstance = {
      id: houseId,
      chunkId,
      position,
      rotation,
      seed,
      template,
      variant,
      exteriorLoaded: false,
      interiorLoaded: false,
      lodLevel: 3,
      clientName: this.generateClientName(seed),
      jobTitle: this.generateJobTitle(seed),
      flavorText: this.generateFlavorText(seed),
      rooms: ['entrance', 'living', 'kitchen', 'bathroom', 'bedroom'],
      description: this.generateDescription(seed),
      bounds: {
        min: new THREE.Vector3(position.x - 6, 0, position.z - 6),
        max: new THREE.Vector3(position.x + 6, 10, position.z + 6),
      },
      // Add door proximity check - front door is at the front center of the house
      isDoorNearby: (pos: THREE.Vector3): boolean => {
        // Calculate door position in world space
        const houseQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0));
        // Front door is at front center of house (positive Z in local space)
        const doorLocal = new THREE.Vector3(0, 1, templateSafe === 'bungalow' ? 5 : 6);
        const doorWorld = doorLocal.clone().applyQuaternion(houseQuat).add(position);
        return pos.distanceTo(doorWorld) < 3;
      },
    };

    return houseInstance;
  }

  private hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private pickTemplate(seed: number): string {
    const templates = ['terraced', 'semi_detached', 'detached', 'bungalow', 'cottage'];
    return templates[seed % templates.length]!;
  }

  private generateClientName(seed: number): string {
    const first = [
      'Arthur',
      'Beryl',
      'Colin',
      'Doris',
      'Eddie',
      'Florence',
      'Graham',
      'Hilda',
      'Ian',
      'Janet',
      'Kevin',
      'Linda',
    ];
    const last = [
      'Pendelton',
      'Higgins',
      'Wright',
      'Maples',
      'Lawson',
      'Nightingale',
      'Cracker',
      'Ogden',
      'Vanstone',
      'Jackson',
      'Norris',
      'Lovelace',
    ];
    return `${first[seed % first.length]!} ${last[(seed * 7) % last.length]!}`;
  }

  private generateJobTitle(seed: number): string {
    const titles = [
      'End of Tenancy Clean',
      'Deep Clean',
      "Builder's Clean",
      'Spring Clean',
      'Post-Party Cleanup',
      'Hoarder Clearance',
    ];
    return titles[seed % titles.length]!;
  }

  private generateFlavorText(seed: number): string {
    const flavors = [
      'Previous tenants left in a hurry. Or were evicted. Same difference.',
      'Landlord wants it "rental ready." Translation: spotless.',
      "New buyers moving in next week. They've seen the photos. Not the reality.",
      'Estate agent said "character property." Meant "damp and stains."',
      'Student let. Three years. No cleaning. Ever.',
      'Airbnb turnover. Back-to-back bookings. Zero maintenance.',
    ];
    return flavors[seed % flavors.length]!;
  }

  private generateDescription(seed: number): string {
    return `A ${this.pickTemplate(seed)} property requiring full clean. ${this.generateFlavorText(seed)}`;
  }

  // Public API
  getWorldSize(): number {
    return this.worldSize;
  }
  getWorldSeed(): number {
    return this.worldSeed;
  }
  getTimeOfDay(): number {
    return this.timeOfDay;
  }
  getWeather(): string {
    return this.weather;
  }
  getCurrentSpeedLimit(): number {
    return this.roadNetwork.getSpeedLimitAtPosition(this.sceneManager.getCameraPosition());
  }

  getHouseAtPosition(position: THREE.Vector3): HouseInstance | null {
    for (const house of this.loadedHouses.values()) {
      if (
        house.bounds.min.x <= position.x &&
        position.x <= house.bounds.max.x &&
        house.bounds.min.z <= position.z &&
        position.z <= house.bounds.max.z
      ) {
        return house;
      }
    }
    return null;
  }

  loadHouseInterior(houseId: string): void {
    const house = this.loadedHouses.get(houseId);
    if (house && !house.interiorLoaded) {
      this.houseGenerator.generateInterior(house);
      house.interiorLoaded = true;
    }
  }

  getChunkManager(): ChunkManager {
    return this.chunkManager;
  }
  getTerrainSystem(): TerrainSystem {
    return this.terrainSystem;
  }
  getRoadNetwork(): RoadNetwork {
    return this.roadNetwork;
  }
  getHouseGenerator(): HouseGenerator {
    return this.houseGenerator;
  }
  getAssetStreamer(): AssetStreamer {
    return this.assetStreamer;
  }
  getNavMesh(): NavMesh {
    return this.navMesh;
  }
  getAITrafficManager(): AITrafficManager {
    return this.aiTrafficManager;
  }

  serialize(): any {
    return {
      worldSeed: this.worldSeed,
      worldSize: this.worldSize,
      timeOfDay: this.timeOfDay,
      weather: this.weather,
      loadedHouses: Array.from(this.loadedHouses.entries()),
    };
  }

  deserialize(data: any): void {
    this.worldSeed = data.worldSeed;
    this.worldSize = data.worldSize;
    this.timeOfDay = data.timeOfDay;
    this.weather = data.weather;
    // Re-load houses would be handled by chunk manager
  }
}
