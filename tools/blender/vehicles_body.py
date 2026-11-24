"""Phase 6, part one — the car bodies (FINALLY-3D.md §10.1).

Seven silhouettes from one parametric generator. The differences that matter
are the greenhouse (where the windscreen starts, how far back the roof runs,
where the tailgate begins) and the rear end (a boot lid, a hatch, a full-height
van panel). Everything else — arches, shut lines, seals, lamps, bumpers — is
shared, because that is what makes a range of cars look like one range.

Objects are named after `PANEL_NAMES` in `src/vehicle/DamageModel.ts`, not the
shorthand in §10.1: `front_left_door`, `front_windshield`, `left_mirror` and so
on. The panes deliberately do NOT end in `_panel`, because `DamageVisuals`
traverses by name and a mismatch is a silently dead damage system.
"""

import math

import lib
import vehicle_common as vc
from vehicle_common import finish

SPECS = {
    "car_hatch": dict(
        length=4.00, width=1.75, height=1.50, wheelbase=2.50, track=1.50,
        wheel_r=0.30, wheel_w=0.205, belt=0.90, bonnet=0.85,
        screen=0.05, roof_f=0.34, roof_r=0.80, back=1.00, tail_top="belt",
        doors=4, split=0.50, rear_windows=True, style="hatch",
    ),
    "car_sedan": dict(
        length=4.70, width=1.85, height=1.45, wheelbase=2.80, track=1.58,
        wheel_r=0.33, wheel_w=0.225, belt=0.87, bonnet=0.82,
        screen=0.06, roof_f=0.36, roof_r=0.74, back=0.90, tail_top="deck",
        deck=0.88, doors=4, split=0.48, rear_windows=True, style="sedan",
    ),
    "car_van": dict(
        length=5.00, width=2.00, height=2.30, wheelbase=3.20, track=1.70,
        wheel_r=0.35, wheel_w=0.215, belt=1.18, bonnet=1.15,
        screen=0.02, roof_f=0.16, roof_r=0.99, back=1.00, tail_top="roof",
        doors=2, split=1.00, rear_windows=False, style="van",
    ),
    "car_pickup": dict(
        length=5.40, width=1.90, height=1.85, wheelbase=3.20, track=1.60,
        wheel_r=0.36, wheel_w=0.235, belt=1.10, bonnet=1.02,
        screen=0.04, roof_f=0.30, roof_r=0.88, back=0.95, tail_top="belt",
        doors=2, split=1.00, rear_windows=False, style="pickup",
    ),
    "car_coupe": dict(
        length=4.30, width=1.85, height=1.25, wheelbase=2.60, track=1.60,
        wheel_r=0.32, wheel_w=0.245, belt=0.78, bonnet=0.74,
        screen=0.14, roof_f=0.46, roof_r=0.80, back=1.00, tail_top="belt",
        doors=2, split=0.74, rear_windows=True, style="coupe",
    ),
    "car_estate": dict(
        length=4.80, width=1.82, height=1.52, wheelbase=2.85, track=1.56,
        wheel_r=0.33, wheel_w=0.225, belt=0.92, bonnet=0.86,
        screen=0.06, roof_f=0.32, roof_r=0.96, back=1.00, tail_top="roof",
        doors=4, split=0.49, rear_windows=True, style="estate",
    ),
    "recovery_truck": dict(
        length=6.50, width=2.20, height=2.60, wheelbase=3.60, track=1.80,
        wheel_r=0.40, wheel_w=0.265, belt=1.35, bonnet=1.30,
        screen=0.02, roof_f=0.18, roof_r=1.00, back=1.00, tail_top="roof",
        doors=2, split=1.00, rear_windows=False, style="truck",
    ),
}


# ------------------------------------------------------------------ geometry
def _greenhouse(g, parts):
    """Pillars, glass and seals for a car cabin. Returns nothing; appends."""
    half_w = g["half_w"]
    belt, roof = g["belt"], g["roof"]
    roof_f, roof_r = g["roof_f_y"], g["roof_r_y"]
    screen_y = vc.at(g, g["screen"])
    back_y = vc.at(g, g["back"])
    split_y = vc.at(g, g["split"])

    xb = half_w - 0.075
    xt = half_w - 0.090
    top_z = roof - 0.055
    belt_z = belt + 0.035

    panes = []
    panes.append(("front_windshield", [
        (xb, screen_y, belt_z), (-xb, screen_y, belt_z),
        (-xt, roof_f + 0.01, top_z), (xt, roof_f + 0.01, top_z),
    ]))

    if g["rear_windows"]:
        panes.append(("rear_windshield", [
            (xb, back_y, belt_z), (-xb, back_y, belt_z),
            (-xt, roof_r - 0.01, top_z), (xt, roof_r - 0.01, top_z),
        ]))

    # Side glass only between the pillars that actually exist.
    rear_side = g["rear_windows"] or g["style"] in ("pickup", "van")
    front_end = screen_y + 0.11
    top_front = roof_f + 0.06
    for side, tag in ((-1, "left"), (1, "right")):
        xb_s = side * xb
        xt_s = side * xt
        panes.append(("front_%s_window" % tag, [
            (xb_s, front_end, belt_z), (xb_s, split_y - 0.035, belt_z),
            (xt_s, split_y - 0.045, top_z), (xt_s, top_front, top_z),
        ]))
        if rear_side and split_y < back_y - 0.30:
            panes.append(("rear_%s_window" % tag, [
                (xb_s, split_y + 0.045, belt_z), (xb_s, back_y - 0.06, belt_z),
                (xt_s, back_y - 0.10, top_z), (xt_s, split_y + 0.05, top_z),
            ]))

    pairs = []
    for side in (-1, 1):
        pairs.append(("pillar_a_l" if side < 0 else "pillar_a_r",
                      (side * (half_w - 0.065), screen_y + 0.03, belt - 0.02),
                      (side * (half_w - 0.100), roof_f + 0.03, top_z), 0.032))
        pairs.append(("pillar_b_l" if side < 0 else "pillar_b_r",
                      (side * (half_w - 0.060), split_y, belt - 0.02),
                      (side * (half_w - 0.100), split_y, top_z), 0.028))
        pairs.append(("pillar_c_l" if side < 0 else "pillar_c_r",
                      (side * (half_w - 0.065), back_y, belt - 0.02),
                      (side * (half_w - 0.100), roof_r - 0.02, top_z), 0.034))
    parts += vc.pillars(g, pairs)
    parts += vc.glass_and_seals(g, panes)


def _rear_end(g, parts):
    """The tailgate, boot lid or van panel, plus the panel above a van's belt."""
    half_w = g["half_w"]
    belt, floor, rear = g["belt"], g["floor"], g["rear"]
    roof = g["roof"]

    if g["tail_top"] == "deck":
        deck = g["deck"]
        pts = [(vc.at(g, g["back"]), deck + 0.012), (rear - 0.06, deck - 0.01),
               (rear - 0.06, deck - 0.045), (vc.at(g, g["back"]), deck - 0.035)]
        lid = vc.solid("boot", pts, -half_w + 0.055, half_w - 0.055, vc.PAINT, 0.010, 2)
        parts.append(vc.hinge(lid, (0, vc.at(g, g["back"]), deck)))
    else:
        # A tailgate skin on the rear face — shut lines round it read as a door.
        top = roof - 0.16 if g["tail_top"] == "roof" else belt + 0.02
        pts = [(rear - 0.012, floor + 0.42), (rear - 0.012, top),
               (rear - 0.055, top), (rear - 0.055, floor + 0.42)]
        lid = vc.solid("boot", pts, -half_w + 0.06, half_w - 0.06, vc.PAINT, 0.010, 2)
        parts.append(vc.hinge(lid, (0, rear - 0.012, top)))

    if g["tail_top"] == "roof":
        # Solid upper side panel behind the cabin: the van's cargo wall.
        for side, tag in ((-1, "left"), (1, "right")):
            y0 = vc.at(g, 0.62)
            pts = [(y0, belt - 0.04), (g["bulk"], belt - 0.04),
                   (g["bulk"], roof - 0.06), (y0, roof - 0.06)]
            parts.append(vc.solid("cargo_%s_panel" % tag, pts,
                                  side * (half_w - 0.055), side * (half_w - 0.008),
                                  vc.PAINT, 0.012, 2))


def _doors(g, parts):
    spans = []
    if g["doors"] == 4:
        split = vc.at(g, g["split"])
        spans.append(("front", g["fire"] + 0.04, split - 0.007, g["fire"] + 0.04, split - 0.30))
        spans.append(("rear", split + 0.007, g["bulk"] - 0.035, split + 0.007, g["bulk"] - 0.32))
    else:
        end = vc.at(g, min(0.86, g["split"] - 0.02)) if g["split"] < 0.98 else g["bulk"] - 0.035
        spans.append(("front", g["fire"] + 0.04, end, g["fire"] + 0.04, end - 0.28))

    naming = {"front": {"left": "front_left_door", "right": "front_right_door"},
              "rear": {"left": "rear_left_door", "right": "rear_right_door"}}
    for side, tag in ((-1, "left"), (1, "right")):
        built = []
        for label, y0, y1, hinge_y, handle_y in spans:
            built += vc.doors(g, [(naming[label][tag], y0, y1, hinge_y, handle_y)], side)
        parts += built


def _assembly(g):
    parts = []
    parts += vc.body_parts(g, g["style"])
    _greenhouse(g, parts)
    _doors(g, parts)
    _rear_end(g, parts)
    parts += vc.wheel_arches(g)
    parts += vc.bumpers(g)
    parts += vc.lamps(g)
    parts += vc.grille(g)
    parts += vc.mirrors(g)
    parts += vc.sill_trim(g)
    parts += vc.wipers(g)
    parts += vc.tailpipe(g)
    return parts


def road_car(name):
    g = vc.make(SPECS[name])
    g["roof_f_y"] = vc.at(g, g["roof_f"])
    g["roof_r_y"] = vc.at(g, g["roof_r"])
    if g["tail_top"] == "roof":
        g["roof_r_y"] = max(g["roof_r_y"], vc.at(g, 0.90))
    if g["tail_top"] == "deck":
        g["roof_r_y"] = vc.at(g, g["roof_r"])
    return _assembly(g)


# --------------------------------------------------------------- pickup truck
def pickup():
    g = vc.make(SPECS["car_pickup"])
    g["roof_f_y"] = vc.at(g, g["roof_f"])
    g["roof_r_y"] = vc.at(g, g["roof_r"])
    g["rear_windows"] = False

    parts = []
    # Front end and cabin share the road-car generator up to the bulkhead.
    g_cab = dict(g)
    g_cab["bulk"] = vc.at(g, 0.92)
    g_cab["cabin"] = g_cab["bulk"] - g_cab["fire"]
    g_cab["roof_f"] = 0.30
    g_cab["roof_r"] = 0.88
    g_cab["roof_f_y"] = vc.at(g_cab, 0.30)
    g_cab["roof_r_y"] = vc.at(g_cab, 0.88)
    g_cab["back"] = 0.92
    g_cab["split"] = 1.0
    parts += vc.body_parts(g_cab, "pickup")
    _greenhouse(g_cab, parts)
    _doors(g_cab, parts)
    parts += vc.wheel_arches(g_cab)

    # Bed: floor, two side walls, a headboard and a real tailgate.
    bed_f = g_cab["bulk"] + 0.05
    bed_r = g["rear"] - 0.02
    bed_z = g["belt"] - 0.12
    half_w = g["half_w"]
    parts.append(lib.box("bed_floor", (g["width"] - 0.06, bed_r - bed_f, 0.06),
                         (0, (bed_f + bed_r) / 2, bed_z), vc.PAINT, 0.012, 2))
    for side, tag in ((-1, "left"), (1, "right")):
        pts = [(bed_f, bed_z), (bed_r, bed_z), (bed_r, bed_z + 0.46), (bed_f, bed_z + 0.50)]
        parts.append(vc.solid("bed_%s_side" % tag, pts,
                              side * (half_w - 0.075), side * half_w, vc.PAINT, 0.014, 3))
    parts.append(lib.box("bed_headboard", (g["width"] - 0.10, 0.07, 0.52),
                         (0, bed_f + 0.02, bed_z + 0.26), vc.PAINT, 0.012, 2))
    gate_pts = [(bed_r - 0.05, bed_z + 0.02), (bed_r - 0.05, bed_z + 0.46),
                (bed_r, bed_z + 0.44), (bed_r, bed_z + 0.02)]
    gate = vc.solid("boot", gate_pts, -half_w + 0.08, half_w - 0.08, vc.PAINT, 0.012, 2)
    parts.append(vc.hinge(gate, (0, bed_r, bed_z + 0.46)))

    # Chassis rails and the rear end under the bed.
    for side in (-1, 1):
        parts.append(lib.box("rail_%s" % ("l" if side < 0 else "r"), (0.09, bed_r - g["front"] - 0.2, 0.16),
                             (side * 0.42, (g["front"] + bed_r) / 2, g["floor"] + 0.16),
                             "cast_iron", 0.008, 2))
    tail = [(g["rear"], g["belt"] - 0.14), (g["rear"] - 0.03, g["belt"] - 0.10),
            (g["bulk"], g["belt"] - 0.14), (g["bulk"], g["floor"] - 0.02)]
    tail += list(reversed(vc.bottom_edge(g, g["bulk"], g["rear"])))
    parts.append(vc.solid("tail", tail, -half_w + 0.014, half_w - 0.014, vc.PAINT, 0.018, 3))
    for side, tag in ((-1, "left"), (1, "right")):
        parts.append(vc.solid("rear_%s_quarter" % tag, tail,
                              side * (half_w - 0.016), side * half_w, vc.PAINT, 0.012, 3))

    parts += vc.bumpers(g)
    parts += vc.lamps(g)
    parts += vc.grille(g)
    parts += vc.mirrors(g)
    parts += vc.sill_trim(g)
    parts += vc.wipers(g)
    parts += vc.tailpipe(g)
    return parts


# ------------------------------------------------------------- recovery truck
def recovery_truck():
    g = vc.make(SPECS["recovery_truck"])
    g["roof_f_y"] = vc.at(g, g["roof_f"])
    g["roof_r_y"] = g["bulk"]
    g["rear_windows"] = False

    parts = []
    cab_bulk = vc.at(g, 0.55)
    g_cab = dict(g)
    g_cab["bulk"] = cab_bulk
    g_cab["cabin"] = cab_bulk - g_cab["fire"]
    g_cab["roof_f"] = 0.16
    g_cab["roof_r"] = 0.98
    g_cab["roof_f_y"] = vc.at(g_cab, 0.16)
    g_cab["roof_r_y"] = vc.at(g_cab, 0.98)
    g_cab["back"] = 1.0
    g_cab["split"] = 1.0
    g_cab["tail_top"] = "belt"
    parts += vc.body_parts(g_cab, "truck")
    _greenhouse(g_cab, parts)
    _doors(g_cab, parts)
    parts += vc.wheel_arches(g_cab)

    half_w = g["half_w"]
    deck_z = g["belt"] - 0.06
    bed_f = cab_bulk + 0.06
    bed_r = g["rear"] - 0.02

    # Flatbed with a steel deck, side rails and a beaver tail.
    parts.append(lib.box("flatbed", (g["width"] - 0.04, bed_r - bed_f, 0.10),
                         (0, (bed_f + bed_r) / 2, deck_z), "steel", 0.014, 3))
    for side, tag in ((-1, "left"), (1, "right")):
        parts.append(lib.box("bed_rail_%s" % tag, (0.07, bed_r - bed_f, 0.16),
                             (side * (half_w - 0.05), (bed_f + bed_r) / 2, deck_z + 0.12),
                             "steel", 0.010, 2))
        y = bed_f + (bed_r - bed_f) * 0.5
        parts.append(lib.box("bed_post_%s" % tag, (0.06, 0.06, 0.44),
                             (side * (half_w - 0.06), y, deck_z + 0.22), "steel", 0.008, 2))
        parts.append(lib.box("step_%s" % tag, (0.16, 0.34, 0.05),
                             (side * (half_w - 0.02), cab_bulk + 0.22, g["floor"] + 0.28),
                             "cast_iron", 0.008, 2))

    # Boom: a braced arm over the bed with a winch drum at its heel.
    boom_a = (0.0, bed_f + 0.16, deck_z + 0.20)
    boom_b = (0.0, bed_r - 0.75, deck_z + 0.92)
    parts.append(vc.tube("boom", [boom_a, boom_b], 0.085, "steel", 10))
    parts.append(vc.tube("boom_brace", [(0.0, bed_f + 0.30, deck_z + 0.10),
                                       (0.0, bed_f + 1.05, deck_z + 0.72)], 0.045, "steel", 8))
    parts.append(vc.tube("winch_drum", [(-0.26, bed_f + 0.30, deck_z + 0.30),
                                        (0.26, bed_f + 0.30, deck_z + 0.30)], 0.11, "cast_iron", 12))
    parts.append(vc.tube("winch_cable", [(0.0, bed_f + 0.32, deck_z + 0.40),
                                         (0.0, bed_r - 0.80, deck_z + 0.86)], 0.012, "steel", 4))

    # Beacons on the cab roof and a light bar over the windscreen.
    for side in (-1, 1):
        parts.append(vc.revolve("beacon_%s" % ("l" if side < 0 else "r"),
                                [(0.045, 0.0), (0.058, 0.03), (0.050, 0.10), (0.030, 0.13), (0.045, 0.0)],
                                "emissive_warm", 12,
                                (side * 0.55, g_cab["roof_f_y"] + 0.30, g["roof"] + 0.01)))

    # Chassis rails under the bed.
    for side in (-1, 1):
        parts.append(lib.box("rail_%s" % ("l" if side < 0 else "r"),
                             (0.12, bed_r - g["front"] - 0.3, 0.20),
                             (side * 0.48, (g["front"] + bed_r) / 2, g["floor"] + 0.18),
                             "cast_iron", 0.010, 2))

    tail = [(g["rear"], deck_z - 0.02), (g["rear"] - 0.04, deck_z + 0.06),
            (g["bulk"], deck_z + 0.04), (g["bulk"], g["floor"] - 0.02)]
    tail += list(reversed(vc.bottom_edge(g, g["bulk"], g["rear"])))
    parts.append(vc.solid("tail", tail, -half_w + 0.014, half_w - 0.014, vc.PAINT, 0.018, 3))
    for side, tag in ((-1, "left"), (1, "right")):
        parts.append(vc.solid("rear_%s_quarter" % tag, tail,
                              side * (half_w - 0.016), side * half_w, vc.PAINT, 0.012, 3))

    # A ladder on the rear of the bed, because a recovery truck always has one.
    for side in (-1, 1):
        parts.append(vc.tube("ladder_%s" % ("l" if side < 0 else "r"),
                             [(side * 0.22, g["rear"] - 0.10, g["floor"] + 0.40),
                              (side * 0.22, g["rear"] - 0.10, deck_z + 0.05)], 0.020, "steel", 6))
    for i in range(2):
        z = g["floor"] + 0.56 + i * 0.22
        parts.append(vc.tube("ladder_rung_%d" % i,
                             [(-0.22, g["rear"] - 0.10, z), (0.22, g["rear"] - 0.10, z)],
                             0.014, "steel", 5))

    parts += vc.bumpers(g)
    parts += vc.lamps(g)
    parts += vc.grille(g, slats=3)
    parts += vc.mirrors(g)
    parts += vc.tailpipe(g)
    return parts


# ---------------------------------------------------------------------- entry
def build(name):
    if name in ("car_pickup",):
        return pickup()
    if name in ("recovery_truck",):
        return recovery_truck()
    if name in SPECS:
        return road_car(name)
    raise KeyError("no vehicle named %s" % name)


BUILDERS = {name: (lambda n=name: finish(n, build(n)))
            for name in SPECS}
