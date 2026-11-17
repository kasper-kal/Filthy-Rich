import * as THREE from 'three';
import type {
  Part,
  PartCondition,
  PartCatalogue,
  ToolRequirement,
} from '../vehicle/RepairSystem.js';
import type { SubsystemName } from '../vehicle/DamageModel.js';

/**
 * PartSystem - Parts management, inventory, pricing, compatibility, wear tracking
 * Handles parts purchasing, storage, condition tracking, and installation
 */

// ============================================
// PLAYER INVENTORY
// ============================================

export interface InventoryPart {
  part: Part;
  quantity: number;
  purchasePrice: number;
  purchaseDate: number;
  location: 'garage' | 'van' | 'mobile_toolbox';
}

export interface PartsInventory {
  parts: Map<string, InventoryPart>;
  maxWeight: number; // kg
  currentWeight: number;
  storageLocations: Map<string, string[]>; // location -> part IDs
}

const DEFAULT_INVENTORY: PartsInventory = {
  parts: new Map(),
  maxWeight: 50,
  currentWeight: 0,
  storageLocations: new Map([
    ['garage', []],
    ['van', []],
    ['mobile_toolbox', []],
  ]),
};

// ============================================
// PARTS MANAGER
// ============================================

export class PartsManager {
  private catalogue: PartCatalogue;
  private inventory: PartsInventory;
  private money = 0;

  // Price multipliers
  private conditionPriceMultipliers: Record<PartCondition, number> = {
    new: 1.0,
    refurbished: 0.65,
    used: 0.4,
    scrapyard: 0.15,
  };

  private conditionReliabilityMultipliers: Record<PartCondition, number> = {
    new: 1.0,
    refurbished: 0.85,
    used: 0.6,
    scrapyard: 0.3,
  };

  // Callbacks
  onInventoryChange?: () => void;
  onMoneyChange?: (money: number) => void;

  constructor(catalogue: PartCatalogue) {
    this.catalogue = catalogue;
    this.inventory = { ...DEFAULT_INVENTORY };
    // Initialize storage locations
    this.inventory.storageLocations = new Map([
      ['garage', []],
      ['van', []],
      ['mobile_toolbox', []],
    ]);
  }

  /**
   * Set player money
   */
  setMoney(amount: number): void {
    this.money = Math.max(0, amount);
    this.onMoneyChange?.(this.money);
  }

  getMoney(): number {
    return this.money;
  }

  addMoney(amount: number): void {
    this.money = Math.max(0, this.money + amount);
    this.onMoneyChange?.(this.money);
  }

  /**
   * Purchase part from catalogue
   */
  purchasePart(
    partId: string,
    condition: PartCondition = 'new',
    quantity = 1,
    destination: 'garage' | 'van' | 'mobile_toolbox' = 'garage'
  ): InventoryPart | null {
    const cataloguePart = this.catalogue.getPart(partId);
    if (!cataloguePart) return null;

    // Check stock
    if (condition === 'new' && cataloguePart.stock < quantity) return null;

    const price = Math.round(
      cataloguePart.priceNew * this.conditionPriceMultipliers[condition] * quantity
    );
    if (this.money < price) return null;

    // Check weight capacity
    const weightPerUnit = this.estimatePartWeight(cataloguePart);
    if (this.inventory.currentWeight + weightPerUnit * quantity > this.inventory.maxWeight)
      return null;

    // Deduct money
    this.money -= price;
    this.onMoneyChange?.(this.money);

    // Reduce catalogue stock for new parts
    if (condition === 'new') {
      cataloguePart.stock -= quantity;
    }

    // Add to inventory
    const invPart: InventoryPart = {
      part: { ...cataloguePart, condition },
      quantity,
      purchasePrice: price,
      purchaseDate: Date.now(),
      location: destination,
    };

    const existing = this.inventory.parts.get(partId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.inventory.parts.set(partId, invPart);
    }

    this.inventory.currentWeight += weightPerUnit * quantity;
    this.inventory.storageLocations.get(destination)?.push(partId);

    this.onInventoryChange?.();
    return invPart;
  }

  /**
   * Estimate part weight from category/size
   */
  private estimatePartWeight(part: Part): number {
    const weights: Record<string, number> = {
      engine_block: 25,
      engine_head: 18,
      turbocharger: 8,
      fuel_system: 2,
      ignition_system: 0.5,
      cooling_system: 5,
      oil_system: 1,
      gearbox: 45,
      clutch: 15,
      differential: 20,
      driveshafts: 6,
      brakes_front: 8,
      brakes_rear: 6,
      suspension_front: 10,
      suspension_rear: 8,
      steering: 7,
      electrical: 3,
      exhaust: 8,
      transmission_mounts: 2,
      body_structure: 12,
    };
    return weights[part.category] || 2;
  }

  /**
   * Sell part back (for fraction of price)
   */
  sellPart(partId: string, quantity = 1): number {
    const invPart = this.inventory.parts.get(partId);
    if (!invPart || invPart.quantity < quantity) return 0;

    const sellPrice = Math.round(
      invPart.part.priceNew *
        this.conditionPriceMultipliers[invPart.part.condition] *
        0.4 *
        quantity
    );
    this.money += sellPrice;
    this.onMoneyChange?.(this.money);

    invPart.quantity -= quantity;
    this.inventory.currentWeight -= this.estimatePartWeight(invPart.part) * quantity;

    if (invPart.quantity === 0) {
      this.inventory.parts.delete(partId);
      // Remove from storage locations
      for (const [loc, parts] of this.inventory.storageLocations) {
        const idx = parts.indexOf(partId);
        if (idx >= 0) parts.splice(idx, 1);
      }
    }

    this.onInventoryChange?.();
    return sellPrice;
  }

  /**
   * Use part for repair (removes from inventory)
   */
  usePart(partId: string): InventoryPart | null {
    const invPart = this.inventory.parts.get(partId);
    if (!invPart || invPart.quantity <= 0) return null;

    invPart.quantity--;
    this.inventory.currentWeight -= this.estimatePartWeight(invPart.part);

    if (invPart.quantity === 0) {
      this.inventory.parts.delete(partId);
      for (const [loc, parts] of this.inventory.storageLocations) {
        const idx = parts.indexOf(partId);
        if (idx >= 0) parts.splice(idx, 1);
      }
    }

    this.onInventoryChange?.();
    return invPart;
  }

  /**
   * Move part between locations
   */
  movePart(partId: string, from: string, to: string): boolean {
    const fromParts = this.inventory.storageLocations.get(from);
    const toParts = this.inventory.storageLocations.get(to);
    if (!fromParts || !toParts) return false;

    const idx = fromParts.indexOf(partId);
    if (idx < 0) return false;

    fromParts.splice(idx, 1);
    toParts.push(partId);

    const invPart = this.inventory.parts.get(partId);
    if (invPart) {
      invPart.location = to as any;
    }

    this.onInventoryChange?.();
    return true;
  }

  /**
   * Get parts in inventory for a subsystem
   */
  getPartsForSubsystem(subsystem: string): InventoryPart[] {
    const results: InventoryPart[] = [];
    for (const invPart of this.inventory.parts.values()) {
      if (invPart.part.category === subsystem) {
        results.push(invPart);
      }
    }
    return results;
  }

  /**
   * Get all inventory parts
   */
  getAllInventory(): InventoryPart[] {
    return Array.from(this.inventory.parts.values());
  }

  /**
   * Get parts at specific location
   */
  getPartsAtLocation(location: string): InventoryPart[] {
    const partIds = this.inventory.storageLocations.get(location) || [];
    return partIds.map(id => this.inventory.parts.get(id)).filter(Boolean) as InventoryPart[];
  }

  /**
   * Check if part is compatible with vehicle
   */
  isCompatible(partId: string, vehicleSpecsId: string): boolean {
    const part = this.catalogue.getPart(partId);
    if (!part) return false;
    return part.compatibleWith.includes('*') || part.compatibleWith.includes(vehicleSpecsId);
  }

  /**
   * Get part price for given condition
   */
  getPartPrice(partId: string, condition: PartCondition): number {
    const part = this.catalogue.getPart(partId);
    if (!part) return 0;
    return Math.round(part.priceNew * this.conditionPriceMultipliers[condition]);
  }

  /**
   * Get part reliability factor for condition
   */
  getPartReliability(partId: string, condition: PartCondition): number {
    const part = this.catalogue.getPart(partId);
    if (!part) return 0;
    return this.conditionReliabilityMultipliers[condition];
  }

  /**
   * Get available scrapyard parts (random daily stock)
   */
  getScrapyardStock(
    subsystem?: SubsystemName
  ): { part: Part; condition: 'scrapyard'; price: number; reliability: number }[] {
    const results: { part: Part; condition: 'scrapyard'; price: number; reliability: number }[] =
      [];

    for (const part of this.catalogue.getAllParts()) {
      if (subsystem && part.category !== subsystem) continue;
      if (Math.random() < 0.3) {
        // 30% chance each part is in scrapyard today
        results.push({
          part,
          condition: 'scrapyard',
          price: Math.round(part.priceNew * this.conditionPriceMultipliers.scrapyard),
          reliability: this.conditionReliabilityMultipliers.scrapyard,
        });
      }
    }

    return results;
  }

  /**
   * Search parts by name/category
   */
  searchParts(query: string): Part[] {
    const lowerQuery = query.toLowerCase();
    return this.catalogue
      .getAllParts()
      .filter(
        p =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.category.toLowerCase().includes(lowerQuery) ||
          p.brand.toLowerCase().includes(lowerQuery)
      );
  }

  /**
   * Get required tools for part installation
   */
  getRequiredTools(partId: string): ToolRequirement[] {
    const part = this.catalogue.getPart(partId);
    return part?.requiresTools || [];
  }

  /**
   * Get condition price multiplier
   */
  getConditionPriceMultiplier(condition: PartCondition): number {
    return this.conditionPriceMultipliers[condition];
  }

  /**
   * Get condition reliability multiplier
   */
  getConditionReliabilityMultiplier(condition: PartCondition): number {
    return this.conditionReliabilityMultipliers[condition];
  }

  /**
   * Read-only access to the part catalogue (used by the shop UI).
   */
  getCatalogue(): PartCatalogue {
    return this.catalogue;
  }

  /**
   * Check if player has all required tools
   */
  checkToolsAvailable(
    partId: string,
    ownedTools: string[]
  ): { hasAll: boolean; missing: ToolRequirement[] } {
    const required = this.getRequiredTools(partId);
    const missing = required.filter(req => !ownedTools.includes(req.tool));
    return { hasAll: missing.length === 0, missing };
  }

  /**
   * Get inventory weight
   */
  getWeight(): { current: number; max: number } {
    return { current: this.inventory.currentWeight, max: this.inventory.maxWeight };
  }

  /**
   * Upgrade storage capacity
   */
  upgradeStorage(newMaxWeight: number): boolean {
    const cost = (newMaxWeight - this.inventory.maxWeight) * 50; // £50 per kg
    if (this.money < cost) return false;

    this.money -= cost;
    this.inventory.maxWeight = newMaxWeight;
    this.onMoneyChange?.(this.money);
    this.onInventoryChange?.();
    return true;
  }

  serialize(): any {
    return {
      money: this.money,
      inventory: {
        parts: Array.from(this.inventory.parts.entries()),
        maxWeight: this.inventory.maxWeight,
        currentWeight: this.inventory.currentWeight,
        storageLocations: Array.from(this.inventory.storageLocations.entries()),
      },
    };
  }

  deserialize(data: any): void {
    this.money = data.money || 0;
    this.inventory.parts = new Map(data.inventory?.parts || []);
    this.inventory.maxWeight = data.inventory?.maxWeight || 50;
    this.inventory.currentWeight = data.inventory?.currentWeight || 0;
    this.inventory.storageLocations = new Map(
      data.inventory?.storageLocations || [
        ['garage', []],
        ['van', []],
        ['mobile_toolbox', []],
      ]
    );
    this.onMoneyChange?.(this.money);
    this.onInventoryChange?.();
  }
}

// ============================================
// PARTS SHOP (UI Integration)
// ============================================

export interface ShopItem {
  part: Part;
  condition: PartCondition;
  price: number;
  reliability: number;
  inStock: boolean;
  stockCount: number;
  isDiscounted: boolean;
  discountPercent: number;
}

export class PartsShop {
  private partsManager: PartsManager;
  private dailyDeals = new Map<string, { discount: number; expires: number }>();

  constructor(partsManager: PartsManager) {
    this.partsManager = partsManager;
    this.generateDailyDeals();
  }

  private generateDailyDeals(): void {
    // Generate 3-5 daily deals
    const allParts = this.partsManager.getAllInventory();
    const count = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count && i < allParts.length; i++) {
      const part = allParts[Math.floor(Math.random() * allParts.length)].part;
      this.dailyDeals.set(part.id, {
        discount: 0.1 + Math.random() * 0.2, // 10-30% off
        expires: Date.now() + 24 * 60 * 60 * 1000,
      });
    }
  }

  getShopItems(category?: SubsystemName, condition?: PartCondition): ShopItem[] {
    const items: ShopItem[] = [];
    const catalogueParts = category
      ? this.partsManager.getCatalogue().getPartsForSubsystem(category)
      : this.partsManager.getCatalogue().getAllParts();

    for (const part of catalogueParts) {
      const conditions: PartCondition[] = condition ? [condition] : ['new', 'refurbished', 'used'];

      for (const cond of conditions) {
        if (cond === 'new' && part.stock === 0) continue;

        const deal = this.dailyDeals.get(part.id);
        const price = Math.round(part.priceNew * this.partsManager.getConditionPriceMultiplier(cond));
        const discountedPrice = deal ? Math.round(price * (1 - deal.discount)) : price;

        items.push({
          part,
          condition: cond,
          price: discountedPrice,
          reliability: this.partsManager.getConditionReliabilityMultiplier(cond),
          inStock: cond !== 'new' || part.stock > 0,
          stockCount: cond === 'new' ? part.stock : 999,
          isDiscounted: !!deal,
          discountPercent: deal ? Math.round(deal.discount * 100) : 0,
        });
      }
    }

    return items;
  }

  getDailyDeals(): ShopItem[] {
    return this.getShopItems().filter(i => i.isDiscounted);
  }

  refreshDailyDeals(): void {
    this.dailyDeals.clear();
    this.generateDailyDeals();
  }
}
