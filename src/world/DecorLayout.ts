/**
 * Where the dressing props live (FINALLY-3D.md §7).
 *
 * Furniture in this game is bought and placed by the player, so decor may not
 * lean on it. Everything here is therefore anchored to the house itself: wall
 * art and shelves on the walls, small props on the shelves, tableware on the
 * Phase 2 worktops, and soft goods on the floor. Rooms read lived in from the
 * first second, before a single chair is bought.
 *
 * Wall entries use `u`, the distance along the wall to the right as you look at
 * it from inside the room, and `depth`, the distance from the wall's inner face
 * to the model's centre. The exporter maps Blender's -Y (every model's face)
 * onto +Z, so a model at rotation 0 looks toward +Z: the wall decides the
 * rotation, and the constants below read as "against this wall".
 */

import { HOUSE_LAYOUT } from '../systems/HouseLayout.js';

export interface DecorPlacement {
  asset: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
}

type Wall = 'north' | 'south' | 'east' | 'west';

interface WallEntry {
  asset: string;
  room: string;
  wall: Wall;
  u: number;
  y: number;
  depth: number;
}

interface FloorEntry {
  asset: string;
  x: number;
  y: number;
  z: number;
  rotation?: number;
}

/** Walls are 0.13 m thick and centred on the room boundary. */
const INNER_FACE = 0.065;

const WALL_ROTATION: Record<Wall, number> = {
  north: 0, // against the -Z wall, face turned to +Z
  south: Math.PI, // against the +Z wall, face turned to -Z
  west: Math.PI / 2, // against the -X wall, face turned to +X
  east: -Math.PI / 2, // against the +X wall, face turned to -X
};

const ART = 0.011;
const SHELF = 0.15;
const BRACKET = 0.0075;

function place(entries: WallEntry[]): DecorPlacement[] {
  return entries.map(entry => {
    const room = HOUSE_LAYOUT.find(candidate => candidate.name === entry.room);
    if (!room) throw new Error(`DecorLayout: unknown room "${entry.room}"`);
    const halfW = room.size.x / 2;
    const halfD = room.size.z / 2;
    const offset = INNER_FACE + entry.depth;
    const base = { asset: entry.asset, y: entry.y, rotation: WALL_ROTATION[entry.wall] };
    switch (entry.wall) {
      case 'north':
        return { ...base, x: room.position.x + entry.u, z: room.position.z - halfD + offset };
      case 'south':
        return { ...base, x: room.position.x - entry.u, z: room.position.z + halfD - offset };
      case 'west':
        return { ...base, x: room.position.x - halfW + offset, z: room.position.z + entry.u };
      default:
        return { ...base, x: room.position.x + halfW - offset, z: room.position.z - entry.u };
    }
  });
}

function floor(entries: FloorEntry[]): DecorPlacement[] {
  return entries.map(entry => ({
    asset: entry.asset,
    x: entry.x,
    y: entry.y,
    z: entry.z,
    rotation: entry.rotation ?? 0,
  }));
}

const WALLS: WallEntry[] = [
  // ------------------------------------------------------------------ living
  { asset: 'picture_frame_wide', room: 'living', wall: 'south', u: -1.6, y: 1.5, depth: ART },
  { asset: 'picture_frame_a4', room: 'living', wall: 'south', u: 1.6, y: 1.55, depth: ART },
  { asset: 'clock_wall', room: 'living', wall: 'east', u: -1.85, y: 1.8, depth: ART },
  { asset: 'wall_shelf', room: 'living', wall: 'west', u: -1.6, y: 1.25, depth: SHELF },
  { asset: 'shelf_bracket', room: 'living', wall: 'west', u: -1.9, y: 1.233, depth: BRACKET },
  { asset: 'shelf_bracket', room: 'living', wall: 'west', u: -1.3, y: 1.233, depth: BRACKET },
  { asset: 'book_stack', room: 'living', wall: 'west', u: -1.35, y: 1.28, depth: SHELF },
  { asset: 'candle_jar', room: 'living', wall: 'west', u: -1.58, y: 1.28, depth: SHELF },
  { asset: 'bowl_fruit', room: 'living', wall: 'west', u: -1.85, y: 1.28, depth: SHELF },

  // ---------------------------------------------------------------- entrance
  { asset: 'picture_frame_a4', room: 'entrance', wall: 'north', u: 1.6, y: 1.5, depth: ART },
  { asset: 'coat_hooks', room: 'entrance', wall: 'east', u: 1.3, y: 1.5, depth: ART },
  { asset: 'coat_jacket', room: 'entrance', wall: 'east', u: 1.3, y: 0.74, depth: 0.075 },

  // ----------------------------------------------------------------- kitchen
  { asset: 'spice_rack', room: 'kitchen', wall: 'north', u: 1.1, y: 1.5, depth: 0.03 },
  { asset: 'drying_rack_clothes', room: 'kitchen', wall: 'west', u: -1.4, y: 1.55, depth: 0.02 },

  // ------------------------------------------------------------------ dining
  { asset: 'wall_shelf', room: 'dining', wall: 'west', u: 1.4, y: 1.2, depth: SHELF },
  { asset: 'shelf_bracket', room: 'dining', wall: 'west', u: 1.1, y: 1.183, depth: BRACKET },
  { asset: 'shelf_bracket', room: 'dining', wall: 'west', u: 1.7, y: 1.183, depth: BRACKET },
  { asset: 'wine_bottle', room: 'dining', wall: 'west', u: 1.05, y: 1.23, depth: SHELF },
  { asset: 'wine_glass', room: 'dining', wall: 'west', u: 1.25, y: 1.23, depth: SHELF },
  { asset: 'teapot', room: 'dining', wall: 'west', u: 1.47, y: 1.23, depth: SHELF },
  { asset: 'plate_dinner', room: 'dining', wall: 'west', u: 1.66, y: 1.23, depth: SHELF },
  { asset: 'picture_frame_wide', room: 'dining', wall: 'south', u: -1.1, y: 1.55, depth: ART },
  { asset: 'picture_frame_a4', room: 'dining', wall: 'east', u: -1.6, y: 1.5, depth: ART },

  // ----------------------------------------------------------- master bedroom
  { asset: 'wall_shelf', room: 'master_bedroom', wall: 'south', u: 1.6, y: 1.25, depth: SHELF },
  { asset: 'shelf_bracket', room: 'master_bedroom', wall: 'south', u: 1.3, y: 1.233, depth: BRACKET },
  { asset: 'shelf_bracket', room: 'master_bedroom', wall: 'south', u: 1.9, y: 1.233, depth: BRACKET },
  { asset: 'bedside_books', room: 'master_bedroom', wall: 'south', u: 1.75, y: 1.28, depth: SHELF },
  { asset: 'glasses_specs', room: 'master_bedroom', wall: 'south', u: 1.75, y: 1.35, depth: SHELF },
  { asset: 'alarm_clock', room: 'master_bedroom', wall: 'south', u: 1.45, y: 1.28, depth: SHELF },
  { asset: 'phone_mobile', room: 'master_bedroom', wall: 'south', u: 1.22, y: 1.28, depth: SHELF },
  { asset: 'picture_frame_a4', room: 'master_bedroom', wall: 'east', u: -1.5, y: 1.55, depth: ART },

  // -------------------------------------------------------------- bedroom two
  { asset: 'wall_shelf', room: 'bedroom2', wall: 'east', u: 0.6, y: 1.2, depth: SHELF },
  { asset: 'shelf_bracket', room: 'bedroom2', wall: 'east', u: 0.3, y: 1.183, depth: BRACKET },
  { asset: 'shelf_bracket', room: 'bedroom2', wall: 'east', u: 0.9, y: 1.183, depth: BRACKET },
  { asset: 'phone_mobile', room: 'bedroom2', wall: 'east', u: 0.75, y: 1.23, depth: SHELF },
  { asset: 'picture_frame_a4', room: 'bedroom2', wall: 'west', u: -1.2, y: 1.5, depth: ART },

  // ------------------------------------------------------------------- study
  { asset: 'cork_board', room: 'study', wall: 'east', u: 1.3, y: 1.4, depth: ART },
  { asset: 'wall_shelf', room: 'study', wall: 'south', u: 0.9, y: 1.2, depth: SHELF },
  { asset: 'shelf_bracket', room: 'study', wall: 'south', u: 0.6, y: 1.183, depth: BRACKET },
  { asset: 'shelf_bracket', room: 'study', wall: 'south', u: 1.2, y: 1.183, depth: BRACKET },
  { asset: 'paper_stack', room: 'study', wall: 'south', u: 1.1, y: 1.23, depth: SHELF },
  { asset: 'notebook_open', room: 'study', wall: 'south', u: 0.78, y: 1.23, depth: SHELF },
  { asset: 'pen_cup', room: 'study', wall: 'south', u: 0.58, y: 1.23, depth: SHELF },
];

const FLOOR: FloorEntry[] = [
  // ------------------------------------------------------------------ living
  { asset: 'tv_crt', x: 1.15, y: 0, z: 2.5, rotation: Math.PI },
  { asset: 'game_case_stack', x: 1.15, y: 0.47, z: 2.55 },
  { asset: 'games_console', x: 0.68, y: 0, z: 2.55, rotation: Math.PI + 0.35 },
  { asset: 'remote_control', x: 1.58, y: 0, z: 2.28, rotation: 0.7 },
  { asset: 'soundbar', x: 1.15, y: 0, z: 2.12, rotation: Math.PI },
  { asset: 'cushion_square', x: 0.55, y: 0, z: 2.32, rotation: 0.4 },
  { asset: 'cushion_round', x: 0.22, y: 0, z: 2.45, rotation: -0.3 },
  { asset: 'magazine_pile', x: -2.25, y: 0, z: -2.55, rotation: 0.2 },
  { asset: 'vase_tall', x: -2.6, y: 0, z: 2.3 },

  // ---------------------------------------------------------------- entrance
  { asset: 'shoe_rack', x: 0.97, y: 0, z: 5.6, rotation: Math.PI / 2 },
  { asset: 'keys_tray', x: 0.97, y: 0.62, z: 5.6, rotation: Math.PI / 2 },
  { asset: 'umbrella_stand', x: 2.1, y: 0, z: 4.7 },
  { asset: 'mail_pile', x: 1.75, y: 0, z: 7.45, rotation: 0.3 },
  { asset: 'shopping_bag', x: 2.15, y: 0, z: 6.95, rotation: -0.5 },
  { asset: 'doormat', x: 2.08, y: 0, z: 6.0, rotation: Math.PI / 2 },

  // ----------------------------------------------------------------- kitchen
  { asset: 'chopping_board', x: 5.45, y: 0.9, z: 7.55, rotation: 0.15 },
  { asset: 'knife_block', x: 5.3, y: 0.9, z: 7.8, rotation: -0.1 },
  { asset: 'plate_stack', x: 5.95, y: 0.9, z: 7.72 },
  { asset: 'saucepan', x: 4.62, y: 0.905, z: 7.72 },
  { asset: 'frying_pan', x: 4.92, y: 0.905, z: 7.55, rotation: 0.4 },
  { asset: 'fruit_bowl', x: 6.8, y: 0.9, z: 7.45 },
  { asset: 'mug', x: 6.72, y: 0.9, z: 7.75, rotation: 0.6 },
  { asset: 'cereal_box', x: 7.02, y: 0.9, z: 7.62, rotation: -0.12 },
  { asset: 'placemat', x: 6.35, y: 0.9, z: 7.55, rotation: 0.05 },
  { asset: 'plate_dinner', x: 6.35, y: 0.9, z: 7.55, rotation: 0.05 },
  { asset: 'cutlery_set', x: 6.55, y: 0.9, z: 7.45, rotation: 0.9 },
  { asset: 'glass_tumbler', x: 6.2, y: 0.9, z: 7.7 },
  { asset: 'bowl_cereal', x: 6.05, y: 0.9, z: 7.45 },

  // ----------------------------------------------------------- master bedroom
  { asset: 'clothes_rail', x: -7.7, y: 0, z: 3.9 },
  { asset: 'coat_hanger', x: -7.6, y: 1.3, z: 3.9 },
  { asset: 'suitcase', x: -8.05, y: 0, z: 5.2, rotation: 0.25 },
  { asset: 'duvet_folded', x: -6.0, y: 0, z: 4.1 },
  { asset: 'pillow', x: -6.0, y: 0.24, z: 4.15, rotation: 0.08 },
  { asset: 'laundry_pile', x: -4.2, y: 0, z: 7.6, rotation: 0.4 },
  { asset: 'shoe_pair', x: -4.3, y: 0, z: 4.2, rotation: 0.5 },
  { asset: 'shoe_pair', x: -4.35, y: 0, z: 5.0, rotation: -0.4 },
  { asset: 'book_stack', x: -7.9, y: 0, z: 4.7, rotation: 0.35 },
  { asset: 'magazine_pile', x: -4.6, y: 0, z: 6.9, rotation: -0.2 },
  { asset: 'cushion_square', x: -6.6, y: 0, z: 4.3, rotation: 0.9 },
  { asset: 'suitcase', x: -8.05, y: 0, z: 7.4, rotation: -0.15 },
  { asset: 'coat_hanger', x: -7.3, y: 1.3, z: 3.9, rotation: 0.1 },
  { asset: 'teddy_bear', x: -5.4, y: 0, z: 7.9, rotation: -0.6 },

  // -------------------------------------------------------------- bedroom two
  { asset: 'tv_flat', x: -7.0, y: 0, z: -3.62, rotation: 0 },
  { asset: 'toy_block_set', x: -4.6, y: 0, z: -6.4, rotation: 0.3 },
  { asset: 'teddy_bear', x: -5.2, y: 0, z: -6.5, rotation: 0.5 },
  { asset: 'throw_blanket', x: -7.3, y: 0, z: -6.2, rotation: 0.2 },
  { asset: 'laundry_pile', x: -4.5, y: 0, z: -4.0, rotation: 2.1 },
  { asset: 'cushion_round', x: -4.7, y: 0, z: -5.2, rotation: 0.5 },
  { asset: 'book_stack', x: -7.7, y: 0, z: -3.7, rotation: -0.3 },
  { asset: 'shoe_pair', x: -7.6, y: 0, z: -6.4, rotation: 0.2 },
  { asset: 'magazine_pile', x: -5.9, y: 0, z: -3.7, rotation: 0.6 },
  { asset: 'charger_cable', x: -5.4, y: 0, z: -4.3, rotation: 1.1 },

  // ------------------------------------------------------------------- study
  { asset: 'monitor', x: -4.45, y: 0, z: -1.55, rotation: -1.2 },
  { asset: 'laptop', x: -7.3, y: 0, z: -1.0, rotation: 0.3 },
  { asset: 'keyboard', x: -6.9, y: 0, z: -1.62, rotation: 0.15 },
  { asset: 'mouse', x: -6.45, y: 0, z: -1.55, rotation: 0.2 },
  { asset: 'desk_lamp', x: -7.45, y: 0, z: 1.4, rotation: Math.PI + 0.3 },
  { asset: 'floor_fan', x: -7.5, y: 0, z: -0.2, rotation: Math.PI / 2 + 0.3 },
  { asset: 'trash_bin_office', x: -4.5, y: 0, z: 1.4 },

  // ---------------------------------------------------------------- bathroom
  { asset: 'shampoo_bottle', x: -1.95, y: 0.6, z: 4.45 },
  { asset: 'conditioner_bottle', x: -1.78, y: 0.6, z: 4.45 },
  { asset: 'candle_jar', x: -0.45, y: 0.6, z: 4.45 },
  { asset: 'soap_bar', x: -0.72, y: 0.885, z: 7.35 },
  { asset: 'towel_folded', x: -0.72, y: 0.885, z: 7.6, rotation: Math.PI / 2 },
  { asset: 'towel_hanging', x: -1.65, y: 0.5, z: 7.66, rotation: Math.PI },
  { asset: 'bath_toy', x: -0.55, y: 0, z: 5.35, rotation: 0.4 },
  { asset: 'scale_bathroom', x: 0.25, y: 0, z: 6.55, rotation: 0.15 },
];

export const DECOR_PLACEMENTS: DecorPlacement[] = [...place(WALLS), ...floor(FLOOR)];
