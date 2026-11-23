"""Phase 3, §7.2 — dining and kitchen dressing."""

import math

import lib
from decor_common import ball, bar, lathe, plate, slab, turn


def plate_dinner():
    return plate("plate_dinner", 0.13, 0.0)


def plate_stack():
    parts = [plate("plate_%d" % index, 0.13, index * 0.016) for index in range(5)]
    return lib.join(parts, "plate_stack")


def bowl_cereal():
    parts = [
        lathe(
            "bowl",
            [(0.055, 0.0), (0.05, 0.008), (0.072, 0.028), (0.08, 0.055), (0.076, 0.068)],
            "ceramic",
            20,
            bevel=0.002,
        )
    ]
    return lib.join(parts, "bowl_cereal")


def mug():
    parts = [
        lathe("body", [(0.045, 0.0), (0.043, 0.008), (0.043, 0.094), (0.046, 0.10)], "ceramic", 18, bevel=0.002),
        lib.torus("handle", 0.028, 0.0075, (0.05, 0, 0.055), "ceramic", rot=(math.pi / 2, 0, 0), major_segments=14, minor_segments=6),
    ]
    return lib.join(parts, "mug")


def glass_tumbler():
    parts = [
        lathe(
            "glass",
            [(0.030, 0.0), (0.034, 0.006), (0.035, 0.10), (0.033, 0.108)],
            "glass_clear",
            18,
            bevel=0.002,
        )
    ]
    return lib.join(parts, "glass_tumbler")


def wine_glass():
    parts = [
        lib.cyl("foot", 0.032, 0.008, (0, 0, 0.004), "glass_clear", 16, 0.002),
        lib.cyl("stem", 0.0045, 0.085, (0, 0, 0.05), "glass_clear", 8),
        lathe(
            "bowl",
            [(0.006, 0.09), (0.026, 0.112), (0.036, 0.145), (0.030, 0.18), (0.032, 0.20)],
            "glass_clear",
            18,
            (0, 0, 0.0),
        ),
    ]
    return lib.join(parts, "wine_glass")


def cutlery_set():
    parts = [
        # knife
        slab("knife_handle", (0.10, 0.014, 0.012), (-0.07, -0.035, 0.012), "steel", 0.004),
        slab("knife_blade", (0.13, 0.004, 0.022), (0.05, -0.035, 0.014), "chrome", 0.002),
        # fork
        slab("fork_handle", (0.10, 0.012, 0.010), (-0.07, 0.0, 0.010), "chrome", 0.004),
        slab("fork_head", (0.05, 0.014, 0.014), (0.02, 0, 0.012), "chrome", 0.003),
        # spoon
        slab("spoon_handle", (0.10, 0.012, 0.010), (-0.07, 0.035, 0.010), "chrome", 0.004),
        ball("spoon_bowl", 0.024, (0.03, 0.035, 0.013), "chrome", (1.7, 1.1, 0.35), 10, 6),
    ]
    for index in range(4):
        parts.append(slab("tine_%d" % index, (0.03, 0.0028, 0.012), (0.06, -0.006 + index * 0.004, 0.012), "chrome", 0.001))
    return lib.join(parts, "cutlery_set")


def placemat():
    parts = [
        slab("mat", (0.42, 0.30, 0.004), (0, 0, 0.002), "linen", 0.002),
        slab("hem", (0.42, 0.006, 0.005), (0, 0.15, 0.003), "oak_light", 0.001),
        slab("hem_b", (0.42, 0.006, 0.005), (0, -0.15, 0.003), "oak_light", 0.001),
    ]
    return lib.join(parts, "placemat")


def table_runner():
    parts = [
        slab("runner", (2.0, 0.35, 0.004), (0, 0, 0.002), "fabric_rust", 0.002),
        slab("hem_a", (0.01, 0.35, 0.006), (-0.995, 0, 0.003), "fabric_rust", 0.001),
        slab("hem_b", (0.01, 0.35, 0.006), (0.995, 0, 0.003), "fabric_rust", 0.001),
    ]
    return lib.join(parts, "table_runner")


def teapot():
    parts = [
        lathe(
            "body",
            [(0.05, 0.0), (0.07, 0.025), (0.075, 0.085), (0.055, 0.125), (0.05, 0.135)],
            "ceramic",
            20,
            bevel=0.002,
        ),
        lib.cyl("lid", 0.032, 0.016, (0, 0, 0.142), "ceramic", 16, 0.003),
        ball("knob", 0.012, (0, 0, 0.155), "ceramic", (1, 1, 0.8), 8, 6),
        lib.torus("handle", 0.032, 0.007, (-0.075, 0, 0.075), "ceramic", rot=(math.pi / 2, 0, 0), major_segments=12, minor_segments=6),
        turn(lib.cyl("spout", 0.011, 0.09, (0.085, 0, 0.09), "ceramic", 10, 0.002), ry=0.9),
    ]
    return lib.join(parts, "teapot")


def saucepan():
    parts = [
        lib.cyl("body", 0.10, 0.085, (0, 0, 0.043), "steel", 20, 0.006),
        lib.cyl("rim", 0.104, 0.012, (0, 0, 0.088), "steel", 20, 0.004),
        lib.cyl("lid", 0.105, 0.012, (0, 0, 0.098), "chrome", 20, 0.004),
        lib.cyl("knob", 0.014, 0.02, (0, 0, 0.112), "rubber", 10, 0.004),
        slab("handle_a", (0.10, 0.022, 0.016), (0.15, 0, 0.075), "rubber", 0.006),
        slab("handle_b", (0.10, 0.022, 0.016), (-0.15, 0, 0.075), "rubber", 0.006),
    ]
    return lib.join(parts, "saucepan")


def frying_pan():
    parts = [
        lib.cyl("pan", 0.13, 0.035, (0, 0, 0.018), "cast_iron", 22, 0.008),
        lib.cyl("inner", 0.115, 0.028, (0, 0, 0.028), "cast_iron", 22, 0.004),
        slab("handle", (0.16, 0.028, 0.018), (0.20, 0, 0.045), "rubber", 0.006),
        lib.cyl("rivet", 0.006, 0.03, (0.125, 0, 0.03), "steel", 8, 0.001, rot=(0, math.pi / 2, 0)),
    ]
    return lib.join(parts, "frying_pan")


def chopping_board():
    parts = [
        slab("board", (0.40, 0.28, 0.028), (0, 0, 0.014), "oak_light", 0.006),
        slab("grain_a", (0.38, 0.004, 0.002), (0, -0.07, 0.029), "oak", 0.001),
        slab("grain_b", (0.38, 0.004, 0.002), (0, 0.03, 0.029), "oak", 0.001),
        slab("groove", (0.34, 0.20, 0.004), (0, 0, 0.031), "oak_dark", 0.003),
    ]
    return lib.join(parts, "chopping_board")


def knife_block():
    parts = [
        lib.box("block", (0.12, 0.20, 0.24), (0, 0, 0.12), "walnut", 0.008),
        slab("slot_a", (0.07, 0.008, 0.006), (0, 0.06, 0.238), "rubber", 0.002),
        slab("slot_b", (0.07, 0.008, 0.006), (0, 0.0, 0.238), "rubber", 0.002),
        slab("slot_c", (0.07, 0.008, 0.006), (0, -0.06, 0.238), "rubber", 0.002),
    ]
    for index, y in enumerate((0.06, 0.0, -0.06)):
        parts.append(turn(slab("handle_%d" % index, (0.022, 0.032, 0.10), (0, y, 0.30), "steel", 0.006), rx=0.12))
        parts.append(turn(slab("tang_%d" % index, (0.008, 0.026, 0.10), (0, y, 0.19), "chrome", 0.002), rx=0.12))
    return lib.join(parts, "knife_block")


def fruit_bowl():
    parts = [
        lathe(
            "bowl",
            [(0.15, 0.0), (0.14, 0.012), (0.06, 0.03), (0.07, 0.085), (0.14, 0.12), (0.15, 0.13)],
            "oak",
            20,
            bevel=0.003,
        )
    ]
    for index, (x, y, mat) in enumerate(((-0.05, 0.02, "fruit_orange"), (0.05, 0.03, "fruit_red"), (0.0, -0.05, "fruit_orange"))):
        parts.append(ball("fruit_%d" % index, 0.045, (x, y, 0.14), mat, (1, 1, 0.9), 10, 6))
    return lib.join(parts, "fruit_bowl")


def spice_rack():
    parts = [
        slab("back", (0.40, 0.012, 0.30), (0, 0.03, 0.15), "paint_white", 0.004),
        slab("shelf_a", (0.40, 0.07, 0.012), (0, 0.0, 0.05), "paint_white", 0.003),
        slab("shelf_b", (0.40, 0.07, 0.012), (0, 0.0, 0.17), "paint_white", 0.003),
        slab("side_a", (0.012, 0.07, 0.26), (-0.195, 0.0, 0.14), "paint_white", 0.003),
        slab("side_b", (0.012, 0.07, 0.26), (0.195, 0.0, 0.14), "paint_white", 0.003),
    ]
    for index in range(8):
        x = -0.15 + (index % 4) * 0.10
        z = 0.056 if index < 4 else 0.176
        parts.append(lib.cyl("jar_%d" % index, 0.018, 0.05, (x, 0, z), "ceramic", 10, 0.0))
        parts.append(lib.cyl("lid_%d" % index, 0.019, 0.012, (x, 0, z + 0.03), "steel", 10, 0.0))
        parts.append(slab("label_%d" % index, (0.026, 0.004, 0.02), (x, -0.018, z), "paper", 0.001))
    return lib.join(parts, "spice_rack")


def cereal_box():
    parts = [
        slab("box", (0.20, 0.07, 0.30), (0, 0, 0.15), "paper", 0.006),
        slab("panel", (0.16, 0.004, 0.24), (0, -0.037, 0.16), "fruit_orange", 0.001),
        slab("band", (0.20, 0.074, 0.03), (0, 0, 0.26), "paint_cream", 0.002),
    ]
    return lib.join(parts, "cereal_box")


def wine_bottle():
    parts = [
        lathe(
            "bottle",
            [(0.038, 0.0), (0.040, 0.008), (0.040, 0.135), (0.030, 0.18), (0.013, 0.235), (0.013, 0.275)],
            "glass_clear",
            18,
            bevel=0.002,
        ),
        lib.cyl("cap", 0.014, 0.014, (0, 0, 0.28), "brass", 12, 0.002),
        slab("label", (0.05, 0.004, 0.075), (0, -0.040, 0.075), "paper", 0.001),
        slab("label_b", (0.05, 0.004, 0.075), (0, 0.040, 0.075), "paper", 0.001),
    ]
    return lib.join(parts, "wine_bottle")


def drying_rack_clothes():
    parts = [
        lib.cyl("post_a", 0.012, 0.90, (-0.38, 0, 0.45), "steel", 8, 0.002),
        lib.cyl("post_b", 0.012, 0.90, (0.38, 0, 0.45), "steel", 8, 0.002),
        bar("bar_a", 0.78, (0, 0, 0.86), "steel", 0.007, axis="x"),
        bar("bar_b", 0.78, (0, 0, 0.58), "steel", 0.007, axis="x"),
        bar("bar_c", 0.78, (0, 0, 0.30), "steel", 0.007, axis="x"),
        slab("foot_a", (0.16, 0.06, 0.02), (-0.38, 0, 0.01), "steel", 0.004),
        slab("foot_b", (0.16, 0.06, 0.02), (0.38, 0, 0.01), "steel", 0.004),
    ]
    colours = ["linen", "paint_cream", "fabric_rust", "paper", "fabric_olive"]
    for index in range(5):
        x = -0.28 + index * 0.14
        z = (0.86, 0.58, 0.30)[index % 3] - 0.11
        parts.append(slab("garment_%d" % index, (0.13, 0.03, 0.22), (x, 0, z), colours[index], 0.008, 2))
    return lib.join(parts, "drying_rack_clothes")


BUILDERS = {
    "plate_dinner": plate_dinner,
    "plate_stack": plate_stack,
    "bowl_cereal": bowl_cereal,
    "mug": mug,
    "glass_tumbler": glass_tumbler,
    "wine_glass": wine_glass,
    "cutlery_set": cutlery_set,
    "placemat": placemat,
    "table_runner": table_runner,
    "teapot": teapot,
    "saucepan": saucepan,
    "frying_pan": frying_pan,
    "chopping_board": chopping_board,
    "knife_block": knife_block,
    "fruit_bowl": fruit_bowl,
    "spice_rack": spice_rack,
    "cereal_box": cereal_box,
    "wine_bottle": wine_bottle,
    "drying_rack_clothes": drying_rack_clothes,
}
