import * as THREE from 'three';

interface TrashType {
  name: string;
  color: number;
  size: [number, number, number];
  mass: number;
}

export class TrashItem {
  public mesh!: THREE.Mesh;
  public collected = false;
  public type!: TrashType;
  public value = 0;

  private bobPhase = 0;
  private bobSpeed = 0;
  private highlightMaterial!: THREE.MeshStandardMaterial;
  private originalMaterial!: THREE.MeshStandardMaterial;

  constructor(type: TrashType, position: { x: number; z: number; rotation: number }) {
    this.type = type;
    this.value = Math.round(type.mass * 100 + Math.random() * 20);

    this.createMesh(position);
    this.bobPhase = Math.random() * Math.PI * 2;
    this.bobSpeed = 0.5 + Math.random() * 0.5;
  }

  private createMesh(position: { x: number; z: number; rotation: number }): void {
    const [w, h, d] = this.type.size;

    // Create varied geometry based on type
    let geometry: THREE.BufferGeometry;

    switch (this.type.name) {
      case 'pizza_box':
        geometry = new THREE.BoxGeometry(w, h, d);
        break;
      case 'beer_can':
      case 'bottle':
        geometry = new THREE.CylinderGeometry(w / 2, w / 2, h, 12);
        break;
      case 'takeout_bag':
        geometry = new THREE.BoxGeometry(w, h, d);
        break;
      case 'condom_wrapper':
        geometry = new THREE.PlaneGeometry(w, d);
        break;
      case 'tissue':
        geometry = new THREE.PlaneGeometry(w, d);
        break;
      case 'magazine':
        geometry = new THREE.BoxGeometry(w, h, d);
        break;
      case 'sock':
        geometry = new THREE.CapsuleGeometry(w / 2, h, 4, 8);
        break;
      case 'food_container':
        geometry = new THREE.BoxGeometry(w, h, d);
        break;
      case 'hair_clump':
        geometry = new THREE.SphereGeometry(w / 2, 6, 6);
        break;
      default:
        geometry = new THREE.BoxGeometry(w, h, d);
    }

    this.originalMaterial = new THREE.MeshStandardMaterial({
      color: this.type.color,
      roughness: 0.7,
      metalness: 0.1,
    });

    this.highlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff88,
      emissive: 0xffff88,
      emissiveIntensity: 0.3,
      roughness: 0.5,
      metalness: 0.2,
    });

    this.mesh = new THREE.Mesh(geometry, this.originalMaterial);
    this.mesh.position.set(position.x, h / 2 + 0.01, position.z);
    this.mesh.rotation.y = position.rotation;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = `trash_${this.type.name}`;

    // Add slight random tilt for realism
    this.mesh.rotation.x = (Math.random() - 0.5) * 0.3;
    this.mesh.rotation.z = (Math.random() - 0.5) * 0.3;
  }

  update(delta: number): void {
    if (this.collected) return;

    // Gentle bob animation
    this.bobPhase += delta * this.bobSpeed;
    this.mesh.position.y = this.type.size[1] / 2 + 0.01 + Math.sin(this.bobPhase) * 0.02;

    // Slow rotation
    this.mesh.rotation.y += delta * 0.15;
  }

  setHighlighted(highlighted: boolean): void {
    if (this.collected) return;
    this.mesh.material = highlighted ? this.highlightMaterial : this.originalMaterial;
  }

  collect(): void {
    this.collected = true;
    this.mesh.material = this.originalMaterial;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.originalMaterial.dispose();
    this.highlightMaterial.dispose();
  }
}
