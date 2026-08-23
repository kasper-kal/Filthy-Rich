import * as THREE from 'three'
import { BreakdownEvent } from './BreakdownSystem.js'
import { RepairBayManager } from '../repair/RepairBay.js'

/**
 * RecoveryTruck - Call recovery, wait, tow to garage
 * Player can call recovery when broken down, AI truck drives to them
 */

export type RecoveryStatus = 'idle' | 'dispatched' | 'en_route' | 'arrived' | 'loading' | 'transporting' | 'delivered' | 'cancelled'

export interface RecoveryTruck {
  id: string
  garageId: string
  position: THREE.Vector3
  targetPosition?: THREE.Vector3
  status: RecoveryStatus
  assignedBreakdown?: BreakdownEvent
  assignedVehicleId?: string
  dispatchTime?: number
  arrivalTime?: number
  deliveryTime?: number
  capacity: 'car' | 'van' | 'truck' // what it can tow
  baseCost: number
  perKmCost: number
  waitTimeCharge: number // per hour after arrival
  driverName: string
  driverPersonality: 'grumpy' | 'chatty' | 'silent' | 'helpful'
}

export interface RecoveryRequest {
  id: string
  vehicleId: string
  position: THREE.Vector3
  breakdown: BreakdownEvent
  requestedGarageId?: string
  status: 'pending' | 'accepted' | 'en_route' | 'complete' | 'cancelled'
  truckId?: string
  quotedCost: number
  finalCost: number
  createdAt: number
  acceptedAt?: number
  completedAt?: number
}

export interface RecoveryCompany {
  id: string
  name: string
  basePosition: THREE.Vector3
  coverageRadius: number // km
  trucks: RecoveryTruck[]
  baseRate: number
  perKmRate: number
  responseTimeGuarantee: number // minutes
  reputation: number
  phoneNumber: string
}

export class RecoverySystem {
  private companies: Map<string, RecoveryCompany> = new Map()
  private activeRequests: Map<string, RecoveryRequest> = new Map()
  private requestCounter = 0
  private rng: () => number

  // Callbacks
  onRequestCreated?: (request: RecoveryRequest) => void
  onRequestAccepted?: (request: RecoveryRequest, truck: RecoveryTruck) => void
  onTruckArrived?: (request: RecoveryRequest, truck: RecoveryTruck) => void
  onVehicleLoaded?: (request: RecoveryRequest) => void
  onVehicleDelivered?: (request: RecoveryRequest) => void
  onCostUpdate?: (requestId: string, cost: number) => void

  constructor(rng: () => number = Math.random) {
    this.rng = rng
    this.generateRecoveryCompanies()
  }

  private generateRecoveryCompanies(): void {
    const companies: Partial<RecoveryCompany>[] = [
      {
        id: 'aa_recovery',
        name: 'AA Recovery',
        basePosition: new THREE.Vector3(0, 0, 0),
        coverageRadius: 50,
        baseRate: 85,
        perKmRate: 2.5,
        responseTimeGuarantee: 45,
        reputation: 85,
        phoneNumber: '0800 88 77 66'
      },
      {
        id: 'rac_rescue',
        name: 'RAC Rescue',
        basePosition: new THREE.Vector3(300, 0, 200),
        coverageRadius: 50,
        baseRate: 90,
        perKmRate: 2.3,
        responseTimeGuarantee: 40,
        reputation: 82,
        phoneNumber: '0800 828 282'
      },
      {
        id: 'green_flag',
        name: 'Green Flag',
        basePosition: new THREE.Vector3(-200, 0, -300),
        coverageRadius: 40,
        baseRate: 75,
        perKmRate: 2.0,
        responseTimeGuarantee: 50,
        reputation: 75,
        phoneNumber: '0800 400 600'
      },
      {
        id: 'local_daves',
        name: "Dave's Recovery & Towing",
        basePosition: new THREE.Vector3(150, 0, 100),
        coverageRadius: 20,
        baseRate: 60,
        perKmRate: 1.8,
        responseTimeGuarantee: 60,
        reputation: 65,
        phoneNumber: '01234 567890'
      },
      {
        id: 'heavy_haulage',
        name: 'Heavy Haulage Ltd',
        basePosition: new THREE.Vector3(500, 0, 300),
        coverageRadius: 60,
        baseRate: 150,
        perKmRate: 3.5,
        responseTimeGuarantee: 90,
        reputation: 70,
        phoneNumber: '0800 123 4567'
      }
    ]

    const driverNames = ['Baz', 'Gav', 'Kev', 'Mick', 'Trev', 'Shazza', 'Tracy', 'Debs', 'Big John', 'Little Dave']
    const personalities: RecoveryTruck['driverPersonality'][] = ['grumpy', 'chatty', 'silent', 'helpful']

    for (const c of companies) {
      const company: RecoveryCompany = {
        id: c.id!,
        name: c.name!,
        basePosition: c.basePosition!,
        coverageRadius: c.coverageRadius!,
        baseRate: c.baseRate!,
        perKmRate: c.perKmRate!,
        responseTimeGuarantee: c.responseTimeGuarantee!,
        reputation: c.reputation!,
        phoneNumber: c.phoneNumber!,
        trucks: []
      }

      // Add 2-4 trucks per company
      const truckCount = 2 + Math.floor(this.rng() * 3)
      for (let i = 0; i < truckCount; i++) {
        company.trucks.push({
          id: `${c.id}_truck_${i}`,
          garageId: c.id!,
          position: c.basePosition!.clone().add(new THREE.Vector3((this.rng() - 0.5) * 100, 0, (this.rng() - 0.5) * 100)),
          status: 'idle',
          capacity: i === 0 ? 'truck' : this.rng() < 0.3 ? 'van' : 'car',
          baseCost: c.baseRate!,
          perKmCost: c.perKmRate!,
          waitTimeCharge: c.baseRate! * 0.5,
          driverName: driverNames[Math.floor(this.rng() * driverNames.length)],
          driverPersonality: personalities[Math.floor(this.rng() * personalities.length)]
        })
      }

      this.companies.set(c.id!, company)
    }
  }

  /**
   * Find available truck for recovery
   */
  private findAvailableTruck(position: THREE.Vector3, capacity: 'car' | 'van' | 'truck' = 'car'): { company: RecoveryCompany; truck: RecoveryTruck } | null {
    let best: { company: RecoveryCompany; truck: RecoveryTruck; distance: number } | null = null

    for (const company of this.companies.values()) {
      const dist = position.distanceTo(company.basePosition)
      if (dist > company.coverageRadius * 1000) continue // outside coverage

      for (const truck of company.trucks) {
        if (truck.status !== 'idle') continue

        const truckDist = truck.position.distanceTo(position)
        if (!best || truckDist < best.distance) {
          best = { company, truck, distance: truckDist }
        }
      }
    }

    return best ? { company: best.company, truck: best.truck } : null
  }

  /**
   * Call recovery for a breakdown
   */
  callRecovery(
    vehicleId: string,
    position: THREE.Vector3,
    breakdown: BreakdownEvent,
    preferredGarageId?: string,
    money: number = 0
  ): { success: boolean; request?: RecoveryRequest; reason?: string; money?: number } {
    // Find available truck
    const match = this.findAvailableTruck(position, breakdown.recoveryRequired ? 'truck' : 'car')
    if (!match) {
      return { success: false, reason: 'No recovery trucks available in your area' }
    }

    const { company, truck } = match
    const distance = truck.position.distanceTo(position) / 1000 // km
    const quotedCost = Math.round(company.baseRate + distance * company.perKmRate)

    if (money < quotedCost) {
      return { success: false, reason: `Insufficient funds. Need £${quotedCost}`, money }
    }

    // Create request
    this.requestCounter++
    const request: RecoveryRequest = {
      id: `rec_${Date.now()}_${this.requestCounter}`,
      vehicleId,
      position,
      breakdown,
      requestedGarageId: preferredGarageId,
      status: 'accepted',
      truckId: truck.id,
      quotedCost,
      finalCost: quotedCost,
      createdAt: Date.now(),
      acceptedAt: Date.now()
    }

    // Dispatch truck
    truck.status = 'dispatched'
    truck.assignedBreakdown = breakdown
    truck.assignedVehicleId = vehicleId
    truck.targetPosition = position.clone()
    truck.dispatchTime = Date.now()

    // Simulate travel time
    const travelTime = Math.max(15, Math.round(distance * 2 * 60 * 1000)) // ~30km/h average + loading
    truck.arrivalTime = Date.now() + travelTime

    this.activeRequests.set(request.id, request)
    this.onRequestCreated?.(request)
    this.onRequestAccepted?.(request, truck)

    return { success: true, request, money: money - quotedCost }
  }

  /**
   * Update recovery system (call each frame)
   */
  update(deltaTime: number, playerPosition?: THREE.Vector3): void {
    const now = Date.now()

    for (const [requestId, request] of this.activeRequests) {
      if (request.status === 'cancelled' || request.status === 'complete') continue

      const truck = this.findTruckById(request.truckId!)
      if (!truck) continue

      // Update truck position towards target
      if (truck.targetPosition && (truck.status === 'en_route' || truck.status === 'dispatched')) {
        if (truck.status === 'dispatched') {
          truck.status = 'en_route'
        }

        const direction = truck.targetPosition.clone().sub(truck.position).normalize()
        const speed = 15 // m/s (54 km/h)
        truck.position.addScaledVector(direction, speed * deltaTime)

        // Check arrival
        if (truck.position.distanceTo(truck.targetPosition) < 10) {
          truck.position.copy(truck.targetPosition)
          truck.status = 'arrived'
          request.status = 'en_route'
          this.onTruckArrived?.(request, truck)

          // Start loading
          setTimeout(() => {
            this.startLoading(requestId)
          }, 2000)
        }
      }

      // Update wait charges
      if (truck.status === 'arrived' || truck.status === 'loading') {
        const waitHours = (now - (truck.arrivalTime || now)) / 3600000
        if (waitHours > 1) {
          const extraCost = Math.ceil(waitHours - 1) * truck.waitTimeCharge
          request.finalCost = request.quotedCost + extraCost
          this.onCostUpdate?.(requestId, request.finalCost)
        }
      }

      // Transporting to garage
      if (truck.status === 'transporting' && request.requestedGarageId) {
        const garage = this.getGaragePosition(request.requestedGarageId)
        if (garage) {
          const direction = garage.clone().sub(truck.position).normalize()
          const speed = 15 // m/s (54 km/h)
          truck.position.addScaledVector(direction, speed * deltaTime)

          if (truck.position.distanceTo(garage) < 10) {
            truck.position.copy(garage)
            this.completeDelivery(requestId)
          }
        }
      }
    }

    // Clean up old requests
    for (const [requestId, request] of this.activeRequests) {
      if (request.status === 'complete' || request.status === 'cancelled') {
        if (request.completedAt && now - request.completedAt > 60000) {
          this.activeRequests.delete(requestId)
        }
      }
    }
  }

  private findTruckById(truckId: string): RecoveryTruck | null {
    for (const company of this.companies.values()) {
      const truck = company.trucks.find(t => t.id === truckId)
      if (truck) return truck
    }
    return null
  }

  private getGaragePosition(garageId: string): THREE.Vector3 | null {
    // This would integrate with RepairBayManager
    // For now, return a placeholder
    return new THREE.Vector3(0, 0, 0)
  }

  private startLoading(requestId: string): void {
    const request = this.activeRequests.get(requestId)
    if (!request) return

    const truck = this.findTruckById(request.truckId!)
    if (!truck) return

    truck.status = 'loading'

    // Loading takes 5-10 minutes
    const loadTime = 5 + Math.floor(this.rng() * 5)
    setTimeout(() => {
      this.finishLoading(requestId)
    }, loadTime * 60 * 1000)
  }

  private finishLoading(requestId: string): void {
    const request = this.activeRequests.get(requestId)
    if (!request) return

    const truck = this.findTruckById(request.truckId!)
    if (!truck) return

    truck.status = 'transporting'
    this.onVehicleLoaded?.(request)
  }

  private completeDelivery(requestId: string): void {
    const request = this.activeRequests.get(requestId)
    if (!request) return

    const truck = this.findTruckById(request.truckId!)
    if (!truck) return

    truck.status = 'delivered'
    truck.assignedBreakdown = undefined
    truck.assignedVehicleId = undefined
    truck.targetPosition = undefined

    request.status = 'complete'
    request.completedAt = Date.now()

    // Return truck to base after a bit
    const company = this.companies.get(truck.garageId)
    if (company) {
      setTimeout(() => {
        truck.status = 'idle'
        truck.position.copy(company.basePosition)
      }, 10000)
    }

    this.onVehicleDelivered?.(request)
  }

  /**
   * Cancel recovery request
   */
  cancelRequest(requestId: string): boolean {
    const request = this.activeRequests.get(requestId)
    if (!request || request.status === 'complete') return false

    request.status = 'cancelled'

    const truck = this.findTruckById(request.truckId!)
    if (truck) {
      truck.status = 'idle'
      truck.assignedBreakdown = undefined
      truck.assignedVehicleId = undefined
      truck.targetPosition = undefined
      // Return to base
      const company = this.companies.get(truck.garageId)
      if (company) {
        truck.position.copy(company.basePosition)
      }
    }

    return true
  }

  /**
   * Get active request for vehicle
   */
  getActiveRequest(vehicleId: string): RecoveryRequest | undefined {
    for (const request of this.activeRequests.values()) {
      if (request.vehicleId === vehicleId && request.status !== 'complete' && request.status !== 'cancelled') {
        return request
      }
    }
    return undefined
  }

  /**
   * Get all recovery companies
   */
  getCompanies(): RecoveryCompany[] {
    return Array.from(this.companies.values())
  }

  /**
   * Get estimated arrival time
   */
  getETA(requestId: string): number | null {
    const request = this.activeRequests.get(requestId)
    if (!request) return null

    const truck = this.findTruckById(request.truckId!)
    if (!truck || !truck.arrivalTime) return null

    return truck.arrivalTime - Date.now()
  }

  /**
   * Set garage position for delivery (called by RepairBayManager)
   */
  setGaragePosition(garageId: string, position: THREE.Vector3): void {
    // Store for delivery routing
  }

  serialize(): any {
    return {
      companies: Array.from(this.companies.entries()).map(([id, c]) => ({
        ...c,
        trucks: c.trucks.map(t => ({
          ...t,
          position: { x: t.position.x, y: t.position.y, z: t.position.z },
          targetPosition: t.targetPosition ? { x: t.targetPosition.x, y: t.targetPosition.y, z: t.targetPosition.z } : undefined
        })),
        basePosition: { x: c.basePosition.x, y: c.basePosition.y, z: c.basePosition.z }
      })),
      activeRequests: Array.from(this.activeRequests.entries())
    }
  }

  deserialize(data: any): void {
    this.companies.clear()
    for (const [id, c] of data.companies || []) {
      this.companies.set(id, {
        ...c,
        trucks: c.trucks.map((t: any) => ({
          ...t,
          position: new THREE.Vector3(t.position.x, t.position.y, t.position.z),
          targetPosition: t.targetPosition ? new THREE.Vector3(t.targetPosition.x, t.targetPosition.y, t.targetPosition.z) : undefined
        })),
        basePosition: new THREE.Vector3(c.basePosition.x, c.basePosition.y, c.basePosition.z)
      })
    }
    this.activeRequests = new Map(data.activeRequests || [])
  }
}

// ============================================
// RECOVERY PHONE UI HELPER
// ============================================

export function formatRecoveryQuote(request: RecoveryRequest): string {
  const truck = request.truckId ? 'assigned' : 'searching'
  return `
RECOVERY QUOTE
══════════════
Vehicle: ${request.vehicleId}
Location: ${request.position.x.toFixed(0)}, ${request.position.z.toFixed(0)}
Breakdown: ${request.breakdown.description}
Truck: ${truck}
Base: £${request.quotedCost.toLocaleString()}
Wait charges: £${Math.max(0, request.finalCost - request.quotedCost).toLocaleString()}/hr after 1hr
══════════════
Total Est: £${request.finalCost.toLocaleString()}
`
}

export function getDriverLine(truck: RecoveryTruck, situation: 'dispatch' | 'arrival' | 'loading' | 'delivery'): string {
  const lines: Record<RecoveryTruck['driverPersonality'], Record<string, string[]>> = {
    grumpy: {
      dispatch: ["Right. Where is it?", "Another one. Joy.", "Hope you've got cash."],
      arrival: ["Here. Get it on.", "You're blocking the road.", "Keys?"],
      loading: ["Watch the paint.", "Straight on.", "Don't scratch the ramp."],
      delivery: ["There. Job done.", "Next time don't break it.", "Invoice is in the cab."]
    },
    chatty: {
      dispatch: ["On me way! Kettle's on when I get back.", "Alright mate, be there soon.", "Had a busy morning already."],
      arrival: ["Hello! Right state, innit?", "Blimey, what happened here?", "Tea? No? Alright."],
      loading: ["Up she goes. Easy does it.", "Straight as a die.", "That's her secure."],
      delivery: ["There you go love. Garage'll sort you.", "Safe journey home.", "Tell the missus I said hello."]
    },
    silent: {
      dispatch: ["..."],
      arrival: ["..."],
      loading: ["..."],
      delivery: ["..."]
    },
    helpful: {
      dispatch: ["On my way. Stay safe.", "Dispatching now. ETA 20 mins.", "I'll call when I'm close."],
      arrival: ["Right, let's have a look.", "Keys in the ignition?", "Any loose items in the car?"],
      loading: ["Strapping down now.", "All secure.", "Ready to go."],
      delivery: ["Dropped at the garage. They've got your details.", "Here's the paperwork.", "Drive safe when it's fixed."]
    }
  }

  const personalityLines = lines[truck.driverPersonality]
  const situationLines = personalityLines[situation]
  return situationLines[Math.floor(Math.random() * situationLines.length)]
}