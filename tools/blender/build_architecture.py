"""Phase 1 — the house shell (FINALLY-3D.md §5).

Reduced kit, as agreed in §21: walls with real thickness, floors, ceilings, two
trim profiles, real doors (frame + leaf + handle) and real windows (frame, glass,
sill). Stairs, blinds and curtain variants are deferred.

Every asset is metres, floor-centre origin, bevelled, smooth-shaded, and has AO
baked into vertex colours before export.

Run:  blender --background --factory-startup --python-exit-code 1 \
        --python tools/blender/build_architecture.py [-- name ...]
"""

import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

GROUP = "architecture"

WALL_H = 3.0        # HouseLayout: rooms are 3.0 m tall
WALL_T = 0.13       # UK internal wall, finished
DOOR_W = 0.90       # opening width; doors in the layout are 0.8-1.0
DOOR_H = 1.98


# ------------------------------------------------------------------ walls
def wall(name="wall_1m", mat="paint_white", wet=False):
    # a hairline bevel: a normal 6 mm bevel would draw a groove every metre
    parts = [lib.box(name + "_body", (1.0, WALL_T, WALL_H), (0, 0, WALL_H / 2), mat, 0.0015)]
    if wet:
        # tiled splash band to 1.2 m, slightly proud of the plaster
        parts.append(
            lib.box(name + "_tiles", (1.0, WALL_T + 0.012, 1.2), (0, 0, 0.6), "tile_white", 0.0015)
        )
        for z in (0.3, 0.6, 0.9):
            parts.append(
                lib.box("%s_grout_h%d" % (name, int(z * 100)), (1.0, WALL_T + 0.016, 0.006), (0, 0, z), "tile_grout", 0.001)
            )
        for x in (-0.333, 0.333):
            parts.append(
                lib.box("%s_grout_v%d" % (name, int(x * 100)), (0.006, WALL_T + 0.016, 1.2), (x, 0, 0.6), "tile_grout", 0.001)
            )
    return lib.join(parts, name)


# ------------------------------------------------------------------ floors
def floor_planks():
    parts = []
    shades = ["oak", "oak_light", "oak", "oak_dark", "oak_light"]
    width = 0.196
    for i in range(5):
        x = -0.392 + i * 0.196
        parts.append(
            lib.box("board%d" % i, (width, 1.0, 0.03), (x, 0, 0.015), shades[i], 0.004)
        )
    return lib.join(parts, "floor_planks")


def floor_tiles(name, n):
    """n x n tiles on a grout bed. n=2 gives 0.5 m tiles, n=4 gives 0.25 m."""
    size = 1.0 / n
    parts = [lib.box(name + "_grout", (1.0, 1.0, 0.016), (0, 0, 0.008), "tile_grout", 0.002)]
    for i in range(n):
        for j in range(n):
            x = -0.5 + size * (i + 0.5)
            y = -0.5 + size * (j + 0.5)
            parts.append(
                lib.box("%s_t%d%d" % (name, i, j), (size - 0.012, size - 0.012, 0.02), (x, y, 0.01), "tile_white", 0.004)
            )
    return lib.join(parts, name)


def floor_vinyl():
    parts = [
        lib.box("vinyl_body", (1.0, 1.0, 0.01), (0, 0, 0.005), "plastic_white", 0.002),
        lib.box("vinyl_seam", (1.0, 0.006, 0.012), (0, 0.0, 0.006), "tile_grout", 0.001),
    ]
    return lib.join(parts, "floor_vinyl")


# ---------------------------------------------------------------- ceilings
def ceiling_plain():
    parts = [
        lib.box("ceiling_panel", (1.0, 1.0, 0.02), (0, 0, 0.01), "paint_white", 0.004),
        lib.box("ceiling_joint", (0.006, 1.0, 0.022), (0.5, 0, 0.011), "paint_cream", 0.001),
    ]
    return lib.join(parts, "ceiling_plain")


# -------------------------------------------------------------------- trim
def skirting_modern():
    parts = [
        lib.box("skirt_body", (1.0, 0.016, 0.10), (0, 0, 0.05), "paint_white", 0.003),
        lib.box("skirt_lip", (1.0, 0.024, 0.016), (0, 0, 0.108), "paint_white", 0.003),
    ]
    return lib.join(parts, "skirting_modern")


def crown_plain():
    parts = [
        lib.box("crown_body", (1.0, 0.030, 0.060), (0, 0, 0.030), "paint_white", 0.004),
        lib.box("crown_cove", (1.0, 0.046, 0.022), (0, 0, 0.011), "paint_white", 0.005),
    ]
    return lib.join(parts, "crown_plain")


# ------------------------------------------------------------------- doors
def door_frame_std():
    t = WALL_T
    jamb = (DOOR_W - 0.90) / 2  # keeps the outer size independent of the opening
    half = DOOR_W / 2
    stroke = 0.05
    parts = [
        lib.box("jamb_l", (stroke, t, DOOR_H + 0.06), (-half + stroke / 2, 0, (DOOR_H + 0.06) / 2), "paint_white", 0.004),
        lib.box("jamb_r", (stroke, t, DOOR_H + 0.06), (half - stroke / 2, 0, (DOOR_H + 0.06) / 2), "paint_white", 0.004),
        lib.box("head", (DOOR_W, t, 0.06), (0, 0, DOOR_H + 0.03), "paint_white", 0.004),
        # stops the leaf closes against
        lib.box("stop_l", (0.014, 0.03, DOOR_H), (-half + stroke + 0.007, -0.04, DOOR_H / 2), "paint_white", 0.002),
        lib.box("stop_r", (0.014, 0.03, DOOR_H), (half - stroke - 0.007, -0.04, DOOR_H / 2), "paint_white", 0.002),
    ]
    # architrave, both faces
    arch_w, arch_d = 0.07, 0.016
    for side in (-1, 1):
        y = side * (t / 2 + arch_d / 2)
        parts += [
            lib.box("arch_l%d" % side, (arch_w, arch_d, DOOR_H + 0.14), (-half - arch_w / 2 + 0.02, y, (DOOR_H + 0.14) / 2), "paint_white", 0.003),
            lib.box("arch_r%d" % side, (arch_w, arch_d, DOOR_H + 0.14), (half + arch_w / 2 - 0.02, y, (DOOR_H + 0.14) / 2), "paint_white", 0.003),
            lib.box("arch_h%d" % side, (DOOR_W + 0.14, arch_d, arch_w), (0, y, DOOR_H + 0.07), "paint_white", 0.003),
        ]
    return lib.join(parts, "door_frame_std")


def door_leaf_panel(name="door_leaf_panel", mat="paint_white"):
    """0.762 x 0.035 x 1.981 leaf. Origin on the hinge edge, floor level."""
    w, d, h = 0.762, 0.035, 1.981
    parts = [lib.box("leaf_slab", (w, d, h), (w / 2, 0, h / 2), mat, 0.004)]
    # two raised panels, 2 mm proud on each face
    for z0, z1 in ((0.16, 0.90), (1.02, 1.86)):
        parts.append(
            lib.box(
                "panel_%d" % int(z0 * 100),
                (w - 0.20, d + 0.006, z1 - z0),
                (w / 2, 0, (z0 + z1) / 2),
                mat,
                0.005,
            )
        )
    return lib.join(parts, name)


def door_handle_lever():
    # rose and spindle sit on the door face (Blender +Y is the door normal)
    parts = [
        lib.cyl("rose", 0.026, 0.012, (0, 0, 0), "brass", 16, 0.002, rot=(math.pi / 2, 0, 0)),
        lib.box("lever", (0.11, 0.018, 0.018), (0.055, 0.012, 0), "brass", 0.004),
        lib.cyl("spindle", 0.006, 0.05, (0, 0.02, 0), "brass", 10, 0.001, rot=(math.pi / 2, 0, 0)),
    ]
    return lib.join(parts, "door_handle_lever")


# ----------------------------------------------------------------- windows
def window_frame_std():
    """Outer 1.20 x 0.13 x 1.35, opening 1.10 x 1.25, origin at the opening centre."""
    t = WALL_T
    w, h = 1.20, 1.35
    parts = [
        lib.box("w_top", (w, t, 0.05), (0, 0, h / 2 - 0.025), "paint_white", 0.004),
        lib.box("w_bottom", (w, t, 0.05), (0, 0, -h / 2 + 0.025), "paint_white", 0.004),
        lib.box("w_left", (0.05, t, h - 0.10), (-w / 2 + 0.025, 0, 0), "paint_white", 0.004),
        lib.box("w_right", (0.05, t, h - 0.10), (w / 2 - 0.025, 0, 0), "paint_white", 0.004),
        lib.box("w_mullion", (0.04, t, h - 0.10), (0, 0, 0), "paint_white", 0.003),
        lib.box("w_transom", (w - 0.10, t, 0.04), (0, 0, 0.28), "paint_white", 0.003),
        # inner reveal boards, so the window reads as a hole in a thick wall
        lib.box("w_reveal", (w - 0.10, t + 0.001, h - 0.10), (0, 0, 0), "plaster", 0.002),
    ]
    return lib.join(parts, "window_frame_std")


def window_glass():
    parts = [lib.box("pane", (1.10, 0.006, 1.25), (0, 0, 0), "glass_clear", 0.001)]
    return lib.join(parts, "window_glass")


def window_sill():
    parts = [
        lib.box("sill_board", (1.30, 0.22, 0.04), (0, 0, 0.02), "oak", 0.004),
        lib.box("sill_groove", (1.30, 0.006, 0.006), (0, 0.095, 0.041), "oak_dark", 0.001),
    ]
    return lib.join(parts, "window_sill")


# ------------------------------------------------------------------- build
BUILDERS = {
    "wall_1m": lambda: wall("wall_1m", "paint_white"),
    "wall_1m_cream": lambda: wall("wall_1m_cream", "paint_cream"),
    "wall_1m_wet": lambda: wall("wall_1m_wet", "paint_white", wet=True),
    "floor_planks": floor_planks,
    "floor_tile": lambda: floor_tiles("floor_tile", 2),
    "floor_tile_small": lambda: floor_tiles("floor_tile_small", 4),
    "floor_vinyl": floor_vinyl,
    "ceiling_plain": ceiling_plain,
    "skirting_modern": skirting_modern,
    "crown_plain": crown_plain,
    "door_frame_std": door_frame_std,
    "door_leaf_panel": door_leaf_panel,
    "door_handle_lever": door_handle_lever,
    "window_frame_std": window_frame_std,
    "window_glass": window_glass,
    "window_sill": window_sill,
}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    wanted = argv or list(BUILDERS)
    failures = []
    for name in wanted:
        if name not in BUILDERS:
            failures.append("%s: no builder" % name)
            continue
        try:
            lib.wipe()
            obj = BUILDERS[name]()
            lib.bake_ao(obj)
            lib.export_glb(obj, GROUP, name)
        except Exception as error:  # keep going; report at the end
            failures.append("%s: %s" % (name, error))
    lib.report(GROUP)
    if failures:
        print("\nFAILURES:")
        for failure in failures:
            print("  " + failure)
        sys.exit(1)


main()
