"""Shared helpers for the Filthy Rich Blender asset scripts.

Every group script imports this. Conventions live in FINALLY-3D.md §3:
metres, floor-centre origin, forward -Y, bevel everything, smooth by angle,
bake AO into vertex colours, export one GLB per asset with node names intact.
"""

import json
import math
import os

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_DIR = os.path.join(ROOT, "public", "models")
MANIFEST = os.path.join(MODEL_DIR, "models.manifest.json")

# key -> (linear base colour, roughness, metallic)   see FINALLY-3D.md §3.4
PALETTE = {
    "paint_white": ((0.78, 0.75, 0.70), 0.88, 0.0),
    "paint_cream": ((0.70, 0.64, 0.53), 0.90, 0.0),
    "plaster": ((0.66, 0.62, 0.55), 0.95, 0.0),
    "tile_white": ((0.80, 0.80, 0.78), 0.15, 0.0),
    "tile_grout": ((0.48, 0.46, 0.42), 0.95, 0.0),
    "oak": ((0.26, 0.16, 0.085), 0.50, 0.0),
    "oak_light": ((0.33, 0.21, 0.11), 0.50, 0.0),
    "oak_dark": ((0.20, 0.12, 0.06), 0.50, 0.0),
    "walnut": ((0.13, 0.075, 0.045), 0.45, 0.0),
    "brass": ((0.60, 0.42, 0.13), 0.32, 1.0),
    "steel": ((0.42, 0.42, 0.44), 0.30, 1.0),
    "glass_clear": ((0.55, 0.68, 0.72), 0.08, 0.0),
    "plastic_white": ((0.72, 0.72, 0.70), 0.45, 0.0),
    "grime": ((0.09, 0.075, 0.055), 0.95, 0.0),
    "chrome": ((0.72, 0.72, 0.74), 0.08, 1.0),
    "cast_iron": ((0.05, 0.05, 0.055), 0.55, 0.9),
    "ceramic": ((0.82, 0.81, 0.78), 0.12, 0.0),
    "paper": ((0.75, 0.73, 0.68), 0.85, 0.0),
    "linen": ((0.62, 0.57, 0.48), 0.90, 0.0),
    "fabric_olive": ((0.15, 0.16, 0.09), 0.92, 0.0),
    "fabric_rust": ((0.26, 0.09, 0.05), 0.92, 0.0),
    "fruit_red": ((0.42, 0.06, 0.04), 0.55, 0.0),
    "fruit_orange": ((0.52, 0.20, 0.03), 0.60, 0.0),
    "glass_frosted": ((0.70, 0.75, 0.78), 0.35, 0.0),
    "glass_green": ((0.06, 0.16, 0.07), 0.12, 0.0),
    "cardboard": ((0.42, 0.28, 0.16), 0.88, 0.0),
    "foil": ((0.52, 0.53, 0.55), 0.38, 1.0),
    "plastic_red": ((0.55, 0.05, 0.03), 0.40, 0.0),
    "grease": ((0.09, 0.07, 0.035), 0.55, 0.0),
    "brick": ((0.28, 0.13, 0.09), 0.90, 0.0),
    "render": ((0.62, 0.60, 0.55), 0.92, 0.0),
    "roof_tile": ((0.16, 0.14, 0.13), 0.85, 0.0),
    "concrete": ((0.45, 0.45, 0.43), 0.90, 0.0),
    "asphalt": ((0.07, 0.07, 0.075), 0.95, 0.0),
    "rubber": ((0.03, 0.03, 0.035), 0.80, 0.0),
    "leaf": ((0.048, 0.195, 0.034), 0.65, 0.0),
}

BUDGET = {
    "architecture": 2600,
    "fixtures": 2600,
    "furniture": 6500,
    "decor": 1200,
    "trash": 400,
    "tools": 2000,
    "vehicles": 12000,
    "repair": 3000,
    "exterior": 8000,
    "vegetation": 3600,
    "grime": 900,
}


# ----------------------------------------------------------------- materials
def material(key):
    """Principled material from the palette, created once per key."""
    name = "fr_" + key
    if key not in PALETTE:
        raise KeyError("unknown palette key: " + key)
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    color, rough, metal = PALETTE[key]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    return mat


# ---------------------------------------------------------------- primitives
def box(name, size, loc=(0, 0, 0), mat="paint_white", bevel=0.008, segments=2):
    """Axis-aligned box. `size` is full (x, y, z). Origin at the box centre."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.object
    obj.name = name
    # primitive_cube_add(size=1.0) gives a 1 m cube, so the scale IS the size
    obj.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, bevel, segments)


def cyl(name, radius, depth, loc=(0, 0, 0), mat="brass", verts=20, bevel=0.002, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=verts, location=loc)
    obj = bpy.context.object
    obj.name = name
    if any(rot):
        obj.rotation_euler = rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return finish(obj, mat, bevel, 2)


def torus(name, major, minor, loc=(0, 0, 0), mat="steel", rot=(0, 0, 0), major_segments=24, minor_segments=8):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=loc,
        rotation=rot,
    )
    obj = bpy.context.object
    obj.name = name
    return finish(obj, mat, 0.0)


def finish(obj, mat, bevel=0.008, segments=2, smooth_angle=38):
    """Assign material, bevel by angle, shade smooth by angle."""
    obj.data.materials.append(material(mat))
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(40)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    try:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    except Exception:
        pass  # older builds: smooth-all is acceptable, bevel keeps edges readable
    return obj


# -------------------------------------------------------------------- scene
def wipe():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.curves, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def join(objs, name):
    """Join into one mesh so AO bakes across the whole asset."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    merged = bpy.context.object
    merged.name = name
    return merged


# ---------------------------------------------------------------- AO baking
def bake_ao(obj, samples=16):
    """Bake ambient occlusion into vertex colours (FINALLY-3D.md §2.4).

    three.js multiplies COLOR_0 into base colour, so every crease and joint gets
    contact shadow with no texture, no second UV set and no extra draw call.
    """
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.margin = 2

    if not obj.data.color_attributes:
        obj.data.color_attributes.new(name="AO", type="BYTE_COLOR", domain="CORNER")
    obj.data.color_attributes.active_color_index = 0
    obj.data.color_attributes.render_color_index = 0

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")


def bake_ao_all(objs, samples=14):
    """Bake AO into vertex colours on every mesh in a multi-part asset (§2.4).

    Cycles AO is a scene-wide occlusion query, so a finger baked on its own is
    still darkened where the palm sits above it. That is why a tool can keep its
    named parts (`liquid`, `trigger`) instead of being joined into one mesh the
    way furniture is: the AO reads across the whole object anyway.
    """
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.margin = 2

    for obj in objs:
        if obj.type != "MESH":
            continue
        if not obj.data.color_attributes:
            obj.data.color_attributes.new(name="AO", type="BYTE_COLOR", domain="CORNER")
        obj.data.color_attributes.active_color_index = 0
        obj.data.color_attributes.render_color_index = 0
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")


# ------------------------------------------------------------------- export
def export_glb(obj, group, name):
    """Export one object as GLB and record it in the manifest."""
    path = os.path.join(MODEL_DIR, group, name + ".glb")
    os.makedirs(os.path.dirname(path), exist_ok=True)

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    # Bake the object transform into the mesh: the game clones one asset into
    # hundreds of placements and must not inherit a stray node offset.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_hierarchy_flatten_objs=False,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_animations=False,
    )

    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    size = os.path.getsize(path)
    print("wrote %-22s %6d tris %7d bytes" % (name, tris, size))
    record(group, name, tris, size, obj.dimensions)
    return path


def export_hierarchy(objs, group, name):
    """Export several named objects and empties as one GLB.

    Handheld tools need this and furniture does not: the game looks up `liquid`
    by name to drive the spray-bottle level, and `SOC_*` empties are the only
    honest way to tell it where a nozzle or a mop head actually is (§15.3).

    Object transforms are baked into their meshes so every node sits at the
    origin, except objects flagged `keep_origin` — the liquid column must keep
    its own translation, otherwise scaling it would shrink toward the grip
    instead of toward the bottom.
    """
    path = os.path.join(MODEL_DIR, group, name + ".glb")
    os.makedirs(os.path.dirname(path), exist_ok=True)

    meshes = [obj for obj in objs if obj.type == "MESH"]
    tris = 0
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(
            location=not obj.get("keep_origin"), rotation=True, scale=True
        )
        tris += sum(len(p.vertices) - 2 for p in obj.data.polygons)

    low = [1e9, 1e9, 1e9]
    high = [-1e9, -1e9, -1e9]
    for obj in meshes:
        for corner in obj.bound_box:
            for axis in range(3):
                value = obj.location[axis] + corner[axis]
                low[axis] = min(low[axis], value)
                high[axis] = max(high[axis], value)

    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_hierarchy_flatten_objs=False,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_animations=False,
    )

    size = os.path.getsize(path)
    print(
        "wrote %-22s %6d tris %7d bytes  [%s]"
        % (name, tris, size, ", ".join(obj.name for obj in objs))
    )
    record(group, name, tris, size, [high[i] - low[i] for i in range(3)])
    return path


def record(group, name, tris, size, dims):
    data = {"assets": []}
    if os.path.exists(MANIFEST):
        try:
            with open(MANIFEST) as handle:
                data = json.load(handle)
        except (ValueError, OSError):
            data = {"assets": []}
    entries = [a for a in data.get("assets", []) if a.get("path") != "%s/%s.glb" % (group, name)]
    entries.append(
        {
            "path": "%s/%s.glb" % (group, name),
            "group": group,
            "tris": tris,
            "bytes": size,
            "bounds": [round(d, 3) for d in dims],
        }
    )
    data["assets"] = sorted(entries, key=lambda a: a["path"])
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, "w") as handle:
        json.dump(data, handle, indent=2)


def report(group):
    with open(MANIFEST) as handle:
        data = json.load(handle)
    mine = [a for a in data["assets"] if a["group"] == group]
    print("\n%s: %d assets, %d tris, %.1f KB" % (
        group, len(mine), sum(a["tris"] for a in mine), sum(a["bytes"] for a in mine) / 1024
    ))
