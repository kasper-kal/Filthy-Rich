"""Phase 4, part one — paper, card and soft flat litter (FINALLY-3D.md §8).

Everything here is thin, crumpled or folded: pizza boxes, bags, magazines,
newspapers, cardboard, a tissue, a cobweb. The read comes from the silhouette
(an open lid, a bent flap, a torn edge), never from segmentation.
"""

import math

import decor_common
import lib
import trash_common as t

TAU = math.pi * 2


def pizza_box():
    tray = t.box("tray", (0.35, 0.35, 0.026), (0, 0, 0.013), "cardboard", 0.003)
    lid = t.box("lid", (0.35, 0.35, 0.008), (0, 0, 0.030), "cardboard", 0.003)
    t.pivot_turn(lid, (0, 0.175, 0.030), -0.26, "x")
    grease = t.disc("grease", 0.085, (0, 0.02, 0.026), "grease", points=10, thickness=0.001,
                    wobble=0.2, seed="pizza-grease")
    return t.scatter([tray, lid, grease], "pizza_box")


def pizza_box_closed():
    tray = t.box("tray", (0.35, 0.35, 0.026), (0, 0, 0.013), "cardboard", 0.003)
    lid = t.box("lid", (0.35, 0.35, 0.008), (0, 0, 0.030), "cardboard", 0.003)
    patch = t.disc("patch", 0.07, (0.09, -0.06, 0.034), "grease", points=8, thickness=0.001,
                   wobble=0.25, seed="pizza-closed")
    return t.scatter([tray, lid, patch], "pizza_box_closed")


def takeout_bag():
    body = t.taper("body", (0.15, 0.10), (0.135, 0.088), 0.24, (0, 0, 0), "cardboard", 0.002,
                   open_top=True)
    fold = t.box("fold", (0.14, 0.092, 0.012), (0, 0, 0.246), "cardboard", 0.002)
    crease = t.box("crease", (0.002, 0.088, 0.24), (0.02, 0, 0.12), "cardboard", 0.0006)
    return t.scatter([body, fold, crease], "takeout_bag")


def condom_wrapper():
    foil = t.box("foil", (0.05, 0.05, 0.006), (0, 0, 0.003), "foil", 0.0012)
    seam = t.box("seam", (0.052, 0.004, 0.007), (0, 0, 0.0035), "foil", 0.0008)
    tab = t.box("tab", (0.014, 0.02, 0.003), (0.031, 0, 0.0015), "foil", 0.0006)
    t.pivot_turn(tab, (0.024, 0, 0.0015), 0.35, "y")
    return t.scatter([foil, seam, tab], "condom_wrapper")


def tissue():
    return t.sheet("tissue", 0.10, 0.08, "paper", 0.0025, res=4, bump=0.016,
                   corner_lift=0.006)


def tissue_wad():
    ball = t.blob("ball", 0.028, (0, 0, 0.020), "paper", (1.0, 0.9, 0.75), 0.30, 8, 6,
                  seed="tissue-wad")
    tag = t.sheet("tag", 0.03, 0.03, "paper", 0.002, res=3, bump=0.008,
                  loc=(0.024, 0.0, 0.01))
    return t.scatter([ball, tag], "tissue_wad")


def _cover_curl(cover):
    t.pivot_turn(cover, (-0.11, 0, 0.020), -0.10, "y")


def magazine():
    pages = t.box("pages", (0.22, 0.28, 0.018), (0, 0, 0.012), "paper", 0.0015)
    cover = t.box("cover", (0.22, 0.28, 0.003), (0, 0, 0.0225), "paper", 0.0012)
    _cover_curl(cover)
    spine = t.box("spine", (0.006, 0.28, 0.024), (-0.108, 0, 0.012), "paper", 0.001)
    return t.scatter([pages, cover, spine], "magazine")


def magazine_open():
    left = t.box("left", (0.22, 0.28, 0.004), (-0.11, 0, 0.004), "paper", 0.0008)
    right = t.box("right", (0.22, 0.28, 0.004), (0.11, 0, 0.004), "paper", 0.0008)
    t.pivot_turn(left, (0, 0, 0.004), 0.14, "y")
    t.pivot_turn(right, (0, 0, 0.004), -0.14, "y")
    ridge = t.box("ridge", (0.008, 0.28, 0.006), (0, 0, 0.026), "paper", 0.0008)
    return t.scatter([left, right, ridge], "magazine_open")


def old_magazine():
    pages = t.box("pages", (0.22, 0.28, 0.02), (0, 0, 0.014), "paper", 0.0015)
    cover = t.box("cover", (0.22, 0.28, 0.003), (0, 0, 0.0255), "paper", 0.0012)
    _cover_curl(cover)
    stain = t.disc("stain", 0.075, (0.04, -0.05, 0.027), "grime", points=9, thickness=0.001,
                   wobble=0.3, seed="old-mag")
    return t.scatter([pages, cover, stain], "old_magazine")


def newspaper_stack():
    generator = t.rng("newspaper-stack")
    parts = []
    for i in range(6):
        sheet = t.box(
            "sheet_%d" % i,
            (0.30 - i * 0.006, 0.22 - i * 0.004, 0.012),
            (generator.uniform(-0.012, 0.012), generator.uniform(-0.01, 0.01), 0.006 + i * 0.0125),
            "paper",
            0.0018,
        )
        decor_common.turn(sheet, rz=generator.uniform(-0.09, 0.09))
        parts.append(sheet)
    return t.scatter(parts, "newspaper_stack")


def cardboard_box():
    body = t.taper("body", (0.40, 0.40), (0.40, 0.40), 0.27, (0, 0, 0), "cardboard", 0.0025,
                   open_top=True)
    flaps = []
    for i, (pivot, angle, length) in enumerate((
        ((0, -0.20, 0.27), 1.70, 0.19),
        ((0, 0.20, 0.27), -1.62, 0.19),
        ((-0.20, 0, 0.27), 1.75, 0.19),
        ((0.20, 0, 0.27), -1.55, 0.19),
    )):
        if i < 2:
            flap = t.box("flap_%d" % i, (0.38, length, 0.006), (pivot[0], pivot[1] * 0.5, pivot[2]),
                         "cardboard", 0.0015)
        else:
            flap = t.box("flap_%d" % i, (length, 0.38, 0.006), (pivot[0] * 0.5, pivot[1], pivot[2]),
                         "cardboard", 0.0015)
        t.pivot_turn(flap, pivot, angle, "x" if i < 2 else "y")
        flaps.append(flap)
    tape = t.box("tape", (0.05, 0.41, 0.002), (0, 0, 0.271), "paper", 0.0006)
    return t.scatter([body] + flaps + [tape], "cardboard_box")


def cardboard_box_crushed():
    body = t.taper("body", (0.42, 0.42), (0.34, 0.28), 0.11, (0, 0, 0), "cardboard", 0.002,
                   open_top=True)
    flap_a = t.box("flap_a", (0.34, 0.16, 0.005), (0, -0.11, 0.11), "cardboard", 0.0012)
    t.pivot_turn(flap_a, (0, -0.18, 0.11), 0.55, "x")
    flap_b = t.box("flap_b", (0.16, 0.30, 0.005), (0.12, 0.02, 0.11), "cardboard", 0.0012)
    t.pivot_turn(flap_b, (0.19, 0, 0.11), -0.9, "y")
    crease = t.box("crease", (0.20, 0.004, 0.006), (0, -0.02, 0.105), "cardboard", 0.0008)
    return t.scatter([body, flap_a, flap_b, crease], "cardboard_box_crushed")


def drywall_piece():
    jag = [(0.15, -0.10), (0.08, -0.115), (0.02, -0.085), (-0.06, -0.10),
           (-0.15, -0.07), (-0.135, 0.02), (-0.05, 0.01), (0.04, 0.06),
           (0.13, 0.035), (0.15, 0.09)]
    board = t.slab("board", jag, 0.02, (0, 0, 0), "plaster", 0.0015)
    backing = t.slab("backing", [(x * 0.94, y * 0.94) for x, y in jag], 0.003, (0, 0, -0.004),
                     "cardboard", 0.0008)
    return t.scatter([board, backing], "drywall_piece")


def confetti():
    return t.slab("confetti", [(-0.01, -0.008), (0.004, -0.01), (0.01, 0.006), (-0.006, 0.009)],
                  0.0012, (0, 0, 0), "fabric_rust", 0.0)


def sticky_patch():
    return t.disc("sticky_patch", 0.075, (0, 0, 0), "grease", points=9, thickness=0.002,
                  wobble=0.35, seed="sticky-patch")


def plastic_sheet():
    sheet = t.sheet("sheet", 0.50, 0.50, "plastic_white", 0.002, res=5, bump=0.05,
                    corner_lift=0.03)
    return t.scatter([sheet], "plastic_sheet")


def wet_towel():
    cloth = t.sheet("cloth", 0.30, 0.30, "linen", 0.008, res=4, bump=0.024,
                    corner_lift=0.015)
    fold = t.sheet("fold", 0.14, 0.10, "linen", 0.006, res=3, bump=0.012,
                   loc=(-0.07, 0.02, 0.012))
    return t.scatter([cloth, fold], "wet_towel")


def cobweb():
    parts = []
    for i in range(6):
        angle = TAU * i / 6
        parts.append(t.strand("ray_%d" % i, 0.11, 0.0012, (0, 0, 0.0012), "paper",
                              rot=(0, 0, angle)))
    arc = t.disc("arc", 0.055, (0, 0, 0), "paper", points=8, thickness=0.0012, wobble=0.1,
                 seed="cobweb")
    return t.scatter(parts + [arc], "cobweb")


BUILDERS = {
    "pizza_box": pizza_box,
    "pizza_box_closed": pizza_box_closed,
    "takeout_bag": takeout_bag,
    "condom_wrapper": condom_wrapper,
    "tissue": tissue,
    "tissue_wad": tissue_wad,
    "magazine": magazine,
    "magazine_open": magazine_open,
    "old_magazine": old_magazine,
    "newspaper_stack": newspaper_stack,
    "cardboard_box": cardboard_box,
    "cardboard_box_crushed": cardboard_box_crushed,
    "drywall_piece": drywall_piece,
    "confetti": confetti,
    "sticky_patch": sticky_patch,
    "plastic_sheet": plastic_sheet,
    "wet_towel": wet_towel,
    "cobweb": cobweb,
}
