import * as THREE from 'three';
import type { EconomySystem, FurnitureItem } from './EconomySystem.js';
import type { FurnitureManager } from './FurnitureManager.js';
import type { SceneManager } from './SceneManager.js';
import type { DiegeticHUD } from './DiegeticHUD.js';
import { audioManager } from './AudioManager.js';

export class ShopSystem {
  private sceneManager: SceneManager;
  private economySystem: EconomySystem;
  private furnitureManager: FurnitureManager;
  private hud: DiegeticHUD;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;

  // Shop UI state
  private shopGroup!: THREE.Group;
  private isOpen = false;
  private currentCategory: FurnitureItem['category'] = 'seating';
  private selectedItemIndex = 0;
  private categories: FurnitureItem['category'][] = [
    'seating',
    'storage',
    'decor',
    'lighting',
    'bed',
    'table',
  ];

  // Room floor reference for raycasting (used for category tab clicks)
  private floorMesh!: THREE.Mesh;

  // Raycaster for placement
  private raycaster = new THREE.Raycaster();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // UI elements
  private categoryTabs: THREE.Group[] = [];
  private itemCards: THREE.Group[] = [];
  private budgetDisplay!: THREE.Mesh;
  private promptDisplay!: THREE.Mesh;
  private placementPrompt: THREE.Mesh | null = null;

  constructor(
    sceneManager: SceneManager,
    economySystem: EconomySystem,
    furnitureManager: FurnitureManager,
    hud: DiegeticHUD
  ) {
    this.sceneManager = sceneManager;
    this.economySystem = economySystem;
    this.furnitureManager = furnitureManager;
    this.hud = hud;
    this.camera = sceneManager.camera;
    this.scene = sceneManager.scene;
    this.floorMesh = sceneManager.room.floor;

    this.createShopUI();
  }

  private createShopUI(): void {
    this.shopGroup = new THREE.Group();
    this.shopGroup.name = 'shopUI';
    this.shopGroup.visible = false;

    // Main panel - positioned in front of camera
    const panelWidth = 2.4;
    const panelHeight = 1.6;
    const panelDepth = 0.08;

    // Background panel
    const panelGeo = new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x0d0d10,
      roughness: 0.3,
      metalness: 0.7,
      transparent: true,
      opacity: 0.95,
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.z = -2;
    panel.position.y = -0.1;
    this.shopGroup.add(panel);

    // Border/frame
    const frameGeo = new THREE.BoxGeometry(
      panelWidth + 0.02,
      panelHeight + 0.02,
      panelDepth + 0.02
    );
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.5,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -2.01;
    frame.position.y = -0.1;
    this.shopGroup.add(frame);

    // Title
    const titleTex = this.createTextTexture('SHOP - FILTHY RICH', 0x2ecc71, 28);
    const titleGeo = new THREE.PlaneGeometry(1.8, 0.08);
    const titleMat = new THREE.MeshBasicMaterial({
      map: titleTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const title = new THREE.Mesh(titleGeo, titleMat);
    title.position.set(0, 0.65, -1.9);
    title.renderOrder = 100;
    this.shopGroup.add(title);

    // Budget display
    this.budgetDisplay = this.createBudgetDisplay();
    this.budgetDisplay.position.set(0.85, 0.65, -1.9);
    this.budgetDisplay.renderOrder = 100;
    this.shopGroup.add(this.budgetDisplay);

    // Category tabs
    this.createCategoryTabs(panelWidth);

    // Item grid
    this.createItemGrid();

    // Close hint
    const closeTex = this.createTextTexture('[Tab] Close  [Esc] Cancel', 0x888888, 14);
    const closeGeo = new THREE.PlaneGeometry(1.5, 0.05);
    const closeMat = new THREE.MeshBasicMaterial({
      map: closeTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const close = new THREE.Mesh(closeGeo, closeMat);
    close.position.set(0, -0.75, -1.9);
    close.renderOrder = 100;
    this.shopGroup.add(close);

    this.camera.add(this.shopGroup);
  }

  private createCategoryTabs(panelWidth: number): void {
    const tabWidth = panelWidth / this.categories.length - 0.02;
    const startX = -panelWidth / 2 + tabWidth / 2 + 0.05;

    this.categories.forEach((cat, i) => {
      const tabGroup = new THREE.Group();

      const tabGeo = new THREE.BoxGeometry(tabWidth, 0.07, 0.02);
      const tabMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a20,
        roughness: 0.4,
        metalness: 0.6,
      });
      const tab = new THREE.Mesh(tabGeo, tabMat);
      tabGroup.add(tab);

      const labelTex = this.createTextTexture(cat.toUpperCase(), 0xcccccc, 12);
      const labelGeo = new THREE.PlaneGeometry(tabWidth * 0.9, 0.04);
      const labelMat = new THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const label = new THREE.Mesh(labelGeo, labelMat);
      label.position.z = 0.015;
      label.renderOrder = 101;
      tabGroup.add(label);

      tabGroup.position.set(startX + i * (tabWidth + 0.02), 0.45, -1.9);
      tabGroup.userData = { category: cat, index: i };
      this.shopGroup.add(tabGroup);
      this.categoryTabs.push(tabGroup);
    });

    this.updateCategoryTabs();
  }

  private createItemGrid(): void {
    // Clear existing items
    this.itemCards.forEach(card => {
      this.shopGroup.remove(card);
      this.disposeGroup(card);
    });
    this.itemCards = [];

    // Filter items by reputation level
    const reputationLevel = this.getReputationLevel();
    const allItems = this.economySystem.getCatalogByCategory(this.currentCategory);
    const items = allItems.filter(item => {
      if (!item.unlocksAtReputationLevel) return true;
      return reputationLevel >= item.unlocksAtReputationLevel;
    });

    const cols = 3;
    const rows = 2;
    const cardWidth = 0.65;
    const cardHeight = 0.45;
    const startX = -0.7;
    const startY = 0.2;

    items.forEach((item, index) => {
      if (index >= cols * rows) return;

      const col = index % cols;
      const row = Math.floor(index / cols);

      const cardGroup = new THREE.Group();

      // Card background
      const cardGeo = new THREE.BoxGeometry(cardWidth, cardHeight, 0.03);
      const isOwned = this.economySystem.ownItem(item.id);
      const canAfford = this.economySystem.canAfford(item.price);
      const isLocked =
        item.unlocksAtReputationLevel && reputationLevel < item.unlocksAtReputationLevel;
      const cardColor = isLocked ? 0x1a1a1a : isOwned ? 0x1a3a1a : canAfford ? 0x1a1a2a : 0x3a1a1a;
      const cardMat = new THREE.MeshStandardMaterial({
        color: cardColor,
        roughness: 0.4,
        metalness: 0.6,
        transparent: true,
        opacity: isLocked ? 0.5 : 0.9,
      });
      const card = new THREE.Mesh(cardGeo, cardMat);
      cardGroup.add(card);

      // Highlight if selected
      const highlightGeo = new THREE.BoxGeometry(cardWidth + 0.02, cardHeight + 0.02, 0.035);
      const highlightMat = new THREE.MeshStandardMaterial({
        color: 0x2ecc71,
        roughness: 0.2,
        metalness: 0.8,
        transparent: true,
        opacity: 0,
      });
      const highlight = new THREE.Mesh(highlightGeo, highlightMat);
      cardGroup.add(highlight);
      cardGroup.userData.highlight = highlight;

      // Emoji/Icon
      const iconTex = this.createTextTexture(item.emoji, 0xffffff, 36);
      const iconGeo = new THREE.PlaneGeometry(0.15, 0.15);
      const iconMat = new THREE.MeshBasicMaterial({
        map: iconTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const icon = new THREE.Mesh(iconGeo, iconMat);
      icon.position.set(0, 0.1, 0.02);
      icon.renderOrder = 101;
      cardGroup.add(icon);

      // Name
      const nameTex = this.createTextTexture(item.name, 0xffffff, 13);
      const nameGeo = new THREE.PlaneGeometry(cardWidth * 0.9, 0.05);
      const nameMat = new THREE.MeshBasicMaterial({
        map: nameTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const name = new THREE.Mesh(nameGeo, nameMat);
      name.position.set(0, -0.02, 0.02);
      name.renderOrder = 101;
      cardGroup.add(name);

      // Price
      const priceText = isLocked
        ? `LOCKED (Lvl ${item.unlocksAtReputationLevel})`
        : isOwned
          ? 'OWNED'
          : `£${item.price.toLocaleString()}`;
      const priceColor = isLocked ? 0x666666 : isOwned ? 0x2ecc71 : canAfford ? 0xffffff : 0xff6666;
      const priceTex = this.createTextTexture(priceText, priceColor, 12);
      const priceGeo = new THREE.PlaneGeometry(cardWidth * 0.9, 0.05);
      const priceMat = new THREE.MeshBasicMaterial({
        map: priceTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const price = new THREE.Mesh(priceGeo, priceMat);
      price.position.set(0, -0.12, 0.02);
      price.renderOrder = 101;
      cardGroup.add(price);

      // Description (shortened)
      const descText =
        item.description.length > 40 ? item.description.slice(0, 37) + '...' : item.description;
      const descTex = this.createTextTexture(descText, 0x888888, 10);
      const descGeo = new THREE.PlaneGeometry(cardWidth * 0.9, 0.04);
      const descMat = new THREE.MeshBasicMaterial({
        map: descTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const desc = new THREE.Mesh(descGeo, descMat);
      desc.position.set(0, -0.2, 0.02);
      desc.renderOrder = 101;
      cardGroup.add(desc);

      cardGroup.position.set(
        startX + col * (cardWidth + 0.05),
        startY - row * (cardHeight + 0.05),
        -1.9
      );
      cardGroup.userData = { item, index, isOwned, canAfford, isLocked, highlight };
      this.shopGroup.add(cardGroup);
      this.itemCards.push(cardGroup);
    });

    this.updateItemSelection();
  }

  private createBudgetDisplay(): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = '700 28px "Space Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2ecc71';
    ctx.fillText(`£${this.economySystem.budget.toLocaleString()}`, 250, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;

    const geo = new THREE.PlaneGeometry(0.6, 0.15);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    return new THREE.Mesh(geo, mat);
  }

  private updateBudgetDisplay(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = '700 28px "Space Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2ecc71';
    ctx.fillText(`£${this.economySystem.budget.toLocaleString()}`, 250, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;

    if (this.budgetDisplay.material instanceof THREE.MeshBasicMaterial) {
      this.budgetDisplay.material.map?.dispose();
      this.budgetDisplay.material.map = tex;
      this.budgetDisplay.material.needsUpdate = true;
    }
  }

  private createTextTexture(text: string, color = 0xffffff, size = 18): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `${size < 20 ? '500' : '700'} ${size}px "Space Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private updateCategoryTabs(): void {
    this.categoryTabs.forEach((tab, i) => {
      const isSelected = this.categories[i] === this.currentCategory;
      const tabMesh = tab.children[0] as THREE.Mesh;
      const label = tab.children[1] as THREE.Mesh;

      if (tabMesh.material instanceof THREE.MeshStandardMaterial) {
        tabMesh.material.color.set(isSelected ? 0x2ecc71 : 0x1a1a20);
        tabMesh.material.emissive = isSelected
          ? new THREE.Color(0x2ecc71)
          : new THREE.Color(0x000000);
        tabMesh.material.emissiveIntensity = isSelected ? 0.3 : 0;
        tabMesh.material.needsUpdate = true;
      }
      if (label.material instanceof THREE.MeshBasicMaterial && label.material.map) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        ctx.font = '700 16px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isSelected ? '#0d0d10' : '#cccccc';
        ctx.fillText(this.categories[i].toUpperCase(), 256, 64);
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        label.material.map?.dispose();
        label.material.map = tex;
        label.material.needsUpdate = true;
      }
    });
  }

  private updateItemSelection(): void {
    this.itemCards.forEach((card, i) => {
      const highlight = card.userData.highlight as THREE.Mesh;
      const isSelected = i === this.selectedItemIndex;

      if (highlight.material instanceof THREE.MeshStandardMaterial) {
        highlight.material.opacity = isSelected ? 0.6 : 0;
        highlight.material.needsUpdate = true;
      }
    });
  }

  private setCategory(category: FurnitureItem['category']): void {
    if (this.currentCategory !== category) {
      this.currentCategory = category;
      this.selectedItemIndex = 0;
      this.updateCategoryTabs();
      this.createItemGrid();
      audioManager.play('click', { volume: 0.3, pitch: 1.1 });
    }
  }

  private selectItem(index: number): void {
    if (index >= 0 && index < this.itemCards.length) {
      this.selectedItemIndex = index;
      this.updateItemSelection();
      audioManager.play('click', { volume: 0.2 });
    }
  }

  private purchaseSelected(): void {
    const card = this.itemCards[this.selectedItemIndex];
    if (!card) return;

    const item = card.userData.item as FurnitureItem;
    const isOwned = card.userData.isOwned;
    const canAfford = card.userData.canAfford;
    const isLocked = card.userData.isLocked;

    if (isLocked) {
      audioManager.play('buzz', { volume: 0.5 });
      this.sceneManager.addHitPause(0.05);
      this.hud.showPrompt(
        `LOCKED — Reach Reputation Level ${item.unlocksAtReputationLevel} to unlock`
      );
      setTimeout(() => {
        this.hud.hidePrompt();
      }, 3000);
      return;
    }

    if (isOwned) {
      // Enter placement mode using FurnitureManager's new system
      this.close();
      this.furnitureManager.startPlacement(item);
    } else if (canAfford) {
      // Purchase
      if (this.economySystem.purchaseItem(item.id)) {
        audioManager.play('cash_register', { volume: 0.6 });
        this.sceneManager.addHitPause(0.1);
        this.sceneManager.addScreenShake(0.08, 0.75);
        this.updateBudgetDisplay();
        this.createItemGrid(); // Refresh to show OWNED
      } else {
        audioManager.play('buzz', { volume: 0.5 });
      }
    } else {
      audioManager.play('buzz', { volume: 0.5 });
      this.sceneManager.addHitPause(0.05);
      this.sceneManager.addScreenShake(0.04, 0.6);
    }
  }

  private getReputationLevel(): number {
    // Get reputation level from job system via window reference
    // This will be set by Game.ts after initialization
    return (window as any).__jobSystem?.getReputation?.().level || 1;
  }

  // Public API
  open(): void {
    if (!this.isOpen) {
      this.isOpen = true;
      this.shopGroup.visible = true;
      this.updateBudgetDisplay();
      this.createItemGrid();
      this.updateCategoryTabs();
    }
  }

  close(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.shopGroup.visible = false;
    }
  }

  isShopOpen(): boolean {
    return this.isOpen;
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.isOpen) return false;

    switch (event.key) {
      case 'Tab':
      case 'Escape':
        this.close();
        return true;
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
        const catIndex = parseInt(event.key) - 1;
        if (catIndex >= 0 && catIndex < this.categories.length) {
          this.setCategory(this.categories[catIndex]);
        }
        return true;
      case 'ArrowLeft':
        this.selectItem(Math.max(0, this.selectedItemIndex - 1));
        return true;
      case 'ArrowRight':
        this.selectItem(Math.min(this.itemCards.length - 1, this.selectedItemIndex + 1));
        return true;
      case 'ArrowUp':
        this.selectItem(Math.max(0, this.selectedItemIndex - 3));
        return true;
      case 'ArrowDown':
        this.selectItem(Math.min(this.itemCards.length - 1, this.selectedItemIndex + 3));
        return true;
      case 'Enter':
      case ' ':
        this.purchaseSelected();
        return true;
    }
    return false;
  }

  handleMouseDown(event: MouseEvent): boolean {
    if (!this.isOpen) return false;

    // Check if clicking on category tab
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.categoryTabs, true);
    if (intersects.length > 0) {
      const tab = intersects[0].object.parent as THREE.Group | null;
      if (tab?.userData?.category) {
        this.setCategory(tab.userData.category);
      }
      return true;
    }

    // Check if clicking on item card
    const itemIntersects = this.raycaster.intersectObjects(this.itemCards, true);
    if (itemIntersects.length > 0) {
      const card = itemIntersects[0].object.parent as THREE.Group;
      if (card && card.userData?.index !== undefined) {
        this.selectItem(card.userData.index);
        this.purchaseSelected();
      }
      return true;
    }

    return false;
  }

  handleWheel(event: WheelEvent): boolean {
    if (!this.isOpen) return false;
    return false;
  }

  update(delta: number): void {
    // Animate shop UI
    if (this.isOpen && this.shopGroup.visible) {
      const time = performance.now() * 0.001;
      this.shopGroup.rotation.y = Math.sin(time * 0.5) * 0.01;
      this.shopGroup.position.y = Math.sin(time * 1.2) * 0.005;
    }
  }

  private disposeGroup(obj: THREE.Object3D): void {
    obj.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  dispose(): void {
    this.camera.remove(this.shopGroup);
    this.disposeGroup(this.shopGroup);
  }

  // Refresh the catalog (e.g., after reputation unlock)
  refreshCatalog(): void {
    if (this.isOpen) {
      this.createItemGrid();
      this.updateCategoryTabs();
      this.updateBudgetDisplay();
    }
  }

  // Enable/disable the shop system based on game state
  setEnabled(enabled: boolean): void {
    if (!enabled && this.isOpen) {
      this.close();
    }
  }
}
