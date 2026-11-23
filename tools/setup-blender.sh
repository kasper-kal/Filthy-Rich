#!/usr/bin/env bash
# setup-blender.sh — rebuild the headless Blender toolchain from nothing.
#
#   ./tools/setup-blender.sh                  # everything (idempotent)
#   ./tools/setup-blender.sh --extensions-only  # just the add-ons
#   ./tools/setup-blender.sh --check          # verify, install nothing
#
# Why this exists: Blender, its shared libraries and the extensions all live
# outside the repo ($HOME), so a workspace reset wipes them. The repo survives;
# this script puts the tool back in one command.
#
# What it does, in order:
#   1. Blender 4.2.23 LTS      -> $HOME/blender
#   2. Missing X libraries     -> $HOME/blender-libs   (no root needed)
#   3. Extension list sync     -> enables online access once
#   4. Seven extensions        -> archimesh, sapling, cell fracture, ivy,
#                                 extra mesh/curve objects, bolt factory
#   5. Capability check        -> fails loudly if any of it does not work
#
# Everything is skippable and idempotent: run it as often as you like.

set -euo pipefail

BLENDER_VERSION="${BLENDER_VERSION:-4.2.23}"
BLENDER_DIR="${BLENDER_DIR:-$HOME/blender}"
BLENDER_BIN="${BLENDER_BIN:-$BLENDER_DIR/blender}"
LIBS_DIR="${LIBS_DIR:-$HOME/blender-libs}"
DEB_CACHE="${DEB_CACHE:-$HOME/blibs}"

# Extensions used by the asset pipeline (FINALLY-3D.md §2.3).
EXTENSIONS=(
  archimesh
  sapling_tree_gen
  cell_fracture
  ivygen
  extra_mesh_objects
  extra_curve_objectes
  boltfactory
)

# Ubuntu packages Blender needs on a bare image. Pool paths are searched for
# the newest matching .deb, so a version bump on the mirror cannot break this.
DEB_PACKAGES=(
  "libx/libxrender libxrender1"
  "libx/libxfixes libxfixes3"
  "libx/libxi libxi6"
  "libx/libxcursor libxcursor1"
  "libx/libxext libxext6"
  "libx/libxinerama libxinerama1"
  "libx/libxrandr libxrandr2"
  "libx/libxxf86vm libxxf86vm1"
  "libx/libxkbcommon libxkbcommon0"
  "libi/libice libice6"
  "libs/libsm libsm6"
  "libg/libglvnd libgl1"
  "libg/libglvnd libegl1"
  "libg/libglu libglu1-mesa"
  "f/freetype libfreetype6"
  "f/fontconfig libfontconfig1"
)

MIRROR="${UBUNTU_MIRROR:-http://archive.ubuntu.com/ubuntu}"
BLENDER_URL="${BLENDER_URL:-https://download.blender.org/release/Blender4.2/blender-$BLENDER_VERSION-linux-x64.tar.xz}"

MODE="all"
for arg in "$@"; do
  case "$arg" in
    --extensions-only) MODE="extensions" ;;
    --check)           MODE="check" ;;
    --help|-h)         sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $arg (try --help)" >&2; exit 2 ;;
  esac
done

step() { printf '\033[1m==> %s\033[0m\n' "$*"; }
ok()   { printf '    ok  %s\n' "$*"; }
warn() { printf '    !!  %s\n' "$*" >&2; }
die()  { printf '\nFAILED: %s\n' "$*" >&2; exit 1; }

# Blender will not start without the unpacked libraries on this image.
bl() {
  LD_LIBRARY_PATH="$LIBS_DIR/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" \
    "$BLENDER_BIN" "$@"
}

# ---------------------------------------------------------------- 1. Blender
install_blender() {
  if [ -x "$BLENDER_BIN" ]; then
    ok "Blender present: $($BLENDER_BIN --version 2>/dev/null | head -1 || echo "$BLENDER_BIN")"
    return
  fi
  step "Downloading Blender $BLENDER_VERSION (about 350 MB, once per reset)"
  mkdir -p "$(dirname "$BLENDER_DIR")"
  tmp="$(mktemp -d)"
  curl -fL --retry 3 --progress-bar -o "$tmp/blender.tar.xz" "$BLENDER_URL" \
    || die "could not download $BLENDER_URL"
  tar -xJf "$tmp/blender.tar.xz" -C "$tmp" || die "could not extract Blender archive"
  rm -rf "$BLENDER_DIR"
  mv "$tmp"/blender-* "$BLENDER_DIR"
  rm -rf "$tmp"
  [ -x "$BLENDER_BIN" ] || die "Blender extracted but $BLENDER_BIN is missing"
  ok "installed to $BLENDER_DIR"
}

# ------------------------------------------------------------- 2. X libraries
missing_libs() {
  [ -x "$BLENDER_BIN" ] || { echo 1; return; }
  # Check with LIBS_DIR on the path: that is the state the build scripts run in.
  LD_LIBRARY_PATH="$LIBS_DIR/usr/lib/x86_64-linux-gnu" \
    ldd "$BLENDER_BIN" 2>/dev/null | grep -c "not found" || true
}

install_libs() {
  need="$(missing_libs)"
  if [ "${need:-0}" -eq 0 ]; then
    ok "shared libraries resolve without help"
    return
  fi
  step "$need shared libraries missing — fetching them into $LIBS_DIR (no root)"
  mkdir -p "$LIBS_DIR" "$DEB_CACHE"
  for entry in "${DEB_PACKAGES[@]}"; do
    pool="${entry%% *}"
    pkg="${entry##* }"
    if ls "$DEB_CACHE/${pkg}_"*.deb >/dev/null 2>&1; then
      file="$(ls -1 "$DEB_CACHE/${pkg}_"*.deb | tail -1)"
    else
      listing="$(curl -fsSL "$MIRROR/pool/main/$pool/" || true)"
      [ -n "$listing" ] || { warn "$pkg: pool listing unavailable"; continue; }
      name="$(printf '%s' "$listing" \
        | grep -o "${pkg}_[A-Za-z0-9.+~:-]*_amd64\.deb" \
        | sort -uV | tail -1)"
      [ -n "$name" ] || { warn "$pkg: no amd64 .deb on mirror"; continue; }
      curl -fsSL -o "$DEB_CACHE/$name" "$MIRROR/pool/main/$pool/$name" \
        || { warn "$pkg: download failed"; continue; }
      file="$DEB_CACHE/$name"
    fi
    dpkg-deb -x "$file" "$LIBS_DIR" || warn "$pkg: extraction failed"
  done
  need="$(missing_libs)"
  [ "${need:-0}" -eq 0 ] || die "$need libraries still unresolved — see FINALLY-3D.md §2.3"
  ok "libraries unpacked into $LIBS_DIR"
}

# ------------------------------------------------------------- 3. Extensions
# NOTE: never pipe Blender into `grep -q` here. grep exits on first match, Blender
# gets SIGPIPE and `set -o pipefail` turns a success into a failure. Capture
# the output, then match it.
enable_online_access() {
  local out
  out="$(bl --background --factory-startup --python-expr "
import bpy
if not bpy.context.preferences.system.use_online_access:
    bpy.context.preferences.system.use_online_access = True
    bpy.ops.wm.save_userpref()
print('ONLINE', bpy.context.preferences.system.use_online_access)
" 2>/dev/null || true)"
  case "$out" in
    *"ONLINE True"*) ok "online access enabled" ;;
    *) die "could not enable online access in Blender preferences" ;;
  esac
}

# `extension list` prints the whole remote catalogue, so it cannot tell us what
# is installed. Ask Blender where it puts them, then look on disk.
extensions_root() {
  local out
  out="$(bl --background --command extension repo-list 2>/dev/null || true)"
  printf '%s\n' "$out" | sed -n 's/^    directory: "\(.*blender_org\)"$/\1/p' | head -1
}

have_extension() {
  local root
  root="$(extensions_root)"
  [ -n "$root" ] && [ -d "$root/$1" ]
}

install_extensions() {
  step "Installing ${#EXTENSIONS[@]} extensions"
  enable_online_access
  bl --background --command extension sync >/dev/null 2>&1 \
    || die "extension repository sync failed (network?)"
  ok "extension catalogue synced"
  for id in "${EXTENSIONS[@]}"; do
    if have_extension "$id"; then
      ok "$id already installed"
      continue
    fi
    out="$(bl --background --command extension install "$id" -e 2>&1 || true)"
    case "$out" in
      *Installed*) ok "$id installed" ;;
      *"already"*) ok "$id already installed" ;;
      *) warn "$id could not be installed" ;;
    esac
  done
}

# ---------------------------------------------------------------- 4. Verify
verify() {
  step "Checking the toolchain"
  [ -x "$BLENDER_BIN" ] || die "Blender binary missing at $BLENDER_BIN"
  local out
  out="$(bl --background --factory-startup --python-exit-code 1 --python-expr "
import bpy, addon_utils
wanted = ['archimesh','sapling_tree_gen','cell_fracture','ivygen',
          'extra_mesh_objects','extra_curve_objectes','boltfactory']
have = {m.__name__ for m in addon_utils.modules()}
missing = [w for w in wanted if 'bl_ext.blender_org.' + w not in have]
print('EXTENSIONS_OK' if not missing else 'EXTENSIONS_MISSING ' + ' '.join(missing))
print('BLENDER_OK', bpy.app.version_string)
" 2>&1 || true)"
  case "$out" in
    *EXTENSIONS_MISSING*) die "missing extensions: ${out##*EXTENSIONS_MISSING }" ;;
    *EXTENSIONS_OK*) ok "all seven extensions load" ;;
    *) die "Blender did not run — check $BLENDER_BIN and $LIBS_DIR" ;;
  esac
  printf '%s\n' "$out" | sed -n 's/^BLENDER_OK /    ok  Blender /p'
}

summary() {
  cat <<EOF

Toolchain ready.
  Blender : $BLENDER_BIN ($(bl --version 2>/dev/null | head -1))
  Libraries: $LIBS_DIR
  Extensions: ${EXTENSIONS[*]}

Use it for every build (FINALLY-3D.md §2):
  export LD_LIBRARY_PATH=$LIBS_DIR/usr/lib/x86_64-linux-gnu
  $BLENDER_BIN --background --factory-startup --python-exit-code 1 \\
      --python tools/blender/build_<group>.py

Re-run this script any time; it skips whatever is already present.
EOF
}

case "$MODE" in
  check)
    verify
    ;;
  extensions)
    [ -x "$BLENDER_BIN" ] || die "no Blender at $BLENDER_BIN — run without --extensions-only"
    install_extensions
    verify
    ;;
  all)
    install_blender
    install_libs
    install_extensions
    verify
    summary
    ;;
esac
