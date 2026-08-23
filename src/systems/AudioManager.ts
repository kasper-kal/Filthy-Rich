export class AudioManager {
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private gainNode: GainNode | null = null;
  private enabled = true;
  private volume = 0.5;
  private loopingSources = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();

  async init(): Promise<void> {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = this.volume;
    this.gainNode.connect(this.context.destination);

    // Generate procedural sounds
    this.generateSounds();
  }

  private generateSounds(): void {
    if (!this.context) return;

    // Sad trombone - descending glissando
    this.buffers.set('sad_trombone', this.createSadTrombone());

    // Clean success - ascending chime
    this.buffers.set('clean_success', this.createCleanSuccess());

    // Trash pickup - pop
    this.buffers.set('trash_pickup', this.createTrashPickup());

    // UI click
    this.buffers.set('click', this.createClick());

    // Purchase - cash register
    this.buffers.set('purchase', this.createPurchase());

    // Error/denied - buzz
    this.buffers.set('denied', this.createDenied());

    // Scrub sound
    this.buffers.set('scrub', this.createScrub());

    // Furniture place - thud
    this.buffers.set('place', this.createPlace());
  }

  private createSadTrombone(): AudioBuffer {
    const duration = 1.5;
    const sampleRate = this.context!.sampleRate;
    const buffer = this.context!.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const progress = t / duration;

      // Descending frequency: 440Hz -> 110Hz
      const freq = 440 * Math.pow(0.25, progress);

      // Trombone-like waveform: square wave with harmonics
      let sample = 0;
      for (let h = 1; h <= 5; h += 2) {
        sample += Math.sin(2 * Math.PI * freq * h * t) / h;
      }
      sample *= 0.3;

      // Envelope: quick attack, slow decay with slight wobble
      const attack = 0.05;
      const env = t < attack ? t / attack : Math.exp(-(t - attack) * 2.5);
      const wobble = 1 + Math.sin(t * 30) * 0.05 * (1 - progress);

      data[i] = sample * env * wobble;
    }

    return buffer;
  }

  private createCleanSuccess(): AudioBuffer {
    const duration = 0.8;
    const sampleRate = this.context!.sampleRate;
    const buffer = this.context!.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      let sample = 0;

      notes.forEach((freq, n) => {
        const noteStart = n * 0.15;
        const noteDur = 0.4;
        if (t >= noteStart && t < noteStart + noteDur) {
          const noteProgress = (t - noteStart) / noteDur;
          const env = Math.exp(-noteProgress * 4);
          sample += Math.sin(2 * Math.PI * freq * t) * env * 0.2;
        }
      });

      data[i] = sample;
    }

    return buffer;
  }

  private createTrashPickup(): AudioBuffer {
    const duration = 0.2;
    const sampleRate = this.context!.sampleRate;
    const buffer = this.context!.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const freq = 200 + Math.random() * 100;
      const env = Math.exp(-t * 30);
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
    }

    return buffer;
  }

  private createClick(): AudioBuffer {
    const duration = 0.05;
    const sampleRate = this.context!.sampleRate;
    const buffer = this.context!.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 80);
      data[i] = Math.sin(2 * Math.PI * 800 * t) * env * 0.2;
    }

    return buffer;
  }

  private createPurchase(): AudioBuffer {
    const duration = 0.6;
    const sampleRate = this.context!.sampleRate;
    const buffer = this.context!.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    const notes = [659.25, 783.99, 1046.5]; // E5, G5, C6

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      let sample = 0;

      notes.forEach((freq, n) => {
        const noteStart = n * 0.1;
        const noteDur = 0.3;
        if (t >= noteStart && t < noteStart + noteDur) {
          const noteProgress = (t - noteStart) / noteDur;
          const env = Math.exp(-noteProgress * 3);
          sample += Math.sin(2 * Math.PI * freq * t) * env * 0.15;
        }
      });

      // Add "cha-ching" metallic ring
      const ringFreq = 2000;
      const ringEnv = Math.exp(-t * 8);
      sample += Math.sin(2 * Math.PI * ringFreq * t) * ringEnv * 0.1;

      data[i] = sample;
    }

    return buffer;
  }

  private createDenied(): AudioBuffer {
    const duration = 0.4;
    const sampleRate = this.context!.sampleRate;
    const buffer = this.context!.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      // Low buzz
      const freq = 80;
      const env = Math.exp(-t * 6);
      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.25;
    }

    return buffer;
  }

  private createScrub(): AudioBuffer {
    const duration = 0.15;
    const sampleRate = this.context!.sampleRate;
    const buffer = this.context!.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      // White noise with bandpass feel
      const noise = (Math.random() * 2 - 1) * 0.1;
      const env = Math.exp(-t * 15);
      data[i] = noise * env;
    }

    return buffer;
  }

  private createPlace(): AudioBuffer {
    const duration = 0.3;
    const sampleRate = this.context!.sampleRate;
    const buffer = this.context!.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      // Low thud with harmonics
      let sample = 0;
      for (let h = 1; h <= 4; h++) {
        sample += Math.sin(2 * Math.PI * 60 * h * t) / h;
      }
      const env = Math.exp(-t * 12);
      data[i] = sample * env * 0.2;
    }

    return buffer;
  }

  play(
    soundName: string,
    options: { volume?: number; pitch?: number; loop?: boolean } = {}
  ): AudioBufferSourceNode | null {
    if (!this.enabled || !this.context || !this.gainNode) return null;

    const buffer = this.buffers.get(soundName);
    if (!buffer) return null;

    // Resume context if suspended (browser autoplay policy)
    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gain = this.context.createGain();
    gain.gain.value = options.volume ?? 1;

    if (options.pitch) {
      source.playbackRate.value = options.pitch;
    }

    if (options.loop) {
      source.loop = true;
      // Track looping sources for later control
      this.loopingSources.set(soundName, { source, gain });
    }

    source.connect(gain);
    gain.connect(this.gainNode);
    source.start(0);

    return source;
  }

  playSadTromboneWithLine(line: string): void {
    this.play('sad_trombone', { volume: 0.6 });
    // The line will be shown by narrator
    console.log('SAD TROMBONE:', line);
  }

  setMasterVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Set audio state based on game state
  setState(state: string): void {
    // Could adjust audio mix based on state (e.g., muffle when in vehicle, radio volume, etc.)
    console.log(`[AudioManager] State changed to: ${state}`);
  }

  setPlaybackRate(soundName: string, rate: number): void {
    const tracked = this.loopingSources.get(soundName);
    if (tracked?.source.playbackRate) {
      tracked.source.playbackRate.value = rate;
    }
  }

  setSoundVolume(soundName: string, volume: number): void {
    const tracked = this.loopingSources.get(soundName);
    if (tracked) {
      tracked.gain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  stop(soundName: string): void {
    const tracked = this.loopingSources.get(soundName);
    if (tracked) {
      try {
        tracked.source.stop();
      } catch (e) {
        // Already stopped
      }
      this.loopingSources.delete(soundName);
    }
  }
}

// Singleton
export const audioManager = new AudioManager();
