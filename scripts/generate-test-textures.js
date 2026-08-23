#!/usr/bin/env node
/**
 * Generate test textures for compression pipeline testing
 * Creates procedural textures: brick, concrete, grass, roof, wood, etc.
 */

import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const TEXTURES_DIR = './public/textures'
const SIZE = 512 // 512x512 textures

const TEXTURES = [
  { name: 'brick_wall', generator: generateBrickWall },
  { name: 'concrete', generator: generateConcrete },
  { name: 'grass', generator: generateGrass },
  { name: 'roof_tiles', generator: generateRoofTiles },
  { name: 'wood_planks', generator: generateWoodPlanks },
  { name: 'asphalt', generator: generateAsphalt },
  { name: 'metal_corrugated', generator: generateCorrugatedMetal },
  { name: 'plaster', generator: generatePlaster },
  { name: 'tiles_kitchen', generator: generateKitchenTiles },
  { name: 'carpet', generator: generateCarpet },
  { name: 'gravel', generator: generateGravel },
  { name: 'paving_slabs', generator: generatePavingSlabs },
]

function generateBrickWall(ctx, size) {
  const brickW = 60, brickH = 24, mortar = 4
  const baseR = 180, baseG = 60, baseB = 40

  ctx.fillStyle = '#8B4513'
  ctx.fillRect(0, 0, size, size)

  for (let y = 0; y < size; y += brickH + mortar) {
    const offset = (Math.floor(y / (brickH + mortar)) % 2) * (brickW / 2 + mortar)
    for (let x = -offset; x < size; x += brickW + mortar) {
      const v = 0.85 + Math.random() * 0.3
      ctx.fillStyle = `rgb(${Math.floor(baseR * v)}, ${Math.floor(baseG * v)}, ${Math.floor(baseB * v)})`
      ctx.fillRect(x, y, brickW, brickH)

      // Mortar
      ctx.fillStyle = '#C0B0A0'
      if (x + brickW < size) ctx.fillRect(x + brickW, y, mortar, brickH)
      if (y + brickH < size) ctx.fillRect(x, y + brickH, brickW + mortar, mortar)
    }
  }
}

function generateConcrete(ctx, size) {
  ctx.fillStyle = '#888888'
  ctx.fillRect(0, 0, size, size)

  // Add noise
  const imageData = ctx.getImageData(0, 0, size, size)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 40
    data[i] = Math.max(0, Math.min(255, data[i] + n))
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + n))
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + n))
  }
  ctx.putImageData(imageData, 0, 0)

  // Add cracks
  ctx.strokeStyle = '#555555'
  ctx.lineWidth = 1
  for (let i = 0; i < 8; i++) {
    ctx.beginPath()
    ctx.moveTo(Math.random() * size, Math.random() * size)
    for (let j = 0; j < 5; j++) {
      ctx.lineTo(Math.random() * size, Math.random() * size)
    }
    ctx.stroke()
  }
}

function generateGrass(ctx, size) {
  // Base grass color
  ctx.fillStyle = '#2D5A27'
  ctx.fillRect(0, 0, size, size)

  // Add variation
  const imageData = ctx.getImageData(0, 0, size, size)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 60
    data[i] = Math.max(0, Math.min(255, data[i] + n))
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + n + 20))
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + n))
  }
  ctx.putImageData(imageData, 0, 0)

  // Grass blades
  ctx.fillStyle = '#3A7A32'
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const h = 2 + Math.random() * 6
    const w = 1
    ctx.fillRect(x, y, w, h)
  }
}

function generateRoofTiles(ctx, size) {
  const tileW = 40, tileH = 30
  const baseR = 140, baseG = 40, baseB = 30

  ctx.fillStyle = '#8B2500'
  ctx.fillRect(0, 0, size, size)

  for (let y = 0; y < size; y += tileH) {
    for (let x = (Math.floor(y / tileH) % 2) * (tileW / 2); x < size; x += tileW) {
      const v = 0.7 + Math.random() * 0.4
      ctx.fillStyle = `rgb(${Math.floor(baseR * v)}, ${Math.floor(baseG * v)}, ${Math.floor(baseB * v)})`
      ctx.fillRect(x, y, tileW - 2, tileH - 2)

      // Highlight
      ctx.fillStyle = `rgba(255,255,255,0.1)`
      ctx.fillRect(x, y, tileW - 2, 3)
    }
  }
}

function generateWoodPlanks(ctx, size) {
  const plankH = 40
  const baseR = 160, baseG = 110, baseB = 70

  for (let y = 0; y < size; y += plankH) {
    const v = 0.7 + Math.random() * 0.5
    ctx.fillStyle = `rgb(${Math.floor(baseR * v)}, ${Math.floor(baseG * v)}, ${Math.floor(baseB * v)})`
    ctx.fillRect(0, y, size, plankH)

    // Wood grain
    ctx.strokeStyle = `rgba(80,50,30,0.3)`
    ctx.lineWidth = 1
    for (let i = 0; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo(0, y + Math.random() * plankH)
      ctx.bezierCurveTo(
        size * 0.3, y + Math.random() * plankH,
        size * 0.7, y + Math.random() * plankH,
        size, y + Math.random() * plankH
      )
      ctx.stroke()
    }

    // Plank gap
    if (y + plankH < size) {
      ctx.fillStyle = '#3D2B1F'
      ctx.fillRect(0, y + plankH - 2, size, 2)
    }
  }
}

function generateAsphalt(ctx, size) {
  ctx.fillStyle = '#2D2D2D'
  ctx.fillRect(0, 0, size, size)

  // Aggregate noise
  const imageData = ctx.getImageData(0, 0, size, size)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const n = Math.random() * 50
    data[i] = Math.min(255, data[i] + n)
    data[i+1] = Math.min(255, data[i+1] + n)
    data[i+2] = Math.min(255, data[i+2] + n)
  }
  ctx.putImageData(imageData, 0, 0)

  // Cracks
  ctx.strokeStyle = '#1A1A1A'
  ctx.lineWidth = 2
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.moveTo(Math.random() * size, Math.random() * size)
    for (let j = 0; j < 4; j++) {
      ctx.lineTo(Math.random() * size, Math.random() * size)
    }
    ctx.stroke()
  }
}

function generateCorrugatedMetal(ctx, size) {
  const ridgeW = 16
  ctx.fillStyle = '#888888'
  ctx.fillRect(0, 0, size, size)

  for (let x = 0; x < size; x += ridgeW * 2) {
    // Highlight ridge
    const g = ctx.createLinearGradient(x, 0, x + ridgeW * 2, 0)
    g.addColorStop(0, '#AAAAAA')
    g.addColorStop(0.25, '#CCCCCC')
    g.addColorStop(0.5, '#888888')
    g.addColorStop(0.75, '#666666')
    g.addColorStop(1, '#888888')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, ridgeW * 2, size)

    // Shadow in valley
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(x + ridgeW, 0, ridgeW, size)
  }

  // Rust spots
  ctx.fillStyle = '#8B4513'
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 2 + Math.random() * 8
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function generatePlaster(ctx, size) {
  ctx.fillStyle = '#E8E0D8'
  ctx.fillRect(0, 0, size, size)

  // Subtle texture
  const imageData = ctx.getImageData(0, 0, size, size)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 20
    data[i] = Math.max(0, Math.min(255, data[i] + n))
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + n))
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + n))
  }
  ctx.putImageData(imageData, 0, 0)

  // Imperfections
  ctx.fillStyle = 'rgba(0,0,0,0.05)'
  for (let i = 0; i < 100; i++) {
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function generateKitchenTiles(ctx, size) {
  const tileSize = 64
  ctx.fillStyle = '#F5F0E8'
  ctx.fillRect(0, 0, size, size)

  for (let y = 0; y < size; y += tileSize) {
    for (let x = 0; x < size; x += tileSize) {
      // Tile
      const v = 0.95 + Math.random() * 0.1
      ctx.fillStyle = `rgb(${Math.floor(245 * v)}, ${Math.floor(240 * v)}, ${Math.floor(232 * v)})`
      ctx.fillRect(x, y, tileSize - 2, tileSize - 2)

      // Grout
      ctx.fillStyle = '#CCCCCC'
      if (x + tileSize < size) ctx.fillRect(x + tileSize - 2, y, 2, tileSize)
      if (y + tileSize < size) ctx.fillRect(x, y + tileSize - 2, tileSize, 2)

      // Pattern
      if (Math.random() < 0.3) {
        ctx.fillStyle = 'rgba(100,150,200,0.15)'
        ctx.beginPath()
        ctx.arc(x + tileSize/2, y + tileSize/2, tileSize/4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

function generateCarpet(ctx, size) {
  ctx.fillStyle = '#6B4A3A'
  ctx.fillRect(0, 0, size, size)

  // Fibers
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const v = 0.7 + Math.random() * 0.6
    ctx.fillStyle = `rgb(${Math.floor(107 * v)}, ${Math.floor(74 * v)}, ${Math.floor(58 * v)})`
    ctx.fillRect(x, y, 1, 1 + Math.random() * 3)
  }
}

function generateGravel(ctx, size) {
  ctx.fillStyle = '#7A7A7A'
  ctx.fillRect(0, 0, size, size)

  // Stones
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 1 + Math.random() * 4
    const v = 0.5 + Math.random() * 0.5
    ctx.fillStyle = `rgb(${Math.floor(122 * v)}, ${Math.floor(122 * v)}, ${Math.floor(122 * v)})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function generatePavingSlabs(ctx, size) {
  const slabSize = 128
  const gap = 4

  ctx.fillStyle = '#999999'
  ctx.fillRect(0, 0, size, size)

  for (let y = 0; y < size; y += slabSize + gap) {
    for (let x = 0; x < size; x += slabSize + gap) {
      const v = 0.8 + Math.random() * 0.3
      ctx.fillStyle = `rgb(${Math.floor(150 * v)}, ${Math.floor(150 * v)}, ${Math.floor(150 * v)})`
      ctx.fillRect(x, y, slabSize, slabSize)

      // Texture
      const imgData = ctx.getImageData(x, y, slabSize, slabSize)
      const data = imgData.data
      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() - 0.5) * 15
        data[i] = Math.max(0, Math.min(255, data[i] + n))
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + n))
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + n))
      }
      ctx.putImageData(imgData, x, y)

      // Gap
      ctx.fillStyle = '#444444'
      if (x + slabSize < size) ctx.fillRect(x + slabSize, y, gap, slabSize)
      if (y + slabSize < size) ctx.fillRect(x, y + slabSize, slabSize + gap, gap)
    }
  }
}

async function generateTextures() {
  console.log('[GenerateTextures] Creating test textures...')

  if (!existsSync(TEXTURES_DIR)) {
    mkdirSync(TEXTURES_DIR, { recursive: true })
  }

  // Check if canvas is available
  let canvas
  try {
    canvas = createCanvas(SIZE, SIZE)
  } catch (e) {
    console.error('[GenerateTextures] canvas package not available. Run: npm install canvas')
    console.log('[GenerateTextures] Skipping texture generation - you can manually add PNG/JPG files to public/textures/')
    return
  }

  for (const tex of TEXTURES) {
    const ctx = canvas.getContext('2d')
    tex.generator(ctx, SIZE)

    const buffer = canvas.toBuffer('image/png')
    const outputPath = join(TEXTURES_DIR, `${tex.name}.png`)
    writeFileSync(outputPath, buffer)
    console.log(`[GenerateTextures] ✓ Generated: ${tex.name}.png`)
  }

  console.log(`[GenerateTextures] Done! ${TEXTURES.length} textures generated in ${TEXTURES_DIR}`)
}

generateTextures().catch(err => {
  console.error('[GenerateTextures] Error:', err)
  process.exit(1)
})