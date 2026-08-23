import { vi } from 'vitest'

// Create proper Three.js-like objects with actual values
const createVector3 = (x = 0, y = 0, z = 0) => {
  const v = { x, y, z }
  v.set = vi.fn((x, y, z) => { v.x = x; v.y = y; v.z = z; return v })
  v.copy = vi.fn((other) => { v.x = other.x; v.y = other.y; v.z = other.z; return v })
  v.clone = vi.fn(() => createVector3(v.x, v.y, v.z))
  v.add = vi.fn((other) => { v.x += other.x; v.y += other.y; v.z += other.z; return v })
  v.sub = vi.fn((other) => { v.x -= other.x; v.y -= other.y; v.z -= other.z; return v })
  v.multiplyScalar = vi.fn((s) => { v.x *= s; v.y *= s; v.z *= s; return v })
  v.length = vi.fn(() => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z))
  v.normalize = vi.fn(() => { const l = v.length(); if (l > 0) { v.x /= l; v.y /= l; v.z /= l; } return v })
  return v
}

const createQuaternion = (x = 0, y = 0, z = 0, w = 1) => {
  const q = { x, y, z, w }
  q.setFromEuler = vi.fn(() => q)
  q.copy = vi.fn((other) => { q.x = other.x; q.y = other.y; q.z = other.z; q.w = other.w; return q })
  q.clone = vi.fn(() => createQuaternion(q.x, q.y, q.z, q.w))
  return q
}

const createEuler = (x = 0, y = 0, z = 0) => {
  const e = { x, y, z }
  e.setFromQuaternion = vi.fn(() => e)
  e.copy = vi.fn((other) => { e.x = other.x; e.y = other.y; e.z = other.z; return e })
  e.clone = vi.fn(() => createEuler(e.x, e.y, e.z))
  return e
}

// Mock Three.js
vi.mock('three', () => {
  return {
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      shadowMap: { enabled: false, type: null },
      toneMapping: 0,
      toneMappingExposure: 1,
      outputColorSpace: 0,
      domElement: document.createElement('canvas'),
      info: { render: { calls: 0, triangles: 0 } },
      dispose: vi.fn(),
    })),
    PerspectiveCamera: vi.fn().mockImplementation(() => ({
      position: createVector3(),
      quaternion: createQuaternion(),
      add: vi.fn(),
      remove: vi.fn(),
    })),
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn(),
      traverse: vi.fn(),
    })),
    Vector3: vi.fn().mockImplementation((x, y, z) => createVector3(x, y, z)),
    Quaternion: vi.fn().mockImplementation((x, y, z, w) => createQuaternion(x, y, z, w)),
    Euler: vi.fn().mockImplementation((x, y, z) => createEuler(x, y, z)),
    Mesh: vi.fn().mockImplementation(() => ({ position: createVector3(), quaternion: createQuaternion(), rotation: createEuler(), scale: createVector3(1, 1, 1), material: {}, geometry: {}, add: vi.fn(), remove: vi.fn() })),
    Group: vi.fn().mockImplementation(() => ({ position: createVector3(), quaternion: createQuaternion(), rotation: createEuler(), scale: createVector3(1, 1, 1), add: vi.fn(), remove: vi.fn(), children: [], traverse: vi.fn() })),
    BoxGeometry: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
    SphereGeometry: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
    CylinderGeometry: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
    PlaneGeometry: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
    MeshStandardMaterial: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
    MeshBasicMaterial: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
    CanvasTexture: vi.fn().mockImplementation(() => ({ dispose: vi.fn(), needsUpdate: false })),
    PCFSoftShadowMap: 1,
    ACESFilmicToneMapping: 2,
    SRGBColorSpace: 3,
    DoubleSide: 2,
    MathUtils: {
      mapLinear: vi.fn((value, from1, from2, to1, to2) => to1 + (value - from1) * (to2 - to1) / (from2 - from1)),
      clamp: vi.fn((value, min, max) => Math.max(min, Math.min(max, value))),
    },
    Color: vi.fn().mockImplementation(() => ({ set: vi.fn(), setHex: vi.fn(), copy: vi.fn() })),
  }
})

// Mock canvas for Three.js
global.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillText: vi.fn(),
  font: '',
  textAlign: '',
  textBaseline: '',
  fillStyle: '',
}))

// Mock performance.now
global.performance.now = vi.fn(() => Date.now())

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id))