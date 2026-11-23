# FINALLY-3D.md — the complete Blender asset plan

Work order for every 3D model **Filthy Rich** needs to stop looking cheap.
Written for me (the agent) to follow later without re-deriving anything.

Read the whole thing before opening Blender. Build in phase order.
If a row here disagrees with the code, the code wins — then fix the row.

Legend: `[x]` done and shipped · `[ ]` to build · `[~]` exists but needs redoing

---

## §0. How to use this file

- **§1–§4 are law.** Axes, pivots, naming, materials, budgets. Apply them to
  every asset without being told again.
- **§5–§14 are the inventory.** One table per group, one row per file.
- **§15–§18 are the plumbing.** Animation, collisions, build scripts, integration.
- **§19–§21 are the order of work, the done-checks, and the open questions.**

Rules of engagement:

1. Never add an asset that has no row. Add the row first, then build it.
2. Never rename a file that code already loads. New names only for new groups.
3. Every phase ends with a build, a validation run, a visual check, and a push.
4. If a piece needs a code change to appear, that change is part of the phase —
   not a follow-up.

---

## §1. Ground truth: what exists right now

### 1.1 Rooms the game actually builds

From `src/systems/HouseLayout.ts` — eight rooms, all on one floor:

| room | notes |
|---|---|
| `entrance` | the spawn, first thing the player sees |
| `living` | biggest, sofa/TV wall |
| `kitchen` | wet room, hard floor |
| `dining` | table and chairs |
| `master_bedroom` | bed, wardrobe, nightstands |
| `bathroom` | wet room, tiles |
| `study` | desk, chair, bookshelves |
| `bedroom2` | small bedroom |

Every room is currently four zero-thickness planes, a floor plane, a ceiling
plane, and trim drawn as thin boxes. Doorways are gaps cut into the wall planes.

### 1.2 Furniture that is already modelled `[x]`

Measured from the shipped GLBs (triangle counts are real, not estimates):

| file | tris | materials |
|---|---|---|
| `sofa` | 4,776 | teal / walnut |
| `armchair` | 3,064 | teal / walnut |
| `dining_chair` | 1,316 | linen / walnut |
| `office_chair` | 1,612 | steel |
| `beanbag` | 1,904 | linen |
| `coffee_table` | 1,128 | oak / walnut |
| `dining_table` | 1,240 | oak / walnut |
| `desk` | 1,076 | oak / walnut / linen |
| `nightstand` | 1,188 | walnut / linen / brass |
| `sideboard` | 1,588 | walnut / oak / brass |
| `tv_stand` | 1,048 | walnut / oak / steel |
| `bookshelf` | 2,484 | walnut / oak / rug / paper |
| `wardrobe` | 728 | walnut / oak / brass |
| `bed_frame` | 2,712 | walnut / linen / teal / paper |
| `floor_lamp` | 996 | steel / brass / linen |
| `table_lamp` | 1,804 | ceramic / brass / linen |
| `pendant` | 496 | steel / brass |
| `rug` | 296 | rug / oak |
| `mirror` | 296 | brass / glass |
| `plant_small` | 6,948 | ceramic / leaf |
| `plant_large` | 9,992 | ceramic / walnut / leaf |
| `art_large` | 404 | walnut / paper / teal |

**Total: 47,096 tris.** These are good; the furniture is not the problem any more.
What is missing is everything around it: walls with thickness, trim, doors that
look like doors, clothes, dishes, clutter, and a world outside the windows.

### 1.3 What the code expects from models

| system | file | how it loads |
|---|---|---|
| furniture | `FurnitureManager.ts` | map of id → `/models/furniture/<id>.glb`, cached |
| trash | `TrashManager.ts` | 23 type names + size/mass table, currently box meshes |
| cleaning tools | `DiegeticHUD.ts` | 4 tools (`spray`, `mop`, `vacuum`, `trash_bag`) built from primitives |
| vehicles | `VehicleVisual.ts` | body built from boxes; wheels built separately in `Vehicle.ts::createWheel()` |
| rooms | `Room.ts` | `createWallsWithOpenings`, `createWallSegment`, `createBaseboards`, `createDoorFrames`, `createWindowFrames`, `createCrownMolding` |
| world | `HouseGenerator.ts`, `ExteriorGenerator.ts`, `TerrainSystem.ts` | box houses, grass/driveway planes |
| garage | `RepairBay.ts`, `RecoveryTruck.ts` | procedural |

Every one of these has a replacement note in §17.

---

## §2. The pipeline (verified in this VM)

Blender 4.2.23 LTS lives at `$HOME/blender/blender`, outside the repo. The machine
has no root password, so the missing X libraries were unpacked from Ubuntu `.deb`
files into `$HOME/blender-libs`. **Blender will not start without the library path.**

```bash
export LD_LIBRARY_PATH=$HOME/blender-libs/usr/lib/x86_64-linux-gnu
$HOME/blender/blender --background --python tools/blender/build_<group>.py
```

Build a subset by naming assets after `--`:

```bash
$HOME/blender/blender --background --python tools/blender/build_furniture.py -- sofa armchair
```

Export call — identical in every script:

```python
bpy.ops.export_scene.gltf(
    filepath=path,
    export_format="GLB",
    use_selection=True,
    export_apply=True,      # bake modifiers
    export_yup=True,        # Blender Z-up -> three.js Y-up
    export_materials="EXPORT",
    export_animations=True, # only when the asset has clips
)
```

Missing library at runtime? Find the package on
`http://archive.ubuntu.com/ubuntu/pool/main/...`, `curl` the `.deb`,
`dpkg-deb -x <deb> $HOME/blender-libs`, retry. Never try `sudo`.

### 2.1 Previewing without a GPU

This VM has no GPU. EEVEE renders are unreliable and slow; do not build a
Blender-render review loop. Instead:

1. Parse the GLB in Node (JSON chunk) and print meshes/materials/tris/bounds.
2. Look at the game preview — that is the only render that matters.
3. `sharp` renders SVG → PNG if a diagram is needed (`npm i --no-save sharp`).

### 2.2 Rebuilding everything

`tools/blender/build_all.py` imports each group module and runs it in order, then
writes `public/models/models.manifest.json` (§16.3). One command, whole library.

---

## §3. Universal rules

### 3.1 Axes and scale

- **Metres, always.** Door 2.10 m, worktop 0.90 m, seat 0.45 m, ceiling 2.60 m.
- **Blender is Z-up, the game is Y-up.** Build standing on the Z=0 floor; the
  exporter rotates it. Never pre-rotate by hand.
- **Forward is −Y in Blender** → −Z in three.js. Anything with a front
  (sofa, wardrobe, car, toilet) faces −Y while you model it.
- **World scale check:** if a mesh has to be scaled in code by anything other than
  `1`, the model is wrong. Fix the model.

### 3.2 Pivots

| kind of object | pivot |
|---|---|
| furniture, fixtures, props | floor centre (x/y centred, z = 0) |
| wall-mounted (mirror, art, sconce, shelf) | centre of its back face, z = 0 at that point |
| ceiling-hung (pendant, ceiling rose) | top of the object |
| handheld tools | grip centre, so the hand anchor is obvious |
| doors | hinge edge, so rotation looks right |
| drawers / lids | rear hinge edge |
| vehicles | ground level, centre of the wheelbase |
| wheels | hub centre |
| trash | bottom centre |

Put the pivot on a logical joint, not on the bounding-box corner. Every animation
in §15 assumes this.

### 3.3 Geometry quality bar

- **Bevel everything.** `width` 0.008–0.04 m, 2–4 segments, angle limit 40°.
  An unbevelled box is the exact tell that makes a game look amateur.
- **Shade smooth by angle, never smooth-all.** ~38° for furniture, ~50° for
  organic shapes, flat for glass panes and paper.
- **No ngons on curved surfaces.** Triangulate on export, but keep quads in the
  `.blend` so the smooth shading stays clean.
- **No interior faces.** Delete hidden geometry; at 47k tris the furniture is
  already paying for faces nobody can see.
- **Add the "second read".** Every piece needs one small detail that rewards a
  closer look: a grain groove, a stitch seam, a handle plate, a shadow gap.
  Without it, a beveled box is still a box.

### 3.4 Materials

Colour + roughness + metallic only. No image textures until §14, and when they
arrive they live in the same library so everything stays consistent.

| key | hex | rough | metal | used for |
|---|---|---|---|---|
| `paint_white` | `#E8E4DC` | 0.88 | 0 | walls, trim, doors, appliances |
| `paint_cream` | `#DCD2BE` | 0.90 | 0 | feature walls |
| `paint_sage` | `#9AA48C` | 0.88 | 0 | one accent room |
| `plaster` | `#D8D2C4` | 0.95 | 0 | aged wall, under paint |
| `tile_white` | `#EDEDE9` | 0.15 | 0 | bathroom, kitchen splashback |
| `tile_grout` | `#B9B4A8` | 0.95 | 0 | grout lines |
| `oak` | `#8A5A2E` | 0.50 | 0 | light timber |
| `walnut` | `#4A2C18` | 0.45 | 0 | dark timber |
| `pine` | `#C08A4E` | 0.55 | 0 | cheap furniture, crates |
| `mdf` | `#B9A88E` | 0.70 | 0 | flat-pack carcasses |
| `teal` | `#2E6E78` | 0.85 | 0 | upholstery, accent |
| `linen` | `#C9C0AE` | 0.90 | 0 | fabric, shades, bedding |
| `denim` | `#3E5470` | 0.80 | 0 | throws, jeans piles |
| `rug_red` | `#7A2226` | 0.95 | 0 | rugs, dark fabric |
| `brass` | `#B08A3E` | 0.32 | 1.0 | handles, fittings |
| `chrome` | `#C3C7CB` | 0.12 | 1.0 | taps, car trim, mirrors |
| `steel` | `#6E7276` | 0.38 | 0.85 | tools, appliances |
| `cast_iron` | `#3A3A3C` | 0.60 | 0.70 | pans, radiators, weights |
| `ceramic` | `#EFEBE3` | 0.25 | 0 | sanitaryware, pots, mugs |
| `glass_clear` | `#B7CBD2` | 0.08 | 0 | panes, bottles |
| `glass_frosted` | `#D5DEE0` | 0.30 | 0 | shower screens |
| `paper` | `#D9D4C6` | 0.80 | 0 | books, tissues, card |
| `cardboard` | `#B08B5E` | 0.85 | 0 | boxes |
| `plastic_white` | `#E4E4E0` | 0.45 | 0 | bins, containers |
| `plastic_red` | `#C4372E` | 0.40 | 0 | spray bottle, buckets |
| `rubber` | `#232323` | 0.85 | 0 | tyres, gloves, seals |
| `leather_black` | `#2A2724` | 0.55 | 0 | car interior, office chair |
| `leaf` | `#3E7A34` | 0.65 | 0 | plants |
| `bark` | `#4E3A28` | 0.90 | 0 | trunks |
| `asphalt` | `#3B3B3D` | 0.92 | 0 | road |
| `concrete` | `#A8A49C` | 0.90 | 0 | paving, kerb |
| `grass` | `#5B7A3A` | 0.95 | 0 | lawn |
| `brick` | `#8E4A3A` | 0.90 | 0 | house body |
| `render` | `#E2DCD0` | 0.93 | 0 | house body |
| `roof_tile` | `#4A3B36` | 0.80 | 0 | roof |
| `grime` | `#3A3026` | 0.95 | 0 | filth overlay |
| `mould` | `#4A5240` | 0.90 | 0 | damp patches |
| `limescale` | `#C8C4B4` | 0.85 | 0 | taps, tiles |
| `grease` | `#5A4A2E` | 0.55 | 0 | kitchen, engine |
| `rust` | `#8A4A24` | 0.85 | 0.2 | neglected metal |
| `emissive_warm` | `#FFD9A0` emissive | — | — | lamp bulbs, screens |
| `emissive_cool` | `#CFE6FF` emissive | — | — | screens, freezer light |

**Filth variants.** For any surface that can be dirty, add a second material slot
`grime_overlay` and paint the dirtiest 20–40% of faces with it. The cleaning code
can then flip `emissive`/colour per surface instead of swapping whole models.

### 3.5 Budgets

| class | tris / asset | notes |
|---|---|---|
| trim, frames, small props | ≤ 400 | they are numerous |
| furniture | ≤ 6,000 | proven by the current set |
| fixtures (bath, kitchen run) | ≤ 2,500 | |
| trash items | ≤ 350 | 20+ on the floor at once |
| handheld tools | ≤ 1,800 | always on screen |
| car body | ≤ 10,000 | |
| hero props (hoist, truck) | ≤ 12,000 | |
| vegetation | ≤ 3,500 | instanced heavily |

Whole library target **≤ 400k tris**; any single room on screen **≤ 90k**.
If a piece breaks budget, simplify the silhouette — never ship 20k tris for a mug.

### 3.6 Naming

- Files: `snake_case.glb`, no spaces, no capitals. Variants as suffixes:
  `door_leaf`, `door_leaf_worn`, `door_leaf_lod1`.
- Objects inside: `snake_case`, descriptive (`seat_cushion`, `door_panel`).
- Material slots: one of the palette keys above, exactly.
- Colliders: object named `COL_<thing>` (§15.2).
- Interaction sockets: empty named `SOC_<purpose>` (§15.3).
- Animation clips: `AN_<verb>` (`AN_door_open`, `AN_drawer_slide`).

---

## §4. File layout

```
public/models/
  architecture/     walls, trim, doors, windows, stairs, ceilings
  fixtures/         kitchen, bathroom, laundry, utility, heating
  furniture/        [x] 22 pieces already shipped
  decor/            tableware, books, textiles, small props
  trash/            23 types + variants + spills
  tools/            cleaning kit + PPE + consumables
  vehicles/         bodies, wheels, lights, damage
  repair/           garage fixtures, tools, parts
  exterior/         houses, garden, street furniture
  vegetation/       trees, bushes, hedges
  grime/            decal sheets, grime meshes, cobwebs
assets/blender/     .blend sources (only if small; scripts are the source of truth)
tools/blender/      build_<group>.py + lib.py
```

`lib.py` holds the shared helpers (`box`, `cyl`, `bevel`, `shade`, `mat`,
`export_glb`, `report`). Every group script imports it. Never copy-paste geometry
code between scripts — extend `lib.py`.

---

## §5. Phase 1 — the house shell `[ ]` (biggest visual win)

The house is the thing the player stares at for hours, and right now the walls
have no thickness, the trim is a thin box, and doorways are holes. This phase
fixes the feeling of "not a real place".

Folder: `public/models/architecture/`

### 5.1 Walls — a modular kit, not one mesh per room

1 m wide modules, tiled along a wall, so any room length works. Walls get
**0.15 m thickness** — thickness is what makes door reveals and window sills read
as real. Cut openings by leaving module gaps and capping with a frame, never by
deleting faces mid-wall.

| file | size (m) w×d×h | parts | materials | tris |
|---|---|---|---|---|
| `wall_1m.glb` | 1.00 × 0.15 × 2.60 | two faces, top cap, 2 end caps, skirting notch at base | `paint_white` | 240 |
| `wall_1m_cream.glb` | same | same | `paint_cream` | 240 |
| `wall_1m_wet.glb` | same | same + tiled lower band to 1.2 m | `tile_white`, `tile_grout` | 480 |
| `wall_1m_exterior.glb` | same | inner face, outer face, cavity line | `plaster`, `brick` or `render` | 320 |
| `wall_end.glb` | 0.15 × 0.15 × 2.60 | vertical pilaster for open ends | matching | 120 |
| `wall_corner_out.glb` | 0.15 × 0.15 × 2.60 | outer corner cap, mitred | matching | 160 |
| `wall_corner_in.glb` | 0.15 × 0.15 × 2.60 | inner corner cap | matching | 140 |
| `wall_dado.glb` | 1.00 × 0.15 × 2.60 | wall + dado rail at 1.0 m | `paint_white`, `oak` | 300 |
| `wall_panel_raised.glb` | 1.00 × 0.15 × 2.60 | wainscot panelling below 1.1 m | `paint_white` | 520 |
| `wall_damaged.glb` | 1.00 × 0.15 × 2.60 | hole, cracked plaster, exposed lath | `plaster`, `pine` | 700 |
| `bulkhead.glb` | 1.00 × 0.15 × 0.35 | dropped ceiling beam/duct boxing | `paint_white` | 180 |

### 5.2 Floors and ceilings

| file | size | parts | materials | tris |
|---|---|---|---|---|
| `floor_planks.glb` | 1 × 1 × 0.03 | 5 boards, staggered joints, micro-gap, grain groove | `oak` ×3 shades | 240 |
| `floor_planks_worn.glb` | 1 × 1 × 0.03 | as above + scuff patches (extra faces) | `oak`, `grime` | 300 |
| `floor_tile.glb` | 1 × 1 × 0.02 | 2×2 tiles, recessed grout | `tile_white`, `tile_grout` | 200 |
| `floor_tile_small.glb` | 1 × 1 × 0.02 | 4×4 tiles (bathroom) | same | 420 |
| `floor_vinyl.glb` | 1 × 1 × 0.01 | lino with a subtle repeat seam | `plastic_white` | 60 |
| `floor_concrete.glb` | 1 × 1 × 0.02 | slab, expansion joint | `concrete` | 80 |
| `floor_carpet.glb` | 1 × 1 × 0.01 | soft top, edge shadow | `linen` | 60 |
| `ceiling_plain.glb` | 1 × 1 × 0.02 | panel with a hairline board joint | `paint_white` | 100 |
| `ceiling_rose.glb` | 0.35 dia × 0.05 | 2 stacked rings | `paint_white` | 220 |
| `ceiling_hatch.glb` | 0.60 × 0.60 × 0.04 | frame, panel, finger pull | `paint_white` | 200 |
| `ceiling_coffer.glb` | 1 × 1 × 0.10 | recessed square panel | `paint_white` | 180 |

### 5.3 Trim profiles — the difference between "built" and "blocked out"

Three skirting profiles, so not every room is identical. All pivot at floor
centre, all tile along X at 1 m.

| file | profile | tris |
|---|---|---|
| `skirting_modern.glb` | flat 0.11 × 0.015 with a top chamfer | 90 |
| `skirting_torus.glb` | 0.14 tall, quarter-round top, ogee base | 160 |
| `skirting_lambs.glb` | 0.16 tall, lamb's-tongue curve | 200 |
| `crown_plain.glb` | 0.08 cove | 110 |
| `crown_ornate.glb` | 0.12 three-step with dentil blocks | 320 |
| `picture_rail.glb` | 0.03 × 0.02 at 1.8 m | 80 |
| `dado_rail.glb` | 0.04 × 0.025 at 1.0 m | 90 |
| `architrave.glb` | 0.07 wide, stepped, 2.15 m | 140 |
| `threshold.glb` | 0.90 × 0.06 × 0.02, oak with brass strip | 90 |
| `vent_grille.glb` | 0.30 × 0.01 × 0.15, 7 louvres | 180 |

### 5.4 Doors

Every door is **frame + leaf + hardware**, separate objects, so a door can open,
be walked through, be missing, or be hanging off a hinge.

| file | size (m) | parts | materials | tris |
|---|---|---|---|---|
| `door_frame_std.glb` | 0.15 deep × 2.15 | jambs, head, stops, architrave both sides | `paint_white` | 380 |
| `door_leaf_panel.glb` | 0.81 × 0.04 × 2.03 | stiles, rails, 2 raised panels | `paint_white` | 460 |
| `door_leaf_flush.glb` | 0.81 × 0.04 × 2.03 | flush slab, shadow gap | `paint_white` | 140 |
| `door_leaf_glazed.glb` | 0.81 × 0.04 × 2.03 | slab + 4 glass lights, glazing beads | `paint_white`, `glass_clear` | 520 |
| `door_leaf_worn.glb` | 0.81 | as panel + chipped paint, scuffs, dented edge | + `grime` | 520 |
| `door_leaf_exterior.glb` | 0.90 × 0.06 × 2.05 | panelled, letterbox, knocker, 2 hinges | `paint_white`/`walnut`, `brass` | 700 |
| `door_bifold.glb` | 1.20 × 0.04 × 2.03 | 2 folding leaves, track, 4 hinges | `paint_white` | 600 |
| `door_sliding.glb` | 1.80 × 0.05 × 2.10 | 2 panels, top rail, 4 rollers | `glass_frosted`, `steel` | 480 |
| `door_french.glb` | 1.60 × 0.05 × 2.10 | 2 leaves, 2 glass lights each, mullions | `paint_white`, `glass_clear` | 780 |
| `door_garage.glb` | 2.40 × 0.05 × 2.10 | 4 horizontal sections, 4 hinges, lock | `paint_white` | 620 |
| `door_handle_lever.glb` | 0.14 × 0.05 | rose, lever, spindle | `brass` | 180 |
| `door_handle_knob.glb` | 0.07 dia | rose, knob, spindle | `brass` | 160 |
| `door_hinge.glb` | 0.10 × 0.02 | 2 knuckles, 3 screws | `brass` | 120 |
| `letterbox.glb` | 0.30 × 0.06 | flap, surround, 2 screws | `brass` | 140 |
| `door_number.glb` | 0.09 tall | 3 digits as separate objects | `brass` | 90 |
| `door_stop.glb` | 0.05 × 0.05 × 0.06 | rubber cone, plate | `rubber`, `steel` | 80 |

### 5.5 Windows

| file | size (m) | parts | materials | tris |
|---|---|---|---|---|
| `window_frame_std.glb` | 1.20 × 0.13 × 1.35 | outer reveal, head, 2 jambs, sill, 2 mullions, 1 transom | `paint_white` | 420 |
| `window_frame_small.glb` | 0.60 × 0.13 × 0.90 | as above, single mullion | `paint_white` | 300 |
| `window_sash.glb` | 1.20 × 0.10 × 1.50 | 2 sashes, parting bead, 2 weights (hidden) | `paint_white` | 620 |
| `window_glass.glb` | 1.15 × 0.006 × 1.30 | single pane | `glass_clear` | 60 |
| `window_sill.glb` | 1.30 × 0.22 × 0.04 | board with drip groove | `oak` | 120 |
| `window_board_up.glb` | 1.15 × 0.01 × 1.30 | boarded-up panel, 4 nails | `pine` | 140 |
| `window_broken.glb` | 1.15 × 1.30 | cracked pane in 6 shards + frame damage | `glass_clear` | 380 |
| `curtain_panel.glb` | 1.00 wide × 2.00 drop | 6 folds, hem, pleat header | `linen` | 900 |
| `curtain_blind_roller.glb` | 1.20 × 0.04 × 2.00 | roll, slat, chain | `linen`, `plastic_white` | 240 |
| `curtain_blind_venetian.glb` | 1.20 × 0.06 × 1.50 | 14 slats, headrail, 2 cords | `plastic_white` | 700 |
| `curtain_rod.glb` | 1.60 long | rod, 2 brackets, 2 finials | `brass` | 260 |

### 5.6 Stairs (study / hallway verticality)

| file | size | parts | tris |
|---|---|---|---|
| `stairs_straight.glb` | 0.95 wide × 2.9 run × 2.7 rise | 13 treads with nosing, 13 risers, 2 stringers | 2,200 |
| `stairs_landing.glb` | 0.95 × 0.95 | landing slab, 2 newels | 700 |
| `stairs_quarter_turn.glb` | 1.9 × 1.9 footprint | 6 treads, winders, landing, 3 newels | 3,000 |
| `handrail.glb` | 1 m | rail, 4 balusters, brackets | 420 |
| `newel_post.glb` | 0.09 × 0.09 × 1.0 | square post, cap, base block | 300 |
| `spindle_twist.glb` | 0.03 dia × 0.85 | turned profile, 6 lathe rings | 260 |
| `stair_nosing.glb` | 1 m | oak strip, anti-slip grooves | 120 |

Stairs are optional for now — the house is one floor — but the geometry is cheap
and the attic/basement can use it later. Build them only if §19 puts them in the
current phase.

---

## §6. Phase 2 — fixtures and appliances `[ ]`

Folder: `public/models/fixtures/`

The premise of the game is cleaning a filthy house, so fixtures matter more than
furniture: they are what the player scrubs. Every washable fixture gets a
**filthy twin** (`<name>_filthy.glb`) with a grime material on the dirtiest faces.

### 6.1 Kitchen

| file | size (m) | parts | materials | tris |
|---|---|---|---|---|
| `kitchen_run_2m.glb` | 2.00 × 0.62 × 0.90 | carcass, 4 doors, 2 drawers, worktop, plinth, 6 handles, 2 shadow gaps | `paint_white`, `oak`, `brass` | 1,400 |
| `kitchen_run_1m.glb` | 1.00 × 0.62 × 0.90 | half run | same | 800 |
| `kitchen_corner.glb` | 0.62 × 0.62 × 0.90 | corner carcass, 1 door | same | 500 |
| `kitchen_upper.glb` | 1.00 × 0.35 × 0.70 | 2 wall cupboard doors, 2 shelves | same | 620 |
| `kitchen_sink.glb` | 0.80 × 0.60 × 0.90 | cabinet, basin with rounded inner, tap, drainer, overflow | `paint_white`, `chrome` | 960 |
| `kitchen_tap.glb` | 0.20 tall | body, spout, 2 levers, aerator | `chrome` | 320 |
| `hob_4burner.glb` | 0.60 × 0.52 × 0.05 | glass top, 4 burner rings, 4 knobs, grates | `glass_clear`, `cast_iron`, `steel` | 700 |
| `oven_builtin.glb` | 0.60 × 0.55 × 0.60 | body, door, window, handle, 2 shelves | `steel`, `glass_clear` | 640 |
| `cooker_freestanding.glb` | 0.60 × 0.60 × 0.90 | body, oven, hob, 4 knobs, grill pan | `steel`, `glass_clear` | 920 |
| `fridge_freezer.glb` | 0.70 × 0.70 × 1.85 | body, 2 doors, 2 handles, vent, 2 feet | `paint_white`, `chrome` | 760 |
| `fridge_under_counter.glb` | 0.60 × 0.60 × 0.85 | body, door, shelf | `paint_white` | 340 |
| `range_hood.glb` | 0.90 × 0.50 × 0.45 | canopy, chimney, filter, 2 lamps | `steel` | 420 |
| `dishwasher.glb` | 0.60 × 0.60 × 0.85 | body, door, control strip, handle, 2 baskets | `steel`, `plastic_white` | 700 |
| `microwave.glb` | 0.50 × 0.35 × 0.30 | body, windowed door, 4 buttons, turntable | `paint_white`, `glass_clear` | 300 |
| `kettle.glb` | 0.22 × 0.16 × 0.24 | body, lid, handle, spout, base | `chrome`, `plastic_white` | 420 |
| `toaster.glb` | 0.28 × 0.17 × 0.19 | body, 2 slots, 2 levers, crumb tray | `chrome` | 320 |
| `coffee_machine.glb` | 0.25 × 0.32 × 0.38 | body, group head, 2 cups, drip tray | `steel`, `ceramic` | 460 |
| `splashback.glb` | 1.00 × 0.01 × 0.60 | 4 tiles + grout | `tile_white`, `tile_grout` | 200 |
| `kitchen_bin.glb` | 0.30 dia × 0.65 | pedal bin, lid, liner lip | `steel` | 320 |
| `dish_rack.glb` | 0.40 × 0.30 × 0.15 | wire frame, 6 plates | `steel`, `ceramic` | 500 |
| `bread_bin.glb` | 0.38 × 0.28 × 0.30 | body, lid, handle | `steel` | 260 |

### 6.2 Bathroom

| file | size | parts | materials | tris |
|---|---|---|---|---|
| `toilet_close_coupled.glb` | 0.38 × 0.66 × 0.78 | bowl, pedestal, cistern, lid, seat, flush button | `ceramic`, `chrome` | 980 |
| `toilet_seat_up.glb` | — | same, lid raised (for animation) | same | 260 |
| `bath_standard.glb` | 1.70 × 0.75 × 0.56 | outer shell, inner bowl, 2 taps, overflow, waste, 4 feet | `ceramic`, `chrome` | 1,200 |
| `bath_panel.glb` | 1.70 × 0.02 × 0.52 | acrylic side panel, 2 clips | `plastic_white` | 120 |
| `shower_tray.glb` | 0.90 × 0.90 × 0.14 | tray, waste, 4 levelling feet | `ceramic` | 380 |
| `shower_enclosure.glb` | 0.90 × 0.90 × 2.00 | 2 glass panels, 2 frames, 2 hinges, handle | `glass_frosted`, `chrome` | 720 |
| `shower_head.glb` | 0.22 dia | head, 3 spray rings | `chrome` | 260 |
| `shower_riser.glb` | 1.10 tall | rail, slider, hose, mixer | `chrome` | 420 |
| `vanity_unit.glb` | 0.90 × 0.50 × 0.85 | cabinet, 2 doors, basin, tap | `oak`, `ceramic`, `chrome` | 820 |
| `mirror_cabinet.glb` | 0.60 × 0.15 × 0.70 | body, mirrored door, 2 shelves | `paint_white`, `glass_clear` | 340 |
| `towel_rail.glb` | 0.60 × 0.10 | 2 brackets, 12 bars, towel | `chrome`, `linen` | 500 |
| `toilet_roll_holder.glb` | 0.14 × 0.14 | bracket, spindle, roll | `chrome`, `paper` | 220 |
| `bath_mat.glb` | 0.70 × 0.45 × 0.02 | tufted mat, bound edge | `linen` | 200 |
| `soap_dish.glb` | 0.12 × 0.09 | dish, bar of soap | `ceramic` | 160 |
| `shower_curtain.glb` | 1.20 × 2.00 | 8 folds, 8 rings, rail | `plastic_white`, `chrome` | 620 |
| `toothbrush_cup.glb` | 0.07 dia × 0.10 | cup, 2 brushes | `ceramic`, `plastic_white` | 260 |
| `bath_taps_pair.glb` | 0.14 each | 2 pillar taps, cross heads | `chrome` | 300 |
| `radiator_chrome.glb` | 0.60 × 0.10 × 1.20 | 18 bars, 2 valves | `chrome` | 620 |

### 6.3 Laundry and utility

| file | size | parts | materials | tris |
|---|---|---|---|---|
| `washing_machine.glb` | 0.60 × 0.60 × 0.85 | body, door with glass dome, dial, 3 buttons, drawer | `paint_white`, `glass_clear` | 720 |
| `dryer.glb` | 0.60 × 0.60 × 0.85 | body, door, filter, dial | `paint_white` | 560 |
| `laundry_basket.glb` | 0.45 × 0.35 × 0.30 | woven body, 2 handles, clothes peeking | `plastic_white`, `linen` | 520 |
| `airer.glb` | 1.20 × 0.55 × 0.95 | frame, 12 bars, 4 feet | `steel` | 420 |
| `ironing_board.glb` | 1.20 × 0.35 × 0.90 | top, pad, 4 legs, iron | `linen`, `steel`, `plastic_white` | 560 |
| `iron.glb` | 0.26 × 0.12 × 0.14 | body, sole plate, handle, dial, cable | `plastic_white`, `chrome` | 400 |
| `boiler.glb` | 0.50 × 0.32 × 0.80 | body, panel, 3 pipes, pressure gauge | `paint_white`, `steel` | 420 |
| `water_tank.glb` | 0.55 dia × 1.20 | cylinder, lagging, 2 pipes | `plastic_white`, `steel` | 300 |
| `fuse_box.glb` | 0.30 × 0.10 × 0.45 | box, door, 8 breakers | `plastic_white` | 260 |
| `meter_box.glb` | 0.25 × 0.12 × 0.30 | box, dial, cable | `plastic_white`, `glass_clear` | 200 |
| `pipes_run.glb` | 1 m | 3 pipes, 2 elbows, clips | `chrome` | 260 |
| `stopcock.glb` | 0.12 | valve, handle, pipe stubs | `brass` | 180 |

### 6.4 Heating

| file | size | parts | materials | tris |
|---|---|---|---|---|
| `radiator_panel.glb` | 0.80 × 0.10 × 0.60 | 11 fins, top grille, 2 brackets, valve | `paint_white`, `brass` | 520 |
| `radiator_column.glb` | 0.60 × 0.15 × 1.00 | 6 columns, 2 valves | `cast_iron` | 620 |
| `thermostat.glb` | 0.09 × 0.03 | dial, LCD, bracket | `plastic_white` | 160 |
| `wood_stove.glb` | 0.55 × 0.55 × 0.75 | body, glass door, flue, log | `cast_iron`, `glass_clear`, `bark` | 900 |
| `fireplace_surround.glb` | 1.20 × 0.25 × 1.10 | mantel, 2 legs, hearth, fireback | `paint_white`, `cast_iron` | 780 |
| `chimney_breast.glb` | 1.20 × 0.35 × 2.60 | breast, alcoves, shelf | `plaster` | 420 |

---

## §7. Phase 3 — decor, so rooms look lived in `[ ]`

Folder: `public/models/decor/`

Empty rooms read as unfinished. This phase is the cheapest large improvement:
small objects at human scale, in quantity, placed on the furniture already built.

### 7.1 Living room dressing

| file | size (m) | tris | notes |
|---|---|---|---|
| `cushion_square.glb` | 0.45 × 0.12 × 0.45 | 380 | soft creases, piped edge |
| `cushion_round.glb` | 0.40 dia × 0.12 | 340 | |
| `throw_blanket.glb` | 1.20 × 0.02 × 1.60 | 900 | folds, fringe |
| `tv_flat.glb` | 1.10 × 0.06 × 0.65 | 420 | screen, bezel, stand, cable |
| `tv_crt.glb` | 0.55 × 0.50 × 0.45 | 380 | chunky, vents, 2 knobs |
| `soundbar.glb` | 0.90 × 0.09 × 0.07 | 220 | |
| `games_console.glb` | 0.30 × 0.25 × 0.08 | 300 | vents, disc slot, 2 cables |
| `game_case_stack.glb` | 0.14 × 0.02 × 0.19 | 260 | 8 cases, staggered |
| `remote_control.glb` | 0.20 × 0.05 × 0.02 | 160 | 12 buttons, IR window |
| `magazine_pile.glb` | 0.30 × 0.22 × 0.10 | 240 | 5 magazines, curved |
| `book_stack.glb` | 0.25 × 0.18 × 0.14 | 300 | 6 books, uneven |
| `picture_frame_a4.glb` | 0.32 × 0.02 × 0.42 | 200 | frame, mount, art panel |
| `picture_frame_wide.glb` | 0.70 × 0.02 × 0.45 | 220 | |
| `clock_wall.glb` | 0.30 dia × 0.05 | 260 | face, 2 hands, bezel |
| `candle_jar.glb` | 0.09 dia × 0.12 | 200 | wax level, wick |
| `vase_tall.glb` | 0.14 dia × 0.40 | 300 | lathe profile, 3 stems |
| `bowl_fruit.glb` | 0.28 dia × 0.10 | 420 | bowl + 5 fruit |
| `ashtray.glb` | 0.12 dia × 0.04 | 160 | 2 butts |

### 7.2 Dining and kitchen dressing

| file | size | tris | notes |
|---|---|---|---|
| `plate_dinner.glb` | 0.26 dia × 0.02 | 180 | rim, well |
| `plate_stack.glb` | 0.26 dia × 0.09 | 420 | 5 plates |
| `bowl_cereal.glb` | 0.16 dia × 0.07 | 160 | |
| `mug.glb` | 0.09 dia × 0.10 | 220 | handle, interior |
| `glass_tumbler.glb` | 0.07 dia × 0.11 | 180 | thick base |
| `wine_glass.glb` | 0.07 dia × 0.20 | 260 | stem, bowl |
| `cutlery_set.glb` | 0.20 long | 300 | knife, fork, spoon, 3 objects |
| `placemat.glb` | 0.42 × 0.30 × 0.004 | 40 | |
| `table_runner.glb` | 2.00 × 0.35 × 0.004 | 60 | |
| `teapot.glb` | 0.20 × 0.14 × 0.16 | 340 | spout, lid, handle |
| `saucepan.glb` | 0.22 dia × 0.10 | 300 | body, lid, 2 handles |
| `frying_pan.glb` | 0.28 dia × 0.05 | 260 | pan, handle |
| `chopping_board.glb` | 0.40 × 0.28 × 0.03 | 140 | grain groove |
| `knife_block.glb` | 0.12 × 0.20 × 0.25 | 300 | block + 4 knives |
| `fruit_bowl.glb` | 0.30 dia × 0.12 | 400 | |
| `spice_rack.glb` | 0.40 × 0.08 × 0.30 | 420 | 8 jars |
| `cereal_box.glb` | 0.20 × 0.07 × 0.30 | 200 | |
| `wine_bottle.glb` | 0.08 dia × 0.30 | 260 | |
| `drying_rack_clothes.glb` | 0.80 × 0.05 × 0.90 | 380 | 5 garments |

### 7.3 Bedrooms

| file | size | tris | notes |
|---|---|---|---|
| `duvet_folded.glb` | 1.60 × 0.25 × 0.40 | 700 | at the foot of the bed |
| `pillow.glb` | 0.65 × 0.15 × 0.40 | 420 | compressed edges |
| `bedside_books.glb` | 0.18 × 0.14 × 0.06 | 220 | 3 books, glasses on top |
| `glasses_specs.glb` | 0.14 × 0.05 × 0.03 | 220 | 2 lenses, 2 arms |
| `alarm_clock.glb` | 0.14 × 0.08 × 0.06 | 260 | digits, buttons |
| `phone_mobile.glb` | 0.075 × 0.15 × 0.008 | 200 | screen, camera, case |
| `charger_cable.glb` | 1.00 long | 320 | cable curve, plug, brick |
| `laundry_pile.glb` | 0.45 × 0.30 × 0.25 | 600 | 7 garments, soft |
| `shoe_pair.glb` | 0.28 × 0.12 × 0.10 | 420 | 2 shoes, laces |
| `coat_hanger.glb` | 0.42 × 0.02 | 120 | hook, shoulders |
| `clothes_rail.glb` | 1.00 | 500 | rail, 5 hangers, 3 garments |
| `suitcase.glb` | 0.55 × 0.25 × 0.35 | 400 | shell, handle, 2 wheels |
| `toy_block_set.glb` | 0.30 × 0.30 × 0.25 | 500 | 9 blocks |
| `teddy_bear.glb` | 0.30 tall | 900 | soft body, 4 limbs, ears |

### 7.4 Study

| file | size | tris | notes |
|---|---|---|---|
| `laptop.glb` | 0.34 × 0.24 × 0.02 | 380 | base, lid, hinge, keyboard grid |
| `monitor.glb` | 0.55 × 0.10 × 0.40 | 340 | screen, stand, cable |
| `keyboard.glb` | 0.44 × 0.02 × 0.14 | 320 | 90 key caps as a grid |
| `mouse.glb` | 0.11 × 0.06 × 0.04 | 260 | |
| `desk_lamp.glb` | 0.40 tall | 420 | jointed arm, shade |
| `paper_stack.glb` | 0.21 × 0.29 × 0.06 | 260 | 40 sheets, edge ripple |
| `pen_cup.glb` | 0.08 dia × 0.11 | 280 | cup + 6 pens |
| `notebook_open.glb` | 0.21 × 0.30 | 200 | spine curve, 2 pages |
| `cork_board.glb` | 0.60 × 0.02 × 0.45 | 320 | board, 6 notes, 3 pins |
| `shelf_bracket.glb` | 0.20 × 0.15 | 120 | L bracket, 2 screws |
| `floor_fan.glb` | 0.35 dia × 0.60 | 620 | base, cage, 3 blades |
| `trash_bin_office.glb` | 0.25 dia × 0.35 | 260 | |

### 7.5 Bathroom and entrance dressing

| file | size | tris | notes |
|---|---|---|---|
| `towel_folded.glb` | 0.40 × 0.15 × 0.30 | 480 | 3 folds |
| `towel_hanging.glb` | 0.45 × 0.06 × 0.70 | 520 | drape over rail |
| `shampoo_bottle.glb` | 0.07 dia × 0.20 | 220 | cap, label panel |
| `conditioner_bottle.glb` | same | 220 | |
| `soap_bar.glb` | 0.09 × 0.05 × 0.03 | 120 | |
| `bath_toy.glb` | 0.10 | 240 | duck |
| `scale_bathroom.glb` | 0.30 × 0.30 × 0.05 | 240 | dial |
| `umbrella_stand.glb` | 0.25 dia × 0.55 | 380 | stand + 3 umbrellas |
| `coat_hooks.glb` | 0.60 × 0.10 | 200 | rail, 4 hooks |
| `doormat.glb` | 0.75 × 0.45 × 0.02 | 160 | coir texture via geometry ridges |
| `keys_tray.glb` | 0.20 × 0.15 × 0.02 | 140 | tray, 3 keys |
| `shoe_rack.glb` | 0.80 × 0.30 × 0.60 | 480 | 2 shelves, 4 pairs |
| `coat_jacket.glb` | 0.55 × 0.20 × 0.85 | 700 | hanging, folds |
| `mail_pile.glb` | 0.20 × 0.12 × 0.04 | 260 | 6 envelopes |
| `shopping_bag.glb` | 0.30 × 0.20 × 0.35 | 320 | handles, contents |

### 7.6 Textiles not worth separate files

Curtains, bedding and throws are modelled as geometry (no cloth sim). Every
textile follows the same recipe: a subdivided plane, 4 displaced folds along the
long axis, 2 bevel rounds on the edges, doubled-sided material. That is enough
softness; anything more is wasted on a phone.

---

## §8. Phase 4 — trash, clutter and spills `[ ]`

`TrashManager.ts` draws coloured boxes from a size table. There are **23 types**;
keep the names exact or the spawn table breaks. Folder: `public/models/trash/`.

| file | real size (m) | tris | notes |
|---|---|---|---|
| `pizza_box.glb` | 0.35 × 0.35 × 0.05 | 220 | lid 15° open, grease patch material |
| `pizza_box_closed.glb` | same | 160 | for stacking |
| `beer_can.glb` | 0.066 dia × 0.12 | 180 | tab, rim |
| `beer_can_crushed.glb` | 0.09 × 0.07 | 220 | dented silhouette |
| `takeout_bag.glb` | 0.15 × 0.10 × 0.25 | 260 | creased paper, folded top |
| `condom_wrapper.glb` | 0.05 × 0.05 × 0.006 | 60 | foil, serrated edges |
| `tissue.glb` | 0.10 × 0.08 × 0.01 | 80 | crumpled |
| `tissue_wad.glb` | 0.06 dia | 120 | |
| `bottle.glb` | 0.07 dia × 0.20 | 200 | glass, label band |
| `bottle_tipped.glb` | same, lying | 200 | |
| `magazine.glb` | 0.22 × 0.28 × 0.03 | 160 | curled cover |
| `magazine_open.glb` | 0.44 × 0.28 | 140 | face down |
| `sock.glb` | 0.10 × 0.06 × 0.02 | 240 | lumpy, bent |
| `sock_pair.glb` | 0.14 | 320 | |
| `food_container.glb` | 0.12 × 0.12 × 0.05 | 180 | lid askew |
| `hair_clump.glb` | 0.05 × 0.05 × 0.02 | 180 | tuft of strands |
| `red_solo_cup.glb` | 0.08 dia × 0.10 | 160 | rim, base |
| `beer_bottle.glb` | 0.06 dia × 0.22 | 200 | green glass, label |
| `chip_bag.glb` | 0.15 × 0.20 × 0.02 | 240 | standing pouch, foil sheen |
| `confetti.glb` | 0.02 × 0.02 | 12 | single quad |
| `balloon.glb` | 0.12 × 0.15 | 260 | deflated, knot |
| `balloon_inflated.glb` | 0.25 dia | 340 | |
| `newspaper_stack.glb` | 0.30 × 0.22 × 0.15 | 320 | 6 sheets |
| `cardboard_box.glb` | 0.40 × 0.40 × 0.30 | 260 | open flaps |
| `cardboard_box_crushed.glb` | 0.42 × 0.42 × 0.12 | 240 | |
| `plastic_bag.glb` | 0.25 × 0.15 × 0.30 | 300 | crumpled, semi-translucent |
| `old_magazine.glb` | 0.22 × 0.28 × 0.04 | 160 | water-damaged patch |
| `broken_item.glb` | 0.15 × 0.15 × 0.10 | 200 | 3 shards |
| `drywall_piece.glb` | 0.30 × 0.20 × 0.02 | 80 | jagged edge |
| `sawdust_pile.glb` | 0.25 dia × 0.03 | 220 | low mound |
| `paint_can.glb` | 0.15 dia × 0.20 | 200 | lid, handle, paint rim |
| `tape_roll.glb` | 0.06 dia × 0.02 | 140 | torus |
| `cigarette_butt.glb` | 0.008 dia × 0.03 | 90 | filter, ash |
| `dog_hair_tuft.glb` | 0.04 | 140 | |
| `sticky_patch.glb` | 0.15 × 0.15 × 0.002 | 40 | flat, translucent |

Rules: origin bottom centre so items drop onto the floor; ≤ 350 tris each;
big items (boxes, bags) get a `_crushed` variant for after the player walks on
them; every item needs a **collision proxy** (§15.2), never the render mesh.

### 8.1 Spills — geometry or decal?

Liquid spills are decals, not meshes (§13). Exception: the three "chunky" spills
(paint, food, mud) get a 1–2 cm mesh so they read in 3D:

| file | size | tris |
|---|---|---|
| `spill_paint.glb` | 0.35 × 0.35 × 0.01 | 260 |
| `spill_food.glb` | 0.20 × 0.16 × 0.02 | 220 |
| `spill_mud.glb` | 0.30 × 0.22 × 0.02 | 240 |
| `spill_puddle.glb` | 0.40 × 0.30 × 0.004 | 120 |

---

## §9. Phase 5 — the cleaning kit (held, first person) `[ ]`

`CleaningSystem` has exactly four tools: `spray`, `mop`, `vacuum`, `trash_bag`.
`DiegeticHUD.ts` builds the first two from primitives. These are the objects on
screen for the entire game, so they get the most geometry per centimetre in the
whole library.

Folder: `public/models/tools/`

| file | size (m) | tris | parts |
|---|---|---|---|
| `spray_bottle.glb` | 0.10 dia × 0.26 | 900 | bottle, shoulder, trigger, nozzle, cap, label panel; **object named `liquid`** for the level indicator |
| `spray_bottle_empty.glb` | same | 900 | no liquid object |
| `refill_bottle.glb` | 0.09 × 0.24 | 520 | bottle + cap only |
| `mop.glb` | 0.09 dia × 1.35 | 1,100 | handle, grip, ferrule, head plate, 14 strand groups |
| `mop_bucket.glb` | 0.32 × 0.30 × 0.32 | 620 | bucket, wringer, 2 castors, handle |
| `bucket.glb` | 0.28 dia × 0.28 | 380 | body, rim, handle, 2 baffles |
| `vacuum.glb` | 0.30 × 0.34 × 1.10 | 1,600 | body, wheel, hose, wand, floor head, cord reel, filter window |
| `vacuum_floor_head.glb` | 0.30 × 0.08 | 420 | |
| `trash_bag.glb` | 0.30 × 0.30 × 0.45 | 500 | open bag, rolled rim |
| `trash_bag_full.glb` | 0.34 | 640 | bulging |
| `sponge.glb` | 0.12 × 0.08 × 0.05 | 320 | two-layer, scrubby face |
| `scrub_brush.glb` | 0.14 × 0.07 × 0.06 | 420 | bristle clusters |
| `dustpan.glb` | 0.28 × 0.24 × 0.06 | 380 | pan, lip, handle |
| `squeegee.glb` | 0.28 × 0.20 | 320 | blade, head, handle |
| `cloth.glb` | 0.28 × 0.28 × 0.01 | 220 | folded, soft |
| `spray_nozzle.glb` | 0.06 | 220 | replaceable head |
| `glove_hand.glb` | 0.22 | 1,200 | hand + cuff, `rubber`; fingers set for a grip pose |
| `glove_hand_left.glb` | 0.22 | 1,200 | mirror |
| `face_mask.glb` | 0.20 × 0.09 × 0.02 | 300 | straps |
| `apron.glb` | 0.55 × 0.70 | 700 | hanging |
| `caddy.glb` | 0.35 × 0.22 × 0.20 | 480 | 2 compartments, handle |

**Animation clips** on tools: `AN_spray_pull` (trigger squeeze), `AN_mop_swing`
(head arc), `AN_vacuum_push` (subtle wand bob). 12–20 frames, loopable.

---

## §10. Phase 6 — vehicles `[ ]`

`VehicleVisual.ts` builds cars from 8 boxes. You stare at the car constantly, so
this is the second biggest visual win after the house.

**Read `src/vehicle/Vehicle.ts::createWheel()` before you build.** Wheels are not
part of the body: `Vehicle` creates them and positions them from `VehicleSpecs`
(track, wheelbase, `y = wheelRadius`). So bodies are built **without wheels**,
with real arch cut-outs sized from the spec.

Folder: `public/models/vehicles/`

### 10.1 Bodies

| file | length | tris | parts |
|---|---|---|---|
| `car_hatch.glb` | 3.80 | 8,000 | shell, 4 doors, bonnet, hatch, 2 bumpers, 4 arches, 2 mirrors, lights, grille, glass |
| `car_sedan.glb` | 4.70 | 9,000 | same |
| `car_van.glb` | 5.20 | 9,500 | shell, 2 front doors, sliding door, rear doors, roof rail |
| `car_pickup.glb` | 5.40 | 9,000 | cab, bed, tailgate, roll bar |
| `car_coupe.glb` | 4.40 | 9,500 | low roofline |
| `car_estate.glb` | 4.80 | 9,000 | long roof |
| `recovery_truck.glb` | 6.50 | 12,000 | cab, flatbed, boom, winch, 2 beacons, 6 arches, steps |
| `damage_panel_set.glb` | — | 1,500 | 3 dented doors, 2 cracked screens, crumpled bumper |

Per-body requirements:

- Named objects: `door_fl`, `door_fr`, `door_rl`, `door_rr`, `bonnet`, `boot`,
  `mirror_l`, `mirror_r`, `glass_front`, `glass_side`, `light_head_l` …
  `DamageVisuals` and `Vehicle.createWheel` look objects up by name later.
- Material slot named exactly `paint`, so `VehicleSpecs.colour` can tint it.
- Door pivots on the hinge edge (§3.2) for `AN_door_open`.
- Rubber seals around the glass (a thin dark strip) — without it the windows look
  like stickers.
- Panel gaps: 3–5 mm inset lines between doors and shell. Cheap, and they are the
  single biggest "this is a real car" cue at this poly count.

### 10.2 Wheels and trim

| file | size | tris | parts |
|---|---|---|---|
| `wheel_standard.glb` | 0.62 dia × 0.22 | 900 | tyre with tread blocks, rim, 5 spokes, hub, disc, caliper |
| `wheel_sport.glb` | 0.66 dia × 0.25 | 1,000 | thinner spokes |
| `wheel_steel.glb` | 0.60 dia × 0.20 | 620 | steel rim + plastic cap |
| `wheel_recovery.glb` | 0.80 dia × 0.26 | 900 | heavy tread |
| `hubcap.glb` | 0.38 dia | 320 | |
| `light_head_pair.glb` | 0.30 × 0.12 | 420 | lens, reflector, bulb |
| `light_tail_pair.glb` | 0.20 × 0.14 | 380 | red lens, reverse light |
| `plate_uk.glb` | 0.52 × 0.11 × 0.006 | 60 | blank, text is a texture later |
| `exhaust_tip.glb` | 0.07 dia | 180 | |
| `roof_rack.glb` | 1.20 × 1.00 | 420 | 2 bars, 4 feet |
| `tow_bar.glb` | 0.12 | 260 | |

### 10.3 Interiors (visible through glass — do not skip)

| file | tris | parts |
|---|---|---|
| `interior_cabin.glb` | 2,600 | 2 front seats, rear bench, dash, wheel, gear lever, 3 pedals, door cards, headliner |
| `seat_sport.glb` | 700 | sculpted, bolsters |
| `steering_wheel.glb` | 380 | rim, 3 spokes, boss |
| `dashboard.glb` | 620 | dash, 3 vents, cluster, radio, 4 dials |

An empty car interior is the second-most obvious tell after boxy bodies: when the
player looks through the windscreen they see seats or they see nothing.

### 10.4 Dirt and damage layers

`DamageVisuals` already handles dents procedurally; models supply the pieces.

| file | tris | notes |
|---|---|---|
| `panel_dent_a/b/c.glb` | 180 each | overlay panels, slightly offset, `grime`/`rust` materials |
| `windscreen_crack.glb` | 140 | crack pattern as a flat overlay |
| `mud_splatter.glb` | 120 | flat decal mesh for arches |
| `rust_patch.glb` | 80 | flat decal |

---

## §11. Phase 7 — garage and repair kit `[ ]`

Folder: `public/models/repair/`

### 11.1 Garage fixtures

| file | size (m) | tris | parts |
|---|---|---|---|
| `tool_chest.glb` | 1.10 × 0.50 × 0.95 | 1,000 | 6 drawers, 6 pulls, castors, top mat |
| `workbench.glb` | 2.00 × 0.70 × 0.90 | 900 | top, 2 legs, 4 braces, lower shelf, vice |
| `vice.glb` | 0.30 × 0.20 × 0.25 | 320 | jaws, screw, handle |
| `diagnostic_cart.glb` | 0.60 × 0.45 × 1.10 | 700 | screen, stand, 4 castors, cable bundle |
| `parts_shelf.glb` | 1.80 × 0.45 × 2.00 | 900 | 4 shelves, 12 boxes |
| `tyre_stack.glb` | 0.70 dia × 0.60 | 600 | 3 tyres |
| `oil_drum.glb` | 0.58 dia × 0.88 | 380 | 2 ribs, bung, tray |
| `drip_tray.glb` | 0.60 × 0.40 × 0.05 | 160 | |
| `compressor.glb` | 0.90 × 0.45 × 0.70 | 700 | tank, motor, 2 wheels, hose coil |
| `parts_washer.glb` | 0.60 dia × 0.60 | 420 | |
| `engine_stand.glb` | 0.60 × 0.60 × 1.00 | 620 | frame, 4 castors, mount plate |
| `jack_handle.glb` | 0.60 | 120 | |

### 11.2 Lifting and holding

| file | size | tris |
|---|---|---|
| `floor_jack.glb` | 0.60 × 0.30 × 0.18 | 700 |
| `axle_stands_pair.glb` | 0.30 × 0.30 × 0.40 | 480 |
| `ramp_pair.glb` | 1.00 × 0.30 × 0.20 | 420 |
| `engine_hoist.glb` | 1.60 × 0.90 × 1.80 | 1,200 |
| `transmission_jack.glb` | 0.90 × 0.50 × 1.20 | 900 |
| `creeper.glb` | 1.00 × 0.45 × 0.12 | 380 |

### 11.3 Hand tools — one per category, ≤ 500 tris each

Catalogue ids come from `ToolSystem.ts`; these are the visuals for them.
Folder: `public/models/repair/tools/`

| file | tris | covers |
|---|---|---|
| `socket_set.glb` | 500 | `socket_set_budget/standard/pro` (same model, 3 material tints) |
| `spanner_set.glb` | 480 | `spanner_set_*` |
| `screwdriver_set.glb` | 460 | `screwdriver_set` |
| `hex_key_set.glb` | 380 | `hex_key_set` |
| `pliers_set.glb` | 420 | `pliers_set` |
| `spring_compressors.glb` | 500 | `spring_compressors` |
| `ball_joint_separator.glb` | 340 | |
| `brake_bleeder.glb` | 420 | |
| `oil_filter_wrench.glb` | 260 | |
| `obd_scanner.glb` | 380 | `obd_scanner_basic/pro` |
| `multimeter.glb` | 320 | |
| `compression_tester.glb` | 360 | |
| `borescope.glb` | 400 | |
| `stethoscope.glb` | 260 | |
| `pressure_tester.glb` | 300 | |
| `smoke_machine.glb` | 520 | |
| `impact_wrench.glb` | 480 | |
| `angle_grinder.glb` | 440 | |
| `drill_driver.glb` | 460 | |
| `oil_can.glb` | 220 | `penetrating_oil` |
| `sealant_tube.glb` | 180 | `gasket_sealant` |
| `grease_tub.glb` | 200 | `copper_grease` |

### 11.4 Parts (seen in the repair minigame and on shelves)

| file | tris | notes |
|---|---|---|
| `brake_disc.glb` | 420 | vented, worn variant |
| `brake_pad_set.glb` | 260 | 4 pads |
| `oil_filter.glb` | 220 | |
| `air_filter.glb` | 240 | pleats as geometry |
| `spark_plug.glb` | 180 | |
| `battery.glb` | 320 | 2 terminals, label |
| `alternator.glb` | 480 | pulley, vents |
| `starter_motor.glb` | 420 | |
| `turbo.glb` | 620 | housing, wheel, wastegate |
| `radiator.glb` | 380 | core fins, 2 hoses |
| `exhaust_section.glb` | 420 | pipe, muffler, hangers |
| `shock_absorber.glb` | 380 | |
| `coil_spring.glb` | 460 | |
| `control_arm.glb` | 300 | |
| `timing_belt.glb` | 260 | |

---

## §12. Phase 8 — exterior, garden and street `[ ]`

Folder: `public/models/exterior/` and `public/models/vegetation/`.

### 12.1 Houses

`HouseGenerator.ts` / `HouseTemplates.ts` currently produce boxes with flat
colours. One parametric facade model, varied by material and proportion, is
enough for a street.

| file | size (m) | tris | parts |
|---|---|---|---|
| `house_terraced.glb` | 6 × 8 × 8 | 6,000 | body, 2 window reveals, door, roof, 2 chimneys, gutters, downpipe |
| `house_semi.glb` | 8 × 9 × 7 | 7,000 | as above, 3 windows |
| `house_detached.glb` | 11 × 10 × 7 | 8,000 | 5 windows, porch, garage door, 2 chimneys |
| `house_roof.glb` | 8 × 6 × 2 | 1,400 | rafters, tiles as rows of blocks, ridge, 2 vents |
| `chimney_stack.glb` | 0.6 × 0.6 × 1.6 | 420 | 4 pots |
| `gutter_run.glb` | 1 m | 200 | trough, 2 brackets |
| `downpipe_run.glb` | 1 m | 180 | pipe, 2 clips |
| `porch_canopy.glb` | 2.0 × 1.2 | 620 | canopy, 2 posts, brackets |
| `garage_door_ext.glb` | 2.4 × 2.1 | 620 | 4 sections, handle |

### 12.2 Garden

| file | size | tris |
|---|---|---|
| `fence_panel_picket.glb` | 2.0 × 1.2 | 420 |
| `fence_panel_solid.glb` | 2.0 × 1.8 | 260 |
| `gate_garden.glb` | 1.0 × 1.2 | 480 |
| `mailbox.glb` | 0.25 × 0.20 × 1.10 | 300 |
| `bin_wheelie.glb` | 0.60 × 0.60 × 1.00 | 420 |
| `bin_recycling.glb` | same | 420 |
| `water_butt.glb` | 0.50 dia × 1.0 | 320 |
| `compost_bin.glb` | 0.70 × 0.70 × 0.90 | 300 |
| `shed.glb` | 2.4 × 1.8 × 2.0 | 1,600 |
| `greenhouse.glb` | 2.0 × 1.5 × 2.2 | 1,400 |
| `garden_table.glb` | 0.9 dia × 0.7 | 420 |
| `garden_chair.glb` | 0.55 × 0.55 × 0.85 | 520 |
| `bbq.glb` | 0.70 × 0.50 × 0.95 | 620 |
| `washing_line.glb` | 3.0 | 480 |
| `plant_pot.glb` | 0.30 dia × 0.28 | 220 |
| `stepping_stone.glb` | 0.45 × 0.03 | 90 |
| `garden_hose.glb` | coil 0.35 dia | 340 |

### 12.3 Street

| file | size | tris |
|---|---|---|
| `street_lamp.glb` | 0.25 dia × 6.0 | 900 |
| `hydrant.glb` | 0.25 × 0.75 | 500 |
| `road_sign.glb` | 0.60 × 2.4 | 320 |
| `bus_stop.glb` | 3.0 × 1.2 × 2.4 | 1,200 |
| `bench_public.glb` | 1.8 × 0.6 | 520 |
| `bollard.glb` | 0.20 dia × 0.90 | 220 |
| `traffic_cone.glb` | 0.30 × 0.70 | 260 |
| `manhole_cover.glb` | 0.60 dia | 180 |
| `drain_grate.glb` | 0.45 × 0.30 | 220 |
| `utility_pole.glb` | 0.30 dia × 8.0 | 520 |
| `road_kerb.glb` | 1 m | 120 |
| `road_paving_slab.glb` | 1 × 1 | 90 |
| `road_asphalt_patch.glb` | 2 × 2 | 80 |
| `pothole.glb` | 0.6 × 0.4 | 200 |

### 12.4 Vegetation

| file | size | tris | notes |
|---|---|---|---|
| `tree_oak.glb` | 8 × 6 | 3,400 | trunk, 5 branches, 4 canopy clumps |
| `tree_birch.glb` | 7 × 4 | 2,800 | white trunk |
| `tree_conifer.glb` | 6 × 3 | 2,400 | 6 stacked cones |
| `tree_dead.glb` | 6 × 4 | 1,600 | bare branches — good for the "filthy" mood |
| `bush_round.glb` | 1.2 × 0.8 | 700 | |
| `bush_hedge.glb` | 2.0 × 0.9 | 800 | |
| `hedge_run.glb` | 2.0 × 1.0 × 1.2 | 900 | lumpy, uneven top |
| `flower_bed.glb` | 1.0 × 0.4 | 500 | 12 blooms |
| `grass_tuft.glb` | 0.25 | 60 | cross-quad cards |
| `weeds_patch.glb` | 0.5 | 180 | |
| `vine_patch.glb` | 1.0 | 620 | climbing wall plant |

---

## §13. Phase 9 — grime, damage and decals `[ ]`

Filth is the premise. Geometry alone cannot sell it; this is where the game's
"before/after" payoff lives.

Folder: `public/models/grime/` for meshes, `public/textures/grime/` for decals.

### 13.1 Decal sheets (baked in Blender, 512² PNG → KTX2)

Each sheet is a 2×2 or 4×4 grid of variants; the code picks a cell. Alpha is
required: dirt fades at the edges so decals do not read as stickers.

| sheet | cells | content |
|---|---|---|
| `decal_grease.png` | 4×4 | kitchen splash, pan splatter, finger smears |
| `decal_mould.png` | 4×4 | corners, tile grout bloom, ceiling patches |
| `decal_limescale.png` | 4×4 | tap rings, shower screen, kettle base |
| `decal_dust.png` | 4×4 | shelf film, skirting line, picture tops |
| `decal_scuff.png` | 4×4 | shoe marks, chair backs, door kicks |
| `decal_water.png` | 4×4 | ceiling rings, window run-off |
| `decal_rust.png` | 4×4 | radiator legs, bin rims, pipes |
| `decal_footprint.png` | 2×4 | muddy prints, 2 sizes |
| `decal_scratch.png` | 4×4 | glass scratches, worktop cuts |
| `decal_cobweb.png` | 2×2 | corners, window reveals |
| `decal_food.png` | 4×4 | splats, crumbs, sauce |
| `decal_smoke.png` | 2×2 | soot above hob or fire |

### 13.2 Grime meshes (where a flat decal cannot work)

| file | size | tris | notes |
|---|---|---|---|
| `cobweb_corner.glb` | 0.4 × 0.4 | 260 | 6 sagging strands, alpha card |
| `cobweb_full.glb` | 0.8 | 420 | |
| `mould_patch.glb` | 0.3 | 180 | lumpy surface, `mould` material |
| `limescale_crust.glb` | 0.15 | 200 | around a tap base |
| `dust_bunny.glb` | 0.12 | 160 | 3 clumps |
| `grime_streak.glb` | 1.0 × 0.2 | 120 | vertical run below a spill |
| `trash_mound.glb` | 0.9 × 0.5 | 500 | pile of mixed items for hoarder rooms |

### 13.3 Filth states

Three states per cleanable surface, so the change is visible:

1. **Filth level 0–40** — light decals only (dust, smudges).
2. **41–75** — decals + darkened base material (`grime` mixed 30%).
3. **76–100** — decals + grime meshes + reduced specular so it reads as sticky.

This does not need new models, only material variants. Plan for the shader to
handle it: `material.userData.filthMix` driven by `CleaningSystem`.

---

## §14. Phase 10 — textures and the material library `[ ]`

Until now everything is flat colour. That is consistent, but it caps how good the
game can look. Textures are the next step, and they must be small and few.

Folder: `public/textures/<family>/`

| family | maps | size | tiles |
|---|---|---|---|
| `wood_oak` | albedo, normal, roughness | 512² | 1 m |
| `wood_walnut` | albedo, normal, roughness | 512² | 1 m |
| `wood_pine` | albedo | 256² | 1 m |
| `tile_white` | albedo, normal | 512² | 0.6 m (4 tiles) |
| `plaster` | albedo, normal | 512² | 2 m |
| `carpet` | albedo, normal | 256² | 0.5 m |
| `fabric_teal` | albedo, normal | 256² | 0.3 m |
| `fabric_linen` | albedo, normal | 256² | 0.3 m |
| `brick` | albedo, normal | 512² | 1.5 m |
| `roof_tile` | albedo, normal | 512² | 1 m |
| `asphalt` | albedo | 256² | 2 m |
| `grass` | albedo | 256² | 2 m |
| `concrete` | albedo, normal | 256² | 1.5 m |
| `metal_brushed` | albedo, roughness | 256² | 0.5 m |

Rules:

- **Bake in Blender** (`bpy.ops.object.bake`) from procedural nodes; do not paint.
- **Box/Triplanar UV** for architecture, **unwrapped** for furniture and cars.
- **KTX2** via the existing `TextureCompression.ts`; KTX2 halves VRAM on phones.
- **Budget:** no texture above 512², total texture memory under 40 MB.
- Textures are additive: every material must still look acceptable without them,
  because the low-end path will ship flat colours.

### 14.1 Emissive / lighting fixtures

| file | size | tris | notes |
|---|---|---|---|
| `bulb_edison.glb` | 0.06 dia | 160 | emissive filament |
| `bulb_globe.glb` | 0.08 dia | 120 | emissive |
| `strip_light.glb` | 0.90 | 60 | under-cabinet |
| `wall_sconce.glb` | 0.20 × 0.30 | 320 | |
| `chandelier.glb` | 0.60 dia | 1,400 | 5 arms, 5 shades |
| `ceiling_spot.glb` | 0.10 dia | 120 | |
| `tv_screen_face.glb` | 1.05 × 0.60 | 40 | emissive panel, content is a texture |

---

## §15. Animation, collisions, sockets

### 15.1 Clips (baked into the GLB, one action per file)

| clip | assets | frames |
|---|---|---|
| `AN_door_open` | all door leaves | 24 |
| `AN_drawer_slide` | kitchen run, sideboard, tool chest | 18 |
| `AN_lid_open` | toilet, bin, boxes, bath panel | 18 |
| `AN_tap_on` | kitchen_tap, bath_taps | 12 |
| `AN_spray_pull` | spray_bottle | 12 |
| `AN_mop_swing` | mop | 20 |
| `AN_vacuum_push` | vacuum | 16 |
| `AN_bonnet_open` | car bodies | 24 |
| `AN_boot_open` | car bodies | 24 |
| `AN_wheel_spin` | wheels | 1 loop |
| `AN_blink` | (future characters) | — |

Bake at 24 fps, linear interpolation, start at frame 1. Name the action exactly
as above; the loader picks clips by name.

### 15.2 Collision proxies

Every interactive asset ships a simplified collider:

- Object named `COL_<thing>`, no material, no UVs.
- Boxes for furniture, convex hulls for odd shapes, a single box for small props.
- 5–20% of the render triangle count.
- The code must use `COL_*` for physics and the visible mesh only for drawing.

Without this, hundreds of decorative props will wreck the physics step.

### 15.3 Sockets (empties)

| socket | on | purpose |
|---|---|---|
| `SOC_grip` | every handheld tool | hand attachment |
| `SOC_nozzle` | spray bottle | spray particles |
| `SOC_mop_head` | mop | cleaning point, mop trail |
| `SOC_vacuum_head` | vacuum | suction point |
| `SOC_door_hinge` | door frames | rotation pivot override |
| `SOC_light` | lamps, sconces | light source placement |
| `SOC_screen` | TV, monitors | emissive surface, UI projection |
| `SOC_plate` | cars | number plate texture slot |
| `SOC_tow` | recovery truck | tow attach point |
| `SOC_seat` | car interiors | player seat anchor |

Empty count is cheap; guessing positions in code is not. Add the socket.

---

## §16. Build tooling

### 16.1 Script layout

```
tools/blender/
  lib.py               shared geometry/material/export helpers
  build_architecture.py
  build_fixtures.py
  build_furniture.py   [x] exists
  build_decor.py
  build_trash.py
  build_tools.py
  build_vehicles.py
  build_repair.py
  build_exterior.py
  build_vegetation.py
  build_grime.py
  build_all.py         runs every group, then writes the manifest
```

`lib.py` contract (write it once, use it everywhere):

```python
def box(name, size, loc=(0,0,0), bevel=0.01, segments=2, mat=None)
def cyl(name, radius, height, loc=(0,0,0), verts=24, mat=None)
def lathe(name, profile, loc=(0,0,0), segs=24, mat=None)   # taps, vases, bowls
def bevel(obj, width=0.01, segments=2, angle=40)
def shade(obj, angle=38)
def mat(key)                                               # from the palette
def socket(name, loc)
def collider(obj, kind="box")
def export_glb(objs, path, animations=False)
def report(name, tris, path)                               # prints "wrote ..."
```

### 16.2 One asset = one function

```python
def build_sofa():
    parts = [...]
    return export_glb(parts, OUT / "sofa.glb")
```

No shared scene state between assets. Each build starts from a cleared scene, so a
failure in one piece does not poison the rest. `build_all.py` catches per-asset
exceptions and reports them at the end instead of dying on the first.

### 16.3 Manifest

Every build writes `public/models/models.manifest.json`:

```json
{
  "generated": "2026-11-23T00:00:00Z",
  "assets": [
    { "path": "architecture/wall_1m.glb", "group": "architecture",
      "tris": 240, "meshes": 1, "materials": ["paint_white"],
      "bounds": [1.0, 2.6, 0.15], "lod1": "architecture/wall_1m_lod1.glb" }
  ]
}
```

The game reads it once at boot to know what exists, and the validator uses it to
enforce budgets. This kills a whole class of "did the model actually ship?" bugs.

### 16.4 Validator

`tools/validate-models.mjs` (Node, no dependencies) checks:

1. Every `.glb` starts with `glTF`.
2. Every file has ≥ 1 mesh and ≥ 1 material.
3. Tri counts within the §3.5 budget for its folder.
4. Every material name is in the palette.
5. Bounds are sane (nothing larger than 12 m, nothing zero-sized).
6. Manifest matches the files on disk.
7. `_lod1` exists for every asset in an instanced group.

Run it in the phase done-check. Exit code 1 on any failure.

---

## §17. Integration map

| group | code to change | must not change |
|---|---|---|
| architecture | `Room.ts`: replace `createWallsWithOpenings`, `createWallSegment`, `createBaseboards`, `createDoorFrames`, `createWindowFrames`, `createCrownMolding` with module instancing | `HouseLayout.ts` room data, spawn point |
| fixtures | new `FIXTURES` map in `FurnitureManager.ts`; placement in `HouseLayout` | existing furniture ids |
| decor | new `DecorPlacer` (new file) reading per-room lists | furniture transforms |
| trash | `TrashManager.ts`: box factory → GLB clone | `TRASH_TYPES` names/sizes/masses, spawn logic |
| tools | `DiegeticHUD.ts`: delete `buildSprayBottle`, `buildMop`; load GLBs, keep anchors and the `liquid` object name | `CleaningSystem` tool defs |
| vehicles | `VehicleVisual.ts`: box builder → GLB clone; `Vehicle.ts::createWheel()` optional swap | `VehicleSpecs` numbers, physics |
| repair | `RepairBay.ts`, `RecoveryTruck.ts` | catalogue data in `ToolSystem.ts` |
| exterior | `HouseGenerator.ts`, `ExteriorGenerator.ts`, `HouseTemplates.ts` | world grid, chunk logic |
| vegetation | `ChunkManager.ts` / `WorldStreamer.ts` instancing | streaming distances |
| grime | `DecalSystem.ts` (new atlases), `CleaningSystem.ts` (filth mix) | cleaning maths |

**New shared file: `src/world/ModelLibrary.ts`.** One cache, one clone path, one
dispose path. Everything above loads through it. Signature:

```ts
load(path: string): Promise<THREE.Group>      // cached
instance(path: string): Promise<THREE.Group>  // cached clone
preload(paths: string[]): Promise<void>
disposeGroup(g: THREE.Group): void
```

---

## §18. Budgets, LOD and phones

| scope | target |
|---|---|
| whole library | ≤ 400k tris |
| one room on screen | ≤ 90k tris |
| one frame, mobile | ≤ 120 draw calls |
| texture memory | ≤ 40 MB |

- **LOD1** for every instanced asset (architecture, vegetation, decor, trash):
  same filename + `_lod1`, ≤ 35% tris, switch at 12 m.
- **Merge** static room geometry per material into one mesh at load
  (`BufferGeometryUtils.mergeGeometries`). Walls alone would otherwise cost
  hundreds of draw calls.
- **Instance** repeated props (trash, books, plants, fence panels) with
  `InstancedMesh`; only unique transforms per item.
- **Never** ship a `_lod1` that changes silhouette — LOD pop is worse than polys.

---

## §19. Order of work and effort

Each phase is a self-contained chunk of work. Estimated Blender scripting time for
me, per phase, assuming `lib.py` exists:

| # | phase | assets | effort | why now |
|---|---|---|---|---|
| 1 | architecture shell | ~40 | 1 long session | fixes walls, trim, doors, windows — the "cheap" feeling |
| 2 | trash | ~37 | 1 session | the game's core interaction, currently boxes |
| 3 | cleaning tools | ~21 | 1 session | always on screen |
| 4 | fixtures | ~45 | 1–2 sessions | bathrooms/kitchens are where cleaning happens |
| 5 | decor | ~60 | 1–2 sessions | makes rooms read as lived-in |
| 6 | vehicles | ~30 | 1–2 sessions | the car is the second thing you stare at |
| 7 | garage/repair | ~50 | 1 session | half the game loop |
| 8 | exterior | ~55 | 1–2 sessions | only matters once you can see outside |
| 9 | grime | ~40 | 1 session | the payoff, needs surfaces to sit on |
| 10 | textures | ~40 maps | 1 session | last, because flat colour already works |

Order is deliberate: each phase makes the previous one look better, and nothing
later has to be redone because an earlier phase changed shape or scale.

---

## §20. Definition of done (every phase)

1. Build script runs clean; every asset logs `wrote <name> <tris> tris`.
2. `node tools/validate-models.mjs` exits 0.
3. `npx tsc --noEmit` → 0 · `npm run build` → 0 · `npm test` → all pass.
4. In game: new meshes visible, old procedural placeholders gone (search the
   scene graph for the old mesh names, they must not exist).
5. Frame rate on the mobile profile does not drop below the pre-phase number.
6. Screenshot before/after into `audit/`.
7. Commit with the *why*, push to `freebuff/5c3b7bc8617797a07a1d90c2`.
8. Update this file: tick the phase, correct any row that turned out wrong.

---

## §21. Open decisions

1. **How modular is the house?** Full kit is 40+ assets. A reduced version —
   thick walls, three trim profiles, real doors and windows — gets most of the
   look for a third of the work. **Proposal: reduced kit first (§5 minus stairs).**
2. **Textures or flat colour?** Flat colour is cheaper and consistent. Textures
   are needed eventually. **Proposal: ship flat colour, add textures per family
   as §14 lands, keeping the flat path as the low-end fallback.**
3. **Cars: how many bodies?** Six is plenty for a street; the spec system already
   varies colour and wheel size. **Proposal: hatch + sedan + van first, rest later.**
4. **Interiors for cars?** 2,600 tris each, visible through glass. **Proposal: yes,
   it is the cheapest realism win per triangle in the vehicle group.**
5. **Characters?** None planned. If NPCs arrive, they need their own plan file —
   rigging and animation are a different discipline from this one.
6. **Attic/basement?** The stairs exist in §5.6 but the house is one floor.
   **Proposal: build the geometry, wire it only if the design calls for it.**

---

## Appendix A — quick index

| I need to… | go to |
|---|---|
| know how to run Blender | §2 |
| check a pivot or axis rule | §3.1, §3.2 |
| pick a colour | §3.4 |
| know the tri budget | §3.5 |
| build walls/doors/windows | §5 |
| build a kitchen or bathroom | §6 |
| make a room feel lived in | §7 |
| build trash | §8 |
| build a held tool | §9 |
| build a car | §10 |
| build the garage | §11 |
| build the street | §12 |
| build dirt | §13 |
| add textures | §14 |
| add an animation or socket | §15 |
| write a build script | §16 |
| wire it into the game | §17 |
| check performance | §18 |
| decide what to build next | §19 |
| check my work | §20 |
