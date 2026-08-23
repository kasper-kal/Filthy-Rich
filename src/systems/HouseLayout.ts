import * as THREE from 'three';

export interface RoomData {
  name: string;
  position: THREE.Vector3; // center of room
  size: THREE.Vector3; // width, height, depth
  doors: DoorData[];
  windows: WindowData[];
  floorMaterial: THREE.MeshStandardMaterial;
  wallMaterial: THREE.MeshStandardMaterial;
  ceilingMaterial: THREE.MeshStandardMaterial;
}

export interface DoorData {
  wall: 'north' | 'south' | 'east' | 'west';
  position: number; // 0-1 along wall
  width: number;
  height: number;
  connectsTo: string; // room name
}

export interface WindowData {
  wall: 'north' | 'south' | 'east' | 'west';
  position: number; // 0-1 along wall
  width: number;
  height: number;
  heightFromFloor: number;
}

export const HOUSE_LAYOUT: RoomData[] = [
  // ENTRANCE HALL
  {
    name: 'entrance',
    position: new THREE.Vector3(0, 0, 6),
    size: new THREE.Vector3(5, 3, 4),
    doors: [
      { wall: 'south', position: 0.5, width: 1.0, height: 2.1, connectsTo: 'outside' },
      { wall: 'north', position: 0.5, width: 0.9, height: 2.1, connectsTo: 'living' },
      { wall: 'east', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'kitchen' },
      { wall: 'west', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'bathroom' },
    ],
    windows: [],
    floorMaterial: createFloorMaterial(0x7a6a55), // Darker wood
    wallMaterial: createWallMaterial(0xe8dcc8),
    ceilingMaterial: createCeilingMaterial(0xf5f0e8),
  },
  // LIVING ROOM
  {
    name: 'living',
    position: new THREE.Vector3(0, 0, 0),
    size: new THREE.Vector3(6, 3, 6),
    doors: [
      { wall: 'south', position: 0.5, width: 0.9, height: 2.1, connectsTo: 'entrance' },
      { wall: 'east', position: 0.3, width: 0.8, height: 2.1, connectsTo: 'dining' },
      { wall: 'west', position: 0.7, width: 0.8, height: 2.1, connectsTo: 'study' },
    ],
    windows: [
      { wall: 'north', position: 0.3, width: 1.5, height: 1.4, heightFromFloor: 1.0 },
      { wall: 'north', position: 0.7, width: 1.5, height: 1.4, heightFromFloor: 1.0 },
    ],
    floorMaterial: createFloorMaterial(0x8b7355), // Standard wood
    wallMaterial: createWallMaterial(0xe0d4c0),
    ceilingMaterial: createCeilingMaterial(0xf0ebe0),
  },
  // KITCHEN
  {
    name: 'kitchen',
    position: new THREE.Vector3(5.5, 0, 6),
    size: new THREE.Vector3(4, 3, 4),
    doors: [
      { wall: 'west', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'entrance' },
      { wall: 'north', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'dining' },
    ],
    windows: [{ wall: 'east', position: 0.5, width: 1.2, height: 1.0, heightFromFloor: 1.2 }],
    floorMaterial: createFloorMaterial(0x9a8a75), // Tile-like
    wallMaterial: createWallMaterial(0xf0e8d8), // Lighter
    ceilingMaterial: createCeilingMaterial(0xf8f4ec),
  },
  // DINING ROOM
  {
    name: 'dining',
    position: new THREE.Vector3(5.5, 0, 0),
    size: new THREE.Vector3(4, 3, 5),
    doors: [
      { wall: 'west', position: 0.3, width: 0.8, height: 2.1, connectsTo: 'living' },
      { wall: 'south', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'kitchen' },
    ],
    windows: [{ wall: 'east', position: 0.5, width: 1.8, height: 1.5, heightFromFloor: 0.8 }],
    floorMaterial: createFloorMaterial(0x856f52), // Slightly darker wood
    wallMaterial: createWallMaterial(0xdcc8b0),
    ceilingMaterial: createCeilingMaterial(0xeae4d8),
  },
  // MASTER BEDROOM
  {
    name: 'master_bedroom',
    position: new THREE.Vector3(-6, 0, 6),
    size: new THREE.Vector3(5, 3, 5),
    doors: [{ wall: 'east', position: 0.5, width: 0.9, height: 2.1, connectsTo: 'bathroom' }],
    windows: [
      { wall: 'west', position: 0.5, width: 2.0, height: 1.5, heightFromFloor: 0.8 },
      { wall: 'north', position: 0.5, width: 1.2, height: 1.3, heightFromFloor: 1.0 },
    ],
    floorMaterial: createFloorMaterial(0x7a6858), // Carpet-like warmth
    wallMaterial: createWallMaterial(0xe8e0d8),
    ceilingMaterial: createCeilingMaterial(0xf0ebe8),
  },
  // BATHROOM
  {
    name: 'bathroom',
    position: new THREE.Vector3(-1, 0, 6),
    size: new THREE.Vector3(3.5, 3, 3.5),
    doors: [
      { wall: 'west', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'entrance' },
      { wall: 'west', position: 0.8, width: 0.9, height: 2.1, connectsTo: 'master_bedroom' },
    ],
    windows: [{ wall: 'north', position: 0.5, width: 0.6, height: 0.6, heightFromFloor: 1.8 }],
    floorMaterial: createFloorMaterial(0x8899aa), // Tile
    wallMaterial: createWallMaterial(0xddeeff), // Cool tiles
    ceilingMaterial: createCeilingMaterial(0xeef4f8),
  },
  // STUDY / OFFICE
  {
    name: 'study',
    position: new THREE.Vector3(-6, 0, 0),
    size: new THREE.Vector3(4, 3, 4),
    doors: [{ wall: 'east', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'living' }],
    windows: [{ wall: 'west', position: 0.5, width: 1.2, height: 1.3, heightFromFloor: 0.9 }],
    floorMaterial: createFloorMaterial(0x6b5a4a), // Darker wood
    wallMaterial: createWallMaterial(0xd0c8b8),
    ceilingMaterial: createCeilingMaterial(0xe0d8cc),
  },
  // SECOND BEDROOM
  {
    name: 'bedroom2',
    position: new THREE.Vector3(-6, 0, -5),
    size: new THREE.Vector3(4, 3, 4),
    doors: [{ wall: 'north', position: 0.5, width: 0.8, height: 2.1, connectsTo: 'living' }],
    windows: [
      { wall: 'west', position: 0.5, width: 1.2, height: 1.3, heightFromFloor: 0.9 },
      { wall: 'south', position: 0.5, width: 1.0, height: 1.2, heightFromFloor: 1.0 },
    ],
    floorMaterial: createFloorMaterial(0x8a7a65),
    wallMaterial: createWallMaterial(0xe0d8d0),
    ceilingMaterial: createCeilingMaterial(0xebe8e0),
  },
];

// Material factories
function createFloorMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
}

function createWallMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
}

function createCeilingMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
}

// Helper to get room bounds
export function getRoomBounds(room: RoomData): { min: THREE.Vector3; max: THREE.Vector3 } {
  const halfW = room.size.x / 2;
  const halfH = room.size.y / 2;
  const halfD = room.size.z / 2;
  return {
    min: new THREE.Vector3(
      room.position.x - halfW,
      room.position.y - halfH,
      room.position.z - halfD
    ),
    max: new THREE.Vector3(
      room.position.x + halfW,
      room.position.y + halfH,
      room.position.z + halfD
    ),
  };
}

// Check if a point is inside a room
export function pointInRoom(point: THREE.Vector3, room: RoomData): boolean {
  const bounds = getRoomBounds(room);
  return (
    point.x >= bounds.min.x &&
    point.x <= bounds.max.x &&
    point.y >= bounds.min.y &&
    point.y <= bounds.max.y &&
    point.z >= bounds.min.z &&
    point.z <= bounds.max.z
  );
}

// Find which room a point is in
export function findRoomAtPoint(point: THREE.Vector3): RoomData | null {
  for (const room of HOUSE_LAYOUT) {
    if (pointInRoom(point, room)) return room;
  }
  return null;
}

// Get floor bounds for stain/trash generation
export function getFloorBounds(): { min: THREE.Vector2; max: THREE.Vector2 } {
  let minX = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxZ = -Infinity;

  for (const room of HOUSE_LAYOUT) {
    const bounds = getRoomBounds(room);
    minX = Math.min(minX, bounds.min.x);
    minZ = Math.min(minZ, bounds.min.z);
    maxX = Math.max(maxX, bounds.max.x);
    maxZ = Math.max(maxZ, bounds.max.z);
  }

  // Shrink by margin
  const margin = 0.5;
  return {
    min: new THREE.Vector2(minX + margin, minZ + margin),
    max: new THREE.Vector2(maxX - margin, maxZ - margin),
  };
}

// Get all wall surfaces for stain placement
export function getAllWallSurfaces(): {
  room: RoomData;
  wall: 'north' | 'south' | 'east' | 'west';
  center: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  height: number;
}[] {
  const surfaces: {
    room: RoomData;
    wall: 'north' | 'south' | 'east' | 'west';
    center: THREE.Vector3;
    normal: THREE.Vector3;
    width: number;
    height: number;
  }[] = [];

  for (const room of HOUSE_LAYOUT) {
    const bounds = getRoomBounds(room);
    const wallHeight = room.size.y;
    const wallWidth = {
      north: room.size.x,
      south: room.size.x,
      east: room.size.z,
      west: room.size.z,
    };

    // North wall (-Z)
    surfaces.push({
      room,
      wall: 'north',
      center: new THREE.Vector3(room.position.x, room.position.y, bounds.min.z),
      normal: new THREE.Vector3(0, 0, 1),
      width: wallWidth.north,
      height: wallHeight,
    });

    // South wall (+Z)
    surfaces.push({
      room,
      wall: 'south',
      center: new THREE.Vector3(room.position.x, room.position.y, bounds.max.z),
      normal: new THREE.Vector3(0, 0, -1),
      width: wallWidth.south,
      height: wallHeight,
    });

    // West wall (-X)
    surfaces.push({
      room,
      wall: 'west',
      center: new THREE.Vector3(bounds.min.x, room.position.y, room.position.z),
      normal: new THREE.Vector3(1, 0, 0),
      width: wallWidth.west,
      height: wallHeight,
    });

    // East wall (+X)
    surfaces.push({
      room,
      wall: 'east',
      center: new THREE.Vector3(bounds.max.x, room.position.y, room.position.z),
      normal: new THREE.Vector3(-1, 0, 0),
      width: wallWidth.east,
      height: wallHeight,
    });
  }

  return surfaces;
}
