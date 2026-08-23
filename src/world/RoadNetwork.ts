import * as THREE from 'three';
import type { SceneManager } from '../systems/SceneManager.js';

export interface RoadNode {
  id: string;
  position: THREE.Vector3;
  connections: string[]; // node IDs
  type: 'intersection' | 'junction' | 'dead_end' | 'roundabout';
}

export interface RoadSegment {
  id: string;
  startNode: string;
  endNode: string;
  type: 'motorway' | 'a_road' | 'b_road' | 'country_lane' | 'residential' | 'dirt';
  lanes: number;
  speedLimit: number; // mph
  length: number;
  curvePoints: THREE.Vector3[]; // for spline rendering
  mesh?: THREE.Mesh;
}

export class RoadNetwork {
  private sceneManager: SceneManager;
  private worldSeed: number;
  private worldSize: number;
  private nodes = new Map<string, RoadNode>();
  private segments = new Map<string, RoadSegment>();
  private meshes: THREE.Mesh[] = [];

  // Grid-based road generation
  private gridSpacing = 1000; // meters between major roads

  constructor(sceneManager: SceneManager, worldSeed: number, worldSize: number) {
    this.sceneManager = sceneManager;
    this.worldSeed = worldSeed;
    this.worldSize = worldSize;
  }

  async init(): Promise<void> {
    this.generateRoadNetwork();
    this.createRoadMeshes();
  }

  private generateRoadNetwork(): void {
    // Create grid of major roads
    const halfWorld = this.worldSize / 2;
    const nodeId = (gx: number, gz: number) => `node_${gx}_${gz}`;

    // Create nodes at grid intersections
    for (let gx = -4; gx <= 4; gx++) {
      for (let gz = -4; gz <= 4; gz++) {
        // Add some jitter
        const jitter = this.hash(`${gx}_${gz}_jitter`);
        const x = gx * this.gridSpacing + (jitter % 200) - 100;
        const z = gz * this.gridSpacing + ((jitter >> 8) % 200) - 100;

        const id = nodeId(gx, gz);
        const connections: string[] = [];

        // Connect to neighbors
        if (gx < 4) connections.push(nodeId(gx + 1, gz));
        if (gx > -4) connections.push(nodeId(gx - 1, gz));
        if (gz < 4) connections.push(nodeId(gx, gz + 1));
        if (gz > -4) connections.push(nodeId(gx, gz - 1));

        // Occasionally add diagonal connections
        if (this.hash(`${gx}_${gz}_diag`) % 5 === 0) {
          if (gx < 4 && gz < 4) connections.push(nodeId(gx + 1, gz + 1));
          if (gx > -4 && gz < 4) connections.push(nodeId(gx - 1, gz + 1));
        }

        this.nodes.set(id, {
          id,
          position: new THREE.Vector3(x, 0, z),
          connections,
          type:
            connections.length > 2
              ? 'intersection'
              : connections.length === 2
                ? 'junction'
                : 'dead_end',
        });
      }
    }

    // Create segments between connected nodes
    for (const [nodeId, node] of this.nodes) {
      for (const connId of node.connections) {
        if (this.segments.has(`${nodeId}_${connId}`) || this.segments.has(`${connId}_${nodeId}`))
          continue;

        const targetNode = this.nodes.get(connId);
        if (!targetNode) continue;

        const length = node.position.distanceTo(targetNode.position);
        const segId = `${nodeId}_${connId}`;

        // Determine road type based on position and importance
        const isMajor = Math.abs(node.position.x) < 500 && Math.abs(node.position.z) < 500;
        const type = isMajor ? 'a_road' : length > 1500 ? 'b_road' : 'country_lane';
        const speedLimit = type === 'a_road' ? 60 : type === 'b_road' ? 50 : 40;
        const lanes = type === 'a_road' ? 2 : 1;

        // Generate curve points for spline
        const curvePoints = this.generateCurvePoints(node.position, targetNode.position, type);

        this.segments.set(segId, {
          id: segId,
          startNode: nodeId,
          endNode: connId,
          type,
          lanes,
          speedLimit,
          length,
          curvePoints,
        });
      }
    }

    // Add residential roads within grid cells
    this.generateResidentialRoads();
  }

  private generateResidentialRoads(): void {
    // Add smaller roads inside each grid cell
    for (let gx = -4; gx < 4; gx++) {
      for (let gz = -4; gz < 4; gz++) {
        const cellSeed = this.hash(`cell_${gx}_${gz}`);
        const roadCount = 2 + (cellSeed % 3);

        for (let i = 0; i < roadCount; i++) {
          const offsetSeed = this.hash(`${gx}_${gz}_road_${i}`);
          const startX = gx * this.gridSpacing + (offsetSeed % this.gridSpacing);
          const startZ = gz * this.gridSpacing + ((offsetSeed >> 8) % this.gridSpacing);
          const endX = startX + ((offsetSeed >> 16) % 400) - 200;
          const endZ = startZ + ((offsetSeed >> 24) % 400) - 200;

          const startId = `res_${gx}_${gz}_${i}_s`;
          const endId = `res_${gx}_${gz}_${i}_e`;

          this.nodes.set(startId, {
            id: startId,
            position: new THREE.Vector3(startX, 0, startZ),
            connections: [endId],
            type: 'dead_end',
          });

          this.nodes.set(endId, {
            id: endId,
            position: new THREE.Vector3(endX, 0, endZ),
            connections: [startId],
            type: 'dead_end',
          });

          const segId = `${startId}_${endId}`;
          const length = Math.sqrt((endX - startX) ** 2 + (endZ - startZ) ** 2);

          this.segments.set(segId, {
            id: segId,
            startNode: startId,
            endNode: endId,
            type: 'residential',
            lanes: 1,
            speedLimit: 30,
            length,
            curvePoints: this.generateCurvePoints(
              new THREE.Vector3(startX, 0, startZ),
              new THREE.Vector3(endX, 0, endZ),
              'residential'
            ),
          });
        }
      }
    }
  }

  private generateCurvePoints(
    start: THREE.Vector3,
    end: THREE.Vector3,
    type: string
  ): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const segments = type === 'motorway' ? 20 : type === 'a_road' ? 15 : 10;
    const variance = type === 'country_lane' ? 50 : type === 'residential' ? 30 : 10;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = THREE.MathUtils.lerp(start.x, end.x, t);
      const z = THREE.MathUtils.lerp(start.z, end.z, t);

      // Add some curvature
      const curve =
        Math.sin(t * Math.PI) *
        variance *
        ((this.hash(`${start.x}_${start.z}_${end.x}_${end.z}_${i}`) % 100) / 100 - 0.5);
      const perpX =
        -(end.z - start.z) /
        Math.max(1, Math.sqrt((end.x - start.x) ** 2 + (end.z - start.z) ** 2));
      const perpZ =
        (end.x - start.x) / Math.max(1, Math.sqrt((end.x - start.x) ** 2 + (end.z - start.z) ** 2));

      points.push(new THREE.Vector3(x + perpX * curve, 0, z + perpZ * curve));
    }

    return points;
  }

  private createRoadMeshes(): void {
    for (const segment of this.segments.values()) {
      const mesh = this.createRoadMesh(segment);
      if (mesh) {
        segment.mesh = mesh;
        this.meshes.push(mesh);
        this.sceneManager.scene.add(mesh);
      }
    }
  }

  private createRoadMesh(segment: RoadSegment): THREE.Mesh | null {
    const points = segment.curvePoints;
    if (points.length < 2) return null;

    const width = this.getRoadWidth(segment.type, segment.lanes);
    const geometry = new THREE.BufferGeometry();

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (!p1 || !p2) continue;

      // Calculate perpendicular
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);

      const halfWidth = width / 2;
      const baseIndex = positions.length / 3;

      // Left edge
      positions.push(p1.x - perp.x * halfWidth, 0.05, p1.z - perp.z * halfWidth);
      uvs.push(i / (points.length - 1), 0);
      positions.push(p2.x - perp.x * halfWidth, 0.05, p2.z - perp.z * halfWidth);
      uvs.push((i + 1) / (points.length - 1), 0);

      // Right edge
      positions.push(p1.x + perp.x * halfWidth, 0.05, p1.z + perp.z * halfWidth);
      uvs.push(i / (points.length - 1), 1);
      positions.push(p2.x + perp.x * halfWidth, 0.05, p2.z + perp.z * halfWidth);
      uvs.push((i + 1) / (points.length - 1), 1);

      // Two triangles per segment
      indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
      indices.push(baseIndex + 2, baseIndex + 1, baseIndex + 3);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: this.getRoadColor(segment.type),
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  private getRoadWidth(type: string, lanes: number): number {
    const laneWidth = 3.5;
    const shoulder = type === 'motorway' ? 3 : type === 'a_road' ? 2 : 1;
    return lanes * laneWidth + shoulder * 2;
  }

  private getRoadColor(type: string): number {
    switch (type) {
      case 'motorway':
        return 0x333333;
      case 'a_road':
        return 0x444444;
      case 'b_road':
        return 0x555555;
      case 'country_lane':
        return 0x666666;
      case 'residential':
        return 0x5a5a5a;
      case 'dirt':
        return 0x8a7a65;
      default:
        return 0x555555;
    }
  }

  updateLOD(cameraPosition: THREE.Vector3): void {
    // Could implement LOD for distant roads
  }

  getSpeedLimitAtPosition(position: THREE.Vector3): number {
    let nearestSpeed = 30;
    let nearestDist = Infinity;

    for (const segment of this.segments.values()) {
      if (!segment.curvePoints.length) continue;

      // Find closest point on segment
      for (let i = 0; i < segment.curvePoints.length - 1; i++) {
        const p1 = segment.curvePoints[i];
        const p2 = segment.curvePoints[i + 1];

        // Distance from point to line segment
        const dist = this.distancePointToSegment(position, p1, p2);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestSpeed = segment.speedLimit;
        }
      }
    }

    return nearestSpeed;
  }

  private distancePointToSegment(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(point, a);
    const ab2 = ab.dot(ab);
    const ap_ab = ap.dot(ab);
    const t = Math.max(0, Math.min(1, ap_ab / ab2));
    const closest = new THREE.Vector3().addVectors(a, ab.multiplyScalar(t));
    return point.distanceTo(closest);
  }

  getNearestRoad(position: THREE.Vector3): RoadSegment | null {
    let nearest: RoadSegment | null = null;
    let nearestDist = Infinity;

    for (const segment of this.segments.values()) {
      for (let i = 0; i < segment.curvePoints.length - 1; i++) {
        const p1 = segment.curvePoints[i];
        const p2 = segment.curvePoints[i + 1];
        if (!p1 || !p2) continue;

        const dist = this.distancePointToSegment(position, p1, p2);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = segment;
        }
      }
    }

    return nearest;
  }

  getNodes(): RoadNode[] {
    return Array.from(this.nodes.values());
  }
  getSegments(): RoadSegment[] {
    return Array.from(this.segments.values());
  }

  private hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  serialize(): any {
    return {
      nodes: Array.from(this.nodes.entries()),
      segments: Array.from(this.segments.entries()).map(([id, s]) => ({
        ...s,
        curvePoints: s.curvePoints.map(p => ({ x: p.x, y: p.y, z: p.z })),
      })),
    };
  }
}
