"""Phase 4, part four — shards and rubble (FINALLY-3D.md §8).

Broken things are outlines, not boxes: a shard is a three-point extrusion with a
sharp edge, and a debris pile is four of them at different angles. Flat shading
on a shard is correct — a broken ceramic edge is not soft.
"""

import math

import decor_common
import lib
import trash_common as t

TAU = math.pi * 2


def _shard(name, size, loc, mat, angle=0.0):
    w, d = size
    outline = [(-w / 2, -d / 2), (w / 2, -d / 2 + d * 0.25), (w * 0.1, d / 2)]
    obj = t.slab(name, outline, 0.008, loc, mat, 0.0006)
    if angle:
        decor_common.turn(obj, rz=angle)
    return obj


def broken_item():
    parts = [
        _shard("shard_a", (0.09, 0.07), (0, 0, 0), "ceramic", 0.2),
        _shard("shard_b", (0.06, 0.05), (0.05, 0.03, 0.004), "ceramic", 1.4),
        _shard("shard_c", (0.04, 0.035), (-0.045, 0.02, 0.002), "ceramic", 2.6),
        t.blob("grit", 0.014, (0.01, -0.03, 0.004), "ceramic", (1.3, 1.0, 0.4), 0.4, 6, 4,
               seed="broken-grit"),
    ]
    return t.scatter(parts, "broken_item")


def damaged_item():
    parts = [
        _shard("shard_a", (0.11, 0.08), (-0.01, 0, 0), "plaster", 0.5),
        _shard("shard_b", (0.07, 0.06), (0.06, 0.02, 0.006), "plaster", 2.1),
        t.box("chunk", (0.05, 0.04, 0.035), (-0.05, -0.04, 0.017), "plaster", 0.003),
    ]
    return t.scatter(parts, "damaged_item")


def debris():
    generator = t.rng("debris")
    parts = []
    for i in range(5):
        size = generator.uniform(0.025, 0.06)
        parts.append(t.box(
            "chunk_%d" % i,
            (size, size * generator.uniform(0.6, 1.1), size * generator.uniform(0.35, 0.7)),
            (generator.uniform(-0.06, 0.06), generator.uniform(-0.05, 0.05), size * 0.2),
            "plaster" if i % 2 else "concrete",
            0.0025,
            rot=(generator.uniform(-0.2, 0.2), generator.uniform(-0.2, 0.2),
                 generator.uniform(0, TAU)),
        ))
    parts.append(t.blob("dust", 0.03, (0, 0, 0.006), "concrete", (1.4, 1.2, 0.3), 0.4, 6, 4,
                        seed="debris-dust"))
    return t.scatter(parts, "debris")


def sawdust_pile():
    parts = [
        t.blob("mound", 0.115, (0, 0, 0.004), "oak_light", (1.0, 0.85, 0.22), 0.35, 10, 5,
               seed="sawdust-mound"),
        t.blob("spill", 0.045, (0.09, -0.055, 0.003), "oak_light", (1.2, 1.0, 0.25), 0.4, 6, 4,
               seed="sawdust-spill"),
        t.blob("spill2", 0.03, (-0.075, 0.07, 0.002), "oak_light", (1.1, 1.0, 0.3), 0.4, 5, 4,
               seed="sawdust-spill2"),
    ]
    return t.scatter(parts, "sawdust_pile")


BUILDERS = {
    "broken_item": broken_item,
    "damaged_item": damaged_item,
    "debris": debris,
    "sawdust_pile": sawdust_pile,
}
