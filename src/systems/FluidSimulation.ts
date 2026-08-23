import * as THREE from 'three';
import type { ParticleSystem } from './ParticleSystem.js';

interface Droplet {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  surfaceTension: number;
}

interface MopTrailPoint {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  wetness: number; // 0-1
  life: number;
  maxLife: number;
}

interface VacuumParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  targetPosition: THREE.Vector3;
}

export class FluidSimulation {
  private particleSystem: ParticleSystem;
  private scene: THREE.Scene;

  // Spray droplets
  private sprayDroplets: Droplet[] = [];
  private sprayGeometry!: THREE.BufferGeometry;
  private sprayMaterial!: THREE.PointsMaterial;
  private sprayPoints!: THREE.Points;
  private maxSprayDroplets = 300;

  // Mop wet trail
  private mopTrailPoints: MopTrailPoint[] = [];
  private maxMopTrailPoints = 100;
  private mopGeometry!: THREE.BufferGeometry;
  private mopMaterial!: THREE.PointsMaterial;
  private mopPoints!: THREE.Points;

  // Vacuum suction
  private vacuumParticles: VacuumParticle[] = [];
  private maxVacuumParticles = 200;
  private vacuumGeometry!: THREE.BufferGeometry;
  private vacuumMaterial!: THREE.PointsMaterial;
  private vacuumPoints!: THREE.Points;

  // Wet surface decals (for mop)
  private wetSurfaces = new Map<string, { mesh: THREE.Mesh; wetness: number; life: number }>();

  // Simulation constants
  private readonly GRAVITY = 9.81;
  private readonly AIR_DRAG = 0.98;
  private readonly SPREAD_FACTOR = 0.15;
  private readonly DROPLET_LIFE = 1.5;
  private readonly MOP_TRAIL_LIFE = 8.0;
  private readonly VACUUM_LIFE = 0.8;

  constructor(scene: THREE.Scene, particleSystem: ParticleSystem) {
    this.scene = scene;
    this.particleSystem = particleSystem;
    this.initSpraySystem();
    this.initMopSystem();
    this.initVacuumSystem();
  }

  // === SPRAY SYSTEM ===

  private initSpraySystem(): void {
    this.sprayGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxSprayDroplets * 3);
    const colors = new Float32Array(this.maxSprayDroplets * 3);
    const sizes = new Float32Array(this.maxSprayDroplets);
    const alphas = new Float32Array(this.maxSprayDroplets);

    this.sprayGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.sprayGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.sprayGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.sprayGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    this.sprayMaterial = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      alphaMap: this.createDropletAlphaMap(),
    });

    this.sprayPoints = new THREE.Points(this.sprayGeometry, this.sprayMaterial);
    this.sprayPoints.frustumCulled = false;
    this.scene.add(this.sprayPoints);
  }

  private createDropletAlphaMap(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  emitSpray(position: THREE.Vector3, direction: THREE.Vector3, pressure = 1.0): void {
    const dropletCount = Math.floor(5 + pressure * 8);

    for (let i = 0; i < dropletCount; i++) {
      if (this.sprayDroplets.length >= this.maxSprayDroplets) break;

      // Conical spray pattern with realistic physics
      const spreadAngle = (this.SPREAD_FACTOR * (1 + Math.random() * 0.5)) / pressure;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * spreadAngle;

      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      );
      dir.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
      );

      const speed = (8 + Math.random() * 6) * pressure;
      const velocity = dir.multiplyScalar(speed);

      // Add initial velocity variation
      velocity.add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 1,
          (Math.random() - 0.5) * 2
        )
      );

      const droplet: Droplet = {
        position: position.clone(),
        velocity,
        life: this.DROPLET_LIFE,
        maxLife: this.DROPLET_LIFE,
        size: 0.015 + Math.random() * 0.01,
        color: new THREE.Color().setHSL(
          0.55 + (Math.random() - 0.5) * 0.08,
          0.7,
          0.6 + Math.random() * 0.3
        ),
        surfaceTension: 0.8 + Math.random() * 0.2,
      };

      this.sprayDroplets.push(droplet);
    }

    // Also emit visual particles via particle system
    this.particleSystem.startSpray(position, direction);
  }

  updateSpray(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    delta: number,
    pressure = 1.0
  ): void {
    this.emitSpray(position, direction, pressure);
    this.particleSystem.updateSpray(position, direction, delta);
  }

  stopSpray(): void {
    this.particleSystem.stopSpray();
  }

  private updateSprayDroplets(delta: number): void {
    const positions = this.sprayGeometry.attributes.position.array as Float32Array;
    const colors = this.sprayGeometry.attributes.color.array as Float32Array;
    const sizes = this.sprayGeometry.attributes.size.array as Float32Array;
    const alphas = this.sprayGeometry.attributes.alpha.array as Float32Array;

    let activeIndex = 0;

    for (let i = this.sprayDroplets.length - 1; i >= 0; i--) {
      const droplet = this.sprayDroplets[i];
      droplet.life -= delta;

      if (droplet.life <= 0) {
        this.sprayDroplets.splice(i, 1);
        continue;
      }

      // Physics update
      droplet.velocity.y -= this.GRAVITY * delta;
      droplet.velocity.multiplyScalar(this.AIR_DRAG);

      droplet.position.addScaledVector(droplet.velocity, delta);

      // Surface tension - droplets try to stay together
      this.applySurfaceTension(droplet, i);

      // Collision with surfaces (simplified - check Y for floor)
      if (droplet.position.y <= 0.02 && droplet.velocity.y < 0) {
        droplet.position.y = 0.02;
        droplet.velocity.y *= -0.3; // Bounce with energy loss
        droplet.velocity.x *= 0.7;
        droplet.velocity.z *= 0.7;

        // Create splash
        if (droplet.life > droplet.maxLife * 0.5) {
          this.createSplash(droplet.position.clone());
        }
      }

      // Update buffer
      const lifeRatio = droplet.life / droplet.maxLife;
      positions[activeIndex * 3] = droplet.position.x;
      positions[activeIndex * 3 + 1] = droplet.position.y;
      positions[activeIndex * 3 + 2] = droplet.position.z;

      colors[activeIndex * 3] = droplet.color.r;
      colors[activeIndex * 3 + 1] = droplet.color.g;
      colors[activeIndex * 3 + 2] = droplet.color.b;

      sizes[activeIndex] = droplet.size * lifeRatio * 1.5;
      alphas[activeIndex] = lifeRatio * 0.9;

      activeIndex++;
    }

    // Clear remaining
    for (let i = activeIndex; i < this.maxSprayDroplets; i++) {
      alphas[i] = 0;
    }

    this.sprayGeometry.attributes.position.needsUpdate = true;
    this.sprayGeometry.attributes.color.needsUpdate = true;
    this.sprayGeometry.attributes.size.needsUpdate = true;
    this.sprayGeometry.attributes.alpha.needsUpdate = true;
  }

  private applySurfaceTension(droplet: Droplet, index: number): void {
    // Simple surface tension - attract nearby droplets
    const neighbors = 4;
    let count = 0;
    const force = new THREE.Vector3(0, 0, 0);

    for (
      let j = Math.max(0, index - neighbors);
      j < Math.min(this.sprayDroplets.length, index + neighbors + 1);
      j++
    ) {
      if (j === index) continue;
      const other = this.sprayDroplets[j];
      const dist = droplet.position.distanceTo(other.position);
      if (dist < 0.1 && dist > 0.001) {
        const dir = other.position.clone().sub(droplet.position).normalize();
        force.add(dir.multiplyScalar(droplet.surfaceTension * (0.1 - dist) * 10));
        count++;
      }
    }

    if (count > 0) {
      force.divideScalar(count);
      droplet.velocity.addScaledVector(force, 0.01);
    }
  }

  private createSplash(position: THREE.Vector3): void {
    const splashCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < splashCount; i++) {
      if (this.sprayDroplets.length >= this.maxSprayDroplets) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      const splashDroplet: Droplet = {
        position: position.clone(),
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          1 + Math.random() * 2,
          Math.sin(angle) * speed
        ),
        life: 0.5,
        maxLife: 0.5,
        size: 0.01 + Math.random() * 0.008,
        color: new THREE.Color().setHSL(0.55, 0.6, 0.7),
        surfaceTension: 0.5,
      };
      this.sprayDroplets.push(splashDroplet);
    }
  }

  // === MOP SYSTEM ===

  private initMopSystem(): void {
    this.mopGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxMopTrailPoints * 3);
    const colors = new Float32Array(this.maxMopTrailPoints * 3);
    const sizes = new Float32Array(this.maxMopTrailPoints);
    const alphas = new Float32Array(this.maxMopTrailPoints);
    const wetnessAttr = new Float32Array(this.maxMopTrailPoints);

    this.mopGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.mopGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.mopGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.mopGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    this.mopGeometry.setAttribute('wetness', new THREE.BufferAttribute(wetnessAttr, 1));

    this.mopMaterial = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.mopPoints = new THREE.Points(this.mopGeometry, this.mopMaterial);
    this.mopPoints.frustumCulled = false;
    this.scene.add(this.mopPoints);
  }

  addMopTrailPoint(position: THREE.Vector3, normal: THREE.Vector3, pressure = 1.0): void {
    // Add to trail points
    const point: MopTrailPoint = {
      position: position.clone(),
      normal: normal.clone(),
      wetness: 0.5 + pressure * 0.5,
      life: this.MOP_TRAIL_LIFE,
      maxLife: this.MOP_TRAIL_LIFE,
    };

    this.mopTrailPoints.unshift(point);
    if (this.mopTrailPoints.length > this.maxMopTrailPoints) {
      this.mopTrailPoints.pop();
    }

    // Create wet surface decal
    this.createWetSurface(position, normal, pressure);

    // Update particle system trail
    this.particleSystem.updateMopTrail(position);
  }

  startMopTrail(position: THREE.Vector3): void {
    this.particleSystem.startMopTrail(position);
  }

  stopMopTrail(): void {
    this.particleSystem.stopMopTrail();
  }

  private createWetSurface(position: THREE.Vector3, normal: THREE.Vector3, pressure: number): void {
    const key = `${Math.round(position.x * 10)},${Math.round(position.y * 10)},${Math.round(position.z * 10)}`;

    if (this.wetSurfaces.has(key)) {
      const existing = this.wetSurfaces.get(key)!;
      existing.wetness = Math.min(1, existing.wetness + pressure * 0.3);
      existing.life = this.MOP_TRAIL_LIFE;
      return;
    }

    // Create wet decal
    const size = 0.3 + pressure * 0.2;
    const geometry = new THREE.CircleGeometry(size, 16);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x3a5a7a,
      transparent: true,
      opacity: 0.3 * pressure,
      roughness: 0.1,
      metalness: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.addScaledVector(normal, 0.003);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    mesh.name = `wet_${key}`;

    this.scene.add(mesh);

    this.wetSurfaces.set(key, { mesh, wetness: pressure, life: this.MOP_TRAIL_LIFE });
  }

  private updateMopTrail(delta: number): void {
    const positions = this.mopGeometry.attributes.position.array as Float32Array;
    const colors = this.mopGeometry.attributes.color.array as Float32Array;
    const sizes = this.mopGeometry.attributes.size.array as Float32Array;
    const alphas = this.mopGeometry.attributes.alpha.array as Float32Array;
    const wetnessAttr = this.mopGeometry.attributes.wetness.array as Float32Array;

    // Update trail points
    for (let i = this.mopTrailPoints.length - 1; i >= 0; i--) {
      const point = this.mopTrailPoints[i];
      point.life -= delta;

      if (point.life <= 0) {
        this.mopTrailPoints.splice(i, 1);
        continue;
      }

      const lifeRatio = point.life / point.maxLife;
      const idx = this.mopTrailPoints.length - 1 - i;

      positions[idx * 3] = point.position.x;
      positions[idx * 3 + 1] = point.position.y + 0.01;
      positions[idx * 3 + 2] = point.position.z;

      // Color shifts from blue (wet) to transparent
      const wetColor = new THREE.Color(0x4a88cc);
      const dryColor = new THREE.Color(0x88aacc);
      const color = wetColor.clone().lerp(dryColor, 1 - point.wetness * lifeRatio);
      colors[idx * 3] = color.r;
      colors[idx * 3 + 1] = color.g;
      colors[idx * 3 + 2] = color.b;

      sizes[idx] = 0.03 + point.wetness * 0.02 * lifeRatio;
      alphas[idx] = point.wetness * lifeRatio * 0.8;
      wetnessAttr[idx] = point.wetness * lifeRatio;
    }

    // Clear remaining
    for (let i = this.mopTrailPoints.length; i < this.maxMopTrailPoints; i++) {
      alphas[i] = 0;
    }

    this.mopGeometry.attributes.position.needsUpdate = true;
    this.mopGeometry.attributes.color.needsUpdate = true;
    this.mopGeometry.attributes.size.needsUpdate = true;
    this.mopGeometry.attributes.alpha.needsUpdate = true;
    this.mopGeometry.attributes.wetness.needsUpdate = true;

    // Update wet surfaces
    this.updateWetSurfaces(delta);
  }

  private updateWetSurfaces(delta: number): void {
    for (const [key, data] of this.wetSurfaces.entries()) {
      data.life -= delta;
      data.wetness = THREE.MathUtils.lerp(data.wetness, 0, delta * 0.15);

      const material = data.mesh.material as THREE.MeshStandardMaterial;
      material.opacity = data.wetness * 0.4;

      // Shrink slightly
      const scale = 0.7 + data.wetness * 0.3;
      data.mesh.scale.setScalar(scale);

      if (data.life <= 0 || data.wetness < 0.05) {
        this.scene.remove(data.mesh);
        data.mesh.geometry.dispose();
        material.dispose();
        this.wetSurfaces.delete(key);
      }
    }
  }

  // === VACUUM SYSTEM ===

  private initVacuumSystem(): void {
    this.vacuumGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxVacuumParticles * 3);
    const colors = new Float32Array(this.maxVacuumParticles * 3);
    const sizes = new Float32Array(this.maxVacuumParticles);
    const alphas = new Float32Array(this.maxVacuumParticles);

    this.vacuumGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.vacuumGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.vacuumGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.vacuumGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    this.vacuumMaterial = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.vacuumPoints = new THREE.Points(this.vacuumGeometry, this.vacuumMaterial);
    this.vacuumPoints.frustumCulled = false;
    this.scene.add(this.vacuumPoints);
  }

  emitVacuum(position: THREE.Vector3, direction: THREE.Vector3, suctionPower = 1.0): void {
    // Emit particles being sucked IN
    const particleCount = Math.floor(4 + suctionPower * 4);

    for (let i = 0; i < particleCount; i++) {
      if (this.vacuumParticles.length >= this.maxVacuumParticles) break;

      // Particles start at distance and move toward vacuum
      const dist = 0.4 + Math.random() * 0.6;
      const startPos = position.clone().add(direction.clone().multiplyScalar(dist));

      // Add spread
      const spread = 0.15;
      startPos.add(
        new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread * 0.5,
          (Math.random() - 0.5) * spread
        )
      );

      const particle: VacuumParticle = {
        position: startPos,
        velocity: direction.clone().multiplyScalar(-4 - Math.random() * 6 * suctionPower),
        life: this.VACUUM_LIFE,
        maxLife: this.VACUUM_LIFE,
        size: 0.02 + Math.random() * 0.02,
        color: new THREE.Color().setHSL(
          0.58 + (Math.random() - 0.5) * 0.05,
          0.8,
          0.5 + Math.random() * 0.3
        ),
        targetPosition: position.clone(),
      };

      this.vacuumParticles.push(particle);
    }

    this.particleSystem.updateVacuum(position, direction, 0.016);
  }

  updateVacuum(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    delta: number,
    suctionPower = 1.0
  ): void {
    this.emitVacuum(position, direction, suctionPower);
    this.particleSystem.updateVacuum(position, direction, delta);
  }

  stopVacuum(): void {
    this.particleSystem.stopVacuum();
  }

  private updateVacuumParticles(delta: number): void {
    const positions = this.vacuumGeometry.attributes.position.array as Float32Array;
    const colors = this.vacuumGeometry.attributes.color.array as Float32Array;
    const sizes = this.vacuumGeometry.attributes.size.array as Float32Array;
    const alphas = this.vacuumGeometry.attributes.alpha.array as Float32Array;

    let activeIndex = 0;

    for (let i = this.vacuumParticles.length - 1; i >= 0; i--) {
      const particle = this.vacuumParticles[i];
      particle.life -= delta;

      if (particle.life <= 0) {
        this.vacuumParticles.splice(i, 1);
        continue;
      }

      // Strong attraction to vacuum nozzle
      const toTarget = particle.targetPosition.clone().sub(particle.position);
      const dist = toTarget.length();

      if (dist > 0.05) {
        const force = toTarget.normalize().multiplyScalar(20 * (1 + 1 / dist));
        particle.velocity.addScaledVector(force, delta);
      }

      // Turbulence
      particle.velocity.add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 1,
          (Math.random() - 0.5) * 2
        ).multiplyScalar(delta * 5)
      );

      // Drag
      particle.velocity.multiplyScalar(0.95);

      particle.position.addScaledVector(particle.velocity, delta);

      const lifeRatio = particle.life / particle.maxLife;
      positions[activeIndex * 3] = particle.position.x;
      positions[activeIndex * 3 + 1] = particle.position.y;
      positions[activeIndex * 3 + 2] = particle.position.z;

      colors[activeIndex * 3] = particle.color.r;
      colors[activeIndex * 3 + 1] = particle.color.g;
      colors[activeIndex * 3 + 2] = particle.color.b;

      sizes[activeIndex] = particle.size * lifeRatio;
      alphas[activeIndex] = lifeRatio * 0.9;

      activeIndex++;
    }

    for (let i = activeIndex; i < this.maxVacuumParticles; i++) {
      alphas[i] = 0;
    }

    this.vacuumGeometry.attributes.position.needsUpdate = true;
    this.vacuumGeometry.attributes.color.needsUpdate = true;
    this.vacuumGeometry.attributes.size.needsUpdate = true;
    this.vacuumGeometry.attributes.alpha.needsUpdate = true;
  }

  // === MAIN UPDATE ===

  update(delta: number): void {
    this.updateSprayDroplets(delta);
    this.updateMopTrail(delta);
    this.updateVacuumParticles(delta);
  }

  // === UTILITY ===

  getSprayDropletCount(): number {
    return this.sprayDroplets.length;
  }

  getMopTrailPointCount(): number {
    return this.mopTrailPoints.length;
  }

  getVacuumParticleCount(): number {
    return this.vacuumParticles.length;
  }

  getWetSurfaceCount(): number {
    return this.wetSurfaces.size;
  }

  dispose(): void {
    // Spray
    this.scene.remove(this.sprayPoints);
    this.sprayGeometry.dispose();
    this.sprayMaterial.dispose();
    this.sprayMaterial.alphaMap?.dispose();
    this.sprayDroplets = [];

    // Mop
    this.scene.remove(this.mopPoints);
    this.mopGeometry.dispose();
    this.mopMaterial.dispose();
    this.mopTrailPoints = [];

    // Wet surfaces
    this.wetSurfaces.forEach(data => {
      this.scene.remove(data.mesh);
      data.mesh.geometry.dispose();
      (data.mesh.material as THREE.Material).dispose();
    });
    this.wetSurfaces.clear();

    // Vacuum
    this.scene.remove(this.vacuumPoints);
    this.vacuumGeometry.dispose();
    this.vacuumMaterial.dispose();
    this.vacuumParticles = [];
  }
}
