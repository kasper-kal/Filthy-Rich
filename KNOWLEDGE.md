# Filthy Rich - Durable Knowledge Base

## Architecture Overview

**Target:** Web (browser), 1.5GB memory budget, 60fps on mid-range laptop
**Stack:** Three.js + Vite + TypeScript + cannon-es physics
**Pattern:** ECS-lite with system-based architecture

---

## World Streaming System

### Chunk System
- **Chunk size:** 200m × 200m
- **World size:** 8km × 8km (1600 chunks max)
- **Max loaded houses:** 10 at LOD0
- **LOD distances:** FULL (0-50m), SIMPLIFIED (50-150m), IMPOSTER (150-500m), CULLED (500m+)

### Priority Queue
- CRITICAL: Player position, view frustum
- HIGH: Nearby chunks, active job house
- NORMAL: Adjacent chunks
- LOW: Distant chunks
- BACKGROUND: Preloading

### Memory Management
- LRU eviction when over budget
- Reference counting for asset sharing
- `AssetStreamer` handles GLTF, KTX2, audio, JSON, binary

---

## Vehicle Physics (Sim-Cade)

### Suspension (Raycast)
- Spring: k=35000 N/m
- Damper: c=4500 N·s/m
- Raycast per wheel per frame (4 total)
- Weight transfer: CG height 0.55m, track 1.6m, wheelbase 2.7m

### Tires (Pacejka Simplified)
- Lateral: B=10, C=1.9, D=1.0, E=0.97
- Longitudinal: D=1.2
- Load sensitivity curve
- Slip angle / ratio calculation

### Drivetrain
- Engine torque curve (RPM → Nm)
- Gear ratios + final drive
- Clutch simulation (slip, engagement)
- LSD types: open, viscous, clutch, Torsen
- Aero drag + downforce at speed

---

## Damage System

### Visual (26 Panels)
- 6 per side + roof + bonnet + boot
- Vertex deformation shader
- Particle systems: smoke, sparks, leaks, steam, debris

### Mechanical (19 Subsystems)
Each has: health (0-100), wear (0-1), temperature, symptoms, failure modes
- Engine: block, head, pistons, valvetrain, lubrication, cooling, ignition, fuel, intake, exhaust, turbo
- Drivetrain: clutch, gearbox, differential, driveshafts
- Chassis: suspension_F/R, brakes_F/R, steering, electrical

### Failure Triggers
- Impacts (collision force → panel + mechanical damage)
- Over-rev (RPM > redline → engine damage)
- Overheating (coolant temp > threshold → head gasket, block)
- Wear over time/mileage (oil degradation, brake pads, tires)

---

## Repair Gameplay

### Diagnosis Minigame
1. Connect OBD → read fault codes (P-codes)
2. Live data: fuel trims, O2, MAF, boost, rail pressure
3. Component tests: compression, leak-down, boost leak, injector balance
4. Suspicion scoring → identify root cause

### Parts System
- Conditions: NEW (100%), REFURBISHED (80%), USED (60%), SCRAPYARD (40% + risk)
- Compatibility matrix per vehicle spec
- Inventory with stacking

### Tools
- Socket set (sizes), torque wrench (Nm), multimeter, lift, spring compressors
- Tool quality affects speed/success chance

---

## Narrator System

### Categories (14 total)
**Original:** intro, stainFound, trashFound, cleaningWell, cleaningPoorly, jobComplete, shop, furniture, idle
**New:** driving, carRepair, breakdown, navigation, fuel

### Context Triggers
- Fuel < 15% → fuel warning
- Speed > limit × 1.15 → speeding roast
- RPM > redline × 0.95 → gear change reminder
- Lateral G > 0.8 → cornering critique
- Warning lights → repair nag
- Vehicle health < 50% → "fix your shit"
- Breakdown event → breakdown lines
- Repair quality < 0.5 → bodge detection
- Job distance < 500m → arrival commentary

---

## State Machine (Game.ts)

```
ON_FOOT ↔ DRIVING (EnterExitSystem)
ON_FOOT → CLEANING (enter house)
CLEANING → ON_FOOT (job complete/fail)
ON_FOOT → SHOPPING (open shop)
ON_FOOT → REPAIRING (enter garage bay)
REPAIRING → DIAGNOSIS (start diagnosis)
DIAGNOSIS → REPAIRING (diagnosis complete)
ON_FOOT → RECOVERY_WAIT (call recovery)
RECOVERY_WAIT → ON_FOOT (vehicle delivered)
```

---

## Save System Schema (Target)

```typescript
{
  version: 2,
  worldSeed: number,
  player: {
    position: {x,y,z},
    state: GameState,
    money: number,
    reputation: number
  },
  vehicle: {
    specs: VehicleSpecsData,
    condition: DamageModelState,
    position: {x,y,z},
    fuel: number,
    mileage: number
  },
  world: {
    discoveredHouses: string[],
    completedJobs: JobRecord[],
    areaReputations: AreaReputation[],
    timeOfDay: number,
    weather: string
  },
  garage: {
    ownedGarageId?: string,
    inventory: PartInstance[],
    tools: ToolInstance[],
    staff: StaffMember[]
  }
}
```

---

## Performance Budgets (Web)

| System | Budget | Strategy |
|--------|--------|----------|
| Terrain | 50MB | Heightmap texture + 4 splat maps, GPU tessellation |
| Roads | 30MB | Instanced spline segments, LOD |
| Houses (loaded) | 200MB | 5-10 at LOD0, rest imposters |
| Vehicles | 50MB | 1 player + 5 AI, shared materials |
| Textures | 500MB | KTX2/BasisU compressed, streaming |
| Audio | 100MB | OGG, streaming for radio/music |
| JS Heap | 300MB | Object pooling, avoid GC spikes |
| **Total** | **~1.2GB** | Under 1.5GB limit |

---

## Key Integration Points

- `WorldStreamer` ↔ `HouseGenerator`: `loadHouseInterior()` on door approach
- `Vehicle` ↔ `BreakdownSystem`: `update()` called every frame with speed/load
- `GarageNetwork` ↔ `RecoverySystem`: `callRecovery()` with preferred garage
- `DiagnosisMinigame` ↔ `PartSystem`: Fault codes → part lookup
- `Narrator` ↔ `Game`: Context updated every frame, triggers checked

---

## Zero-Budget Constraints

- **No paid APIs:** All services free forever (no trials)
- **Hosting:** GitHub Pages / Netlify free tier
- **Assets:** Kenney.nl, Poly Haven, CC0 textures
- **Audio:** Freesound.org, self-recorded
- **Libraries:** Only MIT/BSD/Apache2 licensed deps

---

## Git Workflow

- Commit after EVERY response
- Message format: "what I just did"
- Push to `replithellyeah-ai/game` main branch
- No force pushes