"""Shared geometry for the Phase 6 vehicles (FINALLY-3D.md §10).

The whole car is a set of **prisms**: every panel is a polygon in the side
(Y, Z) plane extruded across X. That is not laziness — it is what makes a car
read at this poly count. A real body is made of stamped panels with shut lines,
and a prism has exactly one clean boundary to bevel and one flat surface to
catch the ambient occlusion. Curved-only pieces (pillars, arch lips, seals,
exhausts) are swept tubes; the glass is a thin 3D quad so it can tumble home
slightly at the top, which is what stops a greenhouse looking like a fish tank.

Coordinate rules (§3.1, §3.2):

- metres, Z up, **forward is -Y**;
- origin at **ground level, centre of the wheelbase** — wheels sit at
  `y = ±wheelbase/2`, `x = ±track/2`, which is now exactly where the physics
  puts them (see §10.0: the old `length/2 - 0.15` placement put the axles in
  the bumpers and made a real wheel arch impossible);
- the body spans `y ∈ [-length/2, +length/2]`, i.e. the collision box exactly.

Wheels are **not** part of a body: `Vehicle` owns them and positions them from
the spec, so each body is modelled with real arch cut-outs and nothing else in
the arches. The cut is a true arc, not a rectangular notch, because the
silhouette of an arch is the first thing the eye uses to date a car.
"""

import math

import bmesh
import bpy
import mathutils

import lib
import tool_common as tc
from decor_common import lathe  # noqa: F401 — re-exported for the asset modules

TAU = math.pi * 2

PAINT = "paint"          # must be exactly this: the game tints it per spec
GLASS = "glass_tint"     # the game makes this transparent on load


# ------------------------------------------------------------------ profiles
def arc(cy, cz, radius, t0, t1, steps):
    """Points on a circle in the (y, z) side plane. Used for wheel arches."""
    pts = []
    for i in range(steps + 1):
        t = t0 + (t1 - t0) * i / steps
        pts.append((cy + radius * math.sin(t), cz + radius * math.cos(t)))
    return pts


def bottom_edge(g, y0, y1, steps=9):
    """Floor line from y0 to y1 with a real arch scooped out at each axle inside it.

    The arch is centred on the wheel centre, not on the floor, so the top of the
    arch clears the top of the tyre by `arch_gap` instead of swallowing it.
    """
    pts = []
    for axle in (g["axle_f"], g["axle_r"]):
        half = g["arch_half"]
        start, end = axle - half, axle + half
        if start <= y0 or end >= y1:
            continue
        pts.append((y0, g["floor"]))
        pts.append((start, g["floor"]))
        t_max = math.acos(max(-1.0, min(1.0, (g["floor"] - g["wheel_r"]) / g["arch_r"])))
        pts.extend(arc(axle, g["wheel_r"], g["arch_r"], t_max, -t_max, steps)[1:])
        pts.append((end, g["floor"]))
        y0 = end
    pts.append((y1, g["floor"]))
    return pts


def solid(name, pts, x0, x1, mat, bevel=0.012, segments=3, smooth=38):
    """A side profile extruded across X — the workhorse of the whole phase."""
    if x0 > x1:
        x0, x1 = x1, x0
    verts = []
    for x in (x0, x1):
        for (y, z) in pts:
            verts.append((x, y, z))
    n = len(pts)
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    faces.append(tuple(range(n - 1, -1, -1)))
    faces.append(tuple(range(n, 2 * n)))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj

    bm = bmesh.new()
    bm.from_mesh(mesh)
    ngons = [f for f in bm.faces if len(f.verts) > 4]
    if ngons:
        bmesh.ops.triangulate(bm, faces=ngons)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return lib.finish(obj, mat, bevel, segments, smooth)


def quad3(name, corners, thickness, mat, bevel=0.004, smooth=30):
    """Thin slab from four 3D corners — glass, ramps, decals.

    Unlike `solid` the corners may differ in X, which is how the side glass
    leans in at the top (§3.3: an untumblehomed greenhouse looks like a bus).
    """
    p = [mathutils.Vector(c) for c in corners]
    normal = (p[1] - p[0]).cross(p[3] - p[0])
    if normal.length < 1e-9:
        normal = (p[2] - p[0]).cross(p[1] - p[0])
    normal.normalize()
    half = normal * (thickness * 0.5)
    verts = [tuple(v - half) for v in p] + [tuple(v + half) for v in p]
    faces = [(3, 2, 1, 0), (4, 5, 6, 7),
             (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    return lib.finish(obj, mat, bevel, 2, smooth)


def tube(name, pts, radius, mat, segments=8, smooth=50, taper=1.0, caps=True):
    """Swept tube along a polyline — pillars, arch lips, seals, exhausts."""
    points = [mathutils.Vector(p) for p in pts]
    n = len(points)
    rings = []
    for i, point in enumerate(points):
        if i == 0:
            tangent = points[1] - points[0]
        elif i == n - 1:
            tangent = points[-1] - points[-2]
        else:
            tangent = points[i + 1] - points[i - 1]
        tangent.normalize()
        ref = mathutils.Vector((1.0, 0.0, 0.0))
        if abs(tangent.dot(ref)) > 0.94:
            ref = mathutils.Vector((0.0, 1.0, 0.0))
        u = tangent.cross(ref).normalized()
        v = tangent.cross(u).normalized()
        r = radius * (1.0 + (taper - 1.0) * (i / max(1, n - 1)))
        rings.append([point + u * math.cos(TAU * k / segments) * r
                      + v * math.sin(TAU * k / segments) * r for k in range(segments)])

    verts = [tuple(ring_point) for ring in rings for ring_point in ring]
    faces = []
    for i in range(n - 1):
        for k in range(segments):
            a = i * segments + k
            b = i * segments + (k + 1) % segments
            c = (i + 1) * segments + (k + 1) % segments
            d = (i + 1) * segments + k
            faces.append((a, b, c, d))
    if caps:
        faces.append(tuple(range(segments - 1, -1, -1)))
        faces.append(tuple((n - 1) * segments + k for k in range(segments)))

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
    return lib.finish(obj, mat, 0.0, 2, smooth)


def revolve(name, profile, mat, segments=20, loc=(0, 0, 0), smooth=50):
    """Closed-loop revolution (tyres, rims, beacons) with no fan caps.

    `decor_common.lathe` caps both ends by fanning to the axis, which is right
    for a mug and wrong for a tyre: the cap would fill the wheel with a disc.
    Pass a profile whose last point meets its first and this leaves a real ring.
    """
    verts, faces = [], []
    n = len(profile)
    for i in range(segments):
        angle = TAU * i / segments
        cos, sin = math.cos(angle), math.sin(angle)
        for (radius, z) in profile:
            verts.append((loc[0] + radius * cos, loc[1] + radius * sin, loc[2] + z))
    for i in range(segments):
        j = (i + 1) % segments
        for k in range(n - 1):
            faces.append((i * n + k, j * n + k, j * n + k + 1, i * n + k + 1))

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
    return lib.finish(obj, mat, 0.0, 2, smooth)


# ------------------------------------------------------------------- helpers
def spin_to_x(parts):
    """Turn a Z-axis build into a wheel lying on the X axle (the game's axle)."""
    matrix = mathutils.Matrix.Rotation(math.pi / 2, 4, "Y")
    for obj in parts:
        if obj.type == "MESH":
            tc._transform_about(obj, (0, 0, 0), matrix)
    return parts


def hinge(obj, point):
    """Move a panel's pivot onto its hinge edge so it can open (§3.2)."""
    return tc.move_origin(obj, point)


def join(objs, name):
    return lib.join(objs, name)


def shade_flat(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


# -------------------------------------------------------------------- specs
def make(spec):
    """Fill in the derived geometry every builder needs."""
    length, width, height = spec["length"], spec["width"], spec["height"]
    wheelbase = spec["wheelbase"]
    wheel_r = spec["wheel_r"]
    belt = spec.get("belt", 0.60 * height)

    g = dict(spec)
    g["front"] = -length / 2
    g["rear"] = length / 2
    g["axle_f"] = -wheelbase / 2
    g["axle_r"] = wheelbase / 2
    g["arch_r"] = wheel_r + 0.045
    g["floor"] = round(max(0.20, wheel_r * 0.70), 3)
    g["arch_half"] = math.sqrt(g["arch_r"] ** 2 - (wheel_r - g["floor"]) ** 2)
    g["fire"] = g["axle_f"] + g["arch_half"] + 0.04
    g["bulk"] = g["axle_r"] - g["arch_half"] - 0.04
    g["cabin"] = g["bulk"] - g["fire"]
    g["belt"] = belt
    g["bonnet"] = round(min(belt - 0.04, spec.get("bonnet", 0.565 * height)), 3)
    g["roof"] = height
    g["half_w"] = width / 2
    return g


def at(g, fraction):
    """A y coordinate inside the cabin: 0 at the firewall, 1 at the bulkhead."""
    return g["fire"] + g["cabin"] * fraction


def body_parts(g, style):
    """The panels every road car shares, before the glass and the doors."""
    parts = []
    w, half_w = g["width"], g["half_w"]
    floor, belt = g["floor"], g["belt"]

    # Nose: the front end from the firewall forward, with the arch cut.
    # The bonnet falls away toward the nose: a flat deck at one height is the
    # single strongest "built from boxes" cue in a car silhouette.
    nose = [(g["front"], g["bonnet"] - 0.22), (g["front"] + 0.05, g["bonnet"] - 0.11),
            (g["front"] + 0.28, g["bonnet"] - 0.045), (g["fire"] - 0.02, g["bonnet"] + 0.008),
            (g["fire"], belt - 0.02)]
    nose += list(reversed(bottom_edge(g, g["front"], g["fire"])))
    parts.append(solid("nose", nose, -half_w + 0.014, half_w - 0.014, PAINT, 0.03, 3))

    # Tail from the bulkhead back, with the rear arch. The top follows the deck.
    deck = g.get("deck")
    if deck:
        tail_top = deck
    elif g.get("tail_top") == "roof":
        tail_top = g["roof"] - 0.02
    else:
        tail_top = belt
    tail = [(g["rear"], tail_top - 0.10), (g["rear"] - 0.02, tail_top - 0.01),
            (g["bulk"] + 0.02, tail_top), (g["bulk"], tail_top - 0.02)]
    tail += list(reversed(bottom_edge(g, g["bulk"], g["rear"])))
    parts.append(solid("tail", tail, -half_w + 0.014, half_w - 0.014, PAINT, 0.03, 3))

    # Wing and quarter skins: the panels over the arches, proud of the body so
    # DamageVisuals has something honest to deform.
    for side, tag in ((-1, "left"), (1, "right")):
        x0 = side * (half_w - 0.016)
        x1 = side * half_w
        wing = nose[:]
        parts.append(solid("front_%s_wing" % tag, wing, x0, x1, PAINT, 0.014, 3))
        quarter = tail[:]
        parts.append(solid("rear_%s_quarter" % tag, quarter, x0, x1, PAINT, 0.014, 3))

    # Cabin skirts close the shell between the arches; the doors sit outside them.
    for side, tag in ((-1, "left"), (1, "right")):
        x_out = side * (half_w - 0.010)
        x_in = side * (half_w - 0.060)
        skirt = [(g["fire"], floor), (g["bulk"], floor), (g["bulk"], belt), (g["fire"], belt)]
        parts.append(solid("cabin_%s" % tag, skirt, x_in, x_out, PAINT, 0.010, 2))

    # Floor pan: without it you look through the car into the road.
    parts.append(lib.box("floor_pan", (w - 0.18, g["cabin"] - 0.02, 0.02),
                         (0, (g["fire"] + g["bulk"]) / 2, floor + 0.10), PAINT, 0.008, 2))

    # Bonnet: a real panel with a shut line, hinged at the cowl.
    bonnet_pts = [(g["front"] + 0.05, g["bonnet"] - 0.100),
                  (g["front"] + 0.14, g["bonnet"] - 0.075),
                  (g["fire"] - 0.04, g["bonnet"] + 0.010),
                  (g["fire"] - 0.04, g["bonnet"] - 0.014),
                  (g["front"] + 0.05, g["bonnet"] - 0.118)]
    bonnet = solid("bonnet", bonnet_pts, -half_w + 0.05, half_w - 0.05, PAINT, 0.010, 2)
    parts.append(hinge(bonnet, (0, g["fire"] - 0.04, g["bonnet"])))

    # Roof panel.
    roof_f, roof_r = g["roof_f"], g["roof_r"]
    roof_pts = [(roof_f, g["roof"] - 0.05), (roof_r, g["roof"] - 0.05),
                (roof_r, g["roof"]), (roof_f, g["roof"])]
    parts.append(solid("roof", roof_pts, -half_w + 0.045, half_w - 0.045, PAINT, 0.018, 3))

    return parts


def wheel_arches(g):
    """Rolled lips round each arch: the difference between a cut and a car."""
    parts = []
    t_max = math.acos(max(-1.0, min(1.0, (g["floor"] - g["wheel_r"]) / g["arch_r"])))
    for axle, tag in ((g["axle_f"], "f"), (g["axle_r"], "r")):
        for side, s in ((-1, "l"), (1, "r")):
            pts = [(side * (g["half_w"] + 0.002), y, z)
                   for (y, z) in arc(axle, g["wheel_r"], g["arch_r"] + 0.004,
                                     t_max, -t_max, 12)]
            parts.append(tube("arch_lip_%s%s" % (tag, s), pts, 0.014, PAINT, 6, 50))
    return parts


def bumpers(g):
    """Front and rear bumper beams, each with a black rub strip on its face."""
    parts = []
    w2 = g["half_w"] + 0.008
    floor = g["floor"]
    front = [(g["front"], floor + 0.05), (g["front"] + 0.20, floor + 0.04),
             (g["front"] + 0.20, floor + 0.34), (g["front"] + 0.04, floor + 0.40),
             (g["front"], floor + 0.36)]
    rear = [(g["rear"] - 0.20, floor + 0.04), (g["rear"], floor + 0.05),
            (g["rear"], floor + 0.36), (g["rear"] - 0.04, floor + 0.40),
            (g["rear"] - 0.20, floor + 0.34)]
    parts.append(solid("front_bumper", front, -w2, w2, PAINT, 0.016, 3))
    parts.append(solid("rear_bumper", rear, -w2, w2, PAINT, 0.016, 3))

    strip_f = [(g["front"] + 0.002, floor + 0.15), (g["front"] + 0.030, floor + 0.15),
               (g["front"] + 0.030, floor + 0.235), (g["front"] + 0.002, floor + 0.235)]
    strip_r = [(g["rear"] - 0.030, floor + 0.15), (g["rear"] - 0.002, floor + 0.15),
               (g["rear"] - 0.002, floor + 0.235), (g["rear"] - 0.030, floor + 0.235)]
    parts.append(solid("front_bumper_strip", strip_f, -w2 - 0.005, w2 + 0.005, "rubber", 0.005, 2))
    parts.append(solid("rear_bumper_strip", strip_r, -w2 - 0.005, w2 + 0.005, "rubber", 0.005, 2))
    return parts


def lamps(g):
    """Head and tail lamps: housing, reflector and lens, all named for damage."""
    parts = []
    half_w = g["half_w"]
    z = g["bonnet"] - 0.09
    for side, tag in ((-1, "left"), (1, "right")):
        x = side * (half_w - 0.30)
        lens = [(g["front"] + 0.005, z - 0.06), (g["front"] + 0.075, z - 0.07),
                (g["front"] + 0.08, z + 0.06), (g["front"] + 0.005, z + 0.055)]
        parts.append(solid("front_%s_light" % tag, lens, x - 0.19, x + 0.19,
                           "emissive_warm", 0.008, 2, 40))
        parts.append(solid("front_%s_bezel" % tag,
                           [(p[0] + 0.004, p[1]) for p in lens],
                           x - 0.20, x + 0.20, "chrome", 0.004, 2))
        parts.append(lib.box("front_%s_bulb" % tag, (0.05, 0.02, 0.03),
                             (x, g["front"] + 0.045, z - 0.02), "chrome", 0.004, 2))

    z = g["floor"] + 0.30
    for side, tag in ((-1, "left"), (1, "right")):
        x = side * (half_w - 0.20)
        lens = [(g["rear"] - 0.075, z - 0.07), (g["rear"] - 0.005, z - 0.08),
                (g["rear"] - 0.005, z + 0.10), (g["rear"] - 0.075, z + 0.09)]
        parts.append(solid("rear_%s_light" % tag, lens, x - 0.13, x + 0.13,
                           "emissive_red", 0.008, 2, 40))
    return parts


def grille(g, slats=6):
    parts = []
    half_w = g["half_w"]
    z0, z1 = g["floor"] + 0.26, g["bonnet"] - 0.14
    pts = [(g["front"], z0), (g["front"] + 0.05, z0), (g["front"] + 0.05, z1), (g["front"], z1)]
    parts.append(solid("radiator_grille", pts, -half_w * 0.50, half_w * 0.50, "cast_iron", 0.006, 2))
    for i in range(slats):
        z = z0 + (z1 - z0) * (i + 0.5) / slats
        parts.append(lib.box("grille_slat_%d" % i, (half_w * 0.98, 0.014, 0.016),
                             (0, g["front"] + 0.052, z), "chrome", 0.003, 1))
    return parts


def mirrors(g):
    parts = []
    for side, tag in ((-1, "left"), (1, "right")):
        x = side * (g["half_w"] + 0.075)
        y = at(g, 0.06) - 0.03
        z = g["belt"] + 0.04
        housing = lib.box("%s_mirror" % tag, (0.10, 0.075, 0.085), (x, y, z),
                          PAINT, 0.012, 2)
        parts.append(tube("%s_mirror_stalk" % tag,
                          [(side * g["half_w"], y + 0.01, z - 0.03),
                           (x - side * 0.02, y, z)], 0.012, "rubber", 6))
        parts.append(lib.box("%s_mirror_glass" % tag, (0.008, 0.055, 0.055),
                             (x - side * 0.052, y, z), "chrome", 0.004, 2))
        parts.append(housing)
    return parts


def sill_trim(g):
    parts = []
    for side, tag in ((-1, "l"), (1, "r")):
        x0 = side * (g["half_w"] - 0.012)
        x1 = side * (g["half_w"] + 0.004)
        pts = [(g["front"] + 0.32, g["floor"] - 0.01), (g["rear"] - 0.32, g["floor"] - 0.01),
               (g["rear"] - 0.32, g["floor"] + 0.065), (g["front"] + 0.32, g["floor"] + 0.065)]
        parts.append(solid("sill_%s" % tag, pts, x0, x1, "rubber", 0.006, 2))
    return parts


def tailpipe(g):
    y0, y1 = g["rear"] - 0.45, g["rear"] - 0.01
    z = g["floor"] + 0.10
    x = -g["half_w"] * 0.34
    return [tube("exhaust", [(x, y0, z), (x, y1, z)], 0.030, "steel", 10, taper=1.15)]


def wipers(g):
    parts = []
    y = at(g, 0.02)
    for side, tag in ((-1, "l"), (1, "r")):
        a = (side * 0.12, y - 0.02, g["belt"] + 0.03)
        b = (side * 0.52, at(g, 0.20), g["belt"] + 0.02)
        parts.append(tube("wiper_%s" % tag, [a, b], 0.008, "rubber", 5))
    return parts


def glass_and_seals(g, panes):
    """`panes` is a list of (name, corners). Every pane gets a rubber seal."""
    parts = []
    for name, corners in panes:
        parts.append(quad3(name, corners, 0.008, GLASS, 0.002, 20))
        ring = [corners[0], corners[1], corners[2], corners[3], corners[0]]
        dense = []
        for i in range(4):
            a, b = mathutils.Vector(ring[i]), mathutils.Vector(ring[i + 1])
            for k in range(3):
                dense.append(tuple(a.lerp(b, k / 3.0)))
        dense.append(tuple(mathutils.Vector(ring[4])))
        parts.append(tube(name + "_seal", dense, 0.011, "rubber", 5))
    return parts


def pillars(g, pairs):
    parts = []
    for name, a, b, radius in pairs:
        parts.append(tube(name, [a, b], radius, PAINT, 6))
    return parts


def doors(g, spans, side):
    """Hanging panels with real shut lines and a chromed handle.

    A door is proud of the cabin skirt by 10 mm and 5 mm clear of its
    neighbours, so the baked AO draws the shut line for free (§10.1).
    """
    parts = []
    half_w = g["half_w"]
    for name, y0, y1, hinge_y, handle_y in spans:
        x_out = side * half_w
        x_in = side * (half_w - 0.032)
        pts = [(y0, g["floor"] + 0.075), (y1, g["floor"] + 0.075),
               (y1, g["belt"] + 0.004), (y0, g["belt"] + 0.004)]
        skin = solid(name, pts, x_in, x_out, PAINT, 0.012, 3)
        handle = lib.box(name + "_handle", (0.026, 0.15, 0.036),
                         (side * (half_w + 0.008), handle_y, g["belt"] - 0.10),
                         "chrome", 0.006, 2)
        crease = lib.box(name + "_crease", (0.008, (y1 - y0) * 0.72, 0.020),
                         (side * (half_w + 0.004), (y0 + y1) / 2, g["belt"] - 0.26),
                         PAINT, 0.004, 2)
        merged = join([skin, handle, crease], name)
        parts.append(hinge(merged, (x_out, hinge_y, g["belt"])))
    return parts


# -------------------------------------------------------------------- finish
def finish(name, parts, samples=8):
    lib.bake_ao_all([p for p in parts if p], samples=samples)
    return lib.export_hierarchy(parts, "vehicles", name)
