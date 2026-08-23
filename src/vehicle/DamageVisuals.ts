import * as THREE from 'three'
import { DamageModel, PanelDamage, PanelName, SubsystemName, VisualDamageState, MechanicalDamageState, PANEL_NAMES } from './DamageModel.js'

// ============================================
// DAMAGE VISUALIZATION
// ============================================

export interface DamageVisualConfig {
  // Panel deformation
  enableVertexDeformation: boolean
  maxDeformation: number // meters

  // Particles
  enableParticles: boolean
  maxParticles: number
  particleLifetime: number

  // Decals
  enableDecals: boolean
  maxDecals: number

  // Smoke/steam
  enableSmoke: boolean
  smokeThreshold: number // mechanical health below which smoke appears

  // Sparks
  enableSparks: boolean
  sparkThreshold: number

  // Shaders
  useDeformationShader: boolean
}

const DEFAULT_CONFIG: DamageVisualConfig = {
  enableVertexDeformation: true,
  maxDeformation: 0.15,
  enableParticles: true,
  maxParticles: 500,
  particleLifetime: 5,
  enableDecals: true,
  maxDecals: 100,
  enableSmoke: true,
  smokeThreshold: 30,
  enableSparks: true,
  sparkThreshold: 20,
  useDeformationShader: true
}

// ============================================
// PARTICLE POOL
// ============================================

interface Particle {
  position: THREE.Vector3
  velocity: THREE.Vector3
  size: number
  color: THREE.Color
  lifetime: number
  age: number
  type: 'smoke' | 'spark' | 'steam' | 'oil' | 'coolant' | 'debris'
  active: boolean
}

export class ParticlePool {
  private pool: Particle[] = []
  private scene: THREE.Scene
  private maxParticles: number
  private particleGeometry: THREE.BufferGeometry
  private particleMaterial: THREE.PointsMaterial
  private points: THREE.Points
  private positions: Float32Array
  private colors: Float32Array
  private sizes: Float32Array
  private alphas: Float32Array

  constructor(scene: THREE.Scene, maxParticles: number = 500) {
    this.scene = scene
    this.maxParticles = maxParticles

    // Create buffer geometry for instanced particles
    this.particleGeometry = new THREE.BufferGeometry()
    this.positions = new Float32Array(maxParticles * 3)
    this.colors = new Float32Array(maxParticles * 3)
    this.sizes = new Float32Array(maxParticles)
    this.alphas = new Float32Array(maxParticles)

    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    this.particleGeometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))
    this.particleGeometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1))

    // Create material
    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    this.points = new THREE.Points(this.particleGeometry, this.particleMaterial)
    this.points.frustumCulled = false
    this.scene.add(this.points)

    // Initialize pool
    for (let i = 0; i < maxParticles; i++) {
      this.pool.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        size: 0,
        color: new THREE.Color(),
        lifetime: 0,
        age: 0,
        type: 'smoke',
        active: false
      })
    }
  }

  emit(
    position: THREE.Vector3,
    type: Particle['type'],
    options: {
      velocity?: THREE.Vector3
      spread?: number
      size?: number
      color?: THREE.Color
      lifetime?: number
      count?: number
    } = {}
  ): void {
    const count = options.count || 1
    const spread = options.spread || 0.1
    const baseVelocity = options.velocity || new THREE.Vector3()
    const size = options.size || this.getDefaultSize(type)
    const color = options.color || this.getDefaultColor(type)
    const lifetime = options.lifetime || this.getDefaultLifetime(type)

    for (let i = 0; i < count; i++) {
      const particle = this.getFreeParticle()
      if (!particle) return

      particle.position.copy(position).add(new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread
      ))

      particle.velocity.copy(baseVelocity).add(new THREE.Vector3(
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 2
      ))

      particle.size = size * (0.5 + Math.random() * 0.5)
      particle.color.copy(color)
      particle.lifetime = lifetime * (0.5 + Math.random() * 0.5)
      particle.age = 0
      particle.type = type
      particle.active = true
    }
  }

  private getFreeParticle(): Particle | null {
    for (const particle of this.pool) {
      if (!particle.active) return particle
    }
    // Pool full - recycle oldest
    let oldest = this.pool[0]
    for (const particle of this.pool) {
      if (particle.age > oldest.age) oldest = particle
    }
    oldest.active = false
    return oldest
  }

  update(deltaTime: number): void {
    let activeCount = 0

    for (let i = 0; i < this.maxParticles; i++) {
      const particle = this.pool[i]
      if (!particle.active) continue

      particle.age += deltaTime

      if (particle.age >= particle.lifetime) {
        particle.active = false
        continue
      }

      activeCount++

      // Physics
      particle.velocity.y -= 9.81 * deltaTime * 0.1 // Gravity
      particle.velocity.multiplyScalar(0.98) // Air resistance
      particle.position.addScaledVector(particle.velocity, deltaTime)

      // Type-specific behavior
      const t = particle.age / particle.lifetime

      switch (particle.type) {
        case 'smoke':
          particle.velocity.y += 0.5 * deltaTime // Rise
          break
        case 'steam':
          particle.velocity.y += 2 * deltaTime // Rise fast
          break
        case 'spark':
          particle.velocity.y -= 15 * deltaTime // Fall fast
          break
        case 'oil':
        case 'coolant':
          particle.velocity.y -= 9.81 * deltaTime
          break
      }

      // Update buffers
      const idx = i * 3
      this.positions[idx] = particle.position.x
      this.positions[idx + 1] = particle.position.y
      this.positions[idx + 2] = particle.position.z

      this.colors[idx] = particle.color.r
      this.colors[idx + 1] = particle.color.g
      this.colors[idx + 2] = particle.color.b

      this.sizes[i] = particle.size * (1 - t * 0.5)
      this.alphas[i] = 1 - t
    }

    this.particleGeometry.attributes.position.needsUpdate = true
    this.particleGeometry.attributes.color.needsUpdate = true
    this.particleGeometry.attributes.size.needsUpdate = true
    this.particleGeometry.attributes.alpha.needsUpdate = true
  }

  private getDefaultSize(type: Particle['type']): number {
    switch (type) {
      case 'smoke': return 0.3
      case 'steam': return 0.2
      case 'spark': return 0.02
      case 'oil': return 0.05
      case 'coolant': return 0.05
      case 'debris': return 0.1
    }
  }

  private getDefaultColor(type: Particle['type']): THREE.Color {
    switch (type) {
      case 'smoke': return new THREE.Color(0x333333)
      case 'steam': return new THREE.Color(0xffffff)
      case 'spark': return new THREE.Color(0xffaa00)
      case 'oil': return new THREE.Color(0x1a1a1a)
      case 'coolant': return new THREE.Color(0x00ffaa)
      case 'debris': return new THREE.Color(0x555555)
    }
  }

  private getDefaultLifetime(type: Particle['type']): number {
    switch (type) {
      case 'smoke': return 3
      case 'steam': return 2
      case 'spark': return 0.5
      case 'oil': return 5
      case 'coolant': return 4
      case 'debris': return 3
    }
  }

  dispose(): void {
    this.scene.remove(this.points)
    this.particleGeometry.dispose()
    this.particleMaterial.dispose()
  }
}

// ============================================
// DAMAGE VISUALS MAIN CLASS
// ============================================

export class DamageVisuals {
  private vehicle: THREE.Group
  private damageModel: DamageModel
  private config: DamageVisualConfig
  private scene: THREE.Scene

  // Particle system
  private particlePool: ParticlePool

  // Panel meshes for deformation
  private panelMeshes: Map<PanelName, THREE.Mesh> = new Map()
  private panelOriginalVertices: Map<PanelName, Float32Array> = new Map()

  // Deformation shader
  private deformationMaterial: THREE.ShaderMaterial | null = null

  // Smoke/steam emitters
  private smokeEmitters: Map<SubsystemName, { position: THREE.Vector3; active: boolean }> = new Map()
  private sparkEmitters: Map<SubsystemName, { position: THREE.Vector3; active: boolean }> = new Map()

  // Decals
  private decals: THREE.Mesh[] = []

  // State
  private lastVisualDamage = 0
  private lastMechanicalDamage = 0

  // Audio references
  private audioManager: any

  constructor(
    vehicle: THREE.Group,
    damageModel: DamageModel,
    scene: THREE.Scene,
    config?: Partial<DamageVisualConfig>
  ) {
    this.vehicle = vehicle
    this.damageModel = damageModel
    this.scene = scene
    this.config = { ...DEFAULT_CONFIG, ...config }

    this.particlePool = new ParticlePool(scene, this.config.maxParticles)

    this.initialize()
  }

  private initialize(): void {
    // Find panel meshes in vehicle
    this.findPanelMeshes(this.vehicle)

    // Create deformation shader material
    if (this.config.useDeformationShader) {
      this.createDeformationShader()
    }

    // Setup smoke emitters for mechanical systems
    this.setupEmitters()
  }

  private findPanelMeshes(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const name = child.name as PanelName
        if (PANEL_NAMES.includes(name)) {
          this.panelMeshes.set(name, child)

          // Store original vertices
          const posAttr = child.geometry.getAttribute('position')
          if (posAttr) {
            this.panelOriginalVertices.set(name, new Float32Array(posAttr.array))
          }
        }
      }
    })
  }

  private createDeformationShader(): void {
    this.deformationMaterial = new THREE.ShaderMaterial({
      uniforms: {
        deformationMap: { value: null },
        deformationStrength: { value: 1.0 },
        baseColor: { value: new THREE.Color(0x3498db) },
        damageColor: { value: new THREE.Color(0x8b0000) },
        paintDamage: { value: 0.0 },
        time: { value: 0 }
      },
      vertexShader: `
        uniform float deformationStrength;
        uniform sampler2D deformationMap;
        varying vec2 vUv;
        varying float vDeformation;

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Sample deformation from texture
          float deform = texture2D(deformationMap, uv).r * deformationStrength;
          vDeformation = deform;

          // Push vertices along normal
          vec3 normal = normalize(normalMatrix * normal);
          pos += normal * deform;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 baseColor;
        uniform vec3 damageColor;
        uniform float paintDamage;
        varying vec2 vUv;
        varying float vDeformation;

        void main() {
          // Mix base color with damage color based on deformation
          vec3 color = mix(baseColor, damageColor, vDeformation);

          // Add paint scratches
          float scratch = step(0.9, fract(vUv.x * 50.0 + vUv.y * 30.0 + sin(vUv.y * 100.0))) * paintDamage;
          color = mix(color, vec3(0.1), scratch * 0.5);

          gl_FragColor = vec4(color, 1.0);
        }
      `
    })
  }

  private setupEmitters(): void {
    // Engine smoke/steam
    this.smokeEmitters.set('cooling_system', {
      position: new THREE.Vector3(0, 1, 1.5), // Near radiator
      active: false
    })
    this.smokeEmitters.set('oil_system', {
      position: new THREE.Vector3(0, 0.5, 1), // Under engine
      active: false
    })
    this.smokeEmitters.set('exhaust', {
      position: new THREE.Vector3(0, 0.3, -1.8), // Exhaust tip
      active: false
    })
    this.smokeEmitters.set('engine_block', {
      position: new THREE.Vector3(0, 0.8, 1),
      active: false
    })

    // Spark emitters (electrical, grinding)
    this.sparkEmitters.set('electrical', {
      position: new THREE.Vector3(-0.5, 1, 1.5),
      active: false
    })
    this.sparkEmitters.set('ignition_system', {
      position: new THREE.Vector3(0.3, 0.3, 1),
      active: false
    })
    this.sparkEmitters.set('brakes_front', {
      position: new THREE.Vector3(-0.7, 0.3, 0.8),
      active: false
    })
    this.sparkEmitters.set('brakes_rear', {
      position: new THREE.Vector3(-0.7, 0.3, -1),
      active: false
    })
  }

  /**
   * Main update - call every frame
   */
  update(deltaTime: number): void {
    const visualState = this.damageModel.getVisualState()
    const mechanicalState = this.damageModel.getMechanicalState()

    // Update panel deformation
    if (this.config.enableVertexDeformation) {
      this.updatePanelDeformation(visualState)
    }

    // Update particle emitters based on mechanical state
    this.updateParticleEmitters(mechanicalState, deltaTime)

    // Update particle pool
    this.particlePool.update(deltaTime)

    // Update shaders
    if (this.deformationMaterial) {
      this.deformationMaterial.uniforms.time.value += deltaTime
    }

    // Track damage changes for one-shot effects
    if (visualState.totalVisualDamage > this.lastVisualDamage + 0.05) {
      this.onVisualDamageIncrease(visualState)
    }
    if (mechanicalState.totalMechanicalDamage > this.lastMechanicalDamage + 0.05) {
      this.onMechanicalDamageIncrease(mechanicalState)
    }

    this.lastVisualDamage = visualState.totalVisualDamage
    this.lastMechanicalDamage = mechanicalState.totalMechanicalDamage
  }

  private updatePanelDeformation(visualState: VisualDamageState): void {
    for (const [panelName, panelDamage] of visualState.panels) {
      const mesh = this.panelMeshes.get(panelName)
      if (!mesh) continue

      const deformation = panelDamage.deformation

      if (this.config.useDeformationShader && this.deformationMaterial) {
        // Use shader-based deformation
        mesh.material = this.deformationMaterial.clone()
        const mat = mesh.material as THREE.ShaderMaterial
        mat.uniforms.deformationStrength.value = deformation * this.config.maxDeformation
        mat.uniforms.paintDamage.value = panelDamage.paintDamage
        mat.uniforms.baseColor.value.setHex(this.getPanelBaseColor(panelName))
      } else {
        // CPU-based vertex deformation
        this.deformVertices(mesh, panelName, deformation)
      }

      // Detached panels - hide or separate
      if (panelDamage.isDetached) {
        mesh.visible = false
        // Could spawn debris particle
      }
    }
  }

  private deformVertices(mesh: THREE.Mesh, panelName: PanelName, deformation: number): void {
    const originalVertices = this.panelOriginalVertices.get(panelName)
    if (!originalVertices) return

    const posAttr = mesh.geometry.getAttribute('position')
    if (!posAttr) return

    const vertices = posAttr.array as Float32Array

    for (let i = 0; i < vertices.length; i += 3) {
      const x = originalVertices[i]
      const y = originalVertices[i + 1]
      const z = originalVertices[i + 2]

      // Calculate deformation based on panel type
      let dx = 0, dy = 0, dz = 0

      // Push inward with falloff from center
      const distFromCenter = Math.sqrt(x * x + z * z)
      const falloff = Math.max(0, 1 - distFromCenter)

      dz = -deformation * this.config.maxDeformation * falloff
      dy = deformation * this.config.maxDeformation * 0.3 * falloff * (Math.random() - 0.5) * 0.1

      vertices[i] = x + dx
      vertices[i + 1] = y + dy
      vertices[i + 2] = z + dz
    }

    posAttr.needsUpdate = true
    mesh.geometry.computeVertexNormals()
  }

  private updateParticleEmitters(mechanicalState: MechanicalDamageState, deltaTime: number): void {
    // Smoke emitters
    for (const [subsystem, emitter] of this.smokeEmitters) {
      const sub = mechanicalState.subsystems.get(subsystem)
      if (!sub) continue

      const shouldEmit = sub.health < this.config.smokeThreshold && !sub.isFailed

      if (shouldEmit && !emitter.active) {
        emitter.active = true
      } else if (!shouldEmit) {
        emitter.active = false
      }

      if (emitter.active) {
        // Emit smoke/steam based on subsystem
        const worldPos = emitter.position.clone()
        this.vehicle.localToWorld(worldPos)

        if (subsystem === 'cooling_system') {
          this.particlePool.emit(worldPos, 'steam', {
            velocity: new THREE.Vector3(0, 2, 0),
            spread: 0.3,
            size: 0.2,
            color: new THREE.Color(0xffffff),
            lifetime: 2,
            count: Math.max(1, (this.config.smokeThreshold - sub.health) / 10)
          })
        } else if (subsystem === 'oil_system') {
          this.particlePool.emit(worldPos, 'smoke', {
            velocity: new THREE.Vector3(0, 0.5, 0),
            spread: 0.2,
            size: 0.15,
            color: new THREE.Color(0x1a1a1a),
            lifetime: 4,
            count: Math.max(1, (this.config.smokeThreshold - sub.health) / 15)
          })
        } else {
          this.particlePool.emit(worldPos, 'smoke', {
            velocity: new THREE.Vector3(0, 1, 0),
            spread: 0.2,
            size: 0.15,
            color: new THREE.Color(0x333333),
            lifetime: 3,
            count: Math.max(1, (this.config.smokeThreshold - sub.health) / 20)
          })
        }
      }
    }

    // Spark emitters
    for (const [subsystem, emitter] of this.sparkEmitters) {
      const sub = mechanicalState.subsystems.get(subsystem)
      if (!sub) continue

      const shouldSpark = sub.health < this.config.sparkThreshold && sub.health > 0

      if (shouldSpark && !emitter.active && Math.random() < 0.1) {
        emitter.active = true
        const worldPos = emitter.position.clone()
        this.vehicle.localToWorld(worldPos)

        this.particlePool.emit(worldPos, 'spark', {
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
          ),
          spread: 0.1,
          size: 0.02,
          color: new THREE.Color(0xffaa00),
          lifetime: 0.5,
          count: 3
        })

        setTimeout(() => { emitter.active = false }, 100)
      } else if (!shouldSpark) {
        emitter.active = false
      }
    }

    // Brake sparks (separate from subsystem emitters)
    const brakeFront = mechanicalState.subsystems.get('brakes_front')
    const brakeRear = mechanicalState.subsystems.get('brakes_rear')

    // Would check actual brake temperature and slip here
  }

  private onVisualDamageIncrease(visualState: VisualDamageState): void {
    // Emit debris/dust from new damage
    for (const [panelName, panelDamage] of visualState.panels) {
      if (panelDamage.health < 50 && panelDamage.health > 45) {
        // Just crossed threshold - emit debris
        const mesh = this.panelMeshes.get(panelName)
        if (mesh) {
          const worldPos = new THREE.Vector3()
          mesh.getWorldPosition(worldPos)

          this.particlePool.emit(worldPos, 'debris', {
            velocity: new THREE.Vector3(
              (Math.random() - 0.5) * 3,
              Math.random() * 2,
              (Math.random() - 0.5) * 3
            ),
            spread: 0.2,
            size: 0.08,
            color: new THREE.Color(0x555555),
            lifetime: 3,
            count: 5
          })
        }
      }
    }
  }

  private onMechanicalDamageIncrease(mechanicalState: MechanicalDamageState): void {
    // Could trigger sounds, warnings, etc.
  }

  private getPanelBaseColor(panelName: PanelName): number {
    // Return base color for panel type
    if (panelName.includes('window') || panelName.includes('windshield') || panelName.includes('mirror')) {
      return 0x222222
    }
    if (panelName.includes('light')) {
      return 0xffff00
    }
    return 0x3498db // Vehicle base color
  }

  // ============================================
  // PUBLIC API
  // ============================================

  addImpactEffect(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    force: number
  ): void {
    // Emit sparks on metal impact
    if (force > 5000) {
      this.particlePool.emit(position, 'spark', {
        velocity: normal.clone().multiplyScalar(3),
        spread: 0.3,
        size: 0.03,
        color: new THREE.Color(0xffaa00),
        lifetime: 0.8,
        count: Math.floor(force / 2000)
      })
    }

    // Emit debris
    if (force > 10000) {
      this.particlePool.emit(position, 'debris', {
        velocity: normal.clone().multiplyScalar(5),
        spread: 0.5,
        size: 0.1,
        color: new THREE.Color(0x555555),
        lifetime: 3,
        count: Math.floor(force / 5000)
      })
    }

    // Add decal
    if (this.config.enableDecals && this.decals.length < (this.config.maxDecals || 100)) {
      this.addDecal(position, normal)
    }
  }

  private addDecal(position: THREE.Vector3, normal: THREE.Vector3): void {
    // Create a simple decal mesh
    const size = 0.3 + Math.random() * 0.2
    const geometry = new THREE.PlaneGeometry(size, size)
    const material = new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide
    })

    const decal = new THREE.Mesh(geometry, material)
    decal.position.copy(position).add(normal.clone().multiplyScalar(0.01))
    decal.lookAt(position.clone().add(normal))
    decal.rotateX(Math.PI / 2)

    this.vehicle.add(decal)
    this.decals.push(decal)

    // Remove old decals
    if (this.decals.length > (this.config.maxDecals || 100)) {
      const old = this.decals.shift()
      if (old) {
        this.vehicle.remove(old)
        old.geometry.dispose()
        ;(old.material as THREE.Material).dispose()
      }
    }
  }

  addFluidLeak(
    position: THREE.Vector3,
    type: 'oil' | 'coolant' | 'fuel' | 'brake',
    rate: number // drops per second
  ): void {
    const worldPos = position.clone()
    this.vehicle.localToWorld(worldPos)

    const particleType = type === 'coolant' ? 'steam' : 'oil'
    const color = type === 'coolant' ? new THREE.Color(0x00ffaa) :
                  type === 'brake' ? new THREE.Color(0xccccff) :
                  type === 'fuel' ? new THREE.Color(0xffff00) : new THREE.Color(0x1a1a1a)

    // Emit at intervals
    const interval = 1000 / Math.max(1, rate)
    const emitterId = setInterval(() => {
      this.particlePool.emit(worldPos, particleType, {
        velocity: new THREE.Vector3(0, -1, 0),
        spread: 0.05,
        size: 0.03,
        color: color,
        lifetime: 5,
        count: 1
      })
    }, interval)

    // Store emitter ID for cleanup (would need a map)
    // For now, just emit once
    this.particlePool.emit(worldPos, particleType, {
      velocity: new THREE.Vector3(0, -1, 0),
      spread: 0.05,
      size: 0.03,
      color: color,
      lifetime: 5,
      count: Math.min(10, rate)
    })
  }

  addExhaustSmoke(intensity: number): void {
    if (intensity <= 0) return

    const emitter = this.smokeEmitters.get('exhaust')
    if (!emitter) return

    const worldPos = emitter.position.clone()
    this.vehicle.localToWorld(worldPos)

    this.particlePool.emit(worldPos, 'smoke', {
      velocity: new THREE.Vector3(0, 0.5, -2), // Backwards
      spread: 0.1,
      size: 0.15,
      color: new THREE.Color(0x222222),
      lifetime: 2,
      count: Math.floor(intensity * 3)
    })
  }

  addTireSmoke(position: THREE.Vector3, intensity: number): void {
    if (intensity <= 0) return

    this.particlePool.emit(position, 'smoke', {
      velocity: new THREE.Vector3(0, 0.2, 0),
      spread: 0.3,
      size: 0.25,
      color: new THREE.Color(0xffffff),
      lifetime: 1.5,
      count: Math.floor(intensity * 5)
    })
  }

  setVehicleColor(color: number): void {
    // Update base color for all panels
    for (const [name, mesh] of this.panelMeshes) {
      if (mesh.material instanceof THREE.ShaderMaterial) {
        mesh.material.uniforms.baseColor.value.setHex(color)
      } else if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.color.setHex(color)
      }
    }
  }

  setAudioManager(audioManager: any): void {
    this.audioManager = audioManager
  }

  getParticlePool(): ParticlePool {
    return this.particlePool
  }

  getConfig(): DamageVisualConfig {
    return { ...this.config }
  }

  setConfig(config: Partial<DamageVisualConfig>): void {
    this.config = { ...this.config, ...config }
  }

  dispose(): void {
    this.particlePool.dispose()

    // Dispose decals
    for (const decal of this.decals) {
      this.vehicle.remove(decal)
      decal.geometry.dispose()
      ;(decal.material as THREE.Material).dispose()
    }
    this.decals = []

    if (this.deformationMaterial) {
      this.deformationMaterial.dispose()
    }
  }
}

// ============================================
// DAMAGE DEBUG VISUALIZER
// ============================================

export class DamageDebugVisualizer {
  private scene: THREE.Scene
  private damageModel: DamageModel
  private helpers: THREE.Group = new THREE.Group()
  private showVisual = true
  private showMechanical = true

  constructor(scene: THREE.Scene, damageModel: DamageModel) {
    this.scene = scene
    this.damageModel = damageModel
    this.scene.add(this.helpers)
    this.createHelpers()
  }

  private createHelpers(): void {
    // Panel health indicators
    const visualState = this.damageModel.getVisualState()
    for (const [name, panel] of visualState.panels) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      )
      sphere.name = `panel_${name}`
      sphere.visible = false
      this.helpers.add(sphere)
    }

    // Subsystem health indicators
    const mechState = this.damageModel.getMechanicalState()
    for (const [name, sub] of mechState.subsystems) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      )
      box.name = `subsystem_${name}`
      box.visible = false
      this.helpers.add(box)
    }
  }

  update(): void {
    if (this.showVisual) {
      const visualState = this.damageModel.getVisualState()
      for (const [name, panel] of visualState.panels) {
        const helper = this.helpers.getObjectByName(`panel_${name}`)
        if (helper && helper instanceof THREE.Mesh) {
          helper.material.color = getDamageColor(panel.health)
          helper.visible = true
        }
      }
    }

    if (this.showMechanical) {
      const mechState = this.damageModel.getMechanicalState()
      for (const [name, sub] of mechState.subsystems) {
        const helper = this.helpers.getObjectByName(`subsystem_${name}`)
        if (helper && helper instanceof THREE.Mesh) {
          helper.material.color = getSubsystemColor(sub.health)
          helper.visible = true
        }
      }
    }
  }

  setShowVisual(show: boolean): void {
    this.showVisual = show
  }

  setShowMechanical(show: boolean): void {
    this.showMechanical = show
  }

  dispose(): void {
    this.scene.remove(this.helpers)
    this.helpers.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        ;(obj.material as THREE.Material).dispose()
      }
    })
  }
}

// ============================================
// COLOR HELPERS (moved from DamageModel for reuse)
// ============================================

export function getDamageColor(health: number): THREE.Color {
  if (health > 80) return new THREE.Color(0x00ff00)
  if (health > 50) return new THREE.Color(0xffff00)
  if (health > 20) return new THREE.Color(0xff8800)
  return new THREE.Color(0xff0000)
}

export function getSubsystemColor(health: number): THREE.Color {
  if (health > 70) return new THREE.Color(0x00ff00)
  if (health > 40) return new THREE.Color(0xffff00)
  if (health > 15) return new THREE.Color(0xff8800)
  return new THREE.Color(0xff0000)
}