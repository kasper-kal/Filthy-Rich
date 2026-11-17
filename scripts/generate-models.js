#!/usr/bin/env node
/**
 * Generates the furniture models the game expects in public/models/furniture/.
 *
 * These were never committed, so the loader fell back to placeholder boxes.
 * Everything here is built from primitives in metres, Y-up, with the model's
 * bottom resting on y = 0 (which is what FurnitureManager assumes).
 *
 * Writes valid glTF 2.0 binary (.glb) files using a small built-in writer,
 * so no extra tooling or dependencies are needed:  node scripts/generate-models.js
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUT_DIR = 'public/models/furniture';

// ---------------------------------------------------------------- materials
const MAT = {
  wood: { color: [0.42, 0.28, 0.16], metallic: 0.0, roughness: 0.75 },
  darkWood: { color: [0.24, 0.15, 0.09], metallic: 0.0, roughness: 0.7 },
  paleWood: { color: [0.62, 0.48, 0.32], metallic: 0.0, roughness: 0.8 },
  fabric: { color: [0.33, 0.36, 0.44], metallic: 0.0, roughness: 0.95 },
  fabricWarm: { color: [0.55, 0.38, 0.30], metallic: 0.0, roughness: 0.95 },
  fabricPale: { color: [0.72, 0.70, 0.66], metallic: 0.0, roughness: 0.95 },
  leather: { color: [0.28, 0.16, 0.12], metallic: 0.0, roughness: 0.55 },
  metal: { color: [0.45, 0.45, 0.48], metallic: 0.9, roughness: 0.3 },
  black: { color: [0.07, 0.07, 0.08], metallic: 0.3, roughness: 0.6 },
  ceramic: { color: [0.86, 0.85, 0.82], metallic: 0.0, roughness: 0.4 },
  terracotta: { color: [0.52, 0.28, 0.19], metallic: 0.0, roughness: 0.85 },
  leaf: { color: [0.16, 0.38, 0.16], metallic: 0.0, roughness: 0.9 },
  leafLight: { color: [0.22, 0.47, 0.20], metallic: 0.0, roughness: 0.9 },
  glass: { color: [0.74, 0.83, 0.87], metallic: 0.1, roughness: 0.05 },
  lampShade: { color: [0.93, 0.89, 0.78], metallic: 0.0, roughness: 0.85 },
  canvas: { color: [0.30, 0.42, 0.55], metallic: 0.0, roughness: 0.9 },
  rug: { color: [0.45, 0.30, 0.32], metallic: 0.0, roughness: 1.0 },
  rugTrim: { color: [0.68, 0.58, 0.45], metallic: 0.0, roughness: 1.0 },
  screen: { color: [0.10, 0.11, 0.13], metallic: 0.2, roughness: 0.25 },
};

// ---------------------------------------------------------------- geometry
// Each generator returns { positions: number[], normals: number[], indices: number[] }

function box(w, h, d) {
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  const positions = [];
  const normals = [];
  const indices = [];

  const faces = [
    { n: [0, 0, 1], v: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]] },
    { n: [0, 0, -1], v: [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]] },
    { n: [1, 0, 0], v: [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]] },
    { n: [-1, 0, 0], v: [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]] },
    { n: [0, 1, 0], v: [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]] },
    { n: [0, -1, 0], v: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]] },
  ];

  for (const face of faces) {
    const base = positions.length / 3;
    for (const vertex of face.v) {
      positions.push(vertex[0], vertex[1], vertex[2]);
      normals.push(face.n[0], face.n[1], face.n[2]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return { positions, normals, indices };
}

function cylinder(radiusTop, radiusBottom, height, segments = 16) {
  const positions = [];
  const normals = [];
  const indices = [];
  const half = height / 2;
  const slope = (radiusBottom - radiusTop) / height;

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const x0 = Math.cos(a0);
    const z0 = Math.sin(a0);
    const x1 = Math.cos(a1);
    const z1 = Math.sin(a1);

    const base = positions.length / 3;
    // Two triangles per side quad; normals lean outwards for a tapered cylinder.
    positions.push(x0 * radiusBottom, -half, z0 * radiusBottom);
    positions.push(x1 * radiusBottom, -half, z1 * radiusBottom);
    positions.push(x1 * radiusTop, half, z1 * radiusTop);
    positions.push(x0 * radiusTop, half, z0 * radiusTop);
    for (const [nx, nz] of [
      [x0, z0],
      [x1, z1],
      [x1, z1],
      [x0, z0],
    ]) {
      const len = Math.hypot(nx, 1, nz) || 1;
      normals.push(nx / len, slope > 0 ? 0.2 : 0.2, nz / len);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Caps
  for (const [y, radius, ny] of [
    [half, radiusTop, 1],
    [-half, radiusBottom, -1],
  ]) {
    if (radius <= 0) continue;
    const centre = positions.length / 3;
    positions.push(0, y, 0);
    normals.push(0, ny, 0);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
      normals.push(0, ny, 0);
    }
    for (let i = 0; i < segments; i++) {
      if (ny > 0) indices.push(centre, centre + i + 2, centre + i + 1);
      else indices.push(centre, centre + i + 1, centre + i + 2);
    }
  }

  return { positions, normals, indices };
}

function sphere(radius, segments = 14, rings = 8) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI;
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      positions.push(nx * radius, ny * radius, nz * radius);
      normals.push(nx, ny, nz);
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  return { positions, normals, indices };
}

// ---------------------------------------------------------------- transforms
function transform(geo, translate = [0, 0, 0], rotate = [0, 0, 0], scale = [1, 1, 1]) {
  const [rx, ry, rz] = rotate;
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);

  const positions = [];
  const normals = [];

  for (let i = 0; i < geo.positions.length; i += 3) {
    let x = geo.positions[i] * scale[0];
    let y = geo.positions[i + 1] * scale[1];
    let z = geo.positions[i + 2] * scale[2];

    // Rotate X
    let y1 = y * cosX - z * sinX;
    let z1 = y * sinX + z * cosX;
    // Rotate Y
    let x2 = x * cosY + z1 * sinY;
    let z2 = -x * sinY + z1 * cosY;
    // Rotate Z
    let x3 = x2 * cosZ - y1 * sinZ;
    let y3 = x2 * sinZ + y1 * cosZ;

    positions.push(x3 + translate[0], y3 + translate[1], z2 + translate[2]);

    const nx0 = geo.normals[i];
    const ny0 = geo.normals[i + 1];
    const nz0 = geo.normals[i + 2];
    const nyA = ny0 * cosX - nz0 * sinX;
    const nzA = ny0 * sinX + nz0 * cosX;
    const nxB = nx0 * cosY + nzA * sinY;
    const nzB = -nx0 * sinY + nzA * cosY;
    normals.push(nxB * cosZ - nyA * sinZ, nxB * sinZ + nyA * cosZ, nzB);
  }

  return { positions, normals, indices: geo.indices };
}

// ---------------------------------------------------------------- part helpers
const parts = [];
function part(geometry, material, translate = [0, 0, 0], rotate = [0, 0, 0], scale = [1, 1, 1]) {
  parts.push({
    geo: transform(geometry, translate, rotate, scale),
    material: MAT[material] || MAT.wood,
  });
}

function leg(x, z, height, radius = 0.022, material = 'darkWood') {
  part(cylinder(radius, radius, height, 10), material, [x, height / 2, z]);
}

// ---------------------------------------------------------------- models
const MODELS = {
  armchair() {
    part(box(0.72, 0.16, 0.72), 'fabric', [0, 0.42, 0]);
    part(box(0.72, 0.34, 0.16), 'fabric', [0, 0.68, -0.28], [-0.16, 0, 0]);
    part(box(0.16, 0.28, 0.62), 'fabric', [-0.32, 0.55, 0.04]);
    part(box(0.16, 0.28, 0.62), 'fabric', [0.32, 0.55, 0.04]);
    part(box(0.58, 0.10, 0.56), 'fabricPale', [0, 0.52, 0.04]);
    for (const [x, z] of [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.3], [0.3, -0.3]]) leg(x, z, 0.34);
  },

  sofa() {
    part(box(1.9, 0.18, 0.85), 'fabricWarm', [0, 0.42, 0]);
    part(box(1.9, 0.42, 0.18), 'fabricWarm', [0, 0.72, -0.34], [-0.1, 0, 0]);
    part(box(0.18, 0.32, 0.8), 'fabricWarm', [-0.86, 0.6, 0.02]);
    part(box(0.18, 0.32, 0.8), 'fabricWarm', [0.86, 0.6, 0.02]);
    part(box(0.82, 0.12, 0.62), 'fabricPale', [-0.45, 0.57, 0.06]);
    part(box(0.82, 0.12, 0.62), 'fabricPale', [0.45, 0.57, 0.06]);
    part(box(0.4, 0.32, 0.12), 'fabricPale', [-0.45, 0.72, -0.24], [-0.12, 0, 0]);
    part(box(0.4, 0.32, 0.12), 'fabricPale', [0.45, 0.72, -0.24], [-0.12, 0, 0]);
    for (const [x, z] of [[-0.82, 0.34], [0.82, 0.34], [-0.82, -0.34], [0.82, -0.34]])
      leg(x, z, 0.33, 0.026);
  },

  office_chair() {
    part(box(0.48, 0.09, 0.46), 'black', [0, 0.47, 0]);
    part(box(0.44, 0.5, 0.08), 'black', [0, 0.78, -0.2], [-0.1, 0, 0]);
    part(cylinder(0.03, 0.03, 0.3, 10), 'metal', [0, 0.3, 0]);
    part(cylinder(0.05, 0.12, 0.16, 12), 'metal', [0, 0.15, 0]);
    part(box(0.06, 0.12, 0.06), 'black', [0, 0.55, 0.16]); // tilt lever
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      part(box(0.26, 0.04, 0.07), 'black', [Math.cos(a) * 0.16, 0.06, Math.sin(a) * 0.16], [0, -a, 0]);
    }
  },

  beanbag() {
    part(sphere(0.42, 16, 10), 'fabric', [0, 0.3, 0], [0, 0, 0], [1.05, 0.72, 1.05]);
    part(sphere(0.3, 14, 8), 'fabricPale', [0, 0.55, -0.16], [0, 0, 0], [1.0, 0.55, 0.7]);
  },

  dining_chair() {
    part(box(0.44, 0.06, 0.44), 'wood', [0, 0.45, 0]);
    part(box(0.44, 0.5, 0.06), 'wood', [0, 0.72, -0.19], [-0.08, 0, 0]);
    part(box(0.36, 0.04, 0.3), 'fabricPale', [0, 0.49, 0.02]);
    for (const [x, z] of [[-0.18, 0.18], [0.18, 0.18], [-0.18, -0.18], [0.18, -0.18]])
      leg(x, z, 0.44, 0.02);
  },

  bookshelf() {
    part(box(0.96, 0.05, 0.32), 'wood', [0, 0.03, 0]);
    part(box(0.96, 0.05, 0.32), 'wood', [0, 1.98, 0]);
    part(box(0.05, 2.0, 0.32), 'wood', [-0.455, 1.0, 0]);
    part(box(0.05, 2.0, 0.32), 'wood', [0.455, 1.0, 0]);
    part(box(0.96, 0.03, 0.30), 'wood', [0, 1.68, 0]);
    part(box(0.96, 0.03, 0.30), 'wood', [0, 1.20, 0]);
    part(box(0.96, 0.03, 0.30), 'wood', [0, 0.72, 0]);
    part(box(0.96, 0.02, 0.32), 'wood', [0, 1.9, 0]);
    // A few books so the shelf doesn't read as empty.
    part(box(0.05, 0.24, 0.2), 'fabricWarm', [-0.34, 1.36, 0.02]);
    part(box(0.04, 0.22, 0.2), 'canvas', [-0.26, 1.35, 0.02]);
    part(box(0.06, 0.26, 0.2), 'rug', [0.18, 1.37, 0.02]);
    part(box(0.05, 0.2, 0.19), 'fabric', [0.28, 1.34, 0.02]);
    part(box(0.05, 0.22, 0.2), 'leather', [-0.1, 0.86, 0.02]);
  },

  wardrobe() {
    part(box(1.15, 2.15, 0.58), 'wood', [0, 1.075, 0]);
    part(box(1.15, 0.06, 0.6), 'darkWood', [0, 2.18, 0]);
    part(box(0.55, 1.98, 0.02), 'paleWood', [-0.29, 1.08, 0.3]);
    part(box(0.55, 1.98, 0.02), 'paleWood', [0.29, 1.08, 0.3]);
    part(cylinder(0.012, 0.012, 0.14, 8), 'metal', [-0.05, 1.1, 0.33]);
    part(cylinder(0.012, 0.012, 0.14, 8), 'metal', [0.05, 1.1, 0.33]);
    for (const [x, z] of [[-0.5, 0.2], [0.5, 0.2], [-0.5, -0.2], [0.5, -0.2]]) leg(x, z, 0.06, 0.03);
  },

  tv_stand() {
    part(box(1.55, 0.06, 0.4), 'darkWood', [0, 0.46, 0]);
    part(box(1.5, 0.32, 0.36), 'wood', [0, 0.26, 0]);
    part(box(0.72, 0.28, 0.02), 'paleWood', [-0.37, 0.26, 0.19]);
    part(box(0.72, 0.28, 0.02), 'paleWood', [0.37, 0.26, 0.19]);
    part(cylinder(0.01, 0.01, 0.1, 8), 'metal', [-0.05, 0.26, 0.21]);
    part(cylinder(0.01, 0.01, 0.1, 8), 'metal', [0.05, 0.26, 0.21]);
    for (const [x, z] of [[-0.7, 0.15], [0.7, 0.15], [-0.7, -0.15], [0.7, -0.15]])
      leg(x, z, 0.1, 0.02, 'metal');
    // A modest TV so the stand has something to hold.
    part(box(1.0, 0.58, 0.04), 'screen', [0, 0.79, 0]);
    part(box(0.24, 0.06, 0.18), 'black', [0, 0.52, 0]);
  },

  sideboard() {
    part(box(1.35, 0.05, 0.44), 'darkWood', [0, 0.83, 0]);
    part(box(1.3, 0.72, 0.42), 'wood', [0, 0.46, 0]);
    part(box(0.62, 0.62, 0.02), 'paleWood', [-0.33, 0.46, 0.22]);
    part(box(0.62, 0.62, 0.02), 'paleWood', [0.33, 0.46, 0.22]);
    part(cylinder(0.01, 0.01, 0.12, 8), 'metal', [-0.03, 0.5, 0.24]);
    part(cylinder(0.01, 0.01, 0.12, 8), 'metal', [0.03, 0.5, 0.24]);
    for (const [x, z] of [[-0.58, 0.16], [0.58, 0.16], [-0.58, -0.16], [0.58, -0.16]])
      leg(x, z, 0.1, 0.02, 'metal');
  },

  rug() {
    part(box(2.0, 0.02, 2.9), 'rug', [0, 0.01, 0]);
    part(box(1.86, 0.022, 2.76), 'rugTrim', [0, 0.011, 0]);
  },

  plant_large() {
    part(cylinder(0.2, 0.15, 0.34, 14), 'terracotta', [0, 0.17, 0]);
    part(cylinder(0.19, 0.19, 0.02, 14), 'darkWood', [0, 0.33, 0]);
    part(cylinder(0.02, 0.03, 0.5, 8), 'leaf', [0, 0.6, 0]);
    part(sphere(0.32, 14, 9), 'leaf', [0, 1.0, 0], [0, 0, 0], [1.0, 0.85, 1.0]);
    part(sphere(0.24, 12, 8), 'leafLight', [-0.2, 1.18, 0.1]);
    part(sphere(0.2, 12, 8), 'leafLight', [0.22, 1.1, -0.12]);
    part(sphere(0.17, 10, 7), 'leaf', [0.05, 1.32, 0.18]);
  },

  plant_small() {
    part(cylinder(0.12, 0.09, 0.18, 12), 'ceramic', [0, 0.09, 0]);
    part(cylinder(0.015, 0.02, 0.16, 8), 'leaf', [0, 0.24, 0]);
    part(sphere(0.16, 12, 8), 'leaf', [0, 0.4, 0], [0, 0, 0], [1.0, 0.8, 1.0]);
    part(sphere(0.1, 10, 7), 'leafLight', [0.1, 0.48, 0.06]);
  },

  art_large() {
    part(box(1.16, 0.86, 0.04), 'darkWood', [0, 0.5, 0]);
    part(box(1.06, 0.76, 0.02), 'canvas', [0, 0.5, 0.025]);
    part(box(0.5, 0.3, 0.01), 'fabricWarm', [-0.16, 0.42, 0.035]);
    part(box(0.3, 0.44, 0.01), 'rugTrim', [0.24, 0.55, 0.035]);
  },

  mirror() {
    part(box(0.76, 1.7, 0.05), 'wood', [0, 0.86, 0]);
    part(box(0.66, 1.6, 0.02), 'glass', [0, 0.86, 0.03]);
    for (const [x, z] of [[-0.32, 0.16], [0.32, 0.16], [-0.32, -0.16], [0.32, -0.16]])
      leg(x, z, 0.06, 0.02, 'darkWood');
  },

  floor_lamp() {
    part(cylinder(0.18, 0.2, 0.04, 16), 'metal', [0, 0.02, 0]);
    part(cylinder(0.022, 0.022, 1.35, 10), 'metal', [0, 0.7, 0]);
    part(cylinder(0.24, 0.3, 0.3, 16), 'lampShade', [0, 1.5, 0]);
    part(cylinder(0.28, 0.28, 0.02, 16), 'lampShade', [0, 1.66, 0]);
    part(sphere(0.07, 10, 7), 'lampShade', [0, 1.35, 0]);
  },

  table_lamp() {
    part(cylinder(0.1, 0.12, 0.03, 14), 'metal', [0, 0.015, 0]);
    part(cylinder(0.016, 0.02, 0.24, 10), 'metal', [0, 0.15, 0]);
    part(cylinder(0.12, 0.17, 0.18, 14), 'lampShade', [0, 0.36, 0]);
    part(cylinder(0.15, 0.15, 0.015, 14), 'lampShade', [0, 0.45, 0]);
  },

  pendant() {
    // Anchored at its mount: cord runs to the top, shade hangs below.
    part(cylinder(0.008, 0.008, 0.55, 8), 'black', [0, 0.28, 0]);
    part(cylinder(0.08, 0.3, 0.26, 16), 'lampShade', [0, -0.13, 0]);
    part(cylinder(0.08, 0.08, 0.02, 14), 'lampShade', [0, 0.0, 0]);
    part(sphere(0.06, 10, 7), 'lampShade', [0, -0.16, 0]);
  },

  bed_frame() {
    part(box(1.5, 0.18, 1.95), 'wood', [0, 0.3, 0]);
    part(box(1.56, 0.9, 0.08), 'wood', [0, 0.55, -0.96]);
    part(box(1.5, 0.08, 0.06), 'wood', [0, 0.28, 0.95]);
    part(box(1.44, 0.2, 1.88), 'fabricPale', [0, 0.5, 0]);
    part(box(0.62, 0.12, 0.34), 'fabricPale', [-0.35, 0.65, -0.66]);
    part(box(0.62, 0.12, 0.34), 'fabricPale', [0.35, 0.65, -0.66]);
    part(box(1.5, 0.06, 0.62), 'fabric', [0, 0.62, 0.5]);
    for (const [x, z] of [[-0.66, 0.86], [0.66, 0.86], [-0.66, -0.86], [0.66, -0.86]])
      leg(x, z, 0.21, 0.025);
  },

  nightstand() {
    part(box(0.44, 0.04, 0.38), 'darkWood', [0, 0.5, 0]);
    part(box(0.42, 0.34, 0.36), 'wood', [0, 0.33, 0]);
    part(box(0.38, 0.26, 0.02), 'paleWood', [0, 0.36, 0.18]);
    part(cylinder(0.01, 0.01, 0.07, 8), 'metal', [0, 0.36, 0.2]);
    for (const [x, z] of [[-0.17, 0.14], [0.17, 0.14], [-0.17, -0.14], [0.17, -0.14]])
      leg(x, z, 0.16, 0.018);
  },

  dining_table() {
    part(box(1.6, 0.06, 0.9), 'wood', [0, 0.73, 0]);
    part(box(1.44, 0.04, 0.76), 'darkWood', [0, 0.67, 0]);
    for (const [x, z] of [[-0.68, 0.36], [0.68, 0.36], [-0.68, -0.36], [0.68, -0.36]])
      leg(x, z, 0.7, 0.035);
  },

  coffee_table() {
    part(box(1.1, 0.05, 0.6), 'paleWood', [0, 0.42, 0]);
    part(box(0.9, 0.03, 0.44), 'wood', [0, 0.2, 0]);
    for (const [x, z] of [[-0.48, 0.24], [0.48, 0.24], [-0.48, -0.24], [0.48, -0.24]])
      leg(x, z, 0.4, 0.025, 'darkWood');
  },

  desk() {
    part(box(1.4, 0.05, 0.68), 'wood', [0, 0.74, 0]);
    part(box(0.42, 0.5, 0.6), 'paleWood', [0.44, 0.48, 0]);
    part(box(0.42, 0.2, 0.02), 'darkWood', [0.44, 0.62, 0.31]);
    part(cylinder(0.01, 0.01, 0.12, 8), 'metal', [0.44, 0.5, 0.33]);
    part(box(0.42, 0.2, 0.02), 'darkWood', [0.44, 0.36, 0.31]);
    for (const [x, z] of [[-0.62, 0.28], [-0.62, -0.28], [0.62, 0.28], [0.62, -0.28]])
      leg(x, z, 0.72, 0.028, 'metal');
  },
};

// ---------------------------------------------------------------- GLB writer
function buildGLB(modelParts) {
  const bin = [];
  let binLength = 0;
  const accessors = [];
  const bufferViews = [];
  const meshes = [];
  const nodes = [];
  const materials = [];

  const addAccessor = (data, type, componentType, min, max) => {
    // Pad to a 4-byte boundary so every accessor offset stays aligned.
    while (binLength % 4 !== 0) {
      bin.push(0);
      binLength++;
    }
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    bin.push(...bytes);
    const view = { buffer: 0, byteOffset: binLength, byteLength: data.byteLength };
    binLength += data.byteLength;
    bufferViews.push(view);
    const accessor = {
      bufferView: bufferViews.length - 1,
      componentType,
      count: data.length / (type === 'VEC3' ? 3 : 1),
      type,
    };
    if (min) accessor.min = min;
    if (max) accessor.max = max;
    accessors.push(accessor);
    return accessors.length - 1;
  };

  for (const p of modelParts) {
    const positions = new Float32Array(p.geo.positions);
    const normals = new Float32Array(p.geo.normals);
    const indices = new Uint16Array(p.geo.indices);

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], positions[i + a]);
        max[a] = Math.max(max[a], positions[i + a]);
      }
    }

    const posAccessor = addAccessor(positions, 'VEC3', 5126, min, max);
    const normAccessor = addAccessor(normals, 'VEC3', 5126);
    const idxAccessor = addAccessor(indices, 'SCALAR', 5123);

    let materialIndex = materials.findIndex(
      m =>
        m.pbrMetallicRoughness.baseColorFactor[0] === p.material.color[0] &&
        m.pbrMetallicRoughness.metallicFactor === p.material.metallic
    );
    if (materialIndex === -1) {
      materials.push({
        name: `mat_${materials.length}`,
        doubleSided: false,
        pbrMetallicRoughness: {
          baseColorFactor: [...p.material.color, 1],
          metallicFactor: p.material.metallic,
          roughnessFactor: p.material.roughness,
        },
      });
      materialIndex = materials.length - 1;
    }

    meshes.push({
      primitives: [
        {
          attributes: { POSITION: posAccessor, NORMAL: normAccessor },
          indices: idxAccessor,
          material: materialIndex,
        },
      ],
    });
    nodes.push({ mesh: meshes.length - 1, name: `part_${nodes.length}` });
  }

  const gltf = {
    asset: { version: '2.0', generator: 'filthy-rich scripts/generate-models.js' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binLength }],
  };

  let json = JSON.stringify(gltf);
  while (json.length % 4 !== 0) json += ' ';
  const jsonBuffer = new TextEncoder().encode(json);

  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binLength;
  const glb = new Uint8Array(totalLength);
  const view = new DataView(glb.buffer);

  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);

  view.setUint32(12, jsonBuffer.length, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  glb.set(jsonBuffer, 20);

  const binStart = 20 + jsonBuffer.length;
  view.setUint32(binStart, binLength, true);
  view.setUint32(binStart + 4, 0x004e4942, true); // 'BIN\0'
  glb.set(new Uint8Array(bin), binStart + 8);

  return glb;
}

// ---------------------------------------------------------------- run
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
for (const [name, build] of Object.entries(MODELS)) {
  parts.length = 0;
  build();
  const modelParts = parts.slice();
  const glb = buildGLB(modelParts);
  const path = join(OUT_DIR, `${name}.glb`);
  writeFileSync(path, glb);
  total += glb.byteLength;
  console.log(
    `${name.padEnd(14)} ${String(modelParts.length).padStart(2)} parts  ${(glb.byteLength / 1024).toFixed(1).padStart(6)} KB`
  );
}

console.log(`\nWrote ${Object.keys(MODELS).length} models to ${OUT_DIR} (${(total / 1024).toFixed(1)} KB total)`);
