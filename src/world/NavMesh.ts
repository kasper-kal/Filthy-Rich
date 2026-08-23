import * as THREE from 'three'
import { RoadNetwork, RoadNode, RoadSegment } from './RoadNetwork.js'

/**
 * Navigation Mesh System for AI Traffic
 * Builds a navigation graph from the road network for pathfinding
 */

export interface NavNode {
  id: string
  position: THREE.Vector3
  connections: NavConnection[]
  roadSegmentId?: string // Reference to road segment for metadata
  nodeType: 'intersection' | 'junction' | 'lane_change' | 'merge' | 'split'
}

export interface NavConnection {
  targetNodeId: string
  distance: number
  maxSpeed: number // m/s
  laneCount: number
  direction: 'forward' | 'bidirectional'
  segmentId: string
}

export interface NavPath {
  nodes: NavNode[]
  totalDistance: number
  estimatedTime: number
}

export interface VehicleNavState {
  currentNodeId: string
  targetNodeId: string
  path: NavPath | null
  progress: number // 0-1 along current connection
  currentSpeed: number
  targetSpeed: number
  lane: number // 0-based lane index
}

export class NavMesh {
  private roadNetwork: RoadNetwork
  private nodes: Map<string, NavNode> = new Map()
  private nodeLookup: Map<string, THREE.Vector3> = new Map() // For spatial queries
  private gridSize = 50 // Spatial grid cell size for acceleration

  // Spatial grid for fast nearest-node queries
  private spatialGrid: Map<string, string[]> = new Map()

  constructor(roadNetwork: RoadNetwork) {
    this.roadNetwork = roadNetwork
  }

  /**
   * Build navigation mesh from road network
   */
  build(): void {
    console.log('[NavMesh] Building navigation mesh from road network...')

    const roadNodes = this.roadNetwork.getNodes()
    const roadSegments = this.roadNetwork.getSegments()

    // Clear existing
    this.nodes.clear()
    this.nodeLookup.clear()
    this.spatialGrid.clear()

    // Create nav nodes from road network nodes
    for (const roadNode of roadNodes) {
      this.createNavNodeFromRoadNode(roadNode)
    }

    // Create connections from road segments
    for (const segment of roadSegments) {
      this.createConnectionsFromSegment(segment)
    }

    // Add lane change connections at intersections
    this.addLaneChangeConnections()

    // Build spatial grid
    this.buildSpatialGrid()

    console.log(`[NavMesh] Built ${this.nodes.size} nav nodes with connections`)
  }

  private createNavNodeFromRoadNode(roadNode: RoadNode): void {
    let nodeType: NavNode['nodeType'] = 'junction'
    switch (roadNode.type) {
      case 'intersection':
        nodeType = 'intersection'
        break
      case 'roundabout':
        nodeType = 'intersection'
        break
      case 'dead_end':
        nodeType = 'junction'
        break
      default:
        nodeType = 'junction'
    }

    const navNode: NavNode = {
      id: roadNode.id,
      position: roadNode.position.clone(),
      connections: [],
      nodeType,
    }

    this.nodes.set(roadNode.id, navNode)
    this.nodeLookup.set(roadNode.id, roadNode.position)
  }

  private createConnectionsFromSegment(segment: RoadSegment): void {
    const startNode = this.nodes.get(segment.startNode)
    const endNode = this.nodes.get(segment.endNode)

    if (!startNode || !endNode) return

    const maxSpeedMps = segment.speedLimit * 0.44704 // mph to m/s
    const distance = segment.length

    // Forward connection
    startNode.connections.push({
      targetNodeId: segment.endNode,
      distance,
      maxSpeed: maxSpeedMps,
      laneCount: segment.lanes,
      direction: 'forward',
      segmentId: segment.id,
    })

    // Bidirectional for most roads (except motorways which are one-way)
    const isOneWay = segment.type === 'motorway'
    if (!isOneWay) {
      endNode.connections.push({
        targetNodeId: segment.startNode,
        distance,
        maxSpeed: maxSpeedMps,
        laneCount: segment.lanes,
        direction: 'bidirectional',
        segmentId: segment.id,
      })
    }

    // Store segment reference on nodes
    if (!startNode.roadSegmentId) startNode.roadSegmentId = segment.id
    if (!endNode.roadSegmentId) endNode.roadSegmentId = segment.id
  }

  private addLaneChangeConnections(): void {
    // At intersections with multiple lanes, add connections between lanes
    for (const node of this.nodes.values()) {
      if (node.nodeType === 'intersection' && node.connections.length > 2) {
        // Multi-lane intersection - vehicles can change approach lanes
        const lanes = new Map<number, NavConnection[]>()

        for (const conn of node.connections) {
          const laneCount = conn.laneCount
          if (!lanes.has(laneCount)) lanes.set(laneCount, [])
          lanes.get(laneCount)!.push(conn)
        }

        // If multiple lanes per connection, add lane-change edges (zero distance, low speed)
        for (const [laneCount, conns] of lanes) {
          if (laneCount > 1 && conns.length > 1) {
            for (let i = 0; i < conns.length; i++) {
              for (let j = i + 1; j < conns.length; j++) {
                // Lane change within intersection
                conns[i].targetNodeId = conns[j].targetNodeId // Simplified: just allow turning
              }
            }
          }
        }
      }
    }
  }

  private buildSpatialGrid(): void {
    for (const [id, node] of this.nodes) {
      const gridKey = this.getGridKey(node.position)
      if (!this.spatialGrid.has(gridKey)) {
        this.spatialGrid.set(gridKey, [])
      }
      this.spatialGrid.get(gridKey)!.push(id)
    }
  }

  private getGridKey(position: THREE.Vector3): string {
    const x = Math.floor(position.x / this.gridSize)
    const z = Math.floor(position.z / this.gridSize)
    return `${x}_${z}`
  }

  private getNearbyGridKeys(position: THREE.Vector3, radius: number): string[] {
    const keys: string[] = []
    const cells = Math.ceil(radius / this.gridSize)
    const centerX = Math.floor(position.x / this.gridSize)
    const centerZ = Math.floor(position.z / this.gridSize)

    for (let dx = -cells; dx <= cells; dx++) {
      for (let dz = -cells; dz <= cells; dz++) {
        keys.push(`${centerX + dx}_${centerZ + dz}`)
      }
    }
    return keys
  }

  /**
   * Find nearest nav node to a position
   */
  findNearestNode(position: THREE.Vector3, maxDistance = 100): NavNode | null {
    const keys = this.getNearbyGridKeys(position, maxDistance)
    let nearest: NavNode | null = null
    let nearestDist = maxDistance

    for (const key of keys) {
      const nodeIds = this.spatialGrid.get(key)
      if (!nodeIds) continue

      for (const nodeId of nodeIds) {
        const node = this.nodes.get(nodeId)
        if (!node) continue

        const dist = position.distanceTo(node.position)
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = node
        }
      }
    }

    return nearest
  }

  /**
   * Find nearest node on a specific road segment
   */
  findNearestNodeOnSegment(position: THREE.Vector3, segmentId: string): NavNode | null {
    const segment = this.roadNetwork.getSegments().find(s => s.id === segmentId)
    if (!segment) return null

    // Find closest point on segment curve
    let closestNode: NavNode | null = null
    let closestDist = Infinity

    for (const point of segment.curvePoints) {
      const node = this.findNearestNode(point, 50)
      if (node) {
        const dist = position.distanceTo(node.position)
        if (dist < closestDist) {
          closestDist = dist
          closestNode = node
        }
      }
    }

    return closestNode
  }

  /**
   * A* pathfinding between two nodes
   */
  findPath(startNodeId: string, targetNodeId: string): NavPath | null {
    const startNode = this.nodes.get(startNodeId)
    const targetNode = this.nodes.get(targetNodeId)

    if (!startNode || !targetNode) {
      console.warn('[NavMesh] Start or target node not found')
      return null
    }

    // A* algorithm
    const openSet = new Set<string>([startNodeId])
    const closedSet = new Set<string>()
    const cameFrom = new Map<string, string>()
    const gScore = new Map<string, number>([[startNodeId, 0]])
    const fScore = new Map<string, number>([
      [startNodeId, this.heuristic(startNode, targetNode)],
    ])

    while (openSet.size > 0) {
      // Find node with lowest fScore
      let current: string | null = null
      let lowestF = Infinity

      for (const nodeId of openSet) {
        const f = fScore.get(nodeId) || Infinity
        if (f < lowestF) {
          lowestF = f
          current = nodeId
        }
      }

      if (!current) break
      if (current === targetNodeId) {
        return this.reconstructPath(cameFrom, current, startNode, targetNode)
      }

      openSet.delete(current)
      closedSet.add(current)

      const currentNode = this.nodes.get(current)!
      for (const connection of currentNode.connections) {
        const neighborId = connection.targetNodeId

        if (closedSet.has(neighborId)) continue

        const tentativeG = (gScore.get(current) || Infinity) + connection.distance

        if (!openSet.has(neighborId)) {
          openSet.add(neighborId)
        } else if (tentativeG >= (gScore.get(neighborId) || Infinity)) {
          continue
        }

        cameFrom.set(neighborId, current)
        gScore.set(neighborId, tentativeG)
        fScore.set(neighborId, tentativeG + this.heuristic(this.nodes.get(neighborId)!, targetNode))
      }
    }

    return null // No path found
  }

  private heuristic(a: NavNode, b: NavNode): number {
    return a.position.distanceTo(b.position)
  }

  private reconstructPath(
    cameFrom: Map<string, string>,
    current: string,
    startNode: NavNode,
    targetNode: NavNode
  ): NavPath {
    const path: NavNode[] = [targetNode]
    let curr = current

    while (curr !== startNode.id) {
      const node = this.nodes.get(curr)
      if (node) path.unshift(node)
      curr = cameFrom.get(curr) || startNode.id
    }
    path.unshift(startNode)

    // Calculate total distance and estimated time
    let totalDistance = 0
    let estimatedTime = 0

    for (let i = 0; i < path.length - 1; i++) {
      const node = path[i]
      const nextNode = path[i + 1]
      const connection = node.connections.find(c => c.targetNodeId === nextNode.id)

      if (connection) {
        totalDistance += connection.distance
        estimatedTime += connection.distance / Math.max(1, connection.maxSpeed)
      }
    }

    return { nodes: path, totalDistance, estimatedTime }
  }

  /**
   * Get path as world-space waypoints for vehicle following
   */
  getPathWaypoints(path: NavPath, spacing = 5): THREE.Vector3[] {
    const waypoints: THREE.Vector3[] = []

    for (let i = 0; i < path.nodes.length - 1; i++) {
      const current = path.nodes[i]
      const next = path.nodes[i + 1]
      const connection = current.connections.find(c => c.targetNodeId === next.id)

      if (!connection) continue

      // Get road segment for detailed curve points
      const segment = this.roadNetwork.getSegments().find(s => s.id === connection.segmentId)
      if (segment && segment.curvePoints.length > 0) {
        // Sample curve points
        const points = segment.curvePoints
        for (let j = 0; j < points.length; j += Math.max(1, Math.floor(spacing / 2))) {
          waypoints.push(points[j].clone())
        }
      } else {
        // Fallback: straight line between nodes
        waypoints.push(current.position.clone())
      }
    }

    // Add final node
    if (path.nodes.length > 0) {
      waypoints.push(path.nodes[path.nodes.length - 1].position.clone())
    }

    return waypoints
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): NavNode | undefined {
    return this.nodes.get(nodeId)
  }

  /**
   * Get all nodes
   */
  getAllNodes(): NavNode[] {
    return Array.from(this.nodes.values())
  }

  /**
   * Get random node (for spawning AI)
   */
  getRandomNode(): NavNode | null {
    const nodes = Array.from(this.nodes.values())
    if (nodes.length === 0) return null
    return nodes[Math.floor(Math.random() * nodes.length)]
  }

  /**
   * Get node suitable for spawning (on residential or country roads)
   */
  getSpawnNode(preferType: 'residential' | 'country_lane' | 'a_road' = 'residential'): NavNode | null {
    const candidates = Array.from(this.nodes.values()).filter(node => {
      if (!node.roadSegmentId) return false
      const segment = this.roadNetwork.getSegments().find(s => s.id === node.roadSegmentId)
      return segment?.type === preferType
    })

    if (candidates.length === 0) return this.getRandomNode()
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  /**
   * Debug visualization
   */
  createDebugVisualization(): THREE.Group {
    const group = new THREE.Group()
    group.name = 'NavMeshDebug'

    // Draw nodes
    const nodeGeometry = new THREE.SphereGeometry(1, 8, 8)
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })

    for (const node of this.nodes.values()) {
      const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial)
      mesh.position.copy(node.position)
      mesh.position.y = 0.5
      group.add(mesh)
    }

    // Draw connections
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 })

    for (const node of this.nodes.values()) {
      for (const conn of node.connections) {
        const target = this.nodes.get(conn.targetNodeId)
        if (!target) continue

        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array([
          node.position.x, 0.5, node.position.z,
          target.position.x, 0.5, target.position.z,
        ])
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        const line = new THREE.Line(geometry, lineMaterial)
        group.add(line)
      }
    }

    return group
  }

  serialize(): any {
    return {
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        id,
        position: { x: node.position.x, y: node.position.y, z: node.position.z },
        connections: node.connections,
        nodeType: node.nodeType,
        roadSegmentId: node.roadSegmentId,
      }))
    }
  }

  deserialize(data: any): void {
    this.nodes.clear()
    this.nodeLookup.clear()
    this.spatialGrid.clear()

    for (const nodeData of data.nodes) {
      const node: NavNode = {
        id: nodeData.id,
        position: new THREE.Vector3(nodeData.position.x, nodeData.position.y, nodeData.position.z),
        connections: nodeData.connections,
        nodeType: nodeData.nodeType,
        roadSegmentId: nodeData.roadSegmentId,
      }
      this.nodes.set(node.id, node)
      this.nodeLookup.set(node.id, node.position)
    }

    this.buildSpatialGrid()
  }
}

/**
 * AI Traffic Manager - Controls AI vehicles using the nav mesh
 */
export interface AIVehicleSpec {
  maxSpeed: number // m/s
  acceleration: number
  deceleration: number
  length: number
  width: number
  turnRadius: number
}

export class AITrafficManager {
  private navMesh: NavMesh
  private vehicles: Map<string, AIVehicle> = new Map()
  private spawnPoints: NavNode[] = []
  private maxVehicles = 20
  private spawnTimer = 0
  private spawnInterval = 5 // seconds

  constructor(navMesh: NavMesh) {
    this.navMesh = navMesh
    this.collectSpawnPoints()
  }

  private collectSpawnPoints(): void {
    // Collect nodes on residential roads as spawn points
    this.spawnPoints = this.navMesh.getAllNodes().filter(node => {
      if (!node.roadSegmentId) return false
      // Would need access to road network to check segment type
      return node.connections.length > 0 // Has somewhere to go
    })
  }

  update(deltaTime: number, playerPosition: THREE.Vector3): void {
    // Spawn new vehicles
    this.spawnTimer += deltaTime
    if (this.spawnTimer >= this.spawnInterval && this.vehicles.size < this.maxVehicles) {
      this.trySpawnVehicle(playerPosition)
      this.spawnTimer = 0
    }

    // Update existing vehicles
    for (const [id, vehicle] of this.vehicles) {
      vehicle.update(deltaTime, this.navMesh)

      // Despawn if too far from player
      if (vehicle.mesh.position.distanceTo(playerPosition) > 500) {
        this.despawnVehicle(id)
      }
    }
  }

  private trySpawnVehicle(playerPosition: THREE.Vector3): void {
    // Find spawn point far enough from player
    const candidates = this.spawnPoints.filter(sp =>
      sp.position.distanceTo(playerPosition) > 100 && sp.position.distanceTo(playerPosition) < 300
    )

    if (candidates.length === 0) return

    const spawnNode = candidates[Math.floor(Math.random() * candidates.length)]
    const targetNode = this.navMesh.getRandomNode()

    if (!targetNode || targetNode.id === spawnNode.id) return

    const path = this.navMesh.findPath(spawnNode.id, targetNode.id)
    if (!path) return

    const spec: AIVehicleSpec = {
      maxSpeed: 10 + Math.random() * 10, // 10-20 m/s (36-72 km/h)
      acceleration: 2 + Math.random() * 2,
      deceleration: 4 + Math.random() * 2,
      length: 4 + Math.random() * 2,
      width: 1.8 + Math.random() * 0.5,
      turnRadius: 8 + Math.random() * 4,
    }

    const vehicle = new AIVehicle(
      `ai_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      spawnNode.position.clone(),
      path,
      spec,
      this.navMesh
    )

    this.vehicles.set(vehicle.id, vehicle)
  }

  private despawnVehicle(id: string): void {
    const vehicle = this.vehicles.get(id)
    if (vehicle) {
      vehicle.dispose()
      this.vehicles.delete(id)
    }
  }

  getVehicles(): AIVehicle[] {
    return Array.from(this.vehicles.values())
  }

  getVehicleCount(): number {
    return this.vehicles.size
  }

  setMaxVehicles(max: number): void {
    this.maxVehicles = max
  }
}

export class AIVehicle {
  id: string
  mesh: THREE.Mesh
  private navMesh: NavMesh
  private path: NavPath
  private waypoints: THREE.Vector3[]
  private currentWaypointIndex = 0
  private spec: AIVehicleSpec
  private speed = 0
  private steering = 0

  constructor(
    id: string,
    startPosition: THREE.Vector3,
    path: NavPath,
    spec: AIVehicleSpec,
    navMesh: NavMesh
  ) {
    this.id = id
    this.navMesh = navMesh
    this.path = path
    this.spec = spec

    // Create vehicle mesh
    this.mesh = this.createVehicleMesh()
    this.mesh.position.copy(startPosition)
    this.mesh.position.y = 0.5

    // Generate waypoints from path
    this.waypoints = this.navMesh.getPathWaypoints(path)
  }

  private createVehicleMesh(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(this.spec.length, 1.5, this.spec.width)
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
      roughness: 0.7,
      metalness: 0.3,
    })
    return new THREE.Mesh(geometry, material)
  }

  update(deltaTime: number, navMesh: NavMesh): void {
    if (this.currentWaypointIndex >= this.waypoints.length) {
      // Reached destination - could generate new path
      return
    }

    const target = this.waypoints[this.currentWaypointIndex]
    const direction = new THREE.Vector3().subVectors(target, this.mesh.position)
    const distance = direction.length()

    if (distance < 3) {
      // Reached waypoint
      this.currentWaypointIndex++
      if (this.currentWaypointIndex >= this.waypoints.length) return
      return
    }

    // Steering
    direction.normalize()
    const forward = new THREE.Vector3()
    this.mesh.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    const targetAngle = Math.atan2(direction.x, direction.z)
    const currentAngle = Math.atan2(forward.x, forward.z)
    let angleDiff = targetAngle - currentAngle

    // Normalize angle
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

    // PID-like steering
    this.steering = THREE.MathUtils.lerp(this.steering, angleDiff * 2, deltaTime * 5)
    this.steering = THREE.MathUtils.clamp(this.steering, -1, 1)

    // Speed control
    const targetSpeed = Math.min(this.spec.maxSpeed, distance * 2) // Slow down near waypoints
    if (this.speed < targetSpeed) {
      this.speed = Math.min(this.speed + this.spec.acceleration * deltaTime, targetSpeed)
    } else {
      this.speed = Math.max(this.speed - this.spec.deceleration * deltaTime, targetSpeed)
    }

    // Apply movement
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.steering * deltaTime * 2)
    this.mesh.quaternion.multiply(quaternion)

    this.mesh.position.addScaledVector(forward, this.speed * deltaTime)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(m => m.dispose())
    } else {
      this.mesh.material.dispose()
    }
  }
}