"""Phase 6, part two — wheels, trim, interiors and the damage overlays
(FINALLY-3D.md §10.2–10.4).

Wheels are built in the game's axle space: the hub sits at the origin and the
axle runs along **X**, because that is what `Vehicle.createWheel()` rotates
about and what the physics quaternion drives. They are modelled at one nominal
size each and `Vehicle` picks the closest and applies a single uniform scale
from `specs.wheelRadius` — the one sanctioned exception to §3.1, recorded in
§10.0, because a tyre's size *is* the spec and there are five of them.

Interiors exist because the glass is transparent: an empty cabin is the most
obvious tell of a placeholder car. They are authored to the hatchback cabin,
which is the only preset the game currently spawns.
"""

import math

import bmesh
import bpy

import lib
import tool_common as tc
import vehicle_common as vc
from decor_common import lathe
from vehicle_common import GLASS, PAINT, finish

TAU = math.pi * 2


# --------------------------------------------------------------------- wheels
def _wheel(name, radius, width, spokes, tread, rim="chrome", sport=False):
    parts = []
    r, w = radius, width

    tyre = [(0.60 * r, -w / 2), (0.78 * r, -w / 2), (0.93 * r, -w / 2 * 0.92),
            (1.00 * r, -w / 2 * 0.60), (1.00 * r, w / 2 * 0.60), (0.93 * r, w / 2 * 0.92),
            (0.78 * r, w / 2), (0.60 * r, w / 2), (0.60 * r, -w / 2)]
    parts.append(vc.revolve("tyre", tyre, "rubber", 16))

    # Tread blocks are what make a wheel catch the light while it spins; a plain
    # revolved tyre reads as a black ring even in motion.
    for i in range(tread):
        a = TAU * i / tread
        parts.append(tc.box("tread_%02d" % i, (0.022, 0.075 if sport else 0.062, w * 0.66),
                            (r * 0.982 * math.cos(a), r * 0.982 * math.sin(a), 0),
                            "rubber", 0.0, 1, rot=(0, 0, a)))

    parts.append(vc.revolve("rim_barrel",
                            [(0.56 * r, -w * 0.44), (0.62 * r, -w * 0.50),
                             (0.62 * r, w * 0.50), (0.56 * r, w * 0.44),
                             (0.56 * r, -w * 0.44)], rim, 16))

    for i in range(spokes):
        a = TAU * i / spokes
        parts.append(tc.box("spoke_%d" % i,
                            (0.58 * r, 0.050 if not sport else 0.034, 0.030),
                            (0.30 * r * math.cos(a), 0.30 * r * math.sin(a), w * 0.33),
                            rim, 0.005, 1, rot=(0, 0, a)))
    parts.append(lib.cyl("hub", 0.17 * r, 0.036, (0, 0, w * 0.36), "chrome", 12, 0.004))

    # Brake disc and caliper: visible through the spokes at walking pace.
    parts.append(lib.cyl("brake_disc", 0.52 * r, 0.016, (0, 0, -w * 0.10), "cast_iron", 12, 0.003))
    parts.append(tc.box("caliper", (0.09, 0.11, 0.10),
                        (0.40 * r * math.cos(2.2), 0.40 * r * math.sin(2.2), -w * 0.10),
                        "plastic_red", 0.006, 1, rot=(0, 0, 2.2)))
    return vc.spin_to_x(parts)


def wheel_standard():
    return _wheel("wheel_standard", 0.31, 0.22, 5, 9)


def wheel_sport():
    return _wheel("wheel_sport", 0.33, 0.25, 6, 10, rim="steel", sport=True)


def wheel_steel():
    parts = _wheel("wheel_steel", 0.30, 0.20, 0, 9, rim="steel")
    cap = lathe("plastic_cap", [(0.0, 0.035), (0.10, 0.030), (0.17, 0.012),
                                   (0.175, -0.005), (0.0, -0.005)],
                   "plastic_white", 14, (0, 0, 0))
    return vc.spin_to_x(parts + [cap])


def wheel_recovery():
    return _wheel("wheel_recovery", 0.40, 0.26, 6, 9, rim="steel")


def hubcap():
    parts = [lathe("hubcap", [(0.0, 0.026), (0.10, 0.022), (0.17, 0.010),
                                 (0.19, -0.004), (0.0, -0.004)],
                      "chrome", 16, (0, 0, 0))]
    return vc.spin_to_x(parts)


# ---------------------------------------------------------------------- trim
def light_head_pair():
    parts = []
    for side, tag in ((-1, "l"), (1, "r")):
        x = side * 0.34
        parts.append(lib.box("head_%s_housing" % tag, (0.30, 0.10, 0.13),
                             (x, 0.02, 0.0), "chrome", 0.010, 2))
        parts.append(lib.box("head_%s_lens" % tag, (0.27, 0.02, 0.11),
                             (x, -0.045, 0.0), "emissive_warm", 0.008, 3))
        parts.append(lib.cyl("head_%s_bulb" % tag, 0.025, 0.02,
                             (x - side * 0.05, -0.035, 0.0), "emissive_warm", 10,
                             rot=(math.pi / 2, 0, 0)))
        parts.append(lib.box("head_%s_reflector" % tag, (0.26, 0.012, 0.10),
                             (x, -0.030, 0.0), "chrome", 0.004, 2))
    return parts


def light_tail_pair():
    parts = []
    for side, tag in ((-1, "l"), (1, "r")):
        x = side * 0.24
        parts.append(lib.box("tail_%s_lens" % tag, (0.20, 0.05, 0.14),
                             (x, 0.0, 0.0), "emissive_red", 0.012, 3))
        parts.append(lib.box("tail_%s_housing" % tag, (0.21, 0.02, 0.15),
                             (x, 0.035, 0.0), "cast_iron", 0.006, 2))
        parts.append(lib.box("tail_%s_reverse" % tag, (0.06, 0.02, 0.10),
                             (x + side * 0.055, -0.026, 0.0), "plastic_white", 0.005, 2))
    return parts


def plate_uk():
    parts = [lib.box("plate", (0.52, 0.006, 0.11), (0, 0, 0), "paper", 0.004, 2)]
    parts.append(lib.box("plate_border", (0.53, 0.004, 0.12), (0, 0.002, 0), "chrome", 0.003, 2))
    parts.append(lib.box("plate_band", (0.09, 0.003, 0.11), (-0.215, -0.004, 0), "plastic_red", 0.002, 1))
    return parts


def exhaust_tip():
    parts = [vc.tube("tip", [(0, 0.0, 0), (0, -0.19, 0.01)], 0.035, "chrome", 12, taper=1.12)]
    parts.append(vc.revolve("tip_lip", [(0.030, -0.19), (0.043, -0.196), (0.045, -0.186),
                                        (0.034, -0.180), (0.030, -0.19)], "chrome", 12,
                            (0, 0.0, 0.01)))
    return parts


def roof_rack():
    parts = []
    for y in (-0.42, 0.42):
        parts.append(vc.tube("bar_%s" % ("f" if y < 0 else "r"),
                             [(-0.60, y, 0.10), (0.60, y, 0.10)], 0.022, "steel", 8))
        for side in (-1, 1):
            parts.append(lib.box("foot_%s_%s" % ("f" if y < 0 else "r", "l" if side < 0 else "r"),
                                 (0.07, 0.09, 0.10), (side * 0.55, y, 0.05),
                                 "rubber", 0.010, 2))
    return parts


def tow_bar():
    parts = [lib.box("tow_plate", (0.14, 0.22, 0.016), (0, 0.10, 0.06), "steel", 0.006, 2)]
    parts.append(vc.tube("tow_neck", [(0, 0.04, 0.06), (0, -0.02, 0.06)], 0.028, "steel", 8))
    parts.append(lathe("tow_ball", [(0.0, -0.035), (0.028, -0.030), (0.038, -0.010),
                                       (0.030, 0.008), (0.0, 0.010)],
                          "chrome", 12, (0, -0.02, 0.075)))
    return parts


# ----------------------------------------------------------------- interiors
def _seat(name, x, y, width=0.46, sport=False):
    parts = [
        tc.box(name + "_cushion", (width, 0.50, 0.11), (x, y, 0.56), "leather_black", 0.035, 3),
        tc.box(name + "_squab", (width, 0.13, 0.58), (x, y + 0.21, 0.80),
               "leather_black", 0.035, 3, rot=(-0.20, 0, 0)),
        tc.box(name + "_head", (width * 0.52, 0.10, 0.15), (x, y + 0.26, 1.10),
               "leather_black", 0.024, 2),
        tc.box(name + "_rail", (0.06, 0.36, 0.10), (x, y, 0.44), "steel", 0.006, 2),
    ]
    if sport:
        for side in (-1, 1):
            parts.append(tc.box("%s_bolster_%s" % (name, "l" if side < 0 else "r"),
                                (0.10, 0.44, 0.13),
                                (x + side * (width / 2 - 0.02), y, 0.62),
                                "leather_black", 0.03, 3, rot=(0, side * 0.22, 0)))
            parts.append(tc.box("%s_wing_%s" % (name, "l" if side < 0 else "r"),
                                (0.09, 0.14, 0.50),
                                (x + side * (width / 2 - 0.03), y + 0.18, 0.80),
                                "leather_black", 0.03, 3, rot=(-0.2, side * 0.18, 0)))
        parts.append(vc.tube(name + "_seam",
                             [(-width * 0.30, y - 0.20, 0.62), (width * 0.30, y - 0.20, 0.62)],
                             0.008, "fabric_rust", 5))
    return parts


def _steering_wheel(parts, x=-0.36, y=-0.52, z=0.88):
    tilt = -0.42
    parts.append(lib.torus("wheel_rim", 0.165, 0.020, (x, y, z), "leather_black",
                           (tilt, 0, 0), 18, 6))
    for i in range(3):
        a = TAU * i / 3 + math.pi / 2
        parts.append(vc.tube("wheel_spoke_%d" % i,
                             [(x, y, z),
                              (x + 0.16 * math.cos(a), y + 0.06 * math.sin(tilt),
                               z + 0.16 * math.sin(a))], 0.012, "steel", 5))
    parts.append(lathe("wheel_boss", [(0.0, 0.005), (0.055, 0.0), (0.050, -0.030), (0.0, -0.035)],
                          "leather_black", 12, (x, y, z)))
    return parts


def interior_cabin():
    parts = []
    parts += _seat("seat_fl", -0.36, -0.40)
    parts += _seat("seat_fr", 0.36, -0.40)

    # Rear bench: a cushion and a squab across the whole cabin.
    parts.append(tc.box("bench_cushion", (1.30, 0.48, 0.12), (0, 0.44, 0.56),
                        "leather_black", 0.04, 3))
    parts.append(tc.box("bench_squab", (1.30, 0.12, 0.54), (0, 0.65, 0.80),
                        "leather_black", 0.04, 3, rot=(-0.16, 0, 0)))

    # Dashboard: a wedge under the windscreen with a binnacle and a radio.
    parts.append(tc.box("dash", (1.44, 0.26, 0.20), (0, -0.74, 0.80),
                        "leather_black", 0.03, 3, rot=(0.10, 0, 0)))
    parts.append(tc.box("dash_top", (1.40, 0.18, 0.05), (0, -0.72, 0.92),
                        "leather_black", 0.02, 2))
    parts.append(tc.box("binnacle", (0.34, 0.10, 0.12), (-0.36, -0.60, 0.92),
                        "leather_black", 0.02, 2, rot=(0.2, 0, 0)))
    for i in range(3):
        parts.append(lib.cyl("dash_dial_%d" % i, 0.034, 0.012,
                             (-0.46 + i * 0.10, -0.645, 0.925), "ceramic", 10,
                             rot=(math.pi / 2 - 0.2, 0, 0)))
    parts.append(lib.box("radio", (0.24, 0.03, 0.10), (0, -0.62, 0.80), "cast_iron", 0.008, 2))
    for i in range(3):
        parts.append(tc.box("vent_%d" % i, (0.12, 0.04, 0.06), (-0.30 + i * 0.30, -0.63, 0.94),
                            "rubber", 0.006, 2))

    _steering_wheel(parts)

    # Gear lever, handbrake and pedals — cheap, and they sell the footwell.
    parts.append(vc.tube("gear_lever", [(0, -0.24, 0.62), (0, -0.22, 0.84)], 0.014, "steel", 6))
    parts.append(lathe("gear_knob", [(0.0, 0.030), (0.026, 0.020), (0.024, -0.020), (0.0, -0.026)],
                          "leather_black", 10, (0, -0.22, 0.86)))
    parts.append(vc.tube("handbrake", [(0.12, -0.12, 0.60), (0.12, -0.02, 0.66)], 0.012, "steel", 6))
    for i, x in enumerate((-0.52, -0.36, -0.20)):
        parts.append(tc.box("pedal_%d" % i, (0.07, 0.10, 0.02), (x, -0.80, 0.40),
                            "rubber", 0.006, 2, rot=(0.25, 0, 0)))

    for side, tag in ((-1, "l"), (1, "r")):
        parts.append(tc.box("door_card_%s" % tag, (0.035, 1.20, 0.30),
                            (side * 0.74, -0.05, 0.62), "leather_black", 0.02, 2))
        parts.append(tc.box("door_armrest_%s" % tag, (0.08, 0.42, 0.06),
                            (side * 0.70, 0.05, 0.72), "leather_black", 0.02, 2))
    parts.append(tc.box("headliner", (1.48, 1.62, 0.02), (0, 0.02, 1.42), "linen", 0.006, 2))
    parts.append(tc.box("carpet", (1.40, 1.60, 0.02), (0, 0.02, 0.34), "rug_red", 0.006, 2))
    return parts


def seat_sport():
    parts = _seat("seat_sport", 0.0, 0.0, 0.52, sport=True)
    parts.append(tc.box("seat_sport_base", (0.46, 0.50, 0.06), (0, 0, 0.36),
                        "cast_iron", 0.008, 2))
    return parts


def steering_wheel():
    parts = []
    _steering_wheel(parts, 0.0, 0.0, 0.0)
    return parts


def dashboard():
    parts = interior_cabin()
    keep = [p for p in parts if p.name.startswith(("dash", "binnacle", "radio", "vent", "dash_dial"))]
    return keep or parts


# ------------------------------------------------------------ dirt / damage
def _grid(name, width, height, depth, mat, steps=7, seed=0):
    """A flat overlay with a real dent pushed into it."""
    rnd = tc.rng(name)
    nx, ny = steps, max(3, steps - 2)
    verts = []
    for j in range(ny):
        for i in range(nx):
            u = i / (nx - 1) - 0.5
            v = j / (ny - 1) - 0.5
            falloff = max(0.0, 1.0 - (u * u + v * v) * 4.2)
            wobble = 1.0 + (rnd.random() - 0.5) * 0.25
            verts.append((u * width, v * height, -depth * falloff * wobble))
    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = j * nx + i
            faces.append((a, a + 1, a + nx + 1, a + nx))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new("skin", "SOLIDIFY")
    modifier.thickness = 0.005
    modifier.offset = 0.0
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return lib.finish(obj, mat, 0.0, 2, 40)


def panel_dent_a():
    return [_grid("panel_dent_a", 0.78, 0.62, 0.075, PAINT)]


def panel_dent_b():
    return [_grid("panel_dent_b", 0.60, 0.54, 0.045, PAINT)]


def panel_dent_c():
    return [_grid("panel_dent_c", 0.86, 0.44, 0.055, PAINT)]


def windscreen_crack():
    parts = [_grid("crack_pane", 0.92, 0.64, 0.002, GLASS, 5)]
    rnd = tc.rng("windscreen_crack")
    centre = (-0.18, 0.05, 0.006)
    for i in range(7):
        a = TAU * i / 7 + rnd.random() * 0.5
        length = 0.20 + rnd.random() * 0.24
        mid = (centre[0] + length * 0.55 * math.cos(a) * 0.9,
               centre[1] + length * 0.55 * math.sin(a) * 0.9, 0.007)
        end = (centre[0] + length * math.cos(a) * 1.4,
               centre[1] + length * math.sin(a) * 1.4, 0.007)
        parts.append(vc.tube("crack_%d" % i, [centre, mid, end], 0.0035, "grime", 4))
    parts.append(lib.torus("crack_ring", 0.10, 0.004, centre, "grime", (0, 0, 0), 14, 4))
    return parts


def mud_splatter():
    rnd = tc.rng("mud_splatter")
    verts, faces = [(0, 0, 0.0)], []
    steps = 14
    for i in range(steps):
        a = TAU * i / steps
        radius = 0.16 + rnd.random() * 0.12
        verts.append((math.cos(a) * radius, math.sin(a) * radius * 0.8, 0.004))
    for i in range(steps):
        faces.append((0, 1 + i, 1 + (i + 1) % steps))
    mesh = bpy.data.meshes.new("mud_splatter")
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new("mud_splatter", mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    return [lib.finish(obj, "grime", 0.0, 2, 40)]


def rust_patch():
    rnd = tc.rng("rust_patch")
    verts, faces = [(0, 0, 0.0)], []
    steps = 11
    for i in range(steps):
        a = TAU * i / steps
        radius = 0.08 + rnd.random() * 0.06
        verts.append((math.cos(a) * radius, math.sin(a) * radius, 0.004))
    for i in range(steps):
        faces.append((0, 1 + i, 1 + (i + 1) % steps))
    mesh = bpy.data.meshes.new("rust_patch")
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new("rust_patch", mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    return [lib.finish(obj, "rust", 0.0, 2, 40)]


def damage_panel_set():
    """The three dented doors and two screens, laid out for a contact sheet.

    They are overlays: the game spawns one where a panel took a hit, so each
    piece sits centred and flat, not assembled onto a car here.
    """
    parts = []
    for name, x in (("dent_door_a", -1.05), ("dent_door_b", 0.0), ("dent_door_c", 1.05)):
        pitch = {"dent_door_a": 0.78, "dent_door_b": 0.60, "dent_door_c": 0.86}[name]
        height = {"dent_door_a": 0.62, "dent_door_b": 0.54, "dent_door_c": 0.44}[name]
        depth = {"dent_door_a": 0.075, "dent_door_b": 0.045, "dent_door_c": 0.055}[name]
        panel = _grid(name, pitch, height, depth, PAINT)
        panel.location = (x, 0.2, 0.9)
        parts.append(panel)
        parts.append(tc.box(name + "_frame", (pitch + 0.05, height + 0.05, 0.02),
                            (x, 0.2, 0.885), "grime", 0.004, 1))
    for name, x in (("screen_a", -0.75), ("screen_b", 0.75)):
        screen = _grid(name, 0.90, 0.62, 0.030, GLASS, 5)
        screen.location = (x, -0.9, 1.35)
        screen.rotation_euler = (1.15, 0, 0)
        parts.append(screen)
    bumper = vc.solid("bumper_crumpled",
                      [(-0.55, 0.02), (0.05, 0.0), (0.55, 0.06), (0.52, 0.24),
                       (-0.02, 0.18), (-0.55, 0.26)],
                      -0.09, 0.09, "paint", 0.010, 2)
    bumper.location = (0, 0.0, 0.0)
    parts.append(bumper)
    return parts


BUILDERS = {
    "wheel_standard": lambda: finish("wheel_standard", wheel_standard()),
    "wheel_sport": lambda: finish("wheel_sport", wheel_sport()),
    "wheel_steel": lambda: finish("wheel_steel", wheel_steel()),
    "wheel_recovery": lambda: finish("wheel_recovery", wheel_recovery()),
    "hubcap": lambda: finish("hubcap", hubcap()),
    "light_head_pair": lambda: finish("light_head_pair", light_head_pair()),
    "light_tail_pair": lambda: finish("light_tail_pair", light_tail_pair()),
    "plate_uk": lambda: finish("plate_uk", plate_uk()),
    "exhaust_tip": lambda: finish("exhaust_tip", exhaust_tip()),
    "roof_rack": lambda: finish("roof_rack", roof_rack()),
    "tow_bar": lambda: finish("tow_bar", tow_bar()),
    "interior_cabin": lambda: finish("interior_cabin", interior_cabin()),
    "seat_sport": lambda: finish("seat_sport", seat_sport()),
    "steering_wheel": lambda: finish("steering_wheel", steering_wheel()),
    "dashboard": lambda: finish("dashboard", dashboard()),
    "panel_dent_a": lambda: finish("panel_dent_a", panel_dent_a()),
    "panel_dent_b": lambda: finish("panel_dent_b", panel_dent_b()),
    "panel_dent_c": lambda: finish("panel_dent_c", panel_dent_c()),
    "windscreen_crack": lambda: finish("windscreen_crack", windscreen_crack()),
    "mud_splatter": lambda: finish("mud_splatter", mud_splatter()),
    "rust_patch": lambda: finish("rust_patch", rust_patch()),
    "damage_panel_set": lambda: finish("damage_panel_set", damage_panel_set()),
}
