"""Phase 4 — trash, clutter and spills (FINALLY-3D.md §8).

The objects the core interaction is about: 42 litter models plus four chunky
spills. Every asset is a bottom-centre-origin, AO-baked, pruned GLB under 350
triangles, because the game has twenty-odd of them on the floor at once.

Run:  blender --background --factory-startup --python-exit-code 1 \
        --python tools/blender/build_trash.py [-- name ...]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import lib  # noqa: E402
import trash_drink  # noqa: E402
import trash_hard  # noqa: E402
import trash_paper  # noqa: E402
import trash_soft  # noqa: E402
import trash_spill  # noqa: E402

GROUP = "trash"

BUILDERS = {}
for module in (trash_paper, trash_drink, trash_soft, trash_hard, trash_spill):
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
