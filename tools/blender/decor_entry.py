"""Phase 3, §7.5 — bathroom and entrance dressing."""

import math

import lib
from decor_common import ball, bar, cone, lathe, slab, turn


def towel_folded():
    parts = [
        slab("layer_a", (0.38, 0.29, 0.085), (0, 0, 0.043), "linen", 0.022, 3),
        slab("layer_b", (0.375, 0.285, 0.08), (0, 0.005, 0.122), "paper", 0.022, 3),
        slab("layer_c", (0.36, 0.28, 0.075), (0, 0, 0.198), "linen", 0.022, 3),
        slab("fold_a", (0.02, 0.29, 0.08), (-0.18, 0, 0.19), "paper", 0.004),
        slab("fold_b", (0.02, 0.285, 0.08), (0.17, 0.005, 0.115), "linen", 0.004),
    ]
    return lib.join(parts, "towel_folded")


def towel_hanging():
    parts = [
        slab("drape", (0.44, 0.055, 0.68), (0, 0, 0.35), "linen", 0.012, 3),
        slab("fold_top", (0.44, 0.11, 0.055), (0, 0.01, 0.655), "linen", 0.02, 3),
        slab("hem", (0.44, 0.058, 0.03), (0, 0, 0.015), "paper", 0.008),
        bar("stripe", 0.44, (0, -0.030, 0.50), "paper", 0.006, axis="x"),
    ]
    for index in range(3):
        parts.append(slab("fold_%d" % index, (0.44, 0.012, 0.006), (0, -0.026, 0.15 + index * 0.16), "paper", 0.002))
    return lib.join(parts, "towel_hanging")


def shampoo_bottle():
    parts = [
        lathe("body", [(0.034, 0.0), (0.036, 0.006), (0.034, 0.145), (0.020, 0.175), (0.018, 0.185)], "plastic_white", 18, bevel=0.002),
        lib.cyl("cap", 0.019, 0.026, (0, 0, 0.198), "steel", 14, 0.003),
        slab("label", (0.045, 0.004, 0.075), (0, -0.035, 0.085), "paper", 0.001),
    ]
    return lib.join(parts, "shampoo_bottle")


def conditioner_bottle():
    parts = [
        lathe("body", [(0.040, 0.0), (0.042, 0.006), (0.040, 0.17), (0.022, 0.196), (0.020, 0.205)], "ceramic", 18, bevel=0.002),
        lib.cyl("cap", 0.021, 0.028, (0, 0, 0.218), "plastic_white", 14, 0.003),
        slab("label", (0.052, 0.004, 0.085), (0, -0.040, 0.095), "paint_cream", 0.001),
    ]
    return lib.join(parts, "conditioner_bottle")


def soap_bar():
    parts = [
        slab("bar", (0.09, 0.05, 0.028), (0, 0, 0.014), "paint_cream", 0.012, 3),
        slab("stamp", (0.05, 0.026, 0.004), (0, 0, 0.03), "linen", 0.002),
        slab("dish", (0.11, 0.07, 0.006), (0, 0, 0.003), "ceramic", 0.002),
    ]
    return lib.join(parts, "soap_bar")


def bath_toy():
    parts = [
        ball("body", 0.045, (0, 0, 0.042), "fruit_orange", (1.25, 1, 1), 12, 8),
        ball("head", 0.028, (0.045, 0, 0.085), "fruit_orange", (1, 1, 1), 10, 8),
        cone("beak", 0.016, 0.004, 0.03, (0.075, 0, 0.084), "fruit_red", 8, rot=(0, math.pi / 2, 0)),
        ball("eye_a", 0.005, (0.058, 0.018, 0.098), "rubber", (1, 1, 1), 6, 4),
        ball("eye_b", 0.005, (0.058, -0.018, 0.098), "rubber", (1, 1, 1), 6, 4),
        ball("tail", 0.014, (-0.055, 0, 0.048), "fruit_orange", (1, 1, 1.4), 8, 6),
    ]
    return lib.join(parts, "bath_toy")


def scale_bathroom():
    parts = [
        slab("body", (0.30, 0.30, 0.042), (0, 0, 0.021), "plastic_white", 0.012, 3),
        slab("platform", (0.26, 0.26, 0.006), (0, 0, 0.045), "steel", 0.003),
        lib.cyl("dial", 0.045, 0.01, (0, -0.10, 0.044), "glass_clear", 18, 0.003),
        lib.cyl("needle", 0.004, 0.03, (0, -0.10, 0.05), "rubber", 6, 0.0, rot=(math.pi / 2, 0, 0)),
    ]
    return lib.join(parts, "scale_bathroom")


def umbrella_stand():
    parts = [
        lathe("stand", [(0.115, 0.0), (0.125, 0.02), (0.125, 0.45), (0.128, 0.5), (0.12, 0.5)], "brass", 16, bevel=0.0),
        lib.torus("rim", 0.122, 0.008, (0, 0, 0.50), "brass", major_segments=20, minor_segments=6),
    ]
    for index, (x, y, tilt) in enumerate(((-0.05, 0.02, 0.12), (0.04, -0.03, -0.09), (0.0, 0.05, 0.04))):
        parts.append(turn(lib.cyl("shaft_%d" % index, 0.009, 0.62, (x, y, 0.62), "walnut", 8, 0.0), rx=tilt))
        parts.append(turn(cone("canopy_%d" % index, 0.055, 0.012, 0.09, (x - 0.03, y, 0.42), "fabric_olive", 10), rx=tilt))
        parts.append(turn(lib.torus("handle_%d" % index, 0.024, 0.008, (x + 0.02, y, 0.93), "walnut", major_segments=10, minor_segments=5), rx=math.pi / 2))
    return lib.join(parts, "umbrella_stand")


def coat_hooks():
    parts = [
        slab("rail", (0.60, 0.02, 0.09), (0, 0, 0.165), "oak_dark", 0.004),
        slab("back", (0.60, 0.012, 0.02), (0, 0.01, 0.21), "oak_dark", 0.003),
    ]
    for index in range(4):
        x = -0.21 + index * 0.14
        parts.append(lib.cyl("hook_%d" % index, 0.009, 0.075, (x, -0.028, 0.15), "brass", 8, 0.002, rot=(math.pi / 2, 0, 0)))
        parts.append(ball("knob_%d" % index, 0.014, (x, -0.066, 0.148), "brass", (1, 1, 1), 6, 4))
    return lib.join(parts, "coat_hooks")


def doormat():
    parts = [slab("base", (0.75, 0.45, 0.018), (0, 0, 0.009), "concrete", 0.008)]
    for index in range(7):
        parts.append(slab("ridge_%d" % index, (0.73, 0.036, 0.008), (0, -0.16 + index * 0.053, 0.02), "concrete", 0.004))
    parts.append(slab("border_a", (0.75, 0.02, 0.02), (0, -0.215, 0.01), "concrete", 0.003))
    parts.append(slab("border_b", (0.75, 0.02, 0.02), (0, 0.215, 0.01), "concrete", 0.003))
    return lib.join(parts, "doormat")


def keys_tray():
    parts = [
        slab("tray", (0.20, 0.15, 0.006), (0, 0, 0.003), "walnut", 0.003),
        slab("rim_a", (0.20, 0.012, 0.022), (0, 0.069, 0.011), "walnut", 0.003),
        slab("rim_b", (0.20, 0.012, 0.022), (0, -0.069, 0.011), "walnut", 0.003),
        slab("rim_c", (0.012, 0.15, 0.022), (-0.094, 0, 0.011), "walnut", 0.003),
        slab("rim_d", (0.012, 0.15, 0.022), (0.094, 0, 0.011), "walnut", 0.003),
    ]
    for index, (x, y, angle) in enumerate(((-0.04, 0.0, 0.2), (0.02, 0.02, -0.4), (0.05, -0.02, 0.7))):
        parts.append(turn(slab("key_%d" % index, (0.075, 0.012, 0.004), (x, y, 0.008), "brass", 0.002), rz=angle))
        parts.append(turn(lib.torus("ring_%d" % index, 0.014, 0.0035, (x - 0.048, y, 0.009), "brass", rot=(math.pi / 2, 0, 0), major_segments=12, minor_segments=5), rz=angle))
    return lib.join(parts, "keys_tray")


def shoe_rack():
    parts = [
        slab("shelf_top", (0.80, 0.30, 0.02), (0, 0, 0.30), "steel", 0.004),
        slab("shelf_bottom", (0.80, 0.30, 0.02), (0, 0, 0.05), "steel", 0.004),
        bar("post_a", 0.30, (-0.38, 0.13, 0.15), "steel", 0.010, axis="z"),
        bar("post_b", 0.30, (0.38, 0.13, 0.15), "steel", 0.010, axis="z"),
        slab("back", (0.80, 0.014, 0.30), (0, 0.145, 0.17), "steel", 0.003),
    ]
    for index, (row, z) in enumerate(((0, 0.06), (1, 0.31))):
        for shoe in range(2):
            x = -0.34 + shoe * 0.22
            parts.append(slab("shoe_%d_%d" % (row, shoe), (0.19, 0.10, 0.07), (x, 0.02, z + 0.045), "walnut" if shoe % 2 else "rubber", 0.014, 2))
            parts.append(slab("shoe_%d_%d_toe" % (row, shoe), (0.19, 0.05, 0.04), (x, -0.055, z + 0.03), "walnut" if shoe % 2 else "rubber", 0.01, 2))
    return lib.join(parts, "shoe_rack")


def coat_jacket():
    parts = [
        slab("body", (0.42, 0.14, 0.66), (0, 0, 0.34), "fabric_olive", 0.02, 2),
        slab("shoulder", (0.48, 0.15, 0.10), (0, 0, 0.72), "fabric_olive", 0.022, 2),
        slab("collar", (0.20, 0.10, 0.06), (0, -0.01, 0.80), "fabric_olive", 0.016, 2),
        slab("zip", (0.012, 0.008, 0.62), (0, -0.075, 0.36), "steel", 0.002),
        slab("hem", (0.42, 0.145, 0.05), (0, 0, 0.03), "fabric_olive", 0.012, 2),
    ]
    for index, x in enumerate((-0.25, 0.25)):
        parts.append(turn(slab("sleeve_%d" % index, (0.115, 0.125, 0.52), (x, 0, 0.44), "fabric_olive", 0.02, 2), ry=(0.07 if index else -0.07)))
        parts.append(slab("cuff_%d" % index, (0.115, 0.13, 0.05), (x, 0, 0.20), "fabric_olive", 0.012, 2))
    for index in range(2):
        parts.append(slab("pocket_%d" % index, (0.11, 0.008, 0.09), (-0.13 + index * 0.26, -0.074, 0.34), "fabric_olive", 0.004))
    parts.append(turn(lib.torus("hanger_hook", 0.028, 0.006, (0, 0.0, 0.83), "steel", major_segments=12, minor_segments=5), rx=math.pi / 2))
    return lib.join(parts, "coat_jacket")


def mail_pile():
    parts = []
    for index in range(6):
        parts.append(
            turn(
                slab(
                    "envelope_%d" % index,
                    (0.19, 0.115, 0.006),
                    ((index % 3 - 1) * 0.012, (index % 2) * 0.01, 0.004 + index * 0.007),
                    "paper" if index % 2 else "paint_cream",
                    0.001,
                ),
                rz=(index % 4 - 1.5) * 0.12,
            )
        )
    return lib.join(parts, "mail_pile")


def shopping_bag():
    parts = [
        slab("bottom", (0.28, 0.18, 0.012), (0, 0, 0.006), "paper", 0.004),
        slab("front", (0.28, 0.008, 0.33), (0, -0.086, 0.17), "paper", 0.004),
        slab("back", (0.28, 0.008, 0.33), (0, 0.086, 0.17), "paper", 0.004),
        slab("side_a", (0.008, 0.18, 0.33), (-0.136, 0, 0.17), "paper", 0.004),
        slab("side_b", (0.008, 0.18, 0.33), (0.136, 0, 0.17), "paper", 0.004),
        slab("content_a", (0.24, 0.15, 0.16), (0, 0, 0.10), "paint_cream", 0.02, 3),
        slab("content_b", (0.18, 0.12, 0.10), (0.01, 0, 0.24), "fruit_orange", 0.02, 3),
    ]
    for index, x in enumerate((-0.08, 0.08)):
        parts.append(turn(lib.torus("handle_%d" % index, 0.05, 0.006, (x, 0, 0.40), "paper", major_segments=12, minor_segments=5), rx=math.pi / 2))
    return lib.join(parts, "shopping_bag")


BUILDERS = {
    "towel_folded": towel_folded,
    "towel_hanging": towel_hanging,
    "shampoo_bottle": shampoo_bottle,
    "conditioner_bottle": conditioner_bottle,
    "soap_bar": soap_bar,
    "bath_toy": bath_toy,
    "scale_bathroom": scale_bathroom,
    "umbrella_stand": umbrella_stand,
    "coat_hooks": coat_hooks,
    "doormat": doormat,
    "keys_tray": keys_tray,
    "shoe_rack": shoe_rack,
    "coat_jacket": coat_jacket,
    "mail_pile": mail_pile,
    "shopping_bag": shopping_bag,
}
