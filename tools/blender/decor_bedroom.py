"""Phase 3, §7.3 — bedrooms."""

import math

import lib
from decor_common import ball, bar, cloth, lathe, slab, turn


def duvet_folded():
    parts = [
        cloth("layer_a", 1.55, 0.36, "linen", folds=2, amplitude=0.018, thickness=0.075, resolution=6, loc=(0, -0.01, 0.045)),
        cloth("layer_b", 1.50, 0.34, "paper", folds=2, amplitude=0.016, thickness=0.07, resolution=6, loc=(0.01, 0, 0.115)),
        cloth("layer_c", 1.42, 0.32, "linen", folds=2, amplitude=0.014, thickness=0.065, resolution=6, loc=(0, 0.01, 0.18)),
        slab("fold_edge_a", (0.02, 0.36, 0.075), (-0.72, 0, 0.04), "paper", 0.004),
        slab("fold_edge_b", (0.02, 0.34, 0.07), (0.72, 0, 0.11), "linen", 0.004),
    ]
    return lib.join(parts, "duvet_folded")


def pillow():
    parts = [
        slab("body", (0.64, 0.15, 0.39), (0, 0, 0.078), "paper", 0.058, 3),
        slab("crease_a", (0.02, 0.15, 0.34), (-0.12, 0, 0.075), "linen", 0.008),
        slab("crease_b", (0.02, 0.15, 0.34), (0.12, 0, 0.075), "linen", 0.008),
        slab("seam", (0.62, 0.152, 0.004), (0, 0, 0.02), "linen", 0.002),
    ]
    return lib.join(parts, "pillow")


def bedside_books():
    parts = []
    colours = ["fabric_rust", "oak_dark", "fabric_olive"]
    for index in range(3):
        parts.append(
            turn(
                slab(
                    "book_%d" % index,
                    (0.17 - index * 0.008, 0.13, 0.025),
                    ((index % 2) * 0.01 - 0.005, 0, 0.013 + index * 0.025),
                    colours[index],
                    0.004,
                ),
                rz=(index - 1) * 0.09,
            )
        )
    return lib.join(parts, "bedside_books")


def glasses_specs():
    parts = [
        lib.torus("lens_a", 0.021, 0.0035, (-0.029, 0, 0.024), "chrome", rot=(math.pi / 2, 0, 0), major_segments=14, minor_segments=5),
        lib.torus("lens_b", 0.021, 0.0035, (0.029, 0, 0.024), "chrome", rot=(math.pi / 2, 0, 0), major_segments=14, minor_segments=5),
        slab("bridge", (0.018, 0.004, 0.004), (0, 0, 0.03), "chrome", 0.001),
        turn(slab("arm_a", (0.003, 0.055, 0.004), (-0.046, 0.028, 0.028), "chrome", 0.001), rz=0.12),
        turn(slab("arm_b", (0.003, 0.055, 0.004), (0.046, 0.028, 0.028), "chrome", 0.001), rz=-0.12),
        slab("lens_glass_a", (0.036, 0.036, 0.002), (-0.029, 0, 0.024), "glass_clear", 0.001),
        slab("lens_glass_b", (0.036, 0.036, 0.002), (0.029, 0, 0.024), "glass_clear", 0.001),
    ]
    return lib.join(parts, "glasses_specs")


def alarm_clock():
    parts = [
        slab("body", (0.14, 0.075, 0.062), (0, 0, 0.032), "rubber", 0.014, 3),
        slab("face", (0.105, 0.008, 0.038), (0, -0.038, 0.034), "glass_clear", 0.002),
        slab("digits", (0.082, 0.004, 0.024), (0, -0.043, 0.034), "fruit_red", 0.001),
        slab("btn_a", (0.018, 0.016, 0.012), (-0.045, 0.02, 0.068), "steel", 0.003),
        slab("btn_b", (0.018, 0.016, 0.012), (0, 0.02, 0.068), "steel", 0.003),
        slab("btn_c", (0.018, 0.016, 0.012), (0.045, 0.02, 0.068), "steel", 0.003),
    ]
    return lib.join(parts, "alarm_clock")


def phone_mobile():
    parts = [
        slab("body", (0.072, 0.148, 0.008), (0, 0, 0.005), "rubber", 0.006),
        slab("screen", (0.064, 0.134, 0.002), (0, 0, 0.010), "glass_clear", 0.002),
        lib.cyl("camera", 0.005, 0.002, (-0.022, -0.062, 0.011), "steel", 8),
        slab("button", (0.012, 0.004, 0.001), (0, 0.002, 0.011), "steel", 0.001),
    ]
    return lib.join(parts, "phone_mobile")


def charger_cable():
    parts = [
        slab("brick", (0.05, 0.05, 0.03), (0, 0, 0.015), "plastic_white", 0.006),
        slab("plug_pin_a", (0.006, 0.014, 0.018), (-0.01, -0.026, 0.015), "steel", 0.001),
        slab("plug_pin_b", (0.006, 0.014, 0.018), (0.01, -0.026, 0.015), "steel", 0.001),
        slab("connector", (0.012, 0.03, 0.006), (0.72, -0.05, 0.004), "steel", 0.002),
    ]
    for index in range(9):
        t = index / 8.0
        x = 0.04 + t * 0.68
        y = -0.03 + 0.05 * math.sin(t * math.pi * 1.6)
        parts.append(slab("lead_%d" % index, (0.085, 0.006, 0.005), (x, y, 0.003), "rubber", 0.001))
    return lib.join(parts, "charger_cable")


def laundry_pile():
    parts = []
    colours = ["linen", "paint_cream", "fabric_olive", "paper", "fabric_rust", "linen", "plastic_white"]
    for index in range(7):
        parts.append(
            turn(
                slab(
                    "garment_%d" % index,
                    (0.26 + (index % 3) * 0.05, 0.20 + (index % 2) * 0.05, 0.07),
                    ((index % 3 - 1) * 0.05, (index % 2 - 0.5) * 0.05, 0.036 + (index // 3) * 0.06),
                    colours[index],
                    0.02,
                    2,
                ),
                rz=index * 0.7,
            )
        )
    return lib.join(parts, "laundry_pile")


def shoe_pair():
    parts = []
    for index, x in enumerate((-0.062, 0.062)):
        parts.append(slab("sole_%d" % index, (0.10, 0.26, 0.022), (x, 0, 0.011), "rubber", 0.006))
        parts.append(slab("upper_%d" % index, (0.096, 0.20, 0.055), (x, 0.015, 0.05), "walnut", 0.01, 2))
        parts.append(slab("toe_%d" % index, (0.09, 0.075, 0.03), (x, -0.09, 0.04), "walnut", 0.008, 2))
        parts.append(slab("heel_%d" % index, (0.09, 0.05, 0.04), (x, 0.10, 0.05), "walnut", 0.008, 2))
        for lace in range(3):
            parts.append(slab("lace_%d_%d" % (index, lace), (0.05, 0.004, 0.004), (x, -0.02 + lace * 0.022, 0.078), "paper", 0.001))
    return lib.join(parts, "shoe_pair")


def coat_hanger():
    parts = [
        bar("bar", 0.40, (0, 0, 0.012), "steel", 0.007, axis="x"),
        turn(bar("shoulder_a", 0.23, (-0.10, 0, 0.055), "steel", 0.007, axis="x"), ry=-0.42),
        turn(bar("shoulder_b", 0.23, (0.10, 0, 0.055), "steel", 0.007, axis="x"), ry=0.42),
        bar("neck", 0.05, (0, 0, 0.10), "steel", 0.006, axis="z"),
        turn(lib.torus("hook", 0.014, 0.005, (0, 0.008, 0.135), "steel", major_segments=12, minor_segments=5), rx=math.pi / 2),
    ]
    return lib.join(parts, "coat_hanger")


def clothes_rail():
    parts = [
        lib.cyl("post_a", 0.014, 1.42, (-0.48, 0, 0.71), "chrome", 10, 0.002),
        lib.cyl("post_b", 0.014, 1.42, (0.48, 0, 0.71), "chrome", 10, 0.002),
        bar("rail", 0.98, (0, 0, 1.38), "chrome", 0.012, axis="x"),
        bar("brace", 0.96, (0, 0, 0.20), "chrome", 0.010, axis="x"),
        slab("foot_a", (0.05, 0.34, 0.02), (-0.48, 0, 0.01), "chrome", 0.004),
        slab("foot_b", (0.05, 0.34, 0.02), (0.48, 0, 0.01), "chrome", 0.004),
    ]
    for index in range(5):
        x = -0.32 + index * 0.16
        parts.append(bar("hanger_%d" % index, 0.38, (x, 0, 1.33), "steel", 0.006, axis="x"))
        parts.append(lib.cyl("hanger_hook_%d" % index, 0.006, 0.05, (x, 0, 1.375), "steel", 8, 0.0))
    for index, colour in enumerate(("linen", "fabric_rust", "fabric_olive")):
        x = -0.24 + index * 0.24
        parts.append(slab("garment_%d" % index, (0.20, 0.06, 0.62), (x, 0, 0.98), colour, 0.012, 2))
    return lib.join(parts, "clothes_rail")


def suitcase():
    parts = [
        slab("shell", (0.52, 0.22, 0.33), (0, 0, 0.19), "oak_dark", 0.03, 3),
        slab("lid", (0.52, 0.02, 0.28), (0, -0.10, 0.19), "walnut", 0.01),
        slab("strap_a", (0.04, 0.24, 0.20), (-0.14, 0, 0.19), "rubber", 0.004),
        slab("strap_b", (0.04, 0.24, 0.20), (0.14, 0, 0.19), "rubber", 0.004),
        slab("handle_base", (0.14, 0.03, 0.03), (0, 0, 0.37), "rubber", 0.006),
        turn(lib.torus("handle", 0.045, 0.009, (0, 0, 0.40), "rubber", major_segments=14, minor_segments=5), rx=math.pi / 2),
        lib.cyl("wheel_a", 0.028, 0.02, (-0.19, 0.10, 0.028), "rubber", 12, 0.003, rot=(0, math.pi / 2, 0)),
        lib.cyl("wheel_b", 0.028, 0.02, (0.19, 0.10, 0.028), "rubber", 12, 0.003, rot=(0, math.pi / 2, 0)),
        slab("foot_a", (0.03, 0.03, 0.03), (-0.19, -0.09, 0.015), "rubber", 0.004),
        slab("foot_b", (0.03, 0.03, 0.03), (0.19, -0.09, 0.015), "rubber", 0.004),
    ]
    return lib.join(parts, "suitcase")


def toy_block_set():
    parts = []
    colours = ["fruit_red", "fruit_orange", "fabric_olive", "paint_cream", "oak_light", "fabric_rust", "ceramic", "paper", "brass"]
    layout = [(-0.09, -0.09), (0.0, -0.085), (0.09, -0.09), (-0.045, 0.0), (0.05, 0.01), (-0.06, 0.09), (0.06, 0.09), (0.0, 0.0), (-0.05, -0.05)]
    heights = [0, 0, 0, 0, 0, 0, 0, 0.09, 0.09]
    for index in range(9):
        x, y = layout[index]
        parts.append(
            turn(
                slab("block_%d" % index, (0.085, 0.085, 0.085), (x, y, 0.043 + heights[index]), colours[index], 0.008),
                rz=index * 0.12,
            )
        )
    return lib.join(parts, "toy_block_set")


def teddy_bear():
    parts = [
        ball("body", 0.075, (0, 0, 0.10), "oak_light", (1, 0.85, 1.15), 10, 7),
        ball("head", 0.070, (0, 0, 0.235), "oak_light", (1, 0.92, 0.95), 10, 6),
        ball("ear_a", 0.026, (-0.052, 0.01, 0.288), "oak_light", (1, 0.7, 1), 8, 5),
        ball("ear_b", 0.026, (0.052, 0.01, 0.288), "oak_light", (1, 0.7, 1), 8, 5),
        ball("snout", 0.028, (0, -0.055, 0.222), "linen", (1, 0.7, 0.8), 8, 5),
        ball("eye_a", 0.008, (-0.024, -0.058, 0.252), "rubber", (1, 1, 1), 6, 4),
        ball("eye_b", 0.008, (0.024, -0.058, 0.252), "rubber", (1, 1, 1), 6, 4),
        ball("nose", 0.010, (0, -0.072, 0.222), "rubber", (1, 0.8, 0.8), 6, 4),
        turn(ball("arm_a", 0.030, (-0.075, -0.005, 0.125), "oak_light", (1, 1, 2.3), 8, 6), ry=0.35),
        turn(ball("arm_b", 0.030, (0.075, -0.005, 0.125), "oak_light", (1, 1, 2.3), 8, 6), ry=-0.35),
        ball("leg_a", 0.034, (-0.040, -0.010, 0.030), "oak_light", (1, 1.25, 0.9), 8, 6),
        ball("leg_b", 0.034, (0.040, -0.010, 0.030), "oak_light", (1, 1.25, 0.9), 8, 6),
        ball("paw_a", 0.024, (-0.075, -0.020, 0.060), "linen", (1, 1, 1), 6, 4),
        ball("paw_b", 0.024, (0.075, -0.020, 0.060), "linen", (1, 1, 1), 6, 4),
        slab("belly", (0.070, 0.02, 0.075), (0, -0.058, 0.095), "linen", 0.024, 2),
    ]
    return lib.join(parts, "teddy_bear")


BUILDERS = {
    "duvet_folded": duvet_folded,
    "pillow": pillow,
    "bedside_books": bedside_books,
    "glasses_specs": glasses_specs,
    "alarm_clock": alarm_clock,
    "phone_mobile": phone_mobile,
    "charger_cable": charger_cable,
    "laundry_pile": laundry_pile,
    "shoe_pair": shoe_pair,
    "coat_hanger": coat_hanger,
    "clothes_rail": clothes_rail,
    "suitcase": suitcase,
    "toy_block_set": toy_block_set,
    "teddy_bear": teddy_bear,
}
