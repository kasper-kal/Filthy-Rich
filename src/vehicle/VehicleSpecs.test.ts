import { describe, it, expect } from 'vitest';
import { VehicleSpecs } from './VehicleSpecs.js';

describe('VehicleSpecs', () => {
  it('should have all preset vehicle types', () => {
    const types = ['hatchback', 'sedan', 'van', 'sports', 'banger'];
    for (const type of types) {
      const spec = VehicleSpecs.getPreset(type);
      expect(spec).toBeDefined();
      expect(spec.type).toBe(type);
    }
  });

  it('should have valid dimensions for all presets', () => {
    const types = ['hatchback', 'sedan', 'van', 'sports', 'banger'];
    for (const type of types) {
      const spec = VehicleSpecs.getPreset(type);
      expect(spec.dimensions.length).toBeGreaterThan(0);
      expect(spec.dimensions.width).toBeGreaterThan(0);
      expect(spec.dimensions.height).toBeGreaterThan(0);
    }
  });

  it('should have valid physics properties', () => {
    const spec = VehicleSpecs.getPreset('hatchback');
    expect(spec.mass).toBeGreaterThan(0);
    expect(spec.wheelRadius).toBeGreaterThan(0);
    expect(spec.wheelWidth).toBeGreaterThan(0);
    expect(spec.dimensions.wheelbase).toBeGreaterThan(0);
    expect(spec.dimensions.trackFront).toBeGreaterThan(0);
    expect(spec.centerOfMass.y).toBeGreaterThan(0);
  });

  it('should have valid engine specs', () => {
    const spec = VehicleSpecs.getPreset('hatchback');
    expect(spec.engineRedline).toBeGreaterThan(0);
    expect(spec.fuelCapacity).toBeGreaterThan(0);
    // Engine specs are in drivetrain
    expect(spec.drivetrain.engine.maxPowerKW).toBeGreaterThan(0);
    expect(spec.drivetrain.engine.maxTorqueNm).toBeGreaterThan(0);
    expect(spec.drivetrain.engine.idleRPM).toBeGreaterThan(0);
  });

  it('should have valid drivetrain specs', () => {
    const spec = VehicleSpecs.getPreset('hatchback');
    expect(spec.drivetrain.gearbox.ratios.length).toBeGreaterThan(0);
    expect(spec.drivetrain.gearbox.finalDrive).toBeGreaterThan(0);
    expect(spec.drivetrain.drivetrainLayout).toBeDefined();
  });

  it('should have valid suspension specs', () => {
    const spec = VehicleSpecs.getPreset('hatchback');
    expect(spec.suspension.front.springRate).toBeGreaterThan(0);
    expect(spec.suspension.front.damperRate).toBeGreaterThan(0);
    expect(spec.suspension.front.travel).toBeGreaterThan(0);
  });

  it('should have different specs for different vehicle types', () => {
    const hatchback = VehicleSpecs.getPreset('hatchback');
    const van = VehicleSpecs.getPreset('van');

    expect(van.mass).toBeGreaterThan(hatchback.mass);
    expect(van.dimensions.length).toBeGreaterThan(hatchback.dimensions.length);
    // Van is diesel with lower power than turbo hatchback
    expect(van.drivetrain.engine.maxTorqueNm).toBeGreaterThan(
      hatchback.drivetrain.engine.maxTorqueNm
    );
  });
});
