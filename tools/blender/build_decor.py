"""Phase 3 — decor (FINALLY-3D.md §7).

Props that make an empty room read as lived in: textiles, wall art, tableware,
small appliances, bathroom bits and hallway clutter. Dirt is still a mask plus
decals (§13), so every asset here is clean.

Run:  blender --background --factory-startup --python-exit-code 1 \
        --python tools/blender/build_decor.py [-- name ...]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import decor_bedroom  # noqa: E402
import decor_dining  # noqa: E402
import decor_entry  # noqa: E402
import decor_living  # noqa: E402
import decor_study  # noqa: E402
import lib  # noqa: E402

GROUP = "decor"

BUILDERS = {}
for module in (decor_living, decor_dining, decor_bedroom, decor_study, decor_entry):
    BUILDERS.update(module.BUILDERS)


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
            obj = BUILDERS[name]()
            lib.bake_ao(obj)
            lib.export_glb(obj, GROUP, name)
        except Exception as error:  # noqa: BLE001 — one bad asset must not stop the rest
            failures.append("%s: %s" % (name, error))
    lib.report(GROUP)
    if failures:
        print("\nFAILURES:")
        for failure in failures:
            print("  " + failure)
        sys.exit(1)


main()
