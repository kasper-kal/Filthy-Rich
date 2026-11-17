import * as THREE from 'three';
import { TrashManager } from './TrashManager.js';
import type { RoomData } from './HouseLayout.js';
import { HOUSE_LAYOUT, getFloorBounds, getAllWallSurfaces } from './HouseLayout.js';

export class Room {
  public floor!: THREE.Mesh;
  public walls: THREE.Mesh[] = [];
  public ceilings: THREE.Mesh[] = [];
  public doorFrames: THREE.Group[] = [];
  public windowFrames: THREE.Group[] = [];
  public baseboards: THREE.Mesh[] = [];
  public trashManager!: TrashManager;

  private scene: THREE.Scene;
  private houseGroup = new THREE.Group();
  private rooms = new Map<string, THREE.Group>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async init(): Promise<void> {
    this.createHouse();
    this.scene.add(this.houseGroup);

    this.trashManager = new TrashManager(this.scene, this.floor);
    await this.trashManager.init();
  }

  private createHouse(): void {
    for (const roomData of HOUSE_LAYOUT) {
      const roomGroup = this.createRoom(roomData);
      this.houseGroup.add(roomGroup);
      this.rooms.set(roomData.name, roomGroup);
    }

    // Set the first floor as primary for raycasting compatibility
    const entranceRoom = this.rooms.get('entrance');
    if (entranceRoom) {
      // Find floor mesh in entrance
      entranceRoom.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.PlaneGeometry) {
          if (!this.floor && obj.rotation.x === -Math.PI / 2) {
            this.floor = obj;
          }
        }
      });
    }
  }

  private createRoom(data: RoomData): THREE.Group {
    const group = new THREE.Group();
    group.name = `room_${data.name}`;

    const halfW = data.size.x / 2;
    const halfH = data.size.y / 2;
    const halfD = data.size.z / 2;
    const cx = data.position.x;
    const cy = data.position.y;
    const cz = data.position.z;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(data.size.x, data.size.z, 50, 50);
    const floor = new THREE.Mesh(floorGeo, data.floorMaterial.clone());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, cy - halfH, cz);
    floor.receiveShadow = true;
    floor.name = `floor_${data.name}`;
    group.add(floor);

    // Add subtle floor texture via vertex displacement
    const positions = floorGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const noise = Math.sin(x * 12) * Math.cos(y * 12) * 0.002;
      positions.setZ(i, noise);
    }
    floorGeo.computeVertexNormals();

    // Ceiling
    const ceilingGeo = new THREE.PlaneGeometry(data.size.x, data.size.z);
    const ceiling = new THREE.Mesh(ceilingGeo, data.ceilingMaterial.clone());
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(cx, cy + halfH, cz);
    ceiling.receiveShadow = true;
    // The roof has to block the sun, otherwise the interior floor is lit as if
    // the house had no ceiling at all.
    ceiling.castShadow = true;
    ceiling.name = `ceiling_${data.name}`;
    this.ceilings.push(ceiling);
    group.add(ceiling);

    // Walls with door/window cutouts
    this.createWallsWithOpenings(group, data, cx, cy, cz, halfW, halfH, halfD);

    // Baseboards
    this.createBaseboards(group, data, cx, cy, cz, halfW, halfH, halfD);

    // Door frames
    this.createDoorFrames(group, data, cx, cy, cz, halfW, halfH, halfD);

    // Window frames
    this.createWindowFrames(group, data, cx, cy, cz, halfW, halfH, halfD);

    // Crown molding
    this.createCrownMolding(group, data, cx, cy, cz, halfW, halfH, halfD);

    return group;
  }

  private createWallsWithOpenings(
    group: THREE.Group,
    data: RoomData,
    cx: number,
    cy: number,
    cz: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): void {
    const wallMaterial = data.wallMaterial;

    // For each wall, we may need to split it into segments around doors/windows
    const wallDefinitions = [
      {
        name: 'north',
        normal: new THREE.Vector3(0, 0, 1),
        center: new THREE.Vector3(cx, cy, cz - halfD),
        width: data.size.x,
        rotation: new THREE.Euler(0, Math.PI, 0),
      },
      {
        name: 'south',
        normal: new THREE.Vector3(0, 0, -1),
        center: new THREE.Vector3(cx, cy, cz + halfD),
        width: data.size.x,
        rotation: new THREE.Euler(0, 0, 0),
      },
      {
        name: 'west',
        normal: new THREE.Vector3(1, 0, 0),
        center: new THREE.Vector3(cx - halfW, cy, cz),
        width: data.size.z,
        rotation: new THREE.Euler(0, -Math.PI / 2, 0),
      },
      {
        name: 'east',
        normal: new THREE.Vector3(-1, 0, 0),
        center: new THREE.Vector3(cx + halfW, cy, cz),
        width: data.size.z,
        rotation: new THREE.Euler(0, Math.PI / 2, 0),
      },
    ];

    for (const wallDef of wallDefinitions) {
      const doorsOnWall = data.doors.filter(d => d.wall === wallDef.name);
      const windowsOnWall = data.windows.filter(w => w.wall === wallDef.name);

      // Collect all openings
      const openings: {
        start: number;
        end: number;
        type: 'door' | 'window';
        heightFromFloor?: number;
      }[] = [];

      for (const door of doorsOnWall) {
        const halfWidth = door.width / 2;
        const centerPos = (door.position - 0.5) * wallDef.width;
        openings.push({
          start: centerPos - halfWidth,
          end: centerPos + halfWidth,
          type: 'door',
        });
      }

      for (const window of windowsOnWall) {
        const halfWidth = window.width / 2;
        const centerPos = (window.position - 0.5) * wallDef.width;
        openings.push({
          start: centerPos - halfWidth,
          end: centerPos + halfWidth,
          type: 'window',
          heightFromFloor: window.heightFromFloor,
        });
      }

      // Sort openings by start position
      openings.sort((a, b) => a.start - b.start);

      // Create wall segments
      let lastEnd = -wallDef.width / 2;

      for (const opening of openings) {
        // Segment before opening
        if (opening.start > lastEnd) {
          const segWidth = opening.start - lastEnd;
          const wall = this.createWallSegment(
            segWidth,
            data.size.y,
            wallMaterial,
            new THREE.Vector3(
              wallDef.center.x + wallDef.normal.x * 0 + wallDef.normal.z * (lastEnd + segWidth / 2),
              cy,
              wallDef.center.z + wallDef.normal.z * 0 + wallDef.normal.x * (lastEnd + segWidth / 2)
            ),
            wallDef.rotation
          );
          group.add(wall);
          this.walls.push(wall);
        }

        // If window, create wall above window
        if (opening.type === 'window' && opening.heightFromFloor !== undefined) {
          const aboveHeight =
            data.size.y -
            (opening.heightFromFloor +
              (data.windows.find(
                w =>
                  w.wall === wallDef.name &&
                  Math.abs((w.position - 0.5) * wallDef.width - (opening.start + opening.end) / 2) <
                    0.01
              )?.height || 1.0));

          if (aboveHeight > 0.1) {
            const windowData = data.windows.find(
              w =>
                w.wall === wallDef.name &&
                Math.abs((w.position - 0.5) * wallDef.width - (opening.start + opening.end) / 2) <
                  0.01
            );
            const windowHeight = windowData?.height || 1.0;
            const windowBottom = opening.heightFromFloor;
            const windowTop = windowBottom + windowHeight;

            // Wall segment above window
            const wall = this.createWallSegment(
              opening.end - opening.start,
              data.size.y - windowTop,
              wallMaterial,
              new THREE.Vector3(
                wallDef.center.x +
                  wallDef.normal.x * 0 +
                  wallDef.normal.z * ((opening.start + opening.end) / 2),
                cy - halfH + windowTop + (data.size.y - windowTop) / 2,
                wallDef.center.z +
                  wallDef.normal.z * 0 +
                  wallDef.normal.x * ((opening.start + opening.end) / 2)
              ),
              wallDef.rotation
            );
            group.add(wall);
            this.walls.push(wall);
          }
        }

        lastEnd = opening.end;
      }

      // Final segment after last opening
      if (lastEnd < wallDef.width / 2) {
        const segWidth = wallDef.width / 2 - lastEnd;
        const wall = this.createWallSegment(
          segWidth,
          data.size.y,
          wallMaterial,
          new THREE.Vector3(
            wallDef.center.x + wallDef.normal.x * 0 + wallDef.normal.z * (lastEnd + segWidth / 2),
            cy,
            wallDef.center.z + wallDef.normal.z * 0 + wallDef.normal.x * (lastEnd + segWidth / 2)
          ),
          wallDef.rotation
        );
        group.add(wall);
        this.walls.push(wall);
      }

      // If no openings, create full wall
      if (openings.length === 0) {
        const wall = this.createWallSegment(
          wallDef.width,
          data.size.y,
          wallMaterial,
          wallDef.center,
          wallDef.rotation
        );
        group.add(wall);
        this.walls.push(wall);
      }
    }
  }

  private createWallSegment(
    width: number,
    height: number,
    material: THREE.MeshStandardMaterial,
    position: THREE.Vector3,
    rotation: THREE.Euler
  ): THREE.Mesh {
    // Use more segments for better shadow quality
    const geometry = new THREE.PlaneGeometry(
      width,
      height,
      Math.max(10, Math.floor(width * 5)),
      Math.max(10, Math.floor(height * 5))
    );
    const wall = new THREE.Mesh(geometry, material.clone());
    wall.position.copy(position);
    wall.rotation.copy(rotation);
    wall.receiveShadow = true;
    wall.castShadow = true;
    return wall;
  }

  private createBaseboards(
    group: THREE.Group,
    data: RoomData,
    cx: number,
    cy: number,
    cz: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): void {
    const geo = new THREE.BoxGeometry(data.size.x, 0.12, 0.06);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.1,
    });

    const baseboardData = [
      { pos: [cx, cy - halfH + 0.06, cz - halfD + 0.03], rot: [0, 0, 0], scale: [1, 1, 1] },
      { pos: [cx, cy - halfH + 0.06, cz + halfD - 0.03], rot: [0, Math.PI, 0], scale: [1, 1, 1] },
      {
        pos: [cx - halfW + 0.03, cy - halfH + 0.06, cz],
        rot: [0, -Math.PI / 2, 0],
        scale: [data.size.z / data.size.x, 1, 1],
      },
      {
        pos: [cx + halfW - 0.03, cy - halfH + 0.06, cz],
        rot: [0, Math.PI / 2, 0],
        scale: [data.size.z / data.size.x, 1, 1],
      },
    ];

    for (const door of data.doors) {
      // Skip baseboard where door is
      const doorCenter =
        (door.position - 0.5) *
        (door.wall === 'north' || door.wall === 'south' ? data.size.x : data.size.z);
      // We'll handle this by not adding baseboard segments that overlap doors
      // For simplicity, just add all and let Z-fighting be minimal
    }

    baseboardData.forEach(b => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(b.pos[0], b.pos[1], b.pos[2]);
      mesh.rotation.set(b.rot[0], b.rot[1], b.rot[2]);
      mesh.scale.set(b.scale[0], b.scale[1], b.scale[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.baseboards.push(mesh);
      group.add(mesh);
    });
  }

  private createDoorFrames(
    group: THREE.Group,
    data: RoomData,
    cx: number,
    cy: number,
    cz: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): void {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x6b4f31,
      roughness: 0.5,
      metalness: 0.1,
    });
    const frameDepth = 0.15;

    for (const door of data.doors) {
      const doorFrame = new THREE.Group();
      const isNS = door.wall === 'north' || door.wall === 'south';
      const wallWidth = isNS ? data.size.x : data.size.z;
      const wallCenter = isNS ? cx : cz;
      const wallPos = isNS ? cz : cx;
      const wallSign = door.wall === 'south' || door.wall === 'east' ? 1 : -1;
      const doorCenter = (door.position - 0.5) * wallWidth;

      const frameGeo = new THREE.BoxGeometry(door.width, door.height, frameDepth);
      const topGeo = new THREE.BoxGeometry(door.width + 0.2, 0.15, frameDepth);

      if (isNS) {
        // North/South wall door
        // Left frame
        const leftGeo = new THREE.BoxGeometry(0.15, door.height, frameDepth);
        const left = new THREE.Mesh(leftGeo, frameMat);
        left.position.set(
          doorCenter - door.width / 2 - 0.075,
          cy - halfH + door.height / 2,
          wallSign * (halfD - frameDepth / 2)
        );
        doorFrame.add(left);

        // Right frame
        const right = left.clone();
        right.position.x = doorCenter + door.width / 2 + 0.075;
        doorFrame.add(right);

        // Top frame
        const top = new THREE.Mesh(topGeo, frameMat);
        top.position.set(
          doorCenter,
          cy - halfH + door.height + 0.075,
          wallSign * (halfD - frameDepth / 2)
        );
        doorFrame.add(top);

        // Apply wall rotation
        if (door.wall === 'north') {
          doorFrame.rotation.y = Math.PI;
        }
        doorFrame.position.set(cx, 0, cz);
      } else {
        // East/West wall door
        const leftGeo = new THREE.BoxGeometry(frameDepth, door.height, 0.15);
        const left = new THREE.Mesh(leftGeo, frameMat);
        left.position.set(
          wallSign * (halfW - frameDepth / 2),
          cy - halfH + door.height / 2,
          doorCenter - door.width / 2 - 0.075
        );
        doorFrame.add(left);

        const right = left.clone();
        right.position.z = doorCenter + door.width / 2 + 0.075;
        doorFrame.add(right);

        const topGeo2 = new THREE.BoxGeometry(frameDepth, 0.15, door.width + 0.2);
        const top = new THREE.Mesh(topGeo2, frameMat);
        top.position.set(
          wallSign * (halfW - frameDepth / 2),
          cy - halfH + door.height + 0.075,
          doorCenter
        );
        doorFrame.add(top);

        if (door.wall === 'west') {
          doorFrame.rotation.y = -Math.PI / 2;
        } else {
          doorFrame.rotation.y = Math.PI / 2;
        }
        doorFrame.position.set(cx, 0, cz);
      }

      this.doorFrames.push(doorFrame);
      group.add(doorFrame);
    }
  }

  private createWindowFrames(
    group: THREE.Group,
    data: RoomData,
    cx: number,
    cy: number,
    cz: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): void {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x6b4f31,
      roughness: 0.5,
      metalness: 0.1,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x88ccee,
      transmission: 0.8,
      thickness: 0.02,
      roughness: 0.05,
      metalness: 0.0,
      ior: 1.5,
      side: THREE.DoubleSide,
    });

    for (const window of data.windows) {
      const windowGroup = new THREE.Group();
      const isNS = window.wall === 'north' || window.wall === 'south';
      const wallWidth = isNS ? data.size.x : data.size.z;
      const wallCenter = isNS ? cx : cz;
      const wallSign = window.wall === 'south' || window.wall === 'east' ? 1 : -1;
      const windowCenter = (window.position - 0.5) * wallWidth;

      const frameGeo = new THREE.BoxGeometry(window.width + 0.1, window.height + 0.1, 0.1);
      const glassGeo = new THREE.PlaneGeometry(window.width, window.height);

      if (isNS) {
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(
          windowCenter,
          cy - halfH + window.heightFromFloor + window.height / 2,
          wallSign * (halfD - 0.05)
        );
        windowGroup.add(frame);

        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(
          windowCenter,
          cy - halfH + window.heightFromFloor + window.height / 2,
          wallSign * (halfD - 0.04)
        );
        windowGroup.add(glass);

        if (window.wall === 'north') {
          windowGroup.rotation.y = Math.PI;
        }
        windowGroup.position.set(cx, 0, cz);
      } else {
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(
          wallSign * (halfW - 0.05),
          cy - halfH + window.heightFromFloor + window.height / 2,
          windowCenter
        );
        windowGroup.add(frame);

        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(
          wallSign * (halfW - 0.04),
          cy - halfH + window.heightFromFloor + window.height / 2,
          windowCenter
        );
        windowGroup.add(glass);

        if (window.wall === 'west') {
          windowGroup.rotation.y = -Math.PI / 2;
        } else {
          windowGroup.rotation.y = Math.PI / 2;
        }
        windowGroup.position.set(cx, 0, cz);
      }

      this.windowFrames.push(windowGroup);
      group.add(windowGroup);
    }
  }

  private createCrownMolding(
    group: THREE.Group,
    data: RoomData,
    cx: number,
    cy: number,
    cz: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): void {
    // Simple crown molding at ceiling-wall junction
    const geo = new THREE.BoxGeometry(data.size.x, 0.08, 0.08);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });

    const moldings = [
      { pos: [cx, cy + halfH - 0.04, cz - halfD + 0.04], rot: [0, 0, 0], scale: [1, 1, 1] },
      { pos: [cx, cy + halfH - 0.04, cz + halfD - 0.04], rot: [0, Math.PI, 0], scale: [1, 1, 1] },
      {
        pos: [cx - halfW + 0.04, cy + halfH - 0.04, cz],
        rot: [0, -Math.PI / 2, 0],
        scale: [data.size.z / data.size.x, 1, 1],
      },
      {
        pos: [cx + halfW - 0.04, cy + halfH - 0.04, cz],
        rot: [0, Math.PI / 2, 0],
        scale: [data.size.z / data.size.x, 1, 1],
      },
    ];

    moldings.forEach(m => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(m.pos[0], m.pos[1], m.pos[2]);
      mesh.rotation.set(m.rot[0], m.rot[1], m.rot[2]);
      mesh.scale.set(m.scale[0], m.scale[1], m.scale[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });
  }

  update(delta: number): void {
    this.trashManager?.update(delta);
  }

  getCleanableSurfaces(): THREE.Mesh[] {
    return [this.floor, ...this.walls];
  }

  getFloorBounds(): { min: THREE.Vector2; max: THREE.Vector2 } {
    return getFloorBounds();
  }

  getAllWallSurfaces(): ReturnType<typeof getAllWallSurfaces> {
    return getAllWallSurfaces();
  }

  getRoomAtPoint(point: THREE.Vector3): RoomData | null {
    for (const roomData of HOUSE_LAYOUT) {
      const bounds = this.getRoomBounds(roomData);
      if (
        point.x >= bounds.min.x &&
        point.x <= bounds.max.x &&
        point.y >= bounds.min.y &&
        point.y <= bounds.max.y &&
        point.z >= bounds.min.z &&
        point.z <= bounds.max.z
      ) {
        return roomData;
      }
    }
    return null;
  }

  private getRoomBounds(data: RoomData): { min: THREE.Vector3; max: THREE.Vector3 } {
    const halfW = data.size.x / 2;
    const halfH = data.size.y / 2;
    const halfD = data.size.z / 2;
    return {
      min: new THREE.Vector3(
        data.position.x - halfW,
        data.position.y - halfH,
        data.position.z - halfD
      ),
      max: new THREE.Vector3(
        data.position.x + halfW,
        data.position.y + halfH,
        data.position.z + halfD
      ),
    };
  }

  dispose(): void {
    this.houseGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.scene.remove(this.houseGroup);
  }
}
