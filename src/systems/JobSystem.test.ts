import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobSystem, Job, JobStatus } from './JobSystem.js';

describe('JobSystem', () => {
  let jobSystem: JobSystem;

  beforeEach(() => {
    jobSystem = new JobSystem();
  });

  it('should generate jobs', () => {
    jobSystem.generateJobs(5);
    const jobs = jobSystem.getAvailableJobs();
    expect(jobs.length).toBe(5);
  });

  it('should have valid job properties', () => {
    jobSystem.generateJobs(1);
    const jobs = jobSystem.getAvailableJobs();
    const job = jobs[0];

    expect(job.id).toBeDefined();
    expect(job.title).toBeDefined();
    expect(job.description).toBeDefined();
    expect(job.clientName).toBeDefined();
    expect(job.targetRooms).toBeInstanceOf(Array);
    expect(job.targetRooms.length).toBeGreaterThan(0);
    expect(job.requiredCleanliness).toBeGreaterThanOrEqual(0);
    expect(job.requiredCleanliness).toBeLessThanOrEqual(100);
    expect(job.requiredTrashCollected).toBeGreaterThanOrEqual(0);
    expect(job.requiredTrashCollected).toBeLessThanOrEqual(100);
    expect(job.basePay).toBeGreaterThan(0);
    expect(job.status).toBe('available');
  });

  it('should start a job', () => {
    jobSystem.generateJobs(1);
    const jobs = jobSystem.getAvailableJobs();
    const jobId = jobs[0].id;

    const result = jobSystem.startJob(jobId);
    expect(result).toBe(true);

    const activeJob = jobSystem.getActiveJob();
    expect(activeJob).toBeDefined();
    expect(activeJob?.id).toBe(jobId);
    expect(activeJob?.status).toBe('active');
  });

  it('should not start non-existent job', () => {
    const result = jobSystem.startJob('non-existent');
    expect(result).toBe(false);
  });

  it('should update job progress', () => {
    jobSystem.generateJobs(1);
    const jobs = jobSystem.getAvailableJobs();
    jobSystem.startJob(jobs[0].id);

    jobSystem.updateJobProgress('living_room', 50, 30);
    const activeJob = jobSystem.getActiveJob();
    expect(activeJob).toBeDefined();
  });

  it('should track reputation', () => {
    const rep = jobSystem.getReputation();
    expect(rep.current).toBe(0);
    expect(rep.level).toBe(1);
  });

  it('should complete job and award reputation', () => {
    jobSystem.generateJobs(1);
    const jobs = jobSystem.getAvailableJobs();
    jobSystem.startJob(jobs[0].id);

    // Simulate completion via completeJob
    const result = jobSystem.completeJob();
    expect(result.success).toBeDefined();
    expect(result.reputationGained).toBeGreaterThanOrEqual(0);
  });

  it('should have different job types', () => {
    jobSystem.generateJobs(10);
    const jobs = jobSystem.getAvailableJobs();
    const titles = new Set(jobs.map(j => j.title));
    expect(titles.size).toBeGreaterThan(1);
  });
});
