# FINALLY-3D.md — the complete Blender asset plan

Work order for every 3D model **Filthy Rich** needs to stop looking cheap.
Written for me (the agent) to follow later without re-deriving anything.

Read the whole thing before opening Blender. Build in phase order.
If a row here disagrees with the code, the code wins — then fix the row.

Legend: `[x]` done and shipped · `[ ]` to build · `[~]` exists but needs redoing

---

**Status on 26 November 2026 — phases 1 to 6 shipped, phases 7 to 10 not started.** Six phases are in
the repository: the house shell, fixtures and appliances, decor, trash and spills, the cleaning kit,
and the vehicles. `public/models/models.manifest.json` lists 220 models in six groups —
architecture 16, decor 79, fixtures 29, tools 21, trash 46, vehicles 29.

Four phases are not built, and the `[ ]` marks in sections 11 to 14 are still correct:

- **Phase 7, garage and repair kit** — `public/models/repair/` does not exist.
- **Phase 8, exterior, garden and street** — `public/models/exterior/` and `vegetation/` do not exist.
- **Phase 9, grime, damage and decals** — `public/models/grime/` does not exist, and `filthMix` appears
  nowhere in `src`, so the material hook section 13.5 plans has not been written.
- **Phase 10, textures** — partly begun and not finished: `public/textures/` already holds ten families
  (asphalt, brick wall, carpet, concrete, grass, gravel, corrugated metal, paving slabs, plaster, roof
  tiles), but the only thing in `src` that references a texture path is `systems/TextureCompression.ts`.
  The assets are in; the material library that uses them is not.

---

## §0. How to use this file — and the Phases Of Creation™

The steerer does not write briefs. They type **"Start Phase N"**. That is the
whole request, and this file is the brief that answers it.

A **phase** is one self-contained batch of models: one build script, one code
integration, one commit. Ten phases, in order, cover everything the game needs.
Each phase leaves the game playable and visibly better, so a phase can be
skipped, paused or reordered without breaking anything.

Where things live:

- **§0.2 is the phase index.** It is the only list of phases that counts.
- **§0.3 is the runbook** — what "Start Phase N" actually causes me to do.
- **§1–§4 are law.** Axes, pivots, naming, materials, budgets.
- **§5–§14 are the phase specs.** One section per phase, one row per asset.
- **§15–§18 are the plumbing.** Animation, collisions, build scripts, wiring.
- **§19–§21** are dependencies, the done-checks, and the open questions.

### 0.1 What "Start Phase N" means

| the steerer types | what I do |
|---|---|
| `Start Phase 3` | build everything in §7, wire it into the game, verify, commit, push, tick it |
| `Continue Phase 3` | resume at the first unticked asset row in §7 |
| `Redo Phase 3` | rebuild it from scratch, replacing what already exists |
| `Phase 3 only` | build and verify, but make no code change outside §17's row for it |
| anything vague | ask which phase — plainly, once — then proceed |

Rules that never change:

1. **One phase per turn.** Finish it, report, stop. No starting Phase 4 inside
   Phase 3's turn.
2. **"Done" is §20, not "the files exist".** A phase that has models but is not
   wired into the game is not done.
3. **Phases are additive.** Never rewrite an earlier phase's assets to make a
   later one work; fix the later one.
4. **The tick lives here.** When a phase finishes, its row in §0.2 and its
   heading in §5–§14 both change to `[x]`, in the same commit.

### 0.2 Phases Of Creation™ — master index

| Phase | Name | Spec | New models | Folder | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 | **Shell** | §5 | 66 | `architecture/` | — | `[x]` |
| 2 | **Fixtures** | §6 | 56 | `fixtures/` | 1 | `[x]` |
| 3 | **Decor** | §7 | 78 | `decor/` | 1, 2 | `[x]` |
| 4 | **Trash** | §8 | 46 | `trash/` | 1 (floors) | `[x]` |
| 5 | **Cleaning kit** | §9 | 21 | `tools/` | — | `[x]` |
| 6 | **Vehicles** | §10 | 29 | `vehicles/` | — | `[x]` |
| 7 | **Garage** | §11 | 55 | `repair/` | 6 | `[ ]` |
| 8 | **Exterior** | §12 | 51 | `exterior/`, `vegetation/` | 1 | `[ ]` |
| 9 | **Grime** | §13 | 19 | `grime/`, `textures/grime/` | 1, 2 | `[ ]` |
| 10 | **Textures** | §14 | 7 + ~35 maps | `textures/` | 1–3 | `[ ]` |

**~419 models across ten phases.** Separately, 22 furniture pieces are already
shipped (§1.2) and are not part of any phase.

Progress: **6 / 10 phases complete.**

Smallest useful first step: Phase 1. Biggest visible jump for the least work:
Phase 1, then 5, then 4. Phases 4, 5 and 6 are independent of everything and can
be swapped freely if the steerer wants something else first.

### 0.3 The runbook — what happens when a phase starts

Followed in this order, every time, no exceptions:

1. **Read the phase spec** (§5–§14) end to end, plus §3 rules and §17's row.
2. **Check the toolkit.** Run `./tools/setup-blender.sh --check`. If it reports
   anything missing (fresh workspace, reset), run `./tools/setup-blender.sh`
   and wait for "Toolchain ready" — that rebuilds Blender, its libraries and the
   seven extensions in one command. `tools/blender/lib.py` and
   `tools/validate-models.mjs` are built in Phase 1; if a later phase finds them
   missing, build them first from §16.1 and §16.4.
3. **Write the build script** `tools/blender/build_<group>.py`: one function per
   asset, cleared scene per asset, `wrote <name> <tris> tris` on success.
4. **Run it.** Every asset in the phase table must be produced; fix tracebacks
   rather than skipping rows.
5. **Validate.** `node tools/validate-models.mjs` must exit 0 (budgets, names,
   palette, manifest).
6. **Wire it in** using §17's row for that phase. Replace the placeholder code —
   do not leave both paths alive behind a flag unless the phase says so.
7. **Check the build.** `npx tsc --noEmit`, `npm run build`, `npm test` — all
   clean. No skipped tests, no weakened assertions to get there.
8. **Look at it.** Dev server, the actual room, phone profile too. Placeholders
   gone, new meshes present, frame rate not worse than before.
9. **Commit and push** with the *why*, on branch `freebuff/5c3b7bc8617797a07a1d90c2`.
10. **Tick it:** this table, the phase heading, and a line in the log below.
11. **Refresh the preview** and report in plain words: what the player will see
    differently, and anything that did not work.

Never inside a phase: renaming files that code already loads, editing brand
assets, starting the next phase, or committing with a check failing.

### 0.4 Phase log

| Phase | Finished | Commit | Note |
|---|---|---|---|
| 1 House shell | 23 Nov 2026 | `8f98a30` | 16 assets, 7,756 tris; walls/doors/windows/trim wired into `Room.ts` |
| 2 Fixtures | 23 Nov 2026 | `c367cdc` | 29 assets, 28,572 tris; kitchen/bath/laundry placed; env map added |
| 3 Decor | 23 Nov 2026 | `79704a2` | 79 assets, 39,620 tris; 110 props across all eight rooms; facing bug found and fixed |
| 4 Trash | 23 Nov 2026 | `9cedf55` | 46 assets, 7,998 tris; 31 spawn types modelled, box factory deleted; bob and spin removed |
| 5 Cleaning kit | 23 Nov 2026 | `c898c21` | 21 assets, 9,636 tris; four tools + glove wired into the HUD, primitive builders deleted; prune skipped because it eats the sockets |
| 6 Vehicles | 24 Nov 2026 | `f4199b7` | 29 assets, 90,827 tris; seven bodies with real arch cut-outs and `PANEL_NAMES` meshes, wheels moved onto the spec's wheelbase, cabin interior behind transparent glass; box builder deleted |

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

Every room is four 0.13 m wall runs tiled from 1 m Blender modules, a floor of
1 m modules (planks or tile), a panelled ceiling, skirting and crown runs, and
real door and window assemblies. Doorways are gaps between wall piers, capped by
a header above and a sill panel below windows. The old zero-thickness planes are
gone; `Room.ts` no longer creates a `PlaneGeometry` wall at all.

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
| trash | `TrashManager.ts` | 31 type names + size/mass table, GLBs since Phase 4 |
| cleaning tools | `DiegeticHUD.ts` | 4 tools (`spray`, `mop`, `vacuum`, `trash_bag`) as GLBs since Phase 5, placed by a table and anchored to `SOC_*` empties |
| vehicles | `VehicleVisual.ts` | one body GLB per preset, cloned and tinted on the `fr_paint` slot; the cabin interior rides inside it; wheels are separate GLBs placed by `Vehicle.ts::createWheel()` from the spec |
| rooms | `Room.ts` | `createWallsWithOpenings`, `createWallSegment`, `createBaseboards`, `createDoorFrames`, `createWindowFrames`, `createCrownMolding` |
| world | `HouseGenerator.ts`, `ExteriorGenerator.ts`, `TerrainSystem.ts` | box houses, grass/driveway planes |
| garage | `RepairBay.ts`, `RecoveryTruck.ts` | procedural |

Every one of these has a replacement note in §17.

---

## §2. The pipeline (verified in this VM)

Blender 4.2.23 LTS lives at `$HOME/blender/blender`, outside the repo. The machine
has no root password, so the missing X libraries were unpacked from Ubuntu `.deb`
files into `$HOME/blender-libs`. **Blender will not start without the library path.**

Both live outside the repository, so a workspace reset deletes them and the project
looks like it has no 3D pipeline at all. Rebuild the whole thing with one command:

```bash
./tools/setup-blender.sh
```

```bash
export LD_LIBRARY_PATH=$HOME/blender-libs/usr/lib/x86_64-linux-gnu
$HOME/blender/blender --background --factory-startup --python-exit-code 1 \
  --python tools/blender/build_<group>.py
```

`--python-exit-code 1` is not optional: without it a script that raises still
exits 0 and the build looks fine (§2.7).

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

### 2.3 Rebuilding the toolchain — `./tools/setup-blender.sh`

**This is the command to remember.** Blender, its libraries and the seven
extensions all live in `$HOME`, outside the repo; a reset wipes them. One command
puts everything back:

```bash
./tools/setup-blender.sh                    # Blender + libraries + 7 extensions
./tools/setup-blender.sh --extensions-only  # add-ons only (Blender already there)
./tools/setup-blender.sh --check            # verify everything, install nothing
```

A cold run takes a couple of minutes (350 MB Blender tarball, then ~1 MB of
extension zips). It is idempotent: run it any time, it skips what already exists,
prints every step it took, and exits non-zero if anything fails to load. It ends
by printing the exact build command with the correct paths.

**Verified 23 Nov 2026:** cold full run; re-run with everything present (all steps
skipped); extensions directory deleted and reinstalled; fresh Blender extraction
from tarball. All four pass.

If it ever has to be done by hand, this is what the script automates:

```bash
export LD_LIBRARY_PATH=$HOME/blender-libs/usr/lib/x86_64-linux-gnu
B=$HOME/blender/blender
# 1. Blender (350 MB)
curl -fL -o /tmp/blender.tar.xz \
  https://download.blender.org/release/Blender4.2/blender-4.2.23-linux-x64.tar.xz
tar -xJf /tmp/blender.tar.xz -C /tmp && mv /tmp/blender-4.2.23-linux-x64 $HOME/blender
# 2. Missing X libraries without root: fetch pool .debs, dpkg-deb -x into $HOME/blender-libs
# 3. Extensions: switch on network access once, then install
$B --background --factory-startup --python-expr \
  "import bpy; bpy.context.preferences.system.use_online_access=True; bpy.ops.wm.save_userpref()"
$B --background --command extension sync
$B --background --command extension install archimesh -e
```

Blender 4.2 ships with only 14 add-ons (glTF, FBX, Cycles, Node Wrangler,
Rigify…); the seven below come from extensions.blender.org. That is why a reset
needs the script: none of it is in git.

Installed, with the module name to pass to `addon_utils.enable()` and what the
headless test actually did:

| id | module | headless result | used for |
|---|---|---|---|
| `archimesh` | `bl_ext.blender_org.archimesh` | `archimesh_room()` built 15 objects ✓ | proportions reference only |
| `sapling_tree_gen` | `bl_ext.blender_org.sapling_tree_gen` | `curve.tree_add()` built a tree ✓ | trees, Phase 8 |
| `cell_fracture` | `bl_ext.blender_org.cell_fracture` | cube → 12 shards ✓ | `broken_item`, `drywall_piece`, Phase 4 |
| `ivygen` | `bl_ext.blender_org.ivygen` | operator registered ✓ | wall vines, Phase 8 |
| `extra_mesh_objects` | `bl_ext.blender_org.extra_mesh_objects` | round-cube / lathe primitives ✓ | base shapes with good edge flow |
| `extra_curve_objectes` | `bl_ext.blender_org.extra_curve_objectes` | operator registered ✓ | cables, hoses, pipe runs |
| `boltfactory` | `bl_ext.blender_org.boltfactory` | operator registered ✓ | bolts, fittings, Phase 7 |

**Archimesh is reference, not shipping stock.** It makes dated, blocky rooms with
its own material slots and no bevels. Use it to check proportions against a real
door or kitchen run; the §5 kit is still what gets exported.

### 2.4 Ambient occlusion in vertex colours — the highest-value trick

Verified end to end: import a GLB, bake AO into a colour attribute, export — 0.3
seconds for the sofa, `COLOR_0` present in the output.

```python
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 16
sc.render.bake.use_pass_direct = False
sc.render.bake.use_pass_indirect = False
if not mesh.color_attributes:
    mesh.color_attributes.new(name='AO', type='BYTE_COLOR', domain='CORNER')
bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
```

Why this matters: glTF carries it as `COLOR_0` in **linear** space, and three.js
r165's `GLTFLoader` enables `vertexColors` on the material itself and multiplies
it into the base colour — no code required on our side (§B.4). Every bevel, cushion seam, drawer
reveal and skirting joint gets soft contact shadow **without a texture, a second
UV set, or an extra draw call**. It is the cheapest realism upgrade in the whole
pipeline and belongs in `lib.py` for every asset from Phase 1 onward.

Two rules: export one colour set only (`export_all_vertex_colors=False`, or the
file doubles), and finish with `prune` (below) to drop the padding.

### 2.5 Mesh optimisation: prune yes, optimize no

`npx @gltf-transform/cli@4 prune` took `sofa.glb` from 134.6 KB to 104.6 KB
(−22%) and kept every node name and material exactly. Safe on game assets.

**Never run `optimize`, `join`, `flatten` or `instance` on these files.** They
merge and rename nodes, and the game finds doors, wheels, sockets and parts by
name. If size is ever the problem, `weld` + `simplify` with a conservative ratio,
or `meshopt` compression — the latter only after `MeshoptDecoder` is registered
in the loader, which is a code change, not an asset change.

### 2.6 Free textures, no key, scriptable

- **Poly Haven** — `https://api.polyhaven.com/assets?t=textures&c=<category>`,
  then `/files/<id>`. CC0, no key, `User-Agent` header required.
- **ambientCG** — `https://ambientcg.com/api/v3/assets?...`. CC0, no key.

Both verified reachable from this VM. Pull 1K maps and downscale to 512² (§14);
never ship what the library gives you at 8K.

### 2.7 CLI flags that matter

- `--python-exit-code 1` — exit non-zero when the script raises. Without it a
  broken build looks like a successful one. **Use it on every build script.**
- `--factory-startup` — ignore user preferences, so builds are reproducible.
- `--addons <list>` — enable bundled add-ons for one run.
- `--command extension install|list|sync` — manage extensions headlessly.

---

## §3. Universal rules

### 3.1 Axes and scale

- **Metres, always.** Door 2.10 m, worktop 0.90 m, seat 0.45 m, ceiling 2.60 m.
- **Blender is Z-up, the game is Y-up.** Build standing on the Z=0 floor; the
  exporter rotates it. Never pre-rotate by hand.
- **Forward is −Y in Blender** → **+Z in three.js.** The exporter maps Blender
  −Y onto glTF +Z, so a model faces −Y while you model it and a placement at
  `rotation: 0` looks toward +Z in the scene. A model on the +Z wall therefore
  needs `rotation: Math.PI`. (Phase 3 found this the hard way: every fixture
  from Phase 2 was standing with its face in the wall. See §7.0.)
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
- **Bevel width ≈ 0.2–1% of the object's smallest dimension** (§B.3) — a 2 m door
  and a 20 cm handle do not get the same bevel.
- **Build geometry with `bmesh`, not `bpy.ops`** (§B.1). Operators need context
  that background mode does not have; anything requiring a 3D View (Smart UV
  Project) must be replaced with a written projection.
- **Seed every random choice** from a hash of the asset name, so rebuilds are
  byte-identical (§B.1).
- **Shade smooth by angle, never smooth-all.** ~38° for furniture, ~50° for
  organic shapes, flat for glass panes and paper.
- **No ngons on curved surfaces.** Triangulate on export, but keep quads in the
  `.blend` so the smooth shading stays clean.
- **Bake AO into vertex colours on every asset** (§2.4). It is free at runtime
  and it is what makes bevels and joints read.
- **No interior faces.** Delete hidden geometry; at 47k tris the furniture is
  already paying for faces nobody can see.
- **Add the "second read".** Every piece needs one small detail that rewards a
  closer look: a grain groove, a stitch seam, a handle plate, a shadow gap.
  Without it, a beveled box is still a box.

### 3.4 Materials

Colour + roughness + metallic only. No image textures until §14, and when they
arrive they live in the same library so everything stays consistent.

Values must be physically plausible (§B.3): non-metal base colours inside
30–240 sRGB, metals at `metallic = 1` with a reflectance colour (iron
0.56/0.57/0.58, gold 1.0/0.77/0.34), roughness in the 0.05–0.95 range by family.
Metal renders black until the scene has an environment map (§B.4) — that is a
game-side job, but it is why the brass must be believable on its own.

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
| `glass_green` | `#2E5A32` | 0.12 | 0 | beer bottles |
| `foil` | `#8F9093` | 0.38 | 1.0 | chip bags, wrappers |
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

## §5. Phase 1 — the house shell `[x]` (biggest visual win)

**Status:** `[x]` shipped 23 Nov 2026 · **Depends on:** nothing · **Done when:** every room is built from wall modules with thickness, doors and windows are real objects, and no flat wall plane is left in the scene graph.

### 5.0 What shipped

Sixteen assets, **7,756 tris, 341 KB** for the whole kit, every one AO-baked into
vertex colours and pruned. Built by `tools/blender/build_architecture.py` on top
of `tools/blender/lib.py`, validated by `tools/validate-models.mjs --group
architecture` (clean: no overruns, no unknown materials, AO present).

| built | used for |
|---|---|
| `wall_1m`, `wall_1m_cream`, `wall_1m_wet` | 1.00 × 0.13 × 3.00 modules; wet variant carries a tiled band to 1.2 m |
| `floor_planks`, `floor_tile`, `floor_tile_small`, `floor_vinyl` | 1 m floor tiles; planks for dry rooms, 0.5 m tile for kitchen, 0.25 m for the bathroom |
| `ceiling_plain` | 1 m ceiling panels with a joint line |
| `skirting_modern`, `crown_plain` | trim runs, 0.116 m and 0.082 m tall |
| `door_frame_std`, `door_leaf_panel`, `door_handle_lever` | 0.90 m opening, 1.98 m leaf, panelled, brass lever |
| `window_frame_std`, `window_glass`, `window_sill` | 1.20 × 1.35 frame, mullion + transom, oak sill |

Deferred deliberately (see §21): stairs, blinds, curtains, dado/wainscot, the
damaged and corner variants. They are additive — §5.2–§5.9 still hold.

**How it is wired.** `src/world/ModelLibrary.ts` caches each GLB once and clones
it; `src/systems/Room.ts` places modules, then merges every placement of an asset
into one geometry **per material** (`mergeGeometries`), so a room is a couple of
dozen draw calls instead of hundreds. Openings are cut by splitting each wall into
full-height piers plus a header over every opening and a sill panel under every
window — previously doorways and windows were holes with nothing above them.

**Two bugs this phase found, both fixed:**

1. The Blender exporter was writing the object transform into the node instead of
   the mesh, so every asset arrived offset and half-size when the game cloned it.
   `lib.export_glb` now applies the transform before export, and the loader also
   modulates by the node matrix.
2. `lib.box` scaled a 1 m cube by `size / 2`, halving every dimension. Every
   architecture asset was rebuilt after the fix; check `wall_1m` bounds are
   `x ±0.5, y 0…3, z ±0.065` before trusting a new group.

The house is the thing the player stares at for hours, and right now the walls
have no thickness, the trim is a thin box, and doorways are holes. This phase
fixes the feeling of "not a real place".

Dimensions follow UK domestic standards (Appendix B.2). The built house is
**3.00 m to the ceiling with 2.10 m door openings** (`HouseLayout.ts`), so the kit
matches those two numbers exactly and B.2 for everything else.

Folder: `public/models/architecture/`

### 5.1 Walls — a modular kit, not one mesh per room

1 m wide modules, tiled along a wall, so any room length works. Walls get
**0.13 m thickness** — thickness is what makes door reveals and window sills read
as real. Cut openings by leaving module gaps and capping with a frame, never by
deleting faces mid-wall.

| file | size (m) w×d×h | parts | materials | tris |
|---|---|---|---|---|
| `wall_1m.glb` | 1.00 × 0.13 × 3.00 | two faces, top cap, 2 end caps, skirting notch at base | `paint_white` | 240 |
| `wall_1m_cream.glb` | same | same | `paint_cream` | 240 |
| `wall_1m_wet.glb` | same | same + tiled lower band to 1.2 m | `tile_white`, `tile_grout` | 480 |
| `wall_1m_exterior.glb` | same | inner face, outer face, cavity line | `plaster`, `brick` or `render` | 320 |
| `wall_end.glb` | 0.13 × 0.13 × 3.00 | vertical pilaster for open ends | matching | 120 |
| `wall_corner_out.glb` | 0.13 × 0.13 × 3.00 | outer corner cap, mitred | matching | 160 |
| `wall_corner_in.glb` | 0.13 × 0.13 × 3.00 | inner corner cap | matching | 140 |
| `wall_dado.glb` | 1.00 × 0.13 × 3.00 | wall + dado rail at 1.0 m | `paint_white`, `oak` | 300 |
| `wall_panel_raised.glb` | 1.00 × 0.13 × 3.00 | wainscot panelling below 1.1 m | `paint_white` | 520 |
| `wall_damaged.glb` | 1.00 × 0.13 × 3.00 | hole, cracked plaster, exposed lath | `plaster`, `pine` | 700 |
| `bulkhead.glb` | 1.00 × 0.13 × 0.35 | dropped ceiling beam/duct boxing | `paint_white` | 180 |

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
| `door_frame_std.glb` | 0.13 deep × 2.04 | jambs, head, stops, architrave both sides | `paint_white` | 380 |
| `door_leaf_panel.glb` | 0.762 × 0.035 × 1.981 | stiles, rails, 2 raised panels | `paint_white` | 460 |
| `door_leaf_flush.glb` | 0.762 × 0.035 × 1.981 | flush slab, shadow gap | `paint_white` | 140 |
| `door_leaf_glazed.glb` | 0.762 × 0.035 × 1.981 | slab + 4 glass lights, glazing beads | `paint_white`, `glass_clear` | 520 |
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
and the attic/basement can use it later. Build them only if Phase 1 is being run
in full (the reduced kit in §21 may drop them).

---

## §6. Phase 2 — fixtures and appliances `[x]`

**Status:** `[x]` shipped 23 Nov 2026 · **Depends on:** Phase 1 (walls for them to stand against) · **Done when:** kitchen and bathroom are furnished, and every washable fixture is UV-mapped well enough to carry a dirt mask the cleaning code can paint on.

### 6.0 What shipped

Twenty-nine assets, **28,572 tris, 1.5 MB**, built by
`tools/blender/build_fixtures.py`, every one UV-mapped (`TEXCOORD_0`, for the
dirt masks in Phase 9), AO-baked and pruned.

| built | where it stands |
|---|---|
| `fridge_freezer`, `kitchen_run_1m`, `dishwasher`, `kitchen_sink`, `kitchen_corner` | the kitchen's south wall run, left to right, 3.55 m → 7.43 m |
| `hob_4burner`, `range_hood`, `splashback`, `kitchen_upper` ×2, `microwave`, `kettle`, `toaster`, `kitchen_bin` | worktop and wall above |
| `washing_machine`, `boiler` | kitchen west wall, away from both doorways |
| `bath_standard`, `bath_panel`, `bath_mat` | bathroom north wall |
| `toilet_close_coupled`, `toilet_roll_holder` | bathroom east wall |
| `vanity_unit`, `mirror_cabinet`, `towel_rail` | bathroom south wall |
| `shower_tray`, `shower_enclosure`, `shower_riser` | bathroom south-west corner |
| `radiator_panel` ×2 | living room and entrance hall |

Placements live in `src/world/FixtureLayout.ts` (world metres, rotation so each
unit faces into its room); `Room.createFixtures()` loads and clones them, and
adds every fixture mesh to `getCleanableSurfaces()` so the sponge can reach them.

**Two engine fixes this phase needed:**

1. **No environment map.** Every metal in the game (chrome taps, stainless
   appliances) rendered pure black, because a metal with nothing to reflect has
   no colour. `SceneManager.createScene()` now generates a small PMREM room
   probe at intensity 0.5.
2. **Prune was eating the UVs.** `gltf-transform prune` drops attributes no
   material uses, which silently removed `TEXCOORD_0` — the exact thing the dirt
   masks need. Always prune with `--keep-attributes true`.

Deferred: the `_filthy` twins are correctly not built (§B.12); dirt arrives as
masks/decals in Phase 9. The hob, oven, fridge and cooker are separate models
that can be swapped per kitchen later.

Folder: `public/models/fixtures/`

The premise of the game is cleaning a filthy house, so fixtures matter more than
furniture: they are what the player scrubs.

**Do not build `_filthy` twins for these.** Research (§B.12) says dirt should be a
per-object mask plus decals, so one clean model is enough and it can visibly get
cleaner as the player works. Only build a separate dirty model where the filth
changes the silhouette (a bin overflowing, a blocked drain).

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

## §7. Phase 3 — decor, so rooms look lived in `[x]`

**Status:** `[x]` shipped 23 Nov 2026 · **Depends on:** Phases 1–2 · **Done when:** all eight rooms have props on and around their furniture, and no room reads as empty.

### 7.0 What shipped

Seventy-nine assets, **39,620 tris, 2.3 MB**, built by
`tools/blender/build_decor.py` (helpers in `decor_common.py`, one module per
section: `decor_living`, `decor_dining`, `decor_bedroom`, `decor_study`,
`decor_entry`). Every asset is AO-baked, UV-mapped and pruned.

`src/world/DecorLayout.ts` places **110 props across all eight rooms** and
`Room.createDecor()` merges them **per material** (22 shared materials across
all 222 primitives), so the whole dressing of the house costs 22 draw calls
instead of 110.

| room | what is in it |
|---|---|
| living | pictures and a clock on the walls, a shelf with books/candle/fruit, CRT with console, game cases, remote, soundbar, floor cushions, magazine pile, floor vase |
| entrance | coat hooks and a hanging jacket, shoe rack with keys tray, umbrella stand, doormat, mail, shopping bag, picture |
| kitchen | spice rack and drying rack on the walls, chopping board, knife block, plate stack, pans on the hob, fruit bowl, cereal, placemat with a plate, cutlery, tumbler, cereal bowl |
| dining | shelf with wine bottle, glass, teapot and a plate; two pictures |
| master bedroom | clothes rail and hangers, two suitcases, folded duvet and pillow, two shoe pairs, two laundry piles, shelf with books, glasses, alarm clock and phone, teddy, cushion |
| bedroom two | flat TV, toy blocks, teddy, throw, laundry, books, shoes, cable, shelf with a phone |
| study | cork board, shelf with paper stack, notebook and pen cup, monitor, laptop, keyboard, mouse, desk lamp, floor fan, office bin |
| bathroom | shampoo and conditioner on the bath, candle, soap and folded towel on the vanity, hanging towel, bath toy, scale |

**Two bugs this phase uncovered, both fixed here:**

1. **Every model was facing the wrong way.** The exporter turns Blender's −Y
   (the face of each asset) into glTF **+Z**, so `rotation: 0` looks toward +Z.
   All of Phase 2's fixtures were therefore turned into the walls — the kitchen
   cabinets, the fridge and the vanity all showed their backs — and nothing had
   caught it because the earlier screenshots were of what sits *on top* of them.
   `FixtureLayout.ts` now names its rotations `SOUTH_WALL`, `NORTH_WALL`,
   `WEST_WALL`, `EAST_WALL`, and `DecorLayout.ts` does the same. §3.1 is corrected.
2. **Black cabinet doors.** The raised panel on every shaker door was modelled
   *behind* the door slab, so it was both invisible and fully occluded — the AO
   bake gave it near-zero light and it showed as a black rectangle. The panel
   now sits proud of the slab. (Same fix in `kitchen_upper`.)

Deferred, deliberately:

- **`table_runner`** is built and validated but not placed: it is 2 m long and
  there is no table to put it on until the player buys one.
- **Soft furnishings that belong on furniture** (cushions and throws on a sofa,
  tableware on a dining table) are built and waiting for a furniture-anchored
  pass; furniture in this game is player-placed, so decor cannot assume it.
- **LOD1s** (§18). The props are 60–1,000 tris each and merged, so the win is
  not worth the extra files yet.
- Bedroom rooms still read sparse until a bed and wardrobe are bought. Decor is
  not a substitute for furniture.

`wall_shelf` is the one asset not in the table below: `shelf_bracket` alone
cannot hold anything, so the board is its own 24-triangle model and the brackets
are placed under it.

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

## §8. Phase 4 — trash, clutter and spills `[x]`

**Status:** `[x]` shipped 23 Nov 2026 · **Depends on:** Phase 1 (floors to land on) · **Done when:** all 31 trash types load as models instead of boxes, with spawn behaviour unchanged.

### 8.0 What shipped

Forty-six assets, **7,998 tris, 511 KB**, built by `tools/blender/build_trash.py`
(helpers in `trash_common.py`, one module per family: `trash_paper`,
`trash_drink`, `trash_soft`, `trash_hard`, `trash_spill`). Every one is
bottom-centre origin, AO-baked, UV-mapped and pruned, and every one is inside
its row budget — the largest is `sock_pair` at 336 triangles.

**The count in this file was wrong.** `TRASH_TYPES` plus the five job tables in
`TrashManager.ts` spawn **31 distinct names**, not the 23 this section claimed,
and seven of them had no row here at all: `plastic_sheet`, `wet_towel`,
`damaged_item`, `debris`, `dust_bunny`, `cobweb`, `lint_ball`. They are in the
table below now and all seven are built, because a spawn type without a model is
an object missing from a job. The code wins; the row is fixed.

**How it is wired.** `TrashItem` clones the GLB through `ModelLibrary` instead
of building a box, and clones each material per item so the highlight stays on
the piece under the crosshair (a shared material would light every can in the
house). `TrashManager.init()` preloads all 31 models before it spawns anything,
and picks only types whose model actually loaded. Picking is otherwise
unchanged: `Game.ts` and `CleaningSystem.ts` now walk up from the raycast hit to
the owning item, so a hit on any child mesh counts.

**Two things deliberately changed with the placeholder:**

- The slow bob and spin are gone. They existed to make an untextured box read as
  pickable; a beer can hovering and turning in mid-air is worse than no cue at
  all, and the highlight does that job properly now.
- The item no longer disposes its geometry on collection. Geometry is shared
  with the cached asset — disposing it would blank every other clone of that
  type. Only the per-item material clones are freed.

**Deferred, deliberately:**

- No `COL_` collision proxies inside the GLBs. Trash has no physics body to feed
  yet (§15.2 exists for the furniture and vehicles that do), and a proxy for a
  64-triangle tissue would cost more than the model. The size table is still the
  source of a proxy when one is needed.
- The eleven variant rows (`pizza_box_closed`, `beer_can_crushed`, `tissue_wad`,
  `bottle_tipped`, `magazine_open`, `sock_pair`, `balloon_inflated`,
  `cardboard_box_crushed`, `cigarette_butt`, `dog_hair_tuft`, `sticky_patch`)
  are built and validated but not spawned: they belong to the "player walked on
  it" pass and to hand-placed detail, not to the random spawn table.
- The four spills are placed by the grime pass (§13), not by `TrashManager`.

`TrashManager.ts` no longer builds geometry at all. It holds the size/mass table
(the contract in §17) and spawns GLB clones. Folder: `public/models/trash/`.

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
them. Collision proxies (§15.2) are deferred for trash — there is no physics
body to feed yet, and §8.0 records why.

**Types the code spawns that this table used to miss** — all built and validated:

| file | real size (m) | tris | notes |
|---|---|---|---|
| `plastic_sheet.glb` | 0.50 × 0.50 × 0.03 | 140 | renovation dust sheet, crumpled |
| `wet_towel.glb` | 0.30 × 0.30 × 0.03 | 156 | emergency, damp cloth with a fold |
| `damaged_item.glb` | 0.20 × 0.20 × 0.10 | 108 | two shards and a chunk |
| `debris.glb` | 0.15 × 0.15 × 0.06 | 256 | five chunks plus dust |
| `dust_bunny.glb` | 0.08 × 0.08 × 0.05 | 152 | deep clean, three lumps |
| `cobweb.glb` | 0.22 × 0.22 × 0.005 | 180 | six rays and a ring |
| `lint_ball.glb` | 0.05 × 0.05 × 0.04 | 64 | dryer fluff |

### 8.1 Spills — geometry or decal?

Liquid spills are decals, not meshes (§13). Exception: the three "chunky" spills
(paint, food, mud) get a 1–2 cm mesh so they read in 3D:

| file | size | tris |
|---|---|---|
| `spill_paint.glb` | 0.35 × 0.35 × 0.01 | 260 |
| `spill_food.glb` | 0.20 × 0.16 × 0.02 | 220 |
| `spill_mud.glb` | 0.30 × 0.22 × 0.02 | 240 |
| `spill_puddle.glb` | 0.40 × 0.30 × 0.004 | 116 |

All four are built and validated (§8.0); the grime pass (§13) is what places them.

---

## §9. Phase 5 — the cleaning kit (held, first person) `[x]`

**Status:** `[x]` shipped 23 Nov 2026 · **Depends on:** nothing · **Done when:** the four tools and the gloved hand are models in the player's hands, and the old primitive builders are deleted.

### 9.0 What shipped

Twenty-one assets, **9,636 tris, 725 KB**, built by `tools/blender/build_tools.py`
(helpers in `tool_common.py`, builders split across `tools_held.py` and
`tools_kit.py`, the same module-per-family reason as Phase 4). The largest is
`vacuum` at 1,112 triangles, the smallest `sponge` at 88; every row is inside the
§3.5 handheld budget of 1,800.

**These are the only assets in the library that are not one joined mesh.** Each
one exports as several named objects plus `SOC_*` empties, because the game looks
names up at runtime: `liquid` drives the spray level, and the sockets are where
the spray, the mop head and the vacuum head actually are. AO still bakes across
the whole object — Cycles' AO pass is a scene query, so a finger baked on its own
is darkened by the palm above it, and the parts do not have to be joined for that
shadow to read.

**Pruning is deliberately skipped for this group.** `@gltf-transform prune` drops
nodes that carry no mesh, which is exactly what a socket is: run against
`spray_bottle.glb` it removed `SOC_grip` and `SOC_nozzle` and the spray would have
fallen back to guessing. It also only saved 4%, against a group that is 725 KB in
total, so nothing is lost by leaving the files alone (§20 item 1b now says so).

**Pivots.** The four held tools and both gloves use grip centre (§3.2), so one
glove lands correctly on all four with no per-tool offset. That is why the mop's
origin is 70 cm above its head: the hand is the anchor, not the floor. Everything
else is floor centre, except the apron, which hangs from its neck loop.

**The half-turn.** Models are authored facing −Y (§3.1), which becomes +Z in
three.js — at the player — so the HUD turns every tool a half-turn in `y` to point
its working end down-range. Two consequences: the spray bottle's level window is
modelled on the **+Y side** (the model's back) so it faces the player, and the
glove is attached with a cancelling π of its own so its forearm still comes from
the bottom-right of the frame rather than across the middle of it.

**HUD placement is a table now, not four hard-coded builders.** Each entry holds
the fist position in camera space, a small rotation, the socket to read the
working point from, and that socket's local emission axis. Measured in the
portrait preview viewport (95° FOV, 0.53 aspect) each working end lands inside the
frame: nozzle NDC 0.92 / −0.35, mop head 0.43 / −0.24, vacuum head 0.60 / 0.33,
bag rim 0.74 / 0.08.

**Wiring, one change each:** `buildSprayBottle`, `buildMop`, `buildVacuum` and
`buildTrashBag` are gone; `updateToolModel` asks `ModelLibrary` for the GLB
(cached, cloned) and guards a late resolve with a token; `getToolTipPose` reads
the socket instead of a hand-tuned offset; `updateProgress` still drives the spray
level, now through the `liquid` mesh's own node origin so it empties downward
instead of hovering mid-bottle; the progress ring is built once and re-parented
instead of recompiling its shader on every switch; camera-space meshes have
shadows off so a tool cannot throw a shadow across the room.

**Bugs this phase found and fixed:**

- The mirrored glove came out with its palm and knuckles on the wrong side of the
  fist: `lib.box` and the blob helpers keep their placement in the object origin,
  so mirroring only the vertices moved the fingers and left the hand behind.
  `mirror_x` flips the origin too.
- The glove was attached with a cache clone, which returns `null` on a cold start
  while the glove is still downloading — the player got a floating bottle with no
  hand. It is its own load now, with a "did the tool change while I was loading"
  check.
- `leaf` was in the validator palette and used by the sponge's scourer but was
  missing from `lib.PALETTE`; added (§3.4 `#3E7A34`).
- The first contact sheets showed half of every held tool buried under the studio
  floor, because grip-centre pivots put geometry below z = 0. The preview script
  lifts each item onto the floor now — worth knowing before the next such sheet.

**Deferred, deliberately:**

- **The three animation clips** (`AN_spray_pull`, `AN_mop_swing`,
  `AN_vacuum_push`) are not built. Object-level clips need a node rig and an NLA
  track per part, and `DiegeticHUD` has no mixer to play them; doing both in the
  same phase as the models would have doubled it for motion the player mostly
  reads as the existing idle bob. The trigger is already a separate unmerged
  object with a real gap behind it, so `AN_spray_pull` later is an export flag and
  a mixer, not a re-model.
- `spray_bottle_empty` validates but nothing spawns it: the level currently
  bottoms out at 20% instead of swapping to the empty model.
- `trash_bag_full`, `mop_bucket`, `bucket`, `caddy`, `glove_hand_left`,
  `spray_nozzle`, `face_mask`, `apron`, `cloth`, `sponge`, `scrub_brush`,
  `dustpan`, `squeegee` and `refill_bottle` are modelled for the repair loop and
  the §11–§13 dressing passes; they are not placed in the house yet. This phase's
  contract is the four tools and the hand, and those are wired.
- `vacuum_floor_head` stays a separate asset per the table, so the in-hand vacuum
  ends at the wand catch. Joining it to the wand belongs to the cleaning-feel
  pass, where the head has to move while you clean.

`CleaningSystem` has exactly four tools: `spray`, `mop`, `vacuum`, `trash_bag`.
`DiegeticHUD.ts` used to build them from primitives; since §9.0 it clones GLBs. These are the objects on
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

## §10. Phase 6 — vehicles `[x]`

**Status:** `[x]` done 24 Nov 2026 · **Depends on:** nothing · **Done when:** every car body is a model with an interior, the wheels still sit exactly where the spec puts them, and damage overlays attach by name.

Until this phase `VehicleVisual.ts` built cars from 8 boxes. You stare at the car
constantly, so this is the second biggest visual win after the house.

### 10.0 What shipped, and the five decisions worth knowing

**Shipped:** 29 assets in `public/models/vehicles/` — seven bodies, four wheels
plus a hubcap, seven trim pieces, four interiors, six damage/dirt overlays and a
`damage_panel_set`. 90,827 triangles, 3.9 MB, about 2% smaller after prune. The
whole group is inside the 12,000 per-asset budget; the largest piece is the
recovery truck at 11,970.

**1. The wheels now ride the spec's wheelbase, and that was a bug fix.** The old
code placed wheels at `length/2 - 0.15`, which put the axles 30 cm inside the
bumpers — on a 4 m hatchback a real wheel arch would have been wider than the
body. `VehiclePhysics` and `Vehicle` now both use `wheelbase`, `trackFront` and
`trackRear`, and every body cuts its arches at exactly those points. The model
and the physics move together: changing one without the other leaves the wheels
outside the car, which is why both places carry a comment saying so.

**2. One uniform scale, on wheels only.** A tyre's size *is* the spec, so
`Vehicle.createWheel()` scales each wheel asset by
`specs.wheelRadius / nominalRadius`. Every other asset is authored at world size
(§3.1). The alternative — five sizes of every wheel — would have cost more than
all seven bodies together.

**3. Panels are named after `PANEL_NAMES`, not §10.1's shorthand.** The game looks
objects up as `front_left_door`, `front_windshield`, `left_mirror`,
`radiator_grille` and so on; `door_fl` would have been a silently dead damage
system. Doors keep hinge-edge pivots through `keep_origin`, so `AN_door_open`
has an axis to rotate.

**4. Prune is safe here.** Every node in a vehicle is a mesh, so
`@gltf-transform prune` cannot delete anything the game reads. (The tools group
is the opposite case; see §9.0.) Prune writes a text `.gltf` if the output path
does not end in `.glb` — the first attempt destroyed the whole group that way and
had to be rebuilt, so the loop now writes `*.pruned.glb` and checks the magic
bytes before replacing anything.

**5. The cabin interior is one size.** `interior_cabin.glb` is authored to the
hatchback cabin and fitted unscaled to the hatch, sedan, estate and coupe. The
van, pickup and recovery truck have none yet; their cabins are a different shape
and would need their own interiors rather than a stretched one.

**Honest deviations from the tables above:** wheels came out at 928–1,092 tris
rather than 900; `interior_cabin` is 4,152 rather than 2,600; `dashboard` is
1,184 rather than 620; `light_head_pair` is 1,040 rather than 420. All are inside
the group budget. The recovery truck has four arches rather than six: `Vehicle`
places exactly four wheels, and an empty arch looks worse than a missing axle.
The 27 in §0.2 became 29 because `damage_panel_set` is three dented panels, two
screens and a bumper.

**6. A pre-existing defect this phase found and deliberately did not touch.**
`Vehicle.updateVisual()` copies the physics wheel position — a **world**
coordinate — straight into a **local** child transform
(`wheel.position.copy(state.position)`), and copies the physics body centre onto
a model whose origin is at ground level. While the car is parked nothing calls
that code, which is why the car looks right at rest and why the bug has never
been reported. It is untouched here because fixing it needs the car driven and
watched, and this VM renders the game at about one frame per second. The fix is
a world-to-local conversion (`(state.position - chassis.position)` rotated by the
inverse chassis quaternion) plus an offset for the body centre; do it with a
real browser.

**Read `src/vehicle/Vehicle.ts::createWheel()` before you build.** Wheels are not
part of the body: `Vehicle` creates them and positions them from `VehicleSpecs`
(track, wheelbase, `y = wheelRadius`). So bodies are built **without wheels**,
with real arch cut-outs sized from the spec.

Folder: `public/models/vehicles/`

Budget check (§B.6): body 8–12k, four wheels 2–4k, interior 1–3k — a car should
land around 14k, which is the range mobile racers ship in.

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

**Status:** `[ ]` not started · **Depends on:** Phase 6 (cars to repair) · **Done when:** the repair bay is furnished and every tool in the catalogue has a visual.

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

**Status:** `[ ]` not started · **Depends on:** Phase 1 (exterior wall modules) · **Done when:** houses, gardens and street props are models, and the view out of a window is no longer empty geometry.

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
| `tree_oak.glb` | 8 × 6 | 2,200 | trunk, 5 branches, 4 canopy clumps (was 3,400 — over budget, §B.7) |
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

**Status:** `[ ]` not started · **Depends on:** Phases 1–2 (surfaces to sit on) · **Done when:** dirt decals and grime meshes attach to surfaces and visibly fade as the player cleans.

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

**Status:** `[ ]` not started · **Depends on:** Phases 1–3 · **Done when:** every material family has its maps and the flat-colour path still works on low-end devices.

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
- **WebP, not KTX2**, for textures at this size: KTX2 needs the `ktx` CLI which is
  awkward to install headless without root, and the win below 512² is small (§B.9).
  Revisit only if texture memory becomes a real problem.
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
  build_tools.py       [x] exists (21 assets, sockets, no prune)
  build_vehicles.py    [x] exists (29 assets, named panels, prune safe)
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
def bake_ao(obj, samples=16)          # vertex-colour AO, recipe in §2.4
def enable_extension(slug)            # bl_ext.blender_org.<slug>
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
| decor | `DecorLayout.ts` (per-room wall/floor lists) + `Room.createDecor()` merged per material | furniture transforms |
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

## §19. Dependencies, effort and what to skip

| # | Phase | Depends on | Effort | Why it sits here |
|---|---|---|---|---|
| 1 | Shell | — | one long session | walls, trim, doors and windows are the reason the house reads as cheap; everything else sits on top of them |
| 2 | Fixtures | 1 | 1–2 sessions | kitchens and bathrooms are where cleaning actually happens |
| 3 | Decor | 1, 2 | 1–2 sessions | the cheapest way to stop rooms feeling unfurnished |
| 4 | Trash | 1 | 1 session | the core interaction; shipped as 46 GLBs |
| 5 | Cleaning kit | — | 1 session | always on screen, so it must look right early; shipped as 21 GLBs |
| 6 | Vehicles | — | 1–2 sessions | the car is the second thing the player stares at |
| 7 | Garage | 6 | 1 session | the other half of the loop |
| 8 | Exterior | 1 | 1–2 sessions | only matters once the player can see outside |
| 9 | Grime | 1, 2 | 1 session | the payoff of the game, needs surfaces to sit on |
| 10 | Textures | 1–3 | 1 session | last, because flat colour already works |

Notes:

- **Phases 4, 5 and 6 need nothing.** If the steerer wants a quick win, any of
  them can jump ahead of 2 and 3 without consequences.
- **Do not skip Phase 1 before 8.** The exterior reuses the wall modules, and
  building them twice is wasted work.
- **Phase 9 before 10 is fine.** Grime decals work on flat colour; textures only
  make them richer.
- Effort is my scripting time with `lib.py` already in place. Phase 1 includes
  writing `lib.py`, the build harness and the validator.

## §20. Definition of done (every phase)

0. `./tools/setup-blender.sh --check` passes, and the phase is ticked `[~]` in
   §0.2 before work starts.
1. Build script runs clean; every asset logs `wrote <name> <tris> tris`.
1b. Every asset carries vertex-colour AO (§2.4) and has been through
   `npx @gltf-transform/cli@4 prune` (§2.5) — except the tools group, where prune
   deletes the `SOC_*` empties and the HUD loses every anchor it reads (§9.0).
2. `node tools/validate-models.mjs` exits 0.
3. `npx tsc --noEmit` → 0 · `npm run build` → 0 · `npm test` → all pass.
4. In game: new meshes visible, old procedural placeholders gone (search the
   scene graph for the old mesh names, they must not exist).
5. Frame rate on the mobile profile does not drop below the pre-phase number.
6. Screenshot before/after into `audit/`.
7. Commit with the *why*, push to `freebuff/5c3b7bc8617797a07a1d90c2`.
8. Update this file: tick the phase in §0.2, add a line to §0.4, correct any
   row that turned out wrong.

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
7. **Ceiling height: keep 3.00 m or drop to a UK-typical 2.40 m?** The code builds
   3.00 m rooms (§B.2); 2.40 would feel more ordinary and make furniture loom
   larger, but it means retuning the camera and every wall module.
   **Proposal: keep 3.00 m.** The kit is dimensioned for it and it reads grander,
   which suits the premise.

---

## Appendix A — quick index

| I need to… | go to |
|---|---|
| **start a phase** | say `Start Phase N` — index in §0.2, runbook in §0.3 |
| see what is finished | §0.2 status column, §0.4 log |
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

---

## Appendix B — research notes, with sources

Gathered 23 Nov 2026 by six parallel web-research passes. These are the rules I
did not know well enough before. Where a number here conflicts with a table
above, **this appendix wins**, and the table should be corrected.

### B.1 Writing Blender scripts at scale

- **Prefer `bmesh` / `from_pydata` over `bpy.ops`.** Operators depend on context
  and fail their `poll()` in background mode; BMesh edits mesh data directly and
  has `bmesh.ops` for bevel/inset. Blender publishes no speed benchmark, but the
  reliability difference is the real reason.
  [BMesh API](https://docs.blender.org/api/4.2/bmesh.ops.html) ·
  [operator gotchas](https://docs.blender.org/api/4.2/info_gotcha.html)
- **`temp_override` supplies context values; it cannot invent a UI area.** So
  anything that needs a 3D View — notably `bpy.ops.uv.smart_project` — is not
  reliably available in a true headless run. **Consequence for §14: unwrap with
  box/planar projection written in `lib.py`, not Smart Project.**
  [Context API](https://docs.blender.org/api/4.2/bpy.types.Context.html)
- **Deterministic randomness:** seed a local `random.Random` from a hash of the
  asset id, never global state, so a rebuild produces identical files.
  [Python random](https://docs.python.org/3.11/library/random.html)
- **Modifier order for crisp low-poly:** Bevel (angle limit) → Weighted Normal →
  Smooth by Angle (4.1+ replaced mesh auto-smooth).
  [Bevel modifier](https://docs.blender.org/api/4.2/bpy.types.BevelModifier.html) ·
  [shading manual](https://docs.blender.org/manual/en/4.2/scene_layout/object/editing/shading.html)
- **Export with the hierarchy intact** (`export_hierarchy_flatten_objs=False`).
  Flattening exists for non-decomposable transforms and is the fastest way to
  lose parented doors, wheels and sockets.
  [exporter API](https://docs.blender.org/api/4.2/bpy.ops.export_scene.html)

### B.2 Real dimensions (UK domestic, metres)

The house in code is **3.00 m to the ceiling** with **2.10 m door openings**
(`HouseLayout.ts`, rooms are `size.y = 3`, doors `height: 2.1`). Build the kit to
those two numbers and to the standards below for everything else.

| element | value | note |
|---|---|---|
| internal door leaf | **0.762 × 0.035 × 1.981** | 838 mm leaf for main rooms |
| door lining | 0.028–0.032 thick | depth matches wall |
| internal wall | **0.125** finished | 100 mm block + 2 × 12.5 plaster |
| external wall | 0.30–0.35 | cavity + insulation |
| door opening (code) | **0.80–1.00 wide × 2.10 high** | leave 2.04 frame + 0.06 header |
| window sill | 0.80–0.90 | escape windows: openable bottom ≤ 1.10 |
| window head | 2.10 | |
| kitchen worktop | **0.90 high × 0.60 deep** | 0.62 with upstand |
| base carcass | 0.72 high × 0.56 deep, 0.15 plinth | 0.028–0.040 top |
| wall units | 0.29–0.30 deep | 0.45–0.60 above worktop |
| bath | **1.70 × 0.70** | 0.55–0.60 high |
| WC | 0.36 × 0.64 | 0.75 clear in front (Part M) |
| basin | 0.55 × 0.46 | |
| stair rise | 0.150–0.220 | max pitch 42° |
| stair going | 0.220–0.300 | 0.80 practical width |
| skirting | 0.12 | design choice, not a standard |
| cornice | 0.08 | design choice |
| sockets / switches | centre 0.45–1.20 above floor | Part M |
| ceiling (NDSS min) | 2.30 over 75% of area | the built house is 3.00 |

Sources: [Approved Document M](https://assets.publishing.service.gov.uk/media/5a7f8a82ed915d74e622b17b/BR_PDF_AD_M1_2015_with_2016_amendments_V3.pdf) ·
[Approved Document K](https://assets.publishing.service.gov.uk/media/60d5bdcde90e07716f516cfd/Approved_Document_K.pdf) ·
[NDSS](https://www.gov.uk/government/publications/technical-housing-standards-nationally-described-space-standard/technical-housing-standards-nationally-described-space-standard) ·
[standard door sizes](https://www.jbkind.com/info-centre/useful-door-information/standard-door-sizes) ·
[kitchen install guide](https://www.homebase.co.uk/medias/kitchens-by-homebase-product-installation-guide.pdf)

**Open question (see §21):** a 3.00 m ceiling is generous for a UK house. Keeping
it reads grander and costs nothing; dropping to 2.40 means retuning the camera and
every wall module. Decide before Phase 1, not after.

### B.3 PBR values that make a surface believable

- **Non-metal base colour:** most albedos live in **30–240 sRGB** (0.01–0.87
  linear); keep a floor around 50 sRGB for anything but deep shadow.
  Fresh wood ≈ 0.35–0.42 linear, weathered wood ≈ 0.12–0.16.
  [Substance PBR guide](https://www.adobe.com/learn/substance-3d-designer/web/the-pbr-guide-part-2) ·
  [rFactor PBR guide](https://docs.studio-397.com/pages/viewpage.action?pageId=37945386)
- **Metals:** `metallic = 1`, base colour is the reflectance — iron
  (0.560, 0.570, 0.580) linear, gold (1.000, 0.766, 0.336). Intermediate metallic
  values are for transitions like rust, not "extra shine".
  [Unreal PBR](https://dev.epicgames.com/documentation/unreal-engine/physically-based-materials-in-unreal-engine)
- **Roughness starting points:** wood 0.60–0.90 raw, 0.20–0.40 varnished;
  fabric 0.70–1.00; glazed ceramic 0.05–0.25, matte 0.40–0.80; metal 0.20–0.60.
  [Roblox material reference](https://create.roblox.com/docs/en-us/art/modeling/material-reference)
- **Bevel width ≈ 0.2–1% of the object's smallest dimension**, then judge at the
  real camera distance. Model bevels that catch a highlight; fake the rest.
  [Polycount](https://polycount.com/discussion/215331/when-should-i-bevel)
- **Metal with no environment map renders black.** The game must have
  `scene.environment` before brass and chrome can work (§B.4).
  [three.js #9228](https://github.com/mrdoob/three.js/issues/9228)

**Action for §3.4:** the palette is roughly in range, but check each value against
this before Phase 1 — our `walnut` is at the dark end and `brass` needs verifying.

### B.4 three.js r165 rendering (the assets assume this)

- **Tone mapping: `AgXToneMapping`, exposure 1.0**, tuned 0.8–1.2. `Neutral` does
  not exist until r170; `ACESFilmic` shifts saturated colours. AgX arrived in r160.
  [r165 constants](https://raw.githubusercontent.com/mrdoob/three.js/r165/src/constants.js) ·
  [r160 release](https://github.com/mrdoob/three.js/releases/tag/r160)
- **1–3 dynamic lights.** A shadow-casting point light costs six shadow renders;
  prefer one directional/spot with modest shadow map, and fake the rest.
  [three.js shadows](https://threejs.org/manual/en/shadows.html)
- **Environment:** one small HDR (512×256 or 1024×512) through
  `PMREMGenerator.fromEquirectangular()` once, assigned to `scene.environment`.
  [PMREM docs](https://threejs.org/docs/pages/PMREMGenerator.html)
- **Contact shadows:** `ShadowMaterial` on the floor, or a blob quad under
  furniture — cheaper than a shadow-casting point light.
  [ShadowMaterial](https://threejs.org/docs/pages/ShadowMaterial.html)
- **AO maps need `uv1`** in r152+ (the attribute was renamed from `uv2`, and the
  automatic copy was removed). This is exactly why **vertex-colour AO (§2.4) is
  the better call** for us: no second UV set, no extra texture.
  [migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)

### B.5 glTF export pitfalls (Blender 4.2 → three.js r165)

- Base colour and emissive maps export as **sRGB**; metal/rough and normal maps
  must be **Non-Color**. Never gamma-correct them by hand.
  [Blender glTF manual](https://docs.blender.org/manual/en/4.2/addons/import_export/scene_gltf2.html)
- **Backface Culling in Blender is the inverse of glTF `doubleSided`.** Tick it for
  closed solids, leave it off for curtains and leaf cards.
- **Tangents:** export them if we ever ship normal maps, otherwise three.js falls
  back to derivative tangents and shading can seam.
- **Animations:** in Actions mode an action must be stashed on an NLA track or it
  will not export at all. One track per clip, names in `AN_*` (§15.1).
- **Node names are not unique IDs** — the loader sanitises and suffixes duplicates.
  Never rely on `getObjectByName` for something that might be duplicated.
- `KHR_materials_emissive_strength` and `KHR_texture_transform` are supported in
  r165, so lamp emissive levels and UV offsets can be authored in Blender.

### B.6 Cars: what actually reads as a car

- **Budget for a mobile-ish player car: 11k–19k tris total** — body 8–12k, wheels
  2–4k, interior 1–3k when the camera can see it.
  [Unity discussion](https://discussions.unity.com/t/what-would-be-an-ideal-poly-count-for-a-mobile-racing-game/673701) ·
  [BeamNG workflow](https://beamng.com/game/news/blog/a-look-at-vehicle-workflow-part-1)
- **Build one continuous shell, then cut the panels.** Cutting first is what
  produces wobbly reflections across door seams.
- **Boxy-looking cars** come from: flat sides where the reference curves, generic
  roof and bonnet lines, wrong wheel size or position, angular arches.
- **Interiors:** a chase camera can get away with tinted glass and a few shapes.
  Our camera can look through the windscreen, so a simplified cabin is worth it.
- **Damage:** vertex deformation plus detachable panels is the arcade-standard
  cheat; nobody expects real crumple.
  [iRacing damage](https://www.iracing.com/road-new-damage/)

### B.7 Vegetation that does not look like a green ball

- **Avoid stacks of big alpha cards on mobile.** Masked pixels still cost shading,
  and overdraw multiplies; geometry leaf clumps are usually cheaper and read with
  more volume at our distances.
  [Epic mobile guidelines](https://dev.epicgames.com/documentation/unreal-engine/performance-guidelines-for-mobile-devices-in-unreal-engine)
- **Counts:** trees around 500–2,000 tris (more for a hero tree), bushes
  200–800, hedges budgeted per reusable segment.
- **Silhouette first:** species-shaped outline, visible trunk and branches, uneven
  crown lobes with gaps between them.
  [Beyond Extent foliage](https://www.beyondextent.com/course/introduction-to-foliage)
- **Wind:** vertex-shader offset weighted by vertex height, with a per-instance
  phase so nothing moves in lockstep. Cheap and convincing.
  [GPU Gems 3, ch.16](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-16-vegetation-procedural-animation-and-shading-crysis)

**Action for §12.4:** `tree_oak` at 3,400 tris is over budget — target ≤ 2,200 and
drop `grass_tuft` cards except where they matter close up.

### B.8 Art direction: rich but neglected

- **60/30/10 surface split** — quiet dominant materials, secondary variation, one
  saturated accent. Our teal-on-walnut palette already follows this; keep the
  accent to a few linked objects, not spread evenly.
- **Dirt has a cause.** Put it at contact points, corners, behind furniture, around
  a leak, along walked routes — and leave some surfaces clean so the dirt reads.
  [Surveillance room breakdown](https://gamesartist.co.uk/surveillance-room/)
- **One dominant motivated light** (daylight through windows), soft fill, lamps
  tone-varied rather than all equal.
- **Consistency beats realism:** House Flipper 2 abandoned photorealism for a
  coherent style because mixed fidelity looked worse.
  [Interview](https://www.gamesindustry.biz/building-house-flipper-2-from-the-ground-up)
- References worth studying for layered domestic space: *Gone Home*, *Unpacking*,
  *Viscera Cleanup Detail* (heightened mess, not a realism benchmark).

### B.9 Compression and validation decisions

- **KTX2 needs the `ktx` CLI** (KTX-Software ≥ 4.3) on `PATH`; there is no
  official static binary or AppImage, and the Linux tarball may still want system
  libraries. For textures at 512² and below the win is small.
  **Decision: skip KTX2, ship WebP via `gltf-transform webp`.** Revisit only if
  texture memory becomes a real problem.
  [KTX-Software releases](https://github.com/KhronosGroup/KTX-Software/releases) ·
  [gltf-transform toktx](https://raw.githubusercontent.com/donmccurdy/glTF-Transform/v4.2.1/packages/cli/src/transforms/toktx.ts)
- **Meshopt over Draco** for us: smaller decoder, much faster decode (~1–3 GB/s),
  and `loader.setMeshoptDecoder()` is one line. Draco stays the fallback if file
  size ever matters more than decode time.
  [meshoptimizer](https://github.com/zeux/meshoptimizer/blob/master/js/README.md)
- **Validate in the build:** `npm i -D gltf-validator`, call `validateBytes()`,
  fail the script when `report.issues.numErrors > 0`. That is the check behind
  §16.4 and it catches broken GLBs before the game does.
  [validator node docs](https://github.com/KhronosGroup/glTF-Validator/blob/main/node/README.md)

### B.10 Draw calls and batching (phones)

- **Target under ~100 draw calls and ~100k visible vertices per frame.** Don McCurdy
  gives those as sensible ceilings; real mobile games have shipped at 40–120.
  ([three.js forum](https://discourse.threejs.org/t/bad-performance-when-loading-more-than-3500-meshes-into-the-scene/63960/4),
  [Robot Invader](https://robotinvader.com/blog?p=438))
- **`InstancedMesh`** collapses repeats of one geometry+material into one call — use
  it for trash, books, fence panels, foliage, repeat props.
- **`mergeGeometries`** only helps when the merged parts **share one material**;
  material groups each become a draw call. Merge walls by material, and chunk the
  result spatially or the merged bounding box defeats frustum culling.
  ([BufferGeometryUtils](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/utils/BufferGeometryUtils.js))
- **Measure, don't guess:** `renderer.info.render.drawCalls` and `triangles` are the
  numbers that matter. Atlas only when different textures are what prevents batching.

### B.11 Lightmaps: available, but not first

Baking a lightmap in Blender means a **second, non-overlapping UV set**, a target
image, and a Diffuse bake with Direct+Indirect enabled and Color disabled so only
lighting is stored. Margin/padding is mandatory or seams bleed at the edges.
In three.js r152+, that map is `lightMap` with `channel = 1` (`uv1`), and its colour
space must match what was saved — lightmaps are usually linear/float.
([Blender baking](https://docs.blender.org/manual/en/4.0/render/cycles/baking.html),
[MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html))

**Decision:** vertex-colour AO (§2.4) first — it needs no UV2 and no texture. A real
lightmap pass is a stretch goal after Phase 9, and only if the lighting still looks
flat with one motivated light plus environment.

### B.12 How dirt should actually work

Four techniques, ranked for our size:

| technique | cost | use it for |
|---|---|---|
| **projected decals** | no UVs, independent objects | ambient stains, splash marks, cobwebs |
| **per-object mask texture** | one 256–512 px canvas per washable | anything the player scrubs, with progress |
| vertex-painted mask | free to draw, limited by vertex density | large walls, coarse surfaces |
| triplanar grime | extra samples, no UVs | background dirt on awkward geometry |

The cheapest convincing setup for a small three.js game: **one canvas-baked
grayscale mask per washable object**, blended over the clean material; raycast the
spray/mop, take `intersection.uv`, stamp soft circles; count remaining dirty texels
to drive a percentage. **PowerWash Simulator's own rules** are the reference for
feel: per-object progress, visible percentage, and a forgiving completion threshold
(a fiddly object can count as done at ~90%).
([FuturLab](https://www.futurlab.co.uk/news/the-powerwash-simulator-demo-update-is-now-live),
[Eurogamer](https://www.eurogamer.net/powerwash-simulator-developer-diary-discusses-cleanliness-thresholds-dirt-design),
[CanvasTexture](https://threejs.org/docs/pages/CanvasTexture.html))

**Action for Phase 9:** build dirt as masks+decals, not as bespoke "dirty model"
variants. The `_filthy` twins in §6 then become unnecessary — one model plus a mask
is cheaper and animates as it is cleaned.

### B.13 Tiling textures at 256–512 px

- **Two scales of variation:** a low-frequency colour/roughness layer over a regular
  tile pattern. Big obvious features are what make repetition read.
  ([Polycount](https://polycount.com/discussion/225641/avoiding-texture-repetition-on-big-walls))
- **Dirt belongs in grout and joints**, irregular, not a uniform dark outline around
  every tile. Tile and grout need **different roughness** or the surface reads fake.
  ([Polycount tile critique](https://polycount.com/discussion/216017/moroccan-tile-material))
- **Restrained normal maps.** A smooth tile with a lumpy normal looks like plastic.
- **Bake the pattern periodic before baking to image:** feed 4D noise the UV mapped
  around a torus, or use Blender's 4D Noise option, so opposite edges match exactly.
  Then bake from a plane whose UVs fill 0–1. Check the result by tiling it 3×3 —
  especially normal and roughness, where seams show first.
  ([tileable noise](https://blender.stackexchange.com/questions/135437/how-to-make-tileable-procedural-noise-texture))

### B.14 What the research changed in this plan

| decision | before | now | phase |
|---|---|---|---|
| geometry authoring | `bpy.ops` wherever | `bmesh` first; UI-dependent ops avoided | 1 |
| walls | 0.15 × 2.60 | 0.13 × 3.00 (matches the code) | 1 |
| doors | 0.81 × 2.03 | 0.762 × 1.981 leaf, 2.04 frame | 1 |
| shadows | baked AO as a nice-to-have | **required on every asset** | all |
| textures | KTX2 | WebP, KTX2 skipped | 10 |
| tree budget | 3,400 tris | 2,200 tris, geometry over cards | 8 |
| car budget | unstated | ~14k total | 6 |
| dirt | `_filthy` model twins | per-object masks + decals | 9 |
| validation | GLB header check | Khronos `gltf-validator` in the build | 1 |
| lighting | unspecified | AgX, exposure 1.0, 1–3 lights, env map | 1 |
