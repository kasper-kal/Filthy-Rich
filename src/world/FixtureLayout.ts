/**
 * Where the fixtures live (FINALLY-3D.md §6).
 *
 * Coordinates are world metres: the floor is y = 0, the rooms are the ones in
 * HouseLayout.ts. Models face -Z, so `rotation` turns them to face into the
 * room they are standing against.
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

export const FIXTURE_PLACEMENTS: FixturePlacement[] = [
  // ---------------------------------------------------------------- kitchen
  // south wall run, left to right, all facing -Z (no rotation)
  { asset: 'fridge_freezer', x: 3.9, y: 0, z: 7.63, rotation: 0 },
  { asset: 'kitchen_run_1m', x: 4.75, y: 0, z: 7.63, rotation: 0 },
  { asset: 'dishwasher', x: 5.6, y: 0, z: 7.63, rotation: 0 },
  { asset: 'kitchen_sink', x: 6.35, y: 0, z: 7.63, rotation: 0 },
  { asset: 'kitchen_corner', x: 7.12, y: 0, z: 7.63, rotation: 0 },

  // worktop appliances and the wall above them
  { asset: 'hob_4burner', x: 4.75, y: 0.9, z: 7.62, rotation: 0 },
  { asset: 'range_hood', x: 4.75, y: 1.55, z: 7.72, rotation: 0 },
  { asset: 'splashback', x: 4.75, y: 0.9, z: 7.9, rotation: 0 },
  { asset: 'kitchen_upper', x: 5.95, y: 1.45, z: 7.76, rotation: 0 },
  { asset: 'kitchen_upper', x: 6.95, y: 1.45, z: 7.76, rotation: 0 },
  { asset: 'microwave', x: 6.95, y: 1.45, z: 7.7, rotation: 0 },
  { asset: 'kettle', x: 6.5, y: 0.9, z: 7.68, rotation: 0.3 },
  { asset: 'toaster', x: 6.05, y: 0.9, z: 7.7, rotation: -0.15 },
  { asset: 'kitchen_bin', x: 3.85, y: 0, z: 6.9, rotation: 0 },

  // west wall: laundry corner, fronts facing +X
  { asset: 'washing_machine', x: 3.87, y: 0, z: 4.55, rotation: -HALF_PI },
  { asset: 'boiler', x: 3.73, y: 1.75, z: 4.55, rotation: -HALF_PI },

  // --------------------------------------------------------------- bathroom
  // bath against the north wall, facing +Z
  { asset: 'bath_standard', x: -1.2, y: 0, z: 4.63, rotation: Math.PI },
  { asset: 'bath_panel', x: -1.2, y: 0, z: 5.0, rotation: Math.PI },
  { asset: 'bath_mat', x: -1.2, y: 0, z: 5.45, rotation: 0 },

  // toilet against the east wall, bowl facing -X
  { asset: 'toilet_close_coupled', x: 0.42, y: 0, z: 5.2, rotation: HALF_PI },
  { asset: 'toilet_roll_holder', x: 0.7, y: 0.72, z: 5.95, rotation: HALF_PI },

  // vanity and mirror on the south wall
  { asset: 'vanity_unit', x: -0.4, y: 0, z: 7.49, rotation: 0 },
  { asset: 'mirror_cabinet', x: -0.4, y: 1.5, z: 7.67, rotation: 0 },
  { asset: 'towel_rail', x: -1.65, y: 1.2, z: 7.72, rotation: 0 },

  // shower in the south-west corner
  { asset: 'shower_tray', x: -2.3, y: 0, z: 7.3, rotation: 0 },
  { asset: 'shower_enclosure', x: -2.3, y: 0.14, z: 7.3, rotation: 0 },
  { asset: 'shower_riser', x: -2.72, y: 0.14, z: 7.3, rotation: HALF_PI },

  // ----------------------------------------------------------------- heating
  { asset: 'radiator_panel', x: -2, y: 0.18, z: 2.93, rotation: Math.PI },
  { asset: 'radiator_panel', x: 2.43, y: 0.18, z: 4.75, rotation: -HALF_PI },
];
