"""Phase 4, part five — the four chunky spills (FINALLY-3D.md §8.1).

Liquid spills are decals (§13). These four are the ones that need 1–2 cm of
height to read as *stuff* rather than a stain: paint, food, mud and a puddle
with a lip. Each is an irregular disc with a wobbly outline, and nothing else —
the wobble is cheaper and more convincing than any sculpting at this size.
"""

import math

import decor_common
import lib
import trash_common as t

TAU = math.pi * 2


def spill_paint():
    pool = t.disc("pool", 0.17, (0, 0, 0), "paint_white", points=14, thickness=0.008,
                  wobble=0.28, seed="spill-paint")
    drip = t.blob("drip", 0.035, (0.16, 0.02, 0.005), "paint_white", (1.6, 0.7, 0.8), 0.35,
                  7, 4, seed="spill-paint-drip")
    splash = t.blob("splash", 0.022, (-0.15, -0.09, 0.004), "paint_white", (1.3, 1.0, 0.7),
                    0.4, 6, 4, seed="spill-paint-splash")
    return t.scatter([pool, drip, splash], "spill_paint")


def spill_food():
    pool = t.disc("pool", 0.10, (0, 0, 0), "grease", points=12, thickness=0.008,
                  wobble=0.3, seed="spill-food")
    parts = [pool]
    for i, (x, y, r) in enumerate(((0.03, 0.02, 0.018), (-0.04, -0.01, 0.014),
                                   (0.01, -0.05, 0.011))):
        parts.append(t.blob("lump_%d" % i, r, (x, y, 0.006), "fruit_orange",
                            (1.1, 1.0, 0.6), 0.35, 6, 4, seed="spill-food-%d" % i))
    return t.scatter(parts, "spill_food")


def spill_mud():
    pool = t.disc("pool", 0.14, (0, 0, 0), "grime", points=13, thickness=0.009,
                  wobble=0.32, seed="spill-mud")
    ridge = t.disc("ridge", 0.10, (0.03, 0.02, 0.008), "grime", points=9, thickness=0.006,
                   wobble=0.3, seed="spill-mud-ridge")
    clod = t.blob("clod", 0.03, (-0.12, -0.06, 0.004), "grime", (1.2, 1.0, 0.6), 0.4, 6, 4,
                  seed="spill-mud-clod")
    return t.scatter([pool, ridge, clod], "spill_mud")


def spill_puddle():
    return t.disc("spill_puddle", 0.20, (0, 0, 0), "glass_clear", points=12, thickness=0.003,
                  wobble=0.26, seed="spill-puddle")


BUILDERS = {
    "spill_paint": spill_paint,
    "spill_food": spill_food,
    "spill_mud": spill_mud,
    "spill_puddle": spill_puddle,
}
