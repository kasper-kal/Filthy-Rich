"""Phase 3, §7.1 — living room dressing, plus the wall shelf it sits on."""

import math

import lib
from decor_common import bar, ball, cloth, cone, lathe, plate, slab, turn


def cushion_square():
    parts = [
        slab("body", (0.44, 0.12, 0.44), (0, 0, 0.062), "fabric_rust", 0.045, 3),
        slab("crease", (0.40, 0.008, 0.018), (0, 0, 0.118), "fabric_rust", 0.004),
        lathe("button", [(0.016, 0.0), (0.014, 0.006), (0.006, 0.008)], "linen", 10, (0, 0, 0.116)),
    ]
    return lib.join(parts, "cushion_square")


def cushion_round():
    parts = [
        lib.cyl("body", 0.20, 0.12, (0, 0, 0.06), "fabric_olive", 24, 0.035),
        lib.cyl("rim", 0.202, 0.008, (0, 0, 0.06), "fabric_olive", 24, 0.003),
        lathe("button", [(0.016, 0.0), (0.014, 0.006), (0.006, 0.008)], "linen", 10, (0, 0, 0.118)),
    ]
    return lib.join(parts, "cushion_round")


def throw_blanket():
    parts = [cloth("cloth", 1.20, 1.60, "linen", folds=4, amplitude=0.022, thickness=0.014, resolution=8, loc=(0, 0, 0.008))]
    for index in range(11):
        x = -0.5 + index * 0.10
        parts.append(slab("fringe_%d" % index, (0.012, 0.07, 0.004), (x, -0.84, 0.014), "paper", 0.001))
    return lib.join(parts, "throw_blanket")


def tv_flat():
    parts = [
        slab("base", (0.30, 0.20, 0.018), (0, 0.02, 0.009), "rubber", 0.006),
        slab("neck", (0.07, 0.05, 0.15), (0, 0.03, 0.09), "rubber", 0.005),
        slab("bezel", (1.10, 0.035, 0.65), (0, 0, 0.49), "rubber", 0.006),
        slab("screen", (1.04, 0.008, 0.59), (0, -0.019, 0.49), "glass_clear", 0.002),
        slab("cable", (0.02, 0.02, 0.16), (0.22, 0.06, 0.09), "rubber", 0.004),
        slab("cable_foot", (0.10, 0.02, 0.02), (0.26, 0.06, 0.01), "rubber", 0.003),
    ]
    return lib.join(parts, "tv_flat")


def tv_crt():
    parts = [
        slab("body", (0.55, 0.50, 0.45), (0, 0, 0.235), "plastic_white", 0.03, 3),
        slab("bezel", (0.46, 0.03, 0.34), (0, -0.245, 0.27), "rubber", 0.008),
        slab("screen", (0.40, 0.012, 0.28), (0, -0.256, 0.27), "glass_clear", 0.004),
        lib.cyl("knob_a", 0.018, 0.02, (0.20, -0.26, 0.35), "steel", 12, 0.002, rot=(math.pi / 2, 0, 0)),
        lib.cyl("knob_b", 0.018, 0.02, (0.20, -0.26, 0.29), "steel", 12, 0.002, rot=(math.pi / 2, 0, 0)),
    ]
    for index in range(4):
        parts.append(slab("vent_%d" % index, (0.36, 0.006, 0.012), (0, 0.19 - index * 0.03, 0.455), "steel", 0.002))
    return lib.join(parts, "tv_crt")


def soundbar():
    parts = [
        slab("body", (0.90, 0.09, 0.07), (0, 0, 0.042), "rubber", 0.014),
        slab("grille", (0.86, 0.008, 0.05), (0, -0.046, 0.042), "steel", 0.003),
        slab("foot_a", (0.06, 0.07, 0.01), (-0.34, 0, 0.005), "rubber", 0.002),
        slab("foot_b", (0.06, 0.07, 0.01), (0.34, 0, 0.005), "rubber", 0.002),
    ]
    return lib.join(parts, "soundbar")


def games_console():
    parts = [
        slab("body", (0.30, 0.25, 0.075), (0, 0, 0.038), "rubber", 0.012),
        slab("slot", (0.16, 0.008, 0.008), (0, -0.126, 0.05), "steel", 0.002),
        slab("button", (0.025, 0.006, 0.008), (0.10, -0.126, 0.03), "steel", 0.002),
        slab("cable_a", (0.10, 0.02, 0.02), (0.16, 0.06, 0.01), "rubber", 0.004),
        slab("cable_b", (0.02, 0.12, 0.02), (-0.12, 0.16, 0.01), "rubber", 0.004),
    ]
    for index in range(5):
        parts.append(slab("vent_%d" % index, (0.22, 0.008, 0.01), (0, 0.02 + index * 0.025, 0.075), "steel", 0.002))
    return lib.join(parts, "games_console")


def game_case_stack():
    parts = []
    for index in range(8):
        parts.append(
            slab(
                "case_%d" % index,
                (0.14, 0.02, 0.19),
                ((index % 3 - 1) * 0.008, (index % 2) * 0.006, 0.011 + index * 0.021),
                "plastic_white" if index % 2 else "rubber",
                0.003,
            )
        )
    return lib.join(parts, "game_case_stack")


def remote_control():
    parts = [slab("body", (0.20, 0.05, 0.02), (0, 0, 0.011), "rubber", 0.008, 3)]
    for row in range(3):
        for column in range(4):
            parts.append(
                slab(
                    "btn_%d_%d" % (row, column),
                    (0.018, 0.018, 0.004),
                    (-0.045 + column * 0.024, -0.012 + row * 0.016, 0.022),
                    "plastic_white",
                    0.002,
                )
            )
    parts.append(slab("ir", (0.01, 0.012, 0.006), (0.09, 0, 0.016), "glass_clear", 0.001))
    return lib.join(parts, "remote_control")


def magazine_pile():
    parts = []
    for index in range(5):
        parts.append(turn(
            slab(
                "mag_%d" % index,
                (0.30, 0.22, 0.012),
                ((index % 2) * 0.014 - 0.007, (index % 3) * 0.006 - 0.006, 0.007 + index * 0.013),
                "paper" if index % 2 else "linen",
                0.004,
            ),
            rz=(index - 2) * 0.05,
        ))
    return lib.join(parts, "magazine_pile")


def book_stack():
    parts = []
    colours = ["fabric_rust", "oak_dark", "paper", "fabric_olive", "walnut", "linen"]
    for index in range(6):
        parts.append(turn(
            slab(
                "book_%d" % index,
                (0.25 - index * 0.006, 0.18, 0.024),
                ((index % 2) * 0.012 - 0.006, 0, 0.013 + index * 0.024),
                colours[index],
                0.004,
            ),
            rz=(index - 2.5) * 0.06,
        ))
    return lib.join(parts, "book_stack")


def picture_frame_a4():
    parts = [
        slab("mount", (0.30, 0.012, 0.40), (0, 0, 0.21), "paper", 0.002),
        slab("art", (0.22, 0.006, 0.30), (0, -0.010, 0.21), "paint_cream", 0.001),
        slab("frame_top", (0.32, 0.022, 0.022), (0, -0.004, 0.409), "walnut", 0.004),
        slab("frame_bottom", (0.32, 0.022, 0.022), (0, -0.004, 0.011), "walnut", 0.004),
        slab("frame_left", (0.022, 0.022, 0.42), (-0.149, -0.004, 0.21), "walnut", 0.004),
        slab("frame_right", (0.022, 0.022, 0.42), (0.149, -0.004, 0.21), "walnut", 0.004),
    ]
    return lib.join(parts, "picture_frame_a4")


def picture_frame_wide():
    parts = [
        slab("mount", (0.68, 0.012, 0.43), (0, 0, 0.225), "paper", 0.002),
        slab("art_a", (0.26, 0.006, 0.32), (-0.17, -0.010, 0.225), "paint_cream", 0.001),
        slab("art_b", (0.26, 0.006, 0.32), (0.17, -0.010, 0.225), "fabric_olive", 0.001),
        slab("frame_top", (0.70, 0.024, 0.024), (0, -0.004, 0.438), "oak_dark", 0.004),
        slab("frame_bottom", (0.70, 0.024, 0.024), (0, -0.004, 0.012), "oak_dark", 0.004),
        slab("frame_left", (0.024, 0.024, 0.45), (-0.338, -0.004, 0.225), "oak_dark", 0.004),
        slab("frame_right", (0.024, 0.024, 0.45), (0.338, -0.004, 0.225), "oak_dark", 0.004),
    ]
    return lib.join(parts, "picture_frame_wide")


def clock_wall():
    parts = [
        lib.cyl("bezel", 0.15, 0.05, (0, 0, 0.15), "oak_dark", 24, 0.008, rot=(math.pi / 2, 0, 0)),
        lib.cyl("face", 0.132, 0.014, (0, -0.028, 0.15), "paper", 24, 0.004, rot=(math.pi / 2, 0, 0)),
        slab("hand_hour", (0.008, 0.006, 0.062), (0, -0.038, 0.168), "rubber", 0.002),
        slab("hand_minute", (0.006, 0.006, 0.092), (0.026, -0.039, 0.185), "rubber", 0.002),
        lib.cyl("pin", 0.008, 0.008, (0, -0.042, 0.15), "brass", 10, 0.002, rot=(math.pi / 2, 0, 0)),
    ]
    return lib.join(parts, "clock_wall")


def candle_jar():
    parts = [
        lathe("jar", [(0.046, 0.0), (0.048, 0.004), (0.048, 0.10), (0.043, 0.116)], "ceramic", 18, bevel=0.002),
        lib.cyl("wax", 0.040, 0.03, (0, 0, 0.085), "paint_cream", 18, 0.003),
        lib.cyl("wick", 0.0025, 0.014, (0, 0, 0.105), "rubber", 6),
    ]
    return lib.join(parts, "candle_jar")


def vase_tall():
    parts = [
        lathe(
            "body",
            [(0.05, 0.0), (0.07, 0.035), (0.068, 0.14), (0.030, 0.30), (0.034, 0.36), (0.040, 0.395)],
            "ceramic",
            20,
            bevel=0.003,
        )
    ]
    for index, (x, y, tilt) in enumerate(((-0.012, 0.01, 0.18), (0.014, -0.008, -0.14), (0.0, 0.016, 0.05))):
        parts.append(bar("stem_%d" % index, 0.30, (x, y, 0.47), "oak_dark", 0.004, axis="z"))
        parts.append(turn(slab("leaf_%d" % index, (0.02, 0.075, 0.004), (x, y, 0.60), "fabric_olive", 0.001), rz=tilt))
    return lib.join(parts, "vase_tall")


def bowl_fruit():
    parts = [
        lathe(
            "bowl",
            [(0.14, 0.0), (0.135, 0.012), (0.075, 0.022), (0.085, 0.06), (0.13, 0.085), (0.14, 0.095)],
            "ceramic",
            20,
            bevel=0.002,
        )
    ]
    for index, (x, y, mat) in enumerate(((-0.05, 0.03, "fruit_red"), (0.04, 0.04, "fruit_orange"), (0.0, -0.05, "fruit_red"), (0.06, -0.02, "fruit_orange"), (-0.03, -0.01, "fruit_red"))):
        parts.append(ball("fruit_%d" % index, 0.042, (x, y, 0.10), mat, (1, 1, 0.9), 10, 6))
    return lib.join(parts, "bowl_fruit")


def ashtray():
    parts = [
        lathe(
            "dish",
            [(0.058, 0.0), (0.05, 0.008), (0.048, 0.012), (0.058, 0.032), (0.06, 0.036)],
            "glass_clear",
            18,
            bevel=0.002,
        ),
        turn(bar("butt_a", 0.05, (-0.012, 0.0, 0.016), "paper", 0.006, axis="x"), rz=0.4),
        turn(bar("butt_b", 0.045, (0.014, 0.012, 0.024), "paper", 0.006, axis="x"), rz=-0.6),
        slab("ash", (0.03, 0.02, 0.004), (0, -0.02, 0.04), "grime", 0.001),
    ]
    return lib.join(parts, "ashtray")


def wall_shelf():
    """Not in §7.1's table: the board the small props stand on (§7.1 has only
    `shelf_bracket`, which cannot hold anything by itself)."""
    # Board only: the two brackets under it are `shelf_bracket.glb`, placed
    # separately, so one asset serves every shelf in the house.
    parts = [
        slab("board", (0.80, 0.30, 0.03), (0, 0.15, 0.015), "oak_light", 0.004),
        slab("lip", (0.80, 0.012, 0.02), (0, 0.005, 0.032), "oak_light", 0.002),
    ]
    return lib.join(parts, "wall_shelf")


BUILDERS = {
    "cushion_square": cushion_square,
    "cushion_round": cushion_round,
    "throw_blanket": throw_blanket,
    "tv_flat": tv_flat,
    "tv_crt": tv_crt,
    "soundbar": soundbar,
    "games_console": games_console,
    "game_case_stack": game_case_stack,
    "remote_control": remote_control,
    "magazine_pile": magazine_pile,
    "book_stack": book_stack,
    "picture_frame_a4": picture_frame_a4,
    "picture_frame_wide": picture_frame_wide,
    "clock_wall": clock_wall,
    "candle_jar": candle_jar,
    "vase_tall": vase_tall,
    "bowl_fruit": bowl_fruit,
    "ashtray": ashtray,
    "wall_shelf": wall_shelf,
}
