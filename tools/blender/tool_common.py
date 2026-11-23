"""Helpers shared by the Phase 5 cleaning-kit builders (FINALLY-3D.md §9).

Tools are the opposite problem to trash: there are twenty of them in total but
one is twelve centimetres from the camera for the whole game, so the budget is
1,800 triangles per asset instead of 350. Everything here is therefore built to
be *clean* rather than cheap: real round profiles, capped joints, bevelled
plastic.

Two things make this group different from every group before it:

- Assets are **not** joined into one mesh. The game looks up `liquid` by name to
  drive the spray level, and the `SOC_*` empties are the only honest way to tell
  it where the nozzle, mop head and vacuum head actually are (§15.3).
- Sockets are authored **unrotated**, so their local axes are the asset's axes:
  in three.js a socket's local +Z is the model's forward, +Y is up. Fixed code
  directions then work under any HUD rotation that a hand-tuned offset would not.

Origin rules: the four held tools and both gloves use a **grip-centre** pivot
(§3.2) so the fist lands in the same place on every one of them; everything else
(buckets, caddy, apron on its hook) uses floor centre or top centre as noted.

Reuses the shaping helpers from Phase 3/4 rather than growing a second toolkit.
"""

import math
import random
import zlib

import bmesh
import bpy
import mathutils

import decor_common
import lib
from trash_common import blob, box, disc, sheet, taper  # noqa: F401 — re-exported

TAU = math.pi * 2


def rng(name):
    """Deterministic generator seeded from the asset name (§3.3)."""
    return random.Random(zlib.crc32(name.encode()))


# --------------------------------------------------------------- primitives
def rod(name, a, b, radius, mat, segments=8, taper=0.0):
    """Cylinder from point `a` to point `b` — shafts, hoses, fingers, straps.

    Nearly everything in this group is a tube at some angle, so this replaces
    dozens of "cylinder plus a rotation" call sites.
    """
    start = mathutils.Vector(a)
    delta = mathutils.Vector(b) - start
    profile = [(radius, 0.0), (radius * (1.0 - taper), delta.length)]
    obj = decor_common.lathe(name, profile, mat, segments, start)
    matrix = delta.to_track_quat("Z", "Y").to_matrix().to_4x4()
    return _transform_about(obj, start, matrix)


def _transform_about(obj, pivot, matrix):
    """Rotate a finished mesh about a world point without moving its origin."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    point = mathutils.Vector(pivot)
    for vertex in obj.data.vertices:
        vertex.co = matrix @ (vertex.co - point) + point
    return obj


def _surface(name, verts, faces, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return lib.finish(obj, mat, 0.0, 2)


def band(name, radius_low, radius_high, z_low, z_high, mat, span=1.2, steps=6,
         centre=-math.pi / 2, thickness=0.002, loc=(0, 0, 0)):
    """Curved strip on the outside of a round body: sight glasses, volume windows.

    `span` near 2*pi turns it into a ring (filters, bumpers). Solidified, so it
    has honest edges from any angle instead of being a single-sided cheat.
    """
    verts, faces = [], []
    for i in range(steps + 1):
        angle = centre + span * (i / steps - 0.5)
        cos, sin = math.cos(angle), math.sin(angle)
        verts.append((loc[0] + radius_low * cos, loc[1] + radius_low * sin, loc[2] + z_low))
        verts.append((loc[0] + radius_high * cos, loc[1] + radius_high * sin, loc[2] + z_high))
    for i in range(steps):
        base = i * 2
        faces.append((base, base + 1, base + 3, base + 2))

    obj = _surface(name, verts, faces, mat)
    modifier = obj.modifiers.new("skin", "SOLIDIFY")
    modifier.thickness = thickness
    modifier.offset = 0.0
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def shell(name, profile, mat, segments=16, loc=(0, 0, 0), thickness=0.006,
          cap_top=False):
    """Revolved profile with an open mouth — buckets, caddy, wringer wells.

    `decor_common.lathe` always caps the top, which turns a bucket into a can.
    The shell is solidified so the inside of the bucket is visible rather than
    being a backface hole.
    """
    verts, faces = [], []
    count = len(profile)
    for i in range(segments):
        angle = TAU * i / segments
        cos, sin = math.cos(angle), math.sin(angle)
        for radius, z in profile:
            verts.append((loc[0] + radius * cos, loc[1] + radius * sin, loc[2] + z))
    for i in range(segments):
        j = (i + 1) % segments
        for k in range(count - 1):
            faces.append((i * count + k, j * count + k, j * count + k + 1, i * count + k + 1))
    if cap_top:
        top = len(verts)
        verts.append((loc[0], loc[1], loc[2] + profile[-1][1]))
        for i in range(segments):
            faces.append((i * count + count - 1, (i + 1) % segments * count + count - 1, top))

    obj = _surface(name, verts, faces, mat)
    if thickness > 0:
        modifier = obj.modifiers.new("wall", "SOLIDIFY")
        modifier.thickness = thickness
        modifier.offset = -1.0
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def socket(name, loc):
    """Empty the game reads by name (§15.3). Unrotated on purpose — see module doc."""
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.01
    empty.location = loc
    bpy.context.collection.objects.link(empty)
    return empty


def move_origin(obj, origin):
    """Move a mesh's node origin without baking it in (see `lib.export_hierarchy`).

    Used for the spray liquid: scaling that node in game must shrink the column
    toward the bottle's base, not toward the grip 17 cm above it.
    """
    point = mathutils.Vector(origin)
    for vertex in obj.data.vertices:
        vertex.co -= point
    obj.location = origin
    obj["keep_origin"] = True
    return obj


def mirror_x(obj):
    """Mirror a finished part across X, winding included (the left glove).

    The object's own origin has to flip as well: `lib.box` and the blob helpers
    leave their placement in `obj.location` and keep the mesh centred on it, so
    negating only the vertices would leave the palm on the wrong side of the fist.
    """
    obj.location.x = -obj.location.x
    for vertex in obj.data.vertices:
        vertex.co.x = -vertex.co.x
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for face in bm.faces:
        face.normal_flip()
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def ring(name, major, minor, loc, mat, rot=(0, 0, 0), major_segments=14, minor_segments=5):
    return lib.torus(name, major, minor, loc, mat, rot, major_segments, minor_segments)


# ------------------------------------------------------------------- export
def finish(parts, group, name):
    lib.bake_ao_all(parts)
    return lib.export_hierarchy(parts, group, name)
