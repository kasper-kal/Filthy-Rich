import * as THREE from 'three';

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: THREE.Points[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.PointsMaterial[] = [];

  // Continuous effects
  private sprayCone: THREE.Mesh | null = null;
  private mopTrail: THREE.Points | null = null;
  private mopTrailPositions: Float32Array | null = null;
  private vacuumCone: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createContinuousEffects();
  }

  private createContinuousEffects(): void {
    // Spray cone geometry
    const sprayGeo = new THREE.ConeGeometry(0.08, 0.5, 8, 1, true);
    const sprayMat = new THREE.MeshBasicMaterial({
      color: 0x66aaff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.sprayCone = new THREE.Mesh(sprayGeo, sprayMat);
    this.scene.add(this.sprayCone);

    // Mop trail (line of particles)
    const trailCount = 50;
    const trailGeo = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(trailCount * 3);
    const trailColors = new Float32Array(trailCount * 3);
    const trailSizes = new Float32Array(trailCount);
    const trailAlphas = new Float32Array(trailCount);

    for (let i = 0; i < trailCount; i++) {
      trailPositions[i * 3] = 0;
      trailPositions[i * 3 + 1] = 0;
      trailPositions[i * 3 + 2] = 0;
      trailColors[i * 3] = 0.6;
      trailColors[i * 3 + 1] = 0.7;
      trailColors[i * 3 + 2] = 0.9;
      trailSizes[i] = 0.04;
      trailAlphas[i] = 0;
    }

    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
    trailGeo.setAttribute('size', new THREE.BufferAttribute(trailSizes, 1));
    trailGeo.setAttribute('alpha', new THREE.BufferAttribute(trailAlphas, 1));

    const trailMat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.mopTrail = new THREE.Points(trailGeo, trailMat);
    this.mopTrailPositions = trailPositions;
    this.scene.add(this.mopTrail);

    // Vacuum suction cone
    const vacGeo = new THREE.ConeGeometry(0.15, 0.8, 12, 1, true);
    const vacMat = new THREE.MeshBasicMaterial({
      color: 0x88ffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.vacuumCone = new THREE.Mesh(vacGeo, vacMat);
    this.scene.add(this.vacuumCone);
  }

  // === SPRAY ===
  startSpray(position: THREE.Vector3, direction: THREE.Vector3): void {
    if (this.sprayCone) {
      this.sprayCone.position.copy(position);
      this.sprayCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      this.sprayCone.scale.set(1, 1, 1);
      (this.sprayCone.material as THREE.MeshBasicMaterial).opacity = 0.3;
    }
  }

  updateSpray(position: THREE.Vector3, direction: THREE.Vector3, delta: number): void {
    if (this.sprayCone) {
      this.sprayCone.position.lerp(position, 10 * delta);
      this.sprayCone.quaternion.slerp(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction),
        15 * delta
      );
      (this.sprayCone.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp(
        (this.sprayCone.material as THREE.MeshBasicMaterial).opacity,
        0.4,
        10 * delta
      );

      // Emit spray particles continuously
      if (Math.random() < 0.4) {
        this.emitSprayParticle(position, direction);
      }
    }
  }

  stopSpray(): void {
    if (this.sprayCone) {
      (this.sprayCone.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  private emitSprayParticle(position: THREE.Vector3, direction: THREE.Vector3): void {
    const count = 3;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const spread = 0.12;
      const vel = direction.clone().multiplyScalar(4 + Math.random() * 3);
      vel.add(
        new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread
        )
      );
      velocities.push(vel);

      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const color = new THREE.Color().setHSL(
        0.55 + (Math.random() - 0.5) * 0.05,
        0.8,
        0.65 + Math.random() * 0.2
      );
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.02 + Math.random() * 0.015;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData = { velocities, life: 0.4, maxLife: 0.4, type: 'spray' };
    this.scene.add(particles);
    this.particles.push(particles);
    this.geometries.push(geometry);
    this.materials.push(material);
  }

  // === MOP ===
  startMopTrail(position: THREE.Vector3): void {
    if (this.mopTrail) {
      const mat = this.mopTrail.material as THREE.PointsMaterial;
      mat.opacity = 0.8;
    }
  }

  updateMopTrail(position: THREE.Vector3): void {
    if (!this.mopTrail || !this.mopTrailPositions) return;

    // Shift positions back
    const count = this.mopTrailPositions.length / 3;
    for (let i = count - 1; i > 0; i--) {
      this.mopTrailPositions[i * 3] = this.mopTrailPositions[(i - 1) * 3];
      this.mopTrailPositions[i * 3 + 1] = this.mopTrailPositions[(i - 1) * 3 + 1];
      this.mopTrailPositions[i * 3 + 2] = this.mopTrailPositions[(i - 1) * 3 + 2];
    }

    // Add new position at front with slight randomness
    this.mopTrailPositions[0] = position.x + (Math.random() - 0.5) * 0.04;
    this.mopTrailPositions[1] = position.y + 0.01;
    this.mopTrailPositions[2] = position.z + (Math.random() - 0.5) * 0.04;

    // Update alphas (fade towards end)
    const alphas = this.mopTrail.geometry.attributes.alpha.array as Float32Array;
    for (let i = 0; i < count; i++) {
      alphas[i] = (1 - i / count) * 0.6;
    }

    this.mopTrail.geometry.attributes.position.needsUpdate = true;
    this.mopTrail.geometry.attributes.alpha.needsUpdate = true;
  }

  stopMopTrail(): void {
    if (this.mopTrail) {
      const mat = this.mopTrail.material as THREE.PointsMaterial;
      mat.opacity = 0;
    }
  }

  // === VACUUM ===
  startVacuum(position: THREE.Vector3, direction: THREE.Vector3): void {
    if (this.vacuumCone) {
      this.vacuumCone.position.copy(position);
      this.vacuumCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      (this.vacuumCone.material as THREE.MeshBasicMaterial).opacity = 0.25;
    }
  }

  updateVacuum(position: THREE.Vector3, direction: THREE.Vector3, delta: number): void {
    if (this.vacuumCone) {
      this.vacuumCone.position.lerp(position, 10 * delta);
      this.vacuumCone.quaternion.slerp(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction),
        15 * delta
      );
      (this.vacuumCone.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp(
        (this.vacuumCone.material as THREE.MeshBasicMaterial).opacity,
        0.35,
        10 * delta
      );

      // Suction particles
      if (Math.random() < 0.3) {
        this.emitVacuumParticle(position, direction);
      }
    }
  }

  stopVacuum(): void {
    if (this.vacuumCone) {
      (this.vacuumCone.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  private emitVacuumParticle(position: THREE.Vector3, direction: THREE.Vector3): void {
    const count = 4;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      // Particles moving TOWARDS the vacuum
      const vel = direction.clone().multiplyScalar(-3 - Math.random() * 4);
      vel.add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        )
      );
      velocities.push(vel);

      const dist = 0.3 + Math.random() * 0.5;
      const startPos = position.clone().add(direction.clone().multiplyScalar(dist));

      positions[i * 3] = startPos.x;
      positions[i * 3 + 1] = startPos.y;
      positions[i * 3 + 2] = startPos.z;

      const color = new THREE.Color().setHSL(
        0.58 + (Math.random() - 0.5) * 0.03,
        0.9,
        0.55 + Math.random() * 0.2
      );
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.03 + Math.random() * 0.02;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData = { velocities, life: 0.3, maxLife: 0.3, type: 'vacuum' };
    this.scene.add(particles);
    this.particles.push(particles);
    this.geometries.push(geometry);
    this.materials.push(material);
  }

  // === TRASH ===
  emitTrashCollected(position: THREE.Vector3): void {
    const count = 18;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 4;
      velocities.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed * 1.5,
          Math.sin(phi) * Math.sin(theta) * speed
        )
      );

      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      // Trash colors - browns, greys, whites
      const trashColors = [
        new THREE.Color(0x8b6914), // cardboard
        new THREE.Color(0x88aa88), // can
        new THREE.Color(0xf5e6c8), // bag
        new THREE.Color(0xffddaa), // wrapper
        new THREE.Color(0xffffff), // tissue
        new THREE.Color(0x4488aa), // bottle
        new THREE.Color(0xcc8866), // magazine
        new THREE.Color(0x666688), // sock
      ];
      const color = trashColors[Math.floor(Math.random() * trashColors.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.06 + Math.random() * 0.05;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData = { velocities, life: 1.2, maxLife: 1.2, type: 'trash' };
    this.scene.add(particles);
    this.particles.push(particles);
    this.geometries.push(geometry);
    this.materials.push(material);
  }

  // === SCRUB (legacy burst) ===
  emitScrub(position: THREE.Vector3, tool: string): void {
    const count = 8;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities: THREE.Vector3[] = [];

    const toolColors: Record<string, { h: number; s: number; l: number }> = {
      spray: { h: 0.55, s: 0.8, l: 0.7 },
      mop: { h: 0.35, s: 0.6, l: 0.5 },
      vacuum: { h: 0.65, s: 0.9, l: 0.6 },
    };

    const colorConfig = toolColors[tool] || { h: 0.5, s: 0.5, l: 0.5 };

    for (let i = 0; i < count; i++) {
      const spread = 0.2;
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          Math.random() * 2 + 0.5,
          (Math.random() - 0.5) * spread
        )
      );

      positions[i * 3] = position.x + (Math.random() - 0.5) * 0.1;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.1;

      const color = new THREE.Color().setHSL(
        colorConfig.h + (Math.random() - 0.5) * 0.1,
        colorConfig.s,
        colorConfig.l + (Math.random() - 0.5) * 0.2
      );
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.03 + Math.random() * 0.02;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData = { velocities, life: 0.6, maxLife: 0.6, type: 'scrub' };
    this.scene.add(particles);
    this.particles.push(particles);
    this.geometries.push(geometry);
    this.materials.push(material);
  }

  // === STAIN CLEANED ===
  emitStainCleaned(position: THREE.Vector3): void {
    const count = 30;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      velocities.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed * 1.2,
          Math.sin(phi) * Math.sin(theta) * speed
        )
      );

      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      // Clean sparkle - gold/green/white
      const color = new THREE.Color().setHSL(
        0.13 + Math.random() * 0.15,
        0.8,
        0.65 + Math.random() * 0.25
      );
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.05 + Math.random() * 0.04;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData = { velocities, life: 1.5, maxLife: 1.5, type: 'clean' };
    this.scene.add(particles);
    this.particles.push(particles);
    this.geometries.push(geometry);
    this.materials.push(material);

    // Secondary ring burst
    this.emitRingBurst(position);
  }

  private emitRingBurst(position: THREE.Vector3): void {
    const count = 16;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2.5;
      velocities.push(
        new THREE.Vector3(
          Math.cos(angle) * speed,
          (Math.random() - 0.5) * 1,
          Math.sin(angle) * speed
        )
      );

      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y + 0.02;
      positions[i * 3 + 2] = position.z;

      const color = new THREE.Color().setHSL(0.15, 1, 0.7);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.06;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData = { velocities, life: 0.8, maxLife: 0.8, type: 'ring' };
    this.scene.add(particles);
    this.particles.push(particles);
    this.geometries.push(geometry);
    this.materials.push(material);
  }

  // === FURNITURE PLACED ===
  emitFurniturePlaced(position: THREE.Vector3): void {
    const count = 20;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      velocities.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed * 2,
          Math.sin(phi) * Math.sin(theta) * speed
        )
      );

      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const color = new THREE.Color().setHSL(
        0.1 + Math.random() * 0.1,
        0.7,
        0.65 + Math.random() * 0.2
      );
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.08 + Math.random() * 0.06;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData = { velocities, life: 1.2, maxLife: 1.2, type: 'furniture' };
    this.scene.add(particles);
    this.particles.push(particles);
    this.geometries.push(geometry);
    this.materials.push(material);
  }

  update(delta: number): void {
    // Update continuous effects
    if (this.mopTrail && (this.mopTrail.material as THREE.PointsMaterial).opacity > 0) {
      const alphas = this.mopTrail.geometry.attributes.alpha.array as Float32Array;
      for (let i = 0; i < alphas.length; i++) {
        alphas[i] *= 0.95;
      }
      this.mopTrail.geometry.attributes.alpha.needsUpdate = true;
    }

    // Update burst particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particles = this.particles[i];
      const data = particles.userData;
      data.life -= delta;

      if (data.life <= 0) {
        this.scene.remove(particles);
        this.geometries[i].dispose();
        this.materials[i].dispose();
        this.particles.splice(i, 1);
        this.geometries.splice(i, 1);
        this.materials.splice(i, 1);
        continue;
      }

      const positions = particles.geometry.attributes.position.array as Float32Array;
      const count = positions.length / 3;
      const lifeRatio = data.life / data.maxLife;

      for (let j = 0; j < count; j++) {
        const vel = data.velocities[j];
        positions[j * 3] += vel.x * delta;
        positions[j * 3 + 1] += vel.y * delta;
        positions[j * 3 + 2] += vel.z * delta;

        // Gravity varies by type
        let gravity = 9.8 * 0.3;
        if (data.type === 'spray') gravity *= 0.5;
        if (data.type === 'vacuum') gravity *= 0.1;
        if (data.type === 'clean' || data.type === 'ring') gravity *= 0.4;
        vel.y -= gravity * delta;

        // Drag
        vel.x *= 0.98;
        vel.z *= 0.98;

        // Fade
        const mat = particles.material as THREE.PointsMaterial;
        if (data.type === 'scrub' || data.type === 'spray') {
          mat.opacity = lifeRatio * 0.9;
        } else if (data.type === 'vacuum') {
          mat.opacity = lifeRatio * 0.8;
        } else {
          mat.opacity = lifeRatio;
        }

        // Shrink
        const sizes = particles.geometry.attributes.size.array as Float32Array;
        sizes[j] *= 0.97;
      }

      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.size.needsUpdate = true;
    }
  }

  dispose(): void {
    this.particles.forEach((particles, i) => {
      this.scene.remove(particles);
      this.geometries[i].dispose();
      this.materials[i].dispose();
    });
    this.particles = [];
    this.geometries = [];
    this.materials = [];

    if (this.sprayCone) {
      this.scene.remove(this.sprayCone);
      this.sprayCone.geometry.dispose();
      (this.sprayCone.material as THREE.Material).dispose();
    }
    if (this.mopTrail) {
      this.scene.remove(this.mopTrail);
      this.mopTrail.geometry.dispose();
      (this.mopTrail.material as THREE.Material).dispose();
    }
    if (this.vacuumCone) {
      this.scene.remove(this.vacuumCone);
      this.vacuumCone.geometry.dispose();
      (this.vacuumCone.material as THREE.Material).dispose();
    }
  }
}
