"""Helpers shared by the Phase 3 decor builders (FINALLY-3D.md §7).

Everything here sits on top of lib.py: `lathe` for turned shapes (cups, bowls,
bottles), `cloth` for soft flat things, `ball`/`cone` for fruit and lampshades.
All of them return a finished object, so a builder is just a list of parts plus
`lib.join(parts, name)`.
"""

import math

import bmesh
import bpy

import lib

TAU = math.pi * 2


def lathe(name, profile, mat, segments=20, loc=(0, 0, 0), bevel=0.0):
    """Revolve a (radius, z) profile around Z. Adds cylindrical UVs."""
    verts, faces = [], []
    n = len(profile)
    for i in range(segments):
        angle = TAU * i / segments
        cos, sin = math.cos(angle), math.sin(angle)
        for radius, z in profile:
            verts.append((loc[0] + radius * cos, loc[1] + radius * sin, loc[2] + z))

    for i in range(segments):
        j = (i + 1) % segments
        for k in range(n - 1):
            faces.append((i * n + k, j * n + k, j * n + k + 1, i * n + k + 1))

    if profile[0][0] > 0.0005:
        base = len(verts)
        verts.append((loc[0], loc[1], loc[2] + profile[0][1]))
        for i in range(segments):
            faces.append(((i + 1) % segments * n, i * n, base))
    if profile[-1][0] > 0.0005:
        centre = len(verts)
        verts.append((loc[0], loc[1], loc[2] + profile[-1][1]))
        for i in range(segments):
            faces.append((i * n + n - 1, (i + 1) % segments * n + n - 1, centre))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    uvs = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for loop_index in poly.loop_indices:
            vertex = mesh.loops[loop_index].vertex_index
            if vertex < segments * n:
                uvs.data[loop_index].uv = (vertex // n / segments, (vertex % n) / max(1, n - 1))
            else:
                uvs.data[loop_index].uv = (0.5, 0.5)

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return lib.finish(obj, mat, bevel, 2)


def cloth(name, width, depth, mat, folds=3, amplitude=0.012, thickness=0.012,
          resolution=6, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Subdivided sheet with folds along X, given real thickness, lying flat."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=resolution, y_subdivisions=resolution, size=1.0)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (width, depth, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for vertex in obj.data.vertices:
        vertex.co.z += amplitude * math.sin(folds * TAU * (vertex.co.x / width + 0.13))
    modifier = obj.modifiers.new("thick", "SOLIDIFY")
    modifier.thickness = thickness
    modifier.offset = 0.0
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # No bevel: re-bevelling a subdivided sheet adds ~1,000 triangles and the
    # softened silhouette is already the whole point of the grid.
    return place(obj, loc, rot) and lib.finish(obj, mat, 0.0, 2)


def place(obj, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Move (and optionally turn) an object, baking both into the mesh."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.location = (obj.location.x + loc[0], obj.location.y + loc[1], obj.location.z + loc[2])
    if any(rot):
        obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def ball(name, radius, loc, mat, scale=(1, 1, 1), segments=12, rings=8, bevel=0.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=segments, ring_count=rings)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.location = loc
    return lib.finish(obj, mat, bevel, 2)


def cone(name, radius_bottom, radius_top, depth, loc, mat, verts=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius_bottom, radius2=radius_top, depth=depth)
    obj = bpy.context.object
    obj.name = name
    return place(obj, loc, rot) and lib.finish(obj, mat, 0.002, 2)


def slab(name, size, loc, mat, bevel=0.006, segments=2):
    # A sub-5 mm bevel is invisible at phone distance and costs ~90 triangles
    # per part, which is how a 12-button remote turns into 1,600 triangles.
    if bevel < 0.005:
        bevel, segments = 0.0, 1
    return lib.box(name, size, loc, mat, bevel, segments)


def bar(name, length, loc, mat, radius=0.008, axis="x", bevel=0.0):
    """Thin round rod; `axis` is the direction it runs along."""
    rot = (0, math.pi / 2, 0) if axis == "x" else (math.pi / 2, 0, 0) if axis == "y" else (0, 0, 0)
    return lib.cyl(name, radius, length, loc, mat, 10, bevel, rot=rot)


def turn(obj, rz=0.0, rx=0.0, ry=0.0):
    """Rotate an already-built part in place and bake the rotation."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.rotation_euler = (rx, ry, rz)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return obj


def plate(name, radius, z, mat="ceramic"):
    return lathe(
        name,
        [
            (radius, 0.0),
            (radius - 0.012, 0.005),
            (radius * 0.55, 0.012),
            (radius * 0.58, 0.021),
            (radius - 0.02, 0.030),
            (radius, 0.034),
        ],
        mat,
        20,
        (0, 0, z),
    )
