import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-cannon': ['cannon-es'],
          'vendor-gsap': ['gsap'],
          'world': [
            './src/world/WorldStreamer.ts',
            './src/world/ChunkManager.ts',
            './src/world/WorldGrid.ts',
            './src/world/ImposterSystem.ts',
            './src/world/AssetStreamer.ts',
            './src/world/TerrainSystem.ts',
            './src/world/RoadNetwork.ts',
            './src/world/HouseGenerator.ts',
            './src/world/GarageNetwork.ts',
          ],
          'vehicle': [
            './src/vehicle/Vehicle.ts',
            './src/vehicle/VehicleSpecs.ts',
            './src/vehicle/VehiclePhysics.ts',
            './src/vehicle/Drivetrain.ts',
            './src/vehicle/VehicleController.ts',
            './src/vehicle/VehicleCamera.ts',
            './src/vehicle/EnterExitSystem.ts',
            './src/vehicle/DamageModel.ts',
            './src/vehicle/MechanicalSystems.ts',
            './src/vehicle/DamageVisuals.ts',
            './src/vehicle/RepairSystem.ts',
            './src/vehicle/BreakdownSystem.ts',
            './src/vehicle/RecoveryTruck.ts',
          ],
          'repair': [
            './src/repair/DiagnosisMinigame.ts',
            './src/repair/PartSystem.ts',
            './src/repair/ToolSystem.ts',
            './src/repair/RepairBay.ts',
          ],
          'workers': [
            './src/workers/terrainWorker.ts',
            './src/workers/houseWorker.ts',
            './src/workers/physicsWorker.ts',
          ],
          'textures': [
            './src/systems/TextureCompression.ts',
          ],
          'systems': [
            './src/systems/Narrator.ts',
            './src/systems/SceneManager.ts',
            './src/systems/JobSystem.ts',
            './src/systems/ShopSystem.ts',
            './src/systems/EconomySystem.ts',
            './src/systems/CleaningSystem.ts',
            './src/systems/FurnitureManager.ts',
            './src/systems/DiegeticHUD.ts',
            './src/systems/AudioManager.ts',
            './src/systems/SaveSystem.ts',
          ],
          'game': ['./src/game/Game.ts'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    host: true,
    open: true,
  },
})