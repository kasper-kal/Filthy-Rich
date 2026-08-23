#!/usr/bin/env node

/**
 * Build-time texture compression script
 * Compresses PNG/JPG textures to KTX2 (UASTC) format using basisu CLI
 *
 * Run with: npm run compress-textures
 * Or: node scripts/compress-textures.js
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';

const INPUT_DIR = 'public/textures';
const OUTPUT_DIR = 'dist/textures';

const BASISU_PATH = 'node_modules/basisu/bin/linux/x64_sse/basisu';

// Texture-specific quality settings
const TEXTURE_CONFIG = {
  'asphalt.png': { quality: 128, uastcLevel: 2, rdoLambda: 1.0, normalMap: false },
  'brick_wall.png': { quality: 128, uastcLevel: 2, rdoLambda: 1.0, normalMap: false },
  'carpet.png': { quality: 150, uastcLevel: 2, rdoLambda: 0.8, normalMap: false },
  'concrete.png': { quality: 128, uastcLevel: 2, rdoLambda: 1.0, normalMap: false },
  'grass.png': { quality: 100, uastcLevel: 2, rdoLambda: 1.5, normalMap: false },
  'gravel.png': { quality: 128, uastcLevel: 2, rdoLambda: 1.0, normalMap: false },
  'metal_corrugated.png': { quality: 128, uastcLevel: 2, rdoLambda: 1.0, normalMap: false },
  'paving_slabs.png': { quality: 128, uastcLevel: 2, rdoLambda: 1.0, normalMap: false },
  'plaster.png': { quality: 140, uastcLevel: 2, rdoLambda: 0.9, normalMap: false },
  'roof_tiles.png': { quality: 128, uastcLevel: 2, rdoLambda: 1.0, normalMap: false },
  'tiles_kitchen.png': { quality: 140, uastcLevel: 2, rdoLambda: 0.9, normalMap: false },
  'wood_planks.png': { quality: 128, uastcLevel: 2, rdoLambda: 1.0, normalMap: false },
};

function compressTexture(filename) {
  const inputPath = join(INPUT_DIR, filename);
  const outputFilename = basename(filename, extname(filename)) + '.ktx2';
  const outputPath = join(OUTPUT_DIR, outputFilename);

  if (!existsSync(inputPath)) {
    console.warn(`[compress-textures] Input file not found: ${inputPath}`);
    return;
  }

  const config = TEXTURE_CONFIG[filename] || { quality: 128, uastcLevel: 2, rdoLambda: 1.0, normalMap: false };

  const args = [
    inputPath,
    '-ktx2',
    '-uastc',
    `-uastc_level ${config.uastcLevel}`,
    `-uastc_rdo_l ${config.rdoLambda}`,
    `-output_file ${outputPath}`,
    '-mipmap',
    '-mip_linear',
    config.normalMap ? '-normal_map' : '',
    '-y_flip', // Three.js expects textures flipped Y
  ].filter(Boolean).join(' ');

  console.log(`[compress-textures] Compressing ${filename} -> ${outputFilename}`);
  console.log(`[compress-textures] Command: ${BASISU_PATH} ${args}`);

  try {
    const output = execSync(`${BASISU_PATH} ${args}`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    console.log(`[compress-textures] Success: ${outputFilename}`);
    if (output.trim()) console.log(output);
  } catch (error) {
    console.error(`[compress-textures] Failed to compress ${filename}:`, error.message);
    if (error.stdout) console.error('stdout:', error.stdout.toString());
    if (error.stderr) console.error('stderr:', error.stderr.toString());
    throw error;
  }
}

function main() {
  console.log('[compress-textures] Starting texture compression...');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`[compress-textures] Created output directory: ${OUTPUT_DIR}`);
  }

  // Get all texture files
  const files = readdirSync(INPUT_DIR)
    .filter(f => {
      const ext = extname(f).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tga'].includes(ext);
    });

  console.log(`[compress-textures] Found ${files.length} textures to compress`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    try {
      compressTexture(file);
      success++;
    } catch (error) {
      failed++;
    }
  }

  console.log(`\n[compress-textures] Complete: ${success} succeeded, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();