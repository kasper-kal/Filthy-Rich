# FINALLY-3D.md — the Blender asset plan

This file is the work order for every 3D model **Filthy Rich** still needs.
It is written for me (the agent) to follow later without re-deriving anything.
Read it top to bottom before touching Blender.

Status key: `[x]` done and shipped · `[ ]` to build · `[~]` build again / needs polish

---

## 0. How to read this

- **Do the phases in order.** Phase 1 changes how the game looks most, per hour spent.
- Every asset row is a contract: filename, size in metres, origin, tri budget.
  If a row and the code disagree, the code wins — update the row.
- Never invent a new folder. Everything lives under `public/models/<group>/`.
- If an asset has no row here, don't build it. Add the row first, then build.

---

## 1. Where things stand

| Group | Files | State |
|---|---|---|
| Furniture (22 pieces) | `public/models/furniture/*.glb` | `[x]` built with Blender, 47,096 tris total |
| Wall / ceiling / trim / doors / windows | none — built in code as flat planes | `[ ]` Phase 1 |
| Fixtures (kitchen, bath, laundry) | none | `[ ]` Phase 2 |
| Trash / clutter (23 types) | none — code draws coloured boxes | `[ ]` Phase 3 |
| Cleaning tools held by the player | none — drawn in code | `[ ]` Phase 4 |
| Vehicles | none — `VehicleVisual.ts` builds boxes | `[ ]` Phase 5 |
| Repair garage kit | none | `[ ]` Phase 6 |
| Exterior / street props | none — code draws grass and driveway planes | `[ ]` Phase 7 |

The furniture set already proves the pipeline works end to end. Everything below is
the same workflow at a different scale.

---

## 2. The pipeline (verified working in this VM)

Blender 4.2.23 LTS is installed at `$HOME/blender/blender` (not in the repo).
The machine has no root password, so its missing X libraries were unpacked from
Ubuntu `.deb` files into `$HOME/blender-libs`. **Without `LD_LIBRARY_PATH` Blender
will not start.** Always export it first.

```bash
export LD_LIBRARY_PATH=$HOME/blender-libs/usr/lib/x86_64-linux-gnu
$HOME/blender/blender --background --python tools/blender/build_furniture.py
```

To rebuild only some pieces, the script accepts asset names after `--`:

```bash
$HOME/blender/blender --background --python tools/blender/build_furniture.py -- sofa armchair
```

Export call used by every script (copy it exactly):

```python
bpy.ops.export_scene.gltf(
    filepath=path,            # absolute path into public/models/<group>/
    export_format="GLB",
    use_selection=True,
    export_apply=True,        # bake modifiers
    export_yup=True,          # Blender Z-up -> glTF/three.js Y-up
    export_materials="EXPORT",
)
```

If Blender dies on a missing `.so`: find the package name on
`http://archive.ubuntu.com/ubuntu/pool/main/...`, `curl` the `.deb`,
`dpkg-deb -x <deb> $HOME/blender-libs`, retry. Do **not** attempt `sudo`.

**Previewing a model:** there is no GPU, so Blender renders are slow and EEVEE may
fail. Faster loop: rebuild, then look at the dev-server preview. To inspect a GLB
without the game, parse its JSON chunk in Node and print mesh/material/triangle
counts (this is how Phase 0 was checked).

---

## 3. Rules for every asset

Apply these without being told, every time.

1. **Units are metres.** A door is 2.1 m, a sofa seat 0.45 m. Real scale or the
   room reads as a toy house.
2. **Origin is the floor centre** (x/y centred, z = 0 at the ground). Anything that
   hangs from the ceiling or a wall states its pivot in its row.
3. **The game's forward is −Z, up is +Y.** In Blender build facing −Y, which the
   exporter turns into −Z. Furniture that has a front (sofa, TV stand, wardrobe)
   must face −Y in Blender.
4. **Bevel everything.** `width` 0.008–0.04, 2–4 segments, angle limit 40°.
   Flat un-beveled boxes are exactly what makes the game look cheap.
5. **Shade smooth by angle**, ~38°, never smooth-all on hard-edged objects.
6. **Materials from the palette only** (below). One material per surface type, no
   textures in this phase — colour + roughness + metallic only.
7. **Budget:** ≤ 6,000 tris per furniture-scale asset, ≤ 12,000 for hero pieces
   (car, staircase). The whole library should stay under ~250k tris.
8. **Name every object** (`seat_cushion`, `door_panel`) — the game may pick parts
   by name later, and unnamed objects make debugging miserable.
9. **No modifiers left unapplied.** `export_apply=True` covers it, but apply anyway
   so the `.blend` source and the `.glb` agree.

### Shared palette (keep in sync with `tools/blender/build_furniture.py`)

| key | colour (linear) | roughness | metallic | used for |
|---|---|---|---|---|
| `teal` | 0.055, 0.20, 0.24 | 0.85 | 0 | upholstery, accents |
| `linen` | 0.62, 0.57, 0.48 | 0.90 | 0 | fabric, lamp shades, bedding |
| `walnut` | 0.13, 0.075, 0.045 | 0.45 | 0 | dark timber, legs, doors |
| `oak` | 0.26, 0.16, 0.085 | 0.50 | 0 | light timber, tops, shelves |
| `brass` | 0.60, 0.42, 0.13 | 0.32 | 1.0 | handles, fittings, lamps |
| `steel` | 0.08, 0.08, 0.09 | 0.38 | 0.85 | tools, appliances, car trim |
| `ceramic` | 0.78, 0.76, 0.70 | 0.25 | 0 | sanitaryware, pots, mugs |
| `leaf` | 0.045, 0.16, 0.06 | 0.65 | 0 | plants |
| `rug` | 0.16, 0.045, 0.05 | 0.95 | 0 | rugs, dark fabric |
| `glass` | 0.55, 0.68, 0.72 | 0.08 | 0 | windows, mirrors, bottles |
| `paper` | 0.72, 0.70, 0.64 | 0.80 | 0 | books, tissues, cardboard |

Phase 2+ adds: `grime` (0.09, 0.075, 0.055, rough 0.95), `chrome` (0.75 grey,
rough 0.12, metal 1.0), `paint_white`, `paint_cream`, `tile`, `denim`, `rubber`.

---

## 4. Phase 1 — the house shell `[ ]` (highest impact)

The house is currently four flat `PlaneGeometry` walls per room with zero
thickness, no trim, and doorways cut by deleting wall segments. That alone reads
as a prototype. Replace it with a small modular kit, then rebuild `Room.ts` to
instance the modules.

Folder: `public/models/architecture/`

| file | size (m) | parts | materials | tris |
|---|---|---|---|---|
| `wall_panel.glb` | 1.0 × 0.15 × 3.0 (w×d×h) | outer face, inner face, top cap, 2 end caps | `paint_cream`, `paint_white` | 240 |
| `wall_panel_wet.glb` | same | same | `tile` | 260 |
| `floorboard.glb` | 1.0 × 1.0 × 0.04 | 6 planks with micro-gap, 1 shadow groove | `oak` ×3 tints | 180 |
| `floor_tile.glb` | 1.0 × 1.0 × 0.02 | 2×2 tiles, grout inset | `tile`, `grout` | 160 |
| `ceiling_panel.glb` | 1.0 × 1.0 × 0.02 | panel + cornice notch | `paint_white` | 120 |
| `baseboard.glb` | 1.0 × 0.02 × 0.12 | body, top lip (two-step profile) | `paint_white` | 90 |
| `crown_moulding.glb` | 1.0 × 0.03 × 0.09 | 3-step cove profile | `paint_white` | 110 |
| `door_frame.glb` | 1.0 × 0.16 × 2.15 | jambs, head, architrave both sides | `paint_white` | 320 |
| `door_leaf.glb` | 0.85 × 0.04 × 2.05 | panel, 2 raised panels, handle hole | `paint_white`, `brass` | 420 |
| `door_leaf_worn.glb` | same | same + scuffs modelled as slight dents | same | 430 |
| `window_frame.glb` | 1.2 × 0.10 × 1.3 | reveal, sill, 2 mullions | `paint_white` | 300 |
| `window_glass.glb` | 1.15 × 0.01 × 1.25 | single pane, slight bevel | `glass` | 60 |
| `stairs_run.glb` | 1.0 × 2.6 × 2.8 | 12 treads, 2 stringers, risers | `oak`, `walnut` | 1,800 |
| `banister.glb` | 1.0 wide | rail, 5 balusters, newel | `walnut` | 700 |

Notes:
- `wall_panel.glb` is 1 m wide so walls can be tiled to any length. Doorways are
  made by leaving a gap and capping with `door_frame.glb`, instead of deleting
  geometry mid-wall.
- Walls need **thickness** (0.15 m). Thickness is what sells a real house at the
  doorway reveals — currently doorways are paper.
- Two metres of a room needs: 1 door frame, 1 door leaf, 1–2 window frames,
  4 × baseboard lengths, 1 ceiling, floor tiles.

Integration: rewrite `Room.ts::createWallsWithOpenings` to instance modules.
Keep the data in `HouseLayout.ts` unchanged. Old `createBaseboards` /
`createCrownMolding` / `createDoorFrames` / `createWindowFrames` get deleted.

---

## 5. Phase 2 — fixtures and appliances `[ ]`

Folder: `public/models/fixtures/`

| file | size (m) | parts | materials | tris |
|---|---|---|---|---|
| `kitchen_run.glb` | 2.4 × 0.62 × 0.90 | carcass, 4 doors, 2 drawers, worktop, plinth, 3 handles | `paint_white`, `oak`, `brass` | 1,400 |
| `kitchen_sink.glb` | 0.8 × 0.6 × 0.9 | cabinet, basin, tap, drainer | `paint_white`, `chrome` | 900 |
| `stove.glb` | 0.6 × 0.6 × 0.9 | body, 4 burners, oven door, 2 knobs | `steel`, `glass` | 800 |
| `fridge.glb` | 0.7 × 0.7 × 1.8 | body, 2 doors, 2 handles, top vent | `paint_white`, `chrome` | 700 |
| `range_hood.glb` | 0.9 × 0.5 × 0.4 | canopy, chimney, filter plate | `steel` | 400 |
| `microwave.glb` | 0.5 × 0.35 × 0.3 | body, door window, 3 buttons | `paint_white`, `glass` | 260 |
| `toilet.glb` | 0.38 × 0.65 × 0.78 | bowl, cistern, lid, seat, flush | `ceramic`, `chrome` | 900 |
| `bath.glb` | 1.7 × 0.75 × 0.55 | shell, inner bowl, 2 taps, drain | `ceramic`, `chrome` | 1,100 |
| `shower.glb` | 0.9 × 0.9 × 2.0 | tray, 2 glass panels, head, riser | `ceramic`, `glass`, `chrome` | 900 |
| `vanity.glb` | 0.9 × 0.5 × 0.85 | cabinet, basin, tap, mirror | `oak`, `ceramic`, `glass` | 800 |
| `washing_machine.glb` | 0.6 × 0.6 × 0.85 | body, glass door, dial, 2 buttons | `paint_white`, `glass` | 600 |
| `dryer.glb` | 0.6 × 0.6 × 0.85 | as above, no glass dome | `paint_white` | 500 |
| `radiator.glb` | 0.8 × 0.1 × 0.6 | 11 fins, 2 pipes, valve | `paint_white`, `brass` | 500 |
| `boiler.glb` | 0.5 × 0.3 × 0.8 | body, panel, 3 pipes | `paint_white`, `steel` | 400 |
| `shower_head.glb` | 0.2 dia | head, arm | `chrome` | 240 |

Notes: `grime` variants (`fridge_grime.glb`, `toilet_grime.glb`, `bath_grime.glb`)
are the same models with a grime material on 30–50% of faces — the whole premise of
the game is that fixtures start filthy. Build both, let the code pick.

---

## 6. Phase 3 — trash and clutter `[ ]`

`TrashManager.ts` currently draws coloured boxes from a size table. There are
**23 types**; keep the exact names so the spawn table keeps working.

Folder: `public/models/trash/`

| file | real size (m) | tris | notes |
|---|---|---|---|
| `pizza_box.glb` | 0.35 × 0.35 × 0.05 | 220 | lid slightly open, grease stain = darker material patch |
| `beer_can.glb` | 0.066 dia × 0.12 | 180 | crushed variant is a separate file `beer_can_crushed.glb` |
| `takeout_bag.glb` | 0.15 × 0.10 × 0.25 | 260 | creased paper bag, folded top |
| `condom_wrapper.glb` | 0.05 × 0.05 × 0.006 | 60 | foil, serrated edges |
| `tissue.glb` | 0.10 × 0.08 × 0.01 | 80 | crumpled |
| `bottle.glb` | 0.07 dia × 0.20 | 200 | glass material |
| `magazine.glb` | 0.22 × 0.28 × 0.03 | 160 | curled cover |
| `sock.glb` | 0.10 × 0.06 × 0.02 | 240 | lumpy, bent |
| `food_container.glb` | 0.12 × 0.12 × 0.05 | 180 | takeaway box, lid askew |
| `hair_clump.glb` | 0.05 × 0.05 × 0.02 | 180 | tuft of strands (low-poly curves are fine) |
| `red_solo_cup.glb` | 0.08 dia × 0.10 | 160 | plastic cup, rim |
| `beer_bottle.glb` | 0.06 dia × 0.22 | 200 | green glass, label patch |
| `chip_bag.glb` | 0.15 × 0.20 × 0.02 | 240 | foil sheen, standing pouch |
| `confetti.glb` | 0.02 × 0.02 | 12 | flat quad, coloured material |
| `balloon.glb` | 0.12 × 0.15 | 260 | deflated, knot |
| `newspaper_stack.glb` | 0.30 × 0.22 × 0.15 | 320 | 6 sheets, uneven |
| `cardboard_box.glb` | 0.40 × 0.40 × 0.30 | 260 | open flaps |
| `plastic_bag.glb` | 0.25 × 0.15 × 0.30 | 300 | crumpled, semi-translucent |
| `old_magazine.glb` | 0.22 × 0.28 × 0.04 | 160 | water damage = darkened patch |
| `broken_item.glb` | 0.15 × 0.15 × 0.10 | 200 | shards, 3 pieces |
| `drywall_piece.glb` | 0.30 × 0.20 × 0.02 | 80 | jagged edge |
| `sawdust_pile.glb` | 0.25 dia × 0.03 | 220 | low mound, no base plane |
| `paint_can.glb` | 0.15 dia × 0.20 | 200 | lid, handle, paint rim |
| `tape_roll.glb` | 0.06 dia × 0.02 | 140 | torus |

Rules: origin at the **bottom centre** so items drop onto the floor; ≤ 320 tris
each (they are numerous); all need a `*_grime` variant later if we ever show them
soiled separately.

Integration: `TrashManager.ts` — replace the box mesh factory with one GLTF load
per type at init, then clone. Keep the existing mass/size table for physics.

---

## 7. Phase 4 — cleaning tools, first person `[ ]`

`CleaningSystem.ts` defines exactly four tools: `spray`, `mop`, `vacuum`,
`trash_bag`. They are currently built out of primitives inside
`DiegeticHUD.ts::buildSprayBottle` / `buildMop`. These are the objects the player
sees the whole game, so they deserve detail.

Folder: `public/models/tools/`

| file | size (m) | tris | notes |
|---|---|---|---|
| `spray_bottle.glb` | 0.09 dia × 0.26 | 900 | bottle, trigger, nozzle, cap; liquid is a separate named object (`liquid`) so the HUD can animate the level |
| `mop.glb` | 0.09 dia × 1.35 | 1,100 | handle, grip, ferrule, mop head with 14 strand groups; head origin at the strands |
| `vacuum.glb` | 0.28 × 0.32 × 1.10 | 1,600 | body, hose, wand, floor head, cord reel |
| `trash_bag.glb` | 0.30 × 0.30 × 0.45 | 500 | open bag with a rolled rim |
| `bucket.glb` | 0.28 dia × 0.30 | 400 | handle, 2 baffles |
| `sponge.glb` | 0.12 × 0.08 × 0.05 | 320 | two-layer: soft face + scrubby face |

Also build the **first-person hand/glove** (`glove_hand.glb`, 0.22 m, 1,200 tris,
`rubber` material) so tools are held rather than floating.

Integration: `DiegeticHUD.ts` — delete `buildSprayBottle` / `buildMop`, load GLBs
once, keep the same anchor transforms and the `liquid` object name for the level
indicator.

---

## 8. Phase 5 — vehicles `[ ]`

`VehicleVisual.ts` builds every car out of 8 boxes, which is the single most
damaging thing in the game: you stare at the car a lot.

**Read `src/vehicle/Vehicle.ts::createWheel()` before building anything here.**
Wheels are *not* part of the body GLB: `Vehicle` creates its own wheel meshes and
positions them from `VehicleSpecs` (track, wheelbase, wheelRadius, y = wheelRadius).
So the body GLBs must be built **without wheels**, with real wheel-arch cut-outs
so the procedural wheels sit inside them. Replacing `createWheel()`'s primitive
with `wheel_*.glb` is a separate, deliberate change — one shared wheel model,
instanced four times, keeps the physics untouched.

Folder: `public/models/vehicles/`

| file | length (m) | tris | notes |
|---|---|---|---|
| `car_hatch.glb` | 3.80 | 8,000 | body, 4 doors (separate objects), bonnet, boot, bumpers, lights, mirrors, glass |
| `car_sedan.glb` | 4.70 | 9,000 | same conventions |
| `car_van.glb` | 5.20 | 9,500 | taller, sliding door |
| `car_pickup.glb` | 5.40 | 9,000 | separate bed and tailgate |
| `wheel_standard.glb` | 0.62 dia | 900 | tyre, rim, 5 spokes, brake disc |
| `wheel_rear_wide.glb` | 0.66 dia | 950 | for the sports spec |
| `recovery_truck.glb` | 6.50 | 12,000 | cab, flatbed, boom, winch, beacons, 6 wheels |
| `car_damage_parts.glb` | — | 1,500 | dented panels, cracked glass, wheel arch ripples for `DamageVisuals` |

Conventions: origin at the centre of the wheelbase on the ground; forward −Y in
Blender; total height matched to `VehicleSpecs.dimensions` so the body does not
float or clip. Body paint is a material slot named `paint` so it can be recoloured
per vehicle spec. Doors, bonnet, boot and mirrors stay as separate named objects
(`door_fl`, `bonnet`, `boot`) for `DamageVisuals` to displace when the car is hit.

---

## 9. Phase 6 — repair garage kit `[ ]`

Folder: `public/models/repair/`

| file | size (m) | tris | notes |
|---|---|---|---|
| `floor_jack.glb` | 0.60 × 0.30 × 0.18 | 700 | as in `ToolSystem` catalogue |
| `axle_stands.glb` | 0.30 × 0.30 × 0.40 | 400 | pair, 3 legs |
| `engine_hoist.glb` | 1.60 × 0.90 × 1.80 | 1,200 | frame, boom, hook, wheels |
| `transmission_jack.glb` | 0.90 × 0.50 × 1.20 | 900 | cradle, ram, wheels |
| `tool_chest.glb` | 1.10 × 0.50 × 0.95 | 1,000 | 6 drawers, castors |
| `workbench.glb` | 2.00 × 0.70 × 0.90 | 900 | top, vice, lower shelf |
| `diagnostic_cart.glb` | 0.60 × 0.45 × 1.10 | 700 | screen, cart, cables |
| `tyre_stack.glb` | 0.70 dia × 0.60 | 600 | 3 tyres |
| `part_box.glb` | 0.40 × 0.30 × 0.20 | 260 | cardboard, stencil |

Held/hand tools from `ToolSystem` (spanners, socket set, impact wrench, grinder,
drill, multimeter, borescope, OBD scanner) are cheap silhouettes — one
`toolkit.glb` per category, ≤ 500 tris each, not per individual SKU.
Folder: `public/models/repair/tools/`.

---

## 10. Phase 7 — exterior and street `[ ]`

Folder: `public/models/exterior/`

| file | size (m) | tris | notes |
|---|---|---|---|
| `house_facade.glb` | 9 × 8 × 7 | 6,000 | modular body, windows, door, roof, gutters; 3 tint variants via material swap |
| `fence_panel.glb` | 2.0 × 0.05 × 1.2 | 400 | 9 pickets, 2 rails |
| `gate.glb` | 1.0 × 0.05 × 1.2 | 500 | frame + hinges |
| `mailbox.glb` | 0.25 × 0.20 × 1.10 | 300 | post, box, flag |
| `bin.glb` | 0.60 × 0.60 × 1.00 | 400 | wheelie bin, lid, handle |
| `street_lamp.glb` | 0.25 dia × 6.0 | 900 | pole, arm, head |
| `hydrant.glb` | 0.25 × 0.25 × 0.75 | 500 | |
| `road_sign.glb` | 0.60 × 0.05 × 2.4 | 320 | post + plate |
| `hedge_block.glb` | 2.0 × 0.8 × 0.9 | 800 | lumpy, not a box |
| `tree_small.glb` | 5 dia × 6 h | 3,000 | trunk + 3 canopy blobs |
| `bush.glb` | 1.2 × 1.2 × 0.8 | 700 | |
| `driveway_slab.glb` | 2.0 × 2.0 × 0.06 | 80 | paving joints as geometry |

Exterior houses are currently box volumes from `HouseGenerator.ts` /
`HouseTemplates.ts`. Swap to `house_facade.glb` and keep the template data.

---

## 11. Phase 8 — grime, stains and decals `[ ]`

Stains are `DecalSystem` planes with canvas textures, not meshes. Two options,
decide when we get there:

1. Keep decals, generate the textures in Blender by baking a procedural grime
   shader to PNG (`512×512`, 6 variants: grease, mould, dust, splash, scuff, cobweb).
2. Model actual grime clumps for the worst offenders (toilet rim, bath ring,
   kitchen splashback) as small meshes that swap in when filth > 70%.

Recommended: do (1) first — texture richness is worth more than geometry here.

---

## 12. Integration map (what has to change in code)

| Asset group | Code that must change | Keep |
|---|---|---|
| Architecture | `Room.ts` wall/trim/frame builders become module instancing | `HouseLayout.ts` data |
| Fixtures | `FurnitureManager.ts` add a `FIXTURES` map beside `FURNITURE` | placement API |
| Trash | `TrashManager.ts` mesh factory → GLB clones | `TRASH_TYPES` names, sizes, masses |
| Tools | `DiegeticHUD.ts` `buildSprayBottle` / `buildMop` → GLB load | anchors, `liquid` object |
| Vehicles | `VehicleVisual.ts` → GLB clone + wheel lookup | `VehicleSpecs` dimensions |
| Repair kit | `RepairBay.ts`, `RecoveryTruck.ts` | catalogue data |
| Exterior | `HouseGenerator.ts`, `ExteriorGenerator.ts` | template/variation data |
| All | new loader helper `src/world/ModelLibrary.ts` (cache + clone + dispose) | — |

Loader rules: cache by path, clone with `SkeletonUtils`-free `mesh.clone()`
(no skinning), share materials between clones, dispose on unload. Load lazily per
room/chunk, never all at once.

---

## 13. Budgets and mobile

`DeviceProfile.ts` already drops pixel ratio, shadows and post-processing on
phones. Geometry is not yet adapted, so:

- Every group gets a **`_lod1`** version at ~35% tris for mobile, same filename
  with the suffix, used when `DEVICE.isMobile`.
- Draw calls matter more than triangles on phones: merge static room modules into
  one mesh per room at load time (`BufferGeometryUtils.mergeGeometries`).
- Keep the whole library under **250k tris** and any single room under **60k**.
- Current furniture set is 47k — that leaves room, but the architecture kit will be
  the heavy part; instance and merge it.

---

## 14. Definition of done, per phase

Before calling a phase finished:

1. `export LD_LIBRARY_PATH=...` then run the build script — every row logs `wrote`
   with no traceback.
2. Node GLB check: every file starts with `glTF`, has ≥ 1 material, tri count
   inside budget.
3. `npx tsc --noEmit` → 0, `npm run build` → 0, `npm test` → 22 passing.
4. Load the game, walk the room, confirm the new meshes appear **and** the old
   procedural boxes are gone (grep the scene for the old mesh names).
5. Screenshot before/after into `audit/`.
6. Commit with *why*, push to `freebuff/5c3b7bc8617797a07a1d90c2`.

---

## 15. Open decisions

- **Textures or flat colour?** Flat colour is consistent and cheap, but the game
  needs texture variety eventually (wood grain, tile grout, wall paint).
  Proposal: bake 4–5 small tiling textures per material family in Blender, keep
  them under 256×256, ship as KTX2 (there is already a `TextureCompression.ts`).
- **One big `.blend` or one file per group?** Proposal: one `.blend` per group in
  `assets/blender/`, exported by script — not committed as binaries unless small.
- **How modular is the house?** Full modular kit costs a week of assets; a
  "thick walls + trim + real doors" version gets 80% of the look for 20% of the
  work. Start there, add stairs and hallways later.
