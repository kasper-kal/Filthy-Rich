#!/usr/bin/env node
/**
 * validate-models.mjs — the gate every asset phase must pass (FINALLY-3D.md §16.4).
 *
 * No dependencies: reads the GLB header and JSON chunk directly.
 *
 * Checks
 *   1. every .glb starts with the "glTF" magic
 *   2. every asset has at least one mesh and one material
 *   3. triangle counts are inside the per-group budget
 *   4. every material name is in the palette
 *   5. bounds are sane (nothing empty, nothing larger than 12 m)
 *   6. the manifest matches the files on disk
 *
 * Usage: node tools/validate-models.mjs [--group architecture]
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_DIR = join(ROOT, 'public', 'models');
const MANIFEST = join(MODEL_DIR, 'models.manifest.json');

const BUDGET = {
  architecture: 2600,
  fixtures: 2600,
  furniture: 6500,
  decor: 1200,
  trash: 400,
  tools: 2000,
  vehicles: 12000,
  repair: 3000,
  exterior: 8000,
  vegetation: 3600,
  grime: 900,
};

const PALETTE = new Set([
  'paint_white', 'paint_cream', 'plaster', 'tile_white', 'tile_grout',
  'oak', 'oak_light', 'oak_dark', 'walnut', 'brass', 'steel',
  'glass_clear', 'plastic_white', 'grime', 'teal', 'linen', 'ceramic',
  'leaf', 'rug', 'paper', 'chrome', 'cast_iron', 'rubber', 'brick',
  'render', 'roof_tile', 'asphalt', 'concrete', 'grass', 'mould',
  'glass_frosted', 'fabric_olive', 'fabric_rust', 'fruit_red', 'fruit_orange',
  'glass_green', 'cardboard', 'foil', 'plastic_red', 'grease',
  'paint', 'glass_tint', 'leather_black', 'rust', 'rug_red',
  'emissive_warm', 'emissive_cool', 'emissive_red',
]);

const args = process.argv.slice(2);
const onlyGroup = args.includes('--group') ? args[args.indexOf('--group') + 1] : null;

const errors = [];
const warnings = [];
const rows = [];

function readGlb(path) {
  const buffer = readFileSync(path);
  if (buffer.length < 20 || buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('not a GLB file');
  }
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength));
  return { json, bytes: buffer.length };
}

function triangles(json) {
  let total = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const count =
        prim.indices !== undefined
          ? json.accessors[prim.indices].count
          : json.accessors[prim.attributes.POSITION].count;
      total += count / 3;
    }
  }
  return Math.round(total);
}

const groups = readdirSync(MODEL_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((g) => !onlyGroup || g === onlyGroup);

for (const group of groups) {
  const dir = join(MODEL_DIR, group);
  const budget = BUDGET[group];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.glb')).sort()) {
    const path = join(dir, file);
    const label = `${group}/${file}`;
    try {
      const { json, bytes } = readGlb(path);
      const tris = triangles(json);
      const materials = (json.materials ?? []).map((m) => m.name ?? '(unnamed)');

      if (!json.meshes?.length) errors.push(`${label}: no meshes`);
      if (!materials.length) errors.push(`${label}: no materials`);
      if (budget && tris > budget) errors.push(`${label}: ${tris} tris over budget ${budget}`);
      if (json.accessors?.length) {
        const pos = json.meshes[0].primitives[0].attributes.POSITION;
        const min = json.accessors[pos].min ?? [];
        const max = json.accessors[pos].max ?? [];
        const extent = Math.max(...min.map((v, i) => Math.abs(max[i] - v)));
        if (!Number.isFinite(extent) || extent <= 0) errors.push(`${label}: empty bounds`);
        if (extent > 12) errors.push(`${label}: ${extent.toFixed(1)} m is larger than a street`);
      }
      for (const name of materials) {
        const key = name.replace(/^fr_/, '');
        if (!PALETTE.has(key)) warnings.push(`${label}: material "${name}" not in the palette`);
      }
      if (!json.meshes?.[0]?.primitives?.[0]?.attributes?.COLOR_0) {
        warnings.push(`${label}: no baked AO (COLOR_0)`);
      }
      rows.push({ label, tris, bytes, materials: materials.length });
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }
}

// manifest agreement
if (existsSync(MANIFEST)) {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const listed = new Set(manifest.assets.map((a) => a.path));
  for (const row of rows) {
    if (!listed.has(row.label)) warnings.push(`${row.label}: missing from the manifest`);
  }
  for (const entry of manifest.assets) {
    const path = join(MODEL_DIR, entry.path);
    if (!existsSync(path)) errors.push(`${entry.path}: in the manifest but not on disk`);
    else if (onlyGroup === null || entry.path.startsWith(onlyGroup + '/')) {
      const actual = statSync(path).size;
      if (actual !== entry.bytes) warnings.push(`${entry.path}: size changed since the build`);
    }
  }
} else {
  warnings.push('no models.manifest.json yet');
}

const totalTris = rows.reduce((sum, r) => sum + r.tris, 0);
const totalKb = (rows.reduce((sum, r) => sum + r.bytes, 0) / 1024).toFixed(0);

for (const row of rows) {
  console.log(
    `${row.label.padEnd(42)} ${String(row.tris).padStart(6)} tris ${String(row.materials).padStart(2)} mat ${String((row.bytes / 1024).toFixed(1)).padStart(7)} KB`,
  );
}
console.log(`\n${rows.length} assets · ${totalTris} tris · ${totalKb} KB`);

if (warnings.length) {
  console.log('\nwarnings:');
  for (const w of warnings) console.log('  ! ' + w);
}
if (errors.length) {
  console.log('\nerrors:');
  for (const e of errors) console.log('  x ' + e);
  process.exit(1);
}
console.log('\nall checks passed');
