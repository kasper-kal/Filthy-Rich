"""Phase 5, part one — what the player holds (FINALLY-3D.md §9).

The four CleaningSystem tools and the two gloved hands, plus the spare nozzle
that goes with any spray bottle. These are on screen for the entire game, so
they carry the most geometry per centimetre in the library.

Every one of them is built around the origin as the **fist**: the spray bottle's
trigger, the mop shaft, the vacuum wand and the trash-bag rim all pass through
(or just behind) x = y = 0, so the single glove model lands in the right place on
all four without a per-tool offset table in the game code.

Forward is -Y (the nozzle points -Y, so it points +Z in three.js once exported);
DOWN is -Z. The spray bottle's mouth faces the camera, which is why the level
window is on the -Y side.
"""

import math

import decor_common
import lib
import tool_common as tc
from trash_common import blob, disc, taper


def _spray(with_liquid):
    parts = []

    # Body hangs below the fist so the trigger sits at the pivot. 16-sided at
    # 18 segments because this silhouette is 12 cm from the camera.
    parts.append(
        decor_common.lathe(
            "body",
            [(0.040, 0.0), (0.047, 0.02), (0.049, 0.085), (0.043, 0.115), (0.024, 0.128)],
            "plastic_red",
            18,
            (0, 0, -0.175),
        )
    )
    # Wrap-around paper label. Sits 0.7 mm proud of the body so it reads as a
    # label and not as a paint change.
    parts.append(
        decor_common.lathe("label", [(0.0497, -0.135), (0.0497, -0.072)], "paper", 18)
    )
    parts.append(
        decor_common.lathe("neck", [(0.016, 0.0), (0.016, 0.060)], "plastic_red", 12, (0, 0, -0.050))
    )
    parts.append(tc.box("head", (0.048, 0.056, 0.050), (0, -0.006, 0.032), "plastic_red", 0.006, 2))
    parts.append(
        decor_common.lathe("turret", [(0.013, 0.0), (0.011, 0.014)], "plastic_white", 10, (0, 0, 0.055))
    )
    parts.append(tc.rod("nozzle", (0, -0.030, 0.040), (0, -0.056, 0.040), 0.007, "plastic_white", 8, taper=0.3))
    # The trigger is the one moving part in the whole kit, so it is a separate
    # object with a real gap behind it: a squeeze animation can rotate it later.
    parts.append(
        tc.box("trigger", (0.010, 0.014, 0.040), (0, -0.031, -0.004), "plastic_white", 0.002, 1,
               rot=(-0.30, 0, 0))
    )
    parts.append(tc.rod("guard", (0, -0.043, 0.020), (0, -0.020, -0.022), 0.004, "plastic_red", 6))

    if with_liquid:
        # A sight window, not a hidden column: an opaque bottle cannot show a
        # level, and a see-through bottle would need transmission on the body.
        # It sits on +Y — the model's *back* — because the HUD turns every tool a
        # half-turn so its working end faces down-range, which puts +Y at the
        # player. See §9.0.
        parts.append(
            tc.move_origin(
                tc.band(
                    "liquid", 0.0415, 0.0502, -0.170, -0.060, "glass_clear",
                    span=1.15, steps=6, centre=math.pi / 2, thickness=0.003,
                ),
                (0, 0, -0.170),
            )
        )

    parts.append(tc.socket("SOC_grip", (0, 0, 0)))
    parts.append(tc.socket("SOC_nozzle", (0, -0.058, 0.040)))
    return parts


def spray_bottle():
    return _spray(True)


def spray_bottle_empty():
    return _spray(False)


def refill_bottle():
    """Bottom centre: the refill sits on a shelf and is never in the hand."""
    parts = []
    parts.append(
        decor_common.lathe(
            "body",
            [(0.030, 0.0), (0.040, 0.020), (0.042, 0.150), (0.034, 0.195), (0.020, 0.205)],
            "plastic_red",
            16,
        )
    )
    parts.append(decor_common.lathe("cap", [(0.021, 0.0), (0.021, 0.022)], "plastic_white", 12, (0, 0, 0.202)))
    parts.append(tc.band("label", 0.0426, 0.0418, 0.055, 0.135, "paper", span=6.0, steps=16, thickness=0.002))
    # Moulded side handle, the one thing that says "refill" and not "bottle".
    parts.append(tc.rod("handle_a", (0.040, 0, 0.070), (0.070, 0, 0.100), 0.009, "plastic_red", 7))
    parts.append(tc.rod("handle_b", (0.070, 0, 0.100), (0.070, 0, 0.155), 0.009, "plastic_red", 7))
    parts.append(tc.rod("handle_c", (0.070, 0, 0.155), (0.038, 0, 0.182), 0.009, "plastic_red", 7))
    return parts


def mop():
    """Grip centre on the shaft, so the fist is at 0 and the head hangs at -0.72.

    The head is deliberately low: in the HUD the mop is framed with the head at
    the bottom of the screen and the shaft leaving the top, the way every
    first-person mop is framed.
    """
    parts = []
    parts.append(tc.rod("shaft", (0, 0, -0.600), (0, 0, 0.720), 0.011, "steel", 10))
    parts.append(decor_common.lathe("grip", [(0.015, 0.0), (0.015, 0.120)], "rubber", 10, (0, 0, -0.060)))
    parts.append(decor_common.lathe("top_cap", [(0.014, 0.0), (0.010, 0.020)], "rubber", 10, (0, 0, 0.700)))
    parts.append(
        decor_common.lathe(
            "ferrule",
            [(0.014, 0.0), (0.019, 0.012), (0.019, 0.045), (0.015, 0.058)],
            "chrome",
            12,
            (0, 0, -0.658),
        )
    )
    parts.append(tc.box("head_plate", (0.095, 0.095, 0.014), (0, 0, -0.612), "plastic_white", 0.006, 2))
    parts.append(tc.box("head_boss", (0.048, 0.048, 0.022), (0, 0, -0.595), "plastic_white", 0.005, 2))

    # Fourteen strand groups with seeded splay: the mop head has to look soft
    # from every angle or it reads as a bath sponge on a stick.
    generator = tc.rng("mop")
    for index in range(14):
        angle = math.tau * index / 14
        spread = 0.030 + generator.random() * 0.008
        drop = 0.080 + generator.random() * 0.022
        inner = (spread * math.cos(angle), spread * math.sin(angle), -0.600)
        outer = (
            (spread + 0.026) * math.cos(angle),
            (spread + 0.026) * math.sin(angle),
            -0.600 - drop,
        )
        parts.append(tc.rod("strand_%02d" % index, inner, outer, 0.0075, "linen", 5, taper=0.35))

    parts.append(tc.socket("SOC_grip", (0, 0, 0)))
    parts.append(tc.socket("SOC_mop_head", (0, 0, -0.700)))
    return parts


def vacuum():
    """Canister vacuum: body on the floor, hose loop, wand up to the fist.

    Grip centre is on the wand grip, so the canister hangs ~1 m below the hand.
    """
    parts = []
    parts.append(
        decor_common.lathe(
            "canister",
            [(0.100, 0.0), (0.132, 0.030), (0.140, 0.100), (0.138, 0.200), (0.126, 0.270), (0.100, 0.300)],
            "plastic_red",
            20,
            (0, 0, -1.020),
        )
    )
    parts.append(
        decor_common.lathe(
            "motor",
            [(0.096, 0.0), (0.090, 0.030), (0.066, 0.058), (0.034, 0.072)],
            "plastic_white",
            14,
            (0, 0, -0.720),
        )
    )
    parts.append(tc.band("filter_window", 0.1425, 0.1405, -0.975, -0.815, "glass_frosted",
                         span=0.95, steps=6, thickness=0.003))
    parts.append(tc.band("bumper", 0.1205, 0.1425, -1.002, -0.975, "rubber",
                         span=6.1, steps=14, thickness=0.006))
    for side in (-1, 1):
        parts.append(tc.rod("wheel_%d" % side, (side * 0.132, 0, -0.975), (side * 0.164, 0, -0.975),
                            0.055, "rubber", 12))
        parts.append(tc.rod("hub_%d" % side, (side * 0.160, 0, -0.975), (side * 0.170, 0, -0.975),
                            0.018, "chrome", 10))
    # Cord reel on the back — the second read when you turn the tool.
    parts.append(tc.rod("reel", (0, 0.128, -0.860), (0, 0.158, -0.860), 0.042, "plastic_white", 12))
    parts.append(tc.rod("cord", (0.020, 0.150, -0.820), (0.052, 0.170, -0.900), 0.006, "rubber", 5))

    loop = [
        (0, 0.030, -0.700),
        (0, 0.115, -0.640),
        (0, 0.105, -0.500),
        (0, 0.045, -0.395),
        (0, 0.000, -0.372),
    ]
    for index in range(len(loop) - 1):
        parts.append(tc.rod("hose_%d" % index, loop[index], loop[index + 1], 0.026, "rubber", 10))

    parts.append(tc.rod("wand", (0, 0, -0.420), (0, 0, 0.100), 0.017, "steel", 10))
    parts.append(tc.rod("wand_grip", (0, 0, -0.085), (0, 0, 0.095), 0.021, "rubber", 10))
    parts.append(tc.box("wand_catch", (0.030, 0.030, 0.020), (0, 0, -0.360), "plastic_white", 0.005, 2))
    parts.append(tc.socket("SOC_grip", (0, 0, 0)))
    parts.append(tc.socket("SOC_vacuum_head", (0, 0, -0.400)))
    return parts


def vacuum_floor_head():
    """Bottom centre: it lives on the wand in game but is a separate asset (§9)."""
    parts = []
    parts.append(taper("head", (0.300, 0.078), (0.250, 0.062), 0.048, (0, 0, 0.008), "plastic_white", 0.006, open_top=False))
    parts.append(tc.box("lip", (0.298, 0.010, 0.008), (0, -0.040, 0.010), "rubber", 0.002, 1))
    parts.append(tc.box("window", (0.070, 0.004, 0.020), (0, -0.036, 0.040), "glass_frosted", 0.002, 1))
    parts.append(tc.rod("neck", (0, 0, 0.050), (0, 0.014, 0.104), 0.022, "plastic_white", 10, taper=0.15))
    for side in (-1, 1):
        parts.append(tc.rod("wheel_%d" % side, (side * 0.098, -0.012, 0.016), (side * 0.112, -0.012, 0.016),
                            0.014, "rubber", 8))
    parts.append(tc.socket("SOC_vacuum_head", (0, 0.010, 0.104)))
    return parts


def trash_bag():
    """Grip centre at the rim: the bag hangs below the fist, 45 cm deep."""
    parts = []
    parts.append(taper("bag", (0.205, 0.185), (0.295, 0.265), 0.440, (0, 0, -0.440), "rubber", 0.0, open_top=True))
    # Dark interior floor, so looking into the bag reads as depth not as a hole.
    parts.append(disc("bag_inside", 0.086, (0, 0, -0.432), "grime", points=12, thickness=0.003))
    parts.append(tc.ring("rim", 0.142, 0.013, (0, 0, 0), "rubber"))
    for index in range(3):
        angle = math.tau * index / 3 + 0.4
        parts.append(
            tc.rod(
                "crease_%d" % index,
                (0.130 * math.cos(angle), 0.120 * math.sin(angle), -0.020),
                (0.105 * math.cos(angle), 0.095 * math.sin(angle), -0.420),
                0.004,
                "rubber",
                5,
            )
        )
    parts.append(blob("lump", 0.045, (0.100, 0.020, -0.200), "rubber",
                      scale=(0.7, 0.9, 1.3), roughness=0.25, segments=8, rings=5, seed="trash_bag_lump"))
    parts.append(tc.socket("SOC_grip", (0, 0, 0.004)))
    return parts


def trash_bag_full():
    """Bottom centre: a full bag is a prop on the floor or in the truck."""
    parts = []
    body = decor_common.lathe(
        "bag",
        [(0.090, 0.0), (0.150, 0.030), (0.180, 0.140), (0.176, 0.260), (0.140, 0.360), (0.100, 0.420), (0.045, 0.455)],
        "rubber",
        16,
    )
    generator = tc.rng("trash_bag_full")
    for vertex in body.data.vertices:
        if vertex.co.z < 0.400:
            factor = 1.0 + (generator.random() - 0.5) * 0.10
            vertex.co.x *= factor
            vertex.co.y *= factor
    parts.append(body)
    parts.append(tc.ring("tie", 0.036, 0.010, (0, 0, 0.452), "plastic_red", major_segments=12, minor_segments=5))
    parts.append(blob("knot", 0.030, (0, 0, 0.478), "rubber", scale=(1, 1, 0.8), roughness=0.20, segments=8, rings=5))
    for index in range(3):
        angle = math.tau * index / 3
        parts.append(
            blob("bulge_%d" % index, 0.055,
                 (0.130 * math.cos(angle), 0.130 * math.sin(angle), 0.160),
                 "rubber", scale=(1, 1, 1.1), roughness=0.15, segments=8, rings=5)
        )
    return parts


def _glove(name, mirror=False):
    """A fist wrapped around a vertical pole at the origin, forearm along +X.

    Built this way round so the HUD can rotate it about the pole's axis to angle
    the forearm off the bottom-right of the frame without breaking the grip.
    """
    parts = []
    parts.append(tc.box("palm", (0.080, 0.086, 0.076), (0.050, 0.004, 0.002), "rubber", 0.018, 3))
    parts.append(tc.rod("cuff", (0.082, 0.004, 0.002), (0.215, 0.012, 0.008), 0.036, "rubber", 10, taper=0.15))
    parts.append(tc.rod("sleeve", (0.076, 0.004, 0.002), (0.100, 0.006, 0.003), 0.040, "rubber", 10))

    for index in range(4):
        z = -0.042 + index * 0.028
        a = (0.034, -0.050, z)
        b = (0.000, -0.064, z + 0.002)
        c = (-0.042, -0.030, z + 0.004)
        d = (-0.047, 0.004, z + 0.006)
        parts.append(tc.rod("finger_%d_a" % index, a, b, 0.0125, "rubber", 6))
        parts.append(tc.rod("finger_%d_b" % index, b, c, 0.0115, "rubber", 6))
        parts.append(tc.rod("finger_%d_c" % index, c, d, 0.0100, "rubber", 6))
        parts.append(
            blob("knuckle_%d" % index, 0.014, (0.012, -0.050, z + 0.006), "rubber",
                 scale=(1, 1, 0.9), roughness=0.12, segments=8, rings=5)
        )

    parts.append(tc.rod("thumb_a", (0.040, 0.036, -0.030), (0.004, 0.052, -0.002), 0.0135, "rubber", 6))
    parts.append(tc.rod("thumb_b", (0.004, 0.052, -0.002), (-0.024, 0.026, 0.012), 0.0115, "rubber", 6))

    if mirror:
        for part in parts:
            tc.mirror_x(part)
    parts.append(tc.socket("SOC_grip", (0, 0, 0)))
    return parts


def glove_hand():
    return _glove("glove_hand")


def glove_hand_left():
    return _glove("glove_hand_left", mirror=True)


def spray_nozzle():
    """Spare head, lying on its side. Bottom centre."""
    parts = []
    parts.append(tc.rod("body", (0, -0.028, 0.013), (0, 0.028, 0.013), 0.013, "plastic_white", 10))
    parts.append(tc.rod("tip", (0, -0.028, 0.013), (0, -0.044, 0.013), 0.008, "plastic_white", 8, taper=0.3))
    parts.append(
        tc.box("lever", (0.014, 0.030, 0.008), (0, 0.004, 0.028), "plastic_red", 0.002, 1, rot=(-0.20, 0, 0))
    )
    parts.append(tc.ring("collar", 0.014, 0.003, (0, 0.026, 0.013), "plastic_red",
                         rot=(math.pi / 2, 0, 0), major_segments=10, minor_segments=4))
    return parts


BUILDERS = {
    "spray_bottle": spray_bottle,
    "spray_bottle_empty": spray_bottle_empty,
    "refill_bottle": refill_bottle,
    "mop": mop,
    "vacuum": vacuum,
    "vacuum_floor_head": vacuum_floor_head,
    "trash_bag": trash_bag,
    "trash_bag_full": trash_bag_full,
    "glove_hand": glove_hand,
    "glove_hand_left": glove_hand_left,
    "spray_nozzle": spray_nozzle,
}
