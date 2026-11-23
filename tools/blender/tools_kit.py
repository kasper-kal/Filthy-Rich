"""Phase 5, part two — the rest of the cleaning kit (FINALLY-3D.md §9).

Buckets, brushes and soft goods: the things the player finds in the cupboard and
the things that dress a job scene, rather than the four objects glued to the
camera. Nothing here is held in the first person, so every one is built on a
floor-centre pivot except the apron, which hangs from its neck loop.
"""

import math

import decor_common
import lib
import tool_common as tc
from trash_common import sheet, taper


def mop_bucket():
    """0.32 m footprint, wringer across the back half, castors at the front."""
    parts = []
    parts.append(
        taper("bucket", (0.235, 0.215), (0.315, 0.295), 0.255, (0, 0, 0.045),
              "plastic_red", 0.006, open_top=True)
    )
    parts.append(
        tc.box("wringer_plate", (0.255, 0.130, 0.012), (0, 0.075, 0.300), "plastic_red",
               0.004, 2, rot=(-0.22, 0, 0))
    )
    for side in (-1, 1):
        parts.append(
            tc.box("wringer_side_%d" % side, (0.008, 0.130, 0.045), (side * 0.126, 0.075, 0.310),
                   "plastic_red", 0.003, 1)
        )
    parts.append(tc.rod("roller", (-0.115, 0.030, 0.318), (0.115, 0.030, 0.318), 0.016, "rubber", 10))
    for side in (-1, 1):
        parts.append(
            tc.rod("castor_%d" % side, (side * 0.086, -0.086, 0.030), (side * 0.112, -0.086, 0.030),
                   0.026, "rubber", 10)
        )
        parts.append(
            tc.box("fork_%d" % side, (0.010, 0.030, 0.040), (side * 0.096, -0.086, 0.050),
                   "plastic_white", 0.002, 1)
        )
    # The bail is folded down against the rim: an upright handle would double the
    # height of a prop that is supposed to be 32 cm.
    parts.append(tc.rod("bail_l", (0.155, 0, 0.295), (0, 0.020, 0.335), 0.005, "steel", 6))
    parts.append(tc.rod("bail_r", (0, 0.020, 0.335), (-0.155, 0, 0.295), 0.005, "steel", 6))
    return parts


def bucket():
    """0.28 m clear plastic bucket with a folded bail and two baffles."""
    parts = []
    parts.append(
        tc.shell(
            "body",
            [(0.098, 0.0), (0.128, 0.012), (0.132, 0.200), (0.136, 0.232)],
            "plastic_white",
            16,
            thickness=0.005,
        )
    )
    parts.append(tc.ring("rim", 0.137, 0.005, (0, 0, 0.232), "plastic_white", major_segments=16, minor_segments=4))
    parts.append(tc.rod("bail_l", (-0.136, 0, 0.230), (0, 0.060, 0.262), 0.005, "steel", 6))
    parts.append(tc.rod("bail_r", (0, 0.060, 0.262), (0.136, 0, 0.230), 0.005, "steel", 6))
    for side in (-1, 1):
        parts.append(tc.box("baffle_%d" % side, (0.004, 0.150, 0.170), (side * 0.068, 0, 0.110),
                            "plastic_white", 0.001, 1))
    return parts


def sponge():
    """Two-layer cellulose sponge: beige foam over a green scourer."""
    parts = []
    parts.append(tc.box("scourer", (0.112, 0.076, 0.010), (0, 0, 0.005), "leaf", 0.003, 1))
    parts.append(taper("foam", (0.108, 0.074), (0.112, 0.078), 0.030, (0, 0, 0.010),
                       "linen", 0.006, open_top=False))
    return parts


def scrub_brush():
    """Plastic hand brush; bristles are individual rods so the edge reads."""
    parts = []
    parts.append(tc.box("body", (0.140, 0.066, 0.030), (0, 0, 0.048), "plastic_red", 0.008, 2))
    parts.append(tc.rod("strap", (-0.048, 0, 0.062), (0.048, 0, 0.062), 0.011, "plastic_red", 7))
    for row in range(3):
        for column in range(4):
            x = -0.050 + column * 0.0334
            y = -0.020 + row * 0.020
            parts.append(tc.rod("bristle_%d_%d" % (row, column), (x, y, 0.034), (x, y, 0.002),
                                0.007, "linen", 5, taper=0.4))
    return parts


def dustpan():
    """Open scoop with a rubber lip, handle angled up the back."""
    parts = []
    parts.append(tc.box("floor", (0.255, 0.195, 0.006), (0, 0, 0.004), "plastic_red", 0.002, 1))
    for side in (-1, 1):
        parts.append(tc.box("side_%d" % side, (0.007, 0.195, 0.048), (side * 0.126, 0, 0.027),
                            "plastic_red", 0.002, 1))
    parts.append(tc.box("back", (0.255, 0.007, 0.050), (0, 0.097, 0.028), "plastic_red", 0.002, 1))
    parts.append(tc.box("lip", (0.255, 0.010, 0.004), (0, -0.100, 0.004), "rubber", 0.001, 1))
    parts.append(tc.rod("stem", (0, 0.098, 0.045), (0, 0.155, 0.150), 0.010, "plastic_red", 8))
    parts.append(tc.rod("grip", (0, 0.146, 0.132), (0, 0.172, 0.178), 0.013, "rubber", 8))
    return parts


def squeegee():
    """Window blade: soft rubber edge on a rigid bar with a short handle."""
    parts = []
    parts.append(tc.box("blade", (0.255, 0.005, 0.030), (0, -0.055, 0.030), "rubber", 0.001, 1))
    parts.append(tc.box("head", (0.255, 0.016, 0.018), (0, -0.050, 0.052), "plastic_red", 0.003, 1))
    parts.append(tc.rod("neck", (0, -0.050, 0.060), (0, 0.005, 0.072), 0.012, "plastic_red", 8))
    parts.append(tc.rod("handle", (0, 0.005, 0.072), (0, 0.095, 0.098), 0.016, "rubber", 8, taper=0.08))
    return parts


def cloth():
    """Folded cloth, softening the shelf it sits on. Bottom centre."""
    return [decor_common.cloth("cloth", 0.270, 0.270, "linen", folds=4, amplitude=0.010,
                               thickness=0.008, resolution=5, loc=(0, 0, 0.006))]


def face_mask():
    """Moulded cup mask with straps — hanging, so the origin is its bottom centre.

    A shallow shell, not a half-cylinder: at radius 0.13 and a 100-degree span the
    cup is 4 cm deep, which is what a surgical mask actually is.
    """
    parts = []
    parts.append(tc.band("cup", 0.130, 0.130, -0.045, 0.045, "plastic_white",
                         span=1.75, steps=10, thickness=0.004, loc=(0, 0.110, 0.045)))
    parts.append(tc.rod("nose_clip", (-0.030, -0.014, 0.070), (0.030, -0.014, 0.070), 0.003, "steel", 5))
    for side in (-1, 1):
        parts.append(
            tc.rod("strap_%d_a" % side, (side * 0.098, 0.027, 0.022), (side * 0.075, 0.075, 0.008),
                   0.003, "rubber", 5)
        )
        parts.append(
            tc.rod("strap_%d_b" % side, (side * 0.075, 0.075, 0.008), (side * 0.020, 0.085, -0.028),
                   0.003, "rubber", 5)
        )
    return parts


def apron():
    """Hangs from its neck loop, so the pivot is top centre.

    A hanging apron is nearly a rectangle, which is exactly why it can look like a
    sign board. Two cheap fixes: flare the hem into an A-line and bow the cloth
    around the body so the middle sits nearer the viewer than the edges.
    """
    parts = []
    skirt = sheet("skirt", 0.480, 0.520, "linen", thickness=0.006, res=6, bump=0.014,
                  loc=(0, 0, -0.360), rot=(math.pi / 2, 0, 0))
    for vertex in skirt.data.vertices:
        vertex.co.x *= 1.0 + max(0.0, -0.10 - vertex.co.z) * 0.35
        vertex.co.y -= 0.020 * math.cos(math.pi * vertex.co.x / 0.520)
    parts.append(skirt)

    bib = sheet("bib", 0.260, 0.200, "linen", thickness=0.006, res=4, bump=0.010,
                loc=(0, 0, -0.115), rot=(math.pi / 2, 0, 0))
    for vertex in bib.data.vertices:
        vertex.co.y -= 0.020 * math.cos(math.pi * vertex.co.x / 0.260)
    parts.append(bib)

    # A pocket is the "second read" the whole garment needs from two metres.
    parts.append(sheet("pocket", 0.180, 0.100, "linen", thickness=0.005, res=3, bump=0.004,
                       loc=(0, -0.028, -0.300), rot=(math.pi / 2, 0, 0)))
    for side in (-1, 1):
        parts.append(tc.rod("neck_%d" % side, (side * 0.105, 0.004, -0.020), (0, -0.020, 0.045),
                            0.006, "linen", 6))
        parts.append(tc.rod("tie_%d" % side, (side * 0.245, 0.004, -0.245), (side * 0.380, 0.012, -0.300),
                            0.005, "linen", 5))
    return parts


def caddy():
    """Two-compartment carry caddy with a wire bail."""
    parts = []
    parts.append(
        tc.shell(
            "body",
            [(0.150, 0.0), (0.165, 0.020), (0.175, 0.140)],
            "plastic_red",
            14,
            thickness=0.004,
        )
    )
    parts.append(tc.box("divider", (0.004, 0.190, 0.110), (0, 0, 0.072), "plastic_white", 0.001, 1))
    parts.append(tc.rod("bail_l", (-0.090, 0, 0.140), (0, 0, 0.255), 0.006, "steel", 6))
    parts.append(tc.rod("bail_r", (0, 0, 0.255), (0.090, 0, 0.140), 0.006, "steel", 6))
    parts.append(tc.rod("bail_grip", (-0.035, 0, 0.255), (0.035, 0, 0.255), 0.010, "rubber", 6))
    for side_x in (-1, 1):
        for side_y in (-1, 1):
            parts.append(
                tc.box("foot_%d_%d" % (side_x, side_y), (0.022, 0.022, 0.018),
                       (side_x * 0.120, side_y * 0.100, 0.009), "rubber", 0.003, 1)
            )
    return parts


BUILDERS = {
    "mop_bucket": mop_bucket,
    "bucket": bucket,
    "sponge": sponge,
    "scrub_brush": scrub_brush,
    "dustpan": dustpan,
    "squeegee": squeegee,
    "cloth": cloth,
    "face_mask": face_mask,
    "apron": apron,
    "caddy": caddy,
}
