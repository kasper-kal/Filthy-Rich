"""Phase 3, §7.4 — study."""

import math

import lib
from decor_common import ball, bar, lathe, slab, turn


def laptop():
    parts = [
        slab("base", (0.34, 0.24, 0.018), (0, 0, 0.009), "steel", 0.005),
        slab("keyboard", (0.30, 0.13, 0.002), (0, -0.045, 0.019), "rubber", 0.001),
        slab("trackpad", (0.10, 0.07, 0.002), (0, 0.075, 0.019), "chrome", 0.001),
    ]
    lid = slab("lid", (0.34, 0.008, 0.22), (0, 0.118, 0.20), "steel", 0.005)
    lid.rotation_euler.x = math.radians(-14)
    bpy_apply(lid)
    parts.append(slab("screen", (0.31, 0.004, 0.19), (0, 0.108, 0.20), "glass_clear", 0.002))
    parts.append(lid)
    for row in range(5):
        parts.append(slab("keys_%d" % row, (0.29, 0.015, 0.004), (0, -0.095 + row * 0.024, 0.021), "plastic_white", 0.002))
    return lib.join(parts, "laptop")


def bpy_apply(obj):
    import bpy

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)


def monitor():
    parts = [
        slab("panel", (0.55, 0.03, 0.34), (0, 0, 0.30), "rubber", 0.006),
        slab("screen", (0.51, 0.006, 0.30), (0, -0.018, 0.30), "glass_clear", 0.002),
        slab("neck", (0.05, 0.04, 0.14), (0, 0.02, 0.12), "rubber", 0.004),
        slab("base", (0.22, 0.16, 0.014), (0, 0.03, 0.007), "rubber", 0.005),
        slab("brand", (0.06, 0.004, 0.012), (0, -0.02, 0.14), "steel", 0.001),
    ]
    return lib.join(parts, "monitor")


def keyboard():
    parts = [
        slab("base", (0.44, 0.14, 0.018), (0, 0, 0.009), "rubber", 0.005),
        slab("deck", (0.42, 0.12, 0.004), (0, 0, 0.019), "plastic_white", 0.002),
    ]
    for row in range(5):
        parts.append(slab("row_%d" % row, (0.40, 0.018, 0.006), (0, -0.048 + row * 0.023, 0.024), "paint_white", 0.002))
    parts.append(slab("space", (0.22, 0.016, 0.006), (0, 0.052, 0.024), "paint_white", 0.002))
    return lib.join(parts, "keyboard")


def mouse():
    parts = [
        ball("shell", 0.05, (0, 0, 0.016), "rubber", (1.1, 1.35, 0.65), 12, 8),
        lib.cyl("wheel", 0.008, 0.012, (0, -0.035, 0.032), "steel", 10, 0.002, rot=(math.pi / 2, 0, 0)),
        slab("cable", (0.012, 0.10, 0.012), (0, 0.075, 0.008), "rubber", 0.003),
    ]
    return lib.join(parts, "mouse")


def desk_lamp():
    parts = [
        lib.cyl("base", 0.07, 0.022, (0, 0, 0.011), "steel", 18, 0.004),
        turn(slab("arm_lower", (0.02, 0.02, 0.24), (0, 0.02, 0.14), "steel", 0.006), rx=0.22),
        lib.cyl("joint", 0.016, 0.026, (0, 0.05, 0.255), "chrome", 10, 0.002, rot=(0, math.pi / 2, 0)),
        turn(slab("arm_upper", (0.018, 0.018, 0.20), (0, -0.02, 0.35), "steel", 0.006), rx=-0.42),
        turn(lib.cyl("shade", 0.062, 0.10, (0, -0.09, 0.44), "paint_cream", 18, 0.006), rx=0.5),
        ball("bulb", 0.028, (0, -0.09, 0.40), "paper", (1, 1, 1), 10, 6),
        slab("switch", (0.03, 0.03, 0.012), (0, -0.02, 0.026), "chrome", 0.003),
    ]
    return lib.join(parts, "desk_lamp")


def paper_stack():
    parts = []
    for index in range(12):
        parts.append(
            turn(
                slab(
                    "sheet_%d" % index,
                    (0.21, 0.29, 0.004),
                    ((index % 3) * 0.002 - 0.002, (index % 4) * 0.002 - 0.003, 0.003 + index * 0.005),
                    "paper",
                    0.001,
                ),
                rz=(index % 5 - 2) * 0.02,
            )
        )
    parts.append(slab("top_sheet", (0.205, 0.285, 0.002), (0, 0, 0.062), "paint_cream", 0.001))
    return lib.join(parts, "paper_stack")


def pen_cup():
    parts = [
        lathe("cup", [(0.038, 0.0), (0.040, 0.006), (0.040, 0.10), (0.042, 0.11)], "ceramic", 18, bevel=0.002),
    ]
    for index in range(6):
        angle = index * 1.05
        parts.append(
            turn(
                lib.cyl("pen_%d" % index, 0.004, 0.15, (0.012 * math.cos(angle), 0.012 * math.sin(angle), 0.15), "plastic_white" if index % 2 else "oak_dark", 6, 0.0),
                rx=0.12 * math.cos(angle),
                ry=0.12 * math.sin(angle),
            )
        )
        parts.append(
            turn(
                lib.cyl("tip_%d" % index, 0.004, 0.02, (0.020 * math.cos(angle), 0.020 * math.sin(angle), 0.215), "brass", 6, 0.0),
                rx=0.12 * math.cos(angle),
                ry=0.12 * math.sin(angle),
            )
        )
    return lib.join(parts, "pen_cup")


def notebook_open():
    parts = [
        turn(slab("page_left", (0.10, 0.29, 0.008), (-0.052, 0, 0.006), "paper", 0.002), ry=0.06),
        turn(slab("page_right", (0.10, 0.29, 0.008), (0.052, 0, 0.006), "paper", 0.002), ry=-0.06),
        slab("spine", (0.02, 0.29, 0.004), (0, 0, 0.002), "rubber", 0.004),
        slab("cover", (0.21, 0.30, 0.004), (0, 0, 0.001), "fabric_rust", 0.002),
    ]
    for index in range(6):
        parts.append(slab("rule_%d" % index, (0.19, 0.002, 0.001), (0, 0.10 - index * 0.035, 0.011), "linen", 0.0005))
    return lib.join(parts, "notebook_open")


def cork_board():
    parts = [
        slab("board", (0.60, 0.014, 0.45), (0, 0, 0.225), "oak_light", 0.004),
        slab("frame_top", (0.62, 0.022, 0.02), (0, -0.002, 0.44), "oak_dark", 0.004),
        slab("frame_bottom", (0.62, 0.022, 0.02), (0, -0.002, 0.01), "oak_dark", 0.004),
        slab("frame_left", (0.02, 0.022, 0.47), (-0.29, -0.002, 0.225), "oak_dark", 0.004),
        slab("frame_right", (0.02, 0.022, 0.47), (0.29, -0.002, 0.225), "oak_dark", 0.004),
    ]
    notes = [(-0.16, 0.30, 0.0), (0.02, 0.28, 0.1), (0.17, 0.30, -0.12), (-0.13, 0.15, -0.08), (0.05, 0.13, 0.06), (0.18, 0.14, 0.02)]
    for index, (x, z, angle) in enumerate(notes):
        parts.append(
            turn(
                slab("note_%d" % index, (0.11, 0.004, 0.09), (x, -0.012, z), "paper" if index % 2 else "paint_cream", 0.001),
                rz=angle,
            )
        )
        parts.append(lib.cyl("pin_%d" % index, 0.006, 0.012, (x, -0.016, z + 0.03), "fruit_red", 6, 0.0, rot=(math.pi / 2, 0, 0)))
    return lib.join(parts, "cork_board")


def shelf_bracket():
    parts = [
        slab("back", (0.02, 0.015, 0.20), (0, 0.075, 0.10), "steel", 0.003),
        slab("arm", (0.02, 0.17, 0.014), (0, 0, 0.007), "steel", 0.003),
        slab("brace", (0.018, 0.11, 0.014), (0, 0.03, 0.045), "steel", 0.003),
        lib.cyl("screw_a", 0.005, 0.008, (0, 0.084, 0.16), "chrome", 8, 0.001, rot=(math.pi / 2, 0, 0)),
        lib.cyl("screw_b", 0.005, 0.008, (0, 0.084, 0.04), "chrome", 8, 0.001, rot=(math.pi / 2, 0, 0)),
    ]
    return lib.join(parts, "shelf_bracket")


def floor_fan():
    parts = [
        lib.cyl("base", 0.16, 0.028, (0, 0, 0.014), "plastic_white", 22, 0.006),
        lib.cyl("pole", 0.016, 0.26, (0, 0, 0.15), "chrome", 10, 0.002),
        lib.cyl("motor", 0.045, 0.09, (0, 0.02, 0.31), "plastic_white", 16, 0.006, rot=(math.pi / 2, 0, 0)),
        lib.torus("cage", 0.155, 0.005, (0, -0.02, 0.31), "chrome", rot=(math.pi / 2, 0, 0), major_segments=16, minor_segments=4),
        lib.torus("cage_inner", 0.095, 0.004, (0, -0.035, 0.31), "chrome", rot=(math.pi / 2, 0, 0), major_segments=12, minor_segments=3),
        lib.torus("cage_hub", 0.030, 0.004, (0, -0.045, 0.31), "chrome", rot=(math.pi / 2, 0, 0), major_segments=8, minor_segments=3),
    ]
    for index in range(3):
        angle = index * (2 * math.pi / 3)
        parts.append(
            turn(
                slab("blade_%d" % index, (0.10, 0.008, 0.045), (0.06 * math.cos(angle), -0.06, 0.31 + 0.06 * math.sin(angle)), "plastic_white", 0.008, 2),
                ry=angle,
            )
        )
    for index in range(3):
        angle = index * (2 * math.pi / 3) + 0.5
        parts.append(
            turn(
                slab("wire_%d" % index, (0.004, 0.14, 0.004), (0.075 * math.cos(angle), -0.075, 0.31 + 0.075 * math.sin(angle)), "chrome", 0.001),
                ry=angle,
            )
        )
    return lib.join(parts, "floor_fan")


def trash_bin_office():
    parts = [
        lathe("body", [(0.10, 0.0), (0.115, 0.02), (0.125, 0.34), (0.128, 0.35)], "steel", 20, bevel=0.003),
        lib.torus("rim", 0.126, 0.005, (0, 0, 0.35), "steel", major_segments=20, minor_segments=5),
        lathe("liner", [(0.118, 0.30), (0.128, 0.34), (0.118, 0.355)], "plastic_white", 18),
        slab("pedal", (0.06, 0.05, 0.012), (0, -0.128, 0.012), "steel", 0.003),
    ]
    return lib.join(parts, "trash_bin_office")


BUILDERS = {
    "laptop": laptop,
    "monitor": monitor,
    "keyboard": keyboard,
    "mouse": mouse,
    "desk_lamp": desk_lamp,
    "paper_stack": paper_stack,
    "pen_cup": pen_cup,
    "notebook_open": notebook_open,
    "cork_board": cork_board,
    "shelf_bracket": shelf_bracket,
    "floor_fan": floor_fan,
    "trash_bin_office": trash_bin_office,
}
