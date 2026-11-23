"""Phase 4, part two — cans, bottles, cups and tubs (FINALLY-3D.md §8).

Drink containers are lathes. The only tricks are a real rim (two rings at the
top cost 24 triangles and kill the "cylinder" read), a label band as a separate
material, and a crushed variant with a pinched profile.
"""

import math

import decor_common
import lib
import trash_common as t

TAU = math.pi * 2


def beer_can():
    body = decor_common.lathe(
        "body",
        [(0.033, 0.0), (0.033, 0.104), (0.0312, 0.112), (0.0312, 0.117), (0.0285, 0.12)],
        "steel",
        12,
        (0, 0, 0),
    )
    label = decor_common.lathe(
        "label", [(0.0334, 0.022), (0.0334, 0.078)], "paper", 12, (0, 0, 0)
    )
    tab = t.box("tab", (0.016, 0.011, 0.0025), (0, 0.004, 0.1215), "steel", 0.0008)
    return t.scatter([body, label, tab], "beer_can")


def beer_can_crushed():
    body = decor_common.lathe(
        "body",
        [
            (0.036, 0.0),
            (0.031, 0.018),
            (0.022, 0.042),
            (0.030, 0.062),
            (0.033, 0.082),
            (0.029, 0.09),
        ],
        "steel",
        10,
        (0, 0, 0),
    )
    t.pivot_turn(body, (0, 0, 0.0), 0.12, "y")
    label = decor_common.lathe(
        "label", [(0.0335, 0.012), (0.0335, 0.05)], "paper", 10, (0, 0, 0)
    )
    t.pivot_turn(label, (0, 0, 0.0), 0.12, "y")
    return t.scatter([body, label], "beer_can_crushed")


def _bottle(name, glass, label_text, cap_mat):
    body = decor_common.lathe(
        "body",
        [
            (0.035, 0.0),
            (0.035, 0.132),
            (0.0295, 0.152),
            (0.0145, 0.172),
            (0.0145, 0.208),
            (0.0165, 0.212),
        ],
        glass,
        10,
        (0, 0, 0),
    )
    label = decor_common.lathe(
        "label", [(0.0356, 0.052), (0.0356, 0.104)], label_text, 10, (0, 0, 0)
    )
    cap = decor_common.lathe(
        "cap", [(0.0168, 0.207), (0.0168, 0.216), (0.0155, 0.218)], cap_mat, 10, (0, 0, 0)
    )
    return t.scatter([body, label, cap], name)


def bottle():
    return _bottle("bottle", "glass_clear", "paper", "steel")


def beer_bottle():
    return _bottle("beer_bottle", "glass_green", "paper", "brass")


def bottle_tipped():
    body = decor_common.lathe(
        "body",
        [
            (0.035, 0.0),
            (0.035, 0.132),
            (0.0295, 0.152),
            (0.0145, 0.172),
            (0.0145, 0.208),
            (0.0165, 0.212),
        ],
        "glass_green",
        10,
        (0, 0, 0.036),
    )
    t.pivot_turn(body, (0, 0, 0.036), math.pi / 2, "y")
    decor_common.place(body, (-0.107, 0, 0))
    label = t.tube("label", 0.0356, 0.05, (-0.045, 0, 0.036), "paper", 10, 0.0008,
                   rot=(0, math.pi / 2, 0))
    cap = t.tube("cap", 0.017, 0.011, (0.109, 0, 0.036), "brass", 10, 0.0008,
                 rot=(0, math.pi / 2, 0))
    return t.scatter([body, label, cap], "bottle_tipped")


def red_solo_cup():
    body = decor_common.lathe(
        "body",
        [(0.028, 0.0), (0.0295, 0.012), (0.040, 0.096), (0.042, 0.10), (0.0395, 0.10)],
        "plastic_red",
        10,
        (0, 0, 0),
    )
    rim = decor_common.lathe(
        "rim", [(0.0405, 0.092), (0.0405, 0.098)], "plastic_red", 10, (0, 0, 0)
    )
    return t.scatter([body, rim], "red_solo_cup")


def food_container():
    tub = t.taper("tub", (0.10, 0.10), (0.118, 0.118), 0.042, (0, 0, 0), "plastic_white", 0.002)
    lid = t.box("lid", (0.124, 0.124, 0.007), (0.006, -0.004, 0.046), "plastic_white", 0.0018)
    decor_common.turn(lid, rz=0.16)
    scrap = t.blob("scrap", 0.03, (0.01, 0.0, 0.03), "fruit_orange", (1.2, 0.9, 0.4), 0.3, 6, 4,
                   seed="food-scrap")
    return t.scatter([tub, lid, scrap], "food_container")


def tape_roll():
    return lib.torus("tape_roll", 0.03, 0.012, (0, 0, 0.012), "plastic_white",
                     major_segments=10, minor_segments=6)


def paint_can():
    body = t.tube("body", 0.075, 0.19, (0, 0, 0), "steel", 10, 0.0015)
    rim = lib.torus("rim", 0.075, 0.0045, (0, 0, 0.188), "steel",
                    major_segments=10, minor_segments=4)
    lid = t.disc("lid", 0.068, (0, 0, 0.188), "paint_white", points=10, thickness=0.004,
                 wobble=0.05, seed="paint-lid")
    drip = t.blob("drip", 0.016, (0.062, 0.026, 0.184), "paint_white", (1.4, 0.8, 1.2), 0.35,
                  6, 4, seed="paint-drip")
    return t.scatter([body, rim, lid, drip], "paint_can")


def chip_bag():
    body = t.taper("body", (0.10, 0.05), (0.14, 0.062), 0.19, (0, 0, 0), "foil", 0.002)
    top = t.box("top", (0.146, 0.03, 0.012), (0, 0, 0.196), "foil", 0.0015)
    crimp = t.box("crimp", (0.144, 0.004, 0.014), (0, 0.008, 0.199), "foil", 0.0008)
    seam = t.box("seam", (0.002, 0.05, 0.19), (0.068, 0, 0.095), "foil", 0.0008)
    return t.scatter([body, top, crimp, seam], "chip_bag")


def cigarette_butt():
    body = t.tube("body", 0.0038, 0.018, (-0.012, 0, 0.004), "paper", 6, 0.0006,
                  rot=(0, math.pi / 2, 0))
    filter_band = t.tube("filter", 0.0042, 0.011, (0.004, 0, 0.004), "paper", 6, 0.0005,
                         rot=(0, math.pi / 2, 0))
    ash = t.blob("ash", 0.0055, (-0.016, 0, 0.004), "grime", (1.3, 0.9, 0.9), 0.3, 5, 4,
                 seed="ash")
    return t.scatter([body, filter_band, ash], "cigarette_butt")


BUILDERS = {
    "beer_can": beer_can,
    "beer_can_crushed": beer_can_crushed,
    "bottle": bottle,
    "bottle_tipped": bottle_tipped,
    "beer_bottle": beer_bottle,
    "red_solo_cup": red_solo_cup,
    "food_container": food_container,
    "tape_roll": tape_roll,
    "paint_can": paint_can,
    "chip_bag": chip_bag,
    "cigarette_butt": cigarette_butt,
}
