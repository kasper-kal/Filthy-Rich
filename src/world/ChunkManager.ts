import * as THREE from 'three'

export interface Chunk {
  id: string
  position: THREE.Vector3 // chunk center
  bounds: { min: THREE.Vector3; max: THREE.Vector3 }
  houses: string[] // house IDs
  loaded: boolean
  priority: number
}

export interface ChunkCoord {
  x: number
  z: number
}

export class ChunkManager {
  private chunkSize: number
  private worldSize: number
  private chunks: Map<string, Chunk> = new Map()
  private loadedChunks: Set<string> = new Set()
  private houseCounts: Map<string, number> = new Map() // chunkId -> house count

  constructor(chunkSize: number, worldSize: number) {
    this.chunkSize = chunkSize
    this.worldSize = worldSize
  }

  generateInitialChunks(): void {
    const halfWorld = this.worldSize / 2
    const chunksPerSide = Math.ceil(this.worldSize / this.chunkSize)

    for (let x = -chunksPerSide / 2; x < chunksPerSide / 2; x++) {
      for (let z = -chunksPerSide / 2; z < chunksPerSide / 2; z++) {
        this.createChunk(x, z)
      }
    }
  }

  private createChunk(cx: number, cz: number): Chunk {
    const id = `chunk_${cx}_${cz}`
    const position = new THREE.Vector3(
      cx * this.chunkSize + this.chunkSize / 2,
      0,
      cz * this.chunkSize + this.chunkSize / 2
    )

    const bounds = {
      min: new THREE.Vector3(position.x - this.chunkSize / 2, -100, position.z - this.chunkSize / 2),
      max: new THREE.Vector3(position.x + this.chunkSize / 2, 100, position.z + this.chunkSize / 2)
    }

    // Determine number of houses in this chunk (0-8)
    const seed = this.hash(`${cx}_${cz}`)
    const houseCount = seed % 9

    const houses: string[] = []
    for (let i = 0; i < houseCount; i++) {
      houses.push(`${id}_house_${i}`)
    }

    const chunk: Chunk = {
      id,
      position,
      bounds,
      houses,
      loaded: false,
      priority: 0
    }

    this.chunks.set(id, chunk)
    this.houseCounts.set(id, houseCount)

    return chunk
  }

  getChunkAtPosition(position: THREE.Vector3): Chunk {
    const cx = Math.floor(position.x / this.chunkSize)
    const cz = Math.floor(position.z / this.chunkSize)
    const id = `chunk_${cx}_${cz}`

    let chunk = this.chunks.get(id)
    if (!chunk) {
      chunk = this.createChunk(cx, cz)
    }
    return chunk
  }

  getChunk(chunkId: string): Chunk | undefined {
    return this.chunks.get(chunkId)
  }

  getChunkCoord(chunkId: string): ChunkCoord | null {
    const match = chunkId.match(/chunk_(-?\d+)_(-?\d+)/)
    if (match) {
      return { x: parseInt(match[1]), z: parseInt(match[2]) }
    }
    return null
  }

  getNearbyChunks(centerChunk: Chunk, radius: number): Chunk[] {
    const centerCoord = this.getChunkCoord(centerChunk.id)
    if (!centerCoord) return []

    const nearby: Chunk[] = []

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const cx = centerCoord.x + dx
        const cz = centerCoord.z + dz
        const id = `chunk_${cx}_${cz}`

        let chunk = this.chunks.get(id)
        if (!chunk) {
          chunk = this.createChunk(cx, cz)
        }
        nearby.push(chunk)
      }
    }

    return nearby
  }

  getHousesInChunk(chunkId: string): string[] {
    const chunk = this.chunks.get(chunkId)
    return chunk?.houses || []
  }

  update(cameraPosition: THREE.Vector3): void {
    const currentChunk = this.getChunkAtPosition(cameraPosition)
    const nearbyChunks = this.getNearbyChunks(currentChunk, 2)

    // Update priorities
    for (const chunk of nearbyChunks) {
      const dist = cameraPosition.distanceTo(chunk.position)
      chunk.priority = 1 / (dist + 1)
    }

    // Load/unload chunks based on priority
    const targetLoaded = new Set(nearbyChunks.map(c => c.id))

    // Unload distant chunks
    for (const loadedId of this.loadedChunks) {
      if (!targetLoaded.has(loadedId)) {
        const chunk = this.chunks.get(loadedId)
        if (chunk) {
          chunk.loaded = false
        }
        this.loadedChunks.delete(loadedId)
      }
    }

    // Load new chunks
    for (const chunk of nearbyChunks) {
      if (!this.loadedChunks.has(chunk.id)) {
        chunk.loaded = true
        this.loadedChunks.add(chunk.id)
      }
    }
  }

  getLoadedChunks(): Chunk[] {
    return Array.from(this.loadedChunks).map(id => this.chunks.get(id)!).filter(Boolean)
  }

  isChunkLoaded(chunkId: string): boolean {
    return this.loadedChunks.has(chunkId)
  }

  getLoadedChunkCount(): number {
    return this.loadedChunks.size
  }

  getChunkBounds(chunkId: string): { min: THREE.Vector3; max: THREE.Vector3 } | null {
    const chunk = this.chunks.get(chunkId)
    return chunk?.bounds || null
  }

  private hash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash)
  }

  serialize(): any {
    return {
      chunkSize: this.chunkSize,
      worldSize: this.worldSize,
      chunks: Array.from(this.chunks.entries()).map(([id, c]) => ({
        ...c,
        position: { x: c.position.x, y: c.position.y, z: c.position.z },
        bounds: {
          min: { x: c.bounds.min.x, y: c.bounds.min.y, z: c.bounds.min.z },
          max: { x: c.bounds.max.x, y: c.bounds.max.y, z: c.bounds.max.z }
        }
      })),
      loadedChunks: Array.from(this.loadedChunks)
    }
  }

  deserialize(data: any): void {
    this.chunkSize = data.chunkSize
    this.worldSize = data.worldSize
    this.chunks.clear()
    for (const [id, c] of data.chunks || []) {
      this.chunks.set(id, {
        ...c,
        position: new THREE.Vector3(c.position.x, c.position.y, c.position.z),
        bounds: {
          min: new THREE.Vector3(c.bounds.min.x, c.bounds.min.y, c.bounds.min.z),
          max: new THREE.Vector3(c.bounds.max.x, c.bounds.max.y, c.bounds.max.z)
        }
      })
    }
    this.loadedChunks = new Set(data.loadedChunks || [])
  }
}