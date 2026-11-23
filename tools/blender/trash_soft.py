"""Phase 4, part three — soft trash (FINALLY-3D.md §8).

Socks, hair, balloons, plastic bags, dust. All of it is lumpy, so all of it is a
noise-displaced ball or a crumpled sheet; the only modelling decisions are the
silhouette and which end is heavier.
"""

import math

import decor_common
import lib
import trash_common as t

TAU = math.pi * 2


def _sock(name, loc, rz, segments, rings):
    """Foot slung forward, a bunched leg standing up behind it, cuff on top.

    The first version had the cuff as a tilted tube and it read as a flag
    sticking out of a lump; the leg has to be a second lump with the cuff ring
    upright on the end of it.
    """
    foot = t.blob("%s_foot" % name, 0.034, (loc[0] + 0.028, loc[1], 0.018), "fabric_olive",
                  (2.0, 0.85, 0.55), 0.26, segments, rings, seed=name + "-foot")
    leg = t.blob("%s_leg" % name, 0.030, (loc[0] - 0.034, loc[1] + 0.004, 0.037),
                 "fabric_olive", (1.0, 0.95, 1.25), 0.22, segments, rings, seed=name + "-leg")
    cuff = t.tube("%s_cuff" % name, 0.0305, 0.016, (loc[0] - 0.035, loc[1] + 0.004, 0.064),
                  "fabric_olive", 8, 0.001)
    decor_common.turn(foot, rz=rz)
    decor_common.turn(leg, rz=rz)
    return [foot, leg, cuff]


def sock():
    return t.scatter(_sock("sock", (0, 0, 0), 0.0, 8, 6), "sock")


def sock_pair():
    # Two socks at half the ring count: 376 triangles was over the 350 target and
    # the pair is never seen close enough for the extra rings to matter.
    parts = _sock("sock_a", (0.012, 0.008, 0), 0.12, 6, 4)
    parts += _sock("sock_b", (-0.014, -0.012, 0), -0.55, 6, 4)
    return t.scatter(parts, "sock_pair")


def hair_clump():
    # All the strands sweep roughly the same way. A full 360-degree fan plus a
    # round root reads as a spider, which is the one thing floor hair must not
    # look like.
    generator = t.rng("hair-clump")
    parts = [t.blob("root", 0.016, (0, 0, 0.005), "rubber", (1.7, 1.2, 0.45), 0.4, 6, 4,
                    seed="hair-root")]
    for i in range(7):
        parts.append(t.strand(
            "hair_%d" % i,
            generator.uniform(0.03, 0.07),
            generator.uniform(0.0008, 0.0016),
            (generator.uniform(-0.012, 0.012), generator.uniform(-0.012, 0.012), 0.005),
            "rubber",
            rot=(0, 0, 0.35 + generator.uniform(-0.5, 0.5)),
        ))
    return t.scatter(parts, "hair_clump")


def dog_hair_tuft():
    generator = t.rng("dog-hair")
    parts = [t.blob("root", 0.012, (0, 0, 0.004), "linen", (1.6, 1.1, 0.4), 0.45, 5, 3,
                    seed="dog-root")]
    for i in range(5):
        parts.append(t.strand(
            "tuft_%d" % i,
            generator.uniform(0.025, 0.05),
            generator.uniform(0.001, 0.0018),
            (generator.uniform(-0.008, 0.008), generator.uniform(-0.008, 0.008), 0.002),
            "linen",
            rot=(0, 0, -0.3 + generator.uniform(-0.55, 0.55)),
        ))
    return t.scatter(parts, "dog_hair_tuft")


def balloon():
    body = t.blob("body", 0.055, (0, 0, 0.016), "fabric_rust", (0.9, 1.35, 0.28), 0.38, 9, 6,
                  seed="balloon-deflated")
    knot = t.box("knot", (0.012, 0.008, 0.008), (0, 0.072, 0.01), "fabric_rust", 0.0015)
    return t.scatter([body, knot], "balloon")


def balloon_inflated():
    body = t.blob("body", 0.115, (0, 0, 0.115), "fruit_red", (1.0, 1.0, 1.08), 0.04, 12, 8,
                  seed="balloon-inflated")
    knot = t.box("knot", (0.018, 0.014, 0.012), (0, 0, 0.006), "fruit_red", 0.0018)
    neck = t.tube("neck", 0.012, 0.03, (0, 0, 0.004), "fruit_red", 8, 0.001)
    return t.scatter([body, knot, neck], "balloon_inflated")


def plastic_bag():
    body = t.sheet("body", 0.25, 0.20, "plastic_white", 0.0018, res=4, bump=0.05,
                   corner_lift=0.05)
    handle_a = lib.torus("handle_a", 0.021, 0.0035, (-0.07, 0.0, 0.048), "plastic_white",
                         rot=(math.pi / 2, 0, 0), major_segments=8, minor_segments=4)
    handle_b = lib.torus("handle_b", 0.021, 0.0035, (0.07, 0.0, 0.048), "plastic_white",
                         rot=(math.pi / 2, 0, 0), major_segments=8, minor_segments=4)
    return t.scatter([body, handle_a, handle_b], "plastic_bag")


def dust_bunny():
    parts = [
        t.blob("core", 0.038, (0, 0, 0.024), "linen", (1.2, 1.0, 0.8), 0.45, 8, 6,
               seed="dust-core"),
        t.blob("wisp", 0.022, (0.032, 0.014, 0.012), "linen", (1.3, 1.0, 0.5), 0.5, 6, 4,
               seed="dust-wisp"),
        t.blob("wisp2", 0.018, (-0.028, -0.018, 0.01), "linen", (1.2, 1.1, 0.5), 0.5, 6, 4,
               seed="dust-wisp2"),
    ]
    return t.scatter(parts, "dust_bunny")


def lint_ball():
    return t.blob("lint_ball", 0.026, (0, 0, 0.016), "paper", (1.15, 1.0, 0.75), 0.35, 8, 5,
                  seed="lint")


BUILDERS = {
    "sock": sock,
    "sock_pair": sock_pair,
    "hair_clump": hair_clump,
    "dog_hair_tuft": dog_hair_tuft,
    "balloon": balloon,
    "balloon_inflated": balloon_inflated,
    "plastic_bag": plastic_bag,
    "dust_bunny": dust_bunny,
    "lint_ball": lint_ball,
}
