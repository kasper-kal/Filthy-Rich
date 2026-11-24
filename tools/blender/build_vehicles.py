"""Phase 6 — vehicles (FINALLY-3D.md §10).

Twenty-nine assets: seven car bodies, four wheels plus a hubcap, seven trim
pieces, four interiors and the six damage/dirt overlays.

Run:  blender --background --factory-startup --python-exit-code 1 \
        --python tools/blender/build_vehicles.py [-- name ...]

Bodies are exported **unmerged** with named panels, because `DamageVisuals`
walks the chassis by name and `Vehicle` looks the wheels up separately. The
doors keep their hinge-edge pivots (`keep_origin`), so `AN_door_open` has
something to rotate.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import lib  # noqa: E402
import vehicle_common  # noqa: E402
import vehicles_body  # noqa: E402
import vehicles_parts  # noqa: E402

GROUP = "vehicles"

BUILDERS = {}
BUILDERS.update(vehicles_body.BUILDERS)
BUILDERS.update(vehicles_parts.BUILDERS)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    wanted = argv or list(BUILDERS)
    failures = []
    for name in wanted:
        if name not in BUILDERS:
            failures.append("%s: no builder" % name)
            continue
        try:
            lib.wipe()
            BUILDERS[name]()
        except Exception as error:  # noqa: BLE001 — one bad asset must not stop the rest
            import traceback
            traceback.print_exc()
            failures.append("%s: %s" % (name, error))
    lib.report(GROUP)
    if failures:
        print("\nFAILURES:")
        for failure in failures:
            print("  " + failure)
        sys.exit(1)


main()
