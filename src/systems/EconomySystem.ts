export interface FurnitureItem {
  id: string
  name: string
  description: string
  price: number
  category: 'seating' | 'storage' | 'decor' | 'lighting' | 'bed' | 'table'
  modelType: string // references furniture model
  emoji: string
  // Job system integration
  unlocksAtReputationLevel?: number
  jobTypeBonus?: Partial<Record<string, number>> // bonus pay multiplier for job types
}

export const FURNITURE_CATALOG: FurnitureItem[] = [
  // Seating
  { id: 'armchair', name: 'Leather Armchair', description: 'Smells like your grandad\'s study. In a good way.', price: 850, category: 'seating', modelType: 'armchair', emoji: '🛋️' },
  { id: 'sofa', name: 'Chesterfield Sofa', description: 'Deep buttoned. You could lose a cat in the crevices.', price: 1800, category: 'seating', modelType: 'sofa', emoji: '🛋️' },
  { id: 'office_chair', name: 'Ergonomic Office Chair', description: 'Mesh back. Your lumbar support will send thank-you letters.', price: 650, category: 'seating', modelType: 'office_chair', emoji: '🪑' },
  { id: 'beanbag', name: 'Giant Beanbag', description: 'For when adulting is too much. Swallows you whole.', price: 300, category: 'seating', modelType: 'beanbag', emoji: '🪑' },
  { id: 'dining_chair', name: 'Dining Chair (×4)', description: 'Matching set. Impress guests you don\'t actually like.', price: 480, category: 'seating', modelType: 'dining_chair', emoji: '🪑' },

  // Storage
  { id: 'bookshelf', name: 'Floor-to-Ceiling Bookshelf', description: 'Fill it with unread books. Intellectual aesthetic achieved.', price: 720, category: 'storage', modelType: 'bookshelf', emoji: '📚' },
  { id: 'wardrobe', name: 'Vintage Wardrobe', description: 'Solid oak. Probably haunted. Great storage either way.', price: 1100, category: 'storage', modelType: 'wardrobe', emoji: '🚪' },
  { id: 'tv_stand', name: 'Mid-Century TV Stand', description: 'Tapered legs. Cable management included. You\'re welcome.', price: 550, category: 'storage', modelType: 'tv_stand', emoji: '📺' },
  { id: 'sideboard', name: 'Sideboard', description: 'For the fine china you\'ll never use. Looks expensive though.', price: 680, category: 'storage', modelType: 'sideboard', emoji: '🗄️' },

  // Decor
  { id: 'rug', name: 'Persian Rug', description: 'Ties the room together. The Dude would approve.', price: 950, category: 'decor', modelType: 'rug', emoji: '🏠' },
  { id: 'plant_large', name: 'Fiddle Leaf Fig', description: 'Instagram famous. Dies if you look at it wrong.', price: 180, category: 'decor', modelType: 'plant_large', emoji: '🌿' },
  { id: 'plant_small', name: 'Snake Plant (×3)', description: 'Indestructible. Even you can\'t kill these.', price: 90, category: 'decor', modelType: 'plant_small', emoji: '🌱' },
  { id: 'art_large', name: 'Large Abstract Canvas', description: 'Nobody knows what it means. That\'s the point.', price: 420, category: 'decor', modelType: 'art_large', emoji: '🎨' },
  { id: 'mirror', name: 'Full-Length Mirror', description: 'Check your fit. Or your existential dread. Same thing.', price: 280, category: 'decor', modelType: 'mirror', emoji: '🪞' },

  // Lighting
  { id: 'floor_lamp', name: 'Arc Floor Lamp', description: 'Dramatic curve. Reads "I have taste" at 3am.', price: 380, category: 'lighting', modelType: 'floor_lamp', emoji: '💡' },
  { id: 'table_lamp', name: 'Ceramic Table Lamp Pair', description: 'Warm glow. Makes any surface look intentional.', price: 220, category: 'lighting', modelType: 'table_lamp', emoji: '💡' },
  { id: 'pendant', name: 'Industrial Pendant Light', description: 'Edison bulbs. Exposes the wiring like your emotional baggage.', price: 310, category: 'lighting', modelType: 'pendant', emoji: '💡' },

  // Bed
  { id: 'bed_frame', name: 'King Platform Bed', description: 'No box spring needed. Your mattress deserves a throne.', price: 1200, category: 'bed', modelType: 'bed_frame', emoji: '🛏️' },
  { id: 'nightstand', name: 'Nightstands (Pair)', description: 'For your phone, water, and 3am regrets.', price: 340, category: 'bed', modelType: 'nightstand', emoji: '🛏️' },

  // Table
  { id: 'dining_table', name: 'Walnut Dining Table', description: 'Seats six. Host dinner parties you\'ll cancel.', price: 1400, category: 'table', modelType: 'dining_table', emoji: '🍽️' },
  { id: 'coffee_table', name: 'Glass Coffee Table', description: 'Shows off the rug. Shows off your shins when you kick it.', price: 450, category: 'table', modelType: 'coffee_table', emoji: '☕' },
  { id: 'desk', name: 'Standing Desk', description: 'Motorized. Your back will thank you. Your wallet won\'t.', price: 980, category: 'table', modelType: 'desk', emoji: '💻' },

  // Cleaning Equipment (unlocks at higher reputation)
  { id: 'pro_sprayer', name: 'Professional Sprayer', description: 'Commercial grade. 50% faster spray coverage.', price: 2500, category: 'decor', modelType: 'plant_small', emoji: '🧴', unlocksAtReputationLevel: 3, jobTypeBonus: { standard: 1.1, deep_clean: 1.2 } },
  { id: 'steam_mop', name: 'Steam Mop', description: 'Sanitizes while it cleans. Melts grease instantly.', price: 3200, category: 'decor', modelType: 'plant_small', emoji: '🧹', unlocksAtReputationLevel: 4, jobTypeBonus: { deep_clean: 1.3, hoarder: 1.2 } },
  { id: 'industrial_vac', name: 'Industrial Vacuum', description: 'Shop vac power. Sucks up anything. Wet/dry capable.', price: 4500, category: 'decor', modelType: 'plant_small', emoji: '🌀', unlocksAtReputationLevel: 5, jobTypeBonus: { post_party: 1.3, renovation_prep: 1.4, emergency: 1.2 } },
  { id: 'uv_blacklight', name: 'UV Inspection Light', description: 'Reveals invisible stains. Essential for perfect scores.', price: 1800, category: 'decor', modelType: 'plant_small', emoji: '🔦', unlocksAtReputationLevel: 2, jobTypeBonus: { move_out: 1.2, renovation_prep: 1.1 } },
  { id: 'enzyme_cleaner', name: 'Enzyme Cleaner Set', description: 'Biological cleaner. Destroys organic stains permanently.', price: 2200, category: 'decor', modelType: 'plant_small', emoji: '🧪', unlocksAtReputationLevel: 3, jobTypeBonus: { hoarder: 1.25, pet: 1.5, emergency: 1.15 } },
]

export class EconomySystem {
  public budget = 0
  public ownedFurniture: string[] = []
  public placedFurniture: Array<{ id: string; position: { x: number; y: number; z: number }; rotation: number }> = []

  private readonly STORAGE_KEY = 'filthy-rich-save'

  calculateBudget(cleanlinessScore: number): number {
    // Base payout scales with score
    // 100% = ~2000, 50% = ~800, 0% = 100
    const base = 100 + Math.pow(cleanlinessScore / 100, 1.5) * 1900
    // Add some variance
    const variance = 0.9 + Math.random() * 0.2
    return Math.round(base * variance)
  }

  addBudget(amount: number): void {
    this.budget += amount
    this.save()
  }

  spendBudget(amount: number): boolean {
    if (this.budget >= amount) {
      this.budget -= amount
      this.save()
      return true
    }
    return false
  }

  canAfford(price: number): boolean {
    return this.budget >= price
  }

  ownItem(itemId: string): boolean {
    return this.ownedFurniture.includes(itemId)
  }

  purchaseItem(itemId: string): boolean {
    const item = FURNITURE_CATALOG.find(f => f.id === itemId)
    if (!item) return false

    if (this.spendBudget(item.price)) {
      this.ownedFurniture.push(itemId)
      this.save()
      return true
    }
    return false
  }

  placeFurniture(itemId: string, position: { x: number; y: number; z: number }, rotation: number): void {
    this.placedFurniture.push({ id: itemId, position, rotation })
    this.save()
  }

  removeFurniture(index: number): void {
    if (index >= 0 && index < this.placedFurniture.length) {
      this.placedFurniture.splice(index, 1)
      this.save()
    }
  }

  getCatalog(): FurnitureItem[] {
    return FURNITURE_CATALOG
  }

  getCatalogByCategory(category: FurnitureItem['category']): FurnitureItem[] {
    return FURNITURE_CATALOG.filter(f => f.category === category)
  }

  save(): void {
    const data = {
      budget: this.budget,
      ownedFurniture: this.ownedFurniture,
      placedFurniture: this.placedFurniture,
    }
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('Failed to save:', e)
    }
  }

  load(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.budget = parsed.budget || 0
        this.ownedFurniture = parsed.ownedFurniture || []
        this.placedFurniture = parsed.placedFurniture || []
      }
    } catch (e) {
      console.warn('Failed to load:', e)
    }
  }

  reset(): void {
    this.budget = 0
    this.ownedFurniture = []
    this.placedFurniture = []
    localStorage.removeItem(this.STORAGE_KEY)
  }
}