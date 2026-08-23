import { describe, it, expect, beforeEach } from 'vitest';
import { EconomySystem } from './EconomySystem.js';

describe('EconomySystem', () => {
  let economy: EconomySystem;

  beforeEach(() => {
    economy = new EconomySystem();
  });

  it('should start with zero budget', () => {
    expect(economy.budget).toBe(0);
  });

  it('should add budget correctly', () => {
    economy.addBudget(100);
    expect(economy.budget).toBe(100);
  });

  it('should not go below zero when spending', () => {
    economy.addBudget(50);
    const result = economy.spendBudget(100);
    expect(result).toBe(false);
    expect(economy.budget).toBe(50);
  });

  it('should spend budget correctly when sufficient', () => {
    economy.addBudget(100);
    const result = economy.spendBudget(30);
    expect(result).toBe(true);
    expect(economy.budget).toBe(70);
  });

  it('should calculate budget based on job score', () => {
    // 100% score = full budget
    const budget100 = economy.calculateBudget(100);
    expect(budget100).toBeGreaterThan(0);

    // 50% score = roughly half budget (with variance)
    const budget50 = economy.calculateBudget(50);
    expect(budget50).toBeLessThan(budget100);

    // 0% score = minimum budget
    const budget0 = economy.calculateBudget(0);
    expect(budget0).toBeGreaterThanOrEqual(0);
    expect(budget0).toBeLessThan(budget50);
  });

  it('should track placed furniture', () => {
    expect(economy.placedFurniture).toEqual([]);

    economy.placeFurniture('sofa', { x: 0, y: 0, z: 0 }, 0);
    expect(economy.placedFurniture.length).toBe(1);
    expect(economy.placedFurniture[0].id).toBe('sofa');
  });

  it('should remove placed furniture', () => {
    economy.placeFurniture('sofa', { x: 0, y: 0, z: 0 }, 0);
    economy.removeFurniture(0);
    expect(economy.placedFurniture.length).toBe(0);
  });
});
