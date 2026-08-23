import * as THREE from 'three'
import { CleaningSystem, ToolType } from './CleaningSystem.js'
import { Job } from './JobSystem.js'

export class DiegeticHUD {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private cleaningSystem: CleaningSystem

  // Tool wheel
  private toolWheel!: THREE.Group
  private wheelVisible = false
  private wheelItems: THREE.Group[] = []
  private selectedToolIndex = 0

  // Crosshair
  private crosshair!: THREE.Group
  private crosshairOuter!: THREE.Mesh
  private crosshairInner!: THREE.Mesh
  private crosshairDot!: THREE.Mesh

  // Tool model (attached to camera)
  private toolModel!: THREE.Group
  private currentToolType: ToolType = 'spray'

  // Progress ring on tool
  private progressRing!: THREE.Mesh
  private progressMaterial!: THREE.ShaderMaterial

  // Interaction prompt
  private promptMesh!: THREE.Group
  private promptText: string = ''
  private promptVisible = false

  // Reticle for interaction
  private reticle!: THREE.Mesh

  // Job board UI
  private jobBoard!: THREE.Group
  private jobBoardVisible = false
  private jobBoardItems: THREE.Group[] = []
  private selectedJobIndex = -1

  // Active job info display
  private jobInfoMesh!: THREE.Group
  private activeJob: Job | null = null

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, cleaningSystem: CleaningSystem) {
    this.scene = scene
    this.camera = camera
    this.cleaningSystem = cleaningSystem

    this.createCrosshair()
    this.createToolWheel()
    this.createToolModel()
    this.createPrompt()
    this.createReticle()
    this.createJobBoard()
    this.createJobInfo()
  }

  private createCrosshair(): void {
    this.crosshair = new THREE.Group()
    this.crosshair.name = 'crosshair'

    // Outer expanding ring
    const outerGeo = new THREE.RingGeometry(0.018, 0.022, 32)
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
    this.crosshairOuter = new THREE.Mesh(outerGeo, outerMat)
    this.crosshairOuter.renderOrder = 999
    this.crosshair.add(this.crosshairOuter)

    // Inner dot
    const dotGeo = new THREE.CircleGeometry(0.004, 16)
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    })
    this.crosshairDot = new THREE.Mesh(dotGeo, dotMat)
    this.crosshairDot.renderOrder = 1000
    this.crosshair.add(this.crosshairDot)

    // Add to camera so it's always centered
    this.camera.add(this.crosshair)
    this.crosshair.position.z = -1
  }

  private createToolWheel(): void {
    this.toolWheel = new THREE.Group()
    this.toolWheel.name = 'toolWheel'

    const tools = this.cleaningSystem.getTools()
    const count = tools.length
    const radius = 0.35

    tools.forEach((tool, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2

      const itemGroup = new THREE.Group()

      // Background ring segment
      const segGeo = new THREE.RingGeometry(radius * 0.7, radius, 8, 1, angle - Math.PI / count, Math.PI * 2 / count)
      const segMat = new THREE.MeshBasicMaterial({
        color: 0x1a1a20,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      })
      const segment = new THREE.Mesh(segGeo, segMat)
      segment.renderOrder = 990
      itemGroup.add(segment)

      // Icon (using canvas texture)
      const iconTex = this.createIconTexture(tool.icon)
      const iconGeo = new THREE.PlaneGeometry(0.12, 0.12)
      const iconMat = new THREE.MeshBasicMaterial({
        map: iconTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
      const icon = new THREE.Mesh(iconGeo, iconMat)
      icon.renderOrder = 991
      icon.position.set(
        Math.cos(angle) * radius * 0.85,
        Math.sin(angle) * radius * 0.85,
        0.01
      )
      itemGroup.add(icon)

      // Tool name
      const nameTex = this.createTextTexture(tool.name)
      const nameGeo = new THREE.PlaneGeometry(0.25, 0.05)
      const nameMat = new THREE.MeshBasicMaterial({
        map: nameTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
      const name = new THREE.Mesh(nameGeo, nameMat)
      name.renderOrder = 991
      name.position.set(
        Math.cos(angle) * radius * 1.3,
        Math.sin(angle) * radius * 1.3,
        0.01
      )
      name.lookAt(0, 0, 1)
      itemGroup.add(name)

      // Hotkey number
      const keyTex = this.createTextTexture(`${i + 1}`, 0x888888, 14)
      const keyGeo = new THREE.PlaneGeometry(0.06, 0.06)
      const keyMat = new THREE.MeshBasicMaterial({
        map: keyTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
      const key = new THREE.Mesh(keyGeo, keyMat)
      key.renderOrder = 991
      key.position.set(
        Math.cos(angle) * radius * 0.5,
        Math.sin(angle) * radius * 0.5,
        0.01
      )
      itemGroup.add(key)

      this.toolWheel.add(itemGroup)
      this.wheelItems.push(itemGroup)
    })

    // Center indicator
    const centerGeo = new THREE.CircleGeometry(0.05, 16)
    const centerMat = new THREE.MeshBasicMaterial({
      color: 0x2ecc71,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
    })
    const center = new THREE.Mesh(centerGeo, centerMat)
    center.renderOrder = 989
    this.toolWheel.add(center)

    this.camera.add(this.toolWheel)
    this.toolWheel.position.z = -1.5
    this.toolWheel.visible = false
  }

  private createToolModel(): void {
    this.toolModel = new THREE.Group()
    this.toolModel.name = 'toolModel'
    this.updateToolModel()
    this.camera.add(this.toolModel)
    this.toolModel.position.set(0.3, -0.25, -0.6)
    this.toolModel.rotation.set(0.1, -0.2, 0)
  }

  private updateToolModel(): void {
    this.toolModel.clear()
    const tool = this.cleaningSystem.getCurrentTool()

    const materials = {
      body: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.6 }),
      accent: new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.3, metalness: 0.7, emissive: 0x2ecc71, emissiveIntensity: 0.3 }),
      plastic: new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.1 }),
      liquid: new THREE.MeshPhysicalMaterial({ color: 0x44aaff, transmission: 0.8, thickness: 0.1, roughness: 0.1, metalness: 0 }),
    }

    switch (tool.type) {
      case 'spray':
        this.buildSprayBottle(materials)
        break
      case 'mop':
        this.buildMop(materials)
        break
      case 'vacuum':
        this.buildVacuum(materials)
        break
      case 'trash_bag':
        this.buildTrashBag(materials)
        break
    }

    // Progress ring on tool
    this.createProgressRing()
  }

  private buildSprayBottle(mats: any): void {
    const group = this.toolModel

    // Bottle body
    const bodyGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.18, 16)
    const body = new THREE.Mesh(bodyGeo, mats.body)
    body.position.y = 0.09
    group.add(body)

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.05, 12)
    const neck = new THREE.Mesh(neckGeo, mats.plastic)
    neck.position.y = 0.19
    group.add(neck)

    // Sprayer head
    const headGeo = new THREE.BoxGeometry(0.05, 0.03, 0.04)
    const head = new THREE.Mesh(headGeo, mats.accent)
    head.position.set(0.035, 0.22, 0)
    group.add(head)

    // Trigger
    const trigGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.025, 8)
    const trig = new THREE.Mesh(trigGeo, mats.accent)
    trig.position.set(-0.015, 0.05, 0.02)
    trig.rotation.x = Math.PI / 4
    group.add(trig)

    // Liquid inside
    const liquidGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 12)
    const liquid = new THREE.Mesh(liquidGeo, mats.liquid)
    liquid.position.y = 0.075
    liquid.scale.y = 0.8
    group.add(liquid)
    this.liquidMesh = liquid
  }

  private buildMop(mats: any): void {
    const group = this.toolModel

    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8)
    const handle = new THREE.Mesh(handleGeo, mats.body)
    handle.position.y = 0.4
    group.add(handle)

    // Mop head
    const headGeo = new THREE.BoxGeometry(0.18, 0.04, 0.12)
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({
      color: 0xcccccc, roughness: 0.9, metalness: 0
    }))
    head.position.y = -0.02
    group.add(head)

    // Strands
    for (let i = 0; i < 12; i++) {
      const strandGeo = new THREE.CylinderGeometry(0.004, 0.002, 0.1, 4)
      const strand = new THREE.Mesh(strandGeo, new THREE.MeshStandardMaterial({
        color: 0xeeeeee, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.8
      }))
      strand.position.set(
        (Math.random() - 0.5) * 0.16,
        -0.07,
        (Math.random() - 0.5) * 0.1
      )
      strand.rotation.x = (Math.random() - 0.5) * 0.3
      group.add(strand)
    }
  }

  private buildVacuum(mats: any): void {
    const group = this.toolModel

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.15, 16)
    const body = new THREE.Mesh(bodyGeo, mats.body)
    body.position.y = 0.075
    group.add(body)

    // Motor hump
    const motorGeo = new THREE.SphereGeometry(0.05, 12, 12)
    const motor = new THREE.Mesh(motorGeo, mats.accent)
    motor.position.set(0, 0.18, 0)
    motor.scale.set(1, 0.6, 1)
    group.add(motor)

    // Nozzle
    const nozzleGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.12, 12)
    const nozzle = new THREE.Mesh(nozzleGeo, mats.plastic)
    nozzle.position.set(0.09, 0, -0.02)
    nozzle.rotation.z = -Math.PI / 2
    group.add(nozzle)

    // Handle
    const handleGeo = new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI)
    const handle = new THREE.Mesh(handleGeo, mats.plastic)
    handle.position.set(-0.06, 0.12, 0)
    handle.rotation.x = Math.PI / 2
    group.add(handle)
  }

  private buildTrashBag(mats: any): void {
    const group = this.toolModel

    // Bag body (crumpled)
    const bagGeo = new THREE.DodecahedronGeometry(0.08, 1)
    const bagMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9,
      metalness: 0,
      flatShading: true,
    })
    const bag = new THREE.Mesh(bagGeo, bagMat)
    bag.position.y = 0.05
    bag.scale.set(1.2, 1.4, 1)
    group.add(bag)

    // Tie
    const tieGeo = new THREE.TorusGeometry(0.03, 0.006, 8, 16)
    const tieMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5 })
    const tie = new THREE.Mesh(tieGeo, tieMat)
    tie.position.y = 0.15
    group.add(tie)
  }

  private createProgressRing(): void {
    // Shader-based progress ring around tool
    const ringGeo = new THREE.RingGeometry(0.08, 0.1, 64)

    this.progressMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uColor: { value: new THREE.Color(0x2ecc71) },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uProgress;
        uniform vec3 uColor;
        uniform float uTime;
        varying vec2 vUv;

        float getAngle(vec2 uv) {
          return atan(uv.y, uv.x) + 3.14159;
        }

        void main() {
          float angle = getAngle(vUv);
          float progressAngle = uProgress * 2.0 * 3.14159;

          float mask = step(angle, progressAngle);

          // Animated shimmer at progress edge
          float edge = smoothstep(progressAngle - 0.05, progressAngle, angle);
          vec3 edgeColor = uColor * (1.0 + sin(uTime * 8.0 + angle * 10.0) * 0.3);

          vec3 color = mix(vec3(0.1), edgeColor, mask);
          float alpha = mask * 0.9 + edge * 0.5;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })

    this.progressRing = new THREE.Mesh(ringGeo, this.progressMaterial)
    this.progressRing.renderOrder = 995
    this.progressRing.position.z = 0.02
    this.toolModel.add(this.progressRing)
  }

  private liquidMesh!: THREE.Mesh

  // Get the tool tip position and direction in world space for particle effects
  getToolTipPose(): { position: THREE.Vector3; direction: THREE.Vector3 } {
    const position = new THREE.Vector3()
    const direction = new THREE.Vector3(0, -1, 0)

    if (this.toolModel) {
      // Tool tip is at different positions depending on tool
      const tool = this.cleaningSystem.getCurrentTool()
      const tipOffset = new THREE.Vector3()

      switch (tool.type) {
        case 'spray':
          // Spray comes from sprayer head
          tipOffset.set(0.035, 0.22, 0)
          direction.set(0, -1, 0)
          break
        case 'mop':
          // Mop head position
          tipOffset.set(0, -0.02, 0)
          direction.set(0, -1, 0)
          break
        case 'vacuum':
          // Vacuum nozzle
          tipOffset.set(0.09, 0, -0.02)
          direction.set(1, 0, 0)
          break
        case 'trash_bag':
          // Bag center
          tipOffset.set(0, 0.05, 0)
          direction.set(0, -1, 0)
          break
      }

      // Apply tool model transform
      this.toolModel.localToWorld(position.copy(tipOffset))
      this.toolModel.localToWorld(direction.copy(direction).add(tipOffset))
      direction.sub(position).normalize()
    }

    return { position, direction }
  }

  private createPrompt(): void {
    this.promptMesh = new THREE.Group()
    this.promptMesh.name = 'prompt'
    this.camera.add(this.promptMesh)
    this.promptMesh.position.set(0, -0.4, -1.5)
    this.promptMesh.visible = false
  }

  private createReticle(): void {
    // World-space reticle for targeting
    const geo = new THREE.RingGeometry(0.08, 0.1, 32)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2ecc71,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    })
    this.reticle = new THREE.Mesh(geo, mat)
    this.reticle.rotation.x = -Math.PI / 2
    this.scene.add(this.reticle)
  }

  private createIconTexture(emoji: string): THREE.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.font = 'bold 80px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(emoji, 64, 68)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }

  private createTextTexture(text: string, color: number = 0xffffff, size: number = 18): THREE.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.font = `600 ${size}px 'Space Mono', monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0')
    ctx.fillText(text, 128, 32)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }

  // Public API
  showToolWheel(show: boolean): void {
    this.wheelVisible = show
    this.toolWheel.visible = show
    if (show) {
      this.updateWheelSelection()
    }
  }

  updateWheelSelection(): void {
    const tools = this.cleaningSystem.getTools()
    this.wheelItems.forEach((item, i) => {
      const isSelected = i === this.selectedToolIndex
      item.children.forEach(child => {
        if (child instanceof THREE.Mesh && child.material) {
          if (child.material instanceof THREE.MeshBasicMaterial) {
            child.material.opacity = isSelected ? 1 : 0.6
            child.material.color.set(isSelected ? 0x2ecc71 : 0x1a1a20)
            child.material.needsUpdate = true
          }
          if (child.geometry instanceof THREE.RingGeometry) {
            const mat = child.material as THREE.MeshBasicMaterial
            mat.opacity = isSelected ? 1 : 0.9
            mat.needsUpdate = true
          }
        }
      })
    })
  }

  selectTool(index: number): void {
    const tools = this.cleaningSystem.getTools()
    if (index >= 0 && index < tools.length) {
      this.selectedToolIndex = index
      this.cleaningSystem.setTool(tools[index].type)
      this.currentToolType = tools[index].type
      this.updateToolModel()
      this.updateWheelSelection()
    }
  }

  nextTool(): void {
    const tools = this.cleaningSystem.getTools()
    this.selectTool((this.selectedToolIndex + 1) % tools.length)
  }

  prevTool(): void {
    const tools = this.cleaningSystem.getTools()
    this.selectTool((this.selectedToolIndex - 1 + tools.length) % tools.length)
  }

  setToolType(type: ToolType): void {
    const tools = this.cleaningSystem.getTools()
    const idx = tools.findIndex(t => t.type === type)
    if (idx >= 0) {
      this.selectTool(idx)
    }
  }

  showPrompt(text: string): void {
    this.promptText = text
    this.promptVisible = true
    this.promptMesh.visible = true
    this.updatePromptMesh()
  }

  hidePrompt(): void {
    this.promptVisible = false
    this.promptMesh.visible = false
  }

  private updatePromptMesh(): void {
    this.promptMesh.clear()

    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 64
    const ctx = canvas.getContext('2d')!

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.fillRect(0, 0, 512, 64)

    // Text
    ctx.font = '500 22px "Space Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(this.promptText, 256, 32)

    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true

    const geo = new THREE.PlaneGeometry(1.2, 0.15)
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.renderOrder = 998
    this.promptMesh.add(mesh)
  }

  updateReticle(hit: THREE.Intersection | null, canInteract: boolean): void {
    if (hit && canInteract) {
      this.reticle.position.copy(hit.point)
      this.reticle.position.y += 0.01
      const reticleMat = this.reticle.material as THREE.MeshBasicMaterial
      reticleMat.opacity = 0.8
      reticleMat.color.set(0x2ecc71)
      this.reticle.scale.setScalar(1 + Math.sin(performance.now() * 0.005) * 0.1)
    } else {
      const reticleMat = this.reticle.material as THREE.MeshBasicMaterial
      reticleMat.opacity *= 0.9
    }
  }

  updateCrosshair(active: boolean, color: number = 0xffffff): void {
    const outerMat = this.crosshairOuter.material as THREE.MeshBasicMaterial
    const dotMat = this.crosshairDot.material as THREE.MeshBasicMaterial
    outerMat.color.set(color)
    dotMat.color.set(color)
    outerMat.opacity = active ? 0.8 : 0.4
    dotMat.opacity = active ? 1 : 0.6

    // Pulse when active
    if (active) {
      const scale = 1 + Math.sin(performance.now() * 0.01) * 0.1
      this.crosshairOuter.scale.setScalar(scale)
    } else {
      this.crosshairOuter.scale.setScalar(1)
    }
  }

  updateProgress(progress: number): void {
    if (this.progressMaterial) {
      this.progressMaterial.uniforms.uProgress.value = progress
      this.progressMaterial.uniforms.uTime.value = performance.now() * 0.001
    }

    // Liquid level in spray bottle
    if (this.liquidMesh && this.currentToolType === 'spray') {
      this.liquidMesh.scale.y = THREE.MathUtils.lerp(0.2, 1.0, 1 - progress)
    }
  }

  update(delta: number): void {
    // Animate tool model
    if (this.toolModel) {
      const time = performance.now() * 0.001
      this.toolModel.position.y = -0.25 + Math.sin(time * 2) * 0.01
      this.toolModel.rotation.z = Math.sin(time * 1.5) * 0.02
    }

    // Animate tool wheel
    if (this.wheelVisible) {
      this.toolWheel.rotation.z = Math.sin(performance.now() * 0.001) * 0.02
    }

    // Update progress ring time
    if (this.progressMaterial) {
      this.progressMaterial.uniforms.uTime.value = performance.now() * 0.001
    }
  }

  // === JOB BOARD UI ===

  private createJobBoard(): void {
    this.jobBoard = new THREE.Group()
    this.jobBoard.name = 'jobBoard'
    this.camera.add(this.jobBoard)
    this.jobBoard.position.set(0, 0.2, -2)
    this.jobBoard.visible = false
  }

  private createJobInfo(): void {
    this.jobInfoMesh = new THREE.Group()
    this.jobInfoMesh.name = 'jobInfo'
    this.camera.add(this.jobInfoMesh)
    this.jobInfoMesh.position.set(-0.6, 0.3, -1.2)
    this.jobInfoMesh.visible = false
  }

  addJobToBoard(job: Job): void {
    const index = this.jobBoardItems.length
    const yOffset = -index * 0.35

    const itemGroup = new THREE.Group()
    itemGroup.name = `jobItem_${job.id}`
    itemGroup.position.y = yOffset

    // Background panel
    const panelGeo = new THREE.PlaneGeometry(1.2, 0.3)
    const panelMat = new THREE.MeshBasicMaterial({
      color: 0x1a1a20,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const panel = new THREE.Mesh(panelGeo, panelMat)
    panel.renderOrder = 990
    itemGroup.add(panel)

    // Job type badge
    const typeColors: Record<string, number> = {
      standard: 0x3498db,
      deep_clean: 0x9b59b6,
      hoarder: 0xe74c3c,
      post_party: 0xf39c12,
      move_in: 0x2ecc71,
      move_out: 0x3498db,
      renovation_prep: 0xe67e22,
      emergency: 0xc0392b,
    }

    const badgeGeo = new THREE.PlaneGeometry(0.25, 0.04)
    const badgeMat = new THREE.MeshBasicMaterial({
      color: typeColors[job.type] || 0xffffff,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    })
    const badge = new THREE.Mesh(badgeGeo, badgeMat)
    badge.position.set(-0.45, 0.1, 0.01)
    badge.renderOrder = 991
    itemGroup.add(badge)

    // Job title
    const titleTex = this.createTextTexture(job.title, 0xffffff, 16)
    const titleGeo = new THREE.PlaneGeometry(0.7, 0.04)
    const titleMat = new THREE.MeshBasicMaterial({ map: titleTex, transparent: true, depthTest: false, depthWrite: false })
    const title = new THREE.Mesh(titleGeo, titleMat)
    title.position.set(-0.1, 0.1, 0.01)
    title.renderOrder = 991
    itemGroup.add(title)

    // Client name
    const clientTex = this.createTextTexture(job.clientName, 0xaaaaaa, 12)
    const clientGeo = new THREE.PlaneGeometry(0.7, 0.03)
    const clientMat = new THREE.MeshBasicMaterial({ map: clientTex, transparent: true, depthTest: false, depthWrite: false })
    const client = new THREE.Mesh(clientGeo, clientMat)
    client.position.set(-0.1, 0.04, 0.01)
    client.renderOrder = 991
    itemGroup.add(client)

    // Pay
    const payTex = this.createTextTexture(`£${job.basePay.toLocaleString()}`, 0x2ecc71, 16)
    const payGeo = new THREE.PlaneGeometry(0.3, 0.04)
    const payMat = new THREE.MeshBasicMaterial({ map: payTex, transparent: true, depthTest: false, depthWrite: false })
    const pay = new THREE.Mesh(payGeo, payMat)
    pay.position.set(0.4, 0.1, 0.01)
    pay.renderOrder = 991
    itemGroup.add(pay)

    // Difficulty
    const diffColors: Record<string, number> = { easy: 0x2ecc71, normal: 0xf39c12, hard: 0xe74c3c, extreme: 0x8e44ad }
    const diffTex = this.createTextTexture(job.difficulty.toUpperCase(), diffColors[job.difficulty] || 0xffffff, 10)
    const diffGeo = new THREE.PlaneGeometry(0.2, 0.025)
    const diffMat = new THREE.MeshBasicMaterial({ map: diffTex, transparent: true, depthTest: false, depthWrite: false })
    const diff = new THREE.Mesh(diffGeo, diffMat)
    diff.position.set(-0.45, -0.04, 0.01)
    diff.renderOrder = 991
    itemGroup.add(diff)

    // Room count
    const roomsTex = this.createTextTexture(`${job.targetRooms.length} rooms`, 0x888888, 10)
    const roomsGeo = new THREE.PlaneGeometry(0.25, 0.025)
    const roomsMat = new THREE.MeshBasicMaterial({ map: roomsTex, transparent: true, depthTest: false, depthWrite: false })
    const rooms = new THREE.Mesh(roomsGeo, roomsMat)
    rooms.position.set(-0.2, -0.04, 0.01)
    rooms.renderOrder = 991
    itemGroup.add(rooms)

    // Time limit
    if (job.timeLimit > 0) {
      const timeTex = this.createTextTexture(`${job.timeLimit} min`, 0xe74c3c, 10)
      const timeGeo = new THREE.PlaneGeometry(0.15, 0.025)
      const timeMat = new THREE.MeshBasicMaterial({ map: timeTex, transparent: true, depthTest: false, depthWrite: false })
      const time = new THREE.Mesh(timeGeo, timeMat)
      time.position.set(0.05, -0.04, 0.01)
      time.renderOrder = 991
      itemGroup.add(time)
    }

    // Special requirements indicator
    if (job.specialRequirements.length > 0) {
      const reqTex = this.createTextTexture(`⚠ ${job.specialRequirements.length} special`, 0xf39c12, 10)
      const reqGeo = new THREE.PlaneGeometry(0.3, 0.025)
      const reqMat = new THREE.MeshBasicMaterial({ map: reqTex, transparent: true, depthTest: false, depthWrite: false })
      const req = new THREE.Mesh(reqGeo, reqMat)
      req.position.set(0.25, -0.04, 0.01)
      req.renderOrder = 991
      itemGroup.add(req)
    }

    // Selection highlight (initially hidden)
    const highlightGeo = new THREE.PlaneGeometry(1.22, 0.32)
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x2ecc71,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const highlight = new THREE.Mesh(highlightGeo, highlightMat)
    highlight.renderOrder = 989
    highlight.name = 'highlight'
    itemGroup.add(highlight)

    this.jobBoard.add(itemGroup)
    this.jobBoardItems.push(itemGroup)
  }

  clearJobBoard(): void {
    this.jobBoardItems.forEach(item => {
      this.jobBoard.remove(item)
      // Dispose textures
      item.traverse(child => {
        if (child instanceof THREE.Mesh && child.material) {
          if (child.material instanceof THREE.MeshBasicMaterial && child.material.map) {
            child.material.map.dispose()
          }
          child.material.dispose()
        }
        if (child instanceof THREE.Mesh && child.geometry) {
          child.geometry.dispose()
        }
      })
    })
    this.jobBoardItems = []
  }

  showJobBoard(show: boolean): void {
    this.jobBoardVisible = show
    this.jobBoard.visible = show

    if (show) {
      // Update job board with current available jobs
      this.refreshJobBoard()
    }
  }

  refreshJobBoard(): void {
    this.clearJobBoard()

    // We'll need to get jobs from JobSystem - for now this is a placeholder
    // The actual job data will be passed via addJobToBoard from Game.ts
  }

  selectJobOnBoard(index: number): void {
    // Update highlights
    this.jobBoardItems.forEach((item, i) => {
      const highlight = item.getObjectByName('highlight') as THREE.Mesh | null
      if (highlight && highlight.material instanceof THREE.MeshBasicMaterial) {
        highlight.material.opacity = i === index ? 0.3 : 0
        highlight.material.needsUpdate = true
      }
    })
    this.selectedJobIndex = index
  }

  getSelectedJobId(): string | null {
    if (this.selectedJobIndex >= 0 && this.selectedJobIndex < this.jobBoardItems.length) {
      const item = this.jobBoardItems[this.selectedJobIndex]
      const parts = item.name.split('_')
      return parts.length > 1 ? parts.slice(1).join('_') : null
    }
    return null
  }

  // === ACTIVE JOB INFO ===

  updateJobInfo(job: Job | null): void {
    this.activeJob = job
    this.jobInfoMesh.clear()

    if (!job) {
      this.jobInfoMesh.visible = false
      return
    }

    this.jobInfoMesh.visible = true

    // Panel background
    const panelGeo = new THREE.PlaneGeometry(0.5, 0.6)
    const panelMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a10,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const panel = new THREE.Mesh(panelGeo, panelMat)
    panel.renderOrder = 980
    this.jobInfoMesh.add(panel)

    // Job title
    const titleTex = this.createTextTexture(job.title, 0xffffff, 14)
    const titleGeo = new THREE.PlaneGeometry(0.45, 0.04)
    const titleMat = new THREE.MeshBasicMaterial({ map: titleTex, transparent: true, depthTest: false, depthWrite: false })
    const title = new THREE.Mesh(titleGeo, titleMat)
    title.position.set(0, 0.25, 0.01)
    title.renderOrder = 981
    this.jobInfoMesh.add(title)

    // Client
    const clientTex = this.createTextTexture(job.clientName, 0xaaaaaa, 11)
    const clientGeo = new THREE.PlaneGeometry(0.45, 0.03)
    const clientMat = new THREE.MeshBasicMaterial({ map: clientTex, transparent: true, depthTest: false, depthWrite: false })
    const client = new THREE.Mesh(clientGeo, clientMat)
    client.position.set(0, 0.2, 0.01)
    client.renderOrder = 981
    this.jobInfoMesh.add(client)

    // Progress bars for each room
    let yOffset = 0.1
    for (const roomName of job.targetRooms) {
      const progress = job.currentProgress[roomName]
      if (progress) {
        // Room name
        const roomTex = this.createTextTexture(roomName.replace('_', ' '), 0xcccccc, 10)
        const roomGeo = new THREE.PlaneGeometry(0.45, 0.025)
        const roomMat = new THREE.MeshBasicMaterial({ map: roomTex, transparent: true, depthTest: false, depthWrite: false })
        const room = new THREE.Mesh(roomGeo, roomMat)
        room.position.set(-0.15, yOffset, 0.01)
        room.renderOrder = 981
        this.jobInfoMesh.add(room)

        // Cleanliness bar
        const cleanGeo = new THREE.PlaneGeometry(0.4 * (progress.cleanliness / 100), 0.02)
        const cleanMat = new THREE.MeshBasicMaterial({
          color: 0x2ecc71,
          transparent: true,
          opacity: 0.8,
          depthTest: false,
          depthWrite: false,
        })
        const cleanBar = new THREE.Mesh(cleanGeo, cleanMat)
        cleanBar.position.set(-0.15, yOffset - 0.03, 0.01)
        cleanBar.renderOrder = 981
        this.jobInfoMesh.add(cleanBar)

        // Trash bar
        const trashGeo = new THREE.PlaneGeometry(0.4 * (progress.trash / 100), 0.02)
        const trashMat = new THREE.MeshBasicMaterial({
          color: 0xf39c12,
          transparent: true,
          opacity: 0.8,
          depthTest: false,
          depthWrite: false,
        })
        const trashBar = new THREE.Mesh(trashGeo, trashMat)
        trashBar.position.set(-0.15, yOffset - 0.055, 0.01)
        trashBar.renderOrder = 981
        this.jobInfoMesh.add(trashBar)

        yOffset -= 0.08
      }
    }

    // Requirements
    yOffset -= 0.02
    if (job.specialRequirements.length > 0) {
      const reqHeaderTex = this.createTextTexture('REQUIREMENTS:', 0xf39c12, 10)
      const reqHeaderGeo = new THREE.PlaneGeometry(0.45, 0.025)
      const reqHeaderMat = new THREE.MeshBasicMaterial({ map: reqHeaderTex, transparent: true, depthTest: false, depthWrite: false })
      const reqHeader = new THREE.Mesh(reqHeaderGeo, reqHeaderMat)
      reqHeader.position.set(-0.15, yOffset, 0.01)
      reqHeader.renderOrder = 981
      this.jobInfoMesh.add(reqHeader)
      yOffset -= 0.03

      for (const req of job.specialRequirements) {
        const reqTex = this.createTextTexture(`• ${req.description}`, 0xcccccc, 9)
        const reqGeo = new THREE.PlaneGeometry(0.45, 0.02)
        const reqMat = new THREE.MeshBasicMaterial({ map: reqTex, transparent: true, depthTest: false, depthWrite: false })
        const reqMesh = new THREE.Mesh(reqGeo, reqMat)
        reqMesh.position.set(-0.15, yOffset, 0.01)
        reqMesh.renderOrder = 981
        this.jobInfoMesh.add(reqMesh)
        yOffset -= 0.025
      }
    }

    // Pay info
    yOffset -= 0.02
    const payTex = this.createTextTexture(`Pay: £${job.basePay.toLocaleString()} + bonus`, 0x2ecc71, 11)
    const payGeo = new THREE.PlaneGeometry(0.45, 0.03)
    const payMat = new THREE.MeshBasicMaterial({ map: payTex, transparent: true, depthTest: false, depthWrite: false })
    const pay = new THREE.Mesh(payGeo, payMat)
    pay.position.set(-0.15, yOffset, 0.01)
    pay.renderOrder = 981
    this.jobInfoMesh.add(pay)

    // Controls hint
    yOffset -= 0.05
    const ctrlTex = this.createTextTexture('[E] Accept  [ESC] Back', 0x888888, 9)
    const ctrlGeo = new THREE.PlaneGeometry(0.45, 0.025)
    const ctrlMat = new THREE.MeshBasicMaterial({ map: ctrlTex, transparent: true, depthTest: false, depthWrite: false })
    const ctrl = new THREE.Mesh(ctrlGeo, ctrlMat)
    ctrl.position.set(-0.15, yOffset, 0.01)
    ctrl.renderOrder = 981
    this.jobInfoMesh.add(ctrl)
  }

  isJobBoardVisible(): boolean {
    return this.jobBoardVisible
  }

  // ============================================
  // DRIVING / REPAIR / RECOVERY MODES
  // ============================================

  setDrivingMode(enabled: boolean): void {
    // Show/hide driving-specific HUD elements (speed, RPM, gear, fuel)
    this.crosshair.visible = !enabled
    if (enabled) {
      this.showDrivingHUD()
    } else {
      this.hideDrivingHUD()
    }
  }

  private showDrivingHUD(): void {
    // Create driving HUD elements if they don't exist
    if (!this.drivingHUD) {
      this.createDrivingHUD()
    }
    this.drivingHUD.visible = true
  }

  private hideDrivingHUD(): void {
    if (this.drivingHUD) {
      this.drivingHUD.visible = false
    }
  }

  private drivingHUD!: THREE.Group
  private speedText!: THREE.Mesh
  private rpmText!: THREE.Mesh
  private gearText!: THREE.Mesh
  private fuelText!: THREE.Mesh

  private createDrivingHUD(): void {
    this.drivingHUD = new THREE.Group()
    this.drivingHUD.name = 'drivingHUD'
    this.camera.add(this.drivingHUD)
    this.drivingHUD.position.set(0.6, -0.35, -1)

    const createTextMesh = (text: string, y: number, color: number = 0xffffff, size: number = 20) => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.font = `600 ${size}px 'Space Mono', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0')
      ctx.fillText(text, 128, 32)
      const tex = new THREE.CanvasTexture(canvas)
      tex.needsUpdate = true
      const geo = new THREE.PlaneGeometry(0.5, 0.12)
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.renderOrder = 985
      mesh.position.set(0, y, 0.01)
      return mesh
    }

    this.speedText = createTextMesh('0 MPH', 0.15, 0x2ecc71, 24)
    this.rpmText = createTextMesh('0 RPM', 0.02, 0xf39c12, 20)
    this.gearText = createTextMesh('N', -0.1, 0x3498db, 28)
    this.fuelText = createTextMesh('FULL', -0.22, 0xe74c3c, 18)

    this.drivingHUD.add(this.speedText, this.rpmText, this.gearText, this.fuelText)
  }

  updateDrivingHUD(data: { speed: number; rpm: number; gear: number; fuelLevel: number; redline: number }): void {
    if (!this.drivingHUD || !this.drivingHUD.visible) return

    // Update speed
    const speedMph = Math.round(data.speed * 2.237)
    this.updateTextMesh(this.speedText, `${speedMph} MPH`, speedMph > 70 ? 0xe74c3c : 0x2ecc71)

    // Update RPM
    this.updateTextMesh(this.rpmText, `${Math.round(data.rpm)} RPM`, data.rpm > data.redline * 0.9 ? 0xe74c3c : 0xf39c12)

    // Update gear
    const gearLabel = data.gear === 0 ? 'N' : data.gear === -1 ? 'R' : String(data.gear)
    this.updateTextMesh(this.gearText, gearLabel, 0x3498db)

    // Update fuel
    const fuelPct = Math.round(data.fuelLevel * 100)
    this.updateTextMesh(this.fuelText, fuelPct < 20 ? `FUEL: ${fuelPct}%` : `${fuelPct}%`, fuelPct < 20 ? 0xe74c3c : 0xe67e22)
  }

  private updateTextMesh(mesh: THREE.Mesh, text: string, color: number): void {
    if (mesh.material instanceof THREE.MeshBasicMaterial && mesh.material.map) {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      const size = mesh === this.gearText ? 28 : mesh === this.fuelText ? 18 : 20
      ctx.font = `600 ${size}px 'Space Mono', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0')
      ctx.fillText(text, 128, 32)
      mesh.material.map.dispose()
      mesh.material.map = new THREE.CanvasTexture(canvas)
      mesh.material.map.needsUpdate = true
      mesh.material.needsUpdate = true
    }
  }

  setRepairMode(enabled: boolean): void {
    if (enabled) {
      this.showRepairHUD()
    } else {
      this.hideRepairHUD()
    }
  }

  private repairHUD!: THREE.Group
  private repairProgressBar!: THREE.Mesh
  private repairProgressMat!: THREE.MeshBasicMaterial

  private showRepairHUD(): void {
    if (!this.repairHUD) {
      this.createRepairHUD()
    }
    this.repairHUD.visible = true
  }

  private hideRepairHUD(): void {
    if (this.repairHUD) this.repairHUD.visible = false
  }

  private createRepairHUD(): void {
    this.repairHUD = new THREE.Group()
    this.repairHUD.name = 'repairHUD'
    this.camera.add(this.repairHUD)
    this.repairHUD.position.set(-0.6, -0.35, -1)

    const panelGeo = new THREE.PlaneGeometry(0.5, 0.3)
    const panelMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a10,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const panel = new THREE.Mesh(panelGeo, panelMat)
    panel.renderOrder = 980
    this.repairHUD.add(panel)

    // Title
    const titleTex = this.createTextTexture('REPAIR MODE', 0x2ecc71, 16)
    const titleGeo = new THREE.PlaneGeometry(0.45, 0.04)
    const titleMat = new THREE.MeshBasicMaterial({ map: titleTex, transparent: true, depthTest: false, depthWrite: false })
    const title = new THREE.Mesh(titleGeo, titleMat)
    title.position.set(0, 0.11, 0.01)
    title.renderOrder = 981
    this.repairHUD.add(title)

    // Progress bar background
    const barBgGeo = new THREE.PlaneGeometry(0.4, 0.03)
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false })
    const barBg = new THREE.Mesh(barBgGeo, barBgMat)
    barBg.position.set(0, -0.02, 0.01)
    barBg.renderOrder = 981
    this.repairHUD.add(barBg)

    // Progress bar fill
    this.repairProgressMat = new THREE.MeshBasicMaterial({
      color: 0x2ecc71,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
    })
    this.repairProgressBar = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.03), this.repairProgressMat)
    this.repairProgressBar.position.set(-0.2 + 0.005, -0.02, 0.02)
    this.repairProgressBar.renderOrder = 982
    this.repairHUD.add(this.repairProgressBar)

    // Hint
    const hintTex = this.createTextTexture('[ESC] Exit Repair', 0x888888, 10)
    const hintGeo = new THREE.PlaneGeometry(0.4, 0.025)
    const hintMat = new THREE.MeshBasicMaterial({ map: hintTex, transparent: true, depthTest: false, depthWrite: false })
    const hint = new THREE.Mesh(hintGeo, hintMat)
    hint.position.set(0, -0.12, 0.01)
    hint.renderOrder = 981
    this.repairHUD.add(hint)
  }

  updateRepairProgress(progress: number): void {
    if (this.repairProgressBar && this.repairProgressMat) {
      const width = 0.4 * Math.max(0, Math.min(1, progress))
      this.repairProgressBar.scale.x = width / 0.01
      this.repairProgressBar.position.x = -0.2 + width / 2
      this.repairProgressMat.color.set(progress > 0.8 ? 0x2ecc71 : progress > 0.4 ? 0xf39c12 : 0xe74c3c)
    }
  }

  setRecoveryMode(enabled: boolean): void {
    if (enabled) {
      this.showRecoveryHUD()
    } else {
      this.hideRecoveryHUD()
    }
  }

  private recoveryHUD!: THREE.Group
  private recoveryETATex!: THREE.Mesh
  private recoveryCostTex!: THREE.Mesh

  private showRecoveryHUD(): void {
    if (!this.recoveryHUD) {
      this.createRecoveryHUD()
    }
    this.recoveryHUD.visible = true
  }

  private hideRecoveryHUD(): void {
    if (this.recoveryHUD) this.recoveryHUD.visible = false
  }

  private createRecoveryHUD(): void {
    this.recoveryHUD = new THREE.Group()
    this.recoveryHUD.name = 'recoveryHUD'
    this.camera.add(this.recoveryHUD)
    this.recoveryHUD.position.set(0, 0.2, -1.5)

    const panelGeo = new THREE.PlaneGeometry(0.8, 0.4)
    const panelMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a10,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const panel = new THREE.Mesh(panelGeo, panelMat)
    panel.renderOrder = 990
    this.recoveryHUD.add(panel)

    // Title
    const titleTex = this.createTextTexture('RECOVERY TRUCK EN ROUTE', 0xf39c12, 18)
    const titleGeo = new THREE.PlaneGeometry(0.7, 0.05)
    const titleMat = new THREE.MeshBasicMaterial({ map: titleTex, transparent: true, depthTest: false, depthWrite: false })
    const title = new THREE.Mesh(titleGeo, titleMat)
    title.position.set(0, 0.13, 0.01)
    title.renderOrder = 991
    this.recoveryHUD.add(title)

    // ETA
    const etaTex = this.createTextTexture('ETA: --:--', 0xffffff, 20)
    const etaGeo = new THREE.PlaneGeometry(0.4, 0.05)
    const etaMat = new THREE.MeshBasicMaterial({ map: etaTex, transparent: true, depthTest: false, depthWrite: false })
    this.recoveryETATex = new THREE.Mesh(etaGeo, etaMat)
    this.recoveryETATex.position.set(0, 0.02, 0.01)
    this.recoveryETATex.renderOrder = 991
    this.recoveryHUD.add(this.recoveryETATex)

    // Cost
    const costTex = this.createTextTexture('Cost: £--', 0x2ecc71, 16)
    const costGeo = new THREE.PlaneGeometry(0.4, 0.04)
    const costMat = new THREE.MeshBasicMaterial({ map: costTex, transparent: true, depthTest: false, depthWrite: false })
    this.recoveryCostTex = new THREE.Mesh(costGeo, costMat)
    this.recoveryCostTex.position.set(0, -0.07, 0.01)
    this.recoveryCostTex.renderOrder = 991
    this.recoveryHUD.add(this.recoveryCostTex)

    // Cancel hint
    const hintTex = this.createTextTexture('[ESC] Cancel Recovery', 0xe74c3c, 12)
    const hintGeo = new THREE.PlaneGeometry(0.5, 0.03)
    const hintMat = new THREE.MeshBasicMaterial({ map: hintTex, transparent: true, depthTest: false, depthWrite: false })
    const hint = new THREE.Mesh(hintGeo, hintMat)
    hint.position.set(0, -0.16, 0.01)
    hint.renderOrder = 991
    this.recoveryHUD.add(hint)
  }

  updateRecoveryETA(etaMinutes: number): void {
    if (this.recoveryETATex && this.recoveryETATex.material instanceof THREE.MeshBasicMaterial && this.recoveryETATex.material.map) {
      const mins = Math.floor(etaMinutes)
      const secs = Math.floor((etaMinutes - mins) * 60)
      const text = `ETA: ${mins}:${secs.toString().padStart(2, '0')}`
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.font = '600 20px "Space Mono", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(text, 128, 32)
      this.recoveryETATex.material.map.dispose()
      this.recoveryETATex.material.map = new THREE.CanvasTexture(canvas)
      this.recoveryETATex.material.map.needsUpdate = true
      this.recoveryETATex.material.needsUpdate = true
    }
  }

  updateRecoveryCost(cost: number): void {
    if (this.recoveryCostTex && this.recoveryCostTex.material instanceof THREE.MeshBasicMaterial && this.recoveryCostTex.material.map) {
      const text = `Cost: £${cost.toLocaleString()}`
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.font = '600 16px "Space Mono", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#2ecc71'
      ctx.fillText(text, 128, 32)
      this.recoveryCostTex.material.map.dispose()
      this.recoveryCostTex.material.map = new THREE.CanvasTexture(canvas)
      this.recoveryCostTex.material.map.needsUpdate = true
      this.recoveryCostTex.material.needsUpdate = true
    }
  }

  // ============================================
  // DIAGNOSIS MINIGAME HUD
  // ============================================

  private diagnosisHUD!: THREE.Group
  private diagnosisPhaseTex!: THREE.Mesh
  private faultCodesContainer!: THREE.Group
  private liveDataContainer!: THREE.Group
  private testResultTex!: THREE.Mesh

  updateDiagnosisState(state: { phase: string; step: number; totalSteps: number }): void {
    if (!this.diagnosisHUD) {
      this.createDiagnosisHUD()
    }
    this.diagnosisHUD.visible = true

    if (this.diagnosisPhaseTex && this.diagnosisPhaseTex.material instanceof THREE.MeshBasicMaterial && this.diagnosisPhaseTex.material.map) {
      const text = `${state.phase.toUpperCase()} - Step ${state.step}/${state.totalSteps}`
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.font = '600 20px "Space Mono", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#2ecc71'
      ctx.fillText(text, 256, 32)
      this.diagnosisPhaseTex.material.map.dispose()
      this.diagnosisPhaseTex.material.map = new THREE.CanvasTexture(canvas)
      this.diagnosisPhaseTex.material.map.needsUpdate = true
      this.diagnosisPhaseTex.material.needsUpdate = true
    }
  }

  private createDiagnosisHUD(): void {
    this.diagnosisHUD = new THREE.Group()
    this.diagnosisHUD.name = 'diagnosisHUD'
    this.camera.add(this.diagnosisHUD)
    this.diagnosisHUD.position.set(0, 0.3, -1.5)

    // Phase text
    const phaseTex = this.createTextTexture('DIAGNOSIS - CONNECTING...', 0x2ecc71, 18)
    const phaseGeo = new THREE.PlaneGeometry(0.8, 0.05)
    const phaseMat = new THREE.MeshBasicMaterial({ map: phaseTex, transparent: true, depthTest: false, depthWrite: false })
    this.diagnosisPhaseTex = new THREE.Mesh(phaseGeo, phaseMat)
    this.diagnosisPhaseTex.position.set(0, 0.15, 0.01)
    this.diagnosisPhaseTex.renderOrder = 995
    this.diagnosisHUD.add(this.diagnosisPhaseTex)

    // Fault codes container
    this.faultCodesContainer = new THREE.Group()
    this.faultCodesContainer.position.set(-0.35, 0.0, 0.01)
    this.diagnosisHUD.add(this.faultCodesContainer)

    // Live data container
    this.liveDataContainer = new THREE.Group()
    this.liveDataContainer.position.set(0.35, 0.0, 0.01)
    this.diagnosisHUD.add(this.liveDataContainer)

    // Test result
    const resultTex = this.createTextTexture('', 0xffffff, 16)
    const resultGeo = new THREE.PlaneGeometry(0.7, 0.04)
    const resultMat = new THREE.MeshBasicMaterial({ map: resultTex, transparent: true, depthTest: false, depthWrite: false })
    this.testResultTex = new THREE.Mesh(resultGeo, resultMat)
    this.testResultTex.position.set(0, -0.15, 0.01)
    this.testResultTex.renderOrder = 995
    this.diagnosisHUD.add(this.testResultTex)
  }

  showFaultCodes(codes: Array<{ code: string; description: string; severity: string }>): void {
    this.faultCodesContainer.clear()

    // Header
    const headerTex = this.createTextTexture('FAULT CODES', 0xe74c3c, 14)
    const headerGeo = new THREE.PlaneGeometry(0.5, 0.035)
    const headerMat = new THREE.MeshBasicMaterial({ map: headerTex, transparent: true, depthTest: false, depthWrite: false })
    const header = new THREE.Mesh(headerGeo, headerMat)
    header.position.set(0, 0.2, 0)
    header.renderOrder = 996
    this.faultCodesContainer.add(header)

    codes.forEach((code, i) => {
      const severityColor = code.severity === 'critical' ? 0xe74c3c : code.severity === 'major' ? 0xf39c12 : 0x3498db
      const codeTex = this.createTextTexture(`${code.code} - ${code.description}`, severityColor, 11)
      const codeGeo = new THREE.PlaneGeometry(0.5, 0.025)
      const codeMat = new THREE.MeshBasicMaterial({ map: codeTex, transparent: true, depthTest: false, depthWrite: false })
      const codeMesh = new THREE.Mesh(codeGeo, codeMat)
      codeMesh.position.set(0, 0.12 - i * 0.035, 0)
      codeMesh.renderOrder = 996
      this.faultCodesContainer.add(codeMesh)
    })
  }

  updateLiveData(readings: Array<{ name: string; value: string; unit: string; normal: boolean }>): void {
    this.liveDataContainer.clear()

    const headerTex = this.createTextTexture('LIVE DATA', 0x3498db, 14)
    const headerGeo = new THREE.PlaneGeometry(0.5, 0.035)
    const headerMat = new THREE.MeshBasicMaterial({ map: headerTex, transparent: true, depthTest: false, depthWrite: false })
    const header = new THREE.Mesh(headerGeo, headerMat)
    header.position.set(0, 0.2, 0)
    header.renderOrder = 996
    this.liveDataContainer.add(header)

    readings.forEach((reading, i) => {
      const color = reading.normal ? 0x2ecc71 : 0xe74c3c
      const text = `${reading.name}: ${reading.value} ${reading.unit}`
      const readingTex = this.createTextTexture(text, color, 10)
      const readingGeo = new THREE.PlaneGeometry(0.5, 0.022)
      const readingMat = new THREE.MeshBasicMaterial({ map: readingTex, transparent: true, depthTest: false, depthWrite: false })
      const readingMesh = new THREE.Mesh(readingGeo, readingMat)
      readingMesh.position.set(0, 0.12 - i * 0.03, 0)
      readingMesh.renderOrder = 996
      this.liveDataContainer.add(readingMesh)
    })
  }

  showTestResult(result: { test: string; passed: boolean; expected: string; actual: string }): void {
    if (this.testResultTex && this.testResultTex.material instanceof THREE.MeshBasicMaterial && this.testResultTex.material.map) {
      const color = result.passed ? 0x2ecc71 : 0xe74c3c
      const text = result.passed ? `✓ ${result.test}: PASS` : `✗ ${result.test}: FAIL (expected ${result.expected}, got ${result.actual})`
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.font = '600 16px "Space Mono", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0')
      ctx.fillText(text, 256, 32)
      this.testResultTex.material.map.dispose()
      this.testResultTex.material.map = new THREE.CanvasTexture(canvas)
      this.testResultTex.material.map.needsUpdate = true
      this.testResultTex.material.needsUpdate = true
    }
  }

  hideDiagnosisHUD(): void {
    if (this.diagnosisHUD) this.diagnosisHUD.visible = false
  }

  // ============================================
  // BREAKDOWN ALERTS
  // ============================================

  private breakdownAlertHUD!: THREE.Group

  showBreakdownAlert(event: { severity: string; subsystem: string; message: string }): void {
    if (!this.breakdownAlertHUD) {
      this.createBreakdownAlertHUD()
    }
    this.breakdownAlertHUD.visible = true

    // Update the alert text
    const alertText = this.breakdownAlertHUD.getObjectByName('alertText') as THREE.Mesh
    if (alertText && alertText.material instanceof THREE.MeshBasicMaterial && alertText.material.map) {
      const text = `⚠ ${event.severity.toUpperCase()} BREAKDOWN: ${event.subsystem} - ${event.message}`
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.font = '600 18px "Space Mono", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = event.severity === 'critical' ? '#e74c3c' : event.severity === 'major' ? '#f39c12' : '#3498db'
      ctx.fillText(text, 256, 32)
      alertText.material.map.dispose()
      alertText.material.map = new THREE.CanvasTexture(canvas)
      alertText.material.map.needsUpdate = true
      alertText.material.needsUpdate = true
    }
  }

  private createBreakdownAlertHUD(): void {
    this.breakdownAlertHUD = new THREE.Group()
    this.breakdownAlertHUD.name = 'breakdownAlertHUD'
    this.camera.add(this.breakdownAlertHUD)
    this.breakdownAlertHUD.position.set(0, 0.4, -1.5)

    const panelGeo = new THREE.PlaneGeometry(0.9, 0.25)
    const panelMat = new THREE.MeshBasicMaterial({
      color: 0x1a0a0a,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const panel = new THREE.Mesh(panelGeo, panelMat)
    panel.renderOrder = 990
    this.breakdownAlertHUD.add(panel)

    const alertTex = this.createTextTexture('⚠ BREAKDOWN DETECTED', 0xe74c3c, 18)
    const alertGeo = new THREE.PlaneGeometry(0.8, 0.05)
    const alertMat = new THREE.MeshBasicMaterial({ map: alertTex, transparent: true, depthTest: false, depthWrite: false })
    const alertMesh = new THREE.Mesh(alertGeo, alertMat)
    alertMesh.name = 'alertText'
    alertMesh.position.set(0, 0.05, 0.01)
    alertMesh.renderOrder = 991
    this.breakdownAlertHUD.add(alertMesh)

    const hintTex = this.createTextTexture('[E] Call Recovery  [H] Roadside Repair', 0xffffff, 12)
    const hintGeo = new THREE.PlaneGeometry(0.8, 0.03)
    const hintMat = new THREE.MeshBasicMaterial({ map: hintTex, transparent: true, depthTest: false, depthWrite: false })
    const hint = new THREE.Mesh(hintGeo, hintMat)
    hint.position.set(0, -0.05, 0.01)
    hint.renderOrder = 991
    this.breakdownAlertHUD.add(hint)
  }

  hideBreakdownAlert(): void {
    if (this.breakdownAlertHUD) this.breakdownAlertHUD.visible = false
  }

  showWarningLight(subsystem: string, severity: string, message: string): void {
    // Show a warning light indicator
    this.showPrompt(`⚠ ${subsystem.toUpperCase()}: ${message}`)
  }

  showFuelWarning(fuelFraction: number): void {
    this.showPrompt(`⛽ FUEL LOW - ${Math.round(fuelFraction * 100)}% REMAINING`)
  }

  showRecoveryCalled(): void {
    this.showPrompt('📞 Recovery truck dispatched. Sit tight.')
  }

  showRecoveryArrived(): void {
    this.showPrompt('🚛 Recovery truck arrived. Preparing to load.')
  }

  hideRecoveryUI(): void {
    this.hideRecoveryHUD()
  }

  updateFPS(fps: number): void {
    // Could add FPS counter to HUD if needed
  }

  onResize(width: number, height: number): void {
    // Handle resize if needed for HUD elements
  }

  dispose(): void {
    this.camera.remove(this.crosshair)
    this.camera.remove(this.toolWheel)
    this.camera.remove(this.toolModel)
    this.camera.remove(this.promptMesh)
    this.camera.remove(this.jobBoard)
    this.camera.remove(this.jobInfoMesh)
    if (this.drivingHUD) this.camera.remove(this.drivingHUD)
    if (this.repairHUD) this.camera.remove(this.repairHUD)
    if (this.recoveryHUD) this.camera.remove(this.recoveryHUD)
    if (this.diagnosisHUD) this.camera.remove(this.diagnosisHUD)
    if (this.breakdownAlertHUD) this.camera.remove(this.breakdownAlertHUD)
    this.scene.remove(this.reticle)
  }
}