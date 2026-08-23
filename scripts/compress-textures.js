#!/usr/bin/env node
/**
 * Texture Compression Build Script
 * Compresses PNG/JPG textures to KTX2 (UASTC) format using basisu CLI
 * Run at build time: npm run compress-textures
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

const BASISU_BIN = './node_modules/basisu/bin/linux/x64_sse/basisu'
const TEXTURES_DIR = './public/textures'
const OUTPUT_DIR = './dist/textures'

// Compression settings optimized for web game assets
const SETTINGS = {
  quality: 128,        // ETC1S quality (1-255), 128 is balanced
  uastc: true,         // Use UASTC for better quality
  uastcLevel: 2,       // UASTC encoding level (0-4)
  uastcRdoL: 1.0,      // UASTC RDO quality scalar
  ktx2: true,          // Output KTX2 container
  mipmap: true,        // Generate mipmaps
  srgb: true,          // Input is sRGB
  zstdLevel: 6,        // Zstandard compression level for UASTC
}

function getImageFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getImageFiles(fullPath))
    } else {
      const ext = extname(entry.name).toLowerCase()
      if (['.png', '.jpg', '.jpeg', '.tga', '.bmp', '.qoi'].includes(ext)) {
        files.push(fullPath)
      }
    }
  }
  return files
}

function buildBasisuArgs(file: string): string[] {
  const args = [file]

  if (SETTINGS.ktx2) args.push('-ktx2')
  if (SETTINGS.uastc) {
    args.push('-uastc')
    args.push(`-uastc_level ${SETTINGS.uastcLevel}`)
    args.push(`-uastc_rdo_l ${SETTINGS.uastcRdoL}`)
  }
  if (SETTINGS.mipmap) args.push('-mipmap')
  if (SETTINGS.srgb) args.push('-srgb')
  args.push(`-q ${SETTINGS.quality}`)
  args.push(`-output_path ${OUTPUT_DIR}`)
  args.push(`-ktx2_zstandard_level ${SETTINGS.zstdLevel}`)

  return args
}

async function compressTextures() {
  console.log('[TextureCompress] Starting texture compression pipeline...')
  console.log(`[TextureCompress] Input: ${TEXTURES_DIR}`)
  console.log(`[TextureCompress] Output: ${OUTPUT_DIR}`)
  console.log(`[TextureCompress] Settings:`, SETTINGS)

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Get all image files
  const imageFiles = getImageFiles(TEXTURES_DIR)

  if (imageFiles.length === 0) {
    console.log('[TextureCompress] No image files found in', TEXTURES_DIR)
    console.log('[TextureCompress] Create some texture files first (PNG/JPG/TGA)')
    return
  }

  console.log(`[TextureCompress] Found ${imageFiles.length} texture(s) to compress`)

  // Compress each file
  for (const file of imageFiles) {
    const relPath = file.replace(TEXTURES_DIR + '/', '')
    console.log(`[TextureCompress] Compressing: ${relPath}`)

    try {
      const args = buildBasisuArgs(file)
      const cmd = `${BASISU_BIN} ${args.join(' ')}`
      execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
      console.log(`[TextureCompress] ✓ Compressed: ${relPath}`)
    } catch (error) {
      console.error(`[TextureCompress] ✗ Failed: ${relPath}`, error)
    }
  }

  // Verify output
  const outputFiles = readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter(f => f.isFile() && f.name.endsWith('.ktx2'))
    .map(f => f.name)

  console.log(`[TextureCompress] Done! Generated ${outputFiles.length} KTX2 file(s):`)
  for (const f of outputFiles) {
    const stats = statSync(join(OUTPUT_DIR, f))
    console.log(`  - ${f} (${(stats.size / 1024).toFixed(1)} KB)`)
  }
}

// Run if called directly
compressTextures().catch(err => {
  console.error('[TextureCompress] Fatal error:', err)
  process.exit(1)
})

export { compressTextures, SETTINGS, TEXTURES_DIR, OUTPUT_DIR }