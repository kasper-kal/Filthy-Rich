"""Helpers shared by the Phase 4 trash builders (FINALLY-3D.md §8).

Trash is the opposite problem to decor: the objects are 5 cm to 40 cm, there are
twenty-odd of them on screen at once, and the per-asset budget is 350 triangles.
So everything here is built to be *cheap and irregular*: few segments, one bevel
segment, and seeded noise instead of detail. A crushed can is a lathe with a
pinched middle, not a sculpt.

Reuses the generic shaping helpers from Phase 3 (`decor_common.lathe`, `place`,
`turn`, `ball`) so there is one implementation of each trick in the toolkit.

Origin rule: bottom centre, standing on z = 0 (§3.2). Lying items (a tipped
bottle, a dropped magazine) are modelled lying with their footprint centred on
x/y and z = 0 at the floor, so they still drop onto the floor correctly.
"""

import math
import random
import zlib

import bmesh
import bpy
import mathutils

import decor_common
import lib

TAU = math.pi * 2


def rng(name):
    """Deterministic generator seeded from the asset name, so rebuilds match."""
    return random.Random(zlib.crc32(name.encode()))


def box(name, size, loc=(0, 0, 0), mat="paper", bevel=0.002, segments=1, rot=(0, 0, 0)):
    """Small bevelled box. Bevel is clamped so a 6 mm foil packet cannot break."""
    bevel = min(bevel, min(size) * 0.3)
    obj = lib.box(name, size, loc, mat, bevel, segments)
    if any(rot):
        decor_common.turn(obj, rz=rot[2], rx=rot[0], ry=rot[1])
    return obj


def taper(name, bottom, top, height, loc=(0, 0, 0), mat="cardboard", bevel=0.002,
          open_top=False):
    """Tapered box from a bottom footprint to a smaller top one (bags, tubs)."""
    bw, bd = bottom
    tw, td = top
    verts = [
        (loc[0] - bw / 2, loc[1] - bd / 2, loc[2]),
        (loc[0] + bw / 2, loc[1] - bd / 2, loc[2]),
        (loc[0] + bw / 2, loc[1] + bd / 2, loc[2]),
        (loc[0] - bw / 2, loc[1] + bd / 2, loc[2]),
        (loc[0] - tw / 2, loc[1] - td / 2, loc[2] + height),
        (loc[0] + tw / 2, loc[1] - td / 2, loc[2] + height),
        (loc[0] + tw / 2, loc[1] + td / 2, loc[2] + height),
        (loc[0] - tw / 2, loc[1] + td / 2, loc[2] + height),
    ]
    faces = [(0, 3, 2, 1), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    if not open_top:
        faces.append((4, 5, 6, 7))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return lib.finish(obj, mat, min(bevel, min(bottom + top) * 0.3), 1)


def slab(name, points, thickness, loc=(0, 0, 0), mat="paper", bevel=0.001):
    """Extrude a closed 2D outline in XY up by `thickness` (shards, drywall, spills)."""
    n = len(points)
    verts = [(loc[0] + x, loc[1] + y, loc[2]) for x, y in points]
    verts += [(loc[0] + x, loc[1] + y, loc[2] + thickness) for x, y in points]
    faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, j + n, i + n))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return lib.finish(obj, mat, min(bevel, thickness * 0.3), 1)


def disc(name, radius, loc, mat, points=12, thickness=0.004, wobble=0.0, seed="",
         bevel=0.0008):
    """Irregular round slab — puddles, spills, sticky patches."""
    generator = rng(seed or name)
    outline = []
    for i in range(points):
        angle = TAU * i / points
        r = radius * (1.0 - wobble + generator.random() * wobble * 2.0)
        outline.append((r * math.cos(angle), r * math.sin(angle)))
    return slab(name, outline, thickness, loc, mat, bevel)


def sheet(name, width, depth, mat="paper", thickness=0.004, res=4, bump=0.01,
          loc=(0, 0, 0), rot=(0, 0, 0), corner_lift=0.0):
    """Crumpled flat thing: a coarse grid displaced by seeded noise, solidified.

    This is the whole recipe for tissues, wads, plastic bags, wet towels and
    crumpled paper: real thickness plus a broken silhouette reads as cloth at
    arm's length, and a grid stays under 120 triangles.
    """
    generator = rng(name)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=res, y_subdivisions=res, size=1.0)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (width, depth, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    for vertex in obj.data.vertices:
        vertex.co.z += (generator.random() - 0.35) * bump
        if corner_lift:
            lift = (vertex.co.x / width + 0.5) * (vertex.co.y / depth + 0.5)
            vertex.co.z += lift * corner_lift

    modifier = obj.modifiers.new("thick", "SOLIDIFY")
    modifier.thickness = thickness
    modifier.offset = 0.0
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    decor_common.place(obj, loc, rot)
    return lib.finish(obj, mat, 0.0, 2)


def blob(name, radius, loc, mat, scale=(1, 1, 1), roughness=0.22, segments=10,
         rings=6, seed="", bevel=0.0):
    """Lumpy ball: dust bunnies, tissue wads, squashed balloons, mud piles."""
    generator = rng(seed or name)
    obj = decor_common.ball(name, radius, loc, mat, scale, segments, rings)
    for vertex in obj.data.vertices:
        factor = 1.0 + (generator.random() - 0.5) * 2.0 * roughness
        vertex.co.x *= factor
        vertex.co.y *= factor
        vertex.co.z *= factor
    if bevel > 0:
        modifier = obj.modifiers.new("bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = math.radians(40)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def tube(name, radius, height, loc, mat, segments=10, bevel=0.0015, rot=(0, 0, 0)):
    """Straight cylinder with caps; ~6 triangles per side segment, no extra rings."""
    obj = decor_common.lathe(
        name,
        [(radius, 0.0), (radius, height)],
        mat,
        segments,
        loc,
    )
    if bevel > 0:
        modifier = obj.modifiers.new("bevel", "BEVEL")
        modifier.width = min(bevel, radius * 0.25, height * 0.25)
        modifier.segments = 1
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = math.radians(40)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if any(rot):
        decor_common.turn(obj, rz=rot[2], rx=rot[0], ry=rot[1])
    return obj


def strand(name, length, radius, loc, mat, rot=(0, 0, 0)):
    """One hair or fibre: a thin tapered prism, a handful of triangles."""
    tri = radius * 1.4
    outline = [(-tri, 0.0), (0.0, -tri), (length, -tri * 0.2), (length, tri * 0.2), (0.0, tri)]
    obj = slab(name, outline, radius * 2.0, loc, mat, bevel=0.0)
    if any(rot):
        decor_common.turn(obj, rz=rot[2], rx=rot[0], ry=rot[1])
    return obj


def pivot_turn(obj, pivot, angle=0.0, axis="x"):
    """Rotate a finished part about a world pivot — lids, box flaps, sock toes."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    matrix = mathutils.Matrix.Rotation(angle, 4, axis.upper())
    centre = mathutils.Vector(pivot)
    for vertex in obj.data.vertices:
        vertex.co = matrix @ (vertex.co - centre) + centre
    return obj


def scatter(pieces, name):
    """Join parts into one asset (AO bakes across the whole silhouette)."""
    return lib.join(pieces, name)
