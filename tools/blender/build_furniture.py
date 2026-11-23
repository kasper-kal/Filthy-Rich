"""Build the Filthy Rich furniture set in headless Blender.

Every piece is built in metres to real proportions, bevelled so edges catch
light, smooth-shaded at a sensible angle, and given a Principled material.
Origin sits at the floor centre, so the game can drop a model on y=0.

Run:  blender --background --python tools/blender/build_furniture.py
"""

import math
import os
import sys

import bpy

OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "public",
    "models",
    "furniture",
)

PALETTE = {
    "teal": ((0.055, 0.20, 0.24), 0.85, 0.0),
    "linen": ((0.62, 0.57, 0.48), 0.9, 0.0),
    "walnut": ((0.13, 0.075, 0.045), 0.45, 0.0),
    "oak": ((0.26, 0.16, 0.085), 0.5, 0.0),
    "brass": ((0.60, 0.42, 0.13), 0.32, 1.0),
    "steel": ((0.08, 0.08, 0.09), 0.38, 0.85),
    "ceramic": ((0.78, 0.76, 0.70), 0.25, 0.0),
    "leaf": ((0.045, 0.16, 0.06), 0.65, 0.0),
    "rug": ((0.16, 0.045, 0.05), 0.95, 0.0),
    "glass": ((0.55, 0.68, 0.72), 0.08, 0.0),
    "paper": ((0.72, 0.70, 0.64), 0.8, 0.0),
}


def material(key):
    name = "fr_" + key
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


def wipe():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.curves):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def finish(obj, key, bevel=0.015, segments=3, smooth=38):
    obj.data.materials.append(material(key))
    if bevel > 0:
        mod = obj.modifiers.new("bev", "BEVEL")
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
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth))
    except Exception:
        pass
    return obj


def box(name, size, loc, key, bevel=0.015, segments=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, key, bevel, segments)


def cyl(name, radius, depth, loc, key, verts=28, bevel=0.006, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=depth, location=loc, vertices=verts, rotation=rot
    )
    obj = bpy.context.object
    obj.name = name
    return finish(obj, key, bevel, 2)


def ball(name, radius, loc, key, squash=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=28, ring_count=18)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (1.0, 1.0, squash)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, key, 0.0, 0)


def legs(width, depth, height, key, inset=0.06, radius=0.022):
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(
                "leg",
                radius,
                height,
                (sx * (width / 2 - inset), sy * (depth / 2 - inset), height / 2),
                key,
                verts=16,
            )


def export(name):
    bpy.ops.object.select_all(action="SELECT")
    path = os.path.join(OUT_DIR, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    size = os.path.getsize(path)
    print("wrote %-16s %6d bytes" % (name, size))


# ---------------------------------------------------------------- pieces


def sofa():
    w, d = 2.05, 0.92
    box("base", (w, d, 0.30), (0, 0, 0.22), "teal", 0.03, 4)
    box("back", (w, 0.22, 0.62), (0, -d / 2 + 0.11, 0.55), "teal", 0.04, 4)
    for i, x in enumerate((-0.66, 0.0, 0.66)):
        box("cushion%d" % i, (0.62, 0.66, 0.18), (x, 0.06, 0.45), "teal", 0.05, 5)
        box("backpad%d" % i, (0.60, 0.16, 0.44), (x, -d / 2 + 0.24, 0.66), "teal", 0.05, 5)
    for sx in (-1, 1):
        box("arm", (0.16, d, 0.46), (sx * (w / 2 - 0.08), 0, 0.45), "teal", 0.05, 5)
    legs(w, d, 0.10, "walnut", 0.12, 0.026)


def armchair():
    w, d = 0.86, 0.86
    box("base", (w, d, 0.28), (0, 0, 0.21), "teal", 0.03, 4)
    box("back", (w, 0.20, 0.60), (0, -d / 2 + 0.10, 0.54), "teal", 0.045, 4)
    box("cushion", (0.60, 0.60, 0.17), (0, 0.05, 0.43), "teal", 0.05, 5)
    box("backpad", (0.58, 0.15, 0.42), (0, -d / 2 + 0.22, 0.64), "teal", 0.05, 5)
    for sx in (-1, 1):
        box("arm", (0.14, d, 0.44), (sx * (w / 2 - 0.07), 0, 0.44), "teal", 0.05, 5)
    legs(w, d, 0.09, "walnut", 0.10, 0.024)


def dining_chair():
    w, d = 0.46, 0.50
    box("seat", (w, d, 0.06), (0, 0, 0.45), "linen", 0.02, 3)
    box("back", (w, 0.06, 0.44), (0, -d / 2 + 0.03, 0.68), "walnut", 0.02, 3)
    box("rail", (w, 0.08, 0.05), (0, -d / 2 + 0.04, 0.90), "walnut", 0.02, 3)
    legs(w, d, 0.45, "walnut", 0.05, 0.020)


def office_chair():
    cyl("gas", 0.05, 0.34, (0, 0, 0.30), "steel", 20)
    box("seat", (0.50, 0.48, 0.07), (0, 0, 0.50), "steel", 0.03, 4)
    box("back", (0.46, 0.07, 0.52), (0, -0.24, 0.78), "steel", 0.03, 4)
    for i in range(5):
        angle = i * 2 * math.pi / 5
        box(
            "spoke",
            (0.30, 0.05, 0.04),
            (math.cos(angle) * 0.15, math.sin(angle) * 0.15, 0.10),
            "steel",
            0.015,
            2,
            rot=(0, 0, angle),
        )
    cyl("hub", 0.09, 0.05, (0, 0, 0.10), "steel", 20)


def beanbag():
    ball("bag", 0.44, (0, 0, 0.28), "linen", squash=0.62)
    ball("dent", 0.30, (0, -0.04, 0.44), "linen", squash=0.45)


def coffee_table():
    w, d, h = 1.10, 0.60, 0.40
    box("top", (w, d, 0.05), (0, 0, h), "oak", 0.02, 3)
    box("shelf", (w - 0.16, d - 0.12, 0.035), (0, 0, 0.16), "oak", 0.02, 3)
    legs(w, d, h - 0.05, "walnut", 0.07, 0.024)


def dining_table():
    w, d, h = 1.62, 0.92, 0.74
    box("top", (w, d, 0.06), (0, 0, h), "oak", 0.025, 4)
    box("apron", (w - 0.24, 0.08, 0.10), (0, -d / 2 + 0.10, h - 0.09), "oak", 0.02, 3)
    legs(w, d, h - 0.06, "walnut", 0.10, 0.030)


def desk():
    w, d, h = 1.40, 0.70, 0.75
    box("top", (w, d, 0.05), (0, 0, h), "oak", 0.02, 3)
    box("pedestal", (0.42, d - 0.06, 0.62), (w / 2 - 0.26, 0, 0.33), "walnut", 0.02, 3)
    for i, z in enumerate((0.20, 0.36, 0.52)):
        box("drawer%d" % i, (0.36, 0.02, 0.13), (w / 2 - 0.26, -d / 2 + 0.04, z), "linen", 0.01, 2)
    for sx in (-1, 1):
        cyl("leg", 0.024, h - 0.05, (sx * (w / 2 - 0.08), d / 2 - 0.08, (h - 0.05) / 2), "walnut", 16)


def nightstand():
    w, d, h = 0.50, 0.42, 0.55
    box("body", (w, d, 0.42), (0, 0, 0.28), "walnut", 0.02, 3)
    box("drawer", (w - 0.08, 0.02, 0.16), (0, -d / 2 + 0.01, 0.36), "linen", 0.012, 2)
    cyl("knob", 0.018, 0.03, (0, -d / 2 - 0.01, 0.36), "brass", 12, rot=(math.pi / 2, 0, 0))
    legs(w, d, 0.10, "walnut", 0.05, 0.018)


def sideboard():
    w, d, h = 1.50, 0.45, 0.78
    box("body", (w, d, 0.55), (0, 0, 0.44), "walnut", 0.025, 3)
    for i, x in enumerate((-0.46, 0.0, 0.46)):
        box("door%d" % i, (0.44, 0.02, 0.48), (x, -d / 2 + 0.01, 0.44), "oak", 0.012, 2)
        box("pull%d" % i, (0.14, 0.02, 0.02), (x, -d / 2 - 0.01, 0.44), "brass", 0.008, 2)
    legs(w, d, 0.16, "walnut", 0.08, 0.022)


def tv_stand():
    w, d, h = 1.40, 0.40, 0.48
    box("body", (w, d, 0.34), (0, 0, 0.30), "walnut", 0.02, 3)
    box("shelf", (w - 0.10, d - 0.06, 0.03), (0, 0, 0.16), "oak", 0.015, 2)
    legs(w, d, 0.13, "steel", 0.10, 0.016)


def bookshelf():
    w, d, h = 0.90, 0.32, 1.86
    box("side_l", (0.03, d, h), (-w / 2 + 0.015, 0, h / 2), "walnut", 0.008, 2)
    box("side_r", (0.03, d, h), (w / 2 - 0.015, 0, h / 2), "walnut", 0.008, 2)
    box("back", (w, 0.02, h), (0, d / 2 - 0.01, h / 2), "walnut", 0.006, 2)
    for i in range(4):
        z = 0.28 + i * 0.42
        box("shelf%d" % i, (w - 0.06, d - 0.02, 0.025), (0, 0, z), "oak", 0.008, 2)
        for j in range(4):
            hgt = 0.24 + (j % 3) * 0.03
            box(
                "book%d_%d" % (i, j),
                (0.05, 0.16, hgt),
                (-w / 2 + 0.10 + j * 0.065, 0, z + 0.013 + hgt / 2),
                "paper" if j % 2 else "rug",
                0.004,
                2,
            )


def wardrobe():
    w, d, h = 1.20, 0.60, 2.05
    box("body", (w, d, h), (0, 0, h / 2), "walnut", 0.025, 3)
    for sx in (-1, 1):
        box("door", (w / 2 - 0.03, 0.02, h - 0.10), (sx * w / 4, -d / 2 + 0.01, h / 2), "oak", 0.012, 2)
        box("handle", (0.02, 0.02, 0.22), (sx * 0.06, -d / 2 - 0.012, 1.10), "brass", 0.008, 2)
    box("plinth", (w - 0.06, d - 0.06, 0.08), (0, 0, 0.04), "walnut", 0.01, 2)


def bed_frame():
    w, d = 1.62, 2.05
    box("frame", (w, d, 0.22), (0, 0, 0.26), "walnut", 0.02, 3)
    box("mattress", (w - 0.10, d - 0.16, 0.22), (0, 0, 0.47), "linen", 0.045, 4)
    box("headboard", (w, 0.09, 0.72), (0, -d / 2 + 0.045, 0.62), "walnut", 0.03, 3)
    box("duvet", (w - 0.06, d * 0.62, 0.10), (0, 0.18, 0.60), "teal", 0.05, 5)
    for sx in (-1, 1):
        box("pillow", (0.46, 0.30, 0.13), (sx * 0.36, -d / 2 + 0.34, 0.62), "paper", 0.06, 5)
    legs(w, d, 0.16, "walnut", 0.10, 0.026)


def floor_lamp():
    cyl("base", 0.16, 0.035, (0, 0, 0.02), "steel", 32)
    cyl("pole", 0.017, 1.42, (0, 0, 0.72), "brass", 20)
    bpy.ops.mesh.primitive_cone_add(radius1=0.23, radius2=0.13, depth=0.30, location=(0, 0, 1.55), vertices=32)
    shade = bpy.context.object
    shade.name = "shade"
    finish(shade, "linen", 0.01, 2)


def table_lamp():
    cyl("base", 0.10, 0.025, (0, 0, 0.012), "ceramic", 28)
    ball("belly", 0.11, (0, 0, 0.13), "ceramic", squash=0.9)
    cyl("neck", 0.02, 0.12, (0, 0, 0.26), "brass", 16)
    bpy.ops.mesh.primitive_cone_add(radius1=0.15, radius2=0.10, depth=0.20, location=(0, 0, 0.40), vertices=28)
    shade = bpy.context.object
    shade.name = "shade"
    finish(shade, "linen", 0.008, 2)


def pendant():
    cyl("cord", 0.006, 0.42, (0, 0, 0.21), "steel", 10)
    bpy.ops.mesh.primitive_cone_add(radius1=0.22, radius2=0.05, depth=0.24, location=(0, 0, -0.12), vertices=32)
    shade = bpy.context.object
    shade.name = "shade"
    finish(shade, "brass", 0.008, 2)


def rug():
    box("rug", (1.90, 1.30, 0.014), (0, 0, 0.007), "rug", 0.006, 3)
    box("border", (1.78, 1.18, 0.008), (0, 0, 0.010), "walnut" if False else "oak", 0.004, 2)


def mirror():
    w, h = 0.66, 0.96
    box("frame", (w, 0.05, h), (0, 0, h / 2), "brass", 0.02, 3)
    box("glass", (w - 0.07, 0.02, h - 0.07), (0, -0.025, h / 2), "glass", 0.004, 2)


def plant_small():
    bpy.ops.mesh.primitive_cone_add(radius1=0.10, radius2=0.13, depth=0.18, location=(0, 0, 0.09), vertices=24)
    pot = bpy.context.object
    pot.name = "pot"
    finish(pot, "ceramic", 0.008, 2)
    for i in range(7):
        angle = i * (2 * math.pi / 7)
        ball(
            "leaf%d" % i,
            0.085,
            (math.cos(angle) * 0.08, math.sin(angle) * 0.08, 0.24 + (i % 3) * 0.04),
            "leaf",
            squash=0.7,
        )


def plant_large():
    bpy.ops.mesh.primitive_cone_add(radius1=0.15, radius2=0.19, depth=0.30, location=(0, 0, 0.15), vertices=28)
    pot = bpy.context.object
    pot.name = "pot"
    finish(pot, "ceramic", 0.01, 2)
    cyl("trunk", 0.022, 0.55, (0, 0, 0.55), "walnut", 12)
    for i in range(10):
        angle = i * (2 * math.pi / 10)
        r = 0.10 + (i % 3) * 0.05
        ball(
            "leaf%d" % i,
            0.13,
            (math.cos(angle) * r, math.sin(angle) * r, 0.78 + (i % 4) * 0.08),
            "leaf",
            squash=0.55,
        )


def art_large():
    w, h = 1.00, 0.70
    box("frame", (w, 0.05, h), (0, 0, h / 2), "walnut", 0.015, 3)
    box("canvas", (w - 0.10, 0.02, h - 0.10), (0, -0.02, h / 2), "paper", 0.004, 2)
    box("stroke", (w - 0.34, 0.02, 0.10), (0, -0.035, h / 2), "teal", 0.004, 2)


PIECES = {
    "sofa": sofa,
    "armchair": armchair,
    "dining_chair": dining_chair,
    "office_chair": office_chair,
    "beanbag": beanbag,
    "coffee_table": coffee_table,
    "dining_table": dining_table,
    "desk": desk,
    "nightstand": nightstand,
    "sideboard": sideboard,
    "tv_stand": tv_stand,
    "bookshelf": bookshelf,
    "wardrobe": wardrobe,
    "bed_frame": bed_frame,
    "floor_lamp": floor_lamp,
    "table_lamp": table_lamp,
    "pendant": pendant,
    "rug": rug,
    "mirror": mirror,
    "plant_small": plant_small,
    "plant_large": plant_large,
    "art_large": art_large,
}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    only = [a for a in sys.argv if a in PIECES]
    for name, builder in PIECES.items():
        if only and name not in only:
            continue
        wipe()
        builder()
        export(name)
    print("DONE")


if __name__ == "__main__":
    main()
