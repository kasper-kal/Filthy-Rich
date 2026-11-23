/**
 * Where the fixtures live (FINALLY-3D.md §6).
 *
 * Coordinates are world metres: the floor is y = 0, the rooms are the ones in
 * HouseLayout.ts.
 *
 * The GLB exporter maps Blender's -Y (the face of every model) onto +Z, so a
 * model at rotation 0 looks toward +Z. These four constants turn a model on a
 * given wall so its face looks into the room.
 *
 * Kitchen   x 3.50…7.50, z 4.00…8.00 (door west and north, window east)
 * Bathroom  x -2.75…0.75, z 4.25…7.75 (doors on the west wall)
 */

export interface FixturePlacement {
  asset: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
}

const HALF_PI = Math.PI / 2;

const SOUTH_WALL = Math.PI;   // against the +Z wall, face turned to -Z
const NORTH_WALL = 0;         // against the -Z wall, face turned to +Z
const WEST_WALL = HALF_PI;    // against the -X wall, face turned to +X
const EAST_WALL = -HALF_PI;   // against the +X wall, face turned to -X

export const FIXTURE_PLACEMENTS: FixturePlacement[] = [
  // ---------------------------------------------------------------- kitchen
  // south wall run, left to right, fronts turned into the room
  { asset: 'fridge_freezer', x: 3.9, y: 0, z: 7.63, rotation: SOUTH_WALL },
  { asset: 'kitchen_run_1m', x: 4.75, y: 0, z: 7.63, rotation: SOUTH_WALL },
  { asset: 'dishwasher', x: 5.6, y: 0, z: 7.63, rotation: SOUTH_WALL },
  { asset: 'kitchen_sink', x: 6.35, y: 0, z: 7.63, rotation: SOUTH_WALL },
  { asset: 'kitchen_corner', x: 7.12, y: 0, z: 7.63, rotation: SOUTH_WALL },

  // worktop appliances and the wall above them
  { asset: 'hob_4burner', x: 4.75, y: 0.9, z: 7.62, rotation: SOUTH_WALL },
  { asset: 'range_hood', x: 4.75, y: 1.55, z: 7.72, rotation: SOUTH_WALL },
  { asset: 'splashback', x: 4.75, y: 0.9, z: 7.9, rotation: SOUTH_WALL },
  { asset: 'kitchen_upper', x: 5.95, y: 1.45, z: 7.76, rotation: SOUTH_WALL },
  { asset: 'kitchen_upper', x: 6.95, y: 1.45, z: 7.76, rotation: SOUTH_WALL },
  { asset: 'microwave', x: 6.95, y: 1.45, z: 7.7, rotation: SOUTH_WALL },
  { asset: 'kettle', x: 6.5, y: 0.9, z: 7.68, rotation: SOUTH_WALL + 0.3 },
  { asset: 'toaster', x: 6.05, y: 0.9, z: 7.7, rotation: SOUTH_WALL - 0.15 },
  { asset: 'kitchen_bin', x: 3.85, y: 0, z: 6.9, rotation: SOUTH_WALL },

  // west wall: laundry corner, fronts facing +X
  { asset: 'washing_machine', x: 3.87, y: 0, z: 4.55, rotation: WEST_WALL },
  { asset: 'boiler', x: 3.73, y: 1.75, z: 4.55, rotation: WEST_WALL },

  // --------------------------------------------------------------- bathroom
  // bath against the north wall, facing +Z
  { asset: 'bath_standard', x: -1.2, y: 0, z: 4.63, rotation: NORTH_WALL },
  { asset: 'bath_panel', x: -1.2, y: 0, z: 5.0, rotation: NORTH_WALL },
  { asset: 'bath_mat', x: -1.2, y: 0, z: 5.45, rotation: SOUTH_WALL },

  // toilet against the east wall, bowl facing -X
  { asset: 'toilet_close_coupled', x: 0.42, y: 0, z: 5.2, rotation: EAST_WALL },
  { asset: 'toilet_roll_holder', x: 0.7, y: 0.72, z: 5.95, rotation: EAST_WALL },

  // vanity and mirror on the south wall
  { asset: 'vanity_unit', x: -0.4, y: 0, z: 7.49, rotation: SOUTH_WALL },
  { asset: 'mirror_cabinet', x: -0.4, y: 1.5, z: 7.67, rotation: SOUTH_WALL },
  { asset: 'towel_rail', x: -1.65, y: 1.2, z: 7.72, rotation: SOUTH_WALL },

  // shower in the south-west corner
  { asset: 'shower_tray', x: -2.3, y: 0, z: 7.3, rotation: SOUTH_WALL },
  { asset: 'shower_enclosure', x: -2.3, y: 0.14, z: 7.3, rotation: SOUTH_WALL },
  { asset: 'shower_riser', x: -2.72, y: 0.14, z: 7.3, rotation: EAST_WALL },

  // ----------------------------------------------------------------- heating
  { asset: 'radiator_panel', x: -2, y: 0.18, z: 2.93, rotation: NORTH_WALL },
  { asset: 'radiator_panel', x: 2.43, y: 0.18, z: 4.75, rotation: EAST_WALL },
];
