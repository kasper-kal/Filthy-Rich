import * as THREE from 'three'
import { EconomySystem } from './EconomySystem.js'
import { CleaningSystem } from './CleaningSystem.js'
import { SceneManager } from './SceneManager.js'
import { FurnitureManager } from './FurnitureManager.js'

export class SaveSystem {
  private economySystem: EconomySystem
  private cleaningSystem: CleaningSystem
  private sceneManager: SceneManager
  private furnitureManager: FurnitureManager

  constructor(economySystem: EconomySystem, cleaningSystem: CleaningSystem, sceneManager: SceneManager, furnitureManager: FurnitureManager) {
    this.economySystem = economySystem
    this.cleaningSystem = cleaningSystem
    this.sceneManager = sceneManager
    this.furnitureManager = furnitureManager
  }

  async load(): Promise<void> {
    // Load economy (budget, owned furniture, placed furniture)
    this.economySystem.load()

    // Load placed furniture into scene using new async method
    for (const placed of this.economySystem.placedFurniture) {
      const item = this.economySystem.getCatalog().find(f => f.id === placed.id)
      if (item) {
        await this.furnitureManager.placeSavedFurniture(item.id, placed.position, placed.rotation)
      }
    }
  }

  save(): void {
    this.economySystem.save()
  }

  reset(): void {
    this.economySystem.reset()
    this.cleaningSystem.reset()
    this.furnitureManager.clearAll()
  }

  exportSave(): string {
    return JSON.stringify({
      economy: {
        budget: this.economySystem.budget,
        ownedFurniture: this.economySystem.ownedFurniture,
        placedFurniture: this.economySystem.placedFurniture,
      },
      timestamp: Date.now(),
      version: 1,
    }, null, 2)
  }

  importSave(json: string): boolean {
    try {
      const data = JSON.parse(json)
      if (data.economy) {
        this.economySystem.budget = data.economy.budget || 0
        this.economySystem.ownedFurniture = data.economy.ownedFurniture || []
        this.economySystem.placedFurniture = data.economy.placedFurniture || []
        this.economySystem.save()
        return true
      }
      return false
    } catch {
      return false
    }
  }
}