"""Phase 5 — the cleaning kit (FINALLY-3D.md §9).

Twenty-one assets: the four tools the player holds, both gloved hands, and the
buckets, brushes and soft goods that dress a cleaning job. Unlike every earlier
group these are exported as several named objects plus `SOC_*` empties, because
the HUD looks up `liquid` and the sockets by name at runtime.

Run:  blender --background --factory-startup --python-exit-code 1 \
        --python tools/blender/build_tools.py [-- name ...]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import lib  # noqa: E402
import tool_common  # noqa: E402
import tools_held  # noqa: E402
import tools_kit  # noqa: E402

GROUP = "tools"

BUILDERS = {}
for module in (tools_held, tools_kit):
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
            parts = BUILDERS[name]()
            tool_common.finish(parts, GROUP, name)
        except Exception as error:  # noqa: BLE001 — one bad asset must not stop the rest
            failures.append("%s: %s" % (name, error))
    lib.report(GROUP)
    if failures:
        print("\nFAILURES:")
        for failure in failures:
            print("  " + failure)
        sys.exit(1)


main()
