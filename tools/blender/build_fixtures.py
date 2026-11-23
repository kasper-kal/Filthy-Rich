"""Phase 2 — fixtures and appliances (FINALLY-3D.md §6).

Kitchen run, wet room and utility. One clean model per fixture: dirt is a mask
plus decals (§B.12), so no `_filthy` twins here.

Every asset is metres, floor-centre origin, bevelled, smooth-shaded, UV-mapped
(cube primitives carry UVs, which is what the dirt mask needs) and AO-baked.

Run:  blender --background --factory-startup --python-exit-code 1 \
        --python tools/blender/build_fixtures.py [-- name ...]
"""

import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

GROUP = "fixtures"

CARCASS_H = 0.72
PLINTH_H = 0.15
WORKTOP = 0.03
COUNTER_Z = PLINTH_H + CARCASS_H          # 0.87, underside of the worktop
DEPTH = 0.60


# ------------------------------------------------------------------ helpers
def bar(name, length, loc, axis="x", mat="brass", thick=0.012):
    size = (length, thick, thick) if axis == "x" else (thick, thick, length)
    return lib.box(name, size, loc, mat, 0.004)


def handle(name, x, z, y=-DEPTH / 2 - 0.015, vertical=False):
    """Bar handle. `y` is the face plane, handles stand proud of it."""
    size = (0.012, 0.018, 0.16) if vertical else (0.16, 0.018, 0.012)
    return lib.box(name, size, (x, y - 0.012, z), "brass", 0.004)


def door_panel(name, x, z, w, h, y=-DEPTH / 2 - 0.011):
    """Shaker door: slab plus a raised centre panel."""
    parts = [
        lib.box(name + "_slab", (w, 0.018, h), (x, y, z), "paint_white", 0.003),
        lib.box(name + "_panel", (w - 0.09, 0.022, h - 0.09), (x, y + 0.002, z), "paint_white", 0.004),
    ]
    return parts


def drawer_front(name, x, z, w, h, y=-DEPTH / 2 - 0.011):
    return [
        lib.box(name + "_front", (w, 0.018, h), (x, y, z), "paint_white", 0.003),
        lib.box(name + "_pull", (w - 0.06, 0.02, h - 0.04), (x, y + 0.002, z), "paint_white", 0.004),
    ]


def plinth(name, width):
    return lib.box(name, (width - 0.04, DEPTH - 0.08, PLINTH_H), (0, 0.03, PLINTH_H / 2), "steel", 0.003)


def worktop(name, width, depth=DEPTH + 0.02):
    return lib.box(name, (width, depth, WORKTOP), (0, -0.01, COUNTER_Z + WORKTOP / 2), "oak", 0.003)


def cabinet_shell(name, width, height=CARCASS_H, z0=PLINTH_H):
    return lib.box(name, (width - 0.008, DEPTH - 0.02, height), (0, 0, z0 + height / 2), "paint_white", 0.003)


# ------------------------------------------------------------------ kitchen
def kitchen_run_2m():
    parts = [plinth("plinth", 2.0), cabinet_shell("carcass", 2.0), worktop("top", 2.0)]
    # bay 1: two drawers over a door; bay 2: double doors
    bays = [(-0.5, 0.9), (0.5, 0.9)]
    for index, (bx, bw) in enumerate(bays):
        if index == 0:
            parts += drawer_front("drawer_a", bx, 0.72, bw, 0.14)
            parts += drawer_front("drawer_b", bx, 0.53, bw, 0.18)
            parts.append(handle("drawer_h", bx, 0.72, vertical=False))
            z_door = 0.35
            parts += door_panel("door_a", bx, z_door, bw, 0.42)
            parts.append(handle("door_h_a", bx, z_door + 0.14))
        else:
            parts += door_panel("door_b", bx - 0.23, 0.38, 0.44, 0.52)
            parts += door_panel("door_c", bx + 0.23, 0.38, 0.44, 0.52)
            parts.append(handle("door_h_b", bx - 0.04, 0.55, vertical=True))
            parts.append(handle("door_h_c", bx + 0.04, 0.55, vertical=True))
    return lib.join(parts, "kitchen_run_2m")


def kitchen_run_1m():
    parts = [plinth("plinth", 1.0), cabinet_shell("carcass", 1.0), worktop("top", 1.0)]
    parts += door_panel("door_a", -0.24, 0.38, 0.46, 0.52)
    parts += door_panel("door_b", 0.24, 0.38, 0.46, 0.52)
    parts.append(handle("h_a", -0.04, 0.55, vertical=True))
    parts.append(handle("h_b", 0.04, 0.55, vertical=True))
    return lib.join(parts, "kitchen_run_1m")


def kitchen_corner():
    parts = [
        lib.box("carcass", (DEPTH - 0.01, DEPTH - 0.01, CARCASS_H), (0, 0, PLINTH_H + CARCASS_H / 2), "paint_white", 0.003),
        lib.box("top", (DEPTH + 0.02, DEPTH + 0.02, WORKTOP), (0, 0, COUNTER_Z + WORKTOP / 2), "oak", 0.003),
        lib.box("plinth", (DEPTH - 0.06, DEPTH - 0.06, PLINTH_H), (0, 0.02, PLINTH_H / 2), "steel", 0.003),
    ]
    parts += door_panel("door", 0, 0.38, DEPTH - 0.06, 0.52, y=-DEPTH / 2 + 0.005)
    parts.append(handle("h", 0.22, 0.55, y=-DEPTH / 2 - 0.005, vertical=True))
    return lib.join(parts, "kitchen_corner")


def kitchen_upper():
    w, d, h = 1.0, 0.35, 0.70
    parts = [
        lib.box("carcass", (w - 0.01, d - 0.02, h), (0, 0, h / 2), "paint_white", 0.003),
        lib.box("shelf", (w - 0.04, d - 0.06, 0.018), (0, 0, h * 0.55), "paint_white", 0.002),
    ]
    for sx in (-0.25, 0.25):
        parts.append(lib.box("door_%d" % int(sx * 100), (0.47, 0.018, h - 0.035), (sx, -d / 2 - 0.009, h / 2), "paint_white", 0.003))
        parts.append(lib.box("panel_%d" % int(sx * 100), (0.39, 0.022, h - 0.12), (sx, -d / 2 - 0.007, h / 2), "paint_white", 0.004))
    parts.append(lib.box("h_a", (0.012, 0.018, 0.12), (-0.03, -d / 2 - 0.03, 0.2), "brass", 0.004))
    parts.append(lib.box("h_b", (0.012, 0.018, 0.12), (0.03, -d / 2 - 0.03, 0.2), "brass", 0.004))
    return lib.join(parts, "kitchen_upper")


def kitchen_sink():
    parts = [plinth("plinth", 0.8), cabinet_shell("carcass", 0.8)]
    parts += door_panel("door_a", -0.19, 0.38, 0.38, 0.52)
    parts += door_panel("door_b", 0.19, 0.38, 0.38, 0.52)
    parts.append(handle("h_a", -0.02, 0.55, vertical=True))
    parts.append(handle("h_b", 0.02, 0.55, vertical=True))
    # worktop with a steel bowl let into it
    parts.append(worktop("top_a", 0.8, 0.26))
    parts.append(lib.box("top_b", (0.8, 0.36, WORKTOP), (0, 0.13, COUNTER_Z + WORKTOP / 2), "oak", 0.003))
    parts.append(lib.box("sink_rim", (0.46, 0.38, 0.012), (-0.1, 0.02, COUNTER_Z + 0.004), "chrome", 0.004))
    parts.append(lib.box("sink_bowl", (0.42, 0.34, 0.20), (-0.1, 0.02, COUNTER_Z - 0.09), "chrome", 0.02))
    parts.append(lib.box("tap_body", (0.04, 0.04, 0.30), (-0.1, 0.2, COUNTER_Z + 0.15), "chrome", 0.012))
    parts.append(lib.box("tap_spout", (0.03, 0.18, 0.03), (-0.1, 0.12, COUNTER_Z + 0.29), "chrome", 0.01))
    parts.append(lib.box("tap_lever", (0.03, 0.10, 0.014), (-0.1, 0.23, COUNTER_Z + 0.24), "chrome", 0.006))
    return lib.join(parts, "kitchen_sink")


def hob_4burner():
    parts = [lib.box("glass", (0.60, 0.52, 0.008), (0, 0, 0.004), "glass_clear", 0.002)]
    for x in (-0.15, 0.15):
        for y in (-0.12, 0.12):
            parts.append(
                lib.torus(
                    "ring_%d_%d" % (int(x * 100), int(y * 100)),
                    0.075,
                    0.008,
                    (x, y, 0.010),
                    "cast_iron",
                    major_segments=16,
                    minor_segments=6,
                )
            )
            parts.append(lib.cyl("burner_%d_%d" % (int(x * 100), int(y * 100)), 0.035, 0.012, (x, y, 0.010), "cast_iron", 16, 0.002))
    for index, x in enumerate((-0.2, -0.07, 0.07, 0.2)):
        parts.append(lib.cyl("knob_%d" % index, 0.018, 0.02, (x, 0.24, 0.012), "steel", 14, 0.002))
    return lib.join(parts, "hob_4burner")


def oven_builtin():
    w, d, h = 0.60, 0.55, 0.60
    parts = [
        lib.box("body", (w, d, h), (0, 0, h / 2), "steel", 0.004),
        lib.box("door", (w - 0.02, 0.03, h - 0.14), (0, -d / 2 - 0.015, h / 2), "steel", 0.004),
        lib.box("window", (w - 0.14, 0.01, h - 0.26), (0, -d / 2 - 0.033, h / 2), "glass_clear", 0.002),
        lib.box("handle_bar", (w - 0.08, 0.026, 0.026), (0, -d / 2 - 0.06, h - 0.07), "steel", 0.006),
        lib.box("control", (w - 0.02, 0.02, 0.10), (0, -d / 2 - 0.012, h - 0.055), "steel", 0.003),
    ]
    for index, x in enumerate((-0.2, -0.07, 0.07, 0.2)):
        parts.append(lib.cyl("knob_%d" % index, 0.016, 0.018, (x, -d / 2 - 0.03, h - 0.055), "steel", 12, 0.002))
    return lib.join(parts, "oven_builtin")


def fridge_freezer():
    w, d, h = 0.70, 0.70, 1.85
    parts = [
        lib.box("body", (w, d, h), (0, 0, h / 2 + 0.03), "paint_white", 0.006),
        lib.box("door_top", (w - 0.006, 0.05, h * 0.60), (0, -d / 2 - 0.025, h * 0.66), "paint_white", 0.005),
        lib.box("door_bottom", (w - 0.006, 0.05, h * 0.34), (0, -d / 2 - 0.025, h * 0.18), "paint_white", 0.005),
        lib.box("gap", (w - 0.02, 0.055, 0.006), (0, -d / 2 - 0.026, h * 0.37), "steel", 0.001),
        lib.box("handle_top", (0.03, 0.04, 0.34), (w / 2 - 0.06, -d / 2 - 0.06, h * 0.66), "chrome", 0.006),
        lib.box("handle_bottom", (0.03, 0.04, 0.20), (w / 2 - 0.06, -d / 2 - 0.06, h * 0.18), "chrome", 0.006),
        lib.box("vent", (w - 0.16, 0.02, 0.06), (0, -d / 2 - 0.004, 0.22), "steel", 0.002),
    ]
    for x in (-w / 3, w / 3):
        parts.append(lib.box("foot_%d" % int(x * 10), (0.05, 0.05, 0.03), (x, d / 3, 0.015), "steel", 0.004))
    return lib.join(parts, "fridge_freezer")


def range_hood():
    parts = [
        lib.box("canopy", (0.90, 0.50, 0.12), (0, 0, 0.06), "steel", 0.006),
        lib.box("lip", (0.90, 0.06, 0.10), (0, -0.22, 0.05), "steel", 0.005),
        lib.box("chimney", (0.26, 0.26, 0.33), (0, 0.06, 0.28), "steel", 0.004),
        lib.box("filter", (0.70, 0.36, 0.01), (0, 0, 0.005), "steel", 0.001),
    ]
    for x in (-0.28, 0.28):
        parts.append(lib.cyl("lamp_%d" % int(x * 10), 0.05, 0.02, (x, -0.14, 0.012), "ceramic", 14, 0.003))
    return lib.join(parts, "range_hood")


def splashback():
    parts = [lib.box("grout", (1.0, 0.012, 0.60), (0, 0, 0.30), "tile_grout", 0.002)]
    for i in range(2):
        for j in range(2):
            parts.append(
                lib.box("tile_%d%d" % (i, j), (0.48, 0.016, 0.28), (-0.245 + i * 0.49, 0, 0.155 + j * 0.29), "tile_white", 0.003)
            )
    return lib.join(parts, "splashback")


def kettle():
    parts = [
        lib.cyl("body", 0.085, 0.20, (0, 0, 0.11), "chrome", 24, 0.006),
        lib.cyl("lid", 0.07, 0.02, (0, 0, 0.219), "chrome", 20, 0.004),
        lib.box("spout", (0.05, 0.10, 0.04), (0.075, -0.02, 0.17), "chrome", 0.008),
        lib.box("handle", (0.03, 0.02, 0.14), (-0.10, 0, 0.16), "plastic_white", 0.006),
        lib.cyl("base", 0.09, 0.02, (0, 0, 0.01), "steel", 24, 0.004),
    ]
    return lib.join(parts, "kettle")


def toaster():
    parts = [
        lib.box("body", (0.28, 0.17, 0.17), (0, 0, 0.095), "chrome", 0.02),
        lib.box("slot_a", (0.18, 0.02, 0.01), (0, -0.03, 0.181), "steel", 0.002),
        lib.box("slot_b", (0.18, 0.02, 0.01), (0, 0.03, 0.181), "steel", 0.002),
        lib.box("lever", (0.02, 0.025, 0.03), (0.145, -0.05, 0.12), "steel", 0.004),
        lib.box("tray", (0.22, 0.12, 0.012), (0, 0, 0.008), "steel", 0.003),
    ]
    return lib.join(parts, "toaster")


def microwave():
    w, d, h = 0.50, 0.35, 0.30
    parts = [
        lib.box("body", (w, d, h), (0, 0, h / 2), "paint_white", 0.005),
        lib.box("door", (w * 0.66, 0.02, h - 0.03), (-w * 0.16, -d / 2 - 0.01, h / 2), "steel", 0.004),
        lib.box("window", (w * 0.52, 0.008, h - 0.12), (-w * 0.16, -d / 2 - 0.023, h / 2), "glass_clear", 0.002),
        lib.box("panel", (w * 0.28, 0.02, h - 0.03), (w * 0.32, -d / 2 - 0.01, h / 2), "steel", 0.003),
        lib.cyl("dial", 0.022, 0.016, (w * 0.32, -d / 2 - 0.025, h * 0.45), "steel", 14, 0.002),
    ]
    for index in range(3):
        parts.append(lib.box("btn_%d" % index, (0.04, 0.012, 0.018), (w * 0.32, -d / 2 - 0.022, h * 0.7 - index * 0.03), "steel", 0.002))
    return lib.join(parts, "microwave")


def kitchen_bin():
    parts = [
        lib.cyl("body", 0.15, 0.62, (0, 0, 0.31), "steel", 28, 0.006),
        lib.cyl("lid", 0.152, 0.03, (0, 0, 0.635), "steel", 28, 0.006),
        lib.box("pedal", (0.10, 0.06, 0.02), (0, -0.15, 0.02), "steel", 0.004),
        lib.cyl("liner", 0.135, 0.02, (0, 0, 0.615), "plastic_white", 24, 0.003),
    ]
    return lib.join(parts, "kitchen_bin")


def dishwasher():
    w, d, h = 0.60, 0.60, 0.85
    parts = [
        lib.box("body", (w, d, h), (0, 0, h / 2), "steel", 0.004),
        lib.box("door", (w - 0.02, 0.03, h - 0.10), (0, -d / 2 - 0.015, h / 2 - 0.02), "steel", 0.004),
        lib.box("control", (w - 0.02, 0.02, 0.08), (0, -d / 2 - 0.035, h - 0.045), "plastic_white", 0.003),
        lib.box("handle", (w - 0.10, 0.026, 0.026), (0, -d / 2 - 0.06, h - 0.10), "steel", 0.005),
        lib.box("plinth", (w - 0.02, 0.02, 0.08), (0, -d / 2 - 0.002, 0.04), "steel", 0.002),
    ]
    for index in range(3):
        parts.append(lib.cyl("btn_%d" % index, 0.012, 0.01, (0.15 + index * 0.05, -d / 2 - 0.045, h - 0.045), "steel", 12, 0.001))
    return lib.join(parts, "dishwasher")


# ---------------------------------------------------------------- bathroom
def toilet_close_coupled():
    parts = [
        lib.box("pedestal", (0.19, 0.42, 0.30), (0, 0.03, 0.15), "ceramic", 0.03),
        lib.cyl("bowl", 0.19, 0.20, (0, -0.06, 0.36), "ceramic", 28, 0.03),
        lib.box("rim", (0.37, 0.50, 0.05), (0, -0.04, 0.475), "ceramic", 0.02),
        lib.box("seat", (0.35, 0.46, 0.025), (0, -0.04, 0.512), "plastic_white", 0.012),
        lib.box("lid", (0.34, 0.44, 0.03), (0, -0.05, 0.54), "plastic_white", 0.012),
        lib.box("cistern", (0.36, 0.20, 0.36), (0, 0.17, 0.68), "ceramic", 0.02),
        lib.cyl("button", 0.03, 0.012, (0, 0.17, 0.866), "chrome", 16, 0.003),
    ]
    return lib.join(parts, "toilet_close_coupled")


def bath_standard():
    w, d, h = 1.70, 0.75, 0.56
    parts = [
        lib.box("shell", (w, d, h), (0, 0, h / 2), "ceramic", 0.05),
        lib.box("rim", (w - 0.06, d - 0.06, 0.04), (0, 0, h + 0.005), "ceramic", 0.02),
        # inner bowl: a recess that reads as the tub cavity
        lib.box("cavity", (w - 0.14, d - 0.14, 0.34), (0, 0, h - 0.14), "ceramic", 0.04),
        lib.box("cavity_floor", (w - 0.20, d - 0.20, 0.02), (0, 0, h - 0.30), "ceramic", 0.01),
    ]
    for x in (-w / 2 + 0.12, w / 2 - 0.12):
        parts.append(lib.cyl("tap_%d" % int(x * 10), 0.022, 0.10, (x, d / 2 - 0.10, h + 0.05), "chrome", 16, 0.004))
        parts.append(lib.box("head_%d" % int(x * 10), (0.05, 0.06, 0.012), (x, d / 2 - 0.10, h + 0.10), "chrome", 0.003))
    parts.append(lib.cyl("waste", 0.035, 0.012, (0, 0, h - 0.31), "chrome", 16, 0.003))
    return lib.join(parts, "bath_standard")


def bath_panel():
    parts = [
        lib.box("panel", (1.70, 0.02, 0.52), (0, 0, 0.26), "plastic_white", 0.006),
        lib.box("clip_a", (0.06, 0.03, 0.04), (-0.75, -0.02, 0.44), "plastic_white", 0.004),
        lib.box("clip_b", (0.06, 0.03, 0.04), (0.75, -0.02, 0.44), "plastic_white", 0.004),
    ]
    return lib.join(parts, "bath_panel")


def shower_tray():
    parts = [
        lib.box("tray", (0.90, 0.90, 0.14), (0, 0, 0.07), "ceramic", 0.03),
        lib.box("recess", (0.78, 0.78, 0.02), (0, 0, 0.135), "tile_white", 0.006),
        lib.cyl("waste", 0.04, 0.01, (0, 0, 0.145), "chrome", 16, 0.002),
    ]
    for x in (-0.40, 0.40):
        for y in (-0.40, 0.40):
            parts.append(lib.cyl("foot_%d_%d" % (int(x * 10), int(y * 10)), 0.03, 0.06, (x, y, -0.03), "steel", 12, 0.003))
    return lib.join(parts, "shower_tray")


def shower_enclosure():
    w, d, h = 0.90, 0.90, 2.00
    parts = []
    # two glass walls: front and one side
    parts.append(lib.box("glass_front", (w, 0.008, h), (0, -d / 2, h / 2), "glass_clear", 0.002))
    parts.append(lib.box("glass_side", (0.008, d, h), (-w / 2, 0, h / 2), "glass_clear", 0.002))
    for x in (-w / 2, w / 2):
        parts.append(lib.box("frame_v_%d" % int(x * 100), (0.02, 0.02, h), (x, -d / 2, h / 2), "chrome", 0.004))
    parts.append(lib.box("frame_top", (w, 0.02, 0.02), (0, -d / 2, h), "chrome", 0.004))
    parts.append(lib.box("frame_side_top", (0.02, d, 0.02), (-w / 2, 0, h), "chrome", 0.004))
    parts.append(lib.box("handle", (0.02, 0.02, 0.16), (0.1, -d / 2 - 0.02, 1.05), "chrome", 0.005))
    parts.append(lib.box("hinge_a", (0.03, 0.02, 0.08), (w / 2 - 0.02, -d / 2, 1.5), "chrome", 0.004))
    parts.append(lib.box("hinge_b", (0.03, 0.02, 0.08), (w / 2 - 0.02, -d / 2, 0.6), "chrome", 0.004))
    return lib.join(parts, "shower_enclosure")


def shower_riser():
    parts = [
        lib.cyl("rail", 0.015, 1.10, (0, 0, 0.55), "chrome", 14, 0.003),
        lib.box("slider", (0.05, 0.05, 0.06), (0, 0, 0.85), "chrome", 0.006),
        lib.cyl("head", 0.11, 0.03, (0.08, 0, 1.18), "chrome", 24, 0.01),
        lib.box("arm", (0.16, 0.02, 0.02), (0.04, 0, 1.16), "chrome", 0.004),
        lib.cyl("mixer", 0.04, 0.09, (0, 0, 0.12), "chrome", 18, 0.006),
        lib.box("lever", (0.10, 0.02, 0.02), (0.03, 0, 0.16), "chrome", 0.004),
    ]
    return lib.join(parts, "shower_riser")


def vanity_unit():
    w, d, h = 0.90, 0.50, 0.85
    parts = [
        lib.box("cabinet", (w, d, h), (0, 0, h / 2), "oak", 0.006),
        lib.box("top", (w + 0.02, d + 0.02, 0.03), (0, 0, h + 0.015), "ceramic", 0.004),
        lib.box("basin", (0.46, 0.34, 0.10), (0, 0, h + 0.01), "ceramic", 0.03),
        lib.box("cavity", (0.40, 0.28, 0.02), (0, 0, h + 0.06), "tile_white", 0.004),
        lib.cyl("tap", 0.018, 0.16, (0, d / 2 - 0.08, h + 0.10), "chrome", 14, 0.003),
        lib.box("spout", (0.02, 0.10, 0.02), (0, d / 2 - 0.13, h + 0.18), "chrome", 0.003),
    ]
    for sx in (-0.22, 0.22):
        parts.append(lib.box("door_%d" % int(sx * 100), (0.42, 0.018, h - 0.12), (sx, -d / 2 - 0.01, h / 2 - 0.03), "oak", 0.004))
        parts.append(lib.box("h_%d" % int(sx * 100), (0.10, 0.016, 0.012), (sx, -d / 2 - 0.025, h / 2 + 0.06), "brass", 0.003))
    return lib.join(parts, "vanity_unit")


def mirror_cabinet():
    w, d, h = 0.60, 0.15, 0.70
    parts = [
        lib.box("body", (w, d, h), (0, 0, h / 2), "paint_white", 0.004),
        lib.box("door", (w - 0.02, 0.02, h - 0.02), (0, -d / 2 - 0.01, h / 2), "paint_white", 0.003),
        lib.box("mirror", (w - 0.06, 0.008, h - 0.06), (0, -d / 2 - 0.022, h / 2), "glass_clear", 0.002),
        lib.box("shelf", (w - 0.05, d - 0.04, 0.015), (0, 0, h * 0.45), "paint_white", 0.002),
    ]
    return lib.join(parts, "mirror_cabinet")


def towel_rail():
    parts = [
        lib.box("bar", (0.60, 0.014, 0.014), (0, 0, 0.10), "chrome", 0.004),
        lib.box("towel", (0.44, 0.02, 0.34), (0, 0.01, -0.05), "linen", 0.012),
    ]
    for x in (-0.28, 0.28):
        parts.append(lib.box("bracket_%d" % int(x * 100), (0.02, 0.09, 0.02), (x, 0.045, 0.10), "chrome", 0.004))
    return lib.join(parts, "towel_rail")


def toilet_roll_holder():
    parts = [
        lib.box("bracket", (0.03, 0.09, 0.10), (0, 0.045, 0), "chrome", 0.004),
        lib.cyl("spindle", 0.008, 0.16, (0, 0, 0.02), "chrome", 12, 0.002, rot=(0, math.pi / 2, 0)),
        lib.cyl("roll", 0.055, 0.12, (0, 0.01, 0.02), "paper", 20, 0.004, rot=(0, math.pi / 2, 0)),
    ]
    return lib.join(parts, "toilet_roll_holder")


def bath_mat():
    parts = [
        lib.box("mat", (0.70, 0.45, 0.02), (0, 0, 0.01), "linen", 0.01),
        lib.box("edge", (0.68, 0.43, 0.022), (0, 0, 0.011), "linen", 0.008),
    ]
    return lib.join(parts, "bath_mat")


# ------------------------------------------------------- laundry & heating
def washing_machine():
    w, d, h = 0.60, 0.60, 0.85
    parts = [
        lib.box("body", (w, d, h), (0, 0, h / 2), "paint_white", 0.006),
        lib.box("top", (w - 0.01, d - 0.01, 0.02), (0, 0, h + 0.005), "paint_white", 0.003),
        lib.cyl("door_ring", 0.17, 0.03, (0, -d / 2 - 0.005, 0.45), "chrome", 28, 0.006, rot=(math.pi / 2, 0, 0)),
        lib.cyl("door_glass", 0.14, 0.02, (0, -d / 2 - 0.018, 0.45), "glass_clear", 28, 0.004, rot=(math.pi / 2, 0, 0)),
        lib.box("panel", (w - 0.04, 0.02, 0.12), (0, -d / 2 - 0.005, h - 0.08), "steel", 0.003),
        lib.cyl("dial", 0.025, 0.02, (0.18, -d / 2 - 0.02, h - 0.08), "steel", 16, 0.003, rot=(math.pi / 2, 0, 0)),
        lib.box("drawer", (0.16, 0.02, 0.10), (-0.16, -d / 2 - 0.01, h - 0.08), "steel", 0.003),
    ]
    for index in range(3):
        parts.append(lib.box("btn_%d" % index, (0.03, 0.012, 0.015), (0.05 + index * 0.05, -d / 2 - 0.02, 0.24), "steel", 0.002))
    return lib.join(parts, "washing_machine")


def boiler():
    w, d, h = 0.50, 0.32, 0.80
    parts = [
        lib.box("body", (w, d, h), (0, 0, h / 2), "paint_white", 0.006),
        lib.box("panel", (w - 0.06, 0.02, h - 0.16), (0, -d / 2 - 0.008, h / 2), "paint_white", 0.004),
        lib.cyl("gauge", 0.04, 0.014, (0.12, -d / 2 - 0.02, h - 0.14), "steel", 18, 0.003, rot=(math.pi / 2, 0, 0)),
        lib.box("display", (0.16, 0.014, 0.07), (-0.09, -d / 2 - 0.018, h - 0.13), "steel", 0.003),
    ]
    for index, x in enumerate((-0.15, 0.0, 0.15)):
        parts.append(lib.cyl("pipe_%d" % index, 0.014, 0.10, (x, 0.02, -0.03), "steel", 12, 0.002))
    return lib.join(parts, "boiler")


def radiator_panel():
    w, d, h = 0.80, 0.10, 0.60
    parts = []
    for index in range(11):
        x = -w / 2 + 0.04 + index * ((w - 0.08) / 10)
        parts.append(lib.box("fin_%d" % index, (0.045, d, h - 0.06), (x, 0, h / 2 + 0.02), "paint_white", 0.008))
    parts.append(lib.box("grille", (w - 0.04, d - 0.01, 0.02), (0, 0, h), "paint_white", 0.005))
    parts.append(lib.box("bracket_a", (0.03, 0.10, 0.03), (-w / 3, 0.04, h - 0.06), "steel", 0.003))
    parts.append(lib.box("bracket_b", (0.03, 0.10, 0.03), (w / 3, 0.04, h - 0.06), "steel", 0.003))
    parts.append(lib.cyl("valve", 0.03, 0.06, (w / 2 + 0.01, 0, 0.10), "brass", 16, 0.004))
    return lib.join(parts, "radiator_panel")


BUILDERS = {
    "kitchen_run_2m": kitchen_run_2m,
    "kitchen_run_1m": kitchen_run_1m,
    "kitchen_corner": kitchen_corner,
    "kitchen_upper": kitchen_upper,
    "kitchen_sink": kitchen_sink,
    "hob_4burner": hob_4burner,
    "oven_builtin": oven_builtin,
    "fridge_freezer": fridge_freezer,
    "range_hood": range_hood,
    "splashback": splashback,
    "kettle": kettle,
    "toaster": toaster,
    "microwave": microwave,
    "kitchen_bin": kitchen_bin,
    "dishwasher": dishwasher,
    "toilet_close_coupled": toilet_close_coupled,
    "bath_standard": bath_standard,
    "bath_panel": bath_panel,
    "shower_tray": shower_tray,
    "shower_enclosure": shower_enclosure,
    "shower_riser": shower_riser,
    "vanity_unit": vanity_unit,
    "mirror_cabinet": mirror_cabinet,
    "towel_rail": towel_rail,
    "toilet_roll_holder": toilet_roll_holder,
    "bath_mat": bath_mat,
    "washing_machine": washing_machine,
    "boiler": boiler,
    "radiator_panel": radiator_panel,
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
        except Exception as error:
            failures.append("%s: %s" % (name, error))
    lib.report(GROUP)
    if failures:
        print("\nFAILURES:")
        for failure in failures:
            print("  " + failure)
        sys.exit(1)


main()
