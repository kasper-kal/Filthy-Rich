export interface InputState {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  // Keys
  keyW: boolean;
  keyA: boolean;
  keyS: boolean;
  keyD: boolean;
  keySpace: boolean;
  keyShift: boolean;
  keyE: boolean;
  keyQ: boolean;
  keyJ: boolean;
  keyR: boolean;
  keyEscape: boolean;
}

export class InputManager {
  public onMouseMove?: (event: MouseEvent) => void;
  public onMouseDown?: (event: MouseEvent) => void;
  public onMouseUp?: (event: MouseEvent) => void;
  public onKeyDown?: (event: KeyboardEvent) => void;
  public onWheel?: (event: WheelEvent) => void;

  private element: HTMLElement;
  private keys = new Set<string>();
  private mouseButtons = new Set<number>();
  // Touch driving input, zeroed on desktop.
  private touchInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };

  constructor(element: HTMLElement) {
    this.element = element;
    this.bindEvents();
  }

  private bindEvents(): void {
    this.element.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.element.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.element.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
    window.addEventListener('contextmenu', e => {
      e.preventDefault();
    });
  }

  private handleMouseMove(event: MouseEvent): void {
    this.onMouseMove?.(event);
  }

  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.mouseButtons.add(event.button);
    this.onMouseDown?.(event);
  }

  private handleMouseUp(event: MouseEvent): void {
    this.mouseButtons.delete(event.button);
    this.onMouseUp?.(event);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Don't interfere with typing in inputs
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
      return;
    this.keys.add(event.code);
    this.onKeyDown?.(event);
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.code);
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    this.onWheel?.(event);
  }

  /** Feed the on-screen stick into the vehicle controls. */
  setTouchInput(input: Partial<{ throttle: number; brake: number; steer: number; handbrake: boolean }>): void {
    this.touchInput = { ...this.touchInput, ...input };
  }

  getInputState(): InputState {
    const keyboardThrottle = this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0;
    const keyboardBrake = this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0;
    const keyboardSteer =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);

    return {
      throttle: Math.max(keyboardThrottle, this.touchInput.throttle),
      brake: Math.max(keyboardBrake, this.touchInput.brake),
      steer: Math.max(-1, Math.min(1, keyboardSteer + this.touchInput.steer)),
      handbrake: this.keys.has('Space') || this.touchInput.handbrake,
      keyW: this.keys.has('KeyW'),
      keyA: this.keys.has('KeyA'),
      keyS: this.keys.has('KeyS'),
      keyD: this.keys.has('KeyD'),
      keySpace: this.keys.has('Space'),
      keyShift: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      keyE: this.keys.has('KeyE'),
      keyQ: this.keys.has('KeyQ'),
      keyJ: this.keys.has('KeyJ'),
      keyR: this.keys.has('KeyR'),
      keyEscape: this.keys.has('Escape'),
    };
  }

  isKeyPressed(key: string): boolean {
    // Map common key names to codes
    const codeMap: Record<string, string> = {
      w: 'KeyW',
      a: 'KeyA',
      s: 'KeyS',
      d: 'KeyD',
      e: 'KeyE',
      q: 'KeyQ',
      j: 'KeyJ',
      r: 'KeyR',
      escape: 'Escape',
      space: 'Space',
      shift: 'ShiftLeft',
      arrowup: 'ArrowUp',
      arrowdown: 'ArrowDown',
      arrowleft: 'ArrowLeft',
      arrowright: 'ArrowRight',
    };
    const code = codeMap[key.toLowerCase()] || key;
    return this.keys.has(code);
  }

  dispose(): void {
    this.element.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    this.element.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    this.element.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    this.element.removeEventListener('wheel', this.handleWheel.bind(this));
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
  }
}
